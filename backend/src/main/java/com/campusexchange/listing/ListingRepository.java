package com.campusexchange.listing;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ListingRepository extends JpaRepository<Listing, Long> {
    @Query("SELECT l FROM Listing l WHERE l.status <> 'REMOVED' " +
           "AND (:q = '' OR LOWER(l.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(l.description) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:type = '' OR l.transactionType = :type) " +
           "AND (:category = 0L OR l.categoryId = :category) " +
           "AND (:condition = '' OR l.itemCondition = :condition) " +
           "AND (:minPrice IS NULL OR l.price >= :minPrice) " +
           "AND (:maxPrice IS NULL OR l.price <= :maxPrice)")
    Page<Listing> searchWithFilters(@Param("q") String q,
                                    @Param("type") String type,
                                    @Param("category") Long category,
                                    @Param("condition") String condition,
                                    @Param("minPrice") BigDecimal minPrice,
                                    @Param("maxPrice") BigDecimal maxPrice,
                                    Pageable pageable);

    List<Listing> findBySellerIdAndStatusNotOrderByCreatedAtDesc(Long sellerId, String status);

    List<Listing> findBySellerIdAndStatusOrderByCreatedAtDesc(Long sellerId, String status);

    long countBySellerIdAndStatus(Long sellerId, String status);

    /**
     * Pessimistic row-level lock so concurrent request accepts cannot reserve the same unit.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Listing l WHERE l.id = :id")
    Optional<Listing> lockById(@Param("id") Long id);
}
