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
amplifier_cwd = os.environ.get(
    "AMPLIFIER_CWD", os.path.expanduser("~/amplifier-working")
)
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
    voice: str = "marin"

    # System instructions for the voice assistant
    # Note: Voice, turn_detection, and transcription are configured via client-side
    # session.update after WebRTC connection (GA API restriction)
    instructions: str = dedent("""
            You are Amplifier, a powerful voice assistant backed by specialist AI agents.
            Talk quickly and be extremely succinct. Be friendly and conversational.

            YOU ARE AN ORCHESTRATOR. You have ONE tool:
            - task: Delegate ALL work to specialist agents

            DELEGATION IS YOUR ONLY WAY TO DO THINGS:
            When the user asks you to DO something (not just chat), IMMEDIATELY use the
            task tool to delegate. Don't try to do things yourself - delegate!
            
            Available agents include:
            - foundation:explorer - Explore codebases, find files, understand structure
            - foundation:zen-architect - Design systems, review architecture
            - foundation:modular-builder - Write code, implement features
            - foundation:bug-hunter - Debug issues, fix errors
            - foundation:git-ops - Git commits, PRs, branch management
            - foundation:web-research - Search the web, fetch information

            WORKFLOW:
            1. Clarify what the user wants (keep it brief)
            2. Use task to delegate to the right agent - DO THIS IMMEDIATELY
            3. Summarize results conversationally

            VOICE INTERACTION:
            - Keep responses SHORT - you're on a voice call, not writing an essay
            - Summarize agent results, don't read raw output
            - For technical identifiers, spell them out: "j d o e 1 2 3"
            - Confirm important actions before delegating

            You operate in a working directory where agents can create files, run code,
            and build projects. Think of yourself as the friendly voice interface to a
            team of expert AI agents ready to help.
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
