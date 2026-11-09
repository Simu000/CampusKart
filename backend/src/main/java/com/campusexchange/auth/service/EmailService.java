package com.campusexchange.auth.service;

import com.campusexchange.auth.entity.EmailVerificationToken;
import com.campusexchange.auth.entity.PasswordResetToken;
import com.campusexchange.auth.repository.EmailVerificationTokenRepository;
import com.campusexchange.auth.repository.PasswordResetTokenRepository;
import com.campusexchange.config.AppProperties;
import com.campusexchange.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private final EmailVerificationTokenRepository verificationTokenRepo;
    private final PasswordResetTokenRepository resetTokenRepo;
    private final AppProperties appProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    public EmailService(EmailVerificationTokenRepository verificationTokenRepo,
                        PasswordResetTokenRepository resetTokenRepo,
                        AppProperties appProperties) {
        this.verificationTokenRepo = verificationTokenRepo;
        this.resetTokenRepo = resetTokenRepo;
        this.appProperties = appProperties;
    }

    public String generateRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }

    @Transactional
    public void sendVerificationEmail(User user) {
        verificationTokenRepo.deleteByUserId(user.getId());

        String rawToken = generateRawToken();
        String hash = hashToken(rawToken);

        EmailVerificationToken token = new EmailVerificationToken();
        token.setUserId(user.getId());
        token.setTokenHash(hash);
        token.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        verificationTokenRepo.save(token);

        String frontendUrl = appProperties.getCorsOrigin().split(",")[0].trim();
        String link = frontendUrl + "/verify-email?token=" + rawToken;

        log.info("""
                ================================================================================
                [EMAIL SERVICE] University Verification Link for: {}
                Student Name : {}
                Direct Link  : {}
                Expires in   : 24 Hours
                ================================================================================
                """, user.getEmail(), user.getFullName(), link);
    }

    @Transactional
    public void sendPasswordResetEmail(User user) {
        resetTokenRepo.deleteByUserId(user.getId());

        String rawToken = generateRawToken();
        String hash = hashToken(rawToken);

        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(hash);
        token.setExpiresAt(Instant.now().plus(2, ChronoUnit.HOURS));
        resetTokenRepo.save(token);

        String frontendUrl = appProperties.getCorsOrigin().split(",")[0].trim();
        String link = frontendUrl + "/reset-password?token=" + rawToken;

        log.info("""
                ================================================================================
                [EMAIL SERVICE] Password Reset Link for: {}
                Direct Link  : {}
                Expires in   : 2 Hours
                ================================================================================
                """, user.getEmail(), link);
    }
}
