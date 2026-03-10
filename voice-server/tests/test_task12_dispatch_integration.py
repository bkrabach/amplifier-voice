"""Tests for Task 12 — two-tool system prompt update and dispatch in tool list."""

from voice_server.config import RealtimeSettings
from voice_server.amplifier_bridge import AmplifierBridge


class TestTwoToolSystemPrompt:
    """Verify the system prompt describes TWO tools (delegate + dispatch)."""

    def setup_method(self):
        self.instructions = RealtimeSettings().get_instructions()

    def test_prompt_mentions_two_tools(self):
        """Orchestrator header should say TWO tools, not ONE tool."""
        inst_lower = self.instructions.lower()
        assert "two tools" in inst_lower, (
            "Expected 'TWO tools' / 'two tools' in instructions, "
            f"but got: {self.instructions[:500]}"
        )

    def test_one_tool_language_removed(self):
        """The old 'ONE tool' wording must be gone."""
        assert "ONE tool" not in self.instructions

    def test_dispatch_mentioned_alongside_delegate(self):
        """Both delegate and dispatch must appear in the orchestrator header section."""
        inst_lower = self.instructions.lower()
        assert "dispatch" in inst_lower, "Expected 'dispatch' to appear in instructions"
        assert "delegate" in inst_lower, "Expected 'delegate' to still appear"

    def test_delegate_usage_guidance_present(self):
        """delegate guidance should explain it suits quick/short tasks."""
        inst_lower = self.instructions.lower()
        # "few seconds" or "quick" or "lookups" — any of these confirm quick-task framing
        has_quick_framing = (
            "few seconds" in inst_lower
            or "quick" in inst_lower
            or "lookups" in inst_lower
        )
        assert has_quick_framing, (
            "Expected delegate quick-task framing (few seconds / quick / lookups) "
            "in instructions"
        )

    def test_dispatch_usage_guidance_present(self):
        """dispatch guidance must have a DISPATCH TOOL USAGE section or equivalent."""
        assert "DISPATCH TOOL USAGE" in self.instructions, (
            "Expected a 'DISPATCH TOOL USAGE' section in instructions"
        )

    def test_dispatch_returns_immediately_guidance(self):
        """The prompt should tell the model dispatch returns immediately."""
        inst_lower = self.instructions.lower()
        assert "returns immediately" in inst_lower or "immediately" in inst_lower, (
            "Expected 'returns immediately' guidance for dispatch in instructions"
        )

    def test_dispatch_tell_user_kicked_off(self):
        """The prompt should instruct the model to tell the user it's been kicked off."""
        inst_lower = self.instructions.lower()
        assert "kicked it off" in inst_lower or "kicked off" in inst_lower, (
            "Expected 'kicked it off' / 'kicked off' guidance for dispatch"
        )


class TestGetToolsForOpenAI:
    """Verify AmplifierBridge.get_tools_for_openai returns dispatch but not voice controls."""

    def _make_bridge_with_tools(self, tool_names):
        """Create a bridge with mock tools pre-loaded (no real Amplifier needed)."""
        bridge = AmplifierBridge.__new__(AmplifierBridge)
        bridge._tools = {}
        for name in tool_names:
            bridge._tools[name] = {
                "name": name,
                "description": f"Mock tool: {name}",
                "parameters": {"type": "object", "properties": {}, "required": []},
                "tool": None,
            }
        bridge._active_child_sessions = {}
        return bridge

    def test_dispatch_tool_in_list(self):
        """get_tools_for_openai must include the dispatch tool definition."""
        bridge = self._make_bridge_with_tools(["delegate"])
        tools = bridge.get_tools_for_openai()
        names = [t["name"] for t in tools]
        assert "dispatch" in names, f"Expected 'dispatch' in tool list, got: {names}"

    def test_pause_replies_not_in_list(self):
        """pause_replies (client-side voice control) must NOT be in the tool list."""
        bridge = self._make_bridge_with_tools(["delegate"])
        tools = bridge.get_tools_for_openai()
        names = [t["name"] for t in tools]
        assert "pause_replies" not in names, (
            f"'pause_replies' should have been removed from tool list, got: {names}"
        )

    def test_resume_replies_not_in_list(self):
        """resume_replies (client-side voice control) must NOT be in the tool list."""
        bridge = self._make_bridge_with_tools(["delegate"])
        tools = bridge.get_tools_for_openai()
        names = [t["name"] for t in tools]
        assert "resume_replies" not in names, (
            f"'resume_replies' should have been removed from tool list, got: {names}"
        )

    def test_cancel_tool_still_present(self):
        """cancel_current_task must still be in the tool list."""
        bridge = self._make_bridge_with_tools(["delegate"])
        tools = bridge.get_tools_for_openai()
        names = [t["name"] for t in tools]
        assert "cancel_current_task" in names, (
            f"'cancel_current_task' must still be present, got: {names}"
        )

    def test_dispatch_tool_has_correct_structure(self):
        """The dispatch entry returned must have the correct type/name/parameters."""
        bridge = self._make_bridge_with_tools(["delegate"])
        tools = bridge.get_tools_for_openai()
        dispatch = next((t for t in tools if t["name"] == "dispatch"), None)
        assert dispatch is not None
        assert dispatch["type"] == "function"
        assert "parameters" in dispatch
        assert "agent" in dispatch["parameters"]["properties"]
        assert "instruction" in dispatch["parameters"]["properties"]


class TestVoiceControlToolsClassRemoved:
    """VOICE_CONTROL_TOOLS class attribute must no longer exist on AmplifierBridge."""

    def test_voice_control_tools_attribute_removed(self):
        """AmplifierBridge should not have a VOICE_CONTROL_TOOLS class attribute."""
        assert not hasattr(AmplifierBridge, "VOICE_CONTROL_TOOLS"), (
            "VOICE_CONTROL_TOOLS class attribute should have been removed from AmplifierBridge"
        )
