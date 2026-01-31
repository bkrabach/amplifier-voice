"""Unified client facade for Home Assistant integration."""

import logging
from typing import Any

from .config import HomeAssistantConfig, load_config
from .models import (
    Area,
    Device,
    Entity,
    EntityRegistryEntry,
    HAConfig,
    Service,
    ServiceCallRequest,
    ServiceCallResponse,
)
from .rest_client import RestClient
from .ws_client import (
    AsyncEventCallback,
    AsyncStateCallback,
    EventCallback,
    StateCallback,
    WebSocketClient,
)

logger = logging.getLogger(__name__)


class HomeAssistantClient:
    """
    Unified client facade for Home Assistant.

    Provides a single interface for both REST and WebSocket operations:
    - Synchronous methods use REST API
    - Asynchronous methods use WebSocket API
    - Event subscriptions via WebSocket

    Usage (Synchronous REST):
        client = HomeAssistantClient.from_env()
        states = client.get_states()
        client.call_service('light', 'turn_on', target={'entity_id': 'light.living_room'})

    Usage (Asynchronous WebSocket):
        async with HomeAssistantClient.from_env() as client:
            await client.connect_websocket()
            await client.subscribe_state_changes(my_callback)
            await client.listen()

    Usage (Mixed):
        client = HomeAssistantClient.from_env()

        # Sync REST call
        states = client.get_states()

        # Async WebSocket
        await client.connect_websocket()
        await client.async_call_service('light', 'turn_on', ...)
    """

    def __init__(self, config: HomeAssistantConfig) -> None:
        """
        Initialize the unified client.

        Args:
            config: Home Assistant configuration
        """
        self._config = config
        self._rest: RestClient | None = None
        self._ws: WebSocketClient | None = None

    @classmethod
    def from_env(cls, **overrides: Any) -> "HomeAssistantClient":
        """
        Create client from environment variables.

        Args:
            **overrides: Override any config values

        Returns:
            Configured HomeAssistantClient
        """
        config = load_config(**overrides)
        return cls(config)

    @classmethod
    def from_config_file(
        cls,
        config_file: str,
        **overrides: Any,
    ) -> "HomeAssistantClient":
        """
        Create client from a config file.

        Args:
            config_file: Path to .env file
            **overrides: Override any config values

        Returns:
            Configured HomeAssistantClient
        """
        config = load_config(config_file=config_file, **overrides)
        return cls(config)

    @property
    def config(self) -> HomeAssistantConfig:
        """Get the current configuration."""
        return self._config

    @property
    def rest(self) -> RestClient:
        """Get the REST client (lazy initialized)."""
        if self._rest is None:
            self._rest = RestClient(self._config)
        return self._rest

    @property
    def websocket(self) -> WebSocketClient:
        """Get the WebSocket client (lazy initialized)."""
        if self._ws is None:
            self._ws = WebSocketClient(self._config)
        return self._ws

    @property
    def is_websocket_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self._ws is not None and self._ws.is_connected

    # -------------------------------------------------------------------------
    # Context Managers
    # -------------------------------------------------------------------------

    def __enter__(self) -> "HomeAssistantClient":
        """Sync context manager for REST client."""
        return self

    def __exit__(self, *args: Any) -> None:
        """Close REST client on exit."""
        self.close()

    async def __aenter__(self) -> "HomeAssistantClient":
        """Async context manager."""
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Close all connections on exit."""
        await self.close_async()

    def close(self) -> None:
        """Close synchronous connections."""
        if self._rest:
            self._rest.close()
            self._rest = None

    async def close_async(self) -> None:
        """Close all connections (sync and async)."""
        self.close()
        if self._ws:
            await self._ws.disconnect()
            self._ws = None

    # -------------------------------------------------------------------------
    # Connection Management
    # -------------------------------------------------------------------------

    async def connect_websocket(self) -> None:
        """
        Connect WebSocket for real-time operations.

        Call this before using async methods or subscriptions.
        """
        await self.websocket.connect()

    async def disconnect_websocket(self) -> None:
        """Disconnect WebSocket."""
        if self._ws:
            await self._ws.disconnect()

    def check_connection(self) -> bool:
        """
        Check if REST API is accessible.

        Returns:
            True if connected and authenticated
        """
        return self.rest.check_api()

    async def check_websocket(self) -> bool:
        """
        Check WebSocket connection with ping.

        Returns:
            True if WebSocket is responsive
        """
        if not self.is_websocket_connected:
            return False
        return await self.websocket.ping()

    # -------------------------------------------------------------------------
    # Configuration / Info
    # -------------------------------------------------------------------------

    def get_config(self) -> HAConfig:
        """Get Home Assistant configuration (REST)."""
        return self.rest.get_config()

    async def async_get_config(self) -> dict[str, Any]:
        """Get Home Assistant configuration (WebSocket)."""
        return await self.websocket.get_config()

    # -------------------------------------------------------------------------
    # States (Synchronous REST)
    # -------------------------------------------------------------------------

    def get_states(self) -> list[Entity]:
        """Get all entity states."""
        return self.rest.get_states()

    def get_state(self, entity_id: str) -> Entity:
        """Get state of a specific entity."""
        return self.rest.get_state(entity_id)

    def set_state(
        self,
        entity_id: str,
        state: str,
        attributes: dict[str, Any] | None = None,
    ) -> Entity:
        """Set state of an entity."""
        return self.rest.set_state(entity_id, state, attributes)

    def get_entities_by_domain(self, domain: str) -> list[Entity]:
        """Get all entities for a domain."""
        return self.rest.get_entities_by_domain(domain)

    # -------------------------------------------------------------------------
    # States (Asynchronous WebSocket)
    # -------------------------------------------------------------------------

    async def async_get_states(self) -> list[Entity]:
        """Get all entity states via WebSocket."""
        return await self.websocket.get_states()

    # -------------------------------------------------------------------------
    # Services (Synchronous REST)
    # -------------------------------------------------------------------------

    def get_services(self) -> dict[str, dict[str, Service]]:
        """Get all available services."""
        return self.rest.get_services()

    def call_service(
        self,
        domain: str,
        service: str,
        service_data: dict[str, Any] | None = None,
        target: dict[str, Any] | None = None,
        return_response: bool = False,
    ) -> ServiceCallResponse:
        """Call a service (REST)."""
        return self.rest.call_service(
            domain=domain,
            service=service,
            service_data=service_data,
            target=target,
            return_response=return_response,
        )

    def call_service_request(self, request: ServiceCallRequest) -> ServiceCallResponse:
        """Call a service using request model."""
        return self.rest.call_service_request(request)

    # -------------------------------------------------------------------------
    # Services (Asynchronous WebSocket)
    # -------------------------------------------------------------------------

    async def async_call_service(
        self,
        domain: str,
        service: str,
        service_data: dict[str, Any] | None = None,
        target: dict[str, Any] | None = None,
        return_response: bool = False,
    ) -> Any:
        """Call a service via WebSocket."""
        return await self.websocket.call_service(
            domain=domain,
            service=service,
            service_data=service_data,
            target=target,
            return_response=return_response,
        )

    async def async_get_services(self) -> dict[str, Any]:
        """Get services via WebSocket."""
        return await self.websocket.get_services()

    # -------------------------------------------------------------------------
    # Registry (Synchronous REST)
    # -------------------------------------------------------------------------

    def get_areas(self) -> list[Area]:
        """Get all areas."""
        return self.rest.get_areas()

    def get_devices(self) -> list[Device]:
        """Get all devices."""
        return self.rest.get_devices()

    def get_entity_registry(self) -> list[EntityRegistryEntry]:
        """Get entity registry."""
        return self.rest.get_entity_registry()

    # -------------------------------------------------------------------------
    # Registry (Asynchronous WebSocket)
    # -------------------------------------------------------------------------

    async def async_get_areas(self) -> list[dict[str, Any]]:
        """Get areas via WebSocket."""
        return await self.websocket.get_areas()

    async def async_get_devices(self) -> list[dict[str, Any]]:
        """Get devices via WebSocket."""
        return await self.websocket.get_devices()

    async def async_get_entities(self) -> list[dict[str, Any]]:
        """Get entity registry via WebSocket."""
        return await self.websocket.get_entities()

    # -------------------------------------------------------------------------
    # Events (REST)
    # -------------------------------------------------------------------------

    def fire_event(
        self,
        event_type: str,
        event_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Fire an event."""
        return self.rest.fire_event(event_type, event_data)

    # -------------------------------------------------------------------------
    # Event Subscriptions (WebSocket)
    # -------------------------------------------------------------------------

    async def subscribe_events(
        self,
        callback: EventCallback | AsyncEventCallback,
        event_type: str | None = None,
    ) -> int:
        """
        Subscribe to events.

        Args:
            callback: Function called when event occurs
            event_type: Filter by event type (e.g., 'state_changed')

        Returns:
            Subscription ID
        """
        return await self.websocket.subscribe_events(callback, event_type)

    async def unsubscribe_events(self, subscription_id: int) -> bool:
        """Unsubscribe from events."""
        return await self.websocket.unsubscribe_events(subscription_id)

    async def subscribe_state_changes(
        self,
        callback: StateCallback | AsyncStateCallback,
    ) -> int:
        """
        Subscribe to state changes.

        Convenience method that subscribes to 'state_changed' events
        and registers a state callback.

        Args:
            callback: Function called with StateChangedEventData

        Returns:
            Subscription ID
        """
        self.websocket.on_state_change(callback)
        return await self.websocket.subscribe_events(
            lambda e: None,  # Events handled by state callback
            event_type="state_changed",
        )

    async def subscribe_trigger(
        self,
        trigger: dict[str, Any],
        callback: EventCallback | AsyncEventCallback,
    ) -> int:
        """Subscribe to a trigger."""
        return await self.websocket.subscribe_trigger(trigger, callback)

    # -------------------------------------------------------------------------
    # Listening
    # -------------------------------------------------------------------------

    async def listen(self) -> None:
        """
        Start listening for WebSocket events.

        This blocks until disconnect() is called.
        """
        await self.websocket.listen()

    async def start_listening(self) -> None:
        """Start listening in background task."""
        await self.websocket.start_listening()

    # -------------------------------------------------------------------------
    # Templates
    # -------------------------------------------------------------------------

    def render_template(self, template: str) -> str:
        """Render a Jinja2 template."""
        return self.rest.render_template(template)

    # -------------------------------------------------------------------------
    # History
    # -------------------------------------------------------------------------

    def get_history(
        self,
        entity_ids: list[str] | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        minimal_response: bool = True,
    ) -> list[list[Entity]]:
        """Get entity state history."""
        return self.rest.get_history(
            entity_ids=entity_ids,
            start_time=start_time,
            end_time=end_time,
            minimal_response=minimal_response,
        )

    # -------------------------------------------------------------------------
    # Convenience Methods
    # -------------------------------------------------------------------------

    def turn_on(
        self,
        entity_id: str,
        **service_data: Any,
    ) -> ServiceCallResponse:
        """
        Turn on an entity.

        Args:
            entity_id: Entity to turn on
            **service_data: Additional service data (brightness, color_temp, etc.)
        """
        domain = entity_id.split(".")[0]
        return self.call_service(
            domain=domain,
            service="turn_on",
            service_data=service_data if service_data else None,
            target={"entity_id": entity_id},
        )

    def turn_off(self, entity_id: str) -> ServiceCallResponse:
        """Turn off an entity."""
        domain = entity_id.split(".")[0]
        return self.call_service(
            domain=domain,
            service="turn_off",
            target={"entity_id": entity_id},
        )

    def toggle(self, entity_id: str) -> ServiceCallResponse:
        """Toggle an entity."""
        domain = entity_id.split(".")[0]
        return self.call_service(
            domain=domain,
            service="toggle",
            target={"entity_id": entity_id},
        )

    async def async_turn_on(
        self,
        entity_id: str,
        **service_data: Any,
    ) -> Any:
        """Turn on an entity via WebSocket."""
        domain = entity_id.split(".")[0]
        return await self.async_call_service(
            domain=domain,
            service="turn_on",
            service_data=service_data if service_data else None,
            target={"entity_id": entity_id},
        )

    async def async_turn_off(self, entity_id: str) -> Any:
        """Turn off an entity via WebSocket."""
        domain = entity_id.split(".")[0]
        return await self.async_call_service(
            domain=domain,
            service="turn_off",
            target={"entity_id": entity_id},
        )

    async def async_toggle(self, entity_id: str) -> Any:
        """Toggle an entity via WebSocket."""
        domain = entity_id.split(".")[0]
        return await self.async_call_service(
            domain=domain,
            service="toggle",
            target={"entity_id": entity_id},
        )


def create_client(
    host: str | None = None,
    port: int | None = None,
    access_token: str | None = None,
    use_ssl: bool | None = None,
    **kwargs: Any,
) -> HomeAssistantClient:
    """
    Create a Home Assistant client with explicit parameters.

    Parameters not provided will be loaded from environment.

    Args:
        host: Home Assistant host
        port: Home Assistant port
        access_token: Long-lived access token
        use_ssl: Use HTTPS/WSS
        **kwargs: Additional config options

    Returns:
        Configured client
    """
    overrides: dict[str, Any] = {}
    if host is not None:
        overrides["host"] = host
    if port is not None:
        overrides["port"] = port
    if access_token is not None:
        overrides["access_token"] = access_token
    if use_ssl is not None:
        overrides["use_ssl"] = use_ssl
    overrides.update(kwargs)

    return HomeAssistantClient.from_env(**overrides)
