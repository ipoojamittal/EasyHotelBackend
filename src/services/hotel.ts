import mongoose from 'mongoose';
import Hotel, { IHotel } from '../models/Hotel';
import User, { IUser, Role } from '../models/User';
import {
    AppError,
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    ConflictError
} from '../utils/errors';


export interface HotelCreationData {
    name: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    phoneNumber?: string[];
    email?: string;
    description?: string;
    amenities?: string[];
    images?: string[];
    checkInTime?: string;
    checkOutTime?: string;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
    mapsUrl?: {
        googleMaps?: string;
        appleMaps?: string;
    };
}

export type HotelUpdateData = Partial<Omit<HotelCreationData, 'address'> & { address?: Partial<HotelCreationData['address']> }>;
export interface ListHotelOptions {
    page?: number;
    limit?: number;
    city?: string;
    country?: string;
    isDeleted?: boolean; // Filter by deleted status (default: false = active only)
    sortBy?: keyof IHotel | string; // Allow sorting by model fields or custom strings
    sortOrder?: 'asc' | 'desc';
}

// Whitelisted sort fields to prevent NoSQL injection via sort parameters.
const ALLOWED_HOTEL_SORT_FIELDS = ['name', 'createdAt', 'updatedAt', 'address.city', 'address.country'];

