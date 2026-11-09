package com.campusexchange.request;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "exchange_confirmations",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_request_party_confirm", columnNames = {"requestId", "confirmedBy", "confirmationType"})
    }
)
public class ExchangeConfirmation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long requestId;

    @Column(nullable = false)
    private Long confirmedBy;

    @Column(nullable = false, length = 30)
    private String confirmationType; // SALE_COMPLETED | ITEM_RETURNED

    @Column(nullable = false, updatable = false)
    private Instant confirmedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }

    public Long getConfirmedBy() { return confirmedBy; }
    public void setConfirmedBy(Long confirmedBy) { this.confirmedBy = confirmedBy; }

    public String getConfirmationType() { return confirmationType; }
    public void setConfirmationType(String confirmationType) { this.confirmationType = confirmationType; }

    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }
}
