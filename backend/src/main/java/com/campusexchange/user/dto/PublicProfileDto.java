package com.campusexchange.user.dto;

import com.campusexchange.listing.dto.ListingResponseDto;
import com.campusexchange.user.User;

import java.time.Instant;
import java.util.List;

public record PublicProfileDto(
        Long id,
        String fullName,
        String department,
        String course,
        String studyYear,
        boolean verified,
        String profileImageUrl,
        Instant joinedAt,
        long activeListingsCount,
        List<ListingResponseDto> activeListings
) {
    public static PublicProfileDto from(User user, long activeCount, List<ListingResponseDto> listings) {
        return new PublicProfileDto(
                user.getId(),
                user.getFullName(),
                user.getDepartment(),
                user.getCourse(),
                user.getStudyYear(),
                user.isVerified(),
                user.getProfileImageUrl(),
                user.getCreatedAt(),
                activeCount,
                listings
        );
    }
}
