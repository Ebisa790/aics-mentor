from app.core.config import settings


class SecurityHeadersMiddleware:
    """
    Native ASGI middleware for appending defensive security headers to all HTTP responses.
    
    Uses pure ASGI interception instead of Starlette BaseHTTPMiddleware to eliminate 
    latency overhead and prevent response streaming context issues.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Pass non-HTTP scopes (e.g. WebSockets, Lifespan) directly
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))

                # Standard defensive headers (lowercase byte tuples for ASGI standard)
                security_headers = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"permissions-policy", b"geolocation=(), microphone=(), camera=()"),
                    (b"cross-origin-opener-policy", b"same-origin-allow-popups"),
                    (b"x-xss-protection", b"0"),
                ]

                # Append HTTP Strict Transport Security (HSTS) in production or over HTTPS
                is_https = scope.get("scheme") == "https" or scope.get("headers", [])
                if settings.is_production or is_https:
                    security_headers.append(
                        (b"strict-transport-security", b"max-age=63072000; includeSubDomains")
                    )

                headers.extend(security_headers)
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_with_security_headers)