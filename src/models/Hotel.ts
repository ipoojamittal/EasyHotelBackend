import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IHotel extends Document {
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
    amenities: string[];
    images: string[];
    checkInTime: string;
    checkOutTime: string;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
    mapsUrl?: {
        googleMaps?: string;
        appleMaps?: string;
    };
    isDeleted: boolean;
    createdBy: mongoose.Types.ObjectId | IUser;
    createdAt: Date;
    updatedAt: Date;
    _id: mongoose.Types.ObjectId;
}

const HotelSchema: Schema<IHotel> = new Schema<IHotel>(
    {
        name: {
            type: String,
            required: [true, 'Hotel name is required'],
            trim: true,
        },
        address: {
            type: {
                street: { type: String, required: [true, 'Street address is required'], trim: true },
                city: { type: String, required: [true, 'City is required'], trim: true },
                state: { type: String, required: [true, 'State is required'], trim: true },
                zipCode: { type: String, required: [true, 'Zip code is required'], trim: true },
                country: { type: String, required: [true, 'Country is required'], trim: true },
            },
            required: [true, 'Full address information is required'],
            _id: false
        },
        phoneNumber: [{
            type: String,
            trim: true
        }],
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/.+@.+\..+/, 'Please provide a valid email address'],
            sparse: true,
            index: { unique: true, sparse: true },
        },
        description: {
            type: String,
            trim: true
        },
        amenities: [{
            type: String,
            trim: true
        }],
        images: [{
            type: String,
            trim: true
        }],
        checkInTime: {
            type: String,
            required: true,
            default: '12:00'
        },
        checkOutTime: {
            type: String,
            required: true,
            default: '11:00'
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: false
            },
            coordinates: {
                type: [Number],
                required: function(this: IHotel) {
                    return !!this.location && this.location.type === 'Point';
                },
                index: '2dsphere'
            }
        },
        mapsUrl: {
            type: {
                googleMaps: { type: String, trim: true },
                appleMaps: { type: String, trim: true }
            },
            required: false,
            _id: false
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Hotel must be associated with a creator user.'],
            index: true
        },
    },
    {
        timestamps: true,
    }
);

// Index for finding active (non-deleted) hotels by city/country efficiently
HotelSchema.index({ isDeleted: 1, 'address.city': 1 });
HotelSchema.index({ isDeleted: 1, 'address.country': 1 });

const Hotel = mongoose.model<IHotel>('Hotel', HotelSchema);
export default Hotel;
