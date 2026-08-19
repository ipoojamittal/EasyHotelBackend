// src/scripts/seedAll.ts
//
// Comprehensive database seed — creates a rich, realistic demo dataset:
//
//   1  SuperAdmin
//   5  HotelAdmins (one per hotel)
//  10  Staff members (2 per hotel)
//  20  Customers
//   5  Hotels (Lisbon, Aspen, Kyoto, Barcelona, New York)
//  ~18 Room Types (3-4 per hotel, tailored to each property)
//  ~60 Rooms (10-15 per hotel, varied statuses)
//  ~40 Bookings (spread across hotels, all statuses, past/present/future)
//
// Usage:
//   npx ts-node src/scripts/seedAll.ts
//
// Wipes ALL existing data first — this is a clean re-seed for development.

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import connectDB from '../config/db';
import User, { Role, IUser } from '../models/User';
import Hotel, { IHotel } from '../models/Hotel';
import RoomType, { IRoomType } from '../models/RoomType';
import Room, { RoomStatus, IRoom } from '../models/Room';
import Booking, { BookingStatus } from '../models/Booking';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PASSWORD = 'Password123!'; // same for all seeded users

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateOnly(daysFromToday: number): Date {
  return addDays(TODAY, daysFromToday);
}

function nights(checkIn: Date, checkOut: Date): number {
  return Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
}

// ---------------------------------------------------------------------------
// Hotel definitions — each hotel drives the creation of its room types,
// rooms, staff, and bookings.
// ---------------------------------------------------------------------------

interface RoomTypeDef {
  name: string;
  typeCode: string;
  description: string;
  basePrice: number;
  defaultCapacity: number;
  maxCapacity: number;
  amenities: string[];
  images: string[];
  bedConfiguration: string;
  viewType: string;
  size: { value: number; unit: 'sqm' | 'sqft' };
  tags: string[];
  sortOrder: number;
  /** How many room instances of this type to create. */
  roomCount: number;
  /** Starting room number for this type. */
  roomStart: number;
  /** Floor prefix for room numbers (e.g. 1 → 101, 102…). */
  floor: number;
}

interface HotelDef {
  name: string;
  admin: { firstName: string; lastName: string; email: string; phone: string };
  staff: Array<{ firstName: string; lastName: string; email: string; phone: string }>;
  address: { street: string; city: string; state: string; zipCode: string; country: string };
  phoneNumber: string[];
  email: string;
  description: string;
  amenities: string[];
  images: string[];
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomTypeDef[];
}

