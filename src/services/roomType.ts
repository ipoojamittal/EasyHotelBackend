// ---------- File: src/services/roomType.service.ts ----------

import mongoose, { Types } from 'mongoose';
import RoomType, { IRoomType } from '../models/RoomType';
import Hotel, { IHotel } from '../models/Hotel';
import User, { IUser, Role } from '../models/User';
import Room from '../models/Room';
import {
    AppError,
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    ConflictError
} from '../utils/errors';

// --- Interfaces for Data Transfer ---
export interface RoomTypeCreationData {
    name: string;
    basePrice: number;
    defaultCapacity: number;
    typeCode?: string;
    description?: string;
    maxCapacity?: number;
    amenities?: string[];
    images?: string[];
    bedConfiguration?: string;
    viewType?: string;
    size?: { value: number; unit: 'sqm' | 'sqft' };
    tags?: string[];
    sortOrder?: number;
}
export type RoomTypeUpdateData = Partial<Omit<RoomTypeCreationData, 'typeCode'>> & {
    isActive?: boolean;
};
export interface ListRoomTypeOptions {
    page?: number;
    limit?: number;
    isActive?: boolean;
    sortBy?: keyof IRoomType | string;
    sortOrder?: 'asc' | 'desc';
    name?: string;
}

// --- Helper Functions ---
const validateObjectId = (id: string | Types.ObjectId, paramName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ${paramName} format.`);
    }
};

const checkHotelAccessPermission = async (
    hotelId: string | Types.ObjectId,
    requestingUser: IUser
): Promise<IHotel> => {
    validateObjectId(hotelId, 'hotelId');

    const hotel = await Hotel.findOne({ _id: hotelId, isActive: true });

    if (!hotel) {
        throw new NotFoundError(`Active hotel not found with ID: ${hotelId}`);
    }

    if (!requestingUser._id) {
        throw new AppError('User authentication data is incomplete (missing _id).', 500);
    }

    const isHotelAdminOwner = requestingUser.role === Role.HotelAdmin && hotel.createdBy.toString() === requestingUser._id.toString();
    const isHotelStaffMember = requestingUser.role === Role.Staff && requestingUser.hotel?.toString() === hotelId.toString();

    if (isHotelAdminOwner || isHotelStaffMember) {
        return hotel;
    } else {
        throw new ForbiddenError(`You do not have permission to manage room types for hotel ${hotel.name} (ID: ${hotelId}).`);
    }
};


// --- Service Functions ---

/**
 * Creates a new room type for a specific hotel after verifying authorization and uniqueness.
 * @param hotelId - The ID of the hotel to add the room type to.
 * @param data - The details of the room type to create.
 * @param requestingUser - The user performing the action (must be HotelAdmin/Staff for the hotel).
 * @returns Promise<IRoomType> - The newly created room type document.
 * @throws {NotFoundError} If the specified hotel is not found or inactive.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {ConflictError} If a room type with the same name or type code already exists in the hotel.
 * @throws {BadRequestError} If validation fails (e.g., invalid data format).
 * @throws {AppError} For other database or unexpected errors.
 */
export const createRoomType = async (
    hotelId: string | Types.ObjectId,
    data: RoomTypeCreationData,
    requestingUser: IUser
): Promise<IRoomType> => {
    const hotel = await checkHotelAccessPermission(hotelId, requestingUser);

    const existingByName = await RoomType.findOne({
        hotel: hotelId,
        name: data.name,
        isActive: true
    }).lean();

    if (existingByName) {
        throw new ConflictError(`An active room type named '${data.name}' already exists in hotel ${hotel.name}.`);
    }

    if (data.typeCode) {
        const existingByCode = await RoomType.findOne({
            hotel: hotelId,
            typeCode: data.typeCode,
            isActive: true
        }).lean();
        if (existingByCode) {
            throw new ConflictError(`An active room type with code '${data.typeCode}' already exists in hotel ${hotel.name}.`);
        }
    }

    const newRoomType = new RoomType({
        ...data,
        hotel: hotelId,
        isActive: true,
    });

    try {
        const savedRoomType = await newRoomType.save();
        console.log(`services/roomType.service: Room Type '${savedRoomType.name}' created successfully for hotel ${hotelId} by user ${requestingUser.id}`);
        return savedRoomType;
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`services/roomType.service: Validation error creating room type:`, error.errors);
            throw new BadRequestError(`Invalid room type data: ${error.message}`);
        }
        console.error(`services/roomType.service: Error saving new room type:`, error);
        throw new AppError('Failed to create room type due to a database error.', 500);
    }
};

/**
 * Retrieves a specific room type by its ID, ensuring it belongs to the specified hotel and the user is authorized.
 * @param hotelId - The ID of the hotel the room type should belong to.
 * @param roomTypeId - The ID of the room type to retrieve.
 * @param requestingUser - The user performing the action (for authorization check).
 * @returns Promise<IRoomType> - The found room type document.
 * @throws {NotFoundError} If the hotel or the specific room type within that hotel is not found.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {BadRequestError} If any ID format is invalid.
 * @throws {AppError} For other database or unexpected errors.
 */
export const getRoomTypeById = async (
    hotelId: string | Types.ObjectId,
    roomTypeId: string | Types.ObjectId,
    requestingUser: IUser
): Promise<IRoomType> => {
    await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(roomTypeId, 'roomTypeId');

    const roomType = await RoomType.findOne({ _id: roomTypeId, hotel: hotelId });

    if (!roomType) {
        throw new NotFoundError(`Room type not found with ID: ${roomTypeId} for hotel ID: ${hotelId}`);
    }

    return roomType;
};

/**
 * Updates an existing room type after verifying authorization and checking for conflicts.
 * @param hotelId - The ID of the hotel the room type belongs to.
 * @param roomTypeId - The ID of the room type to update.
 * @param updateData - An object containing the fields to update.
 * @param requestingUser - The user performing the action.
 * @returns Promise<IRoomType> - The updated room type document.
 * @throws {NotFoundError} If the hotel or room type is not found.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {ConflictError} If the update causes a name conflict or tries to deactivate a type in use.
 * @throws {BadRequestError} If validation fails or IDs are invalid.
 * @throws {AppError} For other database or unexpected errors.
 */
export const updateRoomType = async (
    hotelId: string | Types.ObjectId,
    roomTypeId: string | Types.ObjectId,
    updateData: RoomTypeUpdateData,
    requestingUser: IUser
): Promise<IRoomType> => {
    const hotel = await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(roomTypeId, 'roomTypeId');

    const roomType = await RoomType.findOne({ _id: roomTypeId, hotel: hotelId });
    if (!roomType) {
        throw new NotFoundError(`Room type not found with ID: ${roomTypeId} for hotel ${hotel.name}.`);
    }

    if (updateData.name && updateData.name !== roomType.name) {
        const existingByName = await RoomType.findOne({
            hotel: hotelId,
            name: updateData.name,
            isActive: true,
            _id: { $ne: roomTypeId }
        }).lean();
        if (existingByName) {
            throw new ConflictError(`An active room type named '${updateData.name}' already exists in hotel ${hotel.name}.`);
        }
    }

    Object.assign(roomType, updateData);

    if (updateData.isActive === false && roomType.isModified('isActive')) {
        const activeRoomsUsingType = await Room.countDocuments({
            roomType: roomTypeId,
            isDeleted: false
        });

        if (activeRoomsUsingType > 0) {
            throw new ConflictError(`Cannot deactivate room type '${roomType.name}' because ${activeRoomsUsingType} active room(s) are currently using it.`);
        }
        console.warn(`services/roomType.service: Deactivating room type '${roomType.name}' (ID: ${roomTypeId}) for hotel ${hotelId} by user ${requestingUser.id}.`);
    }


    try {
        const updatedRoomType = await roomType.save();
        console.log(`services/roomType.service: Room Type '${updatedRoomType.name}' (ID: ${roomTypeId}) updated successfully for hotel ${hotelId} by user ${requestingUser.id}`);
        return updatedRoomType;
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`services/roomType.service: Validation error updating room type ${roomTypeId}:`, error.errors);
            throw new BadRequestError(`Invalid room type update data: ${error.message}`);
        }
        console.error(`services/roomType.service: Error saving room type update for ${roomTypeId}:`, error);
        throw new AppError('Failed to update room type due to a database error.', 500);
    }
};

/**
 * Lists room types for a specific hotel with filtering, pagination, and sorting after verifying authorization.
 * @param hotelId - The ID of the hotel whose room types to list.
 * @param options - Options object containing parameters for filtering (isActive, name), pagination (page, limit), and sorting (sortBy, sortOrder).
 * @param requestingUser - The user performing the action.
 * @returns Promise<object> - An object containing the list of room types (`roomTypes`) and pagination details (`currentPage`, `totalPages`, `totalRoomTypes`, `limit`).
 * @throws {NotFoundError} If the hotel is not found or inactive.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {BadRequestError} If hotelId format is invalid.
 * @throws {AppError} For other database or unexpected errors.
 */
export const listRoomTypes = async (
    hotelId: string | Types.ObjectId,
    options: ListRoomTypeOptions,
    requestingUser: IUser
) => {
    await checkHotelAccessPermission(hotelId, requestingUser);

    const { page = 1, limit = 10, sortBy = 'sortOrder', sortOrder = 'asc', name } = options;
    const skip = (page - 1) * limit;

    const filterQuery: any = { hotel: hotelId };

    if (options.isActive !== undefined) {
        filterQuery.isActive = options.isActive;
    } else {
        filterQuery.isActive = true;
    }

    if (name) {
        filterQuery.name = new RegExp(name, 'i');
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    if (sortBy !== 'name') {
        sortOptions['name'] = 1;
    }

    try {
        const [roomTypes, totalRoomTypes] = await Promise.all([
            RoomType.find(filterQuery)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .lean(),
            RoomType.countDocuments(filterQuery)
        ]);

        const totalPages = Math.ceil(totalRoomTypes / limit);

        return {
            roomTypes,
            currentPage: page,
            totalPages,
            totalRoomTypes,
            limit,
        };
    } catch (error: any) {
        console.error(`services/roomType.service: Error listing room types for hotel ${hotelId}:`, error);
        throw new AppError('Failed to list room types due to a database error.', 500);
    }
};

/**
 * Deactivates (soft deletes) a room type after verifying authorization and checking for active room dependencies.
 * @param hotelId - The ID of the hotel the room type belongs to.
 * @param roomTypeId - The ID of the room type to deactivate.
 * @param requestingUser - The user performing the action.
 * @returns Promise<void> - Resolves when the operation is complete.
 * @throws {NotFoundError} If the hotel or room type is not found.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {BadRequestError} If the room type is already inactive or IDs are invalid.
 * @throws {ConflictError} If active rooms are still using this room type.
 * @throws {AppError} For other database or unexpected errors.
 */
export const deleteRoomType = async (
    hotelId: string | Types.ObjectId,
    roomTypeId: string | Types.ObjectId,
    requestingUser: IUser
): Promise<void> => {
    const hotel = await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(roomTypeId, 'roomTypeId');

    const roomType = await RoomType.findOne({ _id: roomTypeId, hotel: hotelId });
    if (!roomType) {
        throw new NotFoundError(`Room type not found with ID: ${roomTypeId} for hotel ${hotel.name}.`);
    }
    if (!roomType.isActive) {
        throw new BadRequestError(`Room type '${roomType.name}' is already inactive.`);
    }

    const activeRoomsUsingType = await Room.countDocuments({
        roomType: roomTypeId,
        isDeleted: false
    });

    if (activeRoomsUsingType > 0) {
        throw new ConflictError(`Cannot deactivate room type '${roomType.name}' because ${activeRoomsUsingType} active room(s) are currently using it. Please reassign or delete these rooms first.`);
    }

    roomType.isActive = false;

    try {
        await roomType.save();
        console.log(`services/roomType.service: Room Type '${roomType.name}' (ID: ${roomTypeId}) deactivated successfully for hotel ${hotelId} by user ${requestingUser.id}`);
    } catch (error: any) {
        console.error(`services/roomType.service: Error deactivating room type ${roomTypeId}:`, error);
        throw new AppError('Failed to deactivate room type due to a database error.', 500);
    }
};

