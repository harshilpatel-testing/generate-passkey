import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth.js';

dotenv.config();
const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173', 
    credentials: true,
}));
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// ✅ async wrapper ensures DB connection before server starts
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected');

        app.get('/', (req, res) => {
            res.send('Welcome to the Passkey Authentication Server');
        });

        app.use('/auth', authRoutes);

        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

startServer();
