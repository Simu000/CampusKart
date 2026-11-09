package com.campusexchange.auth.dto;

public record AuthResponse(
        String token,
        UserSummaryDto user
) {}
