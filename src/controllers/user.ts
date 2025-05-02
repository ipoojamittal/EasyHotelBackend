// src/controllers/user.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user';
import { IUser, Role } from '../models/User';
import { AppError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors';
import { validationResult } from 'express-validator';

const getListOptions = (req: Request): userService.ListUserOptions => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as Role | undefined;
    const hotelId = req.query.hotelId as string | undefined;
    let isActive: boolean | undefined;
    if (req.query.isActive === 'true') isActive = true;
    if (req.query.isActive === 'false') isActive = false;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    if (role && !Object.values(Role).includes(role)) {
        console.warn(`Invalid role provided in query parameter: ${role}`);
    }

    return {
        page: Math.max(1, page),
        limit: Math.max(1, limit),
        role,
        hotelId,
        isActive,
        sortBy,
        sortOrder,
    };
};

/**
 * Handles request to get the current user's profile.
 */
export const handleGetMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    try {
        if (!req.user) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const userId = (req.user as IUser).id;
        const userDocument = await userService.findUserById(userId);
        const sanitizedUser = userService.sanitizeUser(userDocument);
        res.status(200).json(sanitizedUser); // Send response

    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request to update the current user's profile.
 */
export const handleUpdateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() }); // Send error response
        return; // Stop execution
    }

    try {
        if (!req.user) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const userId = (req.user as IUser).id;
        const updateData: userService.UserUpdateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
        };
        const updatedUserDocument = await userService.updateUserProfile(userId, updateData);
        const sanitizedUser = userService.sanitizeUser(updatedUserDocument);

        res.status(200).json({ // Send success response
            message: 'Profile updated successfully.',
            user: sanitizedUser
        });
    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request to change the current user's password.
 */
