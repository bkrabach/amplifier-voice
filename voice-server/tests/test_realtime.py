"""Tests for realtime.py — session creation and SDP exchange."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from voice_server.realtime import create_realtime_session, exchange_realtime_sdp


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_httpx_response(
    status_code: int = 200,
    json_data: dict | None = None,
    text: str = "",
    headers: dict | None = None,
) -> MagicMock:
    """Build a fake httpx response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.text = text
    resp.headers = headers or {}
    return resp


def make_mock_amplifier() -> MagicMock:
    """Return a minimal AmplifierBridge mock."""
    bridge = MagicMock()
    bridge.get_tools_for_openai.return_value = []
    return bridge


def patch_httpx_post(response: MagicMock):
    """Context manager: patches httpx.AsyncClient so .post() returns response."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return patch("voice_server.realtime.httpx.AsyncClient", return_value=mock_client)


# ---------------------------------------------------------------------------
# Tests: create_realtime_session
# ---------------------------------------------------------------------------


class TestCreateRealtimeSession:
    """create_realtime_session should return both client_secret and session_id."""

    @pytest.mark.asyncio
    async def test_returns_client_secret_value(self):
        """client_secret.value is extracted from the response top-level 'value' field."""
        fake_resp = make_httpx_response(
            json_data={"value": "ek_test_abc123", "id": "sess_xyz789"},
        )
        bridge = make_mock_amplifier()

        with patch_httpx_post(fake_resp):
            with patch("voice_server.realtime.settings") as mock_settings:
                mock_settings.realtime.openai_api_key = "sk-test"
                mock_settings.realtime.model = "gpt-realtime-1.5"
                mock_settings.realtime.get_instructions.return_value = (
                    "You are helpful."
                )
                result = await create_realtime_session(bridge)

        assert result["client_secret"]["value"] == "ek_test_abc123"

    @pytest.mark.asyncio
    async def test_returns_session_id_from_response(self):
        """session_id is extracted from the 'id' field in the OpenAI response."""
        fake_resp = make_httpx_response(
            json_data={"value": "ek_test_abc123", "id": "sess_xyz789"},
        )
        bridge = make_mock_amplifier()

        with patch_httpx_post(fake_resp):
            with patch("voice_server.realtime.settings") as mock_settings:
                mock_settings.realtime.openai_api_key = "sk-test"
                mock_settings.realtime.model = "gpt-realtime-1.5"
                mock_settings.realtime.get_instructions.return_value = (
                    "You are helpful."
                )
                result = await create_realtime_session(bridge)

        assert result["session_id"] == "sess_xyz789"

    @pytest.mark.asyncio
    async def test_return_structure(self):
        """Return dict has exactly the expected top-level keys."""
        fake_resp = make_httpx_response(
            json_data={"value": "ek_test_abc123", "id": "sess_xyz789"},
        )
        bridge = make_mock_amplifier()

        with patch_httpx_post(fake_resp):
            with patch("voice_server.realtime.settings") as mock_settings:
                mock_settings.realtime.openai_api_key = "sk-test"
                mock_settings.realtime.model = "gpt-realtime-1.5"
                mock_settings.realtime.get_instructions.return_value = (
                    "You are helpful."
                )
                result = await create_realtime_session(bridge)

        assert set(result.keys()) == {"client_secret", "session_id"}


# ---------------------------------------------------------------------------
# Tests: exchange_realtime_sdp
# ---------------------------------------------------------------------------


class TestExchangeRealtimeSdp:
    """exchange_realtime_sdp should return a dict with sdp and call_id."""

    @pytest.mark.asyncio
    async def test_returns_sdp_content(self):
        """The 'sdp' key contains the raw SDP text from the response body."""
        sdp_answer = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
        location = "https://api.openai.com/v1/realtime/calls/call_abc999"
        fake_resp = make_httpx_response(
            text=sdp_answer,
            headers={"location": location},
        )

        with patch_httpx_post(fake_resp):
            result = await exchange_realtime_sdp(b"offer sdp", "Bearer ek_test")

        assert result["sdp"] == sdp_answer

    @pytest.mark.asyncio
    async def test_extracts_call_id_from_location_header(self):
        """call_id is the last path segment of the Location header URL."""
        sdp_answer = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
        location = "https://api.openai.com/v1/realtime/calls/call_abc999"
        fake_resp = make_httpx_response(
            text=sdp_answer,
            headers={"location": location},
        )

        with patch_httpx_post(fake_resp):
            result = await exchange_realtime_sdp(b"offer sdp", "Bearer ek_test")

        assert result["call_id"] == "call_abc999"

    @pytest.mark.asyncio
    async def test_call_id_extracted_correctly_from_various_ids(self):
        """call_id extraction works regardless of the specific call ID value."""
        location = "https://api.openai.com/v1/realtime/calls/call_XYZ_9876"
        fake_resp = make_httpx_response(
            text="v=0\r\n",
            headers={"location": location},
        )

        with patch_httpx_post(fake_resp):
            result = await exchange_realtime_sdp(b"offer", "Bearer ek_test")

        assert result["call_id"] == "call_XYZ_9876"

    @pytest.mark.asyncio
    async def test_return_structure(self):
        """Return dict has exactly the expected top-level keys."""
        location = "https://api.openai.com/v1/realtime/calls/call_test"
        fake_resp = make_httpx_response(
            text="v=0\r\n",
            headers={"location": location},
        )

        with patch_httpx_post(fake_resp):
            result = await exchange_realtime_sdp(b"offer", "Bearer ek_test")

        assert set(result.keys()) == {"sdp", "call_id"}

    @pytest.mark.asyncio
    async def test_accepts_201_status_code(self):
        """SDP exchange accepts 201 status code (OpenAI returns 201, not 200)."""
        location = "https://api.openai.com/v1/realtime/calls/call_test"
        sdp_answer = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"
        fake_resp = make_httpx_response(
            status_code=201,
            text=sdp_answer,
            headers={"location": location},
        )

        with patch_httpx_post(fake_resp):
            result = await exchange_realtime_sdp(b"offer", "Bearer ek_test")

        assert result["sdp"] == sdp_answer
        assert result["call_id"] == "call_test"
