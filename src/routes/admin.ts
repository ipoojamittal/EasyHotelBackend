// src/routes/admin.ts
import express, { Router } from 'express';
import passport from 'passport';
import { body, param, query } from 'express-validator';
import * as adminController from '../controllers/admin';
import { checkRole } from '../middleware/auth';
import { Role } from '../models/User';

const router: Router = express.Router();

// --- Middleware for ALL /api/admin routes ---
// Ensure user is authenticated via JWT for all admin routes
router.use(passport.authenticate('jwt', { session: false }));

/**
 * POST /api/admin - Create a new HotelAdmin or Staff user
 * Requires the requesting user to be a HotelAdmin.
 */
router.post('/',
    checkRole([Role.HotelAdmin]),
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 50 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 50 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required').isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').optional().isIn([Role.HotelAdmin, Role.Staff]).withMessage('Role must be hotelAdmin or staff'),
    adminController.handleCreateAdminOrStaff
);

// --- SuperAdmin-only routes ---

/**
 * GET /api/admin/hotels - List all hotels system-wide (SuperAdmin only)
 */
router.get('/hotels',
    checkRole([Role.SuperAdmin]),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('isDeleted').optional().isBoolean(),
    query('city').optional().isString().trim(),
    query('country').optional().isString().trim(),
    query('sortBy').optional().isString().trim(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    adminController.handleListAllHotels
);

/**
 * GET /api/admin/users - List all users system-wide (SuperAdmin only)
 */
router.get('/users',
    checkRole([Role.SuperAdmin]),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('role').optional().isIn(Object.values(Role)),
    query('hotelId').optional().isMongoId(),
    query('isDeleted').optional().isBoolean(),
    query('sortBy').optional().isString().trim(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    adminController.handleListAllUsers
);

/**
 * PATCH /api/admin/hotels/:hotelId/suspend - Suspend a hotel (SuperAdmin only)
 */
router.patch('/hotels/:hotelId/suspend',
    checkRole([Role.SuperAdmin]),
    param('hotelId').isMongoId().withMessage('Invalid Hotel ID format'),
    adminController.handleSuspendHotel
);

export default router;
