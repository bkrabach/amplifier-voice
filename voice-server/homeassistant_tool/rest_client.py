"""REST client for synchronous Home Assistant API operations."""

import contextlib
import logging
from typing import Any

import httpx

from .auth import AuthHandler
from .config import HomeAssistantConfig
from .exceptions import APIError, AuthenticationError, ConnectionError, EntityNotFoundError
from .models import (
    Area,
    Device,
    Entity,
    EntityRegistryEntry,
    HAConfig,
    Service,
    ServiceCallRequest,
    ServiceCallResponse,
    ServiceField,
)

logger = logging.getLogger(__name__)


class RestClient:
    """
    Synchronous REST client for Home Assistant API.

    Provides methods for:
    - Entity state retrieval and manipulation
    - Service calls
    - Configuration and registry access
    - Health checks and API validation

    Thread-safe for concurrent use.
    """

    def __init__(self, config: HomeAssistantConfig) -> None:
        """
        Initialize REST client.

        Args:
            config: Home Assistant configuration
        """
        self._config = config
        self._auth = AuthHandler(config)
        self._client: httpx.Client | None = None

    def _get_client(self) -> httpx.Client:
        """Get or create the HTTP client."""
        if self._client is None:
            ssl_context = self._config.get_ssl_context()
            self._client = httpx.Client(
                base_url=self._config.api_url,
                headers=self._auth.get_auth_header(),
                timeout=httpx.Timeout(
                    connect=self._config.connection_timeout,
                    read=self._config.request_timeout,
                    write=self._config.request_timeout,
                    pool=self._config.connection_timeout,
                ),
                verify=ssl_context if isinstance(ssl_context, bool) else True,
            )
            # If we have a custom SSL context, we need to handle it differently
            if not isinstance(ssl_context, bool) and ssl_context:
                self._client = httpx.Client(
                    base_url=self._config.api_url,
                    headers=self._auth.get_auth_header(),
                    timeout=httpx.Timeout(
                        connect=self._config.connection_timeout,
                        read=self._config.request_timeout,
                        write=self._config.request_timeout,
                        pool=self._config.connection_timeout,
                    ),
                    verify=ssl_context,
                )
        return self._client

    def _request(
        self,
        method: str,
        endpoint: str,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """
        Make an HTTP request to the API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            json: JSON body for POST/PUT requests
            params: Query parameters

        Returns:
            Parsed JSON response

        Raises:
            AuthenticationError: If authentication fails
            APIError: If API returns an error
            ConnectionError: If connection fails
        """
        client = self._get_client()
        url = endpoint.lstrip("/")

        try:
            response = client.request(
                method=method,
                url=url,
                json=json,
                params=params,
            )

            if response.status_code == 401:
                self._auth.mark_invalid()
                raise AuthenticationError(
                    "Authentication failed. Check your access token.",
                    details={"status_code": 401},
                )

            if response.status_code == 404:
                raise APIError(
                    f"Resource not found: {endpoint}",
                    status_code=404,
                )

            if response.status_code >= 400:
                error_detail: Any = response.text
                with contextlib.suppress(Exception):
                    error_detail = response.json()
                raise APIError(
                    f"API error: {response.status_code}",
                    status_code=response.status_code,
                    details={"response": error_detail},
                )

            # Mark auth as validated on successful request
            if not self._auth.is_validated:
                self._auth.mark_validated()

            # Handle empty responses
            if response.status_code == 204 or not response.content:
                return None

            return response.json()

        except httpx.ConnectError as e:
            raise ConnectionError(
                f"Failed to connect to Home Assistant at {self._config.base_url}: {e}"
            ) from e
        except httpx.TimeoutException as e:
            raise ConnectionError(f"Request timed out: {e}") from e

    def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            self._client.close()
            self._client = None

    def __enter__(self) -> "RestClient":
        """Context manager entry."""
        return self

    def __exit__(self, *args: Any) -> None:
        """Context manager exit."""
        self.close()

    # -------------------------------------------------------------------------
    # Health & Validation
    # -------------------------------------------------------------------------

    def check_api(self) -> bool:
        """
        Check if API is accessible and token is valid.

        Returns:
            True if API is accessible

        Raises:
            AuthenticationError: If token is invalid
            ConnectionError: If cannot connect
        """
        self._request("GET", "/")
        return True

    def get_config(self) -> HAConfig:
        """
        Get Home Assistant configuration/info.

        Returns:
            HAConfig with server information
        """
        data = self._request("GET", "/config")
        return HAConfig.model_validate(data)

    # -------------------------------------------------------------------------
    # States / Entities
    # -------------------------------------------------------------------------

    def get_states(self) -> list[Entity]:
        """
        Get all entity states.

        Returns:
            List of all entities with their current states
        """
        data = self._request("GET", "/states")
        return [Entity.model_validate(item) for item in data]

    def get_state(self, entity_id: str) -> Entity:
        """
        Get state of a specific entity.

        Args:
            entity_id: Entity ID (e.g., 'light.living_room')

        Returns:
            Entity with current state

        Raises:
            EntityNotFoundError: If entity doesn't exist
        """
        try:
            data = self._request("GET", f"/states/{entity_id}")
            return Entity.model_validate(data)
        except APIError as e:
            if e.status_code == 404:
                raise EntityNotFoundError(entity_id) from e
            raise

    def set_state(
        self,
        entity_id: str,
        state: str,
        attributes: dict[str, Any] | None = None,
    ) -> Entity:
        """
        Set the state of an entity.

        Note: This directly sets state without triggering automations.
        For most use cases, prefer calling services instead.

        Args:
            entity_id: Entity ID
            state: New state value
            attributes: Optional attributes to set

        Returns:
            Updated entity
        """
        payload: dict[str, Any] = {"state": state}
        if attributes:
            payload["attributes"] = attributes

        data = self._request("POST", f"/states/{entity_id}", json=payload)
        return Entity.model_validate(data)

    def get_entities_by_domain(self, domain: str) -> list[Entity]:
        """
        Get all entities for a specific domain.

        Args:
            domain: Entity domain (e.g., 'light', 'switch', 'sensor')

        Returns:
            List of entities in that domain
        """
        all_states = self.get_states()
        return [e for e in all_states if e.domain == domain]

    # -------------------------------------------------------------------------
    # Services
    # -------------------------------------------------------------------------

    def get_services(self) -> dict[str, dict[str, Service]]:
        """
        Get all available services grouped by domain.

        Returns:
            Dictionary of domain -> service_name -> Service
        """
        data = self._request("GET", "/services")
        result: dict[str, dict[str, Service]] = {}

        for domain_data in data:
            domain = domain_data["domain"]
            services = domain_data.get("services", {})
            result[domain] = {}

            for service_name, service_info in services.items():
                fields = {}
                for field_name, field_data in service_info.get("fields", {}).items():
                    fields[field_name] = ServiceField(
                        name=field_name,
                        description=field_data.get("description"),
                        required=field_data.get("required", False),
                        example=field_data.get("example"),
                        selector=field_data.get("selector"),
                    )

                result[domain][service_name] = Service(
                    domain=domain,
                    service=service_name,
                    name=service_info.get("name"),
                    description=service_info.get("description"),
                    fields=fields,
                    target=service_info.get("target"),
                )

        return result

    def call_service(
        self,
        domain: str,
        service: str,
        service_data: dict[str, Any] | None = None,
        target: dict[str, Any] | None = None,
        return_response: bool = False,
    ) -> ServiceCallResponse:
        """
        Call a Home Assistant service.

        Args:
            domain: Service domain (e.g., 'light', 'switch')
            service: Service name (e.g., 'turn_on', 'turn_off')
            service_data: Service-specific data
            target: Target entities/areas/devices
            return_response: Whether to request response data

        Returns:
            ServiceCallResponse with results

        Examples:
            # Turn on a light
            client.call_service('light', 'turn_on', target={'entity_id': 'light.living_room'})

            # Set brightness
            client.call_service(
                'light', 'turn_on',
                service_data={'brightness': 128},
                target={'entity_id': 'light.living_room'}
            )
        """
        payload: dict[str, Any] = {}
        if service_data:
            payload.update(service_data)
        if target:
            payload["target"] = target
        if return_response:
            payload["return_response"] = True

        data = self._request("POST", f"/services/{domain}/{service}", json=payload)

        # Parse response
        changed_states = []
        if isinstance(data, list):
            changed_states = [Entity.model_validate(item) for item in data]
            return ServiceCallResponse(changed_states=changed_states)

        return ServiceCallResponse(
            context=data.get("context") if data else None,
            response=data.get("response") if data else None,
            changed_states=changed_states,
        )

    def call_service_request(self, request: ServiceCallRequest) -> ServiceCallResponse:
        """
        Call a service using a ServiceCallRequest model.

        Args:
            request: Service call request

        Returns:
            ServiceCallResponse with results
        """
        return self.call_service(
            domain=request.domain,
            service=request.service,
            service_data=request.service_data or None,
            target=request.target,
            return_response=request.return_response,
        )

    # -------------------------------------------------------------------------
    # Registry
    # -------------------------------------------------------------------------

    def get_areas(self) -> list[Area]:
        """
        Get all areas from the area registry.

        Returns:
            List of areas
        """
        # Note: This endpoint may require WebSocket in some HA versions
        # Falling back to config entries endpoint
        try:
            data = self._request("GET", "/config/area_registry")
            return [Area.model_validate(item) for item in data]
        except APIError:
            logger.warning("Area registry not available via REST API")
            return []

    def get_devices(self) -> list[Device]:
        """
        Get all devices from the device registry.

        Returns:
            List of devices
        """
        try:
            data = self._request("GET", "/config/device_registry")
            return [Device.model_validate(item) for item in data]
        except APIError:
            logger.warning("Device registry not available via REST API")
            return []

    def get_entity_registry(self) -> list[EntityRegistryEntry]:
        """
        Get all entity registry entries.

        Returns:
            List of entity registry entries
        """
        try:
            data = self._request("GET", "/config/entity_registry")
            return [EntityRegistryEntry.model_validate(item) for item in data]
        except APIError:
            logger.warning("Entity registry not available via REST API")
            return []

    # -------------------------------------------------------------------------
    # Events
    # -------------------------------------------------------------------------

    def fire_event(
        self,
        event_type: str,
        event_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Fire an event.

        Args:
            event_type: Type of event to fire
            event_data: Event data

        Returns:
            Response with event context
        """
        data = self._request("POST", f"/events/{event_type}", json=event_data or {})
        return data or {}

    # -------------------------------------------------------------------------
    # Templates
    # -------------------------------------------------------------------------

    def render_template(self, template: str) -> str:
        """
        Render a Jinja2 template.

        Args:
            template: Template string to render

        Returns:
            Rendered template result
        """
        data = self._request("POST", "/template", json={"template": template})
        return str(data) if data else ""

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
        """
        Get entity state history.

        Args:
            entity_ids: Filter to specific entities
            start_time: Start time (ISO format)
            end_time: End time (ISO format)
            minimal_response: Return minimal data

        Returns:
            List of entity history (list per entity)
        """
        params: dict[str, Any] = {}
        if entity_ids:
            params["filter_entity_id"] = ",".join(entity_ids)
        if end_time:
            params["end_time"] = end_time
        if minimal_response:
            params["minimal_response"] = "true"

        endpoint = "/history/period"
        if start_time:
            endpoint = f"/history/period/{start_time}"

        data = self._request("GET", endpoint, params=params)
        if not data:
            return []

        return [
            [Entity.model_validate(state) for state in entity_history] for entity_history in data
        ]
