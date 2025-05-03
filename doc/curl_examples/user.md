# cURL Examples for User API

This document provides example `curl` commands for interacting with the User API endpoints (`/api/users`).

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).
* Obtain a valid JWT authentication token by logging in via `/api/auth/login`.
* Export the token (including "Bearer ") to an environment variable: `export AUTH_TOKEN="<your_jwt_token>"`.
* Replace placeholders like `<user_id>` and `<hotel_id>` with actual IDs from your database.
* For admin actions, ensure the `$AUTH_TOKEN` belongs to a user with the appropriate role (e.g., HotelAdmin, SuperAdmin).

---

## User API Examples

### Self-Management (`/api/users/me/*`)

These endpoints allow authenticated users to manage their own profile.

**1. Get My Profile**

```sh
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: $AUTH_TOKEN"
```

**2. Update My Profile**

* Only `firstName` and `lastName` can be updated via this endpoint.

```sh
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "UpdatedFirstName",
    "lastName": "UpdatedLastName"
  }'
```

**3. Change My Password**

```sh
curl -X PUT http://localhost:3000/api/users/me/password \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "old_password",
    "newPassword": "new_secure_password"
  }'
```

---

### Admin User Management (`/api/users/*`)

These endpoints are typically restricted to users with administrative roles (e.g., HotelAdmin managing their staff, SuperAdmin managing others). The examples below assume the token belongs to a **HotelAdmin**.

**4. List Users (HotelAdmin scope)**

* A HotelAdmin listing users will typically only see users associated with *their* hotel.

```sh
# List active users in the admin's hotel (default)
curl -X GET "http://localhost:3000/api/users" \
  -H "Authorization: $AUTH_TOKEN"

# List staff users in the admin's hotel
curl -X GET "http://localhost:3000/api/users?role=staff" \
  -H "Authorization: $AUTH_TOKEN"

# List inactive users in the admin's hotel
curl -X GET "http://localhost:3000/api/users?isActive=false" \
  -H "Authorization: $AUTH_TOKEN"
```

**5. Create Staff User (by HotelAdmin)**

* HotelAdmins can typically only create `staff` users associated with their hotel.

```sh
curl -X POST "http://localhost:3000/api/users" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Hotel",
    "lastName": "Staff",
    "email": "staff.member@example-hotel.com",
    "phoneNumber": "+15551234567",
    "password": "staffpassword123",
    "role": "staff"
  }'
# Note: The hotelId is implicitly taken from the HotelAdmin's token/profile by the backend service.
```

**6. Get Specific User Details (HotelAdmin scope)**

* HotelAdmins can typically only get details of users within their own hotel. Replace `<user_id>` with the ID of a staff member in the admin's hotel.

```sh
curl -X GET "http://localhost:3000/api/users/<user_id>" \
  -H "Authorization: $AUTH_TOKEN"
```

**7. Update Specific User (HotelAdmin scope)**

* HotelAdmins can typically update staff within their hotel. They usually cannot change roles to HotelAdmin or deactivate themselves.

```sh
curl -X PATCH "http://localhost:3000/api/users/<user_id>" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "UpdatedStaffName",
    "isActive": true
    # Cannot change role to HotelAdmin via this endpoint as HotelAdmin
  }'
```

**8. Deactivate (Soft Delete) Specific User (HotelAdmin scope)**

* HotelAdmins can typically deactivate staff within their hotel.

```sh
curl -X DELETE "http://localhost:3000/api/users/<user_id>" \
  -H "Authorization: $AUTH_TOKEN"
