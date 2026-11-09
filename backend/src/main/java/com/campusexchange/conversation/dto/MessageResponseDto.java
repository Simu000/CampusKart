package com.campusexchange.conversation.dto;

import com.campusexchange.conversation.Message;
import java.time.Instant;

public record MessageResponseDto(
        Long id,
        Long requestId,
        Long senderId,
        String senderName,
        String body,
        Instant createdAt
) {
    public static MessageResponseDto from(Message m, String senderName) {
        return new MessageResponseDto(
                m.getId(),
                m.getRequestId(),
                m.getSenderId(),
                senderName,
                m.getBody(),
                m.getCreatedAt()
        );
    }
}
