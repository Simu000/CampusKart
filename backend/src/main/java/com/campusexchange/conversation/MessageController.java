package com.campusexchange.conversation;

import com.campusexchange.common.exception.ConflictException;
import com.campusexchange.common.exception.ResourceNotFoundException;
import com.campusexchange.common.exception.UnauthorizedException;
import com.campusexchange.common.response.ApiResponse;
import com.campusexchange.conversation.dto.MessageResponseDto;
import com.campusexchange.conversation.dto.SendMessageRequest;
import com.campusexchange.request.ItemRequest;
import com.campusexchange.request.ItemRequestRepository;
import com.campusexchange.user.User;
import com.campusexchange.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/requests/{requestId}/messages")
public class MessageController {
    private final MessageRepository messageRepository;
    private final ItemRequestRepository requestRepository;
    private final UserRepository userRepository;

    public MessageController(MessageRepository messageRepository,
                             ItemRequestRepository requestRepository,
                             UserRepository userRepository) {
        this.messageRepository = messageRepository;
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
    }

    private ItemRequest verifyParticipant(Long requestId, Long currentUserId) {
        ItemRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (!currentUserId.equals(req.getBuyerId()) && !currentUserId.equals(req.getSellerId())) {
            throw new ResourceNotFoundException("Conversation not found"); // IDOR guard
        }

        if ("PENDING".equals(req.getStatus()) || "DECLINED".equals(req.getStatus())) {
            throw new UnauthorizedException("Chat becomes accessible only after the seller accepts the request");
        }

        return req;
    }

    private String getSenderName(Long senderId) {
        return userRepository.findById(senderId)
                .map(User::getFullName)
                .orElse("Student");
    }

    @GetMapping
    public ApiResponse<List<MessageResponseDto>> getMessages(@PathVariable Long requestId,
                                                            @AuthenticationPrincipal Long currentUserId) {
        verifyParticipant(requestId, currentUserId);
        List<MessageResponseDto> list = messageRepository.findByRequestIdOrderByCreatedAtAsc(requestId)
                .stream()
                .map(m -> MessageResponseDto.from(m, getSenderName(m.getSenderId())))
                .toList();
        return ApiResponse.success(list);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MessageResponseDto> sendMessage(@PathVariable Long requestId,
                                                       @Valid @RequestBody SendMessageRequest req,
                                                       @AuthenticationPrincipal Long currentUserId) {
        ItemRequest request = verifyParticipant(requestId, currentUserId);

        if (!"ACCEPTED".equals(request.getStatus())) {
            throw new ConflictException("Messaging is closed because this exchange is no longer active");
        }

        Message message = new Message();
        message.setRequestId(requestId);
        message.setSenderId(currentUserId);
        message.setBody(req.body().trim());

        Message saved = messageRepository.save(message);
        return ApiResponse.success("Message sent", MessageResponseDto.from(saved, getSenderName(currentUserId)));
    }
}
