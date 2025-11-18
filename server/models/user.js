import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema({
    credentialID: String,
    publicKey: String,
    counter: Number,
    // transports: Array
});

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    credentials: [credentialSchema],
    challenge: String
});

export default mongoose.model('User', userSchema);
