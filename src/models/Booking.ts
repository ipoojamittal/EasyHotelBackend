import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './User';
import { IHotel } from './Hotel';
import { IRoom } from './Room';

export enum BookingStatus {
    Pending = 'pending',       // Awaiting confirmation or payment
    Confirmed = 'confirmed',   // Locked in, room is reserved
    CheckedIn = 'checked-in',  // Guest has arrived and checked in
    CheckedOut = 'checked-out',// Guest has completed their stay
    Cancelled = 'cancelled',   // The booking was cancelled
    NoShow = 'no-show',        // Guest did not arrive
}

export interface IBooking extends Document {
    user: Types.ObjectId | IUser;
    hotel: Types.ObjectId | IHotel;
    room: Types.ObjectId | IRoom;
    checkInDate: Date;
    checkOutDate: Date;
    numberOfGuests: number;
    totalPrice: number;
    status: BookingStatus;
    specialRequests?: string;
    createdBy: Types.ObjectId | IUser;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    _id: Types.ObjectId;
}

const BookingSchema: Schema<IBooking> = new Schema<IBooking>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Booking must be associated with a user.'],
            index: true,
        },
        hotel: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'Booking must be for a specific hotel.'],
            index: true,
        },
        room: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            required: [true, 'Booking must reserve a specific room.'],
            index: true,
        },
        checkInDate: {
            type: Date,
            required: [true, 'Check-in date is required.'],
        },
        checkOutDate: {
            type: Date,
            required: [true, 'Check-out date is required.'],
        },
        numberOfGuests: {
            type: Number,
            required: [true, 'Number of guests is required.'],
            min: [1, 'There must be at least one guest.'],
        },
        totalPrice: {
            type: Number,
            required: [true, 'Total price for the stay is required.'],
            min: [0, 'Total price cannot be negative.'],
        },
        status: {
            type: String,
            enum: Object.values(BookingStatus),
            default: BookingStatus.Pending,
            required: true,
            index: true,
        },
        specialRequests: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// NOTE: A unique index on (room, checkInDate, checkOutDate, status) only prevents
// EXACT date matches, not range overlaps. Overlap prevention is enforced in the
// service layer via checkRoomAvailability() plus a transaction on create/update.
// This index still helps catch exact-duplicate submissions quickly.
BookingSchema.index(
    {
        room: 1,
        checkInDate: 1,
        checkOutDate: 1,
        status: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
            isDeleted: false,
        }
    }
);

// Compound indexes for common query patterns
BookingSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });
BookingSchema.index({ hotel: 1, isDeleted: 1, status: 1, checkInDate: 1 });
BookingSchema.index({ room: 1, isDeleted: 1, status: 1 });


// Validate that checkOutDate is after checkInDate before saving
BookingSchema.pre<IBooking>('save', function (next) {
    if (this.isModified('checkInDate') || this.isModified('checkOutDate')) {
        if (this.checkOutDate <= this.checkInDate) {
            return next(new Error('Check-out date must be after the check-in date.'));
        }
    }
    next();
});


const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export default Booking;