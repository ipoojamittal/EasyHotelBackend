import express, { Router } from 'express';
import passport from 'passport';
import { body, param, query } from 'express-validator';
import * as bookingController from '../controllers/booking';
import { checkRole } from '../middleware/auth';
import { Role } from '../models/User';
import { BookingStatus } from '../models/Booking';

const router: Router = express.Router();

router.use(passport.authenticate('jwt', { session: false }));

// --- CUSTOMER-FACING ROUTES ---
router.post(
    '/',
    checkRole([Role.Customer]),
    [ /* Validation rules for creating a booking */
        body('hotelId').isMongoId(), body('roomId').isMongoId(), body('checkInDate').isISO8601().toDate(),
        body('checkOutDate').isISO8601().toDate(), body('numberOfGuests').isInt({ min: 1 })
    ],
    bookingController.handleCreateBooking
);
router.get('/my', bookingController.handleListMyBookings);

// --- STAFF BOOKING CREATION ---
router.post(
    '/hotel',
    checkRole([Role.HotelAdmin, Role.Staff]),
    [ /* Validation rules for staff creating a booking */
        body('customerId').isMongoId(), body('hotelId').isMongoId(), body('roomId').isMongoId(),
        body('checkInDate').isISO8601().toDate(), body('checkOutDate').isISO8601().toDate(), body('numberOfGuests').isInt({ min: 1 })
    ],
    bookingController.handleCreateBookingOnBehalf
);

// --- ADMIN & STAFF MANAGEMENT ROUTES ---
router.get(
    '/hotel/:hotelId', // Changed from /for-hotel/:hotelId
    checkRole([Role.HotelAdmin, Role.Staff]),
    param('hotelId').isMongoId(),
    bookingController.handleListHotelBookings
);

router.patch(
    '/:bookingId/status',
    checkRole([Role.HotelAdmin, Role.Staff]),
    param('bookingId').isMongoId(),
    body('status').isIn(Object.values(BookingStatus)),
    bookingController.handleUpdateBookingStatus
);

// Anyone logged in (customer, staff, admin) can attempt to cancel.
// The service layer will handle the specific permissions.
router.patch(
    '/:bookingId/cancel',
    checkRole([Role.HotelAdmin, Role.Staff]),
    param('bookingId').isMongoId(),
    bookingController.cancelBooking
  );

// --- NEW UPDATE AND CANCEL ROUTES ---
router.patch(
    '/:bookingId',
    checkRole([Role.HotelAdmin, Role.Staff]),
    param('bookingId').isMongoId(),
    [ // Add validation for updateable fields
        body('checkInDate').optional().isISO8601().toDate(),
        body('checkOutDate').optional().isISO8601().toDate(),
        body('numberOfGuests').optional().isInt({ min: 1 }),
    ],
    bookingController.handleUpdateBookingDetails
);

router.patch(
    '/:bookingId/cancel',
    checkRole([Role.Customer, Role.HotelAdmin, Role.Staff]), // Allow customer to cancel their own
    param('bookingId').isMongoId(),
    bookingController.handleCancelBooking
);

// --- SHARED ROUTE ---
router.get(
    '/:bookingId',
    checkRole([Role.Customer, Role.HotelAdmin, Role.Staff]), // Accessible by customer or relevant staff
    param('bookingId').isMongoId(),
    bookingController.handleGetBookingDetails
);

export default router;