# cURL Examples for Hotel API

This document provides example `curl` commands for interacting with the Hotel API endpoints (`/api/hotels`).

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).
* Obtain a valid JWT authentication token by logging in via `/api/auth/login`.
* Export the token (including "Bearer ") to an environment variable: `export AUTH_TOKEN="<your_jwt_token>"`.
* Replace placeholders like `<hotel_id>` with actual IDs from your database.
* For hotel management actions (`/`, `/my-hotel`), ensure the `$AUTH_TOKEN` belongs to a user with the `HotelAdmin` role.

---

## Hotel API Examples

### Hotel Admin Management

These endpoints are for HotelAdmins to manage the hotel they created/are associated with.

**1. Create Hotel**

* Requires `HotelAdmin` role. The user calling this should *not* already be associated with a hotel. (This flow might be adjusted depending on exact business logic - e.g., maybe SuperAdmin creates the HotelAdmin first, then the HotelAdmin creates their hotel).

```sh
curl -X POST "http://localhost:3000/api/hotels" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grand Example Hotel",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zipCode": "90210",
      "country": "USA"
    },
    "phoneNumber": ["+1-555-100-1234"],
    "email": "info@grandexample.com",
    "description": "A luxurious hotel in the heart of Anytown.",
    "amenities": ["Pool", "Gym", "Free Wifi", "Restaurant", "Parking"],
    "checkInTime": "15:00",
    "checkOutTime": "11:00"
  }'
```

**2. Get My Hotel**

* Requires `HotelAdmin` role. Retrieves the hotel associated with the calling admin.

```sh
curl -X GET "http://localhost:3000/api/hotels/my-hotel" \
  -H "Authorization: $AUTH_TOKEN"
```

**3. Update My Hotel**

* Requires `HotelAdmin` role. Updates the hotel associated with the calling admin.

```sh
curl -X PATCH "http://localhost:3000/api/hotels/my-hotel" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "A newly renovated, luxurious hotel in the heart of Anytown.",
    "amenities": ["Pool", "Gym", "Free Wifi", "Restaurant", "Parking", "Spa"]
  }'
```

**4. Deactivate (Soft Delete) My Hotel**

* Requires `HotelAdmin` role. Deactivates the hotel associated with the calling admin and its associated rooms/room types.

```sh
curl -X DELETE "http://localhost:3000/api/hotels/my-hotel" \
  -H "Authorization: $AUTH_TOKEN"
```

---

### Public Access

These endpoints are generally accessible by any authenticated user.

**5. List Hotels**

```sh
# List active hotels (default)
curl -X GET "http://localhost:3000/api/hotels" \
  -H "Authorization: $AUTH_TOKEN"

# List hotels in a specific city with pagination
curl -X GET "http://localhost:3000/api/hotels?city=Anytown&page=1&limit=5" \
  -H "Authorization: $AUTH_TOKEN"

# List inactive hotels (requires appropriate permissions if restricted)
# curl -X GET "http://localhost:3000/api/hotels?isActive=false" \
#  -H "Authorization: $AUTH_TOKEN"
```

**6. Get Specific Hotel Details**

* Retrieves details for an active hotel by its ID.

```sh
curl -X GET "http://localhost:3000/api/hotels/<hotel_id>" \
  -H "Authorization: $AUTH_TOKEN"
