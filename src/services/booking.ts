import mongoose, {Types} from 'mongoose';
import Booking, {IBooking, BookingStatus} from '../models/Booking';
import Room, {IRoom, RoomStatus} from '../models/Room';
import Hotel, {IHotel} from '../models/Hotel';
import User, {IUser, Role} from '../models/User';
import {AppError, NotFoundError, BadRequestError, ConflictError, ForbiddenError} from '../utils/errors';
import {IRoomType} from '../models/RoomType';

export interface IUserPayload {
    id: string;
    role: Role;
    hotel?: string;
}

export interface BookingCreationData {
    hotelId: string | Types.ObjectId;
    roomId: string | Types.ObjectId;
    checkInDate: Date;
    checkOutDate: Date;
    numberOfGuests: number;
    specialRequests?: string;
}

// Add an interface for the update data
export interface BookingUpdateData {
    checkInDate?: Date;
    checkOutDate?: Date;
    numberOfGuests?: number;
    specialRequests?: string;
}

export interface StaffBookingCreationData extends BookingCreationData {
    customerId: string | Types.ObjectId;
}

export interface ListBookingOptions {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Whitelisted sort fields to prevent NoSQL injection via sort parameters.
const ALLOWED_SORT_FIELDS = ['createdAt', 'checkInDate', 'checkOutDate', 'totalPrice', 'status', 'numberOfGuests'];

// Valid booking status transitions (state machine).
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Cancelled, BookingStatus.NoShow],
    [BookingStatus.Confirmed]: [BookingStatus.CheckedIn, BookingStatus.Cancelled, BookingStatus.NoShow],
    [BookingStatus.CheckedIn]: [BookingStatus.CheckedOut],
    [BookingStatus.CheckedOut]: [],
    [BookingStatus.Cancelled]: [],
    [BookingStatus.NoShow]: [BookingStatus.Cancelled],
};

