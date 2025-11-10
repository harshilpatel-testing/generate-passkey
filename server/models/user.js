import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema({
    credentialID: String,
    publicKey: String,
    counter: Number,
});

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    credentials: [credentialSchema],
});

export default mongoose.model('User', userSchema);
