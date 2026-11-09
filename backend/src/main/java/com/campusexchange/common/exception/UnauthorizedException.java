package com.campusexchange.common.exception;

public class UnauthorizedException extends ApiException {
    public UnauthorizedException(String message) {
        super(403, message);
    }
}
