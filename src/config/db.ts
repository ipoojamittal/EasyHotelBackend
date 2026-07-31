import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); // Load .env variables

// Global schema defaults: expose `id` (string) instead of `_id` in JSON
// output, and drop `__v`. This aligns Mongoose documents with the
// frontend's TypeScript types which expect `id: string`.
mongoose.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        // `virtuals: true` already adds `id`; remove the raw `_id` and `__v`.
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

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