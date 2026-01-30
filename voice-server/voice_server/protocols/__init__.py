"""
Voice Protocol Adapters for Amplifier integration.

These adapters handle voice-specific concerns like:
- Streaming events optimized for voice output
- Auto-approval for voice interactions
- Voice-friendly display messages
"""

from .voice_hooks import VoiceEventHook
from .voice_display import VoiceDisplaySystem
from .voice_approval import VoiceApprovalSystem

__all__ = [
    "VoiceEventHook",
    "VoiceDisplaySystem",
    "VoiceApprovalSystem",
]
