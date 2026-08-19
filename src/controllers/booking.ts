import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as bookingService from '../services/booking';
import { IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { IUserPayload } from '../services/booking';
import { BookingStatus } from '../models/Booking';

export const handleCreateBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({errors: errors.array()});
        return;
    }
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const userPayload: IUserPayload = {
            id: user.id,
            role: user.role,
            hotel: user.hotel ? user.hotel.toString() : undefined
        };
        const newBooking = await bookingService.createBooking(req.body, userPayload);
        res.status(201).json({message: 'Booking created successfully.', booking: newBooking});
    } catch (error) {
        next(error);
    }
};
export const handleGetBookingDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const userPayload: IUserPayload = {
            id: user.id,
            role: user.role,
            hotel: user.hotel ? user.hotel.toString() : undefined
        };
        const booking = await bookingService.getBookingDetails(req.params.bookingId, userPayload);
        res.status(200).json(booking);
    } catch (error) {
        next(error);
    }
};
export const handleListMyBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const options = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 10,
            status: req.query.status as any
        };
        const result = await bookingService.listUserBookings(user.id, options);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
export const handleCreateBookingOnBehalf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({errors: errors.array()});
        return;
    }
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const userPayload: IUserPayload = {
            id: user.id,
            role: user.role,
            hotel: user.hotel ? user.hotel.toString() : undefined
        };
        const newBooking = await bookingService.createBookingOnBehalf(req.body, userPayload);
        res.status(201).json({message: 'Booking created on behalf of customer successfully.', booking: newBooking});
    } catch (error) {
        next(error);
    }
};
export const handleListHotelBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const userPayload: IUserPayload = {
            id: user.id,
            role: user.role,
            hotel: user.hotel ? user.hotel.toString() : undefined
        };
        const options = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 10,
            status: req.query.status as any
        };
        const result = await bookingService.listHotelBookings(req.params.hotelId, userPayload, options);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
export const handleUpdateBookingStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({errors: errors.array()});
        return;
    }
    try {
        const user = req.user as IUser;
        if (!user) {
            return next(new AppError('Authentication error: User data missing.', 500));
        }
        const userPayload: IUserPayload = {
            id: user.id,
            role: user.role,
            hotel: user.hotel ? user.hotel.toString() : undefined
        };
        const {bookingId} = req.params;
        const {status} = req.body;
        const updatedBooking = await bookingService.updateBookingStatus(bookingId, status, userPayload);
        res.status(200).json({message: 'Booking status updated successfully.', booking: updatedBooking});
    } catch (error) {
        next(error);
    }
};

// --- NEW CONTROLLERS START HERE ---

export const handleUpdateBookingDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const user = req.user as IUser;
        if (!user) {
            next(new AppError('Authentication error: User data missing.', 500));
            return;
        }
        const userPayload: IUserPayload = { id: user.id, role: user.role, hotel: user.hotel ? user.hotel.toString() : undefined };
        const updatedBooking = await bookingService.updateBookingDetails(req.params.bookingId, req.body, userPayload);
        res.status(200).json({ message: 'Booking details updated successfully.', booking: updatedBooking });
    } catch (error) {
        next(error);
    }
};

export const handleCancelBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user) {
            next(new AppError('Authentication error: User data missing.', 500));
            return;
        }
        const userPayload: IUserPayload = { id: user.id, role: user.role, hotel: user.hotel ? user.hotel.toString() : undefined };
        const cancelledBooking = await bookingService.cancelBooking(req.params.bookingId, userPayload);
        res.status(200).json({ message: 'Booking cancelled successfully.', booking: cancelledBooking });
    } catch (error) {
        next(error);
    }
};