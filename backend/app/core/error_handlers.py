"""
Custom error handlers for consistent API error responses.
"""
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI):
    """Register custom error handlers for consistent error responses."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": exc.detail,
                "status_code": exc.status_code,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        # Convert errors to JSON-safe format (handle bytes)
        safe_errors = []
        for error in exc.errors():
            safe_error = {}
            for key, value in error.items():
                if isinstance(value, bytes):
                    safe_error[key] = value.decode('utf-8', errors='replace')
                else:
                    safe_error[key] = value
            safe_errors.append(safe_error)
        
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "Validation error",
                "details": safe_errors,
                "status_code": 422,
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal server error",
                "status_code": 500,
            },
        )