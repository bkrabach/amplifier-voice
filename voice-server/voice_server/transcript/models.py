"""Data models for transcript capture."""

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class TranscriptEntry:
    """Single entry in the conversation transcript."""

    session_id: str
    entry_type: str  # "user" | "assistant" | "tool_call" | "tool_result" | "system"
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    # Content (populated based on entry_type)
    text: Optional[str] = None
    tool_name: Optional[str] = None
    tool_call_id: Optional[str] = None
    tool_arguments: Optional[dict] = None
    tool_result: Optional[dict] = None

    # Metadata
    audio_duration_ms: Optional[int] = None

    def to_dict(self) -> dict:
        """Convert to JSON-safe dict."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict) -> "TranscriptEntry":
        """Create from dict."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class VoiceSession:
    """A voice conversation session."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    # Session metadata
    title: Optional[str] = None
    status: str = "active"  # "active" | "completed" | "disconnected" | "error"

    # Stats
    message_count: int = 0
    tool_call_count: int = 0

    # Entries stored separately, but we can include summary
    first_message: Optional[str] = None
    last_message: Optional[str] = None

    # Disconnect tracking
    ended_at: Optional[str] = None
    end_reason: Optional[str] = (
        None  # "user_ended" | "idle_timeout" | "session_limit" | "error" | "network_error"
    )
    duration_seconds: Optional[int] = None
    error_details: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to JSON-safe dict."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "VoiceSession":
        """Create from dict."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
