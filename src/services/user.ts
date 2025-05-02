// src/services/user.ts
import mongoose from 'mongoose';
import User, { IUser, Role } from '../models/User';
import { NotFoundError, BadRequestError, AppError, ConflictError } from '../utils/errors';
import bcrypt from 'bcrypt';

export interface SanitizedUser {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    role: Role;
    hotel?: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserUpdateData {
    firstName?: string;
    lastName?: string;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

export interface UserCreationData {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
    role: Role;
    hotelId?: string;
}

export interface ListUserOptions {
    page?: number;
    limit?: number;
    role?: Role;
    hotelId?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Takes a Mongoose IUser document and returns a plain object with sensitive fields removed.
 * @param user - The Mongoose IUser document.
 * @returns A sanitized plain JavaScript object suitable for API responses.
 */
export const sanitizeUser = (user: IUser): SanitizedUser => {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        hotel: user.hotel ? user.hotel.toString() : undefined,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        isDeleted: user.isDeleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

/**
 * Finds a user by their ID, excluding deleted users.
 * @param userId - The ID of the user to find.
 * @returns The found user document.
 * @throws NotFoundError if the user is not found or is soft-deleted.
 * @throws AppError for database errors.
 */
export const findUserById = async (userId: string | mongoose.Types.ObjectId): Promise<IUser> => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new BadRequestError('Invalid user ID format.');
    }
    try {
        const user = await User.findOne({ _id: userId, isDeleted: false });
        if (!user) {
            throw new NotFoundError('User not found.');
        }
        return user;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('service/user/findUserById(): Error in findUserById service:', error);
        throw new AppError('Failed to retrieve user due to a database error.', 500);
    }
};

/**
 * Updates a user's profile information.
 * @param userId - The ID of the user to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated user document (Mongoose object).
 * @throws NotFoundError if the user is not found.
 * @throws AppError for database errors.
 */
export const updateUserProfile = async (userId: string | mongoose.Types.ObjectId, updateData: UserUpdateData): Promise<IUser> => {
    const user = await findUserById(userId);

    Object.keys(updateData).forEach(key => {
        if (key === 'firstName' || key === 'lastName') {
            (user as any)[key] = (updateData as any)[key];
        }
    });

    try {
        const updatedUser = await user.save();
        return updatedUser;
    } catch (error: any) {
        console.error('service/user/updateUserProfile() Error saving user profile update:', error);
        throw new AppError('Failed to update user profile.', 500);
    }
};

/**
 * Changes a user's password after verifying the current one.
 * @param userId - The ID of the user changing their password.
 * @param passwordData - Object containing current and new passwords.
 * @returns Promise<void> indicating success.
 * @throws NotFoundError if the user is not found.
 * @throws BadRequestError if the current password does not match.
 * @throws AppError for hashing or saving errors.
 */
export const changeUserPassword = async (userId: string | mongoose.Types.ObjectId, passwordData: ChangePasswordData): Promise<void> => {
    const user = await User.findOne({ _id: userId, isDeleted: false }).select('+passwordHash');
    if (!user) {
        throw new NotFoundError('User not found.');
    }

    const isMatch = await user.comparePassword(passwordData.currentPassword);
    if (!isMatch) {
        throw new BadRequestError('Incorrect current password.');
    }
    user.passwordHash = passwordData.newPassword;

    try {
        await user.save();
    } catch (error: any) {
        console.error('service/user/changeUserPassword(): Error saving new password:', error);
        throw new AppError('Failed to change password.', 500);
    }
};

/**
 * Creates a new user (typically used by an admin).
 * @param creationData - Data for the new user.
 * @returns The newly created user document (Mongoose object).
 * @throws ConflictError if email or phone number already exists.
 * @throws BadRequestError if required hotelId is missing for staff/admin roles or format is invalid.
 * @throws AppError for database errors.
 */
export const createUser = async (creationData: UserCreationData): Promise<IUser> => {
    const { firstName, lastName, email, phoneNumber, password, role, hotelId } = creationData;
    const normalizedEmail = email.toLowerCase();

    if ((role === Role.Staff || role === Role.HotelAdmin) && !hotelId) {
        throw new BadRequestError(`Hotel ID is required when creating a user with role '${role}'.`);
    }
    if (hotelId && !mongoose.Types.ObjectId.isValid(hotelId)) {
        throw new BadRequestError('Invalid Hotel ID format.');
    }

    const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: phoneNumber }],
        isDeleted: false
    }).lean();

    if (existingUser) {
        if (existingUser.email === normalizedEmail) {
            throw new ConflictError('An active user with this email address already exists.');
        } else {
            throw new ConflictError('An active user with this phone number already exists.');
        }
    }

    const newUser = new User({
        firstName,
        lastName,
        email: normalizedEmail,
        phoneNumber,
        passwordHash: password,
        role,
        hotel: hotelId ? new mongoose.Types.ObjectId(hotelId) : undefined,
    });

    try {
        const savedUser = await newUser.save();
        return savedUser;
    } catch (error: any) {
        console.error('service/user/createUser(): Error creating new user in service:', error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            throw new ConflictError(`An account with that ${field} already exists.`);
        }
        throw new AppError('Failed to create user.', 500);
    }
};

/**
 * Soft-deletes a user by setting isDeleted to true.
 * @param userId - The ID of the user to soft-delete.
 * @returns Promise<void> indicating success.
 * @throws NotFoundError if the user is not found or already deleted.
 * @throws AppError for database errors.
 */
export const softDeleteUser = async (userId: string | mongoose.Types.ObjectId): Promise<void> => {
    const user = await findUserById(userId);
    user.isDeleted = true;
    try {
        await user.save();
    } catch (error: any) {
        console.error('Error soft-deleting user:', error);
        throw new AppError('service/user/softDeleteUser() Failed to delete user.', 500);
    }
};

/**
 * Lists users based on filtering and pagination options.
 * @param options - Filtering and pagination parameters.
 * @returns An object containing the list of *sanitized* users and pagination details.
 */
export const listUsers = async (options: ListUserOptions) => {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 10);
    const skip = (page - 1) * limit;
    const queryFilter: any = {};

    if (options.role) {
        queryFilter.role = options.role;
    }

    if (options.hotelId) {
        if (!mongoose.Types.ObjectId.isValid(options.hotelId)) {
            throw new BadRequestError('Invalid Hotel ID format for filtering.');
        }
        queryFilter.hotel = new mongoose.Types.ObjectId(options.hotelId);
    }

    if (options.isActive !== undefined) {
        queryFilter.isDeleted = !options.isActive;
    } else {
        queryFilter.isDeleted = false;
    }

    const sort: any = {};
    if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
    } else {
        sort.createdAt = -1;
    }

    try {
        const users = await User.find(queryFilter)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments(queryFilter);
        const totalPages = Math.ceil(totalUsers / limit);
        const sanitizedUsers = users.map(user => sanitizeUser(user));

        return {
            users: sanitizedUsers,
            currentPage: page,
            totalPages,
            totalUsers,
            limit,
        };
    } catch (error: any) {
        console.error('Error listing users in service:', error);
        throw new AppError('Failed to list users.', 500);
    }
};
