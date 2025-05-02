import express, { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import * as authService from '../services/auth';
import { IUser, Role } from '../models/User';
import { AppError } from '../utils/errors';

const router: Router = express.Router();

router.post('/login',
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),
    body('password')
        .notEmpty().withMessage('Password is required'),
    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return
        }

        passport.authenticate('local', { session: false }, (err: any, user: IUser | false, info: any) => {
            if (err) {
                return next(err);

            }
            if (!user) {
                res.status(401).json({ message: info?.message || 'Incorrect email or password.' });
                return
            }

            try {
                const token = authService.generateAuthToken({
                    id: user.id,
                    role: user.role,
                    hotel: user.hotel
                });

                const decodedPayload = jwt.decode(token.split(' ')[1]) as authService.JwtPayload | null;

                if (!decodedPayload) {
                    throw new AppError("Failed to decode generated token.", 500);
                }

                const responseUser = authService.prepareLoginResponseUser(user, decodedPayload);

                res.status(200).json({
                    message: 'Login successful',
                    token: token,
                    user: responseUser
                });
            } catch (error) {
                next(error);
            }
        })(req, res, next);
    }
);

router.get('/status',
    passport.authenticate('jwt', { session: false }),
    (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new AppError('JWT authentication succeeded but user object is missing.', 500);
            }
            const user = req.user as IUser;

            const userData = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                ...( (user.role === Role.HotelAdmin || user.role === Role.Staff) && user.hotel && { hotelId: user.hotel.toString() } )
            };

            res.status(200).json({
                isAuthenticated: true,
                user: userData
            });
        } catch(error) {
            next(error);
        }
    }
);

router.post('/register',
    body('email')
        .trim()
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail(),
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return
        }

        try {
            const { password, email, phoneNumber, firstName, lastName } = req.body;

            const newUser = await authService.registerCustomer({
                firstName,
                lastName,
                email,
                phoneNumber,
                password,
            });

            res.status(201).json({
                message: 'User successfully registered as Customer',
                userId: newUser.id
            });

        } catch (error) {
            next(error);
        }
    }
);

export default router;
