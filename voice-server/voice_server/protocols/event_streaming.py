"""
Event streaming hook for voice server debugging.

Captures ALL Amplifier events and queues them for SSE streaming to the browser,
enabling real-time debugging visibility into LLM requests, tool calls, and session events.

DESIGN: Pass through ALL raw event data unchanged (except image sanitization).
The frontend receives exactly what Amplifier emits for full debugging capability.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from amplifier_core.models import HookResult

logger = logging.getLogger(__name__)


class EventStreamingHook:
    """
    Queue-based streaming hook for browser debugging console.

    Subscribes to Amplifier events and queues them for SSE streaming
    to display raw LLM requests/responses, tool calls, and session events.

    All events pass through raw data unchanged (only images sanitized).
    """

    # Hook metadata (for registration)
    name = "voice-event-streaming"
    priority = 100  # Run early to capture events

    def __init__(self, event_queue: asyncio.Queue[dict[str, Any]]):
        """
        Initialize event streaming hook.

        Args:
            event_queue: Queue to put events for SSE streaming
        """
        self._queue = event_queue
        self._current_blocks: dict[int, str] = {}  # index -> block_type

    async def __call__(self, event: str, data: dict[str, Any]) -> HookResult:
        """
        Handle Amplifier event and queue for streaming.

        Args:
            event: Event name (e.g., "content_block:start", "provider:request")
            data: Event data dict

        Returns:
            HookResult with action="continue"
        """
        # Log all events for server-side debugging
        logger.debug(f"[EVENT] {event}: {list(data.keys()) if data else 'no data'}")

        try:
            message = self._map_event_to_message(event, data)
            if message:
                await self._queue.put(message)
        except Exception as e:
            logger.warning(f"Failed to queue event {event}: {e}")

        # Always continue - streaming is observational
        return HookResult(action="continue")

    def _map_event_to_message(
        self, event: str, data: dict[str, Any]
    ) -> dict[str, Any] | None:
        """
        Map Amplifier event to SSE message format.

        ALWAYS passes through full raw data. Only adds minimal required fields
        for UI functionality. Images are sanitized to avoid huge payloads.

        Args:
            event: Event name
            data: Event data

        Returns:
            SSE message dict or None if event should be skipped
        """
        # Sanitize to remove only image binary data
        sanitized = self._sanitize_for_streaming(data)

        # Convert event name to message type
        # e.g., "content_block:start" -> "content_start", "provider:request" -> "provider_request"
        msg_type = event.replace(":", "_").replace("_block", "")

        # Content streaming events - need index tracking
        if event == "content_block:start":
            block_type = data.get("block_type") or data.get("type", "text")
            index = (
                data.get("block_index")
                if data.get("block_index") is not None
                else data.get("index", 0)
            )
            self._current_blocks[index] = block_type

            return {
                "type": "content_start",
                "block_type": block_type,
                "index": index,
                **sanitized,
            }

        elif event == "content_block:delta":
            index = (
                data.get("block_index")
                if data.get("block_index") is not None
                else data.get("index", 0)
            )
            block_type = self._current_blocks.get(index, "text")

            # Extract delta text for convenience
            delta = data.get("delta", {})
            delta_text = (
                delta.get("text", "") if isinstance(delta, dict) else str(delta)
            )

            return {
                "type": "content_delta",
                "index": index,
                "delta": delta_text,
                "block_type": block_type,
                **sanitized,
            }

        elif event == "content_block:end":
            index = (
                data.get("block_index")
                if data.get("block_index") is not None
                else data.get("index", 0)
            )
            block_type = self._current_blocks.pop(index, "text")

            # Extract content for convenience
            block = data.get("block", {})
            if isinstance(block, dict):
                content = block.get("text", "") or block.get("content", "")
            else:
                content = data.get("content", "")

            return {
                "type": "content_end",
                "index": index,
                "content": content,
                "block_type": block_type,
                **sanitized,
            }

        # Thinking events
        elif event == "thinking:delta":
            return {
                "type": "thinking_delta",
                **sanitized,
            }

        elif event == "thinking:final":
            return {
                "type": "thinking_final",
                **sanitized,
            }

        # Tool lifecycle - add convenience fields
        elif event == "tool:pre":
            return {
                "type": "tool_call",
                "tool_name": data.get("tool_name", "unknown"),
                "tool_call_id": data.get("tool_call_id", ""),
                "arguments": data.get("tool_input") or data.get("arguments", {}),
                "status": "pending",
                **sanitized,
            }

        elif event == "tool:post":
            result = data.get("result", {})
            return {
                "type": "tool_result",
                "tool_name": data.get("tool_name", "unknown"),
                "tool_call_id": data.get("tool_call_id", ""),
                "output": (
                    result.get("output", "")
                    if isinstance(result, dict)
                    else str(result)
                ),
                "success": result.get("success", True)
                if isinstance(result, dict)
                else True,
                "error": result.get("error") if isinstance(result, dict) else None,
                **sanitized,
            }

        elif event == "tool:error":
            return {
                "type": "tool_error",
                **sanitized,
            }

        # Session lifecycle
        elif event == "session:fork":
            return {
                "type": "session_fork",
                "child_session_id": data.get("child_session_id", ""),
                "agent": data.get("agent", ""),
                **sanitized,
            }

        elif event == "session:start":
            return {
                "type": "session_start",
                **sanitized,
            }

        elif event == "session:end":
            return {
                "type": "session_end",
                **sanitized,
            }

        # Provider/LLM events - the key debugging info!
        elif event in ("provider:request", "llm:request", "llm:request:raw"):
            return {
                "type": "provider_request",
                "event": event,
                **sanitized,
            }

        elif event in ("provider:response", "llm:response", "llm:response:raw"):
            return {
                "type": "provider_response",
                "event": event,
                **sanitized,
            }

        # Context compaction
        elif event == "context:compaction":
            return {
                "type": "context_compaction",
                **sanitized,
            }

        # User notifications
        elif event == "user:notification":
            return {
                "type": "display_message",
                **sanitized,
            }

        # Cancellation events
        elif event == "cancel:requested":
            return {
                "type": "cancel_requested",
                "level": data.get("level", "graceful"),
                "running_tools": data.get("running_tools", []),
                **sanitized,
            }

        elif event == "cancel:completed":
            return {
                "type": "cancel_completed",
                "level": data.get("level", "graceful"),
                "tools_cancelled": data.get("tools_cancelled", 0),
                **sanitized,
            }

        # All other events - pass through with raw data
        else:
            return {
                "type": msg_type,
                "event": event,  # Keep original event name for reference
                **sanitized,
            }

    def _sanitize_for_streaming(self, data: dict[str, Any]) -> dict[str, Any]:
        """
        Sanitize data for streaming transmission.

        Only removes large binary data (images) to avoid huge payloads.
        All other data is passed through unchanged for full debugging.
        """

        def sanitize_value(val: Any) -> Any:
            if isinstance(val, dict):
                # Check for image source pattern
                if val.get("type") == "image" and "source" in val:
                    sanitized = dict(val)
                    sanitized["source"] = {
                        "type": "base64",
                        "data": "[image data omitted]",
                    }
                    return sanitized
                # Check for base64 image source
                if (
                    val.get("type") == "base64"
                    and "data" in val
                    and len(str(val.get("data", ""))) > 1000
                ):
                    return {"type": "base64", "data": "[image data omitted]"}
                return {k: sanitize_value(v) for k, v in val.items()}
            elif isinstance(val, list):
                return [sanitize_value(item) for item in val]
            else:
                return val

        return sanitize_value(data)


# List of all events we want to capture for debugging
# Based on amplifier-core canonical events
EVENTS_TO_CAPTURE = [
    # Content streaming
    "content_block:start",
    "content_block:delta",
    "content_block:end",
    # Thinking
    "thinking:delta",
    "thinking:final",
    # Tool lifecycle
    "tool:pre",
    "tool:post",
    "tool:error",
    # Session lifecycle
    "session:start",
    "session:end",
    "session:fork",
    "session:join",
    # Provider/LLM (the key debugging events!)
    "provider:request",
    "provider:response",
    "llm:request",
    "llm:response",
    "llm:request:raw",
    "llm:response:raw",
    # Context
    "context:compaction",
    # User notifications
    "user:notification",
    # Approvals
    "approval:request",
    "approval:response",
    # Cancellation
    "cancel:requested",
    "cancel:completed",
]