const HOTEL_DEFS: HotelDef[] = [
  // ─────────────────────────────────────────────────────────────────────
  // 1. The Grand Meridian — Lisbon, Portugal (luxury waterfront)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'The Grand Meridian',
    admin: { firstName: 'Isabella', lastName: 'Romero', email: 'isabella.romero@grandmeridian.com', phone: '+351910000001' },
    staff: [
      { firstName: 'Marcus', lastName: 'Chen', email: 'marcus.chen@grandmeridian.com', phone: '+351910000002' },
      { firstName: 'Ana', lastName: 'Costa', email: 'ana.costa@grandmeridian.com', phone: '+351910000003' },
    ],
    address: { street: '1 Harbor Way', city: 'Lisbon', state: 'Lisboa', zipCode: '1100-000', country: 'Portugal' },
    phoneNumber: ['+351 210 000 000'],
    email: 'stay@grandmeridian.com',
    description:
      'A waterfront sanctuary blending Iberian charm with modern luxury. Rooftop infinity pool, Michelin-starred dining, and panoramic Tagus views.',
    amenities: ['Rooftop pool', 'Spa', 'Fitness center', 'Restaurant', 'Bar', 'Concierge', 'Valet parking', 'Pet-friendly'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200',
      'https://images.unsplash.com/photo-1520250497591-1127cb32a076?w=1200',
    ],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    roomTypes: [
      {
        name: 'Deluxe King',
        typeCode: 'DLX-K',
        description: 'A spacious king room with city views, plush bedding, and a marble bathroom.',
        basePrice: 180, defaultCapacity: 2, maxCapacity: 3,
        amenities: ['King bed', 'City view', 'Minibar', 'Smart TV', 'Coffee machine'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200'],
        bedConfiguration: '1 King bed', viewType: 'City view', size: { value: 35, unit: 'sqm' },
        tags: ['popular', 'couples'], sortOrder: 1, roomCount: 5, roomStart: 1, floor: 1,
      },
      {
        name: 'Executive Twin',
        typeCode: 'EXE-T',
        description: 'Two twin beds with a work desk and harbor views — ideal for business travelers.',
        basePrice: 220, defaultCapacity: 2, maxCapacity: 2,
        amenities: ['Twin beds', 'Harbor view', 'Work desk', 'Smart TV', 'Espresso machine'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'],
        bedConfiguration: '2 Twin beds', viewType: 'Harbor view', size: { value: 40, unit: 'sqm' },
        tags: ['business'], sortOrder: 2, roomCount: 4, roomStart: 1, floor: 2,
      },
      {
        name: 'Presidential Suite',
        typeCode: 'PRS-S',
        description: 'The crown jewel — a two-bedroom suite with private terrace, butler service, and 270° river views.',
        basePrice: 650, defaultCapacity: 2, maxCapacity: 4,
        amenities: ['Private terrace', 'Butler service', 'River view', 'Jacuzzi', 'Walk-in closet', 'Nespresso', 'Smart TV', 'Pillow menu'],
        images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200', 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200'],
        bedConfiguration: '1 King + 1 Queen (separate bedroom)', viewType: 'River view', size: { value: 90, unit: 'sqm' },
        tags: ['luxury', 'suite'], sortOrder: 3, roomCount: 2, roomStart: 1, floor: 3,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // 2. Aurora Alpine Lodge — Aspen, USA (ski resort)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'Aurora Alpine Lodge',
    admin: { firstName: 'Erik', lastName: 'Larsson', email: 'erik.larsson@auroraalpine.com', phone: '+19709000001' },
    staff: [
      { firstName: 'Hannah', lastName: 'Williams', email: 'hannah.williams@auroraalpine.com', phone: '+19709000002' },
      { firstName: 'Diego', lastName: 'Morales', email: 'diego.morales@auroraalpine.com', phone: '+19709000003' },
    ],
    address: { street: '500 Powder Bowl Road', city: 'Aspen', state: 'Colorado', zipCode: '81611', country: 'USA' },
    phoneNumber: ['+1 970 000 0000'],
    email: 'stay@auroraalpine.com',
    description:
      'A slopeside retreat with ski-in/ski-out access, roaring fireplaces, and a full-service spa after a day on the Rockies.',
    amenities: ['Ski-in/ski-out', 'Spa', 'Fireplace', 'Hot tub', 'Ski storage', 'Restaurant', 'Bar', 'Shuttle service'],
    images: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200',
      'https://images.unsplash.com/photo-1551918120-9739cb380c17?w=1200',
    ],
    checkInTime: '16:00',
    checkOutTime: '10:00',
    roomTypes: [
      {
        name: 'Cozy Cabin Room',
        typeCode: 'CAB-S',
        description: 'A rustic-chic room with a stone fireplace, queen bed, and mountain views.',
        basePrice: 210, defaultCapacity: 2, maxCapacity: 2,
        amenities: ['Queen bed', 'Mountain view', 'Fireplace', 'Smart TV', 'Coffee machine'],
        images: ['https://images.unsplash.com/photo-1520250497591-1127cb32a076?w=1200'],
        bedConfiguration: '1 Queen bed', viewType: 'Mountain view', size: { value: 30, unit: 'sqm' },
        tags: ['rustic', 'couples'], sortOrder: 1, roomCount: 5, roomStart: 1, floor: 1,
      },
      {
        name: 'Slopeside Suite',
        typeCode: 'SLP-S',
        description: 'A corner suite with ski-in/ski-out access, king bed, lounge area, and panoramic slope views.',
        basePrice: 420, defaultCapacity: 2, maxCapacity: 4,
        amenities: ['King bed', 'Slope view', 'Fireplace', 'Ski-in/ski-out', 'Minibar', 'Smart TV', 'Soaking tub'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200'],
        bedConfiguration: '1 King bed + sofa bed', viewType: 'Slope view', size: { value: 55, unit: 'sqm' },
        tags: ['luxury', 'ski'], sortOrder: 2, roomCount: 4, roomStart: 1, floor: 2,
      },
      {
        name: 'Alpine Chalet',
        typeCode: 'CHA-L',
        description: 'A private two-story chalet with three bedrooms, full kitchen, and private hot tub on the deck.',
        basePrice: 890, defaultCapacity: 4, maxCapacity: 6,
        amenities: ['3 bedrooms', 'Full kitchen', 'Private hot tub', 'Fireplace', 'Mountain view', 'Washer/dryer', 'Smart TV'],
        images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'],
        bedConfiguration: '2 Queen + 1 King', viewType: 'Mountain view', size: { value: 120, unit: 'sqm' },
        tags: ['luxury', 'family', 'chalet'], sortOrder: 3, roomCount: 2, roomStart: 1, floor: 3,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // 3. Sakura Boutique Hotel — Kyoto, Japan (boutique)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'Sakura Boutique Hotel',
    admin: { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@sakurakyoto.com', phone: '+81750000001' },
    staff: [
      { firstName: 'Haru', lastName: 'Sato', email: 'haru.sato@sakurakyoto.com', phone: '+81750000002' },
      { firstName: 'Mei', lastName: 'Lin', email: 'mei.lin@sakurakyoto.com', phone: '+81750000003' },
    ],
    address: { street: '88 Hanami Lane', city: 'Kyoto', state: 'Kyoto', zipCode: '605-0001', country: 'Japan' },
    phoneNumber: ['+81 75 000 0000'],
    email: 'stay@sakurakyoto.com',
    description:
      'A serene boutique hotel nestled in a historic district, blending traditional Japanese aesthetics with modern comfort. Garden views, tatami suites, and tea ceremonies.',
    amenities: ['Garden view', 'Onsen', 'Tea ceremony', 'Restaurant', 'Bicycle rental', 'Library', 'Yukata provided'],
    images: [
      'https://images.unsplash.com/photo-1520250497591-1127cb32a076?w=1200',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
    ],
    checkInTime: '15:00',
    checkOutTime: '10:00',
    roomTypes: [
      {
        name: 'Garden Tatami Room',
        typeCode: 'TAT-G',
        description: 'A traditional tatami-mat room with shoji screens, futon bedding, and a private garden view.',
        basePrice: 150, defaultCapacity: 2, maxCapacity: 3,
        amenities: ['Tatami mat', 'Futon bedding', 'Garden view', 'Shoji screens', 'Yukata', 'Tea set'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'],
        bedConfiguration: '2 Futons', viewType: 'Garden view', size: { value: 28, unit: 'sqm' },
        tags: ['traditional', 'couples'], sortOrder: 1, roomCount: 5, roomStart: 1, floor: 1,
      },
      {
        name: 'Sakura Deluxe Twin',
        typeCode: 'SKR-T',
        description: 'A modern twin room with cherry-blossom motifs, Western beds, and a deep soaking tub.',
        basePrice: 200, defaultCapacity: 2, maxCapacity: 2,
        amenities: ['Twin beds', 'Soaking tub', 'City view', 'Smart TV', 'Nespresso'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200'],
        bedConfiguration: '2 Twin beds', viewType: 'City view', size: { value: 32, unit: 'sqm' },
        tags: ['modern'], sortOrder: 2, roomCount: 4, roomStart: 1, floor: 2,
      },
      {
        name: 'Onsen Suite',
        typeCode: 'ONS-S',
        description: 'A luxury suite with a private open-air onsen, king bed, and panoramic views of the hotel gardens.',
        basePrice: 480, defaultCapacity: 2, maxCapacity: 3,
        amenities: ['Private onsen', 'King bed', 'Garden view', 'Soaking tub', 'Minibar', 'Smart TV', 'Tea ceremony set'],
        images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200'],
        bedConfiguration: '1 King bed', viewType: 'Garden view', size: { value: 60, unit: 'sqm' },
        tags: ['luxury', 'onsen'], sortOrder: 3, roomCount: 2, roomStart: 1, floor: 3,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // 4. Riviera Sands Resort — Barcelona, Spain (beach resort)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'Riviera Sands Resort',
    admin: { firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@rivierasands.com', phone: '+34600000001' },
    staff: [
      { firstName: 'Lucia', lastName: 'Ferrer', email: 'lucia.ferrer@rivierasands.com', phone: '+34600000002' },
      { firstName: 'Tomás', lastName: 'Ortega', email: 'tomas.ortega@rivierasands.com', phone: '+34600000003' },
    ],
    address: { street: '12 Passeig Marítim', city: 'Barcelona', state: 'Catalunya', zipCode: '08003', country: 'Spain' },
    phoneNumber: ['+34 930 000 000'],
    email: 'stay@rivierasands.com',
    description:
      'A Mediterranean beachfront resort with direct sand access, three pools, a beach club, and vibrant sunset terraces.',
    amenities: ['Beachfront', '3 outdoor pools', 'Beach club', 'Spa', 'Fitness center', 'Restaurant', 'Bar', 'Water sports'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      'https://images.unsplash.com/photo-1551918120-9739cb380c17?w=1200',
      'https://images.unsplash.com/photo-1520250497591-1127cb32a076?w=1200',
    ],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    roomTypes: [
      {
        name: 'Sea View Double',
        typeCode: 'SEA-D',
        description: 'A bright double room with a private balcony overlooking the Mediterranean Sea.',
        basePrice: 195, defaultCapacity: 2, maxCapacity: 2,
        amenities: ['Double bed', 'Sea view', 'Balcony', 'Minibar', 'Smart TV', 'Air conditioning'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200'],
        bedConfiguration: '1 Double bed', viewType: 'Sea view', size: { value: 30, unit: 'sqm' },
        tags: ['popular', 'couples'], sortOrder: 1, roomCount: 6, roomStart: 1, floor: 1,
      },
      {
        name: 'Family Pool Suite',
        typeCode: 'FAM-S',
        description: 'A spacious suite with a separate kids\' room, king bed, and direct pool access.',
        basePrice: 340, defaultCapacity: 3, maxCapacity: 4,
        amenities: ['King bed', 'Bunk beds', 'Pool access', 'Sea view', 'Minibar', 'Smart TV', 'Kids\' amenities'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'],
        bedConfiguration: '1 King + 2 Bunk beds', viewType: 'Pool view', size: { value: 50, unit: 'sqm' },
        tags: ['family'], sortOrder: 2, roomCount: 4, roomStart: 1, floor: 2,
      },
      {
        name: 'Penthouse Sky Terrace',
        typeCode: 'PEN-T',
        description: 'A top-floor penthouse with a private rooftop terrace, plunge pool, and 360° sea and city views.',
        basePrice: 720, defaultCapacity: 2, maxCapacity: 4,
        amenities: ['Private rooftop', 'Plunge pool', 'King bed', '360° view', 'Butler service', 'Minibar', 'Smart TV'],
        images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'],
        bedConfiguration: '1 King + sofa bed', viewType: 'Sea and city view', size: { value: 85, unit: 'sqm' },
        tags: ['luxury', 'penthouse'], sortOrder: 3, roomCount: 2, roomStart: 1, floor: 3,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // 5. Metropolitan Heights — New York, USA (business luxury)
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'Metropolitan Heights',
    admin: { firstName: 'Olivia', lastName: 'Bennett', email: 'olivia.bennett@metroheights.com', phone: '+12120000001' },
    staff: [
      { firstName: 'Andre', lastName: 'Johnson', email: 'andre.johnson@metroheights.com', phone: '+12120000002' },
      { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@metroheights.com', phone: '+12120000003' },
    ],
    address: { street: '350 5th Avenue', city: 'New York', state: 'New York', zipCode: '10118', country: 'USA' },
    phoneNumber: ['+1 212 000 0000'],
    email: 'stay@metroheights.com',
    description:
      'A sleek Midtown skyscraper hotel with floor-to-ceiling windows, a skyline restaurant, and a 24th-floor executive lounge.',
    amenities: ['Skyline restaurant', 'Executive lounge', 'Fitness center', 'Business center', 'Concierge', 'Valet parking', 'Meeting rooms'],
    images: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200',
    ],
    checkInTime: '15:00',
    checkOutTime: '12:00',
    roomTypes: [
      {
        name: 'Skyline King',
        typeCode: 'SKY-K',
        description: 'A modern king room with floor-to-ceiling windows and a panoramic city skyline view.',
        basePrice: 290, defaultCapacity: 2, maxCapacity: 2,
        amenities: ['King bed', 'Skyline view', 'Work desk', 'Smart TV', 'Nespresso', 'Robe & slippers'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d52?w=1200'],
        bedConfiguration: '1 King bed', viewType: 'Skyline view', size: { value: 32, unit: 'sqm' },
        tags: ['business', 'popular'], sortOrder: 1, roomCount: 6, roomStart: 1, floor: 10,
      },
      {
        name: 'Executive Queen',
        typeCode: 'EXE-Q',
        description: 'A practical queen room with a work desk and high-speed Wi-Fi — designed for the business traveler.',
        basePrice: 240, defaultCapacity: 1, maxCapacity: 2,
        amenities: ['Queen bed', 'Work desk', 'High-speed Wi-Fi', 'Smart TV', 'Coffee machine'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'],
        bedConfiguration: '1 Queen bed', viewType: 'City view', size: { value: 26, unit: 'sqm' },
        tags: ['business'], sortOrder: 2, roomCount: 5, roomStart: 1, floor: 12,
      },
      {
        name: 'Corner Executive Suite',
        typeCode: 'COR-S',
        description: 'A corner suite with a separate living area, king bed, and wrap-around skyline windows.',
        basePrice: 550, defaultCapacity: 2, maxCapacity: 3,
        amenities: ['King bed', 'Living area', 'Wrap-around view', 'Minibar', 'Smart TV', 'Soaking tub', 'Nespresso'],
        images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200'],
        bedConfiguration: '1 King + sofa bed', viewType: 'Skyline view', size: { value: 65, unit: 'sqm' },
        tags: ['luxury', 'suite', 'business'], sortOrder: 3, roomCount: 3, roomStart: 1, floor: 15,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Customer definitions — 20 customers with realistic names and contacts
// ---------------------------------------------------------------------------

const CUSTOMER_DEFS: Array<{ firstName: string; lastName: string; email: string; phone: string }> = [
  { firstName: 'Olivia', lastName: 'Hayes', email: 'olivia.hayes@test.com', phone: '+15550002001' },
  { firstName: 'James', lastName: 'Patel', email: 'james.patel@test.com', phone: '+15550002002' },
  { firstName: 'Sofia', lastName: 'Lindqvist', email: 'sofia.l@test.com', phone: '+15550002003' },
  { firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@test.com', phone: '+15550002004' },
  { firstName: 'Emma', lastName: 'Schmidt', email: 'emma.schmidt@test.com', phone: '+15550002005' },
  { firstName: 'Lucas', lastName: 'Rossi', email: 'lucas.rossi@test.com', phone: '+15550002006' },
  { firstName: 'Aisha', lastName: 'Okonkwo', email: 'aisha.okonkwo@test.com', phone: '+15550002007' },
  { firstName: 'Noah', lastName: 'Andersen', email: 'noah.andersen@test.com', phone: '+15550002008' },
  { firstName: 'Mia', lastName: 'Garcia', email: 'mia.garcia@test.com', phone: '+15550002009' },
  { firstName: 'Liam', lastName: 'Murphy', email: 'liam.murphy@test.com', phone: '+15550002010' },
  { firstName: 'Zoe', lastName: 'Fontaine', email: 'zoe.fontaine@test.com', phone: '+15550002011' },
  { firstName: 'Ethan', lastName: 'Walker', email: 'ethan.walker@test.com', phone: '+15550002012' },
  { firstName: 'Chloe', lastName: 'Dubois', email: 'chloe.dubois@test.com', phone: '+15550002013' },
  { firstName: 'Ryan', lastName: 'O\'Brien', email: 'ryan.obrien@test.com', phone: '+15550002014' },
  { firstName: 'Lena', lastName: 'Volkov', email: 'lena.volkov@test.com', phone: '+15550002015' },
  { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@test.com', phone: '+15550002016' },
  { firstName: 'Nora', lastName: 'Bergström', email: 'nora.bergstrom@test.com', phone: '+15550002017' },
  { firstName: 'Theo', lastName: 'Bauer', email: 'theo.bauer@test.com', phone: '+15550002018' },
  { firstName: 'Isla', lastName: 'Reyes', email: 'isla.reyes@test.com', phone: '+15550002019' },
  { firstName: 'Kai', lastName: 'Nakamura', email: 'kai.nakamura@test.com', phone: '+15550002020' },
];

// ---------------------------------------------------------------------------
// Booking templates — realistic spread of statuses and date offsets
// ---------------------------------------------------------------------------

interface BookingTemplate {
  customerIdx: number;
  roomTypeIdx: number;
  roomInstanceIdx: number; // which room of that type (0-based)
  checkInOffset: number;   // days from today
  nights: number;
  guests: number;
  status: BookingStatus;
  specialRequests?: string;
  createdByStaff?: boolean; // if true, createdBy = staff; else = customer
}

const BOOKING_TEMPLATES: Array<{ hotelIdx: number; bookings: BookingTemplate[] }> = [
  // --- Hotel 0: The Grand Meridian (Lisbon) ---
  {
    hotelIdx: 0,
    bookings: [
      { customerIdx: 0, roomTypeIdx: 0, roomInstanceIdx: 0, checkInOffset: 7, nights: 3, guests: 2, status: BookingStatus.Pending, specialRequests: 'Late check-in, around 9pm. Possible early check-in?' },
      { customerIdx: 1, roomTypeIdx: 1, roomInstanceIdx: 0, checkInOffset: 3, nights: 2, guests: 1, status: BookingStatus.Confirmed, specialRequests: 'Need a quiet room for meetings.' },
      { customerIdx: 2, roomTypeIdx: 0, roomInstanceIdx: 1, checkInOffset: -1, nights: 3, guests: 2, status: BookingStatus.CheckedIn, specialRequests: 'Anniversary trip — champagne surprise please!', createdByStaff: true },
      { customerIdx: 0, roomTypeIdx: 1, roomInstanceIdx: 1, checkInOffset: -10, nights: 3, guests: 2, status: BookingStatus.CheckedOut },
      { customerIdx: 1, roomTypeIdx: 2, roomInstanceIdx: 0, checkInOffset: -5, nights: 2, guests: 4, status: BookingStatus.Cancelled, specialRequests: 'Had to cancel due to flight changes.' },
      { customerIdx: 3, roomTypeIdx: 0, roomInstanceIdx: 2, checkInOffset: 14, nights: 5, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'Celebrating a birthday — would love a room with a view.' },
      { customerIdx: 4, roomTypeIdx: 2, roomInstanceIdx: 1, checkInOffset: 30, nights: 2, guests: 3, status: BookingStatus.Pending, specialRequests: 'Arriving via cruise — need late checkout.' },
      { customerIdx: 5, roomTypeIdx: 1, roomInstanceIdx: 2, checkInOffset: -20, nights: 4, guests: 2, status: BookingStatus.CheckedOut, createdByStaff: true },
      { customerIdx: 6, roomTypeIdx: 0, roomInstanceIdx: 3, checkInOffset: -30, nights: 2, guests: 1, status: BookingStatus.NoShow },
    ],
  },
  // --- Hotel 1: Aurora Alpine Lodge (Aspen) ---
  {
    hotelIdx: 1,
    bookings: [
      { customerIdx: 7, roomTypeIdx: 0, roomInstanceIdx: 0, checkInOffset: 5, nights: 4, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'First time skiing — need gear rental recommendations.' },
      { customerIdx: 8, roomTypeIdx: 1, roomInstanceIdx: 0, checkInOffset: 10, nights: 3, guests: 3, status: BookingStatus.Pending, specialRequests: 'Ski-in/ski-out is a must — please confirm.' },
      { customerIdx: 9, roomTypeIdx: 2, roomInstanceIdx: 0, checkInOffset: 21, nights: 7, guests: 5, status: BookingStatus.Confirmed, specialRequests: 'Family reunion — need extra towels and firewood.' },
      { customerIdx: 7, roomTypeIdx: 0, roomInstanceIdx: 1, checkInOffset: -3, nights: 3, guests: 2, status: BookingStatus.CheckedIn, specialRequests: 'Honeymoon trip!', createdByStaff: true },
      { customerIdx: 10, roomTypeIdx: 1, roomInstanceIdx: 1, checkInOffset: -15, nights: 5, guests: 2, status: BookingStatus.CheckedOut },
      { customerIdx: 11, roomTypeIdx: 0, roomInstanceIdx: 2, checkInOffset: -25, nights: 2, guests: 2, status: BookingStatus.Cancelled },
      { customerIdx: 12, roomTypeIdx: 2, roomInstanceIdx: 1, checkInOffset: 45, nights: 3, guests: 4, status: BookingStatus.Pending, specialRequests: 'Need a crib for a toddler.' },
      { customerIdx: 13, roomTypeIdx: 1, roomInstanceIdx: 2, checkInOffset: -40, nights: 4, guests: 2, status: BookingStatus.CheckedOut, createdByStaff: true },
    ],
  },
  // --- Hotel 2: Sakura Boutique Hotel (Kyoto) ---
  {
    hotelIdx: 2,
    bookings: [
      { customerIdx: 14, roomTypeIdx: 0, roomInstanceIdx: 0, checkInOffset: 6, nights: 3, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'Interested in a tea ceremony — please arrange.' },
      { customerIdx: 15, roomTypeIdx: 1, roomInstanceIdx: 0, checkInOffset: 12, nights: 2, guests: 2, status: BookingStatus.Pending },
      { customerIdx: 16, roomTypeIdx: 2, roomInstanceIdx: 0, checkInOffset: 20, nights: 2, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'Anniversary — private onsen is a must.' },
      { customerIdx: 14, roomTypeIdx: 0, roomInstanceIdx: 1, checkInOffset: -2, nights: 4, guests: 2, status: BookingStatus.CheckedIn, createdByStaff: true },
      { customerIdx: 17, roomTypeIdx: 1, roomInstanceIdx: 1, checkInOffset: -12, nights: 3, guests: 1, status: BookingStatus.CheckedOut },
      { customerIdx: 18, roomTypeIdx: 0, roomInstanceIdx: 2, checkInOffset: -22, nights: 2, guests: 3, status: BookingStatus.NoShow },
      { customerIdx: 19, roomTypeIdx: 2, roomInstanceIdx: 1, checkInOffset: 35, nights: 3, guests: 2, status: BookingStatus.Pending, specialRequests: 'Honeymoon — need flower arrangement in room.' },
    ],
  },
  // --- Hotel 3: Riviera Sands Resort (Barcelona) ---
  {
    hotelIdx: 3,
    bookings: [
      { customerIdx: 0, roomTypeIdx: 0, roomInstanceIdx: 0, checkInOffset: 4, nights: 5, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'Beach club access and sunset terrace dinner please.' },
      { customerIdx: 1, roomTypeIdx: 1, roomInstanceIdx: 0, checkInOffset: 8, nights: 4, guests: 4, status: BookingStatus.Pending, specialRequests: 'Traveling with two kids — need crib and high chair.' },
      { customerIdx: 2, roomTypeIdx: 2, roomInstanceIdx: 0, checkInOffset: 25, nights: 3, guests: 3, status: BookingStatus.Confirmed, specialRequests: 'Birthday celebration — private dinner on terrace.' },
      { customerIdx: 3, roomTypeIdx: 0, roomInstanceIdx: 1, checkInOffset: -1, nights: 3, guests: 2, status: BookingStatus.CheckedIn, createdByStaff: true },
      { customerIdx: 4, roomTypeIdx: 1, roomInstanceIdx: 1, checkInOffset: -8, nights: 5, guests: 3, status: BookingStatus.CheckedOut },
      { customerIdx: 5, roomTypeIdx: 0, roomInstanceIdx: 2, checkInOffset: -18, nights: 2, guests: 2, status: BookingStatus.Cancelled, specialRequests: 'Flight delayed — had to rebook elsewhere.' },
      { customerIdx: 6, roomTypeIdx: 0, roomInstanceIdx: 3, checkInOffset: 50, nights: 7, guests: 2, status: BookingStatus.Pending },
      { customerIdx: 7, roomTypeIdx: 2, roomInstanceIdx: 1, checkInOffset: -35, nights: 2, guests: 4, status: BookingStatus.CheckedOut, createdByStaff: true },
      { customerIdx: 8, roomTypeIdx: 1, roomInstanceIdx: 2, checkInOffset: -45, nights: 3, guests: 4, status: BookingStatus.CheckedOut },
    ],
  },
  // --- Hotel 4: Metropolitan Heights (New York) ---
  {
    hotelIdx: 4,
    bookings: [
      { customerIdx: 9, roomTypeIdx: 0, roomInstanceIdx: 0, checkInOffset: 2, nights: 3, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'High floor please — away from elevator noise.' },
      { customerIdx: 10, roomTypeIdx: 1, roomInstanceIdx: 0, checkInOffset: 5, nights: 2, guests: 1, status: BookingStatus.Pending, specialRequests: 'Business trip — need receipt for expense.' },
      { customerIdx: 11, roomTypeIdx: 2, roomInstanceIdx: 0, checkInOffset: 15, nights: 4, guests: 2, status: BookingStatus.Confirmed, specialRequests: 'Client meetings — need meeting room for 2 hours daily.' },
      { customerIdx: 12, roomTypeIdx: 0, roomInstanceIdx: 1, checkInOffset: -1, nights: 2, guests: 2, status: BookingStatus.CheckedIn, createdByStaff: true },
      { customerIdx: 13, roomTypeIdx: 1, roomInstanceIdx: 1, checkInOffset: -7, nights: 3, guests: 1, status: BookingStatus.CheckedOut },
      { customerIdx: 14, roomTypeIdx: 0, roomInstanceIdx: 2, checkInOffset: -14, nights: 2, guests: 2, status: BookingStatus.Cancelled },
      { customerIdx: 15, roomTypeIdx: 2, roomInstanceIdx: 1, checkInOffset: 40, nights: 3, guests: 3, status: BookingStatus.Pending, specialRequests: 'Anniversary — skyline view is essential.' },
      { customerIdx: 16, roomTypeIdx: 1, roomInstanceIdx: 2, checkInOffset: -28, nights: 4, guests: 1, status: BookingStatus.CheckedOut, createdByStaff: true },
      { customerIdx: 17, roomTypeIdx: 0, roomInstanceIdx: 3, checkInOffset: -50, nights: 1, guests: 2, status: BookingStatus.NoShow },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seedAll() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Database connected.\n');

  // --- Clean slate ---
  console.log('Clearing ALL existing data...');
  await Promise.all([
    User.deleteMany({}),
    Hotel.deleteMany({}),
    RoomType.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
  ]);
  console.log('Cleared.\n');

  // --- 1. SuperAdmin ---
  console.log('Creating SuperAdmin...');
  const superAdmin = await User.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@test.com',
    phoneNumber: '+1234567890',
    passwordHash: PASSWORD,
    role: Role.SuperAdmin,
    isEmailVerified: true,
    isPhoneVerified: true,
    isDeleted: false,
  });
  console.log(`  ${superAdmin.email}\n`);

  // --- 2. Customers (20) ---
  console.log('Creating 20 customers...');
  const customers: IUser[] = [];
  for (const c of CUSTOMER_DEFS) {
    const user = await User.create({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phoneNumber: c.phone,
      passwordHash: PASSWORD,
      role: Role.Customer,
      isEmailVerified: true,
      isPhoneVerified: true,
      isDeleted: false,
    });
    customers.push(user);
  }
  console.log(`  Created ${customers.length} customers\n`);

  // --- 3. Hotels, Room Types, Rooms, Staff ---
  const hotels: IHotel[] = [];
  const allRoomTypes: IRoomType[] = [];
  const allRooms: IRoom[][] = []; // rooms per hotel
  const allStaff: IUser[][] = []; // staff per hotel

  for (let hIdx = 0; hIdx < HOTEL_DEFS.length; hIdx++) {
    const def = HOTEL_DEFS[hIdx];
    console.log(`Creating hotel ${hIdx + 1}/${HOTEL_DEFS.length}: ${def.name}...`);

    // 3a. Create hotelAdmin (without hotel link first)
    const hotelAdmin = await User.create({
      firstName: def.admin.firstName,
      lastName: def.admin.lastName,
      email: def.admin.email,
      phoneNumber: def.admin.phone,
      passwordHash: PASSWORD,
      role: Role.HotelAdmin,
      isEmailVerified: true,
      isPhoneVerified: true,
      isDeleted: false,
    });

    // 3b. Create hotel with hotelAdmin as createdBy
    const hotel = await Hotel.create({
      name: def.name,
      address: def.address,
      phoneNumber: def.phoneNumber,
      email: def.email,
      description: def.description,
      amenities: def.amenities,
      images: def.images,
      checkInTime: def.checkInTime,
      checkOutTime: def.checkOutTime,
      isDeleted: false,
      createdBy: hotelAdmin._id,
    });

    // 3c. Link hotelAdmin to hotel
    hotelAdmin.hotel = hotel._id;
    await hotelAdmin.save();

    // 3d. Create staff members
    const hotelStaff: IUser[] = [];
    for (const s of def.staff) {
      const staffUser = await User.create({
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phoneNumber: s.phone,
        passwordHash: PASSWORD,
        role: Role.Staff,
        isEmailVerified: true,
        isPhoneVerified: true,
        isDeleted: false,
        hotel: hotel._id,
      });
      hotelStaff.push(staffUser);
    }
    allStaff.push(hotelStaff);

    // 3e. Create room types
    const hotelRoomTypes: IRoomType[] = [];
    for (const rtDef of def.roomTypes) {
      const roomType = await RoomType.create({
        hotel: hotel._id,
        name: rtDef.name,
        typeCode: rtDef.typeCode,
        description: rtDef.description,
        basePrice: rtDef.basePrice,
        defaultCapacity: rtDef.defaultCapacity,
        maxCapacity: rtDef.maxCapacity,
        amenities: rtDef.amenities,
        images: rtDef.images,
        bedConfiguration: rtDef.bedConfiguration,
        viewType: rtDef.viewType,
        size: rtDef.size,
        tags: rtDef.tags,
        sortOrder: rtDef.sortOrder,
        isDeleted: false,
      });
      hotelRoomTypes.push(roomType);
    }
    allRoomTypes.push(...hotelRoomTypes);

    // 3f. Create rooms for each room type
    const hotelRooms: IRoom[] = [];
    // Distribute room statuses: most available, some occupied, some cleaning, one out-of-service
    const statusCycle: RoomStatus[] = [
      RoomStatus.Available, RoomStatus.Available, RoomStatus.Available,
      RoomStatus.Occupied, RoomStatus.Available, RoomStatus.Cleaning,
      RoomStatus.Available, RoomStatus.Occupied, RoomStatus.Available,
      RoomStatus.OutOfService,
    ];

    for (const rtDef of def.roomTypes) {
      for (let i = 0; i < rtDef.roomCount; i++) {
        const roomNumber = `${rtDef.floor}${String(rtDef.roomStart + i).padStart(2, '0')}`;
        const statusIdx = hotelRooms.length % statusCycle.length;
        const room = await Room.create({
          hotel: hotel._id,
          roomNumber,
          roomType: hotelRoomTypes.find(rt => rt.name === rtDef.name)!._id,
          status: statusCycle[statusIdx],
          isDeleted: false,
          createdBy: hotelAdmin._id,
        });
        hotelRooms.push(room);
      }
    }
    allRooms.push(hotelRooms);

    hotels.push(hotel);
    console.log(`  ${hotel.name} — ${hotelRoomTypes.length} room types, ${hotelRooms.length} rooms, ${hotelStaff.length} staff\n`);
  }

  // --- 4. Bookings ---
  console.log('Creating bookings...');
  let totalBookings = 0;

  for (const template of BOOKING_TEMPLATES) {
    const hotelIdx = template.hotelIdx;
    const hotelDef = HOTEL_DEFS[hotelIdx];
    const hotel = hotels[hotelIdx];
    const hotelRooms = allRooms[hotelIdx];
    const hotelStaff = allStaff[hotelIdx];

    for (const bk of template.bookings) {
      const customer = customers[bk.customerIdx];
      const roomTypeDef = hotelDef.roomTypes[bk.roomTypeIdx];
      // Find the room matching this room type and instance index
      const roomType = allRoomTypes.find(
        rt => rt.hotel.toString() === hotel._id.toString() && rt.name === roomTypeDef.name
      );
      if (!roomType) {
        console.warn(`  Skipping booking: room type "${roomTypeDef.name}" not found for hotel ${hotel.name}`);
        continue;
      }
      const roomTypeIdStr = (roomType._id as mongoose.Types.ObjectId).toString();
      const matchingRooms = hotelRooms.filter(r => r.roomType.toString() === roomTypeIdStr);
      const room = matchingRooms[bk.roomInstanceIdx % matchingRooms.length];

      const checkIn = dateOnly(bk.checkInOffset);
      const checkOut = addDays(checkIn, bk.nights);
      const pricePerNight = roomType.basePrice;
      const totalPrice = pricePerNight * bk.nights;

      const createdBy = bk.createdByStaff
        ? hotelStaff[0]._id
        : customer._id;

      await Booking.create({
        user: customer._id,
        hotel: hotel._id,
        room: room._id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: bk.guests,
        totalPrice,
        status: bk.status,
        specialRequests: bk.specialRequests,
        createdBy,
        isDeleted: false,
      });
      totalBookings++;
    }
  }

  console.log(`  Created ${totalBookings} bookings across ${hotels.length} hotels\n`);

  // --- Summary ---
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE — Rich demo dataset created');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Password for ALL accounts: ${PASSWORD}`);
  console.log('  ────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  SuperAdmin:');
  console.log('    admin@test.com');
  console.log('');
  console.log('  HotelAdmins & Staff (email = firstName.lastName@hotel-domain):');
  for (let i = 0; i < HOTEL_DEFS.length; i++) {
    const def = HOTEL_DEFS[i];
    console.log(`    ${def.name} (${def.address.city}, ${def.address.country})`);
    console.log(`      Admin: ${def.admin.email}`);
    for (const s of def.staff) {
      console.log(`      Staff: ${s.email}`);
    }
  }
  console.log('');
  console.log('  Customers (20):');
  for (const c of CUSTOMER_DEFS) {
    console.log(`    ${c.email}`);
  }
  console.log('');
  console.log(`  Hotels:       ${hotels.length}`);
  console.log(`  Room Types:   ${allRoomTypes.length}`);
  let totalRooms = 0;
  for (const r of allRooms) totalRooms += r.length;
  console.log(`  Rooms:        ${totalRooms}`);
  console.log(`  Bookings:     ${totalBookings}`);
  console.log(`  Users total:  ${1 + HOTEL_DEFS.length + HOTEL_DEFS.length * 2 + customers.length} (1 superAdmin + ${HOTEL_DEFS.length} admins + ${HOTEL_DEFS.length * 2} staff + ${customers.length} customers)`);
  console.log('══════════════════════════════════════════════════════════════════');

  await mongoose.disconnect();
  console.log('\nDatabase disconnected. Done.');
}

seedAll().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
