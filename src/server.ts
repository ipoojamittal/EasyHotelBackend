// src/server.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db'; // Import the DB connection function
// --- Import Routers ---
import authRouter from './routes/auth';
import userRouter from './routes/user';
import './config/passport';
import globalErrorHandler from "./middleware/errorHandler";
dotenv.config();
// --- Connect to Database ---
connectDB();

const app: Express = express();

const PORT = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(helmet()); // Apply Helmet *early* for security headers on all responses.

const allowedOrigins = [
    process.env.CORS_ORIGIN_WEB,
]

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
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// --- Passport Initialization ---
app.use(passport.initialize());

// --- Routes ---
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running with JWT Auth and MongoDB!');
});

app.use('/api/auth', authRouter);

app.use('/api/users', userRouter)

// --- Error Handling Middleware ---

app.use(globalErrorHandler);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;