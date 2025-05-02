import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as userService from '../services/user';
import { IUser, Role } from '../models/User';
import { AppError, BadRequestError } from '../utils/errors'; // Added BadRequestError

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

