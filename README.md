# HMS Backend

A multi-tenant Hotel Management System (HMS) REST API built with Node.js, Express 5, TypeScript, and MongoDB/Mongoose. It provides JWT-based authentication, role-scoped hotel/room/room-type management, and a booking engine, with hotels operating as independently managed tenants under their own admins.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [Roles & Access Control](#roles--access-control)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)
- [License](#license)

## Features

- **JWT authentication** via Passport (`passport-local` for login, `passport-jwt` for protecting routes), with bcrypt password hashing (10 salt rounds)
- **Role-based access control** for four roles: `customer`, `staff`, `hotelAdmin`, `superAdmin`
- **Multi-tenant hotel management** — each hotel is owned by the `HotelAdmin` who created it; room types, rooms, and bookings are all scoped to a hotel
- **Room type & room inventory management** with per-room overrides (price, capacity, size, images) on top of a room type's defaults
- **Booking engine** covering creation (self-service and staff-on-behalf-of-customer), status transitions (`pending` → `confirmed` → `checked-in` → `checked-out`, plus `cancelled`/`no-show`), and cancellation
- **Double-booking prevention** via a partial unique index on `(room, checkInDate, checkOutDate, status)` for `confirmed`/`checked-in` bookings
- **Soft deletes** throughout (`isActive`/`isDeleted` flags) instead of destructive deletes for hotels, rooms, room types, and users
- **Field-level encryption** of sensitive user data (`identityUrls`) at rest via `mongoose-field-encryption`
- **Centralized error handling** with typed operational errors (`NotFoundError`, `ConflictError`, `ForbiddenError`, etc.) and environment-aware error responses
- **Security middleware**: `helmet` for HTTP headers, `express-rate-limit` (100 requests / 5 minutes per IP), single-origin CORS, and `express-validator` input validation on every write route
- **Colorized request logging** (method, path, status, response time) for local development

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
├── scripts/           # One-off scripts (super admin seeding, dev utilities)
├── services/          # Business logic and database queries, decoupled from Express
├── utils/             # AppError hierarchy used by the global error handler
└── server.ts          # App bootstrap: middleware, routes, error handler, listen
```

Every resource (hotel, room, room type, booking, user) follows the same three-file pattern: a router under `routes/` defines validation and auth, a controller under `controllers/` adapts the HTTP request/response, and a service under `services/` contains the actual database logic — routes and controllers never talk to Mongoose directly.

Two standalone helper scripts live at the repo root and are unrelated to the running server: [`getAllFiles.js`](getAllFiles.js) concatenates all git-tracked files into `all_code.txt`, and [`src/scripts/copyMD.js`](src/scripts/copyMD.js) combines the files in `doc/curl_examples/` into `combined_curl_examples.txt`. Both are local convenience tools for dumping the codebase/docs into a single file (e.g. for pasting elsewhere) — neither is required to build, run, or test the API, and their output files can be regenerated at any time.

## Data Models

| Model | Key Fields | Notes |
|---|---|---|
| **User** | `firstName`, `lastName`, `email`, `phoneNumber`, `passwordHash`, `role`, `hotel`, `identityUrls`, `isDeleted` | `hotel` is only valid for `staff`/`hotelAdmin`; `identityUrls` is encrypted at rest |
| **Hotel** | `name`, `address`, `phoneNumber[]`, `amenities[]`, `images[]`, `checkInTime`, `checkOutTime`, `location` (GeoJSON Point), `createdBy`, `isActive` | Ownership is tracked via `createdBy` (the `HotelAdmin` who created it) |
| **RoomType** | `hotel`, `name`, `typeCode`, `basePrice`, `defaultCapacity`, `maxCapacity`, `amenities[]`, `size`, `isActive` | Unique per hotel on `name` (among active types) and on `typeCode` |
| **Room** | `hotel`, `roomNumber`, `roomType`, `capacity`, `pricePerNight`, `status`, `sizeOverride`, `isDeleted` | `status` is one of `available`, `occupied`, `cleaning`, `out_of_service`; overrides layer on top of the parent `RoomType` |
| **Booking** | `user`, `hotel`, `room`, `checkInDate`, `checkOutDate`, `numberOfGuests`, `totalPrice`, `status`, `createdBy` | `status` is one of `pending`, `confirmed`, `checked-in`, `checked-out`, `cancelled`, `no-show`; a `pre('save')` hook rejects `checkOutDate <= checkInDate` |

## Roles & Access Control

| Role | Scope |
|---|---|
| `customer` | Self-registers via `/api/auth/register`; can browse hotels/rooms, create their own bookings, and view/cancel their own bookings |
| `staff` | Tied to one hotel (`user.hotel`); manages that hotel's room types, rooms, and bookings, and can create bookings on behalf of customers |
| `hotelAdmin` | Owns and manages their own hotel (create/update/deactivate), manages that hotel's staff, room types, rooms, and bookings |
| `superAdmin` | Modeled in the schema (no `hotel` association) but has no dedicated routes yet — see [Known Limitations](#known-limitations) |

Access checks happen in two layers: `passport.authenticate('jwt', ...)` verifies the bearer token on every non-public route, and `checkRole([...])` ([src/middleware/auth.ts](src/middleware/auth.ts)) restricts specific routes to a list of allowed roles.

## Getting Started

### Prerequisites

- Node.js (LTS recommended — Express 5 requires Node 18+)
- A MongoDB instance (local or Atlas)

### Installation

```bash
git clone git@github.com:ipoojamittal/EasyHotelBackend.git
cd hms-backend
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
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime **in seconds** (e.g. `3600`). The service parses this with `parseInt`, so a duration string like `1h` will silently resolve to `1` second — use a plain number |
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

### Seeding a Super Admin

There's no `npm run seed` script, so run the seeder directly:

```bash
npx ts-node-dev --transpile-only src/scripts/seedSuperAdmin.ts
```

It creates one `superAdmin` user (skips if one already exists for the given email), using these optional env vars with fallback defaults: `SUPER_ADMIN_EMAIL` (`admin@test.com`), `SUPER_ADMIN_PASSWORD` (`admin123`), `SUPER_ADMIN_FIRSTNAME`, `SUPER_ADMIN_LASTNAME`, `SUPER_ADMIN_PHONE`. Set these explicitly in `.env` before running against anything but a throwaway local database.

## API Reference

All endpoints below are prefixed as mounted in [src/server.ts](src/server.ts). Every route except `POST /api/auth/login` and `POST /api/auth/register` requires an `Authorization: Bearer <token>` header. List endpoints share the same pagination defaults (`page=1`, `limit=10`) and generally accept `sortBy`/`sortOrder` query params.

Runnable request examples for every route below live in [`doc/curl_examples/`](doc/curl_examples) (`auth.md`, `user.md`, `hotel.md`, `admin.md`, `roomType.md`, `room.md`).

#### Auth — `/api/auth`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/login` | Public | Authenticate with email/password, returns a JWT |
| POST | `/register` | Public | Register a new `customer` account |
| GET | `/status` | Any | Return the current authenticated user |

#### Users — `/api/users`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/me` | Any | Get your own profile |
| PATCH | `/me` | Any | Update your own name |
| PUT | `/me/password` | Any | Change your own password |
| GET | `/` | `hotelAdmin` | List users |
| POST | `/` | `hotelAdmin` | Create a user directly |
| GET | `/:userId` | `hotelAdmin` | Get a specific user |
| PATCH | `/:userId` | `hotelAdmin` | Update a specific user (name, role, active status) |
| DELETE | `/:userId` | `hotelAdmin` | Soft-delete a user |

#### Admin — `/api/admin`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | Any authenticated user* | Create a `hotelAdmin` or `staff` user |

\* The route comment marks this as intended for `hotelAdmin` use, but the `checkRole` guard is currently commented out in [src/routes/admin.ts](src/routes/admin.ts) — see [Known Limitations](#known-limitations).

#### Hotels — `/api/hotels`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin` | Create a hotel (caller becomes the owner via `createdBy`) |
| GET | `/my-hotel` | `hotelAdmin` | Get the hotel you own |
| PATCH | `/my-hotel` | `hotelAdmin` | Update the hotel you own |
| DELETE | `/my-hotel` | `hotelAdmin` | Soft-delete (deactivate) the hotel you own |
| GET | `/` | Any | List active hotels, filterable by `city`/`country` |
| GET | `/:hotelId` | Any | Get public details of one active hotel |

#### Room Types — `/api/hotels/:hotelId/room-types`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin`, `staff` | Create a room type for the hotel |
| GET | `/` | `hotelAdmin`, `staff` | List room types, filterable by `name`/`isActive` |
| GET | `/:roomTypeId` | `hotelAdmin`, `staff` | Get one room type |
| PATCH | `/:roomTypeId` | `hotelAdmin`, `staff` | Update a room type |
| DELETE | `/:roomTypeId` | `hotelAdmin`, `staff` | Soft-delete (deactivate) a room type |

#### Rooms — `/api/hotels/:hotelId/rooms`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `hotelAdmin`, `staff` | Create a room instance under a room type |
| GET | `/` | Any authenticated user | List rooms, filterable by `roomTypeId`/`status`/`isActive` |
| GET | `/:roomId` | Any authenticated user | Get one room (populated with its room type) |
| PATCH | `/:roomId` | `hotelAdmin`, `staff` | Update a room (including `status`) |
| DELETE | `/:roomId` | `hotelAdmin`, `staff` | Soft-delete a room |

#### Bookings — `/api/booking`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/` | `customer` | Create a booking for yourself |
| POST | `/hotel` | `hotelAdmin`, `staff` | Create a booking on behalf of a customer |
| GET | `/my` | Any | List your own bookings |
| GET | `/hotel/:hotelId` | `hotelAdmin`, `staff` | List all bookings for a hotel |
| GET | `/:bookingId` | `customer`, `hotelAdmin`, `staff` | Get one booking (service layer enforces ownership) |
| PATCH | `/:bookingId` | `hotelAdmin`, `staff` | Update booking details (dates, guest count) |
| PATCH | `/:bookingId/status` | `hotelAdmin`, `staff` | Transition booking status |
| PATCH | `/:bookingId/cancel` | `hotelAdmin`, `staff` | Cancel a booking — see note below |

> `PATCH /:bookingId/cancel` is registered twice in [src/routes/booking.ts](src/routes/booking.ts): once restricted to `hotelAdmin`/`staff`, and again further down allowing `customer` too. Express matches the first-registered route, so the second (customer-inclusive) definition is currently unreachable — a customer cannot cancel their own booking through this endpoint today.

## Error Handling

All errors flow through a single [global error handler](src/middleware/errorHandler.ts). Custom errors extend `AppError` ([src/utils/errors.ts](src/utils/errors.ts)): `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409).

- In `development`, responses include the raw error, message, and stack trace.
- In `production` (or any other `NODE_ENV` value), responses are sanitized: known cases (Mongoose `CastError`, validation errors, duplicate-key `11000` errors, JWT errors, and operational `AppError`s) return a clean `{ status, message }` body with the right status code; anything unexpected is logged server-side and returned as a generic 500.

## Security Notes

- Passwords are hashed with `bcrypt` (10 salt rounds) in a Mongoose `pre('save')` hook — never stored or logged in plaintext.
- `identityUrls` on `User` is encrypted at rest with `mongoose-field-encryption`; the app refuses to start without a valid 64-character `MONGOOSE_ENCRYPTION_KEY`.
- CORS currently allows exactly one origin (`CORS_ORIGIN_WEB`); requests with no `Origin` header (e.g. curl, mobile apps, server-to-server) are allowed through.
- Rate limiting is global (all routes): 100 requests per IP per 5-minute window.
- `helmet()` is applied before all other middleware for baseline HTTP security headers.

## Known Limitations

- No automated test suite yet — `npm test` is a placeholder that exits with an error.
- `POST /api/admin` has its `checkRole` guard commented out (see the TODO in [src/routes/admin.ts](src/routes/admin.ts)), so any authenticated user can currently create a `hotelAdmin`/`staff` account, not just existing `hotelAdmin`s.
- The `superAdmin` role exists in the data model and JWT payload but has no dedicated routes yet.
- The duplicate `PATCH /:bookingId/cancel` route (see [API Reference](#api-reference)) means customers can't cancel their own bookings through the API as currently wired.
- `JWT_EXPIRES_IN` must be a plain number of seconds — the `.env.example` value of `1h` will not behave as expected (see [Environment Variables](#environment-variables)).
- No CI pipeline is configured in this repository.

## License

ISC
