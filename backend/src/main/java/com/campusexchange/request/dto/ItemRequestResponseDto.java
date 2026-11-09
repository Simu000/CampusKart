package com.campusexchange.request.dto;

import com.campusexchange.listing.Listing;
import com.campusexchange.request.ExchangeConfirmation;
import com.campusexchange.request.ItemRequest;

import java.time.Instant;
import java.util.List;

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
        boolean isConfirmedByBuyer,
        boolean isConfirmedBySeller,
        boolean hasCurrentUserConfirmed,
        boolean canConfirm,
        boolean awaitingPeerConfirmation,
        boolean peerHasConfirmed,
        Instant expiresAt,
        Instant createdAt
) {
    public static ItemRequestResponseDto from(ItemRequest req,
                                             Listing listing,
                                             String buyerName,
                                             String sellerName,
                                             List<ExchangeConfirmation> confirmations,
                                             Long currentUserId) {
        boolean confirmedByBuyer = confirmations != null && confirmations.stream()
                .anyMatch(c -> c.getConfirmedBy().equals(req.getBuyerId()));
        boolean confirmedBySeller = confirmations != null && confirmations.stream()
                .anyMatch(c -> c.getConfirmedBy().equals(req.getSellerId()));

        boolean currentUserConfirmed = confirmations != null && confirmations.stream()
                .anyMatch(c -> c.getConfirmedBy().equals(currentUserId));

        boolean isParticipant = currentUserId != null &&
                (currentUserId.equals(req.getBuyerId()) || currentUserId.equals(req.getSellerId()));

        boolean canConfirm = "ACCEPTED".equals(req.getStatus()) && isParticipant && !currentUserConfirmed;

        boolean isBuyer = currentUserId != null && currentUserId.equals(req.getBuyerId());
        boolean peerConfirmed = isBuyer ? confirmedBySeller : confirmedByBuyer;
        boolean awaitingPeer = "ACCEPTED".equals(req.getStatus()) && currentUserConfirmed && !peerConfirmed;

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
                confirmedByBuyer,
                confirmedBySeller,
                currentUserConfirmed,
                canConfirm,
                awaitingPeer,
                peerConfirmed && !currentUserConfirmed,
                req.getExpiresAt(),
                req.getCreatedAt()
        );
    }
}
