// src/scripts/seedAll.ts
//
// Comprehensive database seed — creates a full demo dataset:
//   1 SuperAdmin
//   1 HotelAdmin (linked to the hotel)
//   1 Staff member (linked to the hotel)
//   3 Customers
//   1 Hotel (The Grand Meridian)
//   3 Room Types (Deluxe King, Executive Twin, Presidential Suite)
//   8 Rooms across the room types with varied statuses
//   5 Bookings across various statuses (pending, confirmed, checked-in,
//     checked-out, cancelled)
//
// Usage:
//   npx ts-node src/scripts/seedAll.ts
//
// Safe to re-run: uses upsert by email/roomNumber so it won't duplicate.
// Wipes existing data first (except it preserves nothing — this is a
// clean re-seed for development).

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

import connectDB from '../config/db';
import User, { Role } from '../models/User';
import Hotel from '../models/Hotel';
import RoomType from '../models/RoomType';
import Room, { RoomStatus } from '../models/Room';
import Booking, { BookingStatus } from '../models/Booking';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PASSWORD = 'Password123!'; // same for all seeded users

async function hashPassword(): Promise<string> {
  return bcrypt.hash(PASSWORD, 10);
}

async function seedAll() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Database connected.\n');

  // --- Clean slate (development only) ---
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Hotel.deleteMany({}),
    RoomType.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
  ]);
  console.log('Cleared.\n');

  const passwordHash = await hashPassword();

  // --- 1. Users ---
  console.log('Creating users...');

  const superAdmin = await User.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@test.com',
    phoneNumber: '+1234567890',
    passwordHash: PASSWORD, // pre-save hook hashes it
    role: Role.SuperAdmin,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
  });

  // We need a hotel first to link hotelAdmin/staff, but Hotel requires
  // a createdBy user. So we create the hotelAdmin first without a hotel,
  // then create the hotel with that admin as createdBy, then update the
  // admin's hotel reference.

  const hotelAdmin = await User.create({
    firstName: 'Isabella',
    lastName: 'Romero',
    email: 'hotel.admin@test.com',
    phoneNumber: '+15550001001',
    passwordHash: PASSWORD,
    role: Role.HotelAdmin,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
    // hotel set after hotel creation
  });

  const staff = await User.create({
    firstName: 'Marcus',
    lastName: 'Chen',
    email: 'staff@test.com',
    phoneNumber: '+15550001002',
    passwordHash: PASSWORD,
    role: Role.Staff,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
    // hotel set after hotel creation
  });

  const customer1 = await User.create({
    firstName: 'Olivia',
    lastName: 'Hayes',
    email: 'olivia.hayes@test.com',
    phoneNumber: '+15550002001',
    passwordHash: PASSWORD,
    role: Role.Customer,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
  });

  const customer2 = await User.create({
    firstName: 'James',
    lastName: 'Patel',
    email: 'james.patel@test.com',
    phoneNumber: '+15550002002',
    passwordHash: PASSWORD,
    role: Role.Customer,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
  });

  const customer3 = await User.create({
    firstName: 'Sofia',
    lastName: 'Lindqvist',
    email: 'sofia.l@test.com',
    phoneNumber: '+15550002003',
    passwordHash: PASSWORD,
    role: Role.Customer,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
  });

  console.log(
    `  Created: ${superAdmin.email} (superAdmin), ${hotelAdmin.email} (hotelAdmin), ${staff.email} (staff), 3 customers\n`
  );

  // --- 2. Hotel ---
  console.log('Creating hotel...');

  const hotel = await Hotel.create({
    name: 'The Grand Meridian',
    address: {
      street: '1 Harbor Way',
      city: 'Lisbon',
      state: 'Lisboa',
      zipCode: '1100-000',
      country: 'Portugal',
    },
    phoneNumber: ['+351 210 000 000'],
    email: 'stay@grandmeridian.com',
    description:
      'A waterfront sanctuary blending Iberian charm with modern luxury. Rooftop infinity pool, Michelin-starred dining, and panoramic Tagus views.',
    amenities: [
      'Rooftop pool',
      'Spa',
      'Fitness center',
      'Restaurant',
      'Bar',
      'Concierge',
      'Valet parking',
      'Pet-friendly',
    ],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200',
      'https://images.unsplash.com/photo-1520250497591-1127cb32a076?w=1200',
    ],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    mapsUrl: {
      googleMaps: 'https://maps.app.goo.gl/example',
    },
    isActive: true,
    createdBy: hotelAdmin._id,
  });

  // Link hotelAdmin and staff to the hotel
  hotelAdmin.hotel = hotel._id;
  await hotelAdmin.save();
  staff.hotel = hotel._id;
  await staff.save();

  console.log(`  Created: ${hotel.name} (${hotel._id})\n`);

  // --- 3. Room Types ---
  console.log('Creating room types...');

  const deluxeKing = await RoomType.create({
    hotel: hotel._id,
    name: 'Deluxe King',
    typeCode: 'DLX-K',
    description:
      'A spacious king room with city views, plush bedding, and a marble bathroom.',
    basePrice: 180,
    defaultCapacity: 2,
    maxCapacity: 3,
    amenities: ['King bed', 'City view', 'Minibar', 'Smart TV', 'Coffee machine'],
    images: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200',
    ],
    bedConfiguration: '1 King bed',
    viewType: 'City view',
    size: { value: 35, unit: 'sqm' },
    tags: ['popular', 'couples'],
    sortOrder: 1,
    isActive: true,
  });

  const executiveTwin = await RoomType.create({
    hotel: hotel._id,
    name: 'Executive Twin',
    typeCode: 'EXE-T',
    description:
      'Two twin beds with a work desk and harbor views — ideal for business travelers.',
    basePrice: 220,
    defaultCapacity: 2,
    maxCapacity: 2,
    amenities: ['Twin beds', 'Harbor view', 'Work desk', 'Smart TV', 'Espresso machine'],
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200',
    ],
    bedConfiguration: '2 Twin beds',
    viewType: 'Harbor view',
    size: { value: 40, unit: 'sqm' },
    tags: ['business'],
    sortOrder: 2,
    isActive: true,
  });

  const presidentialSuite = await RoomType.create({
    hotel: hotel._id,
    name: 'Presidential Suite',
    typeCode: 'PRS-S',
    description:
      'The crown jewel — a two-bedroom suite with private terrace, butler service, and 270° river views.',
    basePrice: 650,
    defaultCapacity: 2,
    maxCapacity: 4,
    amenities: [
      'Private terrace',
      'Butler service',
      'River view',
      'Jacuzzi',
      'Walk-in closet',
      'Nespresso',
      'Smart TV',
      'Pillow menu',
    ],
    images: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200',
    ],
    bedConfiguration: '1 King + 1 Queen (separate bedroom)',
    viewType: 'River view',
    size: { value: 90, unit: 'sqm' },
    tags: ['luxury', 'suite'],
    sortOrder: 3,
    isActive: true,
  });

  console.log(`  Created: ${deluxeKing.name}, ${executiveTwin.name}, ${presidentialSuite.name}\n`);

  // --- 4. Rooms ---
  console.log('Creating rooms...');

  const rooms = await Room.create([
    // Deluxe King rooms (101-103)
    {
      hotel: hotel._id,
      roomNumber: '101',
      roomType: deluxeKing._id,
      status: RoomStatus.Available,
      createdBy: hotelAdmin._id,
    },
    {
      hotel: hotel._id,
      roomNumber: '102',
      roomType: deluxeKing._id,
      status: RoomStatus.Occupied,
      createdBy: hotelAdmin._id,
    },
    {
      hotel: hotel._id,
      roomNumber: '103',
      roomType: deluxeKing._id,
      status: RoomStatus.Cleaning,
      createdBy: hotelAdmin._id,
    },
    // Executive Twin rooms (201-203)
    {
      hotel: hotel._id,
      roomNumber: '201',
      roomType: executiveTwin._id,
      status: RoomStatus.Available,
      createdBy: hotelAdmin._id,
    },
    {
      hotel: hotel._id,
      roomNumber: '202',
      roomType: executiveTwin._id,
      status: RoomStatus.Occupied,
      createdBy: hotelAdmin._id,
    },
    {
      hotel: hotel._id,
      roomNumber: '203',
      roomType: executiveTwin._id,
      status: RoomStatus.Available,
      createdBy: hotelAdmin._id,
    },
    // Presidential Suite (301)
    {
      hotel: hotel._id,
      roomNumber: '301',
      roomType: presidentialSuite._id,
      status: RoomStatus.Available,
      createdBy: hotelAdmin._id,
    },
    // One out-of-service room
    {
      hotel: hotel._id,
      roomNumber: '104',
      roomType: deluxeKing._id,
      status: RoomStatus.OutOfService,
      createdBy: hotelAdmin._id,
    },
  ]);

  console.log(`  Created: ${rooms.length} rooms (101-104, 201-203, 301)\n`);

  // --- 5. Bookings ---
  console.log('Creating bookings...');

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function dateOnly(daysFromToday: number): Date {
    return new Date(addDays(today, daysFromToday).toISOString().slice(0, 10));
  }

  const room101 = rooms.find((r) => r.roomNumber === '101')!;
  const room102 = rooms.find((r) => r.roomNumber === '102')!;
  const room201 = rooms.find((r) => r.roomNumber === '201')!;
  const room202 = rooms.find((r) => r.roomNumber === '202')!;
  const room301 = rooms.find((r) => r.roomNumber === '301')!;

  const bookings = await Booking.create([
    // Pending — future booking by Olivia
    {
      user: customer1._id,
      hotel: hotel._id,
      room: room101._id,
      checkInDate: dateOnly(7),
      checkOutDate: dateOnly(10),
      numberOfGuests: 2,
      totalPrice: 180 * 3, // 3 nights @ $180
      status: BookingStatus.Pending,
      specialRequests: 'Late check-in, around 9pm. Possible early check-in?',
      createdBy: customer1._id,
    },
    // Confirmed — upcoming by James
    {
      user: customer2._id,
      hotel: hotel._id,
      room: room201._id,
      checkInDate: dateOnly(3),
      checkOutDate: dateOnly(5),
      numberOfGuests: 1,
      totalPrice: 220 * 2, // 2 nights @ $220
      status: BookingStatus.Confirmed,
      specialRequests: 'Need a quiet room for meetings.',
      createdBy: customer2._id,
    },
    // Checked-in — currently staying, Sofia in room 102
    {
      user: customer3._id,
      hotel: hotel._id,
      room: room102._id,
      checkInDate: dateOnly(-1), // checked in yesterday
      checkOutDate: dateOnly(2), // checking out in 2 days
      numberOfGuests: 2,
      totalPrice: 180 * 3,
      status: BookingStatus.CheckedIn,
      specialRequests: 'Anniversary trip — champagne surprise please!',
      createdBy: customer3._id,
    },
    // Checked-out — past stay by Olivia
    {
      user: customer1._id,
      hotel: hotel._id,
      room: room202._id,
      checkInDate: dateOnly(-10),
      checkOutDate: dateOnly(-7),
      numberOfGuests: 2,
      totalPrice: 220 * 3,
      status: BookingStatus.CheckedOut,
      createdBy: customer1._id,
    },
    // Cancelled — by James
    {
      user: customer2._id,
      hotel: hotel._id,
      room: room301._id,
      checkInDate: dateOnly(-5),
      checkOutDate: dateOnly(-3),
      numberOfGuests: 4,
      totalPrice: 650 * 2,
      status: BookingStatus.Cancelled,
      specialRequests: 'Had to cancel due to flight changes.',
      createdBy: customer2._id,
    },
  ]);

  console.log(`  Created: ${bookings.length} bookings (pending, confirmed, checked-in, checked-out, cancelled)\n`);

  // --- Summary ---
  console.log('════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE — Demo dataset created');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Login credentials (password for all: Password123!)');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  SuperAdmin:   admin@test.com');
  console.log('  HotelAdmin:   hotel.admin@test.com');
  console.log('  Staff:        staff@test.com');
  console.log('  Customer:     olivia.hayes@test.com');
  console.log('  Customer:     james.patel@test.com');
  console.log('  Customer:     sofia.l@test.com');
  console.log('');
  console.log('  Hotel:        The Grand Meridian (Lisbon)');
  console.log('  Room types:   Deluxe King, Executive Twin, Presidential Suite');
  console.log('  Rooms:        8 (101-104, 201-203, 301)');
  console.log('  Bookings:     5 (pending, confirmed, checked-in, checked-out, cancelled)');
  console.log('════════════════════════════════════════════════════════════');

  await mongoose.disconnect();
  console.log('\nDatabase disconnected. Done.');
}

seedAll().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
