import mongoose, { Types } from 'mongoose';
import Room, { IRoom, RoomStatus } from '../models/Room';
import RoomType, { IRoomType } from '../models/RoomType';
import Hotel, { IHotel } from '../models/Hotel';
import User, { IUser, Role } from '../models/User';
import {
    AppError,
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    ConflictError
} from '../utils/errors';

export interface RoomCreationData {
    roomNumber: string;
    roomTypeId: string | Types.ObjectId;
    description?: string;
    capacity?: number;
    pricePerNight?: number;
    amenities?: string[];
    images?: string[];
    viewTypeOverride?: string;
    sizeOverride?: { value: number; unit: 'sqm' | 'sqft' };
    status?: RoomStatus;
}

export type RoomUpdateData = Partial<Omit<RoomCreationData, 'roomTypeId' | 'roomNumber'>> & {
    status?: RoomStatus;
    roomTypeId?: string | Types.ObjectId;
};

export interface ListRoomOptions {
    page?: number;
    limit?: number;
    roomTypeId?: string | Types.ObjectId;
    status?: RoomStatus;
    minCapacity?: number;
    maxPrice?: number;
    isDeleted?: boolean;
    sortBy?: keyof IRoom | string;
    sortOrder?: 'asc' | 'desc';
}

const validateObjectId = (id: string | Types.ObjectId, paramName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ${paramName} format.`);
    }
};

// Whitelisted sort fields to prevent NoSQL injection via sort parameters.
const ALLOWED_ROOM_SORT_FIELDS = ['roomNumber', 'status', 'createdAt', 'updatedAt', 'capacity', 'pricePerNight'];

const checkHotelAccessPermission = async (
    hotelId: string | Types.ObjectId,
    requestingUser: IUser
): Promise<IHotel> => {
    validateObjectId(hotelId, 'hotelId');
    const hotel = await Hotel.findOne({ _id: hotelId, isDeleted: false });
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
        throw new ForbiddenError(`You do not have permission to manage rooms for hotel ${hotel.name} (ID: ${hotelId}).`);
    }
};

/**
 * Creates a new room instance within a specific hotel, ensuring the room type is valid and the room number is unique.
 * @param hotelId - The ID of the hotel to add the room to.
 * @param data - Details for the new room, including the roomTypeId and optional overrides.
 * @param requestingUser - The user performing the action (must have permission for the hotel).
 * @returns Promise<IRoom> - The newly created room document, populated with its RoomType.
 * @throws {NotFoundError} If the hotel or the specified RoomType is not found, inactive, or doesn't belong to the hotel.
 * @throws {ForbiddenError} If the user is not authorized for the hotel.
 * @throws {ConflictError} If a room with the same roomNumber already exists in the hotel.
 * @throws {BadRequestError} If data validation fails or IDs are invalid.
 * @throws {AppError} For other database or unexpected errors, including missing user ID.
 */
export const createRoom = async (
    hotelId: string | Types.ObjectId,
    data: RoomCreationData,
    requestingUser: IUser
): Promise<IRoom> => {
    const hotel = await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(data.roomTypeId, 'roomTypeId');

    const roomType = await RoomType.findOne({
        _id: data.roomTypeId,
        hotel: hotelId,
        isDeleted: false
    });
    if (!roomType) {
        throw new NotFoundError(`Active Room Type with ID ${data.roomTypeId} not found for hotel ${hotel.name}.`);
    }

    const existingRoom = await Room.findOne({
        hotel: hotelId,
        roomNumber: data.roomNumber,
        isDeleted: false
    });
    if (existingRoom) {
        throw new ConflictError(`A room with number '${data.roomNumber}' already exists in hotel ${hotel.name}.`);
    }

    if (!requestingUser._id) {
        throw new AppError('User authentication data is incomplete (missing _id).', 500);
    }

    const newRoom = new Room({
        ...data,
        hotel: hotelId,
        roomType: data.roomTypeId,
        status: data.status || RoomStatus.Available,
        isDeleted: false,
        createdBy: requestingUser._id,
    });

    try {
        let savedRoom = await newRoom.save();
        savedRoom = await savedRoom.populate<{ roomType: IRoomType }>('roomType');
        return savedRoom;
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            throw new BadRequestError(`Invalid room data: ${error.message}`);
        }
        console.error(`services/room.service: Error saving new room:`, error);
        throw new AppError('Failed to create room due to a database error.', 500);
    }
};

/**
 * Retrieves details of a specific active room instance, populated with its active RoomType information.
 * @param hotelId - The ID of the hotel the room belongs to.
 * @param roomId - The ID of the room to retrieve.
 * @param requestingUser - Optional: The user making the request (currently unused for checks here but available for future permission logic).
 * @returns Promise<IRoom> - The room document, populated with its RoomType.
 * @throws {NotFoundError} If the hotel, room, or the room's associated RoomType is not found or inactive.
 * @throws {BadRequestError} If ID formats are invalid.
 * @throws {AppError} For other database or unexpected errors.
 */
export const getRoomDetails = async (
    hotelId: string | Types.ObjectId,
    roomId: string | Types.ObjectId,
    requestingUser?: IUser
): Promise<IRoom> => {
    validateObjectId(hotelId, 'hotelId');
    validateObjectId(roomId, 'roomId');

    const hotelExists = await Hotel.exists({ _id: hotelId, isDeleted: false });
    if (!hotelExists) {
        throw new NotFoundError(`Active hotel not found with ID: ${hotelId}`);
    }

    const room = await Room.findOne({
        _id: roomId,
        hotel: hotelId,
        isDeleted: false
    }).populate<{ roomType: IRoomType | null }>({
        path: 'roomType',
    });

    if (!room) {
        throw new NotFoundError(`Room not found with ID: ${roomId} in hotel ${hotelId}, or it is inactive.`);
    }

    const populatedRoomType = room.roomType;

    if (!populatedRoomType || typeof populatedRoomType !== 'object' || !('name' in populatedRoomType) || populatedRoomType.isDeleted) {
        console.warn(`services/room.service: Room ${roomId} is associated with an inactive, missing, or improperly populated RoomType.`);
        throw new NotFoundError(`Room ${roomId} is associated with an inactive or missing Room Type.`);
    }

    return room as IRoom;
};

/**
 * Updates an existing room instance after verifying authorization and validating the new RoomType if provided.
 * @param hotelId - The ID of the hotel the room belongs to.
 * @param roomId - The ID of the room to update.
 * @param updateData - An object containing the fields to update. Can include a new `roomTypeId`.
 * @param requestingUser - The user performing the action (must have permission for the hotel).
 * @returns Promise<IRoom> - The updated room document, populated with its RoomType.
 * @throws {NotFoundError} If the hotel, room, or a newly specified RoomType is not found/inactive.
 * @throws {ForbiddenError} If the user is not authorized for the hotel.
 * @throws {BadRequestError} If validation fails or IDs are invalid.
 * @throws {AppError} For other database or unexpected errors, including missing user ID.
 */
export const updateRoom = async (
    hotelId: string | Types.ObjectId,
    roomId: string | Types.ObjectId,
    updateData: RoomUpdateData,
    requestingUser: IUser
): Promise<IRoom> => {
    await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(roomId, 'roomId');

    const room = await Room.findOne({ _id: roomId, hotel: hotelId, isDeleted: false });
    if (!room) {
        throw new NotFoundError(`Room not found with ID: ${roomId} in hotel ${hotelId}, or it has been deleted.`);
    }

    if (updateData.roomTypeId && updateData.roomTypeId.toString() !== room.roomType.toString()) {
        validateObjectId(updateData.roomTypeId, 'new roomTypeId');
        const newRoomType = await RoomType.findOne({
            _id: updateData.roomTypeId,
            hotel: hotelId,
            isDeleted: false
        });
        if (!newRoomType) {
            throw new NotFoundError(`Cannot assign Room Type: Active Room Type with ID ${updateData.roomTypeId} not found for this hotel.`);
        }
    }

    if (!requestingUser._id) {
        throw new AppError('User authentication data is incomplete (missing _id).', 500);
    }

    Object.assign(room, updateData);
    room.updatedBy = new Types.ObjectId(requestingUser._id.toString());


    try {
        let updatedRoom = await room.save();
        updatedRoom = await updatedRoom.populate<{ roomType: IRoomType }>('roomType');
        return updatedRoom;
    } catch (error: any) {
        if (error instanceof mongoose.Error.ValidationError) {
            throw new BadRequestError(`Invalid room update data: ${error.message}`);
        }
        console.error(`services/room.service: Error saving room update for ${roomId}:`, error);
        throw new AppError('Failed to update room due to a database error.', 500);
    }
};

/**
 * Lists room instances for a specific hotel with filtering, pagination, and sorting, populated with RoomType details.
 * @param hotelId - The ID of the hotel whose rooms to list.
 * @param options - Options object containing parameters for filtering (isDeleted, status, roomTypeId), pagination (page, limit), and sorting (sortBy, sortOrder).
 * @param requestingUser - Optional: The user performing the action. If provided, authorization is checked. If omitted, assumes public access is intended (but still validates hotel).
 * @returns Promise<object> - An object containing the list of rooms (`rooms`) and pagination details (`currentPage`, `totalPages`, `totalRooms`, `limit`).
 * @throws {NotFoundError} If the hotel is not found or inactive.
 * @throws {ForbiddenError} If the requesting user is provided and is not authorized for the hotel.
 * @throws {BadRequestError} If ID formats or query parameters are invalid.
 * @throws {AppError} For other database or unexpected errors.
 */
export const listRooms = async (
    hotelId: string | Types.ObjectId,
    options: ListRoomOptions,
    requestingUser?: IUser
) => {
    if (requestingUser) {
        await checkHotelAccessPermission(hotelId, requestingUser);
    } else {
        validateObjectId(hotelId, 'hotelId');
        const hotelExists = await Hotel.exists({ _id: hotelId, isDeleted: false });
        if (!hotelExists) {
            throw new NotFoundError(`Active hotel not found with ID: ${hotelId}`);
        }
    }

    const page = Math.min(1000, Math.max(1, options.page || 1));
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const filterQuery: mongoose.FilterQuery<IRoom> = { hotel: hotelId };

    filterQuery.isDeleted = options.isDeleted === true ? true : false;

    if (options.status) {
        filterQuery.status = options.status;
    }
    if (options.roomTypeId) {
        validateObjectId(options.roomTypeId, 'roomTypeId filter');
        filterQuery.roomType = options.roomTypeId;
    }

    const sortOptions: any = {};
    const safeSortBy = options.sortBy && ALLOWED_ROOM_SORT_FIELDS.includes(options.sortBy as string) ? options.sortBy : 'roomNumber';
    sortOptions[safeSortBy] = options.sortOrder === 'asc' ? 1 : -1;

    try {
        const [rooms, totalRooms] = await Promise.all([
            Room.find(filterQuery)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate<{ roomType: IRoomType }>({
                    path: 'roomType',
                })
                .lean(),
            Room.countDocuments(filterQuery)
        ]);

        const totalPages = Math.ceil(totalRooms / limit);

        return {
            rooms,
            currentPage: page,
            totalPages,
            totalRooms,
            limit,
        };
    } catch (error: any) {
        console.error(`services/room.service: Error listing rooms for hotel ${hotelId}:`, error);
        throw new AppError('Failed to list rooms due to a database error.', 500);
    }
};

/**
 * Deactivates (soft deletes) a specific room instance after verifying authorization and checking dependencies (e.g., occupancy status).
 * @param hotelId - The ID of the hotel the room belongs to.
 * @param roomId - The ID of the room to deactivate.
 * @param requestingUser - The user performing the action (must have permission for the hotel).
 * @returns Promise<void> - Resolves when the operation is complete.
 * @throws {NotFoundError} If the hotel or room is not found.
 * @throws {ForbiddenError} If the requesting user is not authorized for the hotel.
 * @throws {BadRequestError} If the room is already deleted or cannot be deleted (e.g., occupied).
 * @throws {AppError} For other database or unexpected errors, including missing user ID.
 */
export const softDeleteRoom = async (
    hotelId: string | Types.ObjectId,
    roomId: string | Types.ObjectId,
    requestingUser: IUser
): Promise<void> => {
    await checkHotelAccessPermission(hotelId, requestingUser);
    validateObjectId(roomId, 'roomId');

    const room = await Room.findOne({ _id: roomId, hotel: hotelId });
    if (!room) {
        throw new NotFoundError(`Room not found with ID: ${roomId} in hotel ${hotelId}.`);
    }
    if (room.isDeleted) {
        throw new BadRequestError(`Room ${room.roomNumber} is already deleted.`);
    }

    if (room.status === RoomStatus.Occupied) {
        throw new BadRequestError(`Cannot delete room ${room.roomNumber} because it is currently occupied.`);
    }

    if (!requestingUser._id) {
        throw new AppError('User authentication data is incomplete (missing _id).', 500);
    }

    room.isDeleted = true;
    room.status = RoomStatus.OutOfService;
    const updaterId = new Types.ObjectId(requestingUser._id.toString());
    room.updatedBy = updaterId;

    try {
        await room.save();
    } catch (error: any) {
        console.error(`services/room.service: Error deactivating room ${roomId}:`, error);
        throw new AppError('Failed to deactivate room due to a database error.', 500);
    }
};

// ---------- End of File: src/services/room.service.ts ----------
