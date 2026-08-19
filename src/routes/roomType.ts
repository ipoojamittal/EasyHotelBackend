import express, { Router } from 'express';
import passport from 'passport';
import { body, query, param } from 'express-validator';
import * as roomTypeController from '../controllers/roomType';
import { checkRole } from '../middleware/auth';
import { Role } from '../models/User';

const router: Router = express.Router({ mergeParams: true });

router.use(passport.authenticate('jwt', { session: false }));

const validateHotelIdParam = param('hotelId').isMongoId().withMessage('Invalid Hotel ID format in URL.');
const validateRoomTypeIdParam = param('roomTypeId').isMongoId().withMessage('Invalid Room Type ID format in URL.');

const createRoomTypeValidation = [
    body('name').trim().notEmpty().withMessage('Room type name is required').isLength({ max: 100 }),
    body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a non-negative number'),
    body('defaultCapacity').isInt({ min: 1 }).withMessage('Default capacity must be a positive integer'),
    body('typeCode').optional().trim().isLength({ max: 20 }).withMessage('Type code cannot exceed 20 characters').matches(/^[a-zA-Z0-9_.-]*$/).withMessage('Type code can only contain letters, numbers, underscore, dot, hyphen'),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('maxCapacity').optional().isInt({ min: 1 }).withMessage('Max capacity must be a positive integer'),
    body('amenities').optional().isArray().withMessage('Amenities must be an array of strings'),
    body('amenities.*').optional().isString().trim().notEmpty(),
    body('images').optional().isArray().withMessage('Images must be an array of strings (URLs)'),
    body('images.*').optional().isURL().withMessage('Invalid image URL format'),
    body('bedConfiguration').optional().trim().isLength({ max: 100 }),
    body('viewType').optional().trim().isLength({ max: 100 }),
    body('size').optional().isObject().withMessage('Size must be an object'),
    body('size.value').optional().isFloat({ min: 0.1 }).withMessage('Size value must be a positive number'),
    body('size.unit').optional().isIn(['sqm', 'sqft']).withMessage('Size unit must be "sqm" or "sqft"'),
    body('tags').optional().isArray().withMessage('Tags must be an array of strings'),
    body('tags.*').optional().isString().trim().notEmpty().isLength({ max: 50 }),
    body('sortOrder').optional().isInt().withMessage('Sort order must be an integer'),
];

const updateRoomTypeValidation = [
    body('name').optional().trim().notEmpty().withMessage('Room type name cannot be empty').isLength({ max: 100 }),
    body('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be a non-negative number'),
    body('defaultCapacity').optional().isInt({ min: 1 }).withMessage('Default capacity must be a positive integer'),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }), // Allow empty string to clear
    body('maxCapacity').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Max capacity must be a positive integer'),
    body('amenities').optional().isArray().withMessage('Amenities must be an array of strings'),
    body('amenities.*').optional().isString().trim().notEmpty(),
    body('images').optional().isArray().withMessage('Images must be an array of strings (URLs)'),
    body('images.*').optional().isURL().withMessage('Invalid image URL format'),
    body('bedConfiguration').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('viewType').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('size').optional().isObject().withMessage('Size must be an object'),
    body('size.value').optional().isFloat({ min: 0.1 }).withMessage('Size value must be a positive number'),
    body('size.unit').optional().isIn(['sqm', 'sqft']).withMessage('Size unit must be "sqm" or "sqft"'),
    body('tags').optional().isArray().withMessage('Tags must be an array of strings'),
    body('tags.*').optional().isString().trim().notEmpty().isLength({ max: 50 }),
    body('sortOrder').optional().isInt().withMessage('Sort order must be an integer'),
    body('isDeleted').optional().isBoolean().withMessage('isDeleted must be true or false'),
    // Generally, don't allow changing typeCode via PATCH easily
];

const listRoomTypesValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
    query('name').optional().isString().trim(),
    query('isDeleted').optional().isBoolean().withMessage('isDeleted must be true or false'),
    query('sortBy').optional().isString().trim().notEmpty(),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be "asc" or "desc"'),
];


// --- Routes ---

/**
 * POST /api/hotels/:hotelId/room-types - Create a new room type
 * @route POST /api/hotels/{hotelId}/room-types
 * @group RoomTypes - Room type management operations
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {RoomTypeCreationData.model} roomType.body.required - Room type details
 * @returns {object} 201 - Created room type object
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.post('/',
    checkRole([Role.HotelAdmin, Role.Staff]), // Authorization: Only Admins or Staff can create
    validateHotelIdParam,                    // Validate hotelId in URL
    createRoomTypeValidation,                // Validate request body
    roomTypeController.handleCreateRoomType  // Handle request
);

/**
 * GET /api/hotels/:hotelId/room-types - List room types for a hotel
 * @route GET /api/hotels/{hotelId}/room-types
 * @group RoomTypes - Room type management operations
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {integer} page.query - Page number
 * @param {integer} limit.query - Items per page
 * @param {string} name.query - Filter by name (case-insensitive contains)
 * @param {boolean} isDeleted.query - Filter by deleted status (defaults to false)
 * @param {string} sortBy.query - Field to sort by
 * @param {string} sortOrder.query - Sort order ('asc' or 'desc')
 * @returns {object} 200 - List of room types and pagination info
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.get('/',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    listRoomTypesValidation,
    roomTypeController.handleListRoomTypes
);

/**
 * GET /api/hotels/:hotelId/room-types/:roomTypeId - Get details of a specific room type
 * @route GET /api/hotels/{hotelId}/room-types/{roomTypeId}
 * @group RoomTypes - Room type management operations
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {string} roomTypeId.path.required - ID of the room type
 * @returns {IRoomType.model} 200 - The room type object
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.get('/:roomTypeId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    validateRoomTypeIdParam,
    roomTypeController.handleGetRoomTypeById
);

/**
 * PATCH /api/hotels/:hotelId/room-types/:roomTypeId - Update a room type
 * @route PATCH /api/hotels/{hotelId}/room-types/{roomTypeId}
 * @group RoomTypes - Room type management operations
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {string} roomTypeId.path.required - ID of the room type
 * @param {RoomTypeUpdateData.model} roomType.body.required - Fields to update (partial)
 * @returns {object} 200 - Updated room type object
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.patch('/:roomTypeId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    validateRoomTypeIdParam,
    updateRoomTypeValidation,
    roomTypeController.handleUpdateRoomType
);

/**
 * DELETE /api/hotels/:hotelId/room-types/:roomTypeId - Deactivate (soft delete) a room type
 * @route DELETE /api/hotels/{hotelId}/room-types/{roomTypeId}
 * @group RoomTypes - Room type management operations
 * @param {string} hotelId.path.required - ID of the hotel
 * @param {string} roomTypeId.path.required - ID of the room type
 * @returns {object} 200 - Success message indicating deactivation
 * @security JWT - Requires HotelAdmin or Staff role for the specified hotel
 */
router.delete('/:roomTypeId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    validateHotelIdParam,
    validateRoomTypeIdParam,
    roomTypeController.handleDeleteRoomType
);


export default router;
