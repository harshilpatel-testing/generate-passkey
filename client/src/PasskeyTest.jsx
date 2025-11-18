import React, { useState } from 'react';
import axios from 'axios';
import {
    startRegistration,
    startAuthentication,
} from '@simplewebauthn/browser';

function PasskeyTest() {
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');

    const [loading, setLoading] = useState(false);

    const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

    // --- Registration ---
    const handleRegister = async () => {
        try {
            console.log('Requesting registration options for', username);

            setLoading(true);
            
            const { data: options } = await axios.post(`${backendURL}/auth/generate-registration-options`, { username });
            console.log('Registration options:', options);
            const attestationResponse = await startRegistration({ optionsJSON: options });
            const verifyRes = await axios.post(`${backendURL}/auth/verify-registration`, { username, attestationResponse });
            setMessage(verifyRes.data.success ? '✅ Registered successfully!' : '❌ Registration failed.');
            setLoading(false);
        } catch (err) {
            setMessage('❌ Error: ' + err.message);
            console.log(err);
        }
    };

    // --- Login ---
    const handleLogin = async () => {
        try {
            console.log('Requesting registration options for', username);
            setLoading(true);
            const { data } = await axios.post(`${backendURL}/auth/generate-authentication-options`, { username });
            const { options } = data;
            console.log('Authentication options:', options);
            
            const assertionResponse = await startAuthentication({ optionsJSON: options });
            const verifyRes = await axios.post(`${backendURL}/auth/verify-authentication`, { username, assertionResponse });
            setMessage(verifyRes.data.success ? '🎉 Logged in successfully!' : '❌ Login failed.');
            setLoading(false);
        } catch (err) {
            setMessage('❌ Error: ' + err.message);
            console.log(err);
        }
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>🔐 Passkey Demo (Vite + React)</h2>
            <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <div style={{ marginTop: '20px' }}>
                <button onClick={handleRegister}>Register with Passkey</button>
                <button onClick={handleLogin} style={{ marginLeft: '10px' }}>
                    Login with Passkey
                </button>
            </div>
            <p>{message}</p>
            {loading && <p>Loading...</p>}
        </div>
    );
}

export default PasskeyTest;
