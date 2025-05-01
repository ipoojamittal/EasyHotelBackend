import express, { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt, {Secret} from 'jsonwebtoken';
import dotenv from 'dotenv';
import User, {IUser, Role} from '../models/User';
import { body, validationResult } from 'express-validator';
// import { Error } from 'mongoose';
dotenv.config();
const router: Router = express.Router();
const jwtSecret: Secret = process.env.JWT_SECRET || 'default_secret_key';
const jwtExpiresIn : number = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10); // Default to 1 hour (3600 seconds) if not set;

if (process.env.NODE_ENV !== 'production' && jwtSecret === 'default_secret_key') {
    console.warn('⚠️ WARNING: Using default JWT secret. Set JWT_SECRET in production!');
}

const validateLogin = [
    body('email').isString().notEmpty().withMessage('email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return
        }
        next();
    },
];


router.post('/login',
    validateLogin,
    passport.authenticate('local', { session: false }),
    (req: Request, res: Response) => {
        const user = req.user as IUser;
        const payload : object = {
            id: user.id, // Use the user's unique MongoDB document ID (_id).
        };
        const token = jwt.sign(
            payload,
            jwtSecret,
            {
                expiresIn: jwtExpiresIn,
            }
        );

        console.log(`auth.js/login : Login successful, token generated for user: ${user.email}`);

        res.status(200).json({
            message: 'Login successful',
            token: `Bearer ${token}`,
            user: {
                id: user.id,
                email: user.email,
            }
        });
    }
);

router.get('/status',
    passport.authenticate('jwt', { session: false }),
    (req: Request, res: Response) => {
        const user = req.user as IUser;
        res.status(200).json({
            isAuthenticated: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                id: user.id,
                email: user.email,
                phoneNumber: user.phoneNumber, // Included based on your schema
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                // identityUrls: user.identityUrls // Decrypted value is sent
                // Add other fields as needed
            }
        });
    }
);

router.post('/register',
    body('email').trim().isEmail().normalizeEmail(), // Example: normalize email
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').trim().isIn(Object.values(Role)), // Example: restrict to specific roles
    body('phoneNumber').trim().notEmpty(), // Add specific phone validation if needed
    body('password').isLength({ min: 8 }),
    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return
        }
        next();
    },
    async (req: Request, res: Response, next: NextFunction) => {
        const { password, email, phoneNumber, firstName, lastName, role } = req.body;

        if (!password || !email || !phoneNumber || !firstName || !lastName || !role) {
            res.status(400).json({ message: 'Password, email, and phone number are required.' });
        }

        try {

            const existingEmail = await User.findOne({ email: email.toLowerCase() });
            if (existingEmail) {
                res.status(409).json({ message: 'An account with that email address already exists.' });
                return
            }

            const existingPhone = await User.findOne({ phoneNumber: phoneNumber }); // Add .trim() if not handled by validator/schema effectively
            if (existingPhone) {
                res.status(409).json({ message: 'An account with that phone number already exists.' });
                return
            }


            const newUser = new User({
                firstName: firstName,
                lastName: lastName,
                email: email, // Email provided
                phoneNumber: phoneNumber, // Phone provided
                passwordHash: password,
                role: role,
            });

             await newUser.save();
            res.status(201).json({
                message: 'User successfully registered',
                userId: newUser.id
            });

        } catch (error: any) {

            console.error('auth.js/register Registration error:', error);

            if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) { // Check code and potentially name for robustness
                const field = error.message.includes('email') ? 'email' : error.message.includes('phoneNumber') ? 'phone number' : 'field';
                res.status(409).json({ message: `An account with that ${field} already exists.` });
                return
            }

            if (error.name === 'ValidationError') {
                res.status(400).json({ message: 'Validation failed.', errors: error.errors });
                return
            }
            next(error);
        }
    }
);

export default router;