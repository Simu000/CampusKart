package com.campusexchange.request;

import com.campusexchange.common.exception.BadRequestException;
import com.campusexchange.common.exception.ConflictException;
import com.campusexchange.common.exception.ResourceNotFoundException;
import com.campusexchange.common.exception.UnauthorizedException;
import com.campusexchange.common.response.ApiResponse;
import com.campusexchange.listing.Listing;
import com.campusexchange.listing.ListingRepository;
import com.campusexchange.request.dto.CreateItemRequest;
import com.campusexchange.request.dto.ItemRequestResponseDto;
import com.campusexchange.user.User;
import com.campusexchange.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/requests")
public class RequestController {
    private final ItemRequestRepository requestRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public RequestController(ItemRequestRepository requestRepository,
                             ListingRepository listingRepository,
                             UserRepository userRepository) {
        this.requestRepository = requestRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    private ItemRequestResponseDto toDto(ItemRequest req) {
        Listing listing = listingRepository.findById(req.getListingId()).orElse(null);
        String buyerName = userRepository.findById(req.getBuyerId()).map(User::getFullName).orElse("Unknown Student");
        String sellerName = userRepository.findById(req.getSellerId()).map(User::getFullName).orElse("Unknown Student");
        return ItemRequestResponseDto.from(req, listing, buyerName, sellerName);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<ItemRequestResponseDto> createRequest(@Valid @RequestBody CreateItemRequest req,
                                                             @AuthenticationPrincipal Long currentUserId) {
        User buyer = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found"));

        if (!buyer.isVerified()) {
            throw new UnauthorizedException("Please verify your university email before submitting item requests.");
        }

        Listing listing = listingRepository.findById(req.listingId())
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getSellerId().equals(currentUserId)) {
            throw new BadRequestException("You cannot request your own listing");
        }

        if (!"AVAILABLE".equals(listing.getStatus())) {
            throw new ConflictException("This listing is currently unavailable");
        }

        if (req.quantity() > listing.getQtyAvailable()) {
            throw new ConflictException("Only " + listing.getQtyAvailable() + " unit(s) available");
        }

        if (requestRepository.existsByListingIdAndBuyerIdAndStatus(listing.getId(), currentUserId, "PENDING")) {
            throw new ConflictException("You already have an active pending request for this item");
        }

        ItemRequest itemRequest = new ItemRequest();
        itemRequest.setListingId(listing.getId());
        itemRequest.setBuyerId(currentUserId);
        itemRequest.setSellerId(listing.getSellerId());
        itemRequest.setQuantity(req.quantity());
        itemRequest.setNote(req.note() != null ? req.note().trim() : null);

        ItemRequest saved = requestRepository.save(itemRequest);
        return ApiResponse.success("Request sent to seller", toDto(saved));
    }

    @GetMapping("/sent")
    public ApiResponse<List<ItemRequestResponseDto>> getSentRequests(@AuthenticationPrincipal Long currentUserId) {
        List<ItemRequestResponseDto> dtos = requestRepository.findByBuyerIdOrderByCreatedAtDesc(currentUserId)
                .stream()
                .map(this::toDto)
                .toList();
        return ApiResponse.success(dtos);
    }

    @GetMapping("/received")
    public ApiResponse<List<ItemRequestResponseDto>> getReceivedRequests(@AuthenticationPrincipal Long currentUserId) {
        List<ItemRequestResponseDto> dtos = requestRepository.findBySellerIdOrderByCreatedAtDesc(currentUserId)
                .stream()
                .map(this::toDto)
                .toList();
        return ApiResponse.success(dtos);
    }

    @GetMapping("/{id}")
    public ApiResponse<ItemRequestResponseDto> getRequest(@PathVariable Long id,
                                                          @AuthenticationPrincipal Long currentUserId) {
        ItemRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

        if (!currentUserId.equals(req.getBuyerId()) && !currentUserId.equals(req.getSellerId())) {
            throw new ResourceNotFoundException("Request not found"); // Prevents IDOR probe
        }

        return ApiResponse.success(toDto(req));
    }

    @PatchMapping("/{id}/accept")
    @Transactional
    public ApiResponse<ItemRequestResponseDto> acceptRequest(@PathVariable Long id,
                                                             @AuthenticationPrincipal Long currentUserId) {
        ItemRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

        if (!currentUserId.equals(req.getSellerId())) {
            throw new UnauthorizedException("Only the seller can accept this request");
        }

        if (!"PENDING".equals(req.getStatus())) {
            throw new ConflictException("Request is no longer pending");
        }

        // Acquire pessimistic row-level lock on listing to prevent overselling
        Listing listing = listingRepository.lockById(req.getListingId())
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!"AVAILABLE".equals(listing.getStatus()) || listing.getQtyAvailable() < req.getQuantity()) {
            throw new ConflictException("Insufficient stock available to fulfill this request");
        }

        listing.setQtyAvailable(listing.getQtyAvailable() - req.getQuantity());
        listing.setQtyReserved(listing.getQtyReserved() + req.getQuantity());
        if (listing.getQtyAvailable() == 0) {
            listing.setStatus("UNAVAILABLE");
        }
        listingRepository.save(listing);

        req.setStatus("ACCEPTED");
        req.setAcceptedAt(Instant.now());
        ItemRequest saved = requestRepository.save(req);

        return ApiResponse.success("Request accepted. Conversation is now active.", toDto(saved));
    }

