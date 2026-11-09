package com.campusexchange.user;

import com.campusexchange.category.Category;
import com.campusexchange.category.CategoryRepository;
import com.campusexchange.common.exception.ResourceNotFoundException;
import com.campusexchange.common.response.ApiResponse;
import com.campusexchange.listing.Listing;
import com.campusexchange.listing.ListingRepository;
import com.campusexchange.listing.dto.ListingResponseDto;
import com.campusexchange.user.dto.PublicProfileDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final CategoryRepository categoryRepository;

    public UserController(UserRepository userRepository,
                          ListingRepository listingRepository,
                          CategoryRepository categoryRepository) {
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
        this.categoryRepository = categoryRepository;
    }

    private ListingResponseDto toListingDto(Listing l, String sellerName) {
        String categoryName = categoryRepository.findById(l.getCategoryId())
                .map(Category::getName)
                .orElse("");
        return ListingResponseDto.from(l, sellerName, categoryName);
    }

    @GetMapping("/{id}/public-profile")
    public ApiResponse<PublicProfileDto> getPublicProfile(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .filter(u -> !"SUSPENDED".equals(u.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));

        List<Listing> activeListings = listingRepository.findBySellerIdAndStatusOrderByCreatedAtDesc(id, "AVAILABLE");
        long count = listingRepository.countBySellerIdAndStatus(id, "AVAILABLE");

        List<ListingResponseDto> listingDtos = activeListings.stream()
                .map(l -> toListingDto(l, user.getFullName()))
                .toList();

        return ApiResponse.success(PublicProfileDto.from(user, count, listingDtos));
    }
}
