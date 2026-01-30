"""
Voice Event Hook - Streams Amplifier events for voice UI.

This hook captures tool execution events and streams them to the voice
client for real-time feedback. Optimized for voice interactions where
users can't see detailed output but need status updates.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class VoiceEvent:
    """An event to be sent to the voice client."""
    type: str
    data: Dict[str, Any]
    timestamp: float = field(default_factory=lambda: asyncio.get_event_loop().time())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class VoiceEventHook:
    """
    Hook that captures Amplifier events and streams them for voice UI.

    This hook is optimized for voice interactions:
    - Summarizes tool outputs instead of showing full text
    - Provides audio-friendly status updates
    - Handles streaming content for TTS chunking
    """

    def __init__(self, event_callback: Optional[Callable] = None):
        """
        Initialize the voice event hook.

        Args:
            event_callback: Async function called with each VoiceEvent
        """
        self._event_callback = event_callback
        self._event_queue: asyncio.Queue[VoiceEvent] = asyncio.Queue()
        self._active_tools: Dict[str, Dict[str, Any]] = {}

    async def __call__(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an incoming Amplifier event.

        Returns a HookResult-like dict for compatibility with Amplifier hooks.
        """
        voice_event = await self._process_event(event_type, data)

        if voice_event:
            await self._emit(voice_event)

        # Allow the event to continue (don't block)
        return {"action": "continue"}

    async def _process_event(
        self,
        event_type: str,
        data: Dict[str, Any]
    ) -> Optional[VoiceEvent]:
        """Process an Amplifier event and convert to voice-friendly format."""

        # Tool execution events
        if event_type == "tool_start":
            tool_name = data.get("tool_name", "unknown")
            call_id = data.get("call_id")

            # Track active tool
            self._active_tools[call_id or tool_name] = {
                "name": tool_name,
                "start_time": asyncio.get_event_loop().time()
            }

            # Create voice-friendly event
            return VoiceEvent(
                type="voice_tool_start",
                data={
                    "tool_name": tool_name,
                    "call_id": call_id,
                    "spoken_text": self._get_tool_start_text(tool_name, data.get("arguments", {}))
                }
            )

        elif event_type == "tool_complete":
            tool_name = data.get("tool_name", "unknown")
            call_id = data.get("call_id")
            result = data.get("result", {})

            # Remove from active tools
            self._active_tools.pop(call_id or tool_name, None)

            return VoiceEvent(
                type="voice_tool_complete",
                data={
                    "tool_name": tool_name,
                    "call_id": call_id,
                    "success": result.get("success", True),
                    "spoken_text": self._get_tool_complete_text(tool_name, result)
                }
            )

        elif event_type == "tool_error":
            tool_name = data.get("tool_name", "unknown")
            call_id = data.get("call_id")
            error = data.get("error", "Unknown error")

            # Remove from active tools
            self._active_tools.pop(call_id or tool_name, None)

            return VoiceEvent(
                type="voice_tool_error",
                data={
                    "tool_name": tool_name,
                    "call_id": call_id,
                    "error": error,
                    "spoken_text": f"There was an error with {self._friendly_tool_name(tool_name)}: {error}"
                }
            )

        # Content streaming events
        elif event_type == "content_delta":
            return VoiceEvent(
                type="voice_content_delta",
                data={
                    "delta": data.get("delta", ""),
                    "index": data.get("index", 0)
                }
            )

        elif event_type == "content_complete":
            return VoiceEvent(
                type="voice_content_complete",
                data={
                    "content": data.get("content", ""),
                    "index": data.get("index", 0)
                }
            )

        # Display messages
        elif event_type == "display_message":
            return VoiceEvent(
                type="voice_display",
                data={
                    "level": data.get("level", "info"),
                    "message": data.get("message", ""),
                    "spoken_text": data.get("message", "")
                }
            )

        return None

    def _friendly_tool_name(self, tool_name: str) -> str:
        """Convert tool name to voice-friendly version."""
        friendly_names = {
            "bash": "command line",
            "filesystem": "file system",
            "read_file": "reading file",
            "write_file": "writing file",
            "list_directory": "listing directory",
            "execute": "running command",
            "web": "web browser",
            "search": "web search",
            "fetch": "fetching URL",
        }

        # Check for exact match
        if tool_name in friendly_names:
            return friendly_names[tool_name]

        # Check for partial match
        for key, friendly in friendly_names.items():
            if key in tool_name.lower():
                return friendly

        # Default: just make it readable
        return tool_name.replace("_", " ").replace("-", " ")

    def _get_tool_start_text(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Generate voice-friendly text for tool start."""
        friendly = self._friendly_tool_name(tool_name)

        # Add context based on arguments
        if "path" in arguments:
            path = arguments["path"]
            if "/" in path:
                path = path.split("/")[-1]  # Just filename
            return f"Accessing {path}"

        if "command" in arguments:
            cmd = arguments["command"]
            if len(cmd) > 30:
                cmd = cmd[:30] + "..."
            return f"Running: {cmd}"

        if "url" in arguments:
            return f"Fetching from web"

        if "query" in arguments:
            return f"Searching for: {arguments['query']}"

        return f"Using {friendly}"

    def _get_tool_complete_text(self, tool_name: str, result: Dict[str, Any]) -> str:
        """Generate voice-friendly text for tool completion."""
        if result.get("success"):
            return "Done"
        else:
            return f"Completed with issues"

    async def _emit(self, event: VoiceEvent) -> None:
        """Emit an event to the callback and queue."""
        # Add to queue for polling
        await self._event_queue.put(event)

        # Call callback if registered
        if self._event_callback:
            try:
                if asyncio.iscoroutinefunction(self._event_callback):
                    await self._event_callback(event)
                else:
                    self._event_callback(event)
            except Exception as e:
                logger.error(f"Error in voice event callback: {e}")

    async def get_events(self, timeout: float = 0.1) -> List[VoiceEvent]:
        """Get pending events from the queue."""
        events = []
        try:
            while True:
                event = await asyncio.wait_for(
                    self._event_queue.get(),
                    timeout=timeout
                )
                events.append(event)
        except asyncio.TimeoutError:
            pass
        return events

    def set_callback(self, callback: Callable) -> None:
        """Set the event callback."""
        self._event_callback = callback

    def get_active_tools(self) -> Dict[str, Dict[str, Any]]:
        """Get currently active tool executions."""
        return dict(self._active_tools)