const validateObjectId = (id: string | mongoose.Types.ObjectId, paramName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ${paramName} format.`);
    }
};

const findActiveHotelByIdInternal = async (hotelId: string | mongoose.Types.ObjectId): Promise<IHotel> => {
    validateObjectId(hotelId, 'hotelId');
    try {
        const hotel = await Hotel.findOne({ _id: hotelId, isDeleted: false });
        if (!hotel) {
            // What: Throw a specific error when the resource is not found.
            // Why: Allows calling functions and the error handler middleware to react specifically to "not found" scenarios (e.g., return a 404 status).
            // What if not: Might return null/undefined, forcing callers to add null checks everywhere, or throw a generic error, making specific handling difficult.
            throw new NotFoundError('Active hotel not found.');
        }
        return hotel;
    } catch (error: any) {
        if (error instanceof AppError) throw error; // Re-throw known AppErrors
        console.error(`hotel.service/findActiveHotelByIdInternal(): Error finding hotel ${hotelId}:`, error);
        throw new AppError('Failed to retrieve hotel due to a database error.', 500);
    }
};


/**
 * Creates a new hotel associated with an admin user.
 * @param data - The data for the new hotel.
 * @param adminUserId - The ID of the HotelAdmin user creating the hotel.
 * @returns The newly created hotel document.
 * @throws BadRequestError if adminUserId is invalid.
 * @throws AppError for database errors during creation or admin user validation.
 */
export const createHotel = async (data: HotelCreationData, adminUserId: string | mongoose.Types.ObjectId): Promise<IHotel> => {
    validateObjectId(adminUserId, 'adminUserId');
    const newHotel = new Hotel({
        ...data,
        createdBy: adminUserId,
        isDeleted: false, // Ensure new hotels are active by default
    });

    try {
        const savedHotel = await newHotel.save();
        console.log(`hotel.service/createHotel(): Hotel created successfully with ID: ${savedHotel.id}`);
        return savedHotel;
    } catch (error: any) {
        if (error.code === 11000) { // Handle duplicate key error (e.g., if unique index exists on name)
            const field = Object.keys(error.keyValue)[0];
            throw new ConflictError(`A hotel with that ${field} already exists.`);
        }
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`hotel.service/createHotel(): Validation error creating hotel:`, error.errors);
            throw new BadRequestError(`Invalid hotel data: ${error.message}`);
        }
        console.error(`hotel.service/createHotel(): Error saving new hotel:`, error);
        throw new AppError('Failed to create hotel due to a database error.', 500);
    }
};

/**
 * Retrieves the details of a specific active hotel. Suitable for public access.
 * @param hotelId - The ID of the hotel to retrieve.
 * @returns The hotel document.
 * @throws NotFoundError if the hotel is not found or not active.
 * @throws BadRequestError if hotelId is invalid.
 */
export const getHotelDetails = async (hotelId: string | mongoose.Types.ObjectId): Promise<IHotel> => {
    // What: Uses the internal helper function.
    // Why: Promotes code reuse and ensures consistent logic for finding active hotels.
    // What if not: Would duplicate the find logic here, violating DRY principles.
    return findActiveHotelByIdInternal(hotelId);
};

/**
 * Updates an existing hotel. Only the admin who created the hotel can update it.
 * @param hotelId - The ID of the hotel to update.
 * @param updateData - An object containing the fields to update.
 * @param requestingUserId - The ID of the user attempting the update.
 * @returns The updated hotel document.
 * @throws NotFoundError if the hotel is not found or not active.
 * @throws ForbiddenError if the requesting user is not the creator.
 * @throws BadRequestError if IDs are invalid or update data is problematic.
 * @throws AppError for database errors during update.
 */
export const updateHotel = async (
    hotelId: string | mongoose.Types.ObjectId,
    updateData: HotelUpdateData,
    requestingUserId: string | mongoose.Types.ObjectId
): Promise<IHotel> => {
    validateObjectId(requestingUserId, 'requestingUserId');
    const hotel = await findActiveHotelByIdInternal(hotelId); // Ensures hotel exists and is active

    if (hotel.createdBy.toString() !== requestingUserId.toString()) {
        console.warn(`hotel.service/updateHotel(): Forbidden attempt - User ${requestingUserId} tried to update hotel ${hotelId} created by ${hotel.createdBy}`);
        throw new ForbiddenError('You do not have permission to update this hotel.');
    }

     Object.assign(hotel, updateData);

    // Ensure nested address updates are handled correctly if provided
    if (updateData.address) {
        if (!hotel.address) hotel.address = { street: '', city: '', state: '', zipCode: '', country: '' }; // Initialize if address doesn't exist
        Object.assign(hotel.address, updateData.address);
        hotel.markModified('address');
    }


    try {
        const updatedHotel = await hotel.save();
        console.log(`hotel.service/updateHotel(): Hotel ${hotelId} updated successfully by user ${requestingUserId}.`);
        return updatedHotel;
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`hotel.service/updateHotel(): Validation error updating hotel ${hotelId}:`, error.errors);
            throw new BadRequestError(`Invalid hotel update data: ${error.message}`);
        }
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            throw new ConflictError(`Update failed: A hotel with that ${field} already exists.`);
        }
        console.error(`hotel.service/updateHotel(): Error saving hotel update for ${hotelId}:`, error);
        throw new AppError('Failed to update hotel due to a database error.', 500);
    }
};

/**
 * Lists hotels based on filtering and pagination options.
 * Primarily intended for Browse or administrative views.
 * @param options - Filtering and pagination parameters.
 * @returns An object containing the list of hotels and pagination details.
 */
export const listHotels = async (options: ListHotelOptions) => {
    const page = Math.min(1000, Math.max(1, options.page || 1));
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const filterQuery: any = {};
    filterQuery.isDeleted = options.isDeleted ?? false; // Default to active (non-deleted) only

    if (options.city) {
        filterQuery['address.city'] = new RegExp(options.city, 'i'); // Case-insensitive match
    }
    if (options.country) {
        filterQuery['address.country'] = new RegExp(options.country, 'i');
    }

    // --- Build Sort Options (whitelisted) ---
    const sortOptions: any = {};
    if (options.sortBy && ALLOWED_HOTEL_SORT_FIELDS.includes(options.sortBy as string)) {
        sortOptions[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
    } else {
        sortOptions.createdAt = -1; // Default sort: newest first
    }

    try {
        const [hotels, totalHotels] = await Promise.all([
            Hotel.find(filterQuery)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'firstName lastName email') // Optionally populate creator info, selecting specific fields
                .lean(), // Use .lean() for performance if you only need plain JS objects
            Hotel.countDocuments(filterQuery)
        ]);

        const totalPages = Math.ceil(totalHotels / limit);

        // console.log(`hotel.service/listHotels(): Listed ${hotels.length} hotels (Page ${page}/${totalPages}, Total ${totalHotels})`);

        return {
            hotels,
            currentPage: page,
            totalPages,
            totalHotels,
            limit,
        };
    } catch (error: any) {
        console.error(`hotel.service/listHotels(): Error listing hotels:`, error);
        throw new AppError('Failed to list hotels due to a database error.', 500);
    }
};

/**
 * Finds the active hotel managed by a specific HotelAdmin user.
 * @param adminUserId - The ID of the HotelAdmin user.
 * @returns The hotel document associated with the admin.
 * @throws NotFoundError if the admin user is not associated with an active hotel.
 * @throws BadRequestError if adminUserId is invalid.
 */
export const findHotelByAdmin = async (adminUserId: string | mongoose.Types.ObjectId): Promise<IHotel> => {
    validateObjectId(adminUserId, 'adminUserId');

    try {
       const hotel = await Hotel.findOne({ createdBy: adminUserId, isDeleted: false });

        if (!hotel) {
            throw new NotFoundError('No active hotel found associated with this admin user.');
        }
        console.log(`hotel.service/findHotelByAdmin(): Found hotel ${hotel.id} for admin ${adminUserId}`);
        return hotel;
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        console.error(`hotel.service/findHotelByAdmin(): Error finding hotel for admin ${adminUserId}:`, error);
        throw new AppError('Failed to retrieve hotel for admin due to a database error.', 500);
    }
};

/**
 * Soft-deletes a hotel by setting its isDeleted flag to true.
 * Only the admin who created the hotel can delete it.
 * @param hotelId - The ID of the hotel to deactivate.
 * @param requestingUserId - The ID of the user attempting the deactivation.
 * @returns Promise<void>
 * @throws NotFoundError if the hotel is not found or already inactive.
 * @throws ForbiddenError if the requesting user is not the creator.
 * @throws BadRequestError if IDs are invalid.
 * @throws AppError for database errors.
 */
export const softDeleteHotel = async (
    hotelId: string | mongoose.Types.ObjectId,
    requestingUserId: string | mongoose.Types.ObjectId
): Promise<void> => {
    validateObjectId(requestingUserId, 'requestingUserId');
    const hotel = await findActiveHotelByIdInternal(hotelId);

    if (hotel.createdBy.toString() !== requestingUserId.toString()) {
        console.warn(`hotel.service/softDeleteHotel(): Forbidden attempt - User ${requestingUserId} tried to delete hotel ${hotelId} created by ${hotel.createdBy}`);
        throw new ForbiddenError('You do not have permission to delete this hotel.');
    }
    hotel.isDeleted = true;

    try {
        await hotel.save();
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`hotel.service/softDeleteHotel(): Validation error deleting hotel ${hotelId}:`, error.errors);
            throw new BadRequestError(`Invalid data during deletion: ${error.message}`);
        }
        console.error(`hotel.service/softDeleteHotel(): Error deleting hotel ${hotelId}:`, error);
        throw new AppError('Failed to delete hotel due to a database error.', 500);
    }
};

/**
 * SuperAdmin-only: suspends (soft-deletes) any hotel by ID, bypassing the
 * ownership check. Used by the SuperAdmin suspend-hotel endpoint.
 * @param hotelId - The ID of the hotel to suspend.
 * @throws NotFoundError if the hotel is not found or already deleted.
 * @throws BadRequestError if hotelId is invalid.
 */
export const suspendHotelBySuperAdmin = async (
    hotelId: string | mongoose.Types.ObjectId
): Promise<void> => {
    validateObjectId(hotelId, 'hotelId');
    const hotel = await Hotel.findOne({ _id: hotelId, isDeleted: false });
    if (!hotel) {
        throw new NotFoundError('Active hotel not found.');
    }
    hotel.isDeleted = true;
    await hotel.save();
};