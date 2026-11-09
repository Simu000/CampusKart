package com.campusexchange.request.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateItemRequest(
        @NotNull(message = "Listing ID is required")
        Long listingId,

        @Min(value = 1, message = "Requested quantity must be at least 1")
        int quantity,

        @Size(max = 500, message = "Introductory note must not exceed 500 characters")
        String note
) {}
