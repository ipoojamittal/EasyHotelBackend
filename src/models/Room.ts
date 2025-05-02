import mongoose, { Document, Schema, Types } from 'mongoose';
import { IHotel } from './Hotel';
import { IUser } from './User';
import { IRoomType } from './RoomType';

interface IRoomSize {
    value: number;
    unit: 'sqm' | 'sqft';
}

export enum RoomStatus {
    Available = 'available',
    Occupied = 'occupied',
    Cleaning = 'cleaning',
    OutOfService = 'out_of_service',
}

export interface IRoom extends Document {
    hotel: Types.ObjectId | IHotel;
    roomNumber: string;
    roomType: Types.ObjectId | IRoomType;

    description?: string;
    capacity?: number;
    pricePerNight?: number;
    amenities?: string[];
    images?: string[];
    viewTypeOverride?: string;
    sizeOverride?: IRoomSize;

    // --- Operational Status ---
    status: RoomStatus;
    isDeleted: boolean;

    // --- Optional Tracking ---
    createdBy?: Types.ObjectId | IUser;
    updatedBy?: Types.ObjectId | IUser;
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema: Schema<IRoom> = new Schema<IRoom>(
    {
        hotel: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'Room must belong to a specific hotel.'],
            index: true,
        },
        roomNumber: {
            type: String,
            required: [true, 'Room number is required.'],
            trim: true,

        },
        roomType: {
            type: Schema.Types.ObjectId,
            ref: 'RoomType',
            required: [true, 'Room must have a defined room type.'],
            index: true,
        },
        description: { // Optional Override
            type: String,
            trim: true,
        },
        capacity: { // Optional Override
            type: Number,
            min: [1, 'Capacity must be at least 1.'],

        },
        pricePerNight: { // Optional Override
            type: Number,
            min: [0, 'Price cannot be negative.'],

        },
        amenities: [{ // Augments RoomType amenities
            type: String,
            trim: true,
        }],
        images: [{ // Augments RoomType images
            type: String, // Expect URLs
            trim: true,
        }],
        viewTypeOverride: { // Optional Override
            type: String,
            trim: true,
        },
        sizeOverride: { // Optional Override
            type: {
                value: { type: Number, required: true, min: 1 },
                unit: { type: String, enum: ['sqm', 'sqft'], required: true }
            },
            required: false,
            _id: false
        },
        status: {
            type: String,
            enum: Object.values(RoomStatus),
            default: RoomStatus.Available,
            required: true,
            index: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        }
    },
    {
        timestamps: true,
    }
);

RoomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

RoomSchema.index({ hotel: 1, status: 1 });
RoomSchema.index({ hotel: 1, roomType: 1 }); // Index on the RoomType reference is still important


// --- Model Export ---
const Room = mongoose.model<IRoom>('Room', RoomSchema);
export default Room;
