// src/server.ts
import './polyfills/slow-buffer'; // Must load first — polyfills SlowBuffer for Node 22+ (jsonwebtoken compat)
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import connectDB from './config/db'; // Import the DB connection function

// --- Import Routers ---

import authRouter from './routes/auth';
import userRouter from './routes/user';
import hotelRouter from './routes/hotel';
import adminRouter from './routes/admin';
import roomTypeRouter from './routes/roomType';
import roomRouter from './routes/room';
import bookingRouter from './routes/booking';


import './config/passport';
import globalErrorHandler from "./middleware/errorHandler";
import requestLogger from "./middleware/requestLogger";
dotenv.config();
// --- Connect to Database ---
connectDB();

const app: Express = express();

const PORT = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(helmet()); // Apply Helmet *early* for security headers on all responses.

const allowedOrigins = [
    process.env.CORS_ORIGIN_WEB,
].filter(Boolean) as string[];

// --- CORS Configuration ---
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        // Allow if the origin is in our list of allowed origins
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false); // Disallow
        }
        // Allow if the origin is permitted
        return callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Specify allowed HTTP methods
    credentials: true, // Allow cookies and authorization headers to be sent cross-origin
    optionsSuccessStatus: 200 // Set success status for OPTIONS pre-flight requests (for legacy browser compatibility)
}));

// --- Rate Limiting ---
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes (time window)
    limit: 100, // Limit each IP to 100 requests per `windowMs`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers (older standard)
    message: { message: 'Too many requests created from this IP, please try again after 5 minutes' }, // Custom message
});

app.use(limiter); //

// --- Standard Middleware ---
app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Passport Initialization ---
app.use(passport.initialize());


// --- Request Logging Middleware --- <<<< ADDED HERE
app.use(requestLogger);

// --- Health Check Endpoint ---
app.get('/health', (_req: Request, res: Response) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(dbStatus === 'connected' ? 200 : 503).json({
        status: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

// --- Routes ---
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running with JWT Auth and MongoDB!');
});

app.use('/api/auth', authRouter);

app.use('/api/users', userRouter)

app.use('/api/hotels', hotelRouter);

app.use('/api/admin', adminRouter);

app.use('/api/hotels/:hotelId/room-types', roomTypeRouter); // <<< Mount RoomType router

app.use('/api/hotels/:hotelId/rooms', roomRouter);

app.use('/api/bookings', bookingRouter);

// --- Error Handling Middleware ---

app.use(globalErrorHandler);

// --- Start Server ---
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received: closing HTTP server and DB connection...`);
    server.close(async () => {
        console.log('HTTP server closed.');
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error closing MongoDB connection:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;