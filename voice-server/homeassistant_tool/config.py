"""Configuration module for Home Assistant integration with secure credential handling."""

import os
import ssl
from pathlib import Path
from typing import Any

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .exceptions import ConfigurationError


class HomeAssistantConfig(BaseSettings):
    """
    Home Assistant configuration with secure credential handling.

    Configuration can be provided via:
    1. Environment variables (prefixed with HA_)
    2. .env file
    3. Direct instantiation

    Security notes:
    - Access token is stored as SecretStr to prevent accidental logging
    - SSL verification is enabled by default
    - Sensitive data is masked in string representations
    """

    model_config = SettingsConfigDict(
        env_prefix="HA_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Connection settings
    host: str = Field(
        default="localhost",
        description="Home Assistant host (IP address or hostname)",
    )
    port: int = Field(
        default=8123,
        ge=1,
        le=65535,
        description="Home Assistant port",
    )
    use_ssl: bool = Field(
        default=False,
        description="Use HTTPS/WSS for connections",
    )

    # Authentication
    access_token: SecretStr = Field(
        description="Long-lived access token from Home Assistant",
    )

    # SSL settings
    ssl_verify: bool = Field(
        default=True,
        description="Verify SSL certificates",
    )
    ssl_cert_path: Path | None = Field(
        default=None,
        description="Path to custom CA certificate bundle",
    )

    # Timeouts (in seconds)
    connection_timeout: float = Field(
        default=10.0,
        ge=1.0,
        description="Connection timeout in seconds",
    )
    request_timeout: float = Field(
        default=30.0,
        ge=1.0,
        description="Request timeout in seconds",
    )
    websocket_heartbeat: float = Field(
        default=30.0,
        ge=5.0,
        description="WebSocket heartbeat interval in seconds",
    )

    # Retry settings
    max_retries: int = Field(
        default=3,
        ge=0,
        le=10,
        description="Maximum number of retry attempts",
    )
    retry_delay: float = Field(
        default=1.0,
        ge=0.1,
        description="Delay between retries in seconds",
    )

    @field_validator("host")
    @classmethod
    def validate_host(cls, v: str) -> str:
        """Validate and clean the host value."""
        v = v.strip()
        # Remove protocol prefix if accidentally included
        for prefix in ("http://", "https://", "ws://", "wss://"):
            if v.startswith(prefix):
                v = v[len(prefix) :]
        # Remove trailing slash
        v = v.rstrip("/")
        if not v:
            raise ValueError("Host cannot be empty")
        return v

    @field_validator("ssl_cert_path")
    @classmethod
    def validate_cert_path(cls, v: Path | None) -> Path | None:
        """Validate that the certificate path exists if provided."""
        if v is not None and not v.exists():
            raise ValueError(f"Certificate file not found: {v}")
        return v

    @model_validator(mode="after")
    def validate_ssl_config(self) -> "HomeAssistantConfig":
        """Validate SSL configuration consistency."""
        if self.ssl_cert_path and not self.use_ssl:
            raise ValueError("ssl_cert_path requires use_ssl=True")
        return self

    @property
    def base_url(self) -> str:
        """Get the base HTTP URL for REST API calls."""
        protocol = "https" if self.use_ssl else "http"
        return f"{protocol}://{self.host}:{self.port}"

    @property
    def api_url(self) -> str:
        """Get the full API URL."""
        return f"{self.base_url}/api"

    @property
    def websocket_url(self) -> str:
        """Get the WebSocket URL."""
        protocol = "wss" if self.use_ssl else "ws"
        return f"{protocol}://{self.host}:{self.port}/api/websocket"

    def get_auth_header(self) -> dict[str, str]:
        """Get the authorization header for REST API calls."""
        return {"Authorization": f"Bearer {self.access_token.get_secret_value()}"}

    def get_ssl_context(self) -> ssl.SSLContext | bool:
        """
        Get the SSL context for connections.

        Returns:
            ssl.SSLContext if custom cert is configured,
            True for default verification,
            False if verification is disabled.
        """
        if not self.use_ssl:
            return False

        if not self.ssl_verify:
            return False

        if self.ssl_cert_path:
            ctx = ssl.create_default_context()
            ctx.load_verify_locations(str(self.ssl_cert_path))
            return ctx

        return True

    def __repr__(self) -> str:
        """Safe string representation that masks sensitive data."""
        return (
            f"HomeAssistantConfig(host={self.host!r}, port={self.port}, "
            f"use_ssl={self.use_ssl}, access_token=***)"
        )


def load_config(
    config_file: str | Path | None = None,
    **overrides: Any,
) -> HomeAssistantConfig:
    """
    Load configuration from environment and/or config file.

    Args:
        config_file: Optional path to .env file
        **overrides: Override any config values directly

    Returns:
        Validated HomeAssistantConfig instance

    Raises:
        ConfigurationError: If configuration is invalid
    """
    try:
        # If config file specified, load it into environment first
        if config_file:
            config_path = Path(config_file)
            if not config_path.exists():
                raise ConfigurationError(f"Config file not found: {config_file}")

            # Load env file manually using dotenv
            from dotenv import load_dotenv

            load_dotenv(config_path, override=True)
            return HomeAssistantConfig(**overrides)

        # Check for token in environment before loading
        if "access_token" not in overrides and not os.getenv("HA_ACCESS_TOKEN"):
            raise ConfigurationError(
                "Access token not found. Set HA_ACCESS_TOKEN environment variable "
                "or pass access_token parameter."
            )

        return HomeAssistantConfig(**overrides)

    except ValueError as e:
        raise ConfigurationError(f"Invalid configuration: {e}") from e


def create_env_template(output_path: str | Path = ".env.example") -> Path:
    """
    Create an example .env file with all configuration options.

    Args:
        output_path: Where to write the template

    Returns:
        Path to the created file
    """
    template = """# Home Assistant Configuration
# Copy this file to .env and fill in your values

# Required: Your Home Assistant long-lived access token
# Generate at: http://your-ha-host:8123/profile/security -> Long-Lived Access Tokens
HA_ACCESS_TOKEN=your_token_here

# Home Assistant host (IP or hostname, without protocol)
HA_HOST=localhost

# Home Assistant port (default: 8123)
HA_PORT=8123

# Use HTTPS/WSS (set to true if using SSL)
HA_USE_SSL=false

# SSL certificate verification (disable only for self-signed certs in dev)
HA_SSL_VERIFY=true

# Path to custom CA certificate (optional, for self-signed certs)
# HA_SSL_CERT_PATH=/path/to/ca-cert.pem

# Timeout settings (in seconds)
HA_CONNECTION_TIMEOUT=10.0
HA_REQUEST_TIMEOUT=30.0
HA_WEBSOCKET_HEARTBEAT=30.0

# Retry settings
HA_MAX_RETRIES=3
HA_RETRY_DELAY=1.0
"""
    path = Path(output_path)
    path.write_text(template)
    return path
