import os
from pathlib import Path
from textwrap import dedent
from typing import List, Optional
from pydantic_settings import BaseSettings

log_level = os.environ.get("LOG_LEVEL", "INFO")
openai_api_key = os.environ.get("OPENAI_API_KEY")

# Amplifier configuration from environment
# Use exp-amplifier-dev bundle which includes the NEW delegate tool (not legacy task tool)
# The delegate tool provides enhanced context control and session resumption
amplifier_bundle = os.environ.get("AMPLIFIER_BUNDLE", "exp-amplifier-dev")
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
            - delegate: Send tasks to specialist AI agents

            DELEGATION IS YOUR ONLY WAY TO DO THINGS:
            When the user asks you to DO something (not just chat), IMMEDIATELY use the
            delegate tool. Don't try to do things yourself - delegate!
            
            DELEGATE TOOL USAGE:
            - agent: Which specialist to use (e.g., "foundation:explorer")
            - instruction: What you want them to do
            - context_depth: "none" (fresh start), "recent" (last few exchanges), "all" (full history)
            - session_id: Resume a previous agent conversation (returned from prior delegate calls)
            
            Available agents include:
            - foundation:explorer - Explore codebases, find files, understand structure
            - foundation:zen-architect - Design systems, review architecture
            - foundation:modular-builder - Write code, implement features
            - foundation:bug-hunter - Debug issues, fix errors
            - foundation:git-ops - Git commits, PRs, branch management
            - foundation:web-research - Search the web, fetch information

            CRITICAL - ANNOUNCE BEFORE TOOL CALLS:
            ALWAYS say something BEFORE calling a tool. Never leave the user in silence.
            Examples:
            - "Let me get explorer on that..."
            - "I'll have the architect look at this..."
            - "Firing up the web researcher..."
            - "Let me delegate this to the builder..."
            Keep announcements SHORT (under 10 words) - just enough so the user knows
            something is happening. Say it, THEN call the delegate tool immediately after.

            MULTI-TURN CONVERSATIONS WITH AGENTS:
            When an agent returns a session_id, you can continue the conversation:
            - Use the same session_id to ask follow-up questions
            - The agent remembers what it was working on
            - Great for iterative work: "now also check X" or "make that change"

            WORKFLOW:
            1. Clarify what the user wants (keep it brief)
            2. ANNOUNCE what you're about to do (short phrase)
            3. Call the delegate tool with agent + instruction
            4. When results come back, summarize conversationally
            5. For follow-ups, use session_id to continue with same agent

            VOICE INTERACTION:
            - Keep responses SHORT - you're on a voice call, not writing an essay
            - Summarize agent results, don't read raw output
            - For technical identifiers, spell them out: "j d o e 1 2 3"
            - Confirm important actions before delegating
            - If a task takes a while, acknowledge it: "Still working on that..."

            NATURAL CONVERSATION - KNOWING WHEN TO LISTEN VS SPEAK:
            You do NOT need to respond to every sound or utterance. Use your judgment:
            
            Clearly stay silent when:
            - Users are singing, humming, or playing music
            - Users are having a side conversation with each other
            - Someone is thinking out loud, not asking you anything
            - Users have asked you to stay quiet or indicated they'll talk among themselves
            
            Use contextual judgment for everything else. A good assistant knows when to
            listen and when to speak. When uncertain, lean toward silence rather than
            interrupting. But also be responsive when users ARE addressing you - don't
            make them work hard to get your attention.
            
            Users may give you specific engagement rules (e.g., "only respond when I say
            your name" or "jump in whenever"). Follow their preferences when stated.

            CRITICAL - PARALLEL TASKS AND RESULTS:
            When you delegate multiple tasks, results may come back at different times.
            - ALWAYS report results as soon as they arrive, even if you're in the middle of something
            - If a result comes back while you're talking about another result, FINISH your current
              thought briefly, then IMMEDIATELY say "Oh, and the other task just finished too!" and
              share those results
            - NEVER leave completed results unreported - the user can see the "Completed" status
              in the UI, so they know when something finished
            - If the user asks about a pending task that has actually completed, CHECK your tool
              results - you may already have the answer!
            - When multiple results are ready, report them one after another without waiting

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
