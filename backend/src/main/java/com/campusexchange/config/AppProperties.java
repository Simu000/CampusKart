package com.campusexchange.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String jwtSecret = "dev-only-secret-change-me-dev-only-secret-change-me";
    private String emailDomains = "";
    private String corsOrigin = "http://localhost:5173";

    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }

    public String getEmailDomains() { return emailDomains; }
    public void setEmailDomains(String emailDomains) { this.emailDomains = emailDomains; }

    public String getCorsOrigin() { return corsOrigin; }
    public void setCorsOrigin(String corsOrigin) { this.corsOrigin = corsOrigin; }

    public List<String> getParsedEmailDomains() {
        if (emailDomains == null || emailDomains.isBlank()) return List.of();
        return Arrays.stream(emailDomains.toLowerCase().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
