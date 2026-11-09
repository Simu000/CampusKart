# Comprehensive Test Plan — Campus Exchange

**Document Version:** 1.0  
**Status:** Verification Baseline  

---

## 1. Testing Strategy Overview

Quality assurance for Campus Exchange spans four levels:
1. **Unit Testing:** Isolated business logic in services, token hashing, and validators using JUnit 5 and Mockito.
2. **Integration Testing:** Spring Boot slicing (`@SpringBootTest`, `@AutoConfigureMockMvc`) testing full HTTP -> Controller -> Service -> JPA -> DB cycles.
3. **Concurrency & Race Condition Testing:** Multi-threaded executor tests verifying atomic stock reservation under pessimistic locking.
4. **End-to-End & Security Boundary Testing:** Explicit verification of IDOR blocks, role checks, and email verification guards.

---

## 2. Test Suites by Module

### 2.1 Authentication & University Verification Tests
| Test Case ID | Test Description | Expected Result |
|---|---|---|
| `AUTH-01` | Register with valid university email (`user@university.edu`) | 201 Created; user created with `verified=false`; verification email dispatched. |
| `AUTH-02` | Register with non-university domain (e.g., `gmail.com`) when domain is restricted | 400 Bad Request ("Please use your university email address"). |
| `AUTH-03` | Register with already registered email | 409 Conflict ("An account with this email already exists"). |
| `AUTH-04` | Verify email with valid, unexpired token | 200 OK; `user.verified` set to true; token `used_at` populated. |
| `AUTH-05` | Verify email with expired token | 400 Bad Request ("Verification token has expired"). |
| `AUTH-06` | Reuse previously used verification token | 400 Bad Request ("Token already used"). |
| `AUTH-07` | Unverified user attempts to create listing | 403 Forbidden ("Please verify your university email first"). |
| `AUTH-08` | Unverified user attempts to send item request | 403 Forbidden ("Please verify your university email first"). |

---

### 2.2 Listings & Catalog Tests
| Test Case ID | Test Description | Expected Result |
|---|---|---|
| `LIST-01` | Create valid `SELL` listing with price > 0 and photos | 201 Created; status `AVAILABLE`; stock total & available set. |
| `LIST-02` | Create `SELL` listing with zero or negative price | 400 Bad Request ("Price must be greater than zero for items for sale"). |
| `LIST-03` | Create `RENT` listing with valid pricing basis (`PER_DAY`) | 201 Created. |
| `LIST-04` | Create `RENT` listing without pricing basis | 400 Bad Request ("Choose a rental pricing basis"). |
| `LIST-05` | Create `LEND` listing | 201 Created; price defaults to 0.00. |
| `LIST-06` | Non-owner attempts to edit or delete someone else's listing | 403 Forbidden. |
| `LIST-07` | Search catalog with keyword, category filter, and sort | 200 OK with paginated list matching criteria. |
| `LIST-08` | Upload image exceeding 5MB | 400 Bad Request ("File size exceeds limit"). |
| `LIST-09` | Upload invalid MIME type (e.g. `.exe` or `.sh`) | 400 Bad Request ("Invalid image format"). |

---

### 2.3 Request Engine & Concurrency Tests (Critical)
| Test Case ID | Test Description | Expected Result |
|---|---|---|
| `REQ-01` | Buyer sends request for available item | 201 Created; status `PENDING`. |
| `REQ-02` | Buyer requests their own listing | 400 Bad Request ("You cannot request your own listing"). |
| `REQ-03` | Buyer requests more quantity than available | 409 Conflict ("Requested quantity exceeds available stock"). |
| `REQ-04` | Buyer sends second pending request for same listing | 409 Conflict ("You already have a pending request for this item"). |
| `REQ-05` | Seller accepts pending request with sufficient stock | 200 OK; `qtyAvailable` decremented, `qtyReserved` incremented; conversation provisioned. |
| `REQ-06` | Seller declines pending request | 200 OK; status `DECLINED`; stock unchanged; no conversation created. |
| `REQ-07` | Buyer cancels accepted request | 200 OK; reserved stock released back to `qtyAvailable`. |
| `REQ-08` | **Concurrency Race Test:** Listing has 1 unit available. Two concurrent threads attempt to accept two different pending requests at the same instant. | **Exactly one thread succeeds (200 OK); the second fails with 409 Conflict.** Available stock remains 0 and never becomes negative. |

#### Implementation of Concurrency Test (`InventoryConcurrencyTest.java`):
```java
@Test
void testConcurrentAcceptancePreventsOverselling() throws Exception {
    // Given: Listing with qtyAvailable = 1, and two pending requests
    Listing listing = createTestListing(1);
    ItemRequest reqA = createTestRequest(listing, buyer1, 1);
    ItemRequest reqB = createTestRequest(listing, buyer2, 1);

    ExecutorService executor = Executors.newFixedThreadPool(2);
    CountDownLatch latch = new CountDownLatch(1);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger conflictCount = new AtomicInteger(0);

    Callable<Void> taskA = () -> {
        latch.await();
        try {
            requestService.acceptRequest(reqA.getId(), seller.getId());
            successCount.incrementAndGet();
        } catch (ConflictException e) {
            conflictCount.incrementAndGet();
        }
        return null;
    };

    Callable<Void> taskB = () -> {
        latch.await();
        try {
            requestService.acceptRequest(reqB.getId(), seller.getId());
            successCount.incrementAndGet();
        } catch (ConflictException e) {
            conflictCount.incrementAndGet();
        }
        return null;
    };

    Future<Void> f1 = executor.submit(taskA);
    Future<Void> f2 = executor.submit(taskB);
    latch.countDown(); // trigger both simultaneously

    f1.get(); f2.get();

    assertEquals(1, successCount.get(), "Only one request should be accepted");
    assertEquals(1, conflictCount.get(), "Second request should conflict due to exhausted stock");

    Listing updated = listingRepository.findById(listing.getId()).orElseThrow();
    assertEquals(0, updated.getQuantityAvailable());
    assertEquals(1, updated.getQuantityReserved());
}
```

---

### 2.4 Messaging & Safety Tests
| Test Case ID | Test Description | Expected Result |
|---|---|---|
| `MSG-01` | Buyer & Seller exchange messages after request acceptance | 201 Created; messages visible in chronological order. |
| `MSG-02` | Third-party user attempts to access conversation (`/conversations/{id}/messages`) | 404 Not Found (concealing conversation existence). |
| `MSG-03` | User attempts to send message to a declined or pending request | 403 Forbidden ("Chat opens only after request acceptance"). |
| `MSG-04` | User A blocks User B; User B attempts to send message or request to User A | 403 Forbidden ("Action not allowed"). |
| `MSG-05` | User submits report with category and description | 201 Created; report queued in pending status. |

---

### 2.5 Admin & Moderation Tests
| Test Case ID | Test Description | Expected Result |
|---|---|---|
| `ADM-01` | Non-admin user attempts to access `/api/v1/admin/**` | 403 Forbidden. |
| `ADM-02` | Admin suspends user account | 200 OK; user status `SUSPENDED`; action logged in `audit_logs`. |
| `ADM-03` | Suspended user attempts to log in | 403 Forbidden ("This account is suspended"). |
| `ADM-04` | Admin force-removes prohibited listing | 200 OK; listing status `REMOVED`; action logged in `audit_logs`. |
| `ADM-05` | Removed listing omitted from public catalog browse | Verify removed listing is excluded from search results. |
