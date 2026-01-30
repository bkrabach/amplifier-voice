import os
from pathlib import Path
from textwrap import dedent
from typing import List, Optional
from pydantic_settings import BaseSettings

log_level = os.environ.get("LOG_LEVEL", "INFO")
openai_api_key = os.environ.get("OPENAI_API_KEY")

# Amplifier configuration from environment
# Use amplifier-dev bundle which includes all standard tools
amplifier_bundle = os.environ.get("AMPLIFIER_BUNDLE", "amplifier-dev")
amplifier_cwd = os.environ.get("AMPLIFIER_CWD", os.getcwd())
amplifier_auto_approve = (
    os.environ.get("AMPLIFIER_AUTO_APPROVE", "true").lower() == "true"
)


class ServiceSettings(BaseSettings):
    title: str = "Amplifier Voice Assistant"
    version: str = "0.2.0"
    host: str = "0.0.0.0"
    port: int = 8080
    allowed_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ]


class RealtimeSettings(BaseSettings):
    """OpenAI Realtime API configuration using GA model."""

    openai_api_key: str = openai_api_key or ""

    # Use GA model with prompt caching (90% cost savings on system/tools)
    # Options: "gpt-realtime" (latest) or "gpt-realtime-2025-08-28" (pinned)
    model: str = "gpt-realtime"

    # Available voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
    # New GA voices: cedar, marin (exclusive to Realtime API)
    voice: str = "verse"

    # System instructions for the voice assistant
    # Note: Voice, turn_detection, and transcription are configured via client-side
    # session.update after WebRTC connection (GA API restriction)
    instructions: str = dedent("""
            You are Amplifier, a helpful voice assistant. Talk quickly and be extremely succinct.
            Act friendly and conversational. Avoid lists, bullets, and other formatting.

            You have access to powerful tools through Amplifier. When appropriate, use the
            provided tools to help users with file operations, web searches, and system tasks.

            Tool usage guidelines:
            - Speak naturally and confirm when you've completed actions
            - Summarize tool results conversationally, don't read raw output
            - For errors, explain what went wrong in simple terms

            When you encounter usernames or technical identifiers:
            - Spell them out letter by letter (e.g., 'jdoe123' becomes 'j d o e 1 2 3')
            - Before making tool calls with user-provided values, confirm by spelling back

            Keep responses brief and natural, as if talking on the phone.
        """).strip()


class AmplifierSettings(BaseSettings):
    """Configuration for Microsoft Amplifier integration."""

    # Bundle to use (can be "foundation", a git URL, or local path)
    bundle: str = amplifier_bundle

    # Working directory for tool execution
    cwd: str = amplifier_cwd

    # Auto-approve tool executions (recommended for voice)
    auto_approve: bool = amplifier_auto_approve

    # Tool execution timeout in seconds
    tool_timeout: float = 60.0

    # Tools to enable (if using foundation bundle)
    tools: List[str] = [
        "tool-filesystem",
        "tool-bash",
        "tool-web",
    ]

    # Path to custom bundle configuration
    custom_bundle_path: Optional[str] = str(
        Path(__file__).parent / "bundles" / "voice.yaml"
    )

    # Approval policy: auto_approve, safe_only, confirm_dangerous, always_ask
    approval_policy: str = "auto_approve"


class LoggingSettings(BaseSettings):
    config: dict = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "()": "uvicorn.logging.DefaultFormatter",
                "fmt": "%(levelprefix)s %(message)s",
                "use_colors": True,
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stdout",
            }
        },
        "loggers": {"": {"handlers": ["console"], "level": log_level}},
    }


class Settings(BaseSettings):
    amplifier: AmplifierSettings = AmplifierSettings()
    logging: LoggingSettings = LoggingSettings()
    realtime: RealtimeSettings = RealtimeSettings()
    service: ServiceSettings = ServiceSettings()
