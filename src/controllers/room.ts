import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as roomService from '../services/room'; 
import { IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { RoomStatus } from '../models/Room';

/**
 * Extracts and validates pagination and filtering options from the request query for listing rooms.
 * @param req - Express Request object.
 * @returns Validated options for listing rooms.
 */
const getListOptions = (req: Request): roomService.ListRoomOptions => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const roomTypeId = req.query.roomTypeId as string | undefined;
    const status = req.query.status as RoomStatus | undefined;
    let isActive: boolean | undefined;
    if (req.query.isActive === 'true') isActive = true;
    if (req.query.isActive === 'false') isActive = false;

    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    // Basic validation
    const validStatus = status && Object.values(RoomStatus).includes(status) ? status : undefined;
    const validSortOrder = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : undefined;

    return {
        page: Math.max(1, page),
        limit: Math.max(1, limit),
        roomTypeId: roomTypeId,
        status: validStatus,
        isActive,
        sortBy,
        sortOrder: validSortOrder,
    };
};

/**
 * Handles request to create a new room instance within a specific hotel.
 * Requires HotelAdmin or Staff role for the hotel.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction for error handling.
 */
export const handleCreateRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        const roomData: roomService.RoomCreationData = req.body;

        const newRoom = await roomService.createRoom(hotelId, roomData, user);

        res.status(201).json({
            message: 'Room created successfully.',
            room: newRoom // Service returns populated room
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to get details of a specific room instance.
 * Publicly accessible if the room and hotel are active.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction for error handling.
 */
export const handleGetRoomDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { hotelId, roomId } = req.params;
        // Pass optional user if needed for permission checks in the future
        const user = req.user as IUser | undefined;

        const room = await roomService.getRoomDetails(hotelId, roomId, user);
        res.status(200).json(room); // Service returns populated room
    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to update an existing room instance.
 * Requires HotelAdmin or Staff role for the hotel.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction for error handling.
 */
export const handleUpdateRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) {
            throw new AppError('Authentication error: User data missing.', 500);
        }

        const { hotelId, roomId } = req.params;
        const updateData: roomService.RoomUpdateData = req.body;

        const updatedRoom = await roomService.updateRoom(hotelId, roomId, updateData, user);

        res.status(200).json({
            message: 'Room updated successfully.',
            room: updatedRoom // Service returns populated room
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to list room instances within a hotel with filtering and pagination.
 * Can be adapted for public or management views based on authorization and filtering.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction for error handling.
 */
export const handleListRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const hotelId = req.params.hotelId;
        const options = getListOptions(req);
        const user = req.user as IUser | undefined;

        const result = await roomService.listRooms(hotelId, options, user);

        res.status(200).json(result); // Service returns list and pagination info

    } catch (error) {
        next(error);
    }
};

/**
 * Handles request to deactivate (soft delete) a specific room instance.
 * Requires HotelAdmin or Staff role for the hotel.
 * @param req - Express Request object.
 * @param res - Express Response object.
 * @param next - Express NextFunction for error handling.
 */
export const handleDeleteRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const user = req.user as IUser;
        if (!user) {
            throw new AppError('Authentication error: User data missing.', 500);
        }

        const { hotelId, roomId } = req.params;

        await roomService.softDeleteRoom(hotelId, roomId, user);

        res.status(200).json({ message: 'Room deactivated successfully.' });

    } catch (error) {
        next(error);
    }
};

