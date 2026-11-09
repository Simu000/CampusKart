package com.campusexchange.auth.dto;

import com.campusexchange.user.User;

public record UserSummaryDto(
        Long id,
        String fullName,
        String email,
        String role,
        boolean verified,
        String department,
        String profileImageUrl
) {
    public static UserSummaryDto from(User user) {
        return new UserSummaryDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.isVerified(),
                user.getDepartment(),
                user.getProfileImageUrl()
        );
    }
}
