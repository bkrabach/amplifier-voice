"""
Voice Server Service - FastAPI application for real-time voice assistant.

This service provides:
- OpenAI Realtime API integration for voice I/O
- Amplifier-powered tool execution
- WebRTC signaling endpoints
"""

import asyncio
import json
import logging
from typing import Callable, Any, Dict, Optional
from contextlib import asynccontextmanager, AsyncExitStack

from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import settings
from .amplifier_bridge import (
    AmplifierBridge,
    get_amplifier_bridge,
    cleanup_amplifier_bridge,
)
from .realtime import create_realtime_session, exchange_realtime_sdp
from .transcript import TranscriptEntry, TranscriptRepository

logger = logging.getLogger(__name__)

# Amplifier bridge instance
_amplifier_bridge: Optional[AmplifierBridge] = None

# Transcript repository instance
_transcript_repo: Optional[TranscriptRepository] = None


class FastAPILifespan:
    """Manages FastAPI application lifespan with multiple handlers."""

    def __init__(self):
        self.handlers = []

    def register_handler(self, handler: Callable):
        self.handlers.append(handler)

    @asynccontextmanager
    async def lifespan(self, app: FastAPI):
        async with AsyncExitStack() as stack:
            logger.info("Service lifespan initializing...")

            for handler in self.handlers:
                await stack.enter_async_context(handler())

            logger.info("Service lifespan started")
            try:
                yield
            finally:
                logger.info("Service lifespan shutting down...")


