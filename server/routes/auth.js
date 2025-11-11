import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import User from '../models/user.js';
import Challenge from '../models/challenge.js';


const router = express.Router();

// Store challenges temporarily in-memory (for demo)
// const userChallenges = new Map();

// Create new user manually
router.post('/create', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create new user with no credentials yet
    const newUser = new User({ username, credentials: [] });
    await newUser.save();

    res.status(201).json({ success: true, message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/generate-authentication-options', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.credentials || user.credentials.length === 0) {
      return res.status(400).json({ success: false, message: 'User has no registered credentials' });
    }
    console.log('Username:', username);
    console.log('User found:', user);
    console.log('User credentials:', user?.credentials);

    const options = await generateAuthenticationOptions({
      rpID: process.env.RP_ID,
      allowCredentials: user.credentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: ['internal', 'hybrid', 'usb', 'ble', 'nfc'],
      })),
      userVerification: 'preferred',
    });


    console.log('Generate options for', username, 'challenge=', options.challenge);
    // Save challenge to MongoDB
    await Challenge.findOneAndUpdate(
      { username },
      { challenge: options.challenge },
      { upsert: true, new: true }
    );
    console.log('Saved challenge for', username);
    res.json(options);
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/verify-authentication', async (req, res) => {
  try {
    const { username, assertionResponse } = req.body;
    const user = await User.findOne({ username });
    const record = await Challenge.findOne({ username });
    const expectedChallenge = record?.challenge;

    if (!user || !expectedChallenge) {
      return res.status(400).json({ success: false, message: 'No challenge found' });
    }

    const dbAuthenticator = user.credentials[0]; // demo: assume one credential
    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin: process.env.expectedOrigin,
      expectedRPID: process.env.rpID,
      authenticator: {
        credentialPublicKey: Buffer.from(dbAuthenticator.publicKey, 'base64'),
        credentialID: Buffer.from(dbAuthenticator.credentialID, 'base64'),
        counter: dbAuthenticator.counter,
      },
    });

    if (verification.verified) {
      dbAuthenticator.counter = verification.authenticationInfo.newCounter;
      await user.save();
      await Challenge.deleteOne({ username });

      // (optional) issue JWT for session
      // const token = jwt.sign({ userId: user._id }, 'secretkey', { expiresIn: '1h' });
      return res.json({ success: true, token });
    }

    res.status(400).json({ success: false, message: 'Authentication failed' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/generate-registration-options', async (req, res) => {
  try {
    const { username } = req.body;
    console.log('Incoming username:', username);

    let user = await User.findOne({ username });
    if (!user) {
      console.log('Creating new user...');
      user = new User({ username, credentials: [] });
      await user.save();
    }

    const options = await generateRegistrationOptions({
      rpName: 'WebAuthn Demo',
       rpID: process.env.RP_ID,
      userID: Buffer.from(user._id.toString(), 'utf8'),
      userName: user.username,
    });

    // console.log('Generated registration options:', options);
    console.log('Generate options for', username, 'challenge=', options.challenge);

    await Challenge.findOneAndUpdate(
      { username },
      { challenge: options.challenge },
      { upsert: true, new: true }
    );

    console.log('Saved challenge for', username);

    res.json(options);
  } catch (err) {
    console.error('Error in /generate-registration-options:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-registration', async (req, res) => {
  const { username, attestationResponse } = req.body;
  console.log('Verify registration for', username, 'incomingChallenge=', attestationResponse?.response?.clientDataJSON);
  const record = await Challenge.findOne({ username });
  console.log('Found challenge record:', record);
  const expectedChallenge = record?.challenge;

  console.log(attestationResponse);


  try {
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge,
      expectedOrigin: process.env.EXPECTED_ORIGIN,
      expectedRPID: process.env.RP_ID,
    });

    console.log('Verification result:', verification);


    if (verification.verified) {
      const { credential } = verification.registrationInfo;
      const user = await User.findOne({ username });
      user.credentials.push({
        credentialID: Buffer.from(credential.id).toString('base64'),
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
      });
      await user.save();
      res.json({ success: true });

      await Challenge.deleteOne({ username });

    } else {
      res.status(400).json({ success: false, message: 'Verification failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
