// ---------- File: src/routes/room.routes.ts ----------

import express, { Router } from 'express';
import passport from 'passport';
import { body, query, param } from 'express-validator';
import * as roomController from '../controllers/room';
import { checkRole } from '../middleware/auth';
import { Role } from '../models/User';
import { RoomStatus } from '../models/Room';

const router: Router = express.Router({ mergeParams: true });

const validateHotelIdParam = param('hotelId').isMongoId().withMessage('Invalid Hotel ID format in URL.');
const validateRoomIdParam = param('roomId').isMongoId().withMessage('Invalid Room ID format in URL.');

const createRoomValidation = [
    body('roomNumber').trim().notEmpty().withMessage('Room number is required').isLength({ max: 20 }),
    body('roomTypeId').isMongoId().withMessage('Valid Room Type ID is required.'),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
    body('pricePerNight').optional().isFloat({ min: 0 }).withMessage('Price per night must be non-negative'),
    body('amenities').optional().isArray().withMessage('Amenities must be an array of strings'),
    body('amenities.*').optional().isString().trim().notEmpty(),
    body('images').optional().isArray().withMessage('Images must be an array of strings (URLs)'),
    body('images.*').optional().isURL().withMessage('Invalid image URL format'),
    body('viewTypeOverride').optional().trim().isLength({ max: 100 }),
    body('sizeOverride').optional().isObject().withMessage('Size override must be an object'),
    body('sizeOverride.value').optional().isFloat({ min: 0.1 }).withMessage('Size value must be positive'),
    body('sizeOverride.unit').optional().isIn(['sqm', 'sqft']).withMessage('Size unit must be "sqm" or "sqft"'),
    body('status').optional().isIn(Object.values(RoomStatus)).withMessage('Invalid room status'),
];

const updateRoomValidation = [
    body('roomTypeId').optional().isMongoId().withMessage('Valid Room Type ID is required if provided.'),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
    body('capacity').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Capacity must be positive'),
    body('pricePerNight').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('amenities').optional().isArray().withMessage('Amenities must be an array'),
    body('amenities.*').optional().isString().trim().notEmpty(),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('images.*').optional().isURL().withMessage('Invalid image URL'),
    body('viewTypeOverride').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('sizeOverride').optional().isObject().withMessage('Size override must be an object'),
    body('sizeOverride.value').optional().isFloat({ min: 0.1 }),
    body('sizeOverride.unit').optional().isIn(['sqm', 'sqft']),
    body('status').optional().isIn(Object.values(RoomStatus)).withMessage('Invalid room status'),
];

const listRoomsValidation = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('roomTypeId').optional().isMongoId().withMessage('Invalid Room Type ID format in query'),
    query('status').optional().isIn(Object.values(RoomStatus)),
    query('isDeleted').optional().isBoolean(),
    query('sortBy').optional().isString().trim(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
];

// --- Public routes (no auth — hotel detail page shows rooms to anonymous users) ---

/**
 * GET /api/hotels/:hotelId/rooms - List room instances for a hotel
 * Public: accessible without authentication so the hotel detail page
 * can show rooms to anonymous visitors.
 */
router.get('/',
    validateHotelIdParam,
    listRoomsValidation,
    roomController.handleListRooms
);

/**
 * GET /api/hotels/:hotelId/rooms/:roomId - Get details of a specific room instance
 * Public: accessible without authentication.
 */
router.get('/:roomId',
    validateHotelIdParam,
    validateRoomIdParam,
    roomController.handleGetRoomDetails
);

// --- Authenticated routes (JWT required) ---

router.use(passport.authenticate('jwt', { session: false }));

/**
 * POST /api/hotels/:hotelId/rooms - Create a new room instance
 * @route POST /api/hotels/{hotelId}/rooms
 * @group Rooms - Room instance management
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {RoomCreationData.model} room.body.required - Room details
 * @returns {object} 201 - Created room object (populated with RoomType)
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.post('/',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    createRoomValidation,
    roomController.handleCreateRoom
);

/**
 * PATCH /api/hotels/:hotelId/rooms/:roomId - Update a room instance
 * @route PATCH /api/hotels/{hotelId}/rooms/{roomId}
 * @group Rooms - Room instance management
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {string} roomId.path.required - ID of the room instance
 * @param {RoomUpdateData.model} room.body.required - Fields to update (partial)
 * @returns {object} 200 - Updated room object (populated)
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.patch('/:roomId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    validateRoomIdParam,
    updateRoomValidation,
    roomController.handleUpdateRoom
);

/**
 * DELETE /api/hotels/:hotelId/rooms/:roomId - Deactivate (soft delete) a room instance
 * @route DELETE /api/hotels/{hotelId}/rooms/{roomId}
 * @group Rooms - Room instance management
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {string} roomId.path.required - ID of the room instance
 * @returns {object} 200 - Success message indicating deactivation
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.delete('/:roomId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    validateRoomIdParam,
    roomController.handleDeleteRoom
);


export default router;
