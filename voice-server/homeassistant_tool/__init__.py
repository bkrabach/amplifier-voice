"""
Home Assistant Integration Tool

A comprehensive Python client for Home Assistant with both REST and WebSocket support.

Features:
- Synchronous REST API for simple operations
- Asynchronous WebSocket API for real-time events
- Secure credential handling with token masking
- SSL/TLS support with custom certificates
- Comprehensive data models with Pydantic
- Event subscriptions and state change monitoring

Quick Start:
    from homeassistant_tool import HomeAssistantClient

    # Create client from environment variables
    client = HomeAssistantClient.from_env()

    # Get all states
    states = client.get_states()

    # Turn on a light
    client.turn_on('light.living_room', brightness=128)

    # Subscribe to state changes (async)
    async with HomeAssistantClient.from_env() as client:
        await client.connect_websocket()

        async def on_change(event):
            print(f"State changed: {event.entity_id}")

        await client.subscribe_state_changes(on_change)
        await client.listen()

Configuration:
    Set these environment variables (or use .env file):
    - HA_HOST: Home Assistant hostname or IP
    - HA_PORT: Port (default: 8123)
    - HA_ACCESS_TOKEN: Long-lived access token
    - HA_USE_SSL: true/false for HTTPS
    - HA_SSL_VERIFY: true/false for certificate verification
"""

from .auth import AuthHandler, TokenRefreshManager, mask_token
from .client import HomeAssistantClient, create_client
from .config import HomeAssistantConfig, create_env_template, load_config
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    ConnectionError,
    EntityNotFoundError,
    HomeAssistantError,
    ServiceNotFoundError,
    TimeoutError,
    WebSocketError,
)
from .models import (
    Area,
    Device,
    Entity,
    EntityAttributes,
    EntityRegistryEntry,
    EntityState,
    Event,
    HAConfig,
    Service,
    ServiceCallRequest,
    ServiceCallResponse,
    ServiceField,
    StateChangedEventData,
    WebSocketMessage,
)
from .rest_client import RestClient
from .ws_client import WebSocketClient

__version__ = "0.1.0"

__all__ = [
    # Main client
    "HomeAssistantClient",
    "create_client",
    # Individual clients
    "RestClient",
    "WebSocketClient",
    # Configuration
    "HomeAssistantConfig",
    "load_config",
    "create_env_template",
    # Authentication
    "AuthHandler",
    "TokenRefreshManager",
    "mask_token",
    # Models
    "Entity",
    "EntityState",
    "EntityAttributes",
    "EntityRegistryEntry",
    "Service",
    "ServiceField",
    "ServiceCallRequest",
    "ServiceCallResponse",
    "Event",
    "StateChangedEventData",
    "Area",
    "Device",
    "HAConfig",
    "WebSocketMessage",
    # Exceptions
    "HomeAssistantError",
    "AuthenticationError",
    "ConnectionError",
    "WebSocketError",
    "APIError",
    "ConfigurationError",
    "EntityNotFoundError",
    "ServiceNotFoundError",
    "TimeoutError",
]
