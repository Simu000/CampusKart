package com.campusexchange.common.storage;

import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    /**
     * Stores a file under the given subdirectory and returns the relative storage key.
     */
    String store(MultipartFile file, String subDirectory);

    /**
     * Deletes a file by its storage key.
     */
    void delete(String storageKey);

    /**
     * Converts a storage key into an accessible URL.
     */
    String getUrl(String storageKey);
}
