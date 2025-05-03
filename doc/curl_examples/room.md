# cURL Examples for Room API

This document provides example `curl` commands for interacting with the Room API endpoints (`/api/hotels/:hotelId/rooms`).

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).
* Obtain a valid JWT authentication token by logging in via `/api/auth/login`.
* Export the token (including "Bearer ") to an environment variable: `export AUTH_TOKEN="<your_jwt_token>"`.
* Replace placeholders like `<hotel_id>`, `<room_type_id>`, and `<room_id>` with actual IDs from your database.
* Ensure the `<room_type_id>` used corresponds to an existing, active Room Type for the specified `<hotel_id>`.

---

## Room API Examples

### 1. Create Room Instance

```sh
curl -X POST "http://localhost:3000/api/hotels/<hotel_id>/rooms" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomNumber": "1201",
    "roomTypeId": "<room_type_id>",
    "status": "available",
    "description": "Top floor corner suite with excellent city views.",
    "pricePerNight": 275.00
  }'
```

### 2. List Room Instances

```sh
# List active rooms (default)
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/rooms" \
  -H "Authorization: $AUTH_TOKEN"

# List rooms of a specific type, needing cleaning
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/rooms?roomTypeId=<room_type_id>&status=cleaning" \
  -H "Authorization: $AUTH_TOKEN"

# List inactive/deleted rooms
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/rooms?isActive=false" \
  -H "Authorization: $AUTH_TOKEN"
```

### 3. Get Room Instance Details

```sh
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>/rooms/<room_id>" \
  -H "Authorization: $AUTH_TOKEN"
```

### 4. Update Room Instance

```sh
curl -X PATCH "http://localhost:3000/api/hotels/<hotel_id>/rooms/<room_id>" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cleaning",
    "description": "Top floor corner suite. Needs cleaning before next check-in."
  }'
```

### 5. Deactivate (Soft Delete) Room Instance

```sh
curl -X DELETE "http://localhost:3000/api/hotels/<hotel_id>/rooms/<room_id>" \
  -H "Authorization: $AUTH_TOKEN"
