// models/Challenge.js
import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema({
    username: { type: String, required: true },
    challenge: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 }
});

export default mongoose.model('Challenge', challengeSchema);
