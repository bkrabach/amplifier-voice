"""
Voice Display System - Handles display messages for voice interactions.

This system adapts Amplifier's display messages for voice output,
converting visual information into spoken format.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class DisplayLevel(Enum):
    """Display message severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    DEBUG = "debug"


@dataclass
class VoiceDisplayMessage:
    """A display message formatted for voice output."""
    level: DisplayLevel
    message: str
    spoken_text: str
    should_speak: bool = True

    def to_dict(self):
        return {
            "level": self.level.value,
            "message": self.message,
            "spoken_text": self.spoken_text,
            "should_speak": self.should_speak
        }


class VoiceDisplaySystem:
    """
    Display system optimized for voice interactions.

    Features:
    - Converts verbose messages to concise spoken format
    - Filters out noise that shouldn't be spoken
    - Handles different urgency levels appropriately
    """

    def __init__(self, message_callback: Optional[Callable] = None):
        """
        Initialize the voice display system.

        Args:
            message_callback: Called when a message should be displayed/spoken
        """
        self._callback = message_callback
        self._suppressed_patterns = [
            "debug:",
            "trace:",
            "[internal]",
        ]

    async def display(
        self,
        message: str,
        level: str = "info",
        nesting: int = 0
    ) -> VoiceDisplayMessage:
        """
        Display a message through the voice system.

        Args:
            message: The message to display
            level: Severity level (info, warning, error, success, debug)
            nesting: Indentation level (ignored for voice)

        Returns:
            VoiceDisplayMessage with formatted output
        """
        display_level = self._parse_level(level)
        should_speak = self._should_speak(message, display_level)
        spoken_text = self._to_spoken_format(message, display_level) if should_speak else ""

        voice_message = VoiceDisplayMessage(
            level=display_level,
            message=message,
            spoken_text=spoken_text,
            should_speak=should_speak
        )

        if self._callback and should_speak:
            try:
                await self._callback(voice_message)
            except Exception as e:
                logger.error(f"Error in display callback: {e}")

        return voice_message

    def _parse_level(self, level: str) -> DisplayLevel:
        """Parse string level to enum."""
        try:
            return DisplayLevel(level.lower())
        except ValueError:
            return DisplayLevel.INFO

    def _should_speak(self, message: str, level: DisplayLevel) -> bool:
        """Determine if a message should be spoken."""
        # Don't speak debug messages
        if level == DisplayLevel.DEBUG:
            return False

        # Check suppression patterns
        message_lower = message.lower()
        for pattern in self._suppressed_patterns:
            if pattern in message_lower:
                return False

        # Very short messages are probably not meaningful
        if len(message.strip()) < 3:
            return False

        return True

    def _to_spoken_format(self, message: str, level: DisplayLevel) -> str:
        """Convert a message to voice-friendly format."""
        # Clean up the message
        spoken = message.strip()

        # Remove common visual artifacts
        spoken = spoken.replace("...", "")
        spoken = spoken.replace("=>", "")
        spoken = spoken.replace("->", "")
        spoken = spoken.replace("|", "")

        # Remove excessive whitespace
        spoken = " ".join(spoken.split())

        # Add appropriate prefix for warnings/errors
        if level == DisplayLevel.ERROR:
            if not any(word in spoken.lower() for word in ["error", "failed", "problem"]):
                spoken = f"Error: {spoken}"
        elif level == DisplayLevel.WARNING:
            if not any(word in spoken.lower() for word in ["warning", "caution", "note"]):
                spoken = f"Note: {spoken}"

        # Truncate very long messages for voice
        max_length = 200
        if len(spoken) > max_length:
            # Try to break at a sentence
            sentences = spoken[:max_length].split(". ")
            if len(sentences) > 1:
                spoken = ". ".join(sentences[:-1]) + "."
            else:
                spoken = spoken[:max_length].rsplit(" ", 1)[0] + "..."

        return spoken

    def info(self, message: str):
        """Display an info message."""
        import asyncio
        return asyncio.create_task(self.display(message, "info"))

    def warning(self, message: str):
        """Display a warning message."""
        import asyncio
        return asyncio.create_task(self.display(message, "warning"))

    def error(self, message: str):
        """Display an error message."""
        import asyncio
        return asyncio.create_task(self.display(message, "error"))

    def success(self, message: str):
        """Display a success message."""
        import asyncio
        return asyncio.create_task(self.display(message, "success"))

    def set_callback(self, callback: Callable):
        """Set the message callback."""
        self._callback = callback

    def add_suppressed_pattern(self, pattern: str):
        """Add a pattern to suppress from speaking."""
        self._suppressed_patterns.append(pattern.lower())
