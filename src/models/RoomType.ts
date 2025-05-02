import mongoose, { Document, Schema, Types } from 'mongoose';
import { IHotel } from './Hotel';

interface IRoomSize {
    value: number;
    unit: 'sqm' | 'sqft';
}

export interface IRoomType extends Document {
    hotel: Types.ObjectId | IHotel;


    name: string;
    typeCode?: string;
    description?: string;
    basePrice: number;
    defaultCapacity: number;
    maxCapacity?: number;

    // --- Features & Configuration ---
    amenities: string[];
    images: string[];
    bedConfiguration?: string;
    viewType?: string;
    size?: IRoomSize;
    tags?: string[];

    // --- Management & Display ---
    sortOrder?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RoomTypeSchema: Schema<IRoomType> = new Schema<IRoomType>(
    {
        hotel: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'Room type must belong to a specific hotel.'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Room type name is required.'],
            trim: true,
        },
        typeCode: { // New
            type: String,
            trim: true,
            uppercase: true, // Conventionally uppercase
            sparse: true, // Allows multiple docs without this field
            // Add unique index per hotel later if strictly needed
        },
        description: {
            type: String,
            trim: true,
        },
        basePrice: {
            type: Number,
            required: [true, 'Base price is required.'],
            min: [0, 'Price cannot be negative.'],
        },
        defaultCapacity: {
            type: Number,
            required: [true, 'Default capacity is required.'],
            min: [1, 'Capacity must be at least 1.'],
        },
        maxCapacity: { // New
            type: Number,
            min: [1, 'Max capacity must be at least 1.'],
            validate: { // Ensure max capacity >= default capacity if both provided
                validator: function(this: IRoomType, value: number): boolean {
                    return value === undefined || this.defaultCapacity === undefined || value >= this.defaultCapacity;
                },
                message: 'Max capacity must be greater than or equal to default capacity.'
            }
        },
        amenities: [{
            type: String,
            trim: true,
        }],
        images: [{
            type: String,
            trim: true,
        }],
        bedConfiguration: {
            type: String,
            trim: true,
        },
        viewType: {
            type: String,
            trim: true,
        },
        size: {
            type: {
                value: { type: Number, required: true, min: 1 },
                unit: { type: String, enum: ['sqm', 'sqft'], required: true }
            },
            required: false,
            _id: false
        },
        tags: [{ // New
            type: String,
            trim: true,
            lowercase: true,
        }],
        sortOrder: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

RoomTypeSchema.index({ hotel: 1, name: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
RoomTypeSchema.index({ hotel: 1, typeCode: 1 }, { unique: true, sparse: true }); // Sparse allows null/missing values

const RoomType = mongoose.model<IRoomType>('RoomType', RoomTypeSchema);
export default RoomType;

