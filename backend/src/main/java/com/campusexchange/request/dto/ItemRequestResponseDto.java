package com.campusexchange.request.dto;

import com.campusexchange.listing.Listing;
import com.campusexchange.request.ItemRequest;

import java.time.Instant;

public record ItemRequestResponseDto(
        Long id,
        Long listingId,
        String listingTitle,
        String transactionType,
        String listingImageUrl,
        int quantity,
        String note,
        String status,
        Long buyerId,
        String buyerName,
        Long sellerId,
        String sellerName,
        Instant expiresAt,
        Instant createdAt
) {
    public static ItemRequestResponseDto from(ItemRequest req, Listing listing, String buyerName, String sellerName) {
        return new ItemRequestResponseDto(
                req.getId(),
                req.getListingId(),
                listing != null ? listing.getTitle() : "Unavailable Item",
                listing != null ? listing.getTransactionType() : "SELL",
                listing != null ? listing.getImageUrl() : null,
                req.getQuantity(),
                req.getNote(),
                req.getStatus(),
                req.getBuyerId(),
                buyerName,
                req.getSellerId(),
                sellerName,
                req.getExpiresAt(),
                req.getCreatedAt()
        );
    }
}
