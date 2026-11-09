package com.campusexchange.request;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExchangeConfirmationRepository extends JpaRepository<ExchangeConfirmation, Long> {
    List<ExchangeConfirmation> findByRequestId(Long requestId);
    boolean existsByRequestIdAndConfirmedBy(Long requestId, Long confirmedBy);
    long countByRequestIdAndConfirmationType(Long requestId, String confirmationType);
}
