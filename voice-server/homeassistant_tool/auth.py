"""Authentication handling for Home Assistant integration."""

import asyncio
import contextlib
import hashlib
import hmac
import logging
import time
from typing import Any

from pydantic import SecretStr

from .config import HomeAssistantConfig
from .exceptions import AuthenticationError

logger = logging.getLogger(__name__)


class AuthHandler:
    """
    Handles authentication for Home Assistant connections.

    Supports:
    - Long-lived access token authentication (REST and WebSocket)
    - Token validation
    - Secure token storage and comparison

    Security features:
    - Tokens stored as SecretStr to prevent accidental logging
    - Constant-time comparison for token validation
    - Token masking in logs and error messages
    """

    def __init__(self, config: HomeAssistantConfig) -> None:
        """
        Initialize authentication handler.

        Args:
            config: Home Assistant configuration containing credentials
        """
        self._config = config
        self._token: SecretStr = config.access_token
        self._validated: bool = False
        self._validation_time: float | None = None
        self._token_hash: str = self._compute_token_hash()

    def _compute_token_hash(self) -> str:
        """Compute a hash of the token for safe logging/comparison."""
        token_bytes = self._token.get_secret_value().encode("utf-8")
        return hashlib.sha256(token_bytes).hexdigest()[:12]

    @property
    def is_validated(self) -> bool:
        """Check if token has been validated."""
        return self._validated

    @property
    def token_identifier(self) -> str:
        """Get a safe identifier for the token (for logging)."""
        return f"token_{self._token_hash}"

    def get_auth_header(self) -> dict[str, str]:
        """
        Get authorization header for REST API requests.

        Returns:
            Dictionary with Authorization header
        """
        return {"Authorization": f"Bearer {self._token.get_secret_value()}"}

    def get_websocket_auth_message(self) -> dict[str, Any]:
        """
        Get authentication message for WebSocket connection.

        Returns:
            Authentication message dictionary for WebSocket
        """
        return {
            "type": "auth",
            "access_token": self._token.get_secret_value(),
        }

    def mark_validated(self) -> None:
        """Mark the token as validated after successful API call."""
        self._validated = True
        self._validation_time = time.time()
        logger.debug("Token %s validated successfully", self.token_identifier)

    def mark_invalid(self) -> None:
        """Mark the token as invalid after authentication failure."""
        self._validated = False
        self._validation_time = None
        logger.warning("Token %s marked as invalid", self.token_identifier)

    def validate_token_format(self) -> bool:
        """
        Validate the token format (basic checks).

        Returns:
            True if token format appears valid

        Raises:
            AuthenticationError: If token format is invalid
        """
        token = self._token.get_secret_value()

        if not token:
            raise AuthenticationError("Access token is empty")

        if len(token) < 10:
            raise AuthenticationError("Access token is too short")

        # Home Assistant long-lived tokens are typically base64-like
        # They should contain alphanumeric characters, dots, underscores, hyphens
        valid_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        if not all(c in valid_chars for c in token):
            raise AuthenticationError(
                "Access token contains invalid characters. "
                "Ensure you're using a long-lived access token from Home Assistant."
            )

        return True

    def secure_compare(self, other_token: str) -> bool:
        """
        Securely compare tokens using constant-time comparison.

        Args:
            other_token: Token to compare against

        Returns:
            True if tokens match
        """
        return hmac.compare_digest(
            self._token.get_secret_value().encode("utf-8"),
            other_token.encode("utf-8"),
        )


class TokenRefreshManager:
    """
    Manages token refresh for long-running connections.

    Note: Home Assistant long-lived access tokens don't expire,
    but this class provides infrastructure for future OAuth support
    or custom token rotation policies.
    """

    def __init__(
        self,
        auth_handler: AuthHandler,
        refresh_callback: Any | None = None,
    ) -> None:
        """
        Initialize token refresh manager.

        Args:
            auth_handler: Authentication handler instance
            refresh_callback: Optional async callback for token refresh
        """
        self._auth = auth_handler
        self._refresh_callback = refresh_callback
        self._refresh_task: asyncio.Task[None] | None = None
        self._running = False

    async def start(self, refresh_interval: float = 3600.0) -> None:
        """
        Start the token refresh loop.

        Args:
            refresh_interval: Time between refresh checks in seconds
        """
        if self._running:
            return

        self._running = True
        self._refresh_task = asyncio.create_task(self._refresh_loop(refresh_interval))
        logger.debug("Token refresh manager started")

    async def stop(self) -> None:
        """Stop the token refresh loop."""
        self._running = False
        if self._refresh_task:
            self._refresh_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._refresh_task
            self._refresh_task = None
        logger.debug("Token refresh manager stopped")

    async def _refresh_loop(self, interval: float) -> None:
        """Internal refresh loop."""
        while self._running:
            try:
                await asyncio.sleep(interval)
                if self._refresh_callback:
                    await self._refresh_callback()
                    logger.debug("Token refresh check completed")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Token refresh error: %s", e)


def mask_token(token: str, visible_chars: int = 4) -> str:
    """
    Mask a token for safe display/logging.

    Args:
        token: Token to mask
        visible_chars: Number of characters to show at start and end

    Returns:
        Masked token string
    """
    if len(token) <= visible_chars * 2:
        return "*" * len(token)

    return f"{token[:visible_chars]}...{token[-visible_chars:]}"
