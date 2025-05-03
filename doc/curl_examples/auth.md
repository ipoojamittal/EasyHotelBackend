# cURL Examples for Auth API

This document provides example `curl` commands for interacting with the Authentication API endpoints (`/api/auth`).

**Prerequisites:**

* Ensure the API server is running (e.g., `http://localhost:3000`).

---

## Auth API Examples

### 1. Login User

* Logs in an existing user (Customer, Staff, HotelAdmin, SuperAdmin) and returns a JWT token.

```sh
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }'

# Example Response:
# {
#   "message": "Login successful",
#   "token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {
#     "id": "...",
#     "email": "admin@test.com",
#     "firstName": "Super",
#     "lastName": "Admin",
#     "role": "superAdmin"
#   }
# }

# After login, export the token (including "Bearer ") for subsequent requests:
# export AUTH_TOKEN="<your_jwt_token>"
```

### 2. Register New Customer

* Registers a new user with the `customer` role.

```sh
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+19876543210",
    "password": "password123"
  }'

# Example Response:
# {
#   "message": "User successfully registered as Customer",
#   "userId": "..."
# }
```

### 3. Check Authentication Status

* Verifies the provided JWT token and returns the authenticated user's information.
* Requires the `Authorization` header with a valid token.

```sh
# Ensure AUTH_TOKEN is set (see Login example)
curl -X GET http://localhost:3000/api/auth/status \
  -H "Authorization: $AUTH_TOKEN"

# Example Response (if token is valid):
# {
#   "isAuthenticated": true,
#   "user": {
#     "id": "...",
#     "firstName": "Super",
#     "lastName": "Admin",
#     "email": "admin@test.com",
#     "phoneNumber": "+1234567890",
#     "role": "superAdmin",
#     "isEmailVerified": true,
#     "isPhoneVerified": true,
#     "createdAt": "...",
#     "updatedAt": "..."
#     // hotelId might be present for HotelAdmin/Staff roles
#   }
# }

# Example Response (if token is invalid/expired):
# Status: 401 Unauthorized
# { "message": "Invalid token. Please log in again." }
# or
# { "message": "Your token has expired. Please log in again." }
