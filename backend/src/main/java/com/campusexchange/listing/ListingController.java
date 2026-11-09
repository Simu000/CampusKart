package com.campusexchange.listing;

import com.campusexchange.category.Category;
import com.campusexchange.category.CategoryRepository;
import com.campusexchange.common.exception.BadRequestException;
import com.campusexchange.common.exception.ConflictException;
import com.campusexchange.common.exception.ResourceNotFoundException;
import com.campusexchange.common.exception.UnauthorizedException;
import com.campusexchange.common.response.ApiResponse;
import com.campusexchange.common.response.PageResponse;
import com.campusexchange.common.storage.StorageService;
import com.campusexchange.listing.dto.CreateListingRequest;
import com.campusexchange.listing.dto.ListingResponseDto;
import com.campusexchange.user.User;
import com.campusexchange.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/listings")
public class ListingController {
    private final ListingRepository listingRepository;
    private final ListingImageRepository imageRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final StorageService storageService;

    public ListingController(ListingRepository listingRepository,
                             ListingImageRepository imageRepository,
                             UserRepository userRepository,
                             CategoryRepository categoryRepository,
                             StorageService storageService) {
        this.listingRepository = listingRepository;
        this.imageRepository = imageRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.storageService = storageService;
    }

    private ListingResponseDto toDto(Listing l) {
        String sellerName = userRepository.findById(l.getSellerId())
                .map(User::getFullName)
                .orElse("Unknown Student");
        String categoryName = categoryRepository.findById(l.getCategoryId())
                .map(Category::getName)
                .orElse("");

        List<ListingImage> imgs = imageRepository.findByListingIdOrderByDisplayOrderAsc(l.getId());
        if (!imgs.isEmpty()) {
            l.setImages(imgs);
        }

        return ListingResponseDto.from(l, sellerName, categoryName);
    }

    @GetMapping
    public ApiResponse<PageResponse<ListingResponseDto>> browse(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String type,
            @RequestParam(defaultValue = "0") Long category,
            @RequestParam(defaultValue = "") String condition,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {

        Sort sortOrder = switch (sort) {
            case "price_asc" -> Sort.by("price").ascending();
            case "price_desc" -> Sort.by("price").descending();
            default -> Sort.by("createdAt").descending();
        };

        int clampedPage = Math.max(page, 0);
        int clampedSize = Math.min(Math.max(size, 1), 50);

        Page<Listing> pageResult = listingRepository.searchWithFilters(
                q.trim(),
                type.trim(),
                category,
                condition.trim(),
                minPrice,
                maxPrice,
                PageRequest.of(clampedPage, clampedSize, sortOrder)
        );

        List<ListingResponseDto> dtos = pageResult.getContent().stream()
                .map(this::toDto)
                .toList();

        return ApiResponse.success(PageResponse.from(pageResult, dtos));
    }

    @GetMapping("/mine")
    public ApiResponse<List<ListingResponseDto>> getMyListings(@AuthenticationPrincipal Long currentUserId) {
        List<ListingResponseDto> items = listingRepository.findBySellerIdAndStatusNotOrderByCreatedAtDesc(currentUserId, "REMOVED")
                .stream()
                .map(this::toDto)
                .toList();
        return ApiResponse.success(items);
    }

    @GetMapping("/{id}")
    public ApiResponse<ListingResponseDto> getListing(@PathVariable Long id) {
        Listing listing = listingRepository.findById(id)
                .filter(l -> !"REMOVED".equals(l.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
        return ApiResponse.success(toDto(listing));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<ListingResponseDto> createListing(@Valid @RequestBody CreateListingRequest req,
                                                         @AuthenticationPrincipal Long currentUserId) {
        User seller = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found"));

        if (!seller.isVerified()) {
            throw new UnauthorizedException("Please verify your university email before creating product listings.");
        }

        String type = req.transactionType().trim().toUpperCase();
        if (!List.of("SELL", "RENT", "LEND").contains(type)) {
            throw new BadRequestException("Transaction type must be SELL, RENT, or LEND");
        }

        String condition = req.itemCondition().trim().toUpperCase();
        if (!List.of("NEW", "LIKE_NEW", "GOOD", "FAIR").contains(condition)) {
            throw new BadRequestException("Condition must be NEW, LIKE_NEW, GOOD, or FAIR");
        }

        if (!categoryRepository.existsById(req.categoryId())) {
            throw new BadRequestException("Selected category does not exist");
        }

        BigDecimal price = req.price() == null ? BigDecimal.ZERO : req.price();
        String priceBasis = "NONE";

        if ("LEND".equals(type)) {
            price = BigDecimal.ZERO;
        } else if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Price must be greater than zero");
        }

        if ("RENT".equals(type)) {
            priceBasis = req.priceBasis() != null ? req.priceBasis().trim().toUpperCase() : "";
            if (!List.of("PER_DAY", "PER_WEEK", "PER_MONTH").contains(priceBasis)) {
                throw new BadRequestException("Please select a rental pricing basis (PER_DAY, PER_WEEK, PER_MONTH)");
            }
        }

        Listing listing = new Listing();
        listing.setSellerId(currentUserId);
        listing.setCategoryId(req.categoryId());
        listing.setTitle(req.title().trim());
        listing.setDescription(req.description().trim());
        listing.setItemCondition(condition);
        listing.setTransactionType(type);
        listing.setQtyTotal(req.quantity());
        listing.setQtyAvailable(req.quantity());
        listing.setQtyReserved(0);
        listing.setPrice(price);
        listing.setPriceBasis(priceBasis);
        listing.setImageUrl(req.imageUrl() != null ? req.imageUrl().trim() : null);

        Listing saved = listingRepository.save(listing);

        // Multiple images provided as URLs
        if (req.imageUrls() != null && !req.imageUrls().isEmpty()) {
            int order = 0;
            for (String url : req.imageUrls()) {
                if (url != null && !url.isBlank()) {
                    ListingImage img = new ListingImage();
                    img.setListing(saved);
                    img.setImageUrl(url.trim());
                    img.setStorageKey(url.trim());
                    img.setPrimary(order == 0);
                    img.setDisplayOrder(order++);
                    imageRepository.save(img);
                }
            }
        }

        return ApiResponse.success("Listing created successfully", toDto(saved));
    }

    @PostMapping("/{id}/images")
    @Transactional
    public ApiResponse<ListingResponseDto> uploadImage(@PathVariable Long id,
                                                       @RequestParam("file") MultipartFile file,
                                                       @AuthenticationPrincipal Long currentUserId) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!listing.getSellerId().equals(currentUserId)) {
            throw new UnauthorizedException("You can only upload images for your own listings");
        }

        List<ListingImage> existing = imageRepository.findByListingIdOrderByDisplayOrderAsc(id);
        if (existing.size() >= 5) {
            throw new BadRequestException("Maximum 5 photos allowed per listing");
        }

        String storageKey = storageService.store(file, "listings");
        String imageUrl = storageService.getUrl(storageKey);

        ListingImage image = new ListingImage();
        image.setListing(listing);
        image.setStorageKey(storageKey);
        image.setImageUrl(imageUrl);
        image.setPrimary(existing.isEmpty());
        image.setDisplayOrder(existing.size());
        imageRepository.save(image);

        if (listing.getImageUrl() == null || listing.getImageUrl().isBlank() || existing.isEmpty()) {
            listing.setImageUrl(imageUrl);
            listingRepository.save(listing);
        }

        return ApiResponse.success("Image uploaded successfully", toDto(listing));
    }

    @DeleteMapping("/{id}/images/{imageId}")
    @Transactional
    public ApiResponse<ListingResponseDto> deleteImage(@PathVariable Long id,
                                                       @PathVariable Long imageId,
                                                       @AuthenticationPrincipal Long currentUserId) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!listing.getSellerId().equals(currentUserId)) {
            throw new UnauthorizedException("You can only modify images for your own listings");
        }

