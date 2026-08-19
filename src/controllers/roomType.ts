import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as roomTypeService from '../services/roomType';
import { IUser } from '../models/User';
import { AppError } from '../utils/errors';

/**
 * Extracts and validates pagination and filtering options from the request query for listing room types.
 * @param req - Express Request object.
 * @returns Validated options for listing room types.
 */
const getListOptions = (req: Request): roomTypeService.ListRoomTypeOptions => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const name = req.query.name as string | undefined; // Filter by name containing text
    let isDeleted: boolean | undefined;
    if (req.query.isDeleted === 'true') isDeleted = true;
    if (req.query.isDeleted === 'false') isDeleted = false;

    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    const validSortOrder = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : undefined;

    return {
        page: Math.max(1, page),
        limit: Math.max(1, limit),
        name,
        isDeleted,
        sortBy,
        sortOrder: validSortOrder,
    };
};


/**
 * Handles request to create a new room type within a specific hotel.
 * Requires HotelAdmin or Staff role for that hotel.
 */
export const handleCreateRoomType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) {
            throw new AppError('Authentication error: User data missing after authentication.', 500);
        }

        const hotelId = req.params.hotelId;
        const roomTypeData: roomTypeService.RoomTypeCreationData = req.body;
        const newRoomType = await roomTypeService.createRoomType(hotelId, roomTypeData, user);
        res.status(201).json({
            message: 'Room type created successfully.',
            roomType: newRoomType
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to get details of a specific room type by ID.
 * Requires appropriate permissions for the hotel.
 */
export const handleGetRoomTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) throw new AppError('Authentication error: User data missing.', 500);

        const { hotelId, roomTypeId } = req.params;
        const roomType = await roomTypeService.getRoomTypeById(hotelId, roomTypeId, user);

        res.status(200).json(roomType);

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to update an existing room type.
 * Requires HotelAdmin or Staff role for that hotel.
 */
export const handleUpdateRoomType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) throw new AppError('Authentication error: User data missing.', 500);

        const { hotelId, roomTypeId } = req.params;
        const updateData: roomTypeService.RoomTypeUpdateData = req.body;

        const updatedRoomType = await roomTypeService.updateRoomType(hotelId, roomTypeId, updateData, user);

        res.status(200).json({
            message: 'Room type updated successfully.',
            roomType: updatedRoomType
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to list room types within a hotel with filtering and pagination.
 * Requires appropriate permissions for the hotel.
 */
export const handleListRoomTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) throw new AppError('Authentication error: User data missing.', 500);

        const hotelId = req.params.hotelId;
        const options = getListOptions(req); // Use the helper function

        const result = await roomTypeService.listRoomTypes(hotelId, options, user);

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to deactivate (soft delete) a room type.
 * Requires HotelAdmin or Staff role for that hotel.
 */
export const handleDeleteRoomType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) throw new AppError('Authentication error: User data missing.', 500);

        const { hotelId, roomTypeId } = req.params;
        await roomTypeService.deleteRoomType(hotelId, roomTypeId, user);

        res.status(200).json({ message: 'Room type deactivated successfully.' });

    } catch (error) {
        next(error);
    }
};
