// src/routes/hotel.ts
import express, { Router } from 'express';
import passport from 'passport';
import { body, query, param } from 'express-validator';
import * as hotelController from '../controllers/hotel';
import { checkRole } from '../middleware/auth'; // Import role checking middleware
import { Role } from '../models/User'; // Import Role enum

const router: Router = express.Router();

// --- Public Routes (no auth required — landing page, browse) ---

/**
 * GET /api/hotels - List hotels with filtering and pagination
 * Public: accessible without authentication so the landing page and
 * browse page can show hotels to anonymous visitors.
 */
router.get('/',
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
    query('city').optional().isString().trim(),
    query('country').optional().isString().trim(),
    query('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    query('sortBy').optional().isString().trim().notEmpty(),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be "asc" or "desc"'),
    hotelController.handleListHotels
);

/**
 * GET /api/hotels/{hotelId} - Get public details of a specific hotel
 * Public: accessible without authentication.
 */
router.get('/:hotelId',
    param('hotelId').isMongoId().withMessage('Invalid Hotel ID format'),
    hotelController.handleGetHotelDetails
);

// --- Authenticated routes (JWT required) ---

router.use(passport.authenticate('jwt', { session: false }));

// --- Routes for Hotel Admins Managing Their OWN Hotel ---

/**
 * POST /api/hotels - Create a new hotel (HotelAdmin only)
 * @route POST /api/hotels
 * @group Hotels - Operations about hotels
 * @param {HotelCreationData.model} hotel.body.required - Hotel creation information
 * @returns {object} 201 - An object containing the newly created hotel
 * @returns {Error} 400 - Invalid input data
 * @returns {Error} 401 - Unauthorized (Not logged in)
 * @returns {Error} 403 - Forbidden (User is not a HotelAdmin)
 * @security JWT
 */
router.post('/',
    checkRole([Role.HotelAdmin]),
    body('name').trim().notEmpty().withMessage('Hotel name is required').isLength({ max: 100 }).withMessage('Hotel name cannot exceed 100 characters'),
    body('address').isObject().withMessage('Address must be an object'),
    body('address.street').trim().notEmpty().withMessage('Street is required'),
    body('address.city').trim().notEmpty().withMessage('City is required'),
    body('address.state').trim().notEmpty().withMessage('State is required'),
    body('address.zipCode').trim().notEmpty().withMessage('Zip code is required').isPostalCode('any').withMessage('Invalid zip code format'),
    body('address.country').trim().notEmpty().withMessage('Country is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('phoneNumber').optional({ checkFalsy: true }).isArray().withMessage('Phone number must be an array of strings'),
    body('phoneNumber.*').optional({ checkFalsy: true }).isString().trim().isLength({ min: 7, max: 20 }).withMessage('Invalid phone number format in array'), // Validate each string in the array
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    body('amenities').optional({ checkFalsy: true }).isArray().withMessage('Amenities must be an array of strings'),
    body('amenities.*').optional({ checkFalsy: true }).isString().trim().notEmpty().withMessage('Amenities in array cannot be empty'),
    body('images').optional({ checkFalsy: true }).isArray().withMessage('Images must be an array of strings (URLs)'),
    body('images.*').optional({ checkFalsy: true }).isURL().withMessage('Invalid image URL in array'),

    hotelController.handleCreateHotel
);

/**
 * GET /api/hotels/my-hotel - Get the hotel associated with the logged-in HotelAdmin
 * @route GET /api/hotels/my-hotel
 * @group Hotels - Operations about hotels
 * @returns {IHotel.model} 200 - The hotel object associated with the admin
 * @returns {Error} 401 - Unauthorized
 * @returns {Error} 403 - Forbidden (User is not a HotelAdmin)
 * @returns {Error} 404 - Not Found (Admin doesn't have an active hotel)
 * @security JWT
 */
router.get('/my-hotel',
    checkRole([Role.HotelAdmin]),
    hotelController.handleGetMyHotel
);

/**
 * PATCH /api/hotels/my-hotel - Update the hotel associated with the logged-in HotelAdmin
 * @route PATCH /api/hotels/my-hotel
 * @group Hotels - Operations about hotels
 * @param {HotelUpdateData.model} hotel.body.required - Hotel update information (partial)
 * @returns {object} 200 - An object containing the updated hotel
 * @returns {Error} 400 - Invalid input data
 * @returns {Error} 401 - Unauthorized
 * @returns {Error} 403 - Forbidden (User is not a HotelAdmin or doesn't own the hotel)
 * @returns {Error} 404 - Not Found (Admin doesn't have an active hotel)
 * @security JWT
 */
router.patch('/my-hotel',
    checkRole([Role.HotelAdmin]),
    body('name').optional().trim().notEmpty().withMessage('Hotel name cannot be empty').isLength({ max: 100 }).withMessage('Hotel name cannot exceed 100 characters'),
    body('address').optional().isObject().withMessage('Address must be an object'),
    body('address.street').optional().trim().notEmpty().withMessage('Street cannot be empty'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('phoneNumber').optional({ checkFalsy: true }).isArray().withMessage('Phone number must be an array of strings'),
    body('phoneNumber.*').optional({ checkFalsy: true }).isString().trim().isLength({ min: 7, max: 20 }).withMessage('Invalid phone number format in array'),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    body('amenities').optional({ checkFalsy: true }).isArray().withMessage('Amenities must be an array of strings'),
    body('amenities.*').optional({ checkFalsy: true }).isString().trim().notEmpty().withMessage('Amenities in array cannot be empty'),
    body('images').optional({ checkFalsy: true }).isArray().withMessage('Images must be an array of strings (URLs)'),
    body('images.*').optional({ checkFalsy: true }).isURL().withMessage('Invalid image URL in array'),

    hotelController.handleUpdateMyHotel
);

/**
 * DELETE /api/hotels/my-hotel - Deactivate the hotel associated with the logged-in HotelAdmin
 * @route DELETE /api/hotels/my-hotel
 * @group Hotels - Operations about hotels
 * @returns {object} 200 - Success message
 * @returns {Error} 401 - Unauthorized
 * @returns {Error} 403 - Forbidden (User is not a HotelAdmin or doesn't own the hotel)
 * @returns {Error} 404 - Not Found (Admin doesn't have an active hotel)
 * @security JWT
 */
router.delete('/my-hotel',
    checkRole([Role.HotelAdmin]),
    hotelController.handleDeleteMyHotel
);


export default router;
