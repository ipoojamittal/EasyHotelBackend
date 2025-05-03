# cURL Examples for Admin API

This document provides example `curl` commands for interacting with the high-level Admin API endpoints (`/api/admin`). These endpoints are typically restricted to users with the `SuperAdmin` role.

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).
* Obtain a valid JWT authentication token for a **SuperAdmin** user by logging in via `/api/auth/login`.
* Export the token (including "Bearer ") to an environment variable: `export SUPER_ADMIN_AUTH_TOKEN="<your_super_admin_jwt_token>"`.
* Replace placeholders like `<hotel_id>` with actual IDs if creating Staff associated with an existing hotel.

---

## Admin API Examples

### 1. Create HotelAdmin or Staff User (by SuperAdmin)

* This endpoint allows a SuperAdmin to create users with `HotelAdmin` or `Staff` roles.
* `hotelId` is **required** when creating a `Staff` user.
* `hotelId` must **not** be provided when creating a `HotelAdmin`.

```sh
# Example: Create a HotelAdmin
curl -X POST "http://localhost:3000/api/admin/create-user" \
  -H "Authorization: $SUPER_ADMIN_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "NewHotel",
    "lastName": "Admin",
    "email": "new.hotel.admin@example.com",
    "phoneNumber": "+17778889999",
    "password": "hoteladminpassword",
    "role": "hotelAdmin"
  }'

# Example: Create a Staff member for an existing hotel
curl -X POST "http://localhost:3000/api/admin/create-user" \
  -H "Authorization: $SUPER_ADMIN_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "FrontDesk",
    "lastName": "Staff",
    "email": "front.desk@existinghotel.com",
    "phoneNumber": "+16667778888",
    "password": "staffpassword",
    "role": "staff",
    "hotelId": "<hotel_id_for_staff_member>"
  }'
