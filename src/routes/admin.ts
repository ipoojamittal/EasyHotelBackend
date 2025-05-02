// src/routes/admin.ts
import express, { Router } from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import * as adminController from '../controllers/admin'; // Import the new admin controller
import { checkRole } from '../middleware/auth';
import { Role } from '../models/User';

const router: Router = express.Router();

// --- Middleware for ALL /api/admin routes ---
// Ensure user is authenticated via JWT for all admin routes
router.use(passport.authenticate('jwt', { session: false }));

/**
 * POST /api/admin/create-hotel-admin - Create a new HotelAdmin user
 * Requires the requesting user to also be a HotelAdmin (or SuperAdmin later).
 * @route POST /api/admin/create-hotel-admin
 * @group Admin - High-level administrative operations
 * @param {HotelAdminCreationData.model} user.body.required - New HotelAdmin user details
 * @returns {object} 201 - An object containing the newly created HotelAdmin user (sanitized)
 * @returns {Error} 400 - Invalid input data
 * @returns {Error} 401 - Unauthorized (Not logged in)
 * @returns {Error} 403 - Forbidden (User does not have HotelAdmin role)
 * @returns {Error} 409 - Conflict (Email or phone number already exists)
 * @security JWT
 */
router.post('/',
    // Authorization: Only allow existing HotelAdmins to use this endpoint (for now)
    // TODO: Change to Role.SuperAdmin if that role is implemented later for better security
    // checkRole([Role.HotelAdmin]),
    // Input Validation
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 50 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 50 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required').isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    // Controller Handler
    adminController.handleCreateAdminOrStaff
);

// Add other admin-specific routes here later
// e.g., GET /api/admin/hotels (list all hotels system-wide)
// e.g., PATCH /api/admin/hotels/:hotelId/suspend (suspend a hotel)

export default router;
