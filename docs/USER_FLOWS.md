# User Flows & Sequence Diagrams — Campus Exchange

**Document Version:** 1.0  
**Status:** Architecture Blueprint  

---

## 1. Registration & University Email Verification Flow

Only students verified via approved university email domains (`@university.edu`) are permitted to list items or submit requests.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Frontend
    participant AuthController
    participant AuthService
    participant Mailer
    participant DB as PostgreSQL

    Student->>Frontend: Enters Name, University Email, Password
    Frontend->>AuthController: POST /api/v1/auth/register
    AuthController->>AuthService: Validate Domain & Check Uniqueness
    AuthService->>DB: Insert User (verified = false, status = ACTIVE)
    AuthService->>DB: Store EmailVerificationToken (hashed, exp 24h)
    AuthService->>Mailer: Dispatch Verification Link
    AuthController-->>Frontend: 201 Created ("Verification email dispatched")
    Frontend-->>Student: Display "Check your inbox to activate"

    Note over Student, Mailer: Student opens email & clicks link
    Student->>Frontend: Clicks https://app/verify-email?token=xyz
    Frontend->>AuthController: GET /api/v1/auth/verify-email?token=xyz
    AuthController->>AuthService: Validate Token Hash & Expiration
    AuthService->>DB: Set User.verified = true & Token.used_at = now()
    AuthController-->>Frontend: 200 OK ("Account verified")
    Frontend-->>Student: Redirect to Login / Dashboard
```

---

## 2. Listing Creation & Photo Upload Flow

Listings allow up to 5 photos, uploaded and validated before publishing.

```mermaid
sequenceDiagram
    autonumber
    actor Seller
    participant Frontend
    participant ListingController
    participant StorageService
    participant DB as PostgreSQL

    Seller->>Frontend: Fills title, condition, type (SELL/RENT/LEND), price, qty
    Seller->>Frontend: Selects up to 5 photos
    Frontend->>ListingController: POST /api/v1/listings (Multipart / Form)
    ListingController->>ListingController: Verify Seller is Verified Student
    ListingController->>ListingController: Validate file MIME type, magic bytes, size (<5MB)
    loop Each Image
        ListingController->>StorageService: Upload photo to storage
        StorageService-->>ListingController: Return storageKey & public URL
    end
    ListingController->>DB: Insert Listing (status = AVAILABLE, qtyTotal, qtyAvailable)
    ListingController->>DB: Insert ListingImages (urls, storageKeys, is_primary)
    ListingController-->>Frontend: 201 Created (ListingDetails)
    Frontend-->>Seller: Redirect to My Listings / Product Detail
```

---

## 3. Buyer Request Lifecycle & Atomic Stock Reservation

This flow guarantees that two buyers cannot reserve the last available item simultaneously.

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    actor Seller
    participant Frontend
    participant RequestController
    participant DB as PostgreSQL
    participant NotificationService

    Buyer->>Frontend: Views Listing (qtyAvailable = 1) & clicks "Request Item"
    Frontend->>RequestController: POST /api/v1/requests (listingId, qty=1, note)
    RequestController->>DB: Verify Buyer != Seller, Verified, Not Blocked
    RequestController->>DB: Insert ItemRequest (status = PENDING, expires_at = +72h)
    RequestController->>NotificationService: Notify Seller ("New request received")
    RequestController-->>Frontend: 201 Created (Request pending)

    Note over Seller, RequestController: Seller accepts the request
    Seller->>Frontend: Clicks "Accept Request"
    Frontend->>RequestController: PATCH /api/v1/requests/{id}/accept
    
    critical Atomic Stock Reservation Under Pessimistic Lock
        RequestController->>DB: SELECT * FROM listings WHERE id = ... FOR UPDATE
        RequestController->>DB: Validate qtyAvailable >= requestedQty
        RequestController->>DB: UPDATE listings SET qtyAvailable -= 1, qtyReserved += 1
        RequestController->>DB: UPDATE item_requests SET status = 'ACCEPTED', accepted_at = now()
        RequestController->>DB: INSERT INTO conversations (request_id, buyer_id, seller_id)
    end

    RequestController->>NotificationService: Notify Buyer ("Your request was accepted! Chat is open.")
    RequestController-->>Frontend: 200 OK (Accepted, Conversation Created)
    Frontend-->>Seller: Display chat button and conversation link
```

