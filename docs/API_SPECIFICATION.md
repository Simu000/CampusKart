# REST API Specification — Campus Exchange

**Document Version:** 1.0  
**Base Path:** `/api/v1`  
**Protocol:** HTTPS / JSON  
**Authentication:** HTTP-only Cookie (`jwt_token`) or `Authorization: Bearer <token>`  

---

## 1. Standard API Envelopes & Conventions

### 1.1 Success Response Envelope
All single-entity and operation responses follow this format:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### 1.2 Paginated Collection Envelope
Used for catalog browsing, request lists, and admin tables:
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 12,
    "totalElements": 48,
    "totalPages": 4,
    "first": true,
    "last": false
  }
}
```

### 1.3 Standard Error Response Envelope
```json
{
  "success": false,
  "message": "Validation failed / Unauthorized access",
  "errors": [
    {
      "field": "email",
      "message": "Must be an approved university email address"
    }
  ]
}
```

### 1.4 HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `204 No Content`: Resource deleted or state updated without return payload.
- `400 Bad Request`: Input validation failed or malformed JSON.
- `401 Unauthorized`: Authentication missing or token expired.
- `403 Forbidden`: Authenticated user lacks permission (e.g., non-owner or unverified).
- `404 Not Found`: Target resource does not exist (or concealed to prevent data leakage).
- `409 Conflict`: Business rule violation (e.g., insufficient stock, duplicate pending request).
- `429 Too Many Requests`: Rate limit reached.
- `500 Internal Server Error`: Unhandled exception.

---

## 2. API Endpoints Catalog

### 2.1 Authentication & Profile (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new student; triggers verification email. |
| `POST` | `/auth/login` | Public | Authenticates credentials; returns JWT and sets HTTP-only cookie. |
| `POST` | `/auth/logout` | Authenticated | Clears auth cookie and invalidates session. |
| `GET` | `/auth/me` | Authenticated | Returns current authenticated user and verification status. |
| `GET` | `/auth/verify-email?token={token}` | Public | Verifies token and activates account. |
| `POST` | `/auth/resend-verification` | Public | Resends verification link (rate limited). |
| `POST` | `/auth/forgot-password` | Public | Initiates password reset email. |
| `POST` | `/auth/reset-password` | Public | Resets password using verification token. |

#### Example: `POST /api/v1/auth/register`
**Request:**
```json
{
  "fullName": "Rahul Sharma",
  "email": "rahul.s@university.edu",
  "password": "SecurePassword123!",
  "department": "Computer Science",
  "course": "B.Tech",
  "studyYear": "3rd Year"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your university email for verification.",
  "data": {
    "userId": "d3b07384-d113-4c55-89f1-3a059b0df4ef",
    "email": "rahul.s@university.edu",
    "verified": false
  }
}
```

---

### 2.2 Users & Profiles (`/api/v1/users`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Authenticated | Full profile data of logged-in user. |
| `PUT` | `/users/me` | Authenticated | Update permitted profile fields (department, study year, profile image). |
| `GET` | `/users/{id}/public-profile` | Public | Safe public seller profile (Name, Department, Active Listings count, Joined date). Never exposes email or phone. |

---

### 2.3 Categories (`/api/v1/categories`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/categories` | Public | List all active product categories. |
| `POST` | `/admin/categories` | Admin | Create a new product category. |
| `PUT` | `/admin/categories/{id}` | Admin | Edit an existing category. |
| `DELETE` | `/admin/categories/{id}` | Admin | Deactivate a category (soft delete). |

---

### 2.4 Listings & Catalog (`/api/v1/listings`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/listings` | Public | Browse/search listings with filters (`q`, `type`, `categoryId`, `condition`, `minPrice`, `maxPrice`, `sort`, `page`, `size`). |
| `GET` | `/listings/{id}` | Public | Detailed view of a listing with photos and seller details. |
| `POST` | `/listings` | Verified | Create a new listing. |
| `PUT` | `/listings/{id}` | Owner | Update listing details (title, description, price, condition). |
| `DELETE` | `/listings/{id}` | Owner/Admin | Mark listing as REMOVED (soft delete). |
| `GET` | `/listings/mine` | Authenticated | List all listings created by the current user. |
| `PATCH` | `/listings/{id}/status` | Owner | Manually toggle listing between AVAILABLE and UNAVAILABLE. |

