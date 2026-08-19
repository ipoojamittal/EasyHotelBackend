// src/scripts/seedSuperAdmin.ts
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path'; // Import path to resolve .env correctly
import connectDB from '../config/db'; // Adjust path if your db connection is elsewhere
import User, { Role } from '../models/User'; // Adjust path to your User model

// Load environment variables from the root .env file
// Ensures the script finds the .env file when run from the project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedSuperAdmin = async () => {
    console.log('Attempting to connect to database...');
    await connectDB(); // Connect to the database
    console.log('Database connection established.');

    // --- Configuration ---
    // It's highly recommended to set these in your .env file for security
    const email = process.env.SUPER_ADMIN_EMAIL || "admin@test.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "admin123";
    const firstName = process.env.SUPER_ADMIN_FIRSTNAME || 'Super'; // Provide defaults
    const lastName = process.env.SUPER_ADMIN_LASTNAME || 'Admin'; // Provide defaults
    const phoneNumber = process.env.SUPER_ADMIN_PHONE || '+1234567890'; // Provide defaults

    // --- Validation ---
    if (!email) {
        console.error('Error: SUPER_ADMIN_EMAIL not found in .env file.');
        await mongoose.disconnect();
        process.exit(1);
    }
    if (!password) {
        console.error('Error: SUPER_ADMIN_PASSWORD not found in .env file.');
        await mongoose.disconnect();
        process.exit(1);
    }
    if (!phoneNumber) {
        console.error('Error: SUPER_ADMIN_PHONE not found in .env file.');
        await mongoose.disconnect();
        process.exit(1);
    }
    // Basic validation for phone number format (optional, adjust as needed)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // Example E.164 format check
    if (!phoneRegex.test(phoneNumber)) {
        console.warn(`Warning: SUPER_ADMIN_PHONE format (${phoneNumber}) might be invalid. Proceeding anyway.`);
    }

    console.log(`Attempting to seed SuperAdmin with email: ${email}`);

    try {
        // Check if SuperAdmin already exists
        const existingAdmin = await User.findOne({ email: email.toLowerCase(), role: Role.SuperAdmin });
        if (existingAdmin) {
            console.log(`SuperAdmin user with email ${email} already exists.`);
            return; // Exit successfully if admin already exists
        }

        console.log('SuperAdmin does not exist, creating new one...');

        // Hash the password
        const saltRounds = 10; // Standard number of salt rounds
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log('Password hashed successfully.');

        // Create the SuperAdmin user instance
        const superAdmin = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phoneNumber,
            passwordHash: hashedPassword, // Store the hashed password
            role: Role.SuperAdmin,
            isEmailVerified: true, // Assume verified for initial seeding
            isPhoneVerified: true, // Assume verified for initial seeding
            isDeleted: false,
            hotel: undefined // Explicitly ensure no hotel is associated
        });

        // Save the new user to the database
        await superAdmin.save();
        console.log(`SuperAdmin user '${superAdmin.email}' created successfully!`);

    } catch (error: any) {
        // Log detailed error information
        console.error('Error seeding SuperAdmin user:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exitCode = 1; // Indicate failure
    } finally {
        // Ensure database connection is closed
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
};

// Execute the seeding function
seedSuperAdmin();
