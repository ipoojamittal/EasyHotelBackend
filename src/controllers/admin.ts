import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as userService from '../services/user';
import * as hotelService from '../services/hotel';
import { IUser, Role } from '../models/User';
import { AppError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

/**
 * Handles request for an admin to create a new HotelAdmin or Staff user.
 */
export const handleCreateAdminOrStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check for validation errors defined in the route
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const requestingUser = req.user as IUser;
        if (!requestingUser) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }

        const { firstName, lastName, email, phoneNumber, password, role, hotelId } = req.body;

        if (role !== Role.HotelAdmin && role !== Role.Staff) {
            throw new BadRequestError(`Invalid role specified in request body. Only '${Role.HotelAdmin}' or '${Role.Staff}' can be created here.`);
        }

        const creationData: userService.AdminOrStaffCreationData = {
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role: role as Role.HotelAdmin | Role.Staff, // Cast role after validation
            hotelId: hotelId // Pass hotelId if provided (service layer will validate if it's needed/allowed)
        };

        const newUserDocument = await userService.createAdminOrStaffUser(creationData);

        const sanitizedUser = userService.sanitizeUser(newUserDocument);

        res.status(201).json({
            message: `User with role '${role}' created successfully.`,
            user: sanitizedUser
        });

    } catch (error) {
        next(error);
    }
};

// --- SuperAdmin-only endpoints ---

/**
 * SuperAdmin: List all hotels system-wide (including deleted ones if requested).
 */
export const handleListAllHotels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const options: hotelService.ListHotelOptions = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
            isDeleted: req.query.isDeleted === 'true' ? true : (req.query.isDeleted === 'false' ? false : undefined),
            city: req.query.city as string | undefined,
            country: req.query.country as string | undefined,
            sortBy: req.query.sortBy as string | undefined,
            sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        };
        const result = await hotelService.listHotels(options);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * SuperAdmin: List all users system-wide.
 */
export const handleListAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const options: userService.ListUserOptions = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
            role: req.query.role as Role | undefined,
            hotelId: req.query.hotelId as string | undefined,
            isDeleted: req.query.isDeleted === 'true' ? true : (req.query.isDeleted === 'false' ? false : undefined),
            sortBy: req.query.sortBy as string | undefined,
            sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        };
        const result = await userService.listUsers(options);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * SuperAdmin: Suspend (soft-delete) a hotel by ID.
 */
export const handleSuspendHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const requestingUser = req.user as IUser;
        if (!requestingUser) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const hotelId = req.params.hotelId;
        // SuperAdmin can suspend any hotel — bypasses ownership check.
        await hotelService.suspendHotelBySuperAdmin(hotelId);
        res.status(200).json({ message: 'Hotel suspended successfully.' });
    } catch (error) {
        next(error);
    }
};

