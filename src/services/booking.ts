import mongoose, {Types} from 'mongoose';
import Booking, {IBooking, BookingStatus} from '../models/Booking';
import Room, {IRoom} from '../models/Room';
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

const validateObjectId = (id: string | Types.ObjectId, paramName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ${paramName} format.`);
    }
};

const checkRoomAvailability = async (roomId: Types.ObjectId, checkInDate: Date, checkOutDate: Date, excludeBookingId?: Types.ObjectId): Promise<void> => {
    const query: any = {
        room: roomId,
        status: {$in: [BookingStatus.Confirmed, BookingStatus.CheckedIn]},
        $or: [
            {checkInDate: {$lt: checkOutDate}, checkOutDate: {$gt: checkInDate}},
        ],
    };
    if (excludeBookingId) {
        query._id = {$ne: excludeBookingId};
    }
    const existingBooking = await Booking.findOne(query);
    if (existingBooking) {
        throw new ConflictError('This room is not available for the selected dates.');
    }
};

// --- (createBooking, getBookingDetails, listUserBookings, createBookingOnBehalf functions remain the same) ---
export const createBooking = async (data: BookingCreationData, requestingUser: IUserPayload): Promise<IBooking> => {
    const {hotelId, roomId, checkInDate, checkOutDate, numberOfGuests} = data;
    validateObjectId(hotelId, 'hotelId');
    validateObjectId(roomId, 'roomId');
    const hotel = await Hotel.findById(hotelId);
    if (!hotel || !hotel.isActive) throw new NotFoundError(`Hotel with ID ${hotelId} not found or is inactive.`);
    const room = await Room.findById(roomId).populate('roomType');
    if (!room || room.isDeleted) throw new NotFoundError(`Room with ID ${roomId} not found or is inactive.`);
    if (room.roomType instanceof mongoose.Types.ObjectId || !room.roomType) throw new AppError('Server Error: Room Type information could not be loaded.', 500);
    const roomType = room.roomType as IRoomType;
    const maxCapacity = room.capacity || roomType.maxCapacity || roomType.defaultCapacity;
    if (numberOfGuests > maxCapacity) throw new BadRequestError(`Number of guests (${numberOfGuests}) exceeds room capacity of ${maxCapacity}.`);
    await checkRoomAvailability(room._id as Types.ObjectId, checkInDate, checkOutDate);
    const pricePerNight = room.pricePerNight || roomType.basePrice;
    if (typeof pricePerNight !== 'number') throw new AppError('Could not determine price for the room.', 500);
    const durationInMs = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
    const totalPrice = durationInDays * pricePerNight;
    const newBooking = new Booking({
        ...data,
        user: requestingUser.id,
        hotel: hotelId,
        room: roomId,
        totalPrice,
        status: BookingStatus.Confirmed,
        createdBy: requestingUser.id
    });
    try {
        return newBooking.save();
    } catch (error: any) {
        if (error.code === 11000) throw new ConflictError('This room is not available for the selected dates.');
        throw new AppError('Failed to create booking.', 500);
    }
};
export const getBookingDetails = async (bookingId: string, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const booking = await Booking.findById(bookingId).populate('hotel').populate('room');
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
    const {page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'} = options;
    const skip = (page - 1) * limit;
    const filterQuery: mongoose.FilterQuery<IBooking> = {user: userId};
    if (options.status) filterQuery.status = options.status;
    const sortOptions: any = {[sortBy]: sortOrder === 'asc' ? 1 : -1};
    const [bookings, totalBookings] = await Promise.all([Booking.find(filterQuery).sort(sortOptions).skip(skip).limit(limit).populate('hotel', 'name images').lean(), Booking.countDocuments(filterQuery)]);
    const totalPages = Math.ceil(totalBookings / limit);
    return {bookings, currentPage: page, totalPages, totalBookings, limit};
};
export const createBookingOnBehalf = async (data: StaffBookingCreationData, staffUser: IUserPayload): Promise<IBooking> => {
    const {hotelId, roomId, checkInDate, checkOutDate, numberOfGuests, customerId} = data;
    validateObjectId(hotelId, 'hotelId');
    validateObjectId(roomId, 'roomId');
    validateObjectId(customerId, 'customerId');
    if (staffUser.hotel !== hotelId.toString()) throw new ForbiddenError('You can only create bookings for the hotel you are assigned to.');
    const customer = await User.findById(customerId);
    if (!customer || customer.isDeleted) throw new NotFoundError(`Customer with ID ${customerId} not found.`);
    const hotel = await Hotel.findById(hotelId);
    if (!hotel || !hotel.isActive) throw new NotFoundError(`Hotel with ID ${hotelId} not found or is inactive.`);
    const room = await Room.findById(roomId).populate('roomType');
    if (!room || room.isDeleted) throw new NotFoundError(`Room with ID ${roomId} not found or is inactive.`);
    if (room.roomType instanceof mongoose.Types.ObjectId || !room.roomType) throw new AppError('Server Error: Room Type information could not be loaded.', 500);
    const roomType = room.roomType as IRoomType;
    const maxCapacity = room.capacity || roomType.maxCapacity || roomType.defaultCapacity;
    if (numberOfGuests > maxCapacity) throw new BadRequestError(`Number of guests (${numberOfGuests}) exceeds room capacity of ${maxCapacity}.`);
    await checkRoomAvailability(room._id as Types.ObjectId, checkInDate, checkOutDate);
    const pricePerNight = room.pricePerNight || roomType.basePrice;
    if (typeof pricePerNight !== 'number') throw new AppError('Could not determine price for the room.', 500);
    const durationInMs = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
    const totalPrice = durationInDays * pricePerNight;
    const newBooking = new Booking({
        ...data,
        user: customerId,
        createdBy: staffUser.id,
        hotel: hotelId,
        room: roomId,
        totalPrice,
        status: BookingStatus.Confirmed
    });
    try {
        return newBooking.save();
    } catch (error: any) {
        if (error.code === 11000) throw new ConflictError('This room is not available for the selected dates.');
        throw new AppError('Failed to create booking.', 500);
    }
};

// --- UPDATED AND NEW FUNCTIONS START HERE ---

export const listHotelBookings = async (hotelId: string, requestingUser: IUserPayload, options: ListBookingOptions): Promise<any> => {
    validateObjectId(hotelId, 'hotelId');
    if (requestingUser.hotel !== hotelId) throw new ForbiddenError('You are not authorized to view bookings for this hotel.');
    const {page = 1, limit = 10, sortBy = 'checkInDate', sortOrder = 'asc'} = options;
    const skip = (page - 1) * limit;
    const filterQuery: mongoose.FilterQuery<IBooking> = {hotel: hotelId};
    if (options.status) filterQuery.status = options.status;
    const sortOptions: any = {[sortBy]: sortOrder === 'asc' ? 1 : -1};
    const [bookings, totalBookings] = await Promise.all([
        Booking.find(filterQuery).sort(sortOptions).skip(skip).limit(limit).populate('user', 'firstName lastName email').populate('room', 'roomNumber').lean(),
        Booking.countDocuments(filterQuery)
    ]);
    const totalPages = Math.ceil(totalBookings / limit);
    return {bookings, currentPage: page, totalPages, totalBookings, limit};
};

export const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');
    if (requestingUser.hotel !== booking.hotel.toString()) throw new ForbiddenError('You are not authorized to update this booking.');
    if (booking.status === BookingStatus.CheckedOut || booking.status === BookingStatus.Cancelled) {
        throw new BadRequestError(`Cannot change status of a booking that is already ${booking.status}.`);
    }
    booking.status = newStatus;
    return booking.save();
};

export const updateBookingDetails = async (bookingId: string, updateData: BookingUpdateData, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const booking = await Booking.findById(bookingId).populate('room');
    if (!booking) throw new NotFoundError('Booking not found.');
    if (requestingUser.hotel !== booking.hotel.toString()) throw new ForbiddenError('You do not have permission to update this booking.');

    const checkInDate = updateData.checkInDate || booking.checkInDate;
    const checkOutDate = updateData.checkOutDate || booking.checkOutDate;

    if (updateData.checkInDate || updateData.checkOutDate) {
        await checkRoomAvailability(booking.room._id as Types.ObjectId, checkInDate, checkOutDate, booking._id);
    }

    Object.assign(booking, updateData);

    // Recalculate price if dates changed
    if (updateData.checkInDate || updateData.checkOutDate) {
        const room = booking.room as IRoom;
        const roomType = room.roomType as IRoomType;
        const pricePerNight = room.pricePerNight || roomType.basePrice;
        const durationInMs = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        booking.totalPrice = durationInDays * pricePerNight;
    }

    return booking.save();
};

export const cancelBooking = async (bookingId: string, requestingUser: IUserPayload): Promise<IBooking> => {
    validateObjectId(bookingId, 'bookingId');
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found.');

    const isCustomer = requestingUser.role === Role.Customer && booking.user.toString() === requestingUser.id;
    const isHotelStaff = (requestingUser.role === Role.Staff || requestingUser.role === Role.HotelAdmin) && booking.hotel.toString() === requestingUser.hotel;

    if (!isCustomer && !isHotelStaff) throw new ForbiddenError('You do not have permission to cancel this booking.');
    if (booking.status === BookingStatus.CheckedIn || booking.status === BookingStatus.CheckedOut) {
        throw new BadRequestError(`Cannot cancel a booking with status '${booking.status}'.`);
    }

    booking.status = BookingStatus.Cancelled;
    return booking.save();
};