"""Data models for Home Assistant integration."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EntityState(str, Enum):
    """Common entity states."""

    ON = "on"
    OFF = "off"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"
    HOME = "home"
    NOT_HOME = "not_home"
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    PLAYING = "playing"
    PAUSED = "paused"
    IDLE = "idle"


class EntityAttributes(BaseModel):
    """Entity attributes model."""

    friendly_name: str | None = None
    unit_of_measurement: str | None = None
    device_class: str | None = None
    icon: str | None = None
    supported_features: int | None = None
    extra: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}


class Entity(BaseModel):
    """Home Assistant entity model."""

    entity_id: str
    state: str
    attributes: dict[str, Any] = Field(default_factory=dict)
    last_changed: datetime | None = None
    last_updated: datetime | None = None
    last_reported: datetime | None = None
    context: dict[str, Any] | None = None

    @property
    def domain(self) -> str:
        """Get the entity domain (e.g., 'light' from 'light.living_room')."""
        return self.entity_id.split(".")[0]

    @property
    def object_id(self) -> str:
        """Get the object ID (e.g., 'living_room' from 'light.living_room')."""
        return self.entity_id.split(".", 1)[1] if "." in self.entity_id else self.entity_id

    @property
    def friendly_name(self) -> str:
        """Get the friendly name or entity_id as fallback."""
        return self.attributes.get("friendly_name", self.entity_id)

    def is_on(self) -> bool:
        """Check if entity is in 'on' state."""
        return self.state.lower() == EntityState.ON.value

    def is_off(self) -> bool:
        """Check if entity is in 'off' state."""
        return self.state.lower() == EntityState.OFF.value

    def is_available(self) -> bool:
        """Check if entity is available."""
        return self.state.lower() not in (
            EntityState.UNAVAILABLE.value,
            EntityState.UNKNOWN.value,
        )


class ServiceField(BaseModel):
    """Service field definition."""

    name: str | None = None
    description: str | None = None
    required: bool = False
    example: Any = None
    selector: dict[str, Any] | None = None


class Service(BaseModel):
    """Home Assistant service model."""

    domain: str
    service: str
    name: str | None = None
    description: str | None = None
    fields: dict[str, ServiceField] = Field(default_factory=dict)
    target: dict[str, Any] | None = None

    @property
    def full_name(self) -> str:
        """Get the full service name (domain.service)."""
        return f"{self.domain}.{self.service}"


class Event(BaseModel):
    """Home Assistant event model."""

    event_type: str
    data: dict[str, Any] = Field(default_factory=dict)
    origin: str | None = None
    time_fired: datetime | None = None
    context: dict[str, Any] | None = None


class StateChangedEventData(BaseModel):
    """Data model for state_changed events."""

    entity_id: str
    old_state: Entity | None = None
    new_state: Entity | None = None


class ServiceCallEventData(BaseModel):
    """Data model for call_service events."""

    domain: str
    service: str
    service_data: dict[str, Any] = Field(default_factory=dict)


class Area(BaseModel):
    """Home Assistant area model."""

    area_id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    picture: str | None = None
    floor_id: str | None = None


class Device(BaseModel):
    """Home Assistant device model."""

    id: str
    name: str | None = None
    name_by_user: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    sw_version: str | None = None
    hw_version: str | None = None
    area_id: str | None = None
    disabled_by: str | None = None
    configuration_url: str | None = None
    identifiers: list[list[str]] = Field(default_factory=list)


class EntityRegistryEntry(BaseModel):
    """Entity registry entry model."""

    entity_id: str
    name: str | None = None
    icon: str | None = None
    platform: str | None = None
    device_id: str | None = None
    area_id: str | None = None
    disabled_by: str | None = None
    hidden_by: str | None = None
    unique_id: str | None = None


class HAConfig(BaseModel):
    """Home Assistant configuration/info model."""

    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    elevation: int | None = None
    unit_system: dict[str, str] = Field(default_factory=dict)
    time_zone: str | None = None
    version: str | None = None
    state: str | None = None
    internal_url: str | None = None
    external_url: str | None = None


class WebSocketMessage(BaseModel):
    """WebSocket message model."""

    id: int | None = None
    type: str
    success: bool | None = None
    result: Any = None
    error: dict[str, Any] | None = None
    event: dict[str, Any] | None = None


class ServiceCallRequest(BaseModel):
    """Request model for calling a service."""

    domain: str
    service: str
    service_data: dict[str, Any] = Field(default_factory=dict)
    target: dict[str, Any] | None = None
    return_response: bool = False


class ServiceCallResponse(BaseModel):
    """Response model from service calls."""

    context: dict[str, Any] | None = None
    response: Any = None
    changed_states: list[Entity] = Field(default_factory=list)
