package com.campusexchange.common.exception;

public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(400, message);
    }
}
