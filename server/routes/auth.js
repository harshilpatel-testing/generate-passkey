import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import User from '../models/user.js';
import Challenge from '../models/challenge.js';
import base64url from "base64url";

const router = express.Router();

/* ----------------------  CREATE USER  ---------------------- */
router.post('/create', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const newUser = new User({ username, credentials: [] });
    await newUser.save();

    res.status(201).json({ success: true, message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

/* ----------------------  REGISTRATION START  ---------------------- */
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
      rpName: "localhost",
      rpID: process.env.RP_ID,
      userID: Buffer.from(user._id, 'base64'),
      userName: user.username,
      // authenticatorSelection: {
      //   authenticatorAttachment: 'platform', // Prefer Windows Hello / Touch ID
      //   residentKey: 'preferred',
      //   userVerification: 'required',
      // },
    });

    console.log('Generate options for', username, 'challenge=', options.challenge);

    user.challenge = options.challenge;
    await user.save();
    console.log('Saved challenge for', user);
    res.json(options);
  } catch (err) {
    console.error('Error in /generate-registration-options:', err);
    res.status(500).json({ error: err });
  }
});

/* ----------------------  REGISTRATION VERIFY  ---------------------- */
router.post('/verify-registration', async (req, res) => {
  const { username, attestationResponse } = req.body;
  console.log('Verifying registration for:', username);

  const user = await User.findOne({ username });

  // const record = await Challenge.findOne({ username });
  // const expectedChallenge = record?.challenge;

  if (!user) return res.json({ error: "User not found" })

  try {
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: user.challenge,
      expectedOrigin: process.env.EXPECTED_ORIGIN,
      expectedRPID: process.env.RP_ID,
    });

    console.log('Verification result:', verification.registrationInfo.credential);

    if (verification.verified) {
      const { credential } = verification.registrationInfo;

      user.credentials.push({
        credentialID: base64url.encode(credential.id),
        publicKey: base64url.encode(credential.publicKey),
        counter: credential.counter,
      });

      user.challenge = '';

      await user.save();
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Verification failed' });
    }
  } catch (err) {
    console.error('Verify registration error:', err);
    res.status(500).json({ success: false, message: err });
  }
});

/* ----------------------  AUTHENTICATION START  ---------------------- */
router.post('/generate-authentication-options', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.credentials || user.credentials.length === 0) {
      return res.status(400).json({ success: false, message: 'User has no registered credentials' });
    }

    // console.log('Username:', username);
    // console.log('User found:', user);
    // console.log('User credentials:', user.credentials);

    console.log('User found:', user);
    // console.log('Credentials:', user.credentials);
    user.credentials.forEach((cred, i) => {
      console.log(`Credential ${i}:`, cred.credentialID);
    });

    const options = await generateAuthenticationOptions({
      rpID: process.env.RP_ID,
      // allowCredentials: user.credentials.map((cred) => ({
      //   id: cred.credentialID,
      //   type: 'public-key',
      //   transports: ['internal', 'hybrid', 'usb', 'ble', 'nfc'],
      // })),
      // userVerification: 'preferred',
    });

    console.log('Generate authenticate options for', username, 'challenge=', options.challenge);

    // const update = await Challenge.findOneAndUpdate(
    //   { username },
    //   { challenge: options.challenge },
    //   { upsert: true, new: true },
    // );

    user.challenge = options.challenge;
    await user.save();

    console.log("Updated challenge : ", user);

    res.json({ options });
  } catch (error) {
    console.error('Error in /generate-authentication-options:', error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

/* ----------------------  AUTHENTICATION VERIFY  ---------------------- */
router.post('/verify-authentication', async (req, res) => {
  try {
    const { username, assertionResponse } = req.body;
    const user = await User.findOne({ username });
    // const record = await Challenge.findOne({ username });
    // const expectedChallenge = record?.challenge;

    if (!user || !user.challenge) {
      return res.status(400).json({ success: false, message: 'No challenge found' });
    }

    console.log("User found for verify authentication : ", user);
    // console.log("Challenge found for verify authentication : ", record);


    // const dbAuthenticator = user.credentials[0]; // demo: one credential per user
    // console.log("dbAuthenticator : ", dbAuthenticator);

    const authenticator = {
      credentialID: base64url.toBuffer(user.credentials[0].credentialID),
      credentialPublicKey: base64url.toBuffer(user.credentials[0].publicKey),
      counter: user.credentials[0].counter,
    };

    const verification = await verifyAuthenticationResponse({
      expectedChallenge: user.challenge,
      response: assertionResponse,
      expectedOrigin: process.env.EXPECTED_ORIGIN,
      expectedRPID: process.env.RP_ID,
      // credential: {
      //   publicKey: user.credentials[0].publicKey,
      //   id: user.credentials[0].credentialID,
      //   counter: user.credentials[0].counter,
      // },
      credential : {
        id : authenticator.credentialID,
        publicKey : authenticator.credentialPublicKey,
        counter : user.credentials[0].counter
      }
    });

    console.log('Authentication verification result:', verification);
    if (!verification.verified) {
      res.status(400).json({ success: false, message: 'Authentication failed' });
    }

    user.challenge = '';

    await user.save();
    return res.json({ success: true });

  } catch (error) {
    console.error('Error in /verify-authentication:', error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

export default router;
