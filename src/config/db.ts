import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); // Load .env variables

const connectDB = async () => {
    try {
        const mongoURI = process.env.DATABASE_URL;
        if (!mongoURI) {
            console.error('db.ts/connectDB(): DATABASE_URL is not defined in .env file');
            process.exit(1); // Exit process with failure
        }
        mongoose.connection.on('connected', () => {
            console.log('db.ts/connectDB(): MongoDB connected.');
        });
        mongoose.connection.on('error', (err) => {
            console.error(`db.ts/connectDB(): MongoDB connection error: ${err}`);
            process.exit(1);
        })
        mongoose.connection.on('disconnected', () => {
            console.log('db.ts/connectDB(): MongoDB disconnected.');
        });
        await mongoose.connect(mongoURI);

    }
    catch (error) {
        console.error(`db.ts/connectDB(): MongoDB connection error: ${error}`);
        process.exit(1);
    }
}

export default connectDB;