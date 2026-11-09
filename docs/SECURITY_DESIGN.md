# Security Architecture & Threat Model — Campus Exchange

**Document Version:** 1.0  
**Status:** Mandatory Security Controls  

---

## 1. Threat Modeling & Key Attack Vectors

| Threat Vector | Attack Scenario | Mitigation Control |
|---|---|---|
| **IDOR (Insecure Direct Object Reference)** | Malicious user modifies another user's listing, cancels someone else's request, or reads private conversations. | Server-side entity ownership checks in every Service method. A request or conversation returns `404 Not Found` if the caller is not a verified owner/participant (avoiding existence leakage). |
| **Inventory Overselling Race Condition** | Two buyers send requests for the last available unit simultaneously; seller clicks accept rapidly on both or two concurrent requests trigger accept. | Pessimistic database row locks (`SELECT ... FOR UPDATE` via `@Lock(LockModeType.PESSIMISTIC_WRITE)`) within atomic `@Transactional` blocks. Available stock check happens *inside* the lock. |
| **Email Spoofing & Domain Bypass** | Attacker registers with arbitrary or unverified email addresses to scam campus members. | Server-side email domain whitelist check (`UNIVERSITY_EMAIL_DOMAINS`) followed by mandatory token verification. Unverified accounts cannot create listings, submit requests, or chat. |
| **Token Theft & XSS Session Hijacking** | Malicious scripts in browser attempt to read stored authentication tokens from `localStorage`. | Authentication credentials are delivered via **HTTP-only, Secure, SameSite=Lax** cookies, preventing JavaScript access. |
| **Malicious File Upload / Remote Code Exec** | Attacker uploads an executable or PHP/shell script disguised as an image. | Multi-tier file inspection: file extension whitelist, HTTP MIME-type validation, and Apache Tika / magic byte header inspection. Uploads are renamed to random UUIDs and saved outside the web root. |
| **Harassment & Unsolicited Messaging** | Aggressive user spams buyers or sellers with unwanted messages. | Gated messaging: conversations can **only** be initiated when a request is explicitly ACCEPTED by the seller. Server-side blocking completely silences message creation. |
| **Brute Force & DoS on Auth Endpoints** | Attacker floods login or email verification with thousands of requests. | Bucket4j / Spring-based rate limiting on sensitive routes (`/api/v1/auth/**`). |

---

## 2. Authentication & Credential Storage

### 2.1 Password Hashing
- BCrypt algorithm with a cost factor of $12$ (`BCryptPasswordEncoder(12)`).
- Passwords must be at least 8 characters, containing uppercase, lowercase, numbers, and special symbols.

### 2.2 Token Management
- **Verification & Reset Tokens:** Stored as `SHA-256` hashes in the database. Even if the database is exposed, raw tokens cannot be recovered.
- **Session Tokens (JWT):**
  - Signed with HMAC-SHA256 using a 256-bit+ secret key configured via environment variables.
  - Validity: 7 days.
  - Payload contains minimal subject (UUID) and role (`ROLE_USER` or `ROLE_ADMIN`).
  - Stored in HTTP-only cookies; Bearer header is also accepted for automated testing.

---

## 3. Authorization & RBAC Matrix

| Endpoint Group | Public | Unverified Student | Verified Student | Admin |
|---|:---:|:---:|:---:|:---:|
| Browse Catalog (`GET /listings`) | ✅ | ✅ | ✅ | ✅ |
| View Product Details (`GET /listings/{id}`) | ✅ | ✅ | ✅ | ✅ |
| Register / Login | ✅ | ✅ | ✅ | ✅ |
| Resend Email Verification | ❌ | ✅ | ❌ | ❌ |
| Create Listing (`POST /listings`) | ❌ | ❌ | ✅ | ✅ |
| Send Item Request (`POST /requests`) | ❌ | ❌ | ✅ | ✅ |
| Access Private Chat (`/conversations/**`) | ❌ | ❌ | ✅ (Participant only) | ❌ (Private) |
| File Moderation Report (`POST /reports`) | ❌ | ✅ | ✅ | ✅ |
| Admin Dashboard & Moderation | ❌ | ❌ | ❌ | ✅ |

---

## 4. Race Condition & Inventory Locking Protocol

To satisfy Section 20.5 (preventing two concurrent requests from reserving the last remaining unit):

```java
@Transactional
public RequestDetailDto acceptRequest(UUID requestId, UUID currentUserId) {
    ItemRequest request = requestRepository.findById(requestId)
        .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

    if (!request.getSellerId().equals(currentUserId)) {
        throw new UnauthorizedException("Only the seller can accept this request");
    }

    if (request.getStatus() != RequestStatus.PENDING) {
        throw new ConflictException("Request is no longer pending");
    }

    // 1. Acquire pessimistic write lock on the listing row
    Listing listing = listingRepository.findByIdForUpdate(request.getListingId())
        .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

    // 2. Validate stock integrity inside the locked boundary
    if (listing.getStatus() != ListingStatus.AVAILABLE || listing.getQuantityAvailable() < request.getQuantityRequested()) {
        throw new ConflictException("Insufficient available stock to accept this request");
    }

    // 3. Atomically adjust stock quantities
    listing.setQuantityAvailable(listing.getQuantityAvailable() - request.getQuantityRequested());
    listing.setQuantityReserved(listing.getQuantityReserved() + request.getQuantityRequested());
    
    if (listing.getQuantityAvailable() == 0) {
        listing.setStatus(ListingStatus.UNAVAILABLE);
    }
    listingRepository.save(listing);

    // 4. Update request status & provision conversation
    request.setStatus(RequestStatus.ACCEPTED);
    request.setAcceptedAt(Instant.now());
    requestRepository.save(request);

    conversationService.createConversationForAcceptedRequest(request);
    notificationService.notifyUser(request.getBuyerId(), NotificationType.REQUEST_ACCEPTED, "Your request was accepted!");

    return requestMapper.toDetailDto(request);
}
```

---

## 5. File Upload Security Specification

Every image upload must satisfy:
1. **Size check:** Max 5MB per file (`spring.servlet.multipart.max-file-size=5MB`).
2. **Format Whitelist:** `image/jpeg`, `image/png`, `image/webp` only.
3. **Magic Byte Verification:** Inspect file signature bytes (e.g., `FF D8 FF` for JPEG, `89 50 4E 47` for PNG) before storage.
4. **Isolated Path:** Files are never stored under server public execution paths. They are mapped to randomly generated UUID filenames (`${UUID}.${ext}`).

---

## 6. Audit Trail & Administrative Accountability

All administrator interventions (user suspension, forced listing removal, report resolution) must write to the `audit_logs` table with:
- `actor_id` (admin user UUID)
- `action` (e.g. `SUSPEND_USER`, `REMOVE_LISTING`)
- `target_id` (affected user or listing UUID)
- `reason` (mandatory explanation string)
- `metadata` (snapshot of the item or user state prior to intervention)
- `created_at` (UTC timestamp)

Audit records are strictly insert-only and cannot be updated or deleted through application APIs.
