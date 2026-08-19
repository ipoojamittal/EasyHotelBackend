# EasyHotel Backend

A multi-tenant Hotel Management System (HMS) REST API built with Node.js, Express 5, TypeScript, and MongoDB/Mongoose. It provides JWT-based authentication, role-scoped hotel/room/room-type management, a transactional booking engine, and superAdmin oversight — with hotels operating as independently managed tenants under their own admins.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [Roles & Access Control](#roles--access-control)
- [Getting Started](#getting-started)
- [Seeding the Database](#seeding-the-database)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)
- [License](#license)

## Features

- **JWT authentication** via Passport (`passport-local` for login, `passport-jwt` for protecting routes), with bcrypt password hashing (10 salt rounds)
- **Fail-fast JWT configuration** — the server refuses to start without a configured `JWT_SECRET`; no insecure fallbacks
- **Duration-based JWT expiry** — supports human-readable values like `1h`, `30m`, `7d` (not just raw seconds)
- **Role-based access control** for four roles: `customer`, `staff`, `hotelAdmin`, `superAdmin`
- **Multi-tenant hotel management** — each hotel is owned by the `HotelAdmin` who created it; room types, rooms, and bookings are all scoped to a hotel
- **Room type & room inventory management** with per-room overrides (price, capacity, size, images) on top of a room type's defaults
- **Transactional booking engine** — all booking mutations (create, update, status transition, cancel) run inside MongoDB transactions with double-booking prevention via range overlap queries
- **Booking status state machine** — enforces valid transitions (`pending` → `confirmed` → `checked-in` → `checked-out`, plus `cancelled`/`no-show`) and automatically syncs room operational status
- **Soft deletes** throughout (`isDeleted` flag) for hotels, room types, rooms, bookings, and users — no destructive deletes
- **SuperAdmin routes** — global hotel directory, user listing, and cross-ownership hotel suspension
- **Field-level encryption** of sensitive user data (`identityUrls`) at rest via `mongoose-field-encryption`
- **Centralized error handling** with typed operational errors (`NotFoundError`, `ConflictError`, `ForbiddenError`, etc.) and environment-aware error responses
- **Security middleware**: `helmet` for HTTP headers, `express-rate-limit` (global + auth-specific rate limiting), single-origin CORS, body-size limits (1 MB), and `express-validator` input validation on every write route
- **Health check** endpoint (`GET /health`) for load balancer / container orchestration
- **Graceful shutdown** — SIGTERM/SIGINT handlers close the HTTP server then disconnect MongoDB cleanly

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Language | TypeScript |
| Database / ODM | MongoDB with Mongoose 8 |
| Auth | Passport.js (`passport-local`, `passport-jwt`) + `jsonwebtoken` |
| Validation | `express-validator` |
| Security | `helmet`, `express-rate-limit`, `bcrypt`, `mongoose-field-encryption` |
| Dev tooling | `ts-node-dev`, `nodemon`, `tsc` |

## Architecture

The app follows a layered request flow:

```
Route (validation + role check) → Controller (HTTP glue) → Service (business logic) → Mongoose Model
```

```
src/
├── config/           # DB connection (db.ts) and Passport strategies (passport.ts)
├── controllers/       # Request/response handling per resource
├── middleware/        # JWT role checks, global error handler, request logger
├── models/            # Mongoose schemas: User, Hotel, Room, RoomType, Booking
├── routes/            # Express routers with express-validator rule chains
├── scripts/           # Seed scripts (seedAll.ts, seedSuperAdmin.ts)
├── services/          # Business logic and database queries, decoupled from Express
├── utils/             # AppError hierarchy used by the global error handler
└── server.ts          # App bootstrap: middleware, routes, error handler, listen
```

Every resource (hotel, room, room type, booking, user) follows the same three-file pattern: a router under `routes/` defines validation and auth, a controller under `controllers/` adapts the HTTP request/response, and a service under `services/` contains the actual database logic — routes and controllers never talk to Mongoose directly.

## Data Models

| Model | Key Fields | Notes |
|---|---|---|
| **User** | `firstName`, `lastName`, `email`, `phoneNumber`, `passwordHash`, `role`, `hotel`, `identityUrls`, `isDeleted` | `hotel` is only valid for `staff`/`hotelAdmin`; `identityUrls` is encrypted at rest; password hashed in `pre('save')` hook |
| **Hotel** | `name`, `address`, `phoneNumber[]`, `amenities[]`, `images[]`, `checkInTime`, `checkOutTime`, `location` (GeoJSON Point), `createdBy`, `isDeleted` | Ownership tracked via `createdBy` (the `HotelAdmin` who created it); compound indexes on `(isDeleted, city)` and `(isDeleted, country)` |
| **RoomType** | `hotel`, `name`, `typeCode`, `basePrice`, `defaultCapacity`, `maxCapacity`, `amenities[]`, `size`, `isDeleted` | Unique per hotel on `(hotel, name)` and `(hotel, typeCode)` among non-deleted types |
| **Room** | `hotel`, `roomNumber`, `roomType`, `capacity`, `pricePerNight`, `status`, `sizeOverride`, `isDeleted` | `status` is one of `available`, `occupied`, `cleaning`, `out_of_service`; unique on `(hotel, roomNumber)` among non-deleted rooms |
| **Booking** | `user`, `hotel`, `room`, `checkInDate`, `checkOutDate`, `numberOfGuests`, `totalPrice`, `status`, `createdBy`, `isDeleted` | `status` is one of `pending`, `confirmed`, `checked-in`, `checked-out`, `cancelled`, `no-show`; `pre('save')` rejects `checkOutDate <= checkInDate`; overlap prevention enforced in service layer with transactions |

## Roles & Access Control

| Role | Scope |
|---|---|
| `customer` | Self-registers via `/api/auth/register`; can browse hotels/rooms, create their own bookings, and view/cancel their own bookings |
| `staff` | Tied to one hotel (`user.hotel`); manages that hotel's room types, rooms, and bookings, and can create bookings on behalf of customers |
| `hotelAdmin` | Owns and manages their own hotel (create/update/soft-delete), manages that hotel's staff, room types, rooms, and bookings |
| `superAdmin` | Global oversight — lists all hotels and users system-wide, can suspend any hotel across ownership boundaries |

Access checks happen in two layers: `passport.authenticate('jwt', ...)` verifies the bearer token on every non-public route, and `checkRole([...])` ([src/middleware/auth.ts](src/middleware/auth.ts)) restricts specific routes to a list of allowed roles. Both Local and JWT strategies filter out soft-deleted users.

## Getting Started

### Prerequisites

- Node.js (LTS recommended — Express 5 requires Node 18+)
- A MongoDB instance (local or Atlas)

### Installation

```bash
git clone git@github.com:ipoojamittal/EasyHotelBackend.git
cd EasyHotelBackend
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development`, `production`, or `test` — controls error response verbosity |
| `PORT` | Server port (default `3000`) |
| `JWT_SECRET` | Secret used to sign JWTs — **required**, server exits without it |
| `JWT_EXPIRES_IN` | Token lifetime — supports duration strings (`1h`, `30m`, `7d`) or seconds (`3600`) |
| `DATABASE_URL` | MongoDB connection string |
| `MONGOOSE_ENCRYPTION_KEY` | Exactly 64 hex characters (32 bytes). The app exits on startup if this is missing or the wrong length |
| `MONGOOSE_ENCRYPTION_SALT` | Static salt for the field-encryption plugin |
| `CORS_ORIGIN_WEB` | Allowed frontend origin for CORS (currently a single origin, not a list) |

### Running the App

```bash
npm run dev      # ts-node-dev with hot reload (development)
npm run build    # compile TypeScript to dist/
npm start        # run the compiled build (dist/server.js)
npm run watch    # tsc in watch mode, compile-only
npm run serve    # run dist/server.js under nodemon
```

## Seeding the Database

### Full demo dataset

```bash
npx ts-node src/scripts/seedAll.ts
```

Wipes all existing data and creates a rich, realistic dataset:

| Entity | Count | Details |
|---|---|---|
| SuperAdmin | 1 | `admin@test.com` |
| HotelAdmins | 5 | One per hotel |
| Staff | 10 | Two per hotel |
| Customers | 20 | Varied names and contact info |
| Hotels | 5 | Lisbon, Aspen, Kyoto, Barcelona, New York |
| Room Types | 15 | 3 per hotel, tailored to each property |
| Rooms | 59 | 11–14 per hotel, varied statuses |
| Bookings | 42 | All statuses, past/present/future dates |

**Password for all accounts:** `Password123!`

### SuperAdmin only

```bash
npx ts-node src/scripts/seedSuperAdmin.ts
```

Creates a single `superAdmin` user if one doesn't already exist for the given email.

## API Reference

All endpoints are prefixed with `/api`. Every route except `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/hotels`, `GET /api/hotels/:hotelId`, and `GET /health` requires an `Authorization: Bearer <token>` header. List endpoints share pagination defaults (`page=1`, `limit=10`) and accept `sortBy`/`sortOrder` query params (sort fields are whitelisted per resource).

#### Auth — `/api/auth`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/login` | Public | Authenticate with email/password, returns a JWT (rate-limited: 10 attempts / 15 min) |
| POST | `/register` | Public | Register a new `customer` account (rate-limited: 10 attempts / 15 min) |
| GET | `/status` | Any | Return the current authenticated user |

#### Users — `/api/users`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/me` | Any | Get your own profile |
| PATCH | `/me` | Any | Update your own name |
| PUT | `/me/password` | Any | Change your own password |
| GET | `/` | `hotelAdmin` | List users (filterable by `isDeleted`, `role`) |
| POST | `/` | `hotelAdmin` | Create a user directly |
| GET | `/:userId` | `hotelAdmin` | Get a specific user |
| PATCH | `/:userId` | `hotelAdmin` | Update a specific user (name, role, `isDeleted`) |
| DELETE | `/:userId` | `hotelAdmin` | Soft-delete a user |

#### Admin — `/api/admin`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin` | Create a `hotelAdmin` or `staff` user |

#### SuperAdmin — `/api/admin`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/hotels` | `superAdmin` | List all hotels system-wide |
| GET | `/users` | `superAdmin` | List all users system-wide |
| PATCH | `/hotels/:hotelId/suspend` | `superAdmin` | Suspend (soft-delete) any hotel across ownership boundaries |

#### Hotels — `/api/hotels`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/` | Public | List active hotels, filterable by `city`/`country`/`isDeleted` |
| GET | `/:hotelId` | Public | Get public details of one active hotel |
| POST | `/` | `hotelAdmin` | Create a hotel (caller becomes the owner via `createdBy`) |
| GET | `/my-hotel` | `hotelAdmin` | Get the hotel you own |
| PATCH | `/my-hotel` | `hotelAdmin` | Update the hotel you own |
| DELETE | `/my-hotel` | `hotelAdmin` | Soft-delete the hotel you own |

#### Room Types — `/api/room-types`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin`, `staff` | Create a room type for the hotel |
| GET | `/` | `hotelAdmin`, `staff` | List room types, filterable by `name`/`isDeleted` |
| GET | `/:roomTypeId` | `hotelAdmin`, `staff` | Get one room type |
| PATCH | `/:roomTypeId` | `hotelAdmin`, `staff` | Update a room type |
| DELETE | `/:roomTypeId` | `hotelAdmin`, `staff` | Soft-delete a room type |

#### Rooms — `/api/rooms`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin`, `staff` | Create a room instance under a room type |
| GET | `/` | Any authenticated user | List rooms, filterable by `roomTypeId`/`status`/`isDeleted` |
| GET | `/:roomId` | Any authenticated user | Get one room (populated with its room type) |
| PATCH | `/:roomId` | `hotelAdmin`, `staff` | Update a room (including `status`) |
| DELETE | `/:roomId` | `hotelAdmin`, `staff` | Soft-delete a room |

#### Bookings — `/api/bookings`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `customer` | Create a booking for yourself |
| POST | `/hotel` | `hotelAdmin`, `staff` | Create a booking on behalf of a customer |
| GET | `/my` | Any | List your own bookings |
| GET | `/hotel/:hotelId` | `hotelAdmin`, `staff` | List all bookings for a hotel |
| GET | `/:bookingId` | `customer`, `hotelAdmin`, `staff` | Get one booking (service layer enforces ownership) |
| PATCH | `/:bookingId` | `hotelAdmin`, `staff` | Update booking details (dates, guest count) |
| PATCH | `/:bookingId/status` | `hotelAdmin`, `staff` | Transition booking status (state-machine validated) |
| PATCH | `/:bookingId/cancel` | `customer`, `hotelAdmin`, `staff` | Cancel a booking (customers can cancel their own) |

#### Health — `/health`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/health` | Public | Returns `{ status: "ok", database: "connected" \| "disconnected" }` |

## Error Handling

All errors flow through a single [global error handler](src/middleware/errorHandler.ts). Custom errors extend `AppError` ([src/utils/errors.ts](src/utils/errors.ts)): `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409).

- In `development`, responses include the raw error, message, and stack trace.
- In `production` (or any other `NODE_ENV` value), responses are sanitized: known cases (Mongoose `CastError`, validation errors, duplicate-key `11000` errors, JWT errors, and operational `AppError`s) return a clean `{ status, message }` body with the right status code; anything unexpected is logged server-side and returned as a generic 500.

## Security Notes

- Passwords are hashed with `bcrypt` (10 salt rounds) in a Mongoose `pre('save')` hook — never stored or logged in plaintext.
- `identityUrls` on `User` is encrypted at rest with `mongoose-field-encryption`; the app refuses to start without a valid 64-character `MONGOOSE_ENCRYPTION_KEY`.
- JWT secret is required at startup — no insecure fallback. The server exits immediately if `JWT_SECRET` is missing.
- Auth routes (login, register) have dedicated rate limiting (10 attempts per 15 minutes per IP) on top of the global limiter (100 requests / 5 min).
- Request body size is capped at 1 MB to prevent oversized payloads.
- CORS allows exactly one origin (`CORS_ORIGIN_WEB`); requests with no `Origin` header (e.g. curl, server-to-server) are allowed through.
- `helmet()` is applied before all other middleware for baseline HTTP security headers.
- Sort fields on all list endpoints are whitelisted to prevent NoSQL injection via sort parameters.
- Pagination is capped (`limit` max 100, `page` max 1000) to prevent excessive queries.
- Passport strategies (Local and JWT) filter out soft-deleted users — deleted accounts cannot log in or use tokens.

## Known Limitations

- No automated test suite yet.
- No CI pipeline is configured in this repository.
- No image upload — image fields are URL arrays.
- No analytics endpoint — dashboard KPIs are computed client-side from list endpoints.
- No public hotelAdmin onboarding — registration only creates customers; hotelAdmins are created via `/api/admin`.

## License

ISC