export const handleChangeMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() }); // Send error response
        return; // Stop execution
    }

    try {
        if (!req.user) {
            throw new AppError('Authentication succeeded but user data is unavailable.', 500);
        }
        const userId = (req.user as IUser).id;
        const { currentPassword, newPassword } = req.body;
        await userService.changeUserPassword(userId, { currentPassword, newPassword });
        res.status(200).json({ message: 'Password changed successfully.' }); // Send success response
    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request for an admin to list users (with filtering/pagination).
 */
export const handleAdminListUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    try {
        const options = getListOptions(req);
        const requestingUser = req.user as IUser;

        if (requestingUser.role === Role.HotelAdmin || requestingUser.role === Role.Staff) {
            if (!requestingUser.hotel) {
                throw new AppError("User performing action is associated with no hotel.", 500);
            }
            options.hotelId = requestingUser.hotel.toString();
        }

        const result = await userService.listUsers(options);
        res.status(200).json(result); // Send success response
    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request for an admin to get a specific user's details.
 */
export const handleAdminGetUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    try {
        const targetUserId = req.params.userId;
        const targetUserDocument = await userService.findUserById(targetUserId);
        const requestingUser = req.user as IUser;

        if ((requestingUser.role === Role.HotelAdmin || requestingUser.role === Role.Staff) ) {
            if (!requestingUser.hotel || !targetUserDocument.hotel) {
                console.error(`Authorization check failed: Requesting user (${requestingUser.id}) or target user (${targetUserDocument.id}) is missing hotel association.`);
                throw new ForbiddenError('Cannot access user data due to missing hotel association.');
            }
            if (requestingUser.hotel.toString() !== targetUserDocument.hotel.toString()) {
                throw new ForbiddenError('Access denied: You can only view users within your own hotel.');
            }
        }

        const sanitizedUser = userService.sanitizeUser(targetUserDocument);
        res.status(200).json(sanitizedUser); // Send success response

    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request for an admin to create a new user (e.g., Staff).
 */
export const handleAdminCreateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() }); // Send error response
        return; // Stop execution
    }

    try {
        const requestingAdmin = req.user as IUser;
        const { firstName, lastName, email, phoneNumber, password, role } = req.body;

        if (requestingAdmin.role !== Role.HotelAdmin) {
            throw new ForbiddenError('You do not have permission to create new users.');
        }
        if (!requestingAdmin.hotel) {
            throw new AppError('Creating admin is not associated with a hotel.', 500);
        }
        if (role === Role.HotelAdmin) {
            throw new ForbiddenError('Hotel Admins cannot create other Hotel Admins.');
        }
        if (role === Role.Customer) {
            throw new ForbiddenError('Cannot create Customer role via admin endpoint. Use registration.');
        }

        const creationData: userService.UserCreationData = {
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role,
            hotelId: requestingAdmin.hotel.toString(),
        };

        const newUserDocument = await userService.createUser(creationData);
        const sanitizedUser = userService.sanitizeUser(newUserDocument);

        res.status(201).json({ // Send success response
            message: 'User created successfully.',
            user: sanitizedUser
        });
    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request for an admin to update a specific user.
 */
export const handleAdminUpdateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() }); // Send error response
        return; // Stop execution
    }

    try {
        const targetUserId = req.params.userId;
        const requestingUser = req.user as IUser;
        const targetUser = await userService.findUserById(targetUserId);

        if ((requestingUser.role === Role.HotelAdmin || requestingUser.role === Role.Staff)) {
            if (!requestingUser.hotel || !targetUser.hotel) {
                throw new ForbiddenError('Cannot update user due to missing hotel association.');
            }
            if (requestingUser.hotel.toString() !== targetUser.hotel.toString()) {
                throw new ForbiddenError('Access denied: You can only update users within your own hotel.');
            }
        }
        if (requestingUser.role === Role.HotelAdmin && targetUser.role === Role.HotelAdmin && requestingUser.id !== targetUser.id) {
            throw new ForbiddenError('Hotel Admins cannot modify other Hotel Admins.');
        }

        const adminUpdateData: Partial<IUser> = {};
        if (req.body.firstName !== undefined) adminUpdateData.firstName = req.body.firstName;
        if (req.body.lastName !== undefined) adminUpdateData.lastName = req.body.lastName;
        if (req.body.role !== undefined) {
            const newRole = req.body.role as Role;
            if (!Object.values(Role).includes(newRole)) throw new BadRequestError(`Invalid role specified: ${newRole}`);
            if (newRole === Role.HotelAdmin && requestingUser.role !== Role.HotelAdmin) throw new ForbiddenError(`You do not have permission to assign the role: ${newRole}`);
            if (newRole === Role.Customer) throw new ForbiddenError(`Cannot assign role '${Role.Customer}' via admin update.`);
            adminUpdateData.role = newRole;
        }
        if (req.body.isActive !== undefined) {
            if (typeof req.body.isActive !== 'boolean') throw new BadRequestError("'isActive' must be a boolean value (true or false).");
            if (targetUser.id === requestingUser.id && req.body.isActive === false) throw new ForbiddenError("You cannot deactivate your own account.");
            adminUpdateData.isDeleted = !req.body.isActive;
        }

        Object.assign(targetUser, adminUpdateData);

        if (adminUpdateData.role === Role.Customer) {
            targetUser.hotel = undefined;
        } else if (adminUpdateData.role === Role.Staff || adminUpdateData.role === Role.HotelAdmin) {
            if (!targetUser.hotel) {
                console.warn(`Re-associating user ${targetUser.id} with hotel ${requestingUser.hotel} due to role update.`);
                targetUser.hotel = requestingUser.hotel;
            }
        }

        try {
            const savedUserDocument = await targetUser.save();
            const sanitizedUser = userService.sanitizeUser(savedUserDocument);

            res.status(200).json({ // Send success response
                message: 'User updated successfully.',
                user: sanitizedUser
            });
        } catch (error: any) {
            console.error('Error saving user update by admin:', error);
            if (error.code === 11000) {
                const field = Object.keys(error.keyValue)[0];
                throw new ConflictError(`Update failed: An account with that ${field} already exists.`);
            }
            // Re-throw other save errors to be caught by outer catch
            throw error;
        }

    } catch (error) {
        next(error); // Pass error to handler
    }
};

/**
 * Handles request for an admin to soft-delete (deactivate) a user.
 */
export const handleAdminDeleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Added Promise<void> return type
    try {
        const targetUserId = req.params.userId;
        const requestingUser = req.user as IUser;
        const targetUser = await userService.findUserById(targetUserId);

        if (targetUser.id === requestingUser.id) {
            throw new ForbiddenError("You cannot delete your own account.");
        }

        if ((requestingUser.role === Role.HotelAdmin || requestingUser.role === Role.Staff)) {
            if (!requestingUser.hotel || !targetUser.hotel) {
                throw new ForbiddenError('Cannot delete user due to missing hotel association.');
            }
            if (requestingUser.hotel.toString() !== targetUser.hotel.toString()) {
                throw new ForbiddenError('Access denied: You can only delete users within your own hotel.');
            }
        }
        if (requestingUser.role === Role.HotelAdmin && targetUser.role === Role.HotelAdmin) {
            throw new ForbiddenError('Hotel Admins cannot delete other Hotel Admins.');
        }

        await userService.softDeleteUser(targetUserId);
        res.status(200).json({ message: 'User deactivated successfully.' }); // Send success response

    } catch (error) {
        next(error); // Pass error to handler
    }
};