#### Parameters for `GET /api/v1/listings`:
- `q`: Search keyword across title and description.
- `type`: `SELL`, `RENT`, or `LEND`.
- `categoryId`: Numeric ID.
- `condition`: `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`.
- `minPrice`, `maxPrice`: Numeric bounds.
- `sort`: `newest` (default), `price_asc`, `price_desc`.
- `page`: Zero-based page index (default 0).
- `size`: Items per page (default 12, max 50).

---

### 2.5 Listing Images (`/api/v1/listings/{id}/images`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/listings/{id}/images` | Owner | Upload product image (Multipart/form-data; max 5MB; JPEG/PNG/WebP). Max 5 images per listing. |
| `DELETE` | `/listings/{id}/images/{imageId}` | Owner | Delete an uploaded image. |
| `PATCH` | `/listings/{id}/images/{imageId}/primary` | Owner | Designate primary thumbnail image. |

---

### 2.6 Item Requests & Reservations (`/api/v1/requests`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/requests` | Verified | Submit a purchase/rental/borrow request for a listing. |
| `GET` | `/requests/sent` | Authenticated | View requests submitted by current user (as buyer). |
| `GET` | `/requests/received` | Authenticated | View requests received for current user's items (as seller). |
| `GET` | `/requests/{id}` | Participant | View specific request details. |
| `PATCH` | `/requests/{id}/accept` | Seller | Accept request. Atomically reserves stock and creates conversation thread. |
| `PATCH` | `/requests/{id}/decline` | Seller | Decline request. |
| `PATCH` | `/requests/{id}/cancel` | Buyer | Cancel request. If previously accepted, releases reserved stock. |
| `PATCH` | `/requests/{id}/confirm-completion` | Participant | Submit mutual exchange confirmation (Sale closure or Item return). |

---

### 2.7 Conversations & Messages (`/api/v1/conversations`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/conversations` | Authenticated | List user's active conversations linked to accepted requests. |
| `GET` | `/conversations/{id}` | Participant | Retrieve conversation details and product summary. |
| `GET` | `/conversations/{id}/messages` | Participant | Paginated message history (chronological order). |
| `POST` | `/conversations/{id}/messages` | Participant | Send text message (max 2,000 characters). |
| `PATCH` | `/conversations/{id}/read` | Participant | Mark conversation messages as read. |

---

### 2.8 Safety: Blocking & Reporting (`/api/v1`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/users/{id}/block` | Authenticated | Block a user from sending requests or messages. |
| `DELETE` | `/users/{id}/block` | Authenticated | Unblock a user. |
| `GET` | `/users/me/blocked` | Authenticated | List currently blocked users. |
| `POST` | `/reports` | Authenticated | File a report against a user or a listing. |

---

### 2.9 In-App Notifications (`/api/v1/notifications`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications` | Authenticated | List user's recent notifications. |
| `PATCH` | `/notifications/{id}/read` | Recipient | Mark single notification as read. |
| `PATCH` | `/notifications/read-all` | Recipient | Mark all notifications as read. |

---

### 2.10 Admin Operations (`/api/v1/admin`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/dashboard` | Admin | High-level metrics (total users, active listings, pending reports, confirmed exchanges). |
| `GET` | `/admin/users` | Admin | Search/filter registered users. |
| `PATCH` | `/admin/users/{id}/suspend` | Admin | Suspend user account with reason logged to audit trail. |
| `PATCH` | `/admin/users/{id}/reactivate` | Admin | Reactivate suspended user. |
| `GET` | `/admin/listings` | Admin | View/filter all listings across the platform. |
| `DELETE` | `/admin/listings/{id}` | Admin | Force remove prohibited listing. |
| `GET` | `/admin/reports` | Admin | List pending and resolved reports. |
| `PATCH` | `/admin/reports/{id}` | Admin | Resolve or dismiss report with moderator notes. |
| `GET` | `/admin/audit-logs` | Admin | Review immutable moderation audit logs. |
