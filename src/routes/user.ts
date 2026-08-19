// src/routes/user.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { body, validationResult } from 'express-validator';
import * as userController from '../controllers/user'; // Import controller functions
import { checkRole } from '../middleware/auth'; // Import role checking middleware
import { Role } from '../models/User'; // Import Role enum

const router: Router = express.Router();

// --- Middleware for all /users routes ---
router.use(passport.authenticate('jwt', { session: false }));

// --- Routes for Self-Management --- (/api/users/me/...)

/**
 * GET /api/users/me - Get current user's profile.
 */
router.get('/me', userController.handleGetMyProfile);

/**
 * PATCH /api/users/me - Update current user's profile.
 */
router.patch('/me',
    body('firstName').optional({ checkFalsy: true }).trim().notEmpty().withMessage('First name cannot be empty').isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
    body('lastName').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Last name cannot be empty').isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
    // Pass the controller function directly
    userController.handleUpdateMyProfile
);

/**
 * PUT /api/users/me/password - Change current user's password.
 */
router.put('/me/password',
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
    userController.handleChangeMyPassword
);

// --- Routes for Admin User Management --- (/api/users/...)

/**
 * GET /api/users - List users (Admin).
 */
router.get('/',
    checkRole([Role.HotelAdmin]),
    userController.handleAdminListUsers
);

/**
 * POST /api/users - Create a new user (Admin).
 */
router.post('/',
    checkRole([Role.HotelAdmin]),
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
    body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required').isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').isIn(Object.values(Role)).withMessage('Invalid user role specified'),
    userController.handleAdminCreateUser
);

/**
 * GET /api/users/:userId - Get specific user details (Admin).
 */
router.get('/:userId',
    checkRole([Role.HotelAdmin]),
    userController.handleAdminGetUser
);

/**
 * PATCH /api/users/:userId - Update specific user details (Admin).
 */
router.patch('/:userId',
    checkRole([Role.HotelAdmin]),
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty').isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty').isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
    body('role').optional().isIn(Object.values(Role)).withMessage('Invalid user role specified'),
    body('isDeleted').optional().isBoolean().withMessage("'isDeleted' must be true or false"),
    userController.handleAdminUpdateUser
);

/**
 * DELETE /api/users/:userId - Soft-delete specific user (Admin).
 */
router.delete('/:userId',
    checkRole([Role.HotelAdmin]),
    userController.handleAdminDeleteUser
);


export default router;
