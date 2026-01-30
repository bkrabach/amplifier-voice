"""
OpenAI Realtime API integration for voice assistant (GA).

This module handles:
- Creating sessions with client secrets (ephemeral tokens) via GA endpoints
- WebRTC SDP exchange for audio streaming via /v1/realtime/calls
- Tool configuration via Amplifier bridge

GA API changes (from beta):
- Endpoint: /v1/realtime/client_secrets (was /v1/realtime/sessions)
- SDP: /v1/realtime/calls (was /v1/realtime?model=...)
- Session type required: {"session": {"type": "realtime", ...}}
- Audio config: {"audio": {"output": {"voice": "..."}}}
"""

import json
import httpx
import logging
from typing import Dict, Any

from fastapi import HTTPException, Response

from . import settings
from .amplifier_bridge import AmplifierBridge

logger = logging.getLogger(__name__)

# OpenAI Realtime API GA endpoints
OPENAI_REALTIME_BASE = "https://api.openai.com/v1/realtime"
CLIENT_SECRETS_ENDPOINT = f"{OPENAI_REALTIME_BASE}/client_secrets"
SDP_EXCHANGE_ENDPOINT = f"{OPENAI_REALTIME_BASE}/calls"


async def create_realtime_session(
    amplifier: AmplifierBridge, voice: str = "ash"
) -> Dict[str, Any]:
    """
    Create a new OpenAI Realtime session with client secret (GA API).

    Uses the /v1/realtime/client_secrets endpoint to create a session
    and get an ephemeral client secret for WebRTC authentication.

    Args:
        amplifier: AmplifierBridge instance for tool discovery
        voice: Voice to use (ash, sage, marin, coral)

    Returns:
        Session data including client_secret (value) for WebRTC auth
    """
    headers = {
        "Authorization": f"Bearer {settings.realtime.openai_api_key}",
        "Content-Type": "application/json",
    }

    # Get tools from Amplifier
    available_tools = amplifier.get_tools_for_openai()
    logger.info(f"Configuring session with {len(available_tools)} Amplifier tools")

    # Build GA API session config
    # GA API is VERY restrictive - only these parameters are allowed at session creation
    session_config = {
        "session": {
            "type": "realtime",  # Required in GA API
            "model": settings.realtime.model,
            "instructions": settings.realtime.instructions,
            "tools": available_tools,
        }
    }

    # Note: voice, turn_detection, modalities are NOT supported at session creation
    # These will need to be set via session.update after connection is established

    logger.debug(f"GA session config: {json.dumps(session_config, indent=2)}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            CLIENT_SECRETS_ENDPOINT, json=session_config, headers=headers
        )

    if resp.status_code != 200:
        logger.error(f"Failed to create session: {resp.status_code} - {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    response_data = resp.json()
    client_secret = response_data.get("value", "unknown")
    logger.info(f"Session created with client secret: {client_secret[:20]}...")

    # Transform response to match client expectations
    # OpenAI returns: { "value": "ek_..." }
    # Client expects: { "client_secret": { "value": "ek_..." } }
    return {"client_secret": {"value": client_secret}}


async def exchange_realtime_sdp(offer_sdp: bytes, authorization: str) -> Response:
    """
    Exchange SDP with OpenAI for WebRTC connection (GA API).

    Uses /v1/realtime/calls endpoint (changed from /v1/realtime?model=...)

    Args:
        offer_sdp: Client's SDP offer
        authorization: Bearer token from client secret

    Returns:
        SDP answer from OpenAI
    """
    headers = {"Authorization": authorization, "Content-Type": "application/sdp"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            SDP_EXCHANGE_ENDPOINT, content=offer_sdp, headers=headers
        )

    if resp.status_code != 200:
        logger.error(f"SDP exchange failed: {resp.status_code} - {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    # GA API returns raw SDP
    sdp_content = resp.text

    logger.info("SDP exchange successful")
    return Response(content=sdp_content, media_type="application/sdp")
