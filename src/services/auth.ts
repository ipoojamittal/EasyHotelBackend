// src/services/authService.ts
import User, { IUser, Role } from '../models/User';
import jwt, { Secret } from 'jsonwebtoken';
import { ConflictError, AppError } from '../utils/errors'; // Import relevant custom errors

// Fail fast if JWT_SECRET is missing — never fall back to an insecure default.
const jwtSecret: Secret = process.env.JWT_SECRET || (() => {
    throw new Error('FATAL: JWT_SECRET is not defined in environment variables.');
})();

// Parse duration strings like '1h', '30m', '7d', or a plain number of seconds.
// Fixes the bug where parseInt('1h') returned 1 (token expired in 1 second).
function parseExpiry(raw: string): number {
    const match = raw.match(/^(\d+)([smhd])$/);
    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        return value * multipliers[unit];
    }
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? 3600 : parsed;
}
const jwtExpiresIn: number = parseExpiry(process.env.JWT_EXPIRES_IN || '3600');

export interface RegistrationData {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
}

export interface JwtPayload {
    id: string;
    role: Role;
    hotelId?: string;
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        email?: string;
        firstName: string;
        lastName: string;
        role: Role;
        hotelId?: string;
    }
}

export const registerCustomer = async (data: RegistrationData): Promise<{ id: string }> => {
    const { firstName, lastName, email, phoneNumber, password } = data;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: phoneNumber }],
        isDeleted: false
    }).lean();

    if (existingUser) {
        if (existingUser.email === normalizedEmail) {
            throw new ConflictError('An active account with that email address already exists.');
        } else {
            throw new ConflictError('An active account with that phone number already exists.');
        }
    }

    const newUser = new User({
        firstName,
        lastName,
        email: normalizedEmail,
        phoneNumber,
        passwordHash: password,
        role: Role.Customer,
    });

    try {
        const savedUser = await newUser.save();
        return { id: savedUser.id };
    } catch (error: any) {
        console.error("Error saving new user in authService:", error);
        throw error;
    }
};


export const generateAuthToken = (user: Pick<IUser, 'id' | 'role' | 'hotel'>): string => {
    // Ensure required fields are present
    if (!user || !user.id || !user.role) {
        throw new AppError('Invalid user data provided for token generation.', 500);
    }

    const payload: JwtPayload = {
        id: user.id,
        role: user.role,
    };

    if ((user.role === Role.HotelAdmin || user.role === Role.Staff) && user.hotel) {
        payload.hotelId = typeof user.hotel === 'string' ? user.hotel : user.hotel?.toString();
    }

    try {
        const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
        return `Bearer ${token}`;
    } catch (error) {
        console.error("Error signing JWT:", error);
        throw new AppError("Could not generate authentication token.", 500);
    }
};

export const prepareLoginResponseUser = (user: IUser, payload: JwtPayload): LoginResponse['user'] => {
    if (!user) {
        throw new AppError('Invalid user object provided for login response.', 500);
    }
    return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: payload.hotelId
    };
}
