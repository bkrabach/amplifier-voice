"""WebSocket client for asynchronous Home Assistant operations."""

import asyncio
import contextlib
import json
import logging
import ssl
from collections.abc import Callable
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

from .auth import AuthHandler
from .config import HomeAssistantConfig
from .exceptions import AuthenticationError, ConnectionError, TimeoutError, WebSocketError
from .models import Entity, Event, StateChangedEventData, WebSocketMessage

logger = logging.getLogger(__name__)

# Type aliases
EventCallback = Callable[[Event], None]
AsyncEventCallback = Callable[[Event], Any]
StateCallback = Callable[[StateChangedEventData], None]
AsyncStateCallback = Callable[[StateChangedEventData], Any]


class WebSocketClient:
    """
    Asynchronous WebSocket client for Home Assistant.

    Provides:
    - Real-time event subscriptions
    - State change monitoring
    - Async service calls
    - Registry access via WebSocket API

    Usage:
        async with WebSocketClient(config) as client:
            # Subscribe to state changes
            await client.subscribe_events(
                callback=my_callback,
                event_type='state_changed'
            )

            # Keep connection alive
            await client.listen()
    """

    def __init__(self, config: HomeAssistantConfig) -> None:
        """
        Initialize WebSocket client.

        Args:
            config: Home Assistant configuration
        """
        self._config = config
        self._auth = AuthHandler(config)
        self._ws: ClientConnection | None = None
        self._message_id: int = 0
        self._pending_responses: dict[int, asyncio.Future[Any]] = {}
        self._subscriptions: dict[int, tuple[str, EventCallback | AsyncEventCallback]] = {}
        self._state_callbacks: list[StateCallback | AsyncStateCallback] = []
        self._running: bool = False
        self._listen_task: asyncio.Task[None] | None = None
        self._reconnect_delay: float = 1.0
        self._max_reconnect_delay: float = 60.0

    def _next_id(self) -> int:
        """Get the next message ID."""
        self._message_id += 1
        return self._message_id

    def _get_ssl_context(self) -> ssl.SSLContext | None:
        """Get SSL context for WebSocket connection."""
        if not self._config.use_ssl:
            return None

        ssl_config = self._config.get_ssl_context()
        if isinstance(ssl_config, ssl.SSLContext):
            return ssl_config
        if ssl_config is False:
            # Create unverified context
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return ctx

        # Default verified context
        return ssl.create_default_context()

    async def connect(self) -> None:
        """
        Establish WebSocket connection and authenticate.

        Raises:
            ConnectionError: If connection fails
            AuthenticationError: If authentication fails
        """
        if self._ws is not None:
            return

        try:
            ssl_context = self._get_ssl_context()
            self._ws = await websockets.connect(
                self._config.websocket_url,
                ssl=ssl_context,
                close_timeout=self._config.connection_timeout,
                open_timeout=self._config.connection_timeout,
            )

            # Wait for auth_required message
            auth_required = await self._receive_message()
            if auth_required.type != "auth_required":
                raise WebSocketError(f"Unexpected message type: {auth_required.type}")

            # Send authentication
            await self._send_raw(self._auth.get_websocket_auth_message())

            # Wait for auth result
            auth_result = await self._receive_message()
            if auth_result.type == "auth_invalid":
                self._auth.mark_invalid()
                raise AuthenticationError(
                    "WebSocket authentication failed. Check your access token.",
                    details={"message": auth_result.error},
                )

            if auth_result.type != "auth_ok":
                raise WebSocketError(f"Unexpected auth response: {auth_result.type}")

            self._auth.mark_validated()
            logger.info("WebSocket connected and authenticated")

        except websockets.exceptions.WebSocketException as e:
            raise ConnectionError(
                f"Failed to connect to WebSocket at {self._config.websocket_url}: {e}"
            ) from e

    async def disconnect(self) -> None:
        """Close the WebSocket connection."""
        self._running = False

        if self._listen_task:
            self._listen_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listen_task
            self._listen_task = None

        if self._ws:
            await self._ws.close()
            self._ws = None

        # Cancel pending responses
        for future in self._pending_responses.values():
            if not future.done():
                future.cancel()
        self._pending_responses.clear()

        logger.info("WebSocket disconnected")

    async def __aenter__(self) -> "WebSocketClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.disconnect()

    @property
    def is_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self._ws is not None and self._ws.state.name == "OPEN"

    async def _send_raw(self, message: dict[str, Any]) -> None:
        """Send a raw message."""
        if not self._ws:
            raise WebSocketError("Not connected")
        await self._ws.send(json.dumps(message))

    async def _receive_message(self) -> WebSocketMessage:
        """Receive and parse a message."""
        if not self._ws:
            raise WebSocketError("Not connected")

        try:
            data = await asyncio.wait_for(
                self._ws.recv(),
                timeout=self._config.request_timeout,
            )
            return WebSocketMessage.model_validate(json.loads(data))
        except TimeoutError as e:
            raise TimeoutError("Timeout waiting for WebSocket message") from e

    async def _send_command(
        self,
        msg_type: str,
        **kwargs: Any,
    ) -> Any:
        """
        Send a command and wait for response.

        Args:
            msg_type: Message type
            **kwargs: Additional message fields

        Returns:
            Response result

        Raises:
            WebSocketError: If command fails
        """
        msg_id = self._next_id()
        message = {"id": msg_id, "type": msg_type, **kwargs}

        # Create future for response
        future: asyncio.Future[Any] = asyncio.Future()
        self._pending_responses[msg_id] = future

        try:
            await self._send_raw(message)

            # Wait for response with timeout
            result = await asyncio.wait_for(
                future,
                timeout=self._config.request_timeout,
            )
            return result

        except TimeoutError as e:
            raise TimeoutError(f"Command {msg_type} timed out") from e
        finally:
            self._pending_responses.pop(msg_id, None)

    async def _handle_message(self, message: WebSocketMessage) -> None:
        """Handle an incoming message."""
        # Check if it's a response to a pending command
        if message.id and message.id in self._pending_responses:
            future = self._pending_responses[message.id]
            if not future.done():
                if message.success:
                    future.set_result(message.result)
                else:
                    error_msg = (
                        message.error.get("message", "Unknown error")
                        if message.error
                        else "Unknown error"
                    )
                    future.set_exception(WebSocketError(error_msg))
            return

        # Handle events
        if message.type == "event" and message.event:
            await self._handle_event(message.event)

    async def _handle_event(self, event_data: dict[str, Any]) -> None:
        """Handle an event message."""
        event = Event(
            event_type=event_data.get("event_type", ""),
            data=event_data.get("data", {}),
            origin=event_data.get("origin"),
            time_fired=event_data.get("time_fired"),
            context=event_data.get("context"),
        )

        # Notify subscription callbacks
        subscription_id = event_data.get("subscription_id")
        if subscription_id and subscription_id in self._subscriptions:
            _, callback = self._subscriptions[subscription_id]
            await self._invoke_callback(callback, event)

        # Handle state_changed events
        if event.event_type == "state_changed":
            state_data = StateChangedEventData(
                entity_id=event.data.get("entity_id", ""),
                old_state=Entity.model_validate(event.data["old_state"])
                if event.data.get("old_state")
                else None,
                new_state=Entity.model_validate(event.data["new_state"])
                if event.data.get("new_state")
                else None,
            )
            for callback in self._state_callbacks:
                await self._invoke_callback(callback, state_data)

    async def _invoke_callback(
        self,
        callback: EventCallback | AsyncEventCallback | StateCallback | AsyncStateCallback,
        data: Event | StateChangedEventData,
    ) -> None:
        """Invoke a callback, handling both sync and async."""
        try:
            result = callback(data)  # type: ignore[arg-type]
            if asyncio.iscoroutine(result):
                await result
        except Exception as e:
            logger.error("Error in event callback: %s", e)

    # -------------------------------------------------------------------------
    # Public API - Subscriptions
    # -------------------------------------------------------------------------

    async def subscribe_events(
        self,
        callback: EventCallback | AsyncEventCallback,
        event_type: str | None = None,
    ) -> int:
        """
        Subscribe to events.

        Args:
            callback: Function to call when event occurs
            event_type: Optional event type filter (e.g., 'state_changed')

        Returns:
            Subscription ID for unsubscribing
        """
        kwargs: dict[str, Any] = {}
        if event_type:
            kwargs["event_type"] = event_type

        result = await self._send_command("subscribe_events", **kwargs)

        # The subscription ID is returned in the result or we use the message ID
        sub_id = result if isinstance(result, int) else self._message_id
        self._subscriptions[sub_id] = (event_type or "*", callback)

        logger.debug("Subscribed to events: %s (id=%d)", event_type or "all", sub_id)
        return sub_id

    async def unsubscribe_events(self, subscription_id: int) -> bool:
        """
        Unsubscribe from events.

        Args:
            subscription_id: Subscription ID from subscribe_events

        Returns:
            True if unsubscribed successfully
        """
        await self._send_command("unsubscribe_events", subscription=subscription_id)
        self._subscriptions.pop(subscription_id, None)
        logger.debug("Unsubscribed from events: %d", subscription_id)
        return True

    def on_state_change(
        self,
        callback: StateCallback | AsyncStateCallback,
    ) -> None:
        """
        Register a callback for state changes.

        This is a convenience method that requires subscribing to
        'state_changed' events via subscribe_events first.

        Args:
            callback: Function to call with StateChangedEventData
        """
        self._state_callbacks.append(callback)

    async def subscribe_trigger(
        self,
        trigger: dict[str, Any],
        callback: EventCallback | AsyncEventCallback,
    ) -> int:
        """
        Subscribe to a trigger.

        Args:
            trigger: Trigger configuration
            callback: Function to call when trigger fires

        Returns:
            Subscription ID
        """
        result = await self._send_command("subscribe_trigger", trigger=trigger)
        sub_id = result if isinstance(result, int) else self._message_id
        self._subscriptions[sub_id] = ("trigger", callback)
        return sub_id

    # -------------------------------------------------------------------------
    # Public API - States
    # -------------------------------------------------------------------------

    async def get_states(self) -> list[Entity]:
        """
        Get all entity states.

        Returns:
            List of all entities
        """
        result = await self._send_command("get_states")
        return [Entity.model_validate(item) for item in result]

    # -------------------------------------------------------------------------
    # Public API - Services
    # -------------------------------------------------------------------------

    async def call_service(
        self,
        domain: str,
        service: str,
        service_data: dict[str, Any] | None = None,
        target: dict[str, Any] | None = None,
        return_response: bool = False,
    ) -> Any:
        """
        Call a Home Assistant service.

        Args:
            domain: Service domain
            service: Service name
            service_data: Service-specific data
            target: Target entities/areas/devices
            return_response: Request response data

        Returns:
            Service call result
        """
        kwargs: dict[str, Any] = {
            "domain": domain,
            "service": service,
        }
        if service_data:
            kwargs["service_data"] = service_data
        if target:
            kwargs["target"] = target
        if return_response:
            kwargs["return_response"] = True

        return await self._send_command("call_service", **kwargs)

    async def get_services(self) -> dict[str, Any]:
        """
        Get all available services.

        Returns:
            Dictionary of services by domain
        """
        return await self._send_command("get_services")

    # -------------------------------------------------------------------------
    # Public API - Registry
    # -------------------------------------------------------------------------

    async def get_areas(self) -> list[dict[str, Any]]:
        """Get all areas from the registry."""
        result = await self._send_command("config/area_registry/list")
        return result or []

    async def get_devices(self) -> list[dict[str, Any]]:
        """Get all devices from the registry."""
        result = await self._send_command("config/device_registry/list")
        return result or []

    async def get_entities(self) -> list[dict[str, Any]]:
        """Get all entities from the registry."""
        result = await self._send_command("config/entity_registry/list")
        return result or []

    # -------------------------------------------------------------------------
    # Public API - Config
    # -------------------------------------------------------------------------

    async def get_config(self) -> dict[str, Any]:
        """Get Home Assistant configuration."""
        return await self._send_command("get_config")

    async def get_panels(self) -> dict[str, Any]:
        """Get available panels."""
        return await self._send_command("get_panels")

    # -------------------------------------------------------------------------
    # Connection Management
    # -------------------------------------------------------------------------

    async def listen(self) -> None:
        """
        Start listening for messages.

        This runs until disconnect() is called or connection is lost.
        """
        self._running = True

        while self._running and self._ws:
            try:
                data = await self._ws.recv()
                message = WebSocketMessage.model_validate(json.loads(data))
                await self._handle_message(message)

            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket connection closed")
                if self._running:
                    await self._reconnect()
                break
            except Exception as e:
                logger.error("Error processing message: %s", e)

    async def _reconnect(self) -> None:
        """Attempt to reconnect with exponential backoff."""
        delay = self._reconnect_delay

        while self._running:
            logger.info("Attempting to reconnect in %.1f seconds...", delay)
            await asyncio.sleep(delay)

            try:
                self._ws = None
                await self.connect()

                # Resubscribe to events
                for sub_id, (event_type, callback) in list(self._subscriptions.items()):
                    self._subscriptions.pop(sub_id)
                    event_filter = event_type if event_type != "*" else None
                    await self.subscribe_events(callback, event_filter)

                logger.info("Reconnected successfully")
                self._reconnect_delay = 1.0  # Reset delay
                return

            except Exception as e:
                logger.error("Reconnection failed: %s", e)
                delay = min(delay * 2, self._max_reconnect_delay)

    async def start_listening(self) -> None:
        """Start listening in a background task."""
        if self._listen_task is None:
            self._listen_task = asyncio.create_task(self.listen())

    async def ping(self) -> bool:
        """
        Send a ping to check connection.

        Returns:
            True if pong received
        """
        try:
            await self._send_command("ping")
            return True
        except Exception:
            return False
