"""Custom exceptions for Home Assistant integration."""

from typing import Any


class HomeAssistantError(Exception):
    """Base exception for all Home Assistant errors."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AuthenticationError(HomeAssistantError):
    """Raised when authentication fails."""

    pass


class ConnectionError(HomeAssistantError):
    """Raised when connection to Home Assistant fails."""

    pass


class WebSocketError(HomeAssistantError):
    """Raised when WebSocket operations fail."""

    pass


class APIError(HomeAssistantError):
    """Raised when API requests fail."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, details)
        self.status_code = status_code


class ConfigurationError(HomeAssistantError):
    """Raised when configuration is invalid or missing."""

    pass


class EntityNotFoundError(HomeAssistantError):
    """Raised when an entity is not found."""

    def __init__(self, entity_id: str) -> None:
        super().__init__(f"Entity not found: {entity_id}")
        self.entity_id = entity_id


class ServiceNotFoundError(HomeAssistantError):
    """Raised when a service is not found."""

    def __init__(self, domain: str, service: str) -> None:
        super().__init__(f"Service not found: {domain}.{service}")
        self.domain = domain
        self.service = service


class TimeoutError(HomeAssistantError):
    """Raised when an operation times out."""

    pass
