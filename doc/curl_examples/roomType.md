# cURL Examples for Room Type API

This document provides example `curl` commands for interacting with the Room Type API endpoints (`/api/hotels/:hotelId/room-types`).

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).
* Obtain a valid JWT authentication token by logging in via `/api/auth/login`.
* Export the token (including "Bearer ") to an environment variable: `export AUTH_TOKEN="<your_jwt_token>"`.
* Replace placeholders like `<hotel_id>` and `<room_type_id>` with actual IDs from your database.

---

## Room Type API Examples

### 1. Create Room Type

```sh
curl -X POST "http://localhost:3000/api/hotels/<hotel_id>/room-types" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deluxe King Suite",
    "basePrice": 250.50,
    "defaultCapacity": 2,
    "maxCapacity": 3,
    "description": "A spacious suite with a king-size bed and separate living area.",
    "typeCode": "DLXKNG",
    "amenities": ["Wifi", "Air Conditioning", "Mini-bar", "Sofa", "Work Desk"],
    "bedConfiguration": "1 King Bed + 1 Sofa Bed",
    "viewType": "City View",
    "tags": ["suite", "business-friendly"],
    "sortOrder": 10
  }'
```

### 2. List Room Types

```sh
# List active room types (default)
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/room-types" \
  -H "Authorization: $AUTH_TOKEN"

# List with pagination and filter by name
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/room-types?page=1&limit=5&name=Suite" \
  -H "Authorization: $AUTH_TOKEN"

# List inactive room types
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/room-types?isActive=false" \
  -H "Authorization: $AUTH_TOKEN"
```

### 3. Get Room Type Details

```sh
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/room-types/<room_type_id>" \
  -H "Authorization: $AUTH_TOKEN"
```

### 4. Update Room Type

```sh
curl -X PATCH "http://localhost:3000/api/hotels/<hotel_id>/room-types/<room_type_id>" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 265.00,
    "description": "A newly renovated spacious suite with a king-size bed and separate living area.",
    "amenities": ["Wifi", "Air Conditioning", "Mini-bar", "Sofa", "Work Desk", "Nespresso Machine"]
  }'
```

### 5. Deactivate (Soft Delete) Room Type

```sh
curl -X DELETE "http://localhost:3000/api/hotels/<hotel_id>/room-types/<room_type_id>" \
  -H "Authorization: $AUTH_TOKEN"