def service_init(app: FastAPI, register_lifespan_handler: Callable):
    """Initialize the voice server endpoints and middleware."""
    global _amplifier_bridge

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.service.allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/session")
    async def create_session(request: Request) -> Dict[str, Any]:
        """
        Create a new voice session with Amplifier-powered tools.

        Accepts optional voice parameter in request body.
        Returns session data including client_secret for WebRTC auth.
        """
        if not _amplifier_bridge:
            raise HTTPException(
                status_code=503, detail="Amplifier bridge not initialized"
            )

        # Get voice parameter from body if provided
        try:
            body = await request.json()
            voice = body.get("voice", "ash")
        except Exception:
            voice = "ash"

        return await create_realtime_session(_amplifier_bridge, voice=voice)

    @app.post("/sdp")
    async def exchange_sdp(request: Request, authorization: str = Header(...)):
        """
        Exchange SDP for WebRTC connection.

        Requires Authorization header with ephemeral token from /session.
        """
        offer_sdp = await request.body()
        return await exchange_realtime_sdp(offer_sdp, authorization)

    @app.post("/execute/{tool_name}")
    async def handle_tool_call(tool_name: str, arguments: dict) -> Dict[str, Any]:
        """
        Execute a tool via Amplifier bridge.

        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments as JSON body

        Returns:
            Tool execution result with success/output/error
        """
        if not _amplifier_bridge:
            raise HTTPException(
                status_code=503, detail="Amplifier bridge not initialized"
            )

        result = await _amplifier_bridge.execute_tool(tool_name, arguments)
        return result.to_dict()

    @app.get("/tools")
    async def list_tools() -> Dict[str, Any]:
        """
        List all available tools from Amplifier.

        Returns tool definitions in OpenAI function calling format.
        """
        if not _amplifier_bridge:
            return {"tools": [], "count": 0}

        tools = _amplifier_bridge.get_tools_for_openai()
        return {"tools": tools, "count": len(tools)}

    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        """
        Health check endpoint.

        Returns service status and Amplifier state.
        """
        tools_count = len(_amplifier_bridge.get_tools()) if _amplifier_bridge else 0
        return {
            "status": "healthy",
            "version": settings.service.version,
            "amplifier": {
                "enabled": _amplifier_bridge is not None,
                "tools_count": tools_count,
            },
            "model": settings.realtime.model,
        }

    # ============ Event Streaming (SSE) for Debugging ============

    @app.get("/events")
    async def event_stream(request: Request):
        """
        Server-Sent Events stream of ALL Amplifier events for debugging.

        Opens a persistent connection that streams raw Amplifier events
        (LLM requests/responses, tool calls, session events) to the browser
        console for full debugging visibility.

        Events are color-coded in the browser console:
        - 🔼 provider_request (amber) - Raw LLM requests
        - 🔽 provider_response (green) - Raw LLM responses
        - 🔧 tool_call/tool_result (blue) - Tool execution
        - 🔀 session_fork (purple) - Agent delegation
        - 💬 content_* (gray) - Content streaming
        """
        if not _amplifier_bridge:
            raise HTTPException(
                status_code=503, detail="Amplifier bridge not initialized"
            )

        async def generate_events():
            """Generator that yields SSE-formatted events from the queue."""
            logger.info("[SSE] Client connected to event stream")
            
            try:
                while True:
                    # Check if client disconnected
                    if await request.is_disconnected():
                        logger.info("[SSE] Client disconnected")
                        break

                    try:
                        # Wait for event with timeout to check for disconnect
                        event = await asyncio.wait_for(
                            _amplifier_bridge.event_queue.get(),
                            timeout=30.0  # Send keepalive every 30s
                        )
                        
                        # Format as SSE
                        event_data = json.dumps(event)
                        yield f"data: {event_data}\n\n"
                        
                    except asyncio.TimeoutError:
                        # Send keepalive comment to prevent connection timeout
                        yield ": keepalive\n\n"
                        
            except asyncio.CancelledError:
                logger.info("[SSE] Event stream cancelled")
            except Exception as e:
                logger.error(f"[SSE] Error in event stream: {e}")
            finally:
                logger.info("[SSE] Event stream closed")

        return StreamingResponse(
            generate_events(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )

    # ============ Session & Transcript Endpoints ============

    @app.get("/sessions")
    async def list_sessions(
        status: Optional[str] = None, limit: int = 20
    ) -> Dict[str, Any]:
        """
        List voice sessions.

        Returns list of sessions with metadata for session picker UI.
        """
        if not _transcript_repo:
            return {"sessions": [], "count": 0}

        sessions = _transcript_repo.list_sessions(status=status, limit=limit)
        return {
            "sessions": [s.to_dict() for s in sessions],
            "count": len(sessions),
        }

    @app.post("/sessions")
    async def create_voice_session(request: Request) -> Dict[str, Any]:
        """
        Create a new voice session with transcript tracking.

        Returns session_id for use with /session endpoint.
        """
        if not _transcript_repo:
            raise HTTPException(
                status_code=503, detail="Transcript repository not initialized"
            )

        session = _transcript_repo.create_session()
        return {"session_id": session.id, "session": session.to_dict()}

    @app.get("/sessions/{session_id}")
    async def get_session_details(session_id: str) -> Dict[str, Any]:
        """
        Get session details including full transcript.
        """
        if not _transcript_repo:
            raise HTTPException(
                status_code=503, detail="Transcript repository not initialized"
            )

        session = _transcript_repo.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        transcript = _transcript_repo.get_transcript(session_id)
        return {
            "session": session.to_dict(),
            "transcript": [e.to_dict() for e in transcript],
        }

    @app.post("/sessions/{session_id}/transcript")
    async def sync_transcript(session_id: str, request: Request) -> Dict[str, Any]:
        """
        Sync transcript entries from client.

        Client sends new entries, server appends to transcript.
        """
        if not _transcript_repo:
            raise HTTPException(
                status_code=503, detail="Transcript repository not initialized"
            )

        body = await request.json()
        entries = body.get("entries", [])

        synced = 0
        for entry_data in entries:
            entry = TranscriptEntry(
                session_id=session_id,
                entry_type=entry_data.get("entry_type", "user"),
                text=entry_data.get("text"),
                tool_name=entry_data.get("tool_name"),
                tool_call_id=entry_data.get("tool_call_id"),
                tool_arguments=entry_data.get("tool_arguments"),
                tool_result=entry_data.get("tool_result"),
                audio_duration_ms=entry_data.get("audio_duration_ms"),
            )
            _transcript_repo.add_entry(entry)
            synced += 1

        return {"synced": synced, "session_id": session_id}

    @app.post("/sessions/{session_id}/end")
    async def end_session(session_id: str, request: Request) -> Dict[str, Any]:
        """
        End a session and record disconnect information.

        Body should include:
        - reason: "user_ended" | "idle_timeout" | "session_limit" | "network_error" | "error"
        - error_details: Optional string with additional error info
        """
        if not _transcript_repo:
            raise HTTPException(
                status_code=503, detail="Transcript repository not initialized"
            )

        try:
            body = await request.json()
            reason = body.get("reason", "user_ended")
            error_details = body.get("error_details")
        except Exception:
            reason = "user_ended"
            error_details = None

        session = _transcript_repo.end_session(
            session_id, reason=reason, error_details=error_details
        )

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "session_id": session_id,
            "status": session.status,
            "end_reason": session.end_reason,
            "duration_seconds": session.duration_seconds,
        }

    @app.get("/sessions/stats")
    async def get_session_stats() -> Dict[str, Any]:
        """
        Get aggregate session statistics for debugging/analytics.

        Returns counts by end_reason, average duration, etc.
        """
        if not _transcript_repo:
            return {"error": "Transcript repository not initialized"}

        return _transcript_repo.get_session_stats()

    @app.post("/sessions/{session_id}/resume")
    async def resume_session(session_id: str, request: Request) -> Dict[str, Any]:
        """
        Get context for resuming a session.

        Returns conversation history in OpenAI format for injection.
        """
        if not _transcript_repo:
            raise HTTPException(
                status_code=503, detail="Transcript repository not initialized"
            )

        session = _transcript_repo.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get body for optional voice parameter
        try:
            body = await request.json()
            voice = body.get("voice", "ash")
        except Exception:
            voice = "ash"

        # Get resumption context (conversation history)
        context = _transcript_repo.get_resumption_context(session_id)

        # Get full transcript for UI display
        transcript = _transcript_repo.get_transcript(session_id)

        # Create new OpenAI session for the resumed conversation
        if not _amplifier_bridge:
            raise HTTPException(
                status_code=503, detail="Amplifier bridge not initialized"
            )

        realtime_session = await create_realtime_session(_amplifier_bridge, voice=voice)

        return {
            "session_id": session_id,
            "session": session.to_dict(),
            "context_to_inject": context,
            "transcript": [e.to_dict() for e in transcript],  # Full transcript for UI
            "realtime": realtime_session,
        }

    @asynccontextmanager
    async def service_lifespan():
        """Service lifecycle manager - initializes and cleans up Amplifier."""
        global _amplifier_bridge, _transcript_repo

        try:
            # Initialize transcript repository
            logger.info("Initializing transcript repository...")
            _transcript_repo = TranscriptRepository()
            logger.info(
                f"Transcript repository ready at {_transcript_repo._storage_dir}"
            )

            # Initialize Amplifier bridge (programmatic foundation approach)
            logger.info("Initializing Amplifier bridge...")

            _amplifier_bridge = await get_amplifier_bridge(
                bundle=settings.amplifier.bundle, cwd=settings.amplifier.cwd
            )

            tools_count = len(_amplifier_bridge.get_tools())
            logger.info(f"Amplifier bridge initialized with {tools_count} tools")

            yield

        finally:
            logger.info("Cleaning up Amplifier bridge...")
            await cleanup_amplifier_bridge()
            _amplifier_bridge = None
            _transcript_repo = None
            logger.info("Service cleanup complete")

    register_lifespan_handler(service_lifespan)