    @PatchMapping("/{id}/decline")
    @Transactional
    public ApiResponse<ItemRequestResponseDto> declineRequest(@PathVariable Long id,
                                                              @AuthenticationPrincipal Long currentUserId) {
        ItemRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

        if (!currentUserId.equals(req.getSellerId())) {
            throw new UnauthorizedException("Only the seller can decline this request");
        }

        if (!"PENDING".equals(req.getStatus())) {
            throw new ConflictException("Request is no longer pending");
        }

        req.setStatus("DECLINED");
        req.setDeclinedAt(Instant.now());
        ItemRequest saved = requestRepository.save(req);

        return ApiResponse.success("Request declined", toDto(saved));
    }

    @PatchMapping("/{id}/cancel")
    @Transactional
    public ApiResponse<ItemRequestResponseDto> cancelRequest(@PathVariable Long id,
                                                             @AuthenticationPrincipal Long currentUserId) {
        ItemRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

        if (!currentUserId.equals(req.getBuyerId())) {
            throw new UnauthorizedException("Only the buyer can cancel this request");
        }

        if (!List.of("PENDING", "ACCEPTED").contains(req.getStatus())) {
            throw new ConflictException("This request cannot be cancelled at this stage");
        }

        // If cancelling an already accepted request, release reserved stock under lock
        if ("ACCEPTED".equals(req.getStatus())) {
            Listing listing = listingRepository.lockById(req.getListingId())
                    .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
            releaseStock(listing, req.getQuantity(), false);
            listingRepository.save(listing);
        }

        req.setStatus("CANCELLED");
        ItemRequest saved = requestRepository.save(req);

        return ApiResponse.success("Request cancelled", toDto(saved));
    }

    @PatchMapping("/{id}/complete")
    @Transactional
    public ApiResponse<ItemRequestResponseDto> completeRequest(@PathVariable Long id,
                                                               @AuthenticationPrincipal Long currentUserId) {
        ItemRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found"));

        if (!currentUserId.equals(req.getSellerId())) {
            throw new UnauthorizedException("Only the seller can mark this exchange complete");
        }

        if (!"ACCEPTED".equals(req.getStatus())) {
            throw new ConflictException("Only accepted requests can be marked as completed");
        }

        Listing listing = listingRepository.lockById(req.getListingId())
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        boolean isPermanentSale = "SELL".equals(listing.getTransactionType());
        releaseStock(listing, req.getQuantity(), isPermanentSale);
        listingRepository.save(listing);

        req.setStatus("COMPLETED");
        ItemRequest saved = requestRepository.save(req);

        return ApiResponse.success("Exchange marked as completed", toDto(saved));
    }

    private void releaseStock(Listing listing, int quantity, boolean sold) {
        listing.setQtyReserved(Math.max(0, listing.getQtyReserved() - quantity));
        if (sold) {
            listing.setQtyTotal(Math.max(0, listing.getQtyTotal() - quantity));
        } else {
            listing.setQtyAvailable(listing.getQtyAvailable() + quantity);
        }

        if (listing.getQtyTotal() == 0) {
            listing.setStatus("COMPLETED");
        } else if ("UNAVAILABLE".equals(listing.getStatus()) && listing.getQtyAvailable() > 0) {
            listing.setStatus("AVAILABLE");
        }
    }
}
