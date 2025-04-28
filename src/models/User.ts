// src/models/User.ts
import mongoose, {Document, Schema} from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import dotenv from 'dotenv';
import fieldEncryption from 'mongoose-field-encryption';


dotenv.config();

// Get the base filename (e.g., "User.ts") to use in logs if needed
const filename = path.basename(__filename);

// --- Configuration for Encryption ---
const encryptionKey = process.env.MONGOOSE_ENCRYPTION_KEY;
const encryptionSalt = process.env.MONGOOSE_ENCRYPTION_SALT;

// Validate that encryption keys are loaded
if (!encryptionKey || encryptionKey.length !== 64) {
    console.error(`${filename}/config : FATAL ERROR: MONGOOSE_ENCRYPTION_KEY is not defined in .env file or is not a 64-character hex string (32 bytes).`);
    process.exit(1);
}
if (!encryptionSalt) {
    console.warn(`${filename}/config : WARNING: MONGOOSE_ENCRYPTION_SALT is not defined in .env file. Using a default may be less secure.`);
    process.exit(1);
}

// --- User Interface ---

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    email?: string; // Optional email
    phoneNumber?: string; // Optional phone number
    passwordHash: string; // Store the hashed password
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isDeleted: boolean; // For soft deletes
    identityUrls: string[]; // Array of strings (will be encrypted)

    // Method signature for comparing password (defined below on the schema)
    comparePassword(candidatePassword: string): Promise<boolean>;

    // Timestamps added by Mongoose option below
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
            required: true, // Make email optional
            unique: true,
            sparse: true, // Necessary for unique constraint on optional fields
            trim: true,
            lowercase: true,
            match: [/.+@.+\..+/, 'Please provide a valid email address'], // Basic email format validation
            index: true, // Index for faster lookup if needed
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
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isPhoneVerified: {
            type: Boolean,
            default: false,
        },
        isDeleted: { // Field for soft delete functionality
            type: Boolean,
            default: false,
            index: true, // Index this field if you frequently query for non-deleted users (e.g., { isDeleted: false })
        },
        identityUrls: { // Field to be encrypted
            type: [String], // Array of strings
            required: false, // Make it optional or required as needed
            default: [],
        },
    },
    {
        timestamps: true, // Automatically manage `createdAt` and `updatedAt` fields
    }
);


// --- Apply Encryption Plugin ---
UserSchema.plugin(fieldEncryption.fieldEncryption, {
    fields: ['identityUrls'], // Specify fields to encrypt
    secret: encryptionKey, // Encryption key from environment variable
    salt: encryptionSalt, // Static salt from environment variable (used in key derivation)
    // ... other options if needed
});


UserSchema.pre<IUser>('save', async function (next) {
    const hookName = 'preSaveUser';
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

const User = mongoose.model<IUser>('User', UserSchema);

export default User;