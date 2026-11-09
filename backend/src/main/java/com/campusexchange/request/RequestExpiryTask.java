package com.campusexchange.request;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
public class RequestExpiryTask {
    private static final Logger log = LoggerFactory.getLogger(RequestExpiryTask.class);
    private final ItemRequestRepository requestRepository;

    public RequestExpiryTask(ItemRequestRepository requestRepository) {
        this.requestRepository = requestRepository;
    }

    /**
     * Checks for pending requests that have passed their 72-hour expiration window.
     * Runs every 5 minutes in background.
     */
    @Scheduled(fixedDelay = 300000)
    @Transactional
    public void expireStaleRequests() {
        Instant now = Instant.now();
        List<ItemRequest> staleRequests = requestRepository.findByStatusAndExpiresAtBefore("PENDING", now);

        if (!staleRequests.isEmpty()) {
            log.info("Processing {} expired exchange request(s) exceeding 72 hours", staleRequests.size());
            for (ItemRequest req : staleRequests) {
                req.setStatus("EXPIRED");
                requestRepository.save(req);
                log.info("Request #{} for listing #{} has expired due to 72-hour seller inactivity", req.getId(), req.getListingId());
            }
        }
    }
}
