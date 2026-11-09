package com.campusexchange.auth;

import com.campusexchange.auth.dto.*;
import com.campusexchange.auth.entity.EmailVerificationToken;
import com.campusexchange.auth.entity.PasswordResetToken;
import com.campusexchange.auth.repository.EmailVerificationTokenRepository;
import com.campusexchange.auth.repository.PasswordResetTokenRepository;
import com.campusexchange.auth.service.EmailService;
import com.campusexchange.common.exception.ApiException;
import com.campusexchange.common.exception.BadRequestException;
import com.campusexchange.common.exception.ConflictException;
import com.campusexchange.common.exception.UnauthorizedException;
import com.campusexchange.common.response.ApiResponse;
import com.campusexchange.config.AppProperties;
import com.campusexchange.security.JwtTokenProvider;
import com.campusexchange.user.User;
import com.campusexchange.user.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AppProperties appProperties;
    private final EmailService emailService;
    private final EmailVerificationTokenRepository verificationTokenRepo;
    private final PasswordResetTokenRepository resetTokenRepo;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtTokenProvider tokenProvider,
                          AppProperties appProperties,
                          EmailService emailService,
                          EmailVerificationTokenRepository verificationTokenRepo,
                          PasswordResetTokenRepository resetTokenRepo) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.appProperties = appProperties;
        this.emailService = emailService;
        this.verificationTokenRepo = verificationTokenRepo;
        this.resetTokenRepo = resetTokenRepo;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        String email = request.email().trim().toLowerCase();
        List<String> allowedDomains = appProperties.getParsedEmailDomains();

        if (!allowedDomains.isEmpty()) {
            int atIndex = email.indexOf('@');
            if (atIndex == -1 || !allowedDomains.contains(email.substring(atIndex + 1))) {
                throw new BadRequestException("Please register with an approved university email address");
            }
        }

        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("An account with this email address already exists");
        }

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDepartment(request.department());
        user.setCourse(request.course());
        user.setStudyYear(request.studyYear());
        user.setVerified(false); // Unverified until student clicks email link

        User savedUser = userRepository.save(user);

        // Dispatch verification link
        emailService.sendVerificationEmail(savedUser);

        String token = tokenProvider.generateToken(savedUser.getId());
        attachAuthCookie(response, token);

        return ApiResponse.success("Registration successful. Please verify your university email to activate all marketplace features.",
                new AuthResponse(token, UserSummaryDto.from(savedUser)));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(401, "Incorrect email or password");
        }

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new UnauthorizedException("This account is currently suspended. Please contact campus support.");
        }

        String token = tokenProvider.generateToken(user.getId());
        attachAuthCookie(response, token);

        return ApiResponse.success("Login successful", new AuthResponse(token, UserSummaryDto.from(user)));
    }

    @GetMapping("/verify-email")
    @Transactional
    public ApiResponse<UserSummaryDto> verifyEmail(@RequestParam("token") String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new BadRequestException("Verification token is required");
        }

        String tokenHash = emailService.hashToken(rawToken.trim());
        EmailVerificationToken token = verificationTokenRepo.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BadRequestException("Invalid or unrecognized verification token"));

        if (token.isUsed()) {
            throw new BadRequestException("This verification link has already been used");
        }

        if (token.isExpired()) {
            throw new BadRequestException("This verification link has expired. Please request a new verification link.");
        }

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new BadRequestException("Associated student account not found"));

        user.setVerified(true);
        userRepository.save(user);

        token.setUsedAt(Instant.now());
        verificationTokenRepo.save(token);

        return ApiResponse.success("University email successfully verified! You now have full access to buy, sell, rent, and lend.",
                UserSummaryDto.from(user));
    }

    @PostMapping("/resend-verification")
    public ApiResponse<Void> resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        // Silent return if user does not exist or already verified to prevent enumeration
        if (user != null && !user.isVerified()) {
            emailService.sendVerificationEmail(user);
        }

        return ApiResponse.success("If an unverified account exists with this email, a new verification link has been sent.", null);
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        if (user != null) {
            emailService.sendPasswordResetEmail(user);
        }

        return ApiResponse.success("If an account exists with this email, a password reset link has been sent.", null);
    }

    @PostMapping("/reset-password")
    @Transactional
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        String tokenHash = emailService.hashToken(request.token().trim());
        PasswordResetToken token = resetTokenRepo.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BadRequestException("Invalid or unrecognized password reset token"));

        if (token.isUsed()) {
            throw new BadRequestException("This password reset link has already been used");
        }

        if (token.isExpired()) {
            throw new BadRequestException("This password reset link has expired. Please request a new one.");
        }

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new BadRequestException("Student account not found"));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        token.setUsedAt(Instant.now());
        resetTokenRepo.save(token);

        return ApiResponse.success("Password reset successful. You may now sign in with your new password.", null);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("jwt_token", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ApiResponse.success("Logged out successfully", null);
    }

    @GetMapping("/me")
    public ApiResponse<UserSummaryDto> getCurrentUser(@AuthenticationPrincipal Long currentUserId) {
        if (currentUserId == null) {
            throw new ApiException(401, "Not signed in");
        }
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(401, "User profile not found"));
        return ApiResponse.success(UserSummaryDto.from(user));
    }

    private void attachAuthCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from("jwt_token", token)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(7L * 24 * 60 * 60)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
