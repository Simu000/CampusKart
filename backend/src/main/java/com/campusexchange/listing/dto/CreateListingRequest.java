package com.campusexchange.listing.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record CreateListingRequest(
        @NotBlank(message = "Product title is required")
        String title,

        @NotBlank(message = "Description is required")
        String description,

        @NotNull(message = "Category is required")
        Long categoryId,

        @NotBlank(message = "Condition is required")
        String itemCondition, // NEW | LIKE_NEW | GOOD | FAIR

        @NotBlank(message = "Transaction type is required")
        String transactionType, // SELL | RENT | LEND

        @Min(value = 1, message = "Quantity must be at least 1")
        int quantity,

        BigDecimal price,
        String priceBasis, // NONE | PER_DAY | PER_WEEK | PER_MONTH
        String imageUrl,
        List<String> imageUrls
) {}