const validateObjectId = (id: string | Types.ObjectId, paramName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ${paramName} format.`);
    }
};

const buildSortOptions = (sortBy?: string, sortOrder?: 'asc' | 'desc'): Record<string, 1 | -1> => {
    const field = sortBy && ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    return { [field]: sortOrder === 'asc' ? 1 : -1 };
};

// Compute the number of nights between two dates (date-only, UTC).
const computeNights = (checkInDate: Date, checkOutDate: Date): number => {
    const ms = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
};

// Check that no overlapping confirmed/checked-in booking exists for the room.
// This is the primary overlap guard (the unique index only catches exact date matches).
const checkRoomAvailability = async (
    roomId: Types.ObjectId,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: Types.ObjectId
): Promise<void> => {
    const query: mongoose.FilterQuery<IBooking> = {
        room: roomId,
        isDeleted: false,
        status: {$in: [BookingStatus.Confirmed, BookingStatus.CheckedIn]},
        checkInDate: {$lt: checkOutDate},
        checkOutDate: {$gt: checkInDate},
    };
    if (excludeBookingId) {
        query._id = {$ne: excludeBookingId};
    }
    const existingBooking = await Booking.findOne(query).lean();
    if (existingBooking) {
        throw new ConflictError('This room is not available for the selected dates.');
    }
};

// Sync a room's operational status based on a booking status transition.
const syncRoomStatus = async (roomId: Types.ObjectId, newBookingStatus: BookingStatus, session?: mongoose.ClientSession): Promise<void> => {
    const room = await Room.findById(roomId).session(session ?? null);
    if (!room) return;
    if (newBookingStatus === BookingStatus.CheckedIn) {
        room.status = RoomStatus.Occupied;
    } else if (newBookingStatus === BookingStatus.CheckedOut || newBookingStatus === BookingStatus.Cancelled || newBookingStatus === BookingStatus.NoShow) {
        room.status = RoomStatus.Cleaning;
    }
    await room.save({ session });
};

export const createBooking = async (data: BookingCreationData, requestingUser: IUserPayload): Promise<IBooking> => {
    const {hotelId, roomId, checkInDate, checkOutDate, numberOfGuests} = data;
    validateObjectId(hotelId, 'hotelId');
    validateObjectId(roomId, 'roomId');
    const hotel = await Hotel.findOne({_id: hotelId, isDeleted: false});
    if (!hotel) throw new NotFoundError(`Hotel with ID ${hotelId} not found or is inactive.`);
    const room = await Room.findOne({_id: roomId, isDeleted: false}).populate<{ roomType: IRoomType }>('roomType');
    if (!room) throw new NotFoundError(`Room with ID ${roomId} not found or is inactive.`);
    if (room.roomType instanceof mongoose.Types.ObjectId || !room.roomType) throw new AppError('Server Error: Room Type information could not be loaded.', 500);
    const roomType = room.roomType as IRoomType;
    const maxCapacity = room.capacity || roomType.maxCapacity || roomType.defaultCapacity;
    if (numberOfGuests > maxCapacity) throw new BadRequestError(`Number of guests (${numberOfGuests}) exceeds room capacity of ${maxCapacity}.`);
    await checkRoomAvailability(room._id as Types.ObjectId, checkInDate, checkOutDate);
    const pricePerNight = room.pricePerNight || roomType.basePrice;
    if (typeof pricePerNight !== 'number') throw new AppError('Could not determine price for the room.', 500);
    const totalPrice = computeNights(checkInDate, checkOutDate) * pricePerNight;
    const newBooking = new Booking({
        hotel: hotelId,
        room: roomId,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        specialRequests: data.specialRequests,
        user: requestingUser.id,
        totalPrice,
        status: BookingStatus.Confirmed,
        createdBy: requestingUser.id,
        isDeleted: false,
    });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await newBooking.save({ session });
        await session.commitTransaction();
        return newBooking;
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw new ConflictError('This room is not available for the selected dates.');
        throw new AppError('Failed to create booking.', 500);
    } finally {
        session.endSession();
    }
};

export const getBookingDetails = async (bookingId: string, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const booking = await Booking.findOne({_id: bookingId, isDeleted: false}).populate('hotel').populate('room');
    if (!booking) throw new NotFoundError('Booking not found.');
    if (booking.hotel instanceof mongoose.Types.ObjectId || !booking.hotel) throw new AppError('Server Error: Hotel information could not be loaded for this booking.', 500);
    const hotel = booking.hotel as IHotel;
    const isCustomer = requestingUser.role === Role.Customer && booking.user.toString() === requestingUser.id;
    const isHotelStaff = (requestingUser.role === Role.Staff || requestingUser.role === Role.HotelAdmin) && hotel._id.toString() === requestingUser.hotel;
    if (!isCustomer && !isHotelStaff) throw new ForbiddenError('You do not have permission to view this booking.');
    return booking;
};

export const listUserBookings = async (userId: string, options: ListBookingOptions): Promise<any> => {
    validateObjectId(userId, 'userId');
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;
    const filterQuery: mongoose.FilterQuery<IBooking> = {user: userId, isDeleted: false};
    if (options.status) filterQuery.status = options.status;
    const sortOptions = buildSortOptions(options.sortBy, options.sortOrder);
    const [bookings, totalBookings] = await Promise.all([
        Booking.find(filterQuery).sort(sortOptions).skip(skip).limit(limit).populate('hotel', 'name images').lean(),
        Booking.countDocuments(filterQuery)
    ]);
    const totalPages = Math.ceil(totalBookings / limit);
    return {bookings, currentPage: page, totalPages, totalBookings, limit};
};

export const createBookingOnBehalf = async (data: StaffBookingCreationData, staffUser: IUserPayload): Promise<IBooking> => {
    const {hotelId, roomId, checkInDate, checkOutDate, numberOfGuests, customerId} = data;
    validateObjectId(hotelId, 'hotelId');
    validateObjectId(roomId, 'roomId');
    validateObjectId(customerId, 'customerId');
    if (staffUser.hotel !== hotelId.toString()) throw new ForbiddenError('You can only create bookings for the hotel you are assigned to.');
    const customer = await User.findOne({_id: customerId, isDeleted: false});
    if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);
    const hotel = await Hotel.findOne({_id: hotelId, isDeleted: false});
    if (!hotel) throw new NotFoundError(`Hotel with ID ${hotelId} not found or is inactive.`);
    const room = await Room.findOne({_id: roomId, isDeleted: false}).populate<{ roomType: IRoomType }>('roomType');
    if (!room) throw new NotFoundError(`Room with ID ${roomId} not found or is inactive.`);
    if (room.roomType instanceof mongoose.Types.ObjectId || !room.roomType) throw new AppError('Server Error: Room Type information could not be loaded.', 500);
    const roomType = room.roomType as IRoomType;
    const maxCapacity = room.capacity || roomType.maxCapacity || roomType.defaultCapacity;
    if (numberOfGuests > maxCapacity) throw new BadRequestError(`Number of guests (${numberOfGuests}) exceeds room capacity of ${maxCapacity}.`);
    await checkRoomAvailability(room._id as Types.ObjectId, checkInDate, checkOutDate);
    const pricePerNight = room.pricePerNight || roomType.basePrice;
    if (typeof pricePerNight !== 'number') throw new AppError('Could not determine price for the room.', 500);
    const totalPrice = computeNights(checkInDate, checkOutDate) * pricePerNight;
    const newBooking = new Booking({
        hotel: hotelId,
        room: roomId,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        specialRequests: data.specialRequests,
        user: customerId,
        createdBy: staffUser.id,
        totalPrice,
        status: BookingStatus.Confirmed,
        isDeleted: false,
    });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await newBooking.save({ session });
        await session.commitTransaction();
        return newBooking;
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw new ConflictError('This room is not available for the selected dates.');
        throw new AppError('Failed to create booking.', 500);
    } finally {
        session.endSession();
    }
};

// --- UPDATED AND NEW FUNCTIONS START HERE ---

export const listHotelBookings = async (hotelId: string, requestingUser: IUserPayload, options: ListBookingOptions): Promise<any> => {
    validateObjectId(hotelId, 'hotelId');
    if (requestingUser.hotel !== hotelId) throw new ForbiddenError('You are not authorized to view bookings for this hotel.');
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;
    const filterQuery: mongoose.FilterQuery<IBooking> = {hotel: hotelId, isDeleted: false};
    if (options.status) filterQuery.status = options.status;
    const sortOptions = buildSortOptions(options.sortBy, options.sortOrder);
    const [bookings, totalBookings] = await Promise.all([
        Booking.find(filterQuery).sort(sortOptions).skip(skip).limit(limit).populate('user', 'firstName lastName email').populate('room', 'roomNumber').lean(),
        Booking.countDocuments(filterQuery)
    ]);
    const totalPages = Math.ceil(totalBookings / limit);
    return {bookings, currentPage: page, totalPages, totalBookings, limit};
};

export const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findOne({_id: bookingId, isDeleted: false}).session(session);
        if (!booking) throw new NotFoundError('Booking not found.');
        if (requestingUser.hotel !== booking.hotel.toString()) throw new ForbiddenError('You are not authorized to update this booking.');

        // Enforce the status state machine.
        const allowed = VALID_TRANSITIONS[booking.status] || [];
        if (!allowed.includes(newStatus)) {
            throw new BadRequestError(`Cannot transition booking from '${booking.status}' to '${newStatus}'.`);
        }

        booking.status = newStatus;
        await booking.save({ session });

        // Sync the room's operational status with the booking transition.
        await syncRoomStatus(booking.room as Types.ObjectId, newStatus, session);

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const updateBookingDetails = async (bookingId: string, updateData: BookingUpdateData, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Populate room AND roomType so price recalculation has basePrice available.
        const booking = await Booking.findOne({_id: bookingId, isDeleted: false})
            .populate<{ room: IRoom & { roomType: IRoomType } }>({ path: 'room', populate: { path: 'roomType' } })
            .session(session);
        if (!booking) throw new NotFoundError('Booking not found.');
        if (requestingUser.hotel !== booking.hotel.toString()) throw new ForbiddenError('You do not have permission to update this booking.');

        const checkInDate = updateData.checkInDate || booking.checkInDate;
        const checkOutDate = updateData.checkOutDate || booking.checkOutDate;

        if (updateData.checkInDate || updateData.checkOutDate) {
            await checkRoomAvailability(booking.room._id as Types.ObjectId, checkInDate, checkOutDate, booking._id);
        }

        Object.assign(booking, updateData);

        // Recalculate price if dates changed — now roomType is populated so basePrice is available.
        if (updateData.checkInDate || updateData.checkOutDate) {
            const room = booking.room as IRoom & { roomType: IRoomType };
            const pricePerNight = room.pricePerNight ?? room.roomType?.basePrice;
            if (typeof pricePerNight !== 'number') throw new AppError('Could not determine price for the room.', 500);
            booking.totalPrice = computeNights(checkInDate, checkOutDate) * pricePerNight;
        }

        await booking.save({ session });
        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const cancelBooking = async (bookingId: string, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findOne({_id: bookingId, isDeleted: false}).session(session);
        if (!booking) throw new NotFoundError('Booking not found.');

        const isCustomer = requestingUser.role === Role.Customer && booking.user.toString() === requestingUser.id;
        const isHotelStaff = (requestingUser.role === Role.Staff || requestingUser.role === Role.HotelAdmin) && booking.hotel.toString() === requestingUser.hotel;

        if (!isCustomer && !isHotelStaff) throw new ForbiddenError('You do not have permission to cancel this booking.');

        // Enforce the state machine for cancellation.
        const allowed = VALID_TRANSITIONS[booking.status] || [];
        if (!allowed.includes(BookingStatus.Cancelled)) {
            throw new BadRequestError(`Cannot cancel a booking with status '${booking.status}'.`);
        }

        booking.status = BookingStatus.Cancelled;
        await booking.save({ session });

        // Free up the room (set to cleaning) on cancellation.
        await syncRoomStatus(booking.room as Types.ObjectId, BookingStatus.Cancelled, session);

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};