        ListingImage image = imageRepository.findById(imageId)
                .filter(img -> img.getListing().getId().equals(id))
                .orElseThrow(() -> new ResourceNotFoundException("Image not found on this listing"));

        storageService.delete(image.getStorageKey());
        imageRepository.delete(image);

        // Update primary image if the removed one was primary
        List<ListingImage> remaining = imageRepository.findByListingIdOrderByDisplayOrderAsc(id);
        if (!remaining.isEmpty()) {
            if (image.isPrimary()) {
                ListingImage newPrimary = remaining.get(0);
                newPrimary.setPrimary(true);
                imageRepository.save(newPrimary);
                listing.setImageUrl(newPrimary.getImageUrl());
            }
        } else {
            listing.setImageUrl(null);
        }
        listingRepository.save(listing);

        return ApiResponse.success("Image removed successfully", toDto(listing));
    }

    @PatchMapping("/{id}/images/{imageId}/primary")
    @Transactional
    public ApiResponse<ListingResponseDto> setPrimaryImage(@PathVariable Long id,
                                                           @PathVariable Long imageId,
                                                           @AuthenticationPrincipal Long currentUserId) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!listing.getSellerId().equals(currentUserId)) {
            throw new UnauthorizedException("You can only modify images for your own listings");
        }

        List<ListingImage> images = imageRepository.findByListingIdOrderByDisplayOrderAsc(id);
        ListingImage target = null;
        for (ListingImage img : images) {
            if (img.getId().equals(imageId)) {
                img.setPrimary(true);
                target = img;
            } else {
                img.setPrimary(false);
            }
            imageRepository.save(img);
        }

        if (target == null) {
            throw new ResourceNotFoundException("Image not found on this listing");
        }

        listing.setImageUrl(target.getImageUrl());
        listingRepository.save(listing);

        return ApiResponse.success("Primary image updated", toDto(listing));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteListing(@PathVariable Long id, @AuthenticationPrincipal Long currentUserId) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!listing.getSellerId().equals(currentUserId)) {
            throw new UnauthorizedException("You can only remove your own listings");
        }

        if (listing.getQtyReserved() > 0) {
            throw new ConflictException("Cannot remove listing with active reserved requests. Please resolve or cancel them first.");
        }

        listing.setStatus("REMOVED");
        listingRepository.save(listing);
    }
}
