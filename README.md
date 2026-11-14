# Campus Exchange — University Student Marketplace

A university-exclusive student-to-student marketplace enabling verified students to **buy, sell, rent, and lend** items safely within their university campus.

- **Frontend**: React (Vite, React Router v6, custom responsive modern design system)
- **Backend**: Node.js & Express (Modular architecture: Controller → Service → Repository → Database)
- **Database (Polyglot Persistence)**:
  - **PostgreSQL**: Relational core (Users, Listings, Requests, Stock Locks, Relational constraints)
  - **MongoDB**: Document store (High-throughput private chat threads, messages & conversations via Mongoose)
- **Security**: JWT + HTTP-Only Cookies, BCrypt password hashing, rate limiting, domain validation, anti-IDOR checks

---

## 🏗️ 4-Layer Architecture

```
backend/src/
├── controllers/       # HTTP Request/Response handling & validation
│   ├── adminController.js     # Admin dashboard, user moderation & audit logs
│   ├── userController.js      # Student profile & avatar upload
│   └── reportController.js    # Reports & block management
├── services/          # Core business logic & integrations
│   ├── email.js               # Nodemailer & verification/reset tokens
│   └── notification.js        # In-app notification creation & state
├── repositories/      # Database queries (SQL abstraction)
│   ├── userRepository.js      # User accounts & statuses
│   ├── listingRepository.js   # Listings & image queries
│   ├── reportRepository.js    # Moderation reports
│   ├── blockRepository.js     # Peer blocking relations
│   ├── categoryRepository.js  # Category management
│   └── auditRepository.js     # Audit log persistence
├── dtos/              # Data Transfer Objects & safe field mapping
│   ├── userDto.js             # User summary & safe public profiles
│   └── listingDto.js          # Listing response & report shaping
├── middleware/        # Express middleware pipeline
│   ├── auth.js                # JWT verification, requireAdmin, requireVerified
│   ├── errors.js              # Centralized error classes & handler
│   └── rateLimiter.js         # Endpoint rate limiting protection
├── models/            # Mongoose MongoDB schemas (NoSQL Document Store)
│   ├── Message.js             # Chat messages collection
│   └── Conversation.js        # Active chat threads & metadata
├── routes/            # Route mounting & dispatching
│   ├── auth.js                # Register, Login, Verify, Reset Password
│   ├── listings.js            # Listing catalog, CRUD, stock management
│   ├── requests.js            # Requests, stock reservation, mutual confirmation
│   ├── conversations.js       # MongoDB-backed private messaging & threads
│   ├── users.js               # Own profile, public profile & blocking
│   ├── reports.js             # Listing & user reports
│   ├── admin.js               # Protected admin endpoints (role-gated)
│   ├── categories.js          # Marketplace categories
│   └── notifications.js       # Student in-app notifications
├── jobs/              # Background cron tasks
│   └── requestExpiry.js       # Auto-expires stale 72h requests
└── db/                # Database pool & migrations
    ├── pool.js                # PostgreSQL connection pool (pg)
    ├── mongo.js               # MongoDB connection manager (Mongoose)
    ├── schema.sql             # Full PostgreSQL DDL schema (14 tables & constraints)
    ├── migrate.js             # Database migration runner
    └── seed.js                # Demo accounts & sample listings seeder
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL (running locally or cloud instance)
- MongoDB (running locally on port 27017 or a free cloud MongoDB Atlas cluster)

### 1. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE campus_exchange;
```

Configure your environment in `backend/.env`:
```env
PORT=3000
NODE_ENV=development

# PostgreSQL (Marketplace, Users, Inventory)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campus_exchange
DB_USER=postgres
DB_PASSWORD=your_password_here

# MongoDB (Private Chat & Messaging)
MONGO_URI=mongodb://localhost:27017/campus_exchange

JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
UNIVERSITY_EMAIL_DOMAINS=university.edu
FRONTEND_URL=http://localhost:5173
```

Run schema migrations and seed initial data:
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

### 2. Run Backend
```bash
cd backend
npm run dev     # Starts server on http://localhost:3000
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev     # Starts Vite dev server on http://localhost:5173
```

---

## 🔑 Demo Accounts (from `npm run db:seed`)

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Administrator** | `admin@university.edu` | `Admin@123` | Full admin dashboard, user suspension, listing removal, report review, category management |
| **Student (Seller/Buyer)** | `rahul.sharma@university.edu` | `Student@123` | Verified student, can post listings, send requests, chat |
| **Student (Seller/Buyer)** | `priya.patel@university.edu` | `Student@123` | Verified student, can post listings, send requests, chat |
| **Student (Seller/Buyer)** | `ananya.verma@university.edu` | `Student@123` | Verified student, can post listings, send requests, chat |

---

## 📋 Features Implemented

1. **Authentication & Campus Verification**
   - University email domain restriction
   - Time-limited tokenized email verification
   - Password reset via email token
   - Secure BCrypt hashing (12 salt rounds)
   - Dual authentication support: HTTP-only cookies and Bearer tokens

2. **Marketplace & Listings**
   - Real-time search by keywords and description
   - Multi-filtering: Category, Condition (`NEW`, `LIKE_NEW`, `GOOD`, `FAIR`), Transaction Type (`SELL`, `RENT`, `LEND`), Price Range, Sorting
   - Multi-image upload with local file storage & primary image selection
   - Safe soft-deletion with inventory safeguards
   - Edit listing page with quantity reservation safeguards

3. **Request & Inventory Workflow**
   - Atomic inventory reservation using PostgreSQL pessimistic locks (`SELECT ... FOR UPDATE`)
   - 72-hour automated background request expiration via node-cron
   - Mutual exchange completion: requires confirmations from both buyer and seller before permanently decrementing inventory
   - Prevents self-requesting and overselling

4. **Private Messaging & Safety**
   - Private chat unlocks only after request acceptance
   - Full server-side blocking enforcement (blocked users cannot send requests or messages)
   - User reporting system with category classification & admin review interface
   - Protected Admin Dashboard with user suspension/reactivation, listing removal, audit logging

5. **In-App Notifications**
   - Real-time polling notification bell with badge counter
   - Automated event alerts for: request received, accepted, declined, expired, exchange completed, listing removed, account actions
   - 1-click mark read & mark all read

6. **Mobile-Responsive UI**
   - Clean, lightweight modern marketplace design system
   - Bottom navigation bar for mobile devices
   - Verification status banner with 1-click resend link
