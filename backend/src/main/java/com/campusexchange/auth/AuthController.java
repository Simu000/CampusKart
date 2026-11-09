package com.campusexchange.auth;

import com.campusexchange.auth.dto.AuthResponse;
import com.campusexchange.auth.dto.LoginRequest;
import com.campusexchange.auth.dto.RegisterRequest;
import com.campusexchange.auth.dto.UserSummaryDto;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AppProperties appProperties;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtTokenProvider tokenProvider,
                          AppProperties appProperties) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.appProperties = appProperties;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
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
        user.setVerified(true); // Default true until Phase 3 email token flow

        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId());
        attachAuthCookie(response, token);

        return ApiResponse.success("Registration successful", new AuthResponse(token, UserSummaryDto.from(user)));
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
                .secure(false) // Set to true in prod with HTTPS
                .sameSite("Lax")
                .path("/")
                .maxAge(7L * 24 * 60 * 60)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