---

## 4. Private Messaging Workflow (Post-Acceptance)

Unrestricted chat opens **strictly after** the seller accepts the request.

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    actor Seller
    participant Frontend
    participant ConversationController
    participant DB as PostgreSQL

    Buyer->>Frontend: Opens Chat for Accepted Request
    Frontend->>ConversationController: GET /api/v1/conversations/{id}/messages
    ConversationController->>DB: Verify User is Participant (Buyer or Seller)
    ConversationController-->>Frontend: 200 OK (Message list)

    Buyer->>Frontend: Types "Can we meet at the library at 4 PM?"
    Frontend->>ConversationController: POST /api/v1/conversations/{id}/messages
    ConversationController->>DB: Verify User != Blocked & Conversation Active
    ConversationController->>DB: Insert Message
    ConversationController-->>Frontend: 201 Created (Message)

    Note over Frontend, Seller: Seller client polls every 3-5 seconds
    Seller->>Frontend: Receives new message in chat window
```

---

## 5. Mutual Exchange Completion Flow

Prevents one party from dishonestly completing or closing an exchange without the other party's confirmation.

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    actor Seller
    participant Frontend
    participant RequestController
    participant DB as PostgreSQL

    Note over Buyer, Seller: Students meet on campus, exchange item & settle cash/UPI
    Seller->>Frontend: Clicks "Mark Exchange Complete"
    Frontend->>RequestController: PATCH /api/v1/requests/{id}/confirm-completion
    RequestController->>DB: Insert ExchangeConfirmation (by Seller, type = SALE_COMPLETED)
    RequestController-->>Frontend: 200 OK ("Awaiting Buyer confirmation")

    Buyer->>Frontend: Sees prompt "Please confirm you received this item"
    Buyer->>Frontend: Clicks "Confirm Receipt"
    Frontend->>RequestController: PATCH /api/v1/requests/{id}/confirm-completion
    RequestController->>DB: Insert ExchangeConfirmation (by Buyer, type = SALE_COMPLETED)

    critical Inventory Closure (Both Confirmations Present)
        RequestController->>DB: Check: Both Buyer & Seller have confirmed? YES
        RequestController->>DB: SELECT * FROM listings WHERE id = ... FOR UPDATE
        alt Transaction Type is SELL
            RequestController->>DB: UPDATE listings SET qtyReserved -= 1, qtyTotal -= 1
        else Transaction Type is RENT or LEND
            RequestController->>DB: UPDATE listings SET qtyReserved -= 1, qtyAvailable += 1
        end
        RequestController->>DB: UPDATE item_requests SET status = 'COMPLETED'
        RequestController->>DB: If qtyTotal == 0, SET listing.status = 'COMPLETED'
    end
    RequestController-->>Frontend: 200 OK (Exchange Finalized)
```

---

## 6. Safety: Reporting & Blocking Flow

```mermaid
sequenceDiagram
    autonumber
    actor Reporter
    actor Admin
    participant Frontend
    participant ModerationController
    participant AdminController
    participant DB as PostgreSQL

    Reporter->>Frontend: Submits report ("Prohibited Item / Scam")
    Frontend->>ModerationController: POST /api/v1/reports
    ModerationController->>DB: Insert Report (status = PENDING)
    ModerationController-->>Frontend: 201 Created ("Report submitted for review")

    Note over Admin, AdminController: Admin reviews in Moderation Dashboard
    Admin->>Frontend: Opens Admin Dashboard
    Frontend->>AdminController: GET /api/v1/admin/reports
    AdminController->>DB: Fetch pending reports with listing & user metadata
    AdminController-->>Frontend: 200 OK (Report list)

    Admin->>Frontend: Clicks "Remove Prohibited Listing & Suspend Account"
    Frontend->>AdminController: DELETE /api/v1/admin/listings/{id}
    AdminController->>DB: UPDATE listings SET status = 'REMOVED'
    AdminController->>DB: UPDATE users SET account_status = 'SUSPENDED'
    AdminController->>DB: INSERT INTO audit_logs (actor_id, action, target_id, reason)
    AdminController-->>Frontend: 200 OK ("Action logged and enforced")
```
