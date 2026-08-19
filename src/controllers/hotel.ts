import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as hotelService from '../services/hotel';
import { IUser, Role } from '../models/User'; // Assuming IUser is the interface for your User model
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors'; // Import necessary errors

/**
 * Extracts and validates pagination and filtering options from the request query.
 * @param req - Express Request object.
 * @returns Validated options for listing hotels.
 */
const getListOptions = (req: Request): hotelService.ListHotelOptions => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const city = req.query.city as string | undefined;
    const country = req.query.country as string | undefined;
    let isDeleted: boolean | undefined;
    if (req.query.isDeleted === 'true') isDeleted = true;
    if (req.query.isDeleted === 'false') isDeleted = false;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    // Basic validation for sortOrder
    const validSortOrder = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : undefined;

    return {
        page: Math.max(1, page), // Ensure page is at least 1
        limit: Math.max(1, limit), // Ensure limit is at least 1
        city,
        country,
        isDeleted,
        sortBy,
        sortOrder: validSortOrder,
    };
};


/**
 * Handles request to create a new hotel. Requires HotelAdmin role.
 */
export const handleCreateHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
   const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return; // Stop execution
    }

    try {
        const user = req.user as IUser;
        if (!user || !user.id) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }

        const hotelData: hotelService.HotelCreationData = req.body;
        const newHotel = await hotelService.createHotel(hotelData, user.id);
        res.status(201).json({
            message: 'Hotel created successfully.',
            hotel: newHotel // Consider sanitizing if the model contains sensitive fields not meant for direct exposure
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request for a HotelAdmin to get their associated hotel details.
 */
export const handleGetMyHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user || !user.id) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const hotel = await hotelService.findHotelByAdmin(user.id);

        res.status(200).json(hotel);

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request for a HotelAdmin to update their associated hotel details.
 */
export const handleUpdateMyHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user || !user.id) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const existingHotel = await hotelService.findHotelByAdmin(user.id);

        const updateData: hotelService.HotelUpdateData = req.body;

        const updatedHotel = await hotelService.updateHotel(existingHotel.id, updateData, user.id);

        res.status(200).json({
            message: 'Hotel updated successfully.',
            hotel: updatedHotel
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to get public details of a specific hotel by ID.
 */
export const handleGetHotelDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const hotelId = req.params.hotelId;
        const hotel = await hotelService.getHotelDetails(hotelId); // Service handles ID validation and Not Found
        res.status(200).json(hotel);

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to list hotels with filtering and pagination. Suitable for public browsing.
 */
export const handleListHotels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const options = getListOptions(req);

        const result = await hotelService.listHotels(options);

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
};


/**
 * Handles request for a HotelAdmin to soft-delete (deactivate) their associated hotel.
 */
export const handleDeleteMyHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as IUser;
        if (!user || !user.id) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }

        const existingHotel = await hotelService.findHotelByAdmin(user.id);
        // Note: findHotelByAdmin throws NotFoundError if no active hotel is found.

        await hotelService.softDeleteHotel(existingHotel.id, user.id);

        res.status(200).json({ message: 'Hotel deactivated successfully.' });

    } catch (error) {
        next(error);
    }
};
