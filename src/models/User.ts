// src/models/User.ts
import mongoose, {Document, Schema} from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import dotenv from 'dotenv';
import fieldEncryption from 'mongoose-field-encryption';


dotenv.config();

const filename = path.basename(__filename);

const encryptionKey = process.env.MONGOOSE_ENCRYPTION_KEY;
const encryptionSalt = process.env.MONGOOSE_ENCRYPTION_SALT;

if (!encryptionKey || encryptionKey.length !== 64) {
    console.error(`${filename}/config : FATAL ERROR: MONGOOSE_ENCRYPTION_KEY is not defined in .env file or is not a 64-character hex string (32 bytes).`);
    process.exit(1);
}
if (!encryptionSalt) {
    console.warn(`${filename}/config : WARNING: MONGOOSE_ENCRYPTION_SALT is not defined in .env file. Using a default may be less secure.`);
    process.exit(1);
}

// --- Define User Roles ---
export enum Role {
    Customer = 'customer',
    Staff = 'staff',
    HotelAdmin = 'hotelAdmin',
    SuperAdmin = 'superAdmin', // <<< Added SuperAdmin Role
}

// --- User Interface ---
export interface IUser extends Document {
    firstName: string;
    lastName: string;
    role: Role;
    email?: string;
    phoneNumber?: string;
    passwordHash: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isDeleted: boolean;
    hotel?: mongoose.Types.ObjectId | undefined; // Should NOT be present for SuperAdmin
    identityUrls: string[];

    comparePassword(candidatePassword: string): Promise<boolean>;

    createdAt: Date;
    updatedAt: Date;
}

// --- User Schema ---
const UserSchema: Schema<IUser> = new Schema<IUser>(
    {
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
            match: [/.+@.+\..+/, 'Please provide a valid email address'],
            index: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            sparse: true,
            index: true,
        },
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
        },
        role: {
            type: String,
            enum: Object.values(Role), // Use the enum values for validation
            required: [true, 'User role is required'],
            index: true,
        },
        hotel: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            // Hotel is required ONLY for Staff and HotelAdmin
            validate: {
                validator: function(this: IUser, value: any): boolean {
                    // Allow undefined/null if role is Customer or SuperAdmin
                    if (this.role === Role.Customer || this.role === Role.SuperAdmin) {
                        return value === undefined || value === null;
                    }
                    // Otherwise (Staff/HotelAdmin), it must be required (handled by 'required' above)
                    // This validator mainly prevents setting it for Customer/SuperAdmin
                    return true;
                },
                message: 'Hotel association is not applicable for Customer or SuperAdmin roles.'
            },
            index: true
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isPhoneVerified: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        identityUrls: {
            type: [String],
            required: false,
            default: [],
        },
    },
    {
        timestamps: true,
    }
);


// --- Apply Encryption Plugin ---
UserSchema.plugin(fieldEncryption.fieldEncryption, {
    fields: ['identityUrls'],
    secret: encryptionKey,
    salt: encryptionSalt,
});

// --- Middleware and Methods ---
UserSchema.pre<IUser>('save', async function (next) {
    const hookName = 'preSaveUser';
    if (this.role === Role.SuperAdmin) {
        this.hotel = undefined;
    }
    if (!this.isModified('passwordHash')) {
        return next();
    }
    try {
        const plainPassword = this.passwordHash;
        const saltRounds = 10;
        this.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
        next();
    } catch (err: any) {
        console.error(`${filename}/${hookName} : Error hashing password for user ${this.email}: ${err.message}`);
        next(err);
    }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    const methodName = 'comparePassword';
    try {
        return await bcrypt.compare(candidatePassword, this.passwordHash);
    } catch (error: any) {
        console.error(`${filename}/${methodName} : Error comparing password for user ${this.email}: ${error.message}`);
        return false;
    }
};

// --- Model Export ---
// Compound indexes for efficient lookup of active (non-deleted) users by unique fields
UserSchema.index({ email: 1, isDeleted: 1 });
UserSchema.index({ phoneNumber: 1, isDeleted: 1 });

const User = mongoose.model<IUser>('User', UserSchema);

export default User;
