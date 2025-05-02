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
    isActive: boolean;
    createdBy: mongoose.Types.ObjectId | IUser;
    createdAt: Date;
    updatedAt: Date;
}

const HotelSchema: Schema<IHotel> = new Schema<IHotel>(
    {
        name: {
            type: String,
            required: [true, 'Hotel name is required'],
            trim: true,
        },

        address: {
            street: { type: String, required: true, trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            zipCode: { type: String, required: true, trim: true },
            country: { type: String, required: true, trim: true },
            required: true
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
            type: { type: String, enum: ['Point'], required: false }, // Optional field, so not required overall
            coordinates: { type: [Number], required: function(this: IHotel) { return !!this.location?.type; } } // Required only if location type is set
        },

        mapsUrl: {
            type: {
                googleMaps: { type: String, trim: true },
                appleMaps: { type: String, trim: true }
            },
            required: false,
            _id: false
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
    },
    {
        timestamps: true,
    }
);

const Hotel = mongoose.model<IHotel>('Hotel', HotelSchema);
export default Hotel;