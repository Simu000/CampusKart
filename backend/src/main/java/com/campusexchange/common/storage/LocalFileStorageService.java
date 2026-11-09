package com.campusexchange.common.storage;

import com.campusexchange.common.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
public class LocalFileStorageService implements StorageService {
    private static final Path ROOT_DIR = Paths.get("uploads");
    private static final List<String> ALLOWED_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    public LocalFileStorageService() {
        try {
            Files.createDirectories(ROOT_DIR);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize local upload storage directory", e);
        }
    }

    @Override
    public String store(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file cannot be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Image exceeds the maximum allowed size of 5MB");
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.jpg");
        String extension = "";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP");
        }

        String storageFilename = UUID.randomUUID() + "." + extension;
        Path targetDir = ROOT_DIR.resolve(subDirectory != null ? subDirectory : "");
        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(storageFilename);
            try (InputStream is = file.getInputStream()) {
                Files.copy(is, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
            return (subDirectory != null && !subDirectory.isBlank() ? subDirectory + "/" : "") + storageFilename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save uploaded file", e);
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        try {
            Path targetPath = ROOT_DIR.resolve(storageKey);
            Files.deleteIfExists(targetPath);
        } catch (IOException ignored) {}
    }

    @Override
    public String getUrl(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return null;
        if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
            return storageKey;
        }
        return "/uploads/" + storageKey;
    }
}
