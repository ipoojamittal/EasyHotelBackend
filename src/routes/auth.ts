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
        interface JwtPayload {
            id: string;
            role: Role;
            hotelId?: string;
        }
        const payload: JwtPayload = {
            id: user.id,
            role: user.role,
        };

        if ((user.role === Role.HotelAdmin || user.role === Role.Staff) && user.hotel) {
            payload.hotelId = user.hotel.toString();
        }
        const token = jwt.sign(
            payload,
            jwtSecret,
            {
                expiresIn: jwtExpiresIn,
            }
        );

        res.status(200).json({
            message: 'Login successful',
            token: `Bearer ${token}`,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                hotelId: payload.hotelId
            }
        });
    }
);

router.get('/status',
    passport.authenticate('jwt', { session: false }),
    (req: Request, res: Response) => {
        const user = req.user as IUser;
        const userData: any = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        if ((user.role === Role.HotelAdmin || user.role === Role.Staff) && user.hotel) {
            userData.hotelId = user.hotel.toString();
        }
        res.status(200).json({
            isAuthenticated: true,
            user: userData
        });
    }
);

const validateRegistration = [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'), // Example: normalize email
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('role').trim().isIn(Object.values(Role)),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'), // Add specific phone validation if needed
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return
        }
        next();
    },
]
router.post('/register',
    validateRegistration,
    async (req: Request, res: Response, next: NextFunction) => {
        const { password, email, phoneNumber, firstName, lastName } = req.body;
        if (!password || !email || !phoneNumber || !firstName || !lastName) {
            res.status(400).json({ message: 'First name, last name, email, phone number, and password are required.' });
            return
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
                role: Role.Customer,
            });

             await newUser.save();
            res.status(201).json({
                message: 'User successfully registered as Customer',
                userId: newUser.id
            });

        } catch (error: any) {

            console.error('auth.ts/register Registration error:', error);

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
