package com.campusexchange.listing.dto;

import com.campusexchange.listing.Listing;
import com.campusexchange.listing.ListingImage;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ListingResponseDto(
        Long id,
        Long sellerId,
        String sellerName,
        Long categoryId,
        String categoryName,
        String title,
        String description,
        String itemCondition,
        String transactionType,
        int qtyTotal,
        int qtyAvailable,
        int qtyReserved,
        BigDecimal price,
        String priceBasis,
        String imageUrl,
        List<String> images,
        String status,
        Instant createdAt
) {
    public static ListingResponseDto from(Listing l, String sellerName, String categoryName) {
        List<String> imageUrls = l.getImages() != null && !l.getImages().isEmpty()
                ? l.getImages().stream().map(ListingImage::getImageUrl).toList()
                : (l.getImageUrl() != null && !l.getImageUrl().isBlank() ? List.of(l.getImageUrl()) : List.of());

        String primaryImage = !imageUrls.isEmpty() ? imageUrls.get(0) : l.getImageUrl();

        return new ListingResponseDto(
                l.getId(),
                l.getSellerId(),
                sellerName,
                l.getCategoryId(),
                categoryName,
                l.getTitle(),
                l.getDescription(),
                l.getItemCondition(),
                l.getTransactionType(),
                l.getQtyTotal(),
                l.getQtyAvailable(),
                l.getQtyReserved(),
                l.getPrice(),
                l.getPriceBasis(),
                primaryImage,
                imageUrls,
                l.getStatus(),
                l.getCreatedAt()
        );
    }
}
