"""Tests for background job infrastructure: run_agent_job and execution_lock."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from voice_server.sideband import execution_lock, run_agent_job


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_sideband() -> AsyncMock:
    """Factory: returns a mock VoiceSideband with inject_result as AsyncMock."""
    sb = AsyncMock()
    sb.inject_result = AsyncMock()
    return sb


def make_mock_bridge(return_value=None, raises=None) -> AsyncMock:
    """Factory: returns a mock bridge whose execute_tool either returns or raises."""
    bridge = AsyncMock()
    if raises is not None:
        bridge.execute_tool = AsyncMock(side_effect=raises)
    else:
        bridge.execute_tool = AsyncMock(return_value=return_value)
    return bridge


# ---------------------------------------------------------------------------
# Tests: execution_lock
# ---------------------------------------------------------------------------


class TestExecutionLock:
    """execution_lock is a module-level asyncio.Lock."""

    def test_execution_lock_is_asyncio_lock(self):
        assert isinstance(execution_lock, asyncio.Lock)

    @pytest.mark.asyncio
    async def test_execution_lock_serializes_concurrent_access(self):
        """Second call waits until first releases the lock."""
        order: list[str] = []

        async def slow_task(label: str) -> None:
            async with execution_lock:
                order.append(f"{label}_start")
                await asyncio.sleep(0.05)
                order.append(f"{label}_end")

        # Run two tasks truly concurrently
        await asyncio.gather(slow_task("A"), slow_task("B"))

        # The lock must have prevented interleaving: A fully runs before B or vice versa
        assert order in (
            ["A_start", "A_end", "B_start", "B_end"],
            ["B_start", "B_end", "A_start", "A_end"],
        )


# ---------------------------------------------------------------------------
# Tests: run_agent_job — bridge.execute_tool call
# ---------------------------------------------------------------------------


class TestRunAgentJobBridgeCall:
    """run_agent_job calls bridge.execute_tool("delegate", ...) correctly."""

    @pytest.mark.asyncio
    async def test_calls_execute_tool_with_delegate_agent_instruction(self):
        """bridge.execute_tool("delegate", {agent, instruction}) is awaited."""
        mock_result = MagicMock()
        mock_result.to_dict = MagicMock(return_value={"status": "ok"})
        bridge = make_mock_bridge(return_value=mock_result)
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_abc",
            agent="coder",
            instruction="Fix the bug",
            bridge=bridge,
        )

        bridge.execute_tool.assert_awaited_once_with(
            "delegate", {"agent": "coder", "instruction": "Fix the bug"}
        )

    @pytest.mark.asyncio
    async def test_uses_agent_and_instruction_from_arguments(self):
        """Different agent/instruction values are forwarded correctly."""
        mock_result = {"answer": "42"}
        bridge = make_mock_bridge(return_value=mock_result)
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_xyz",
            agent="researcher",
            instruction="Summarize the docs",
            bridge=bridge,
        )

        bridge.execute_tool.assert_awaited_once_with(
            "delegate", {"agent": "researcher", "instruction": "Summarize the docs"}
        )


# ---------------------------------------------------------------------------
# Tests: run_agent_job — result injection on success
# ---------------------------------------------------------------------------


class TestRunAgentJobSuccessInjection:
    """On success, inject_result is called with the correct call_id and output."""

    @pytest.mark.asyncio
    async def test_injects_result_with_correct_call_id(self):
        """inject_result is called with the same call_id passed in."""
        mock_result = MagicMock()
        mock_result.to_dict = MagicMock(return_value={"answer": "yes"})
        bridge = make_mock_bridge(return_value=mock_result)
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_test_99",
            agent="analyst",
            instruction="Analyze data",
            bridge=bridge,
        )

        # inject_result must have been called exactly once
        sb.inject_result.assert_awaited_once()

        # call_id keyword argument must match
        _, kwargs = sb.inject_result.call_args
        assert (
            kwargs.get("call_id") == "call_test_99"
            or sb.inject_result.call_args.args[0] == "call_test_99"
        )

    @pytest.mark.asyncio
    async def test_injects_result_with_to_dict_output(self):
        """Result with to_dict() is JSON-serialised into output."""
        mock_result = MagicMock()
        mock_result.to_dict = MagicMock(return_value={"status": "complete", "files": 3})
        bridge = make_mock_bridge(return_value=mock_result)
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_dict",
            agent="coder",
            instruction="Count files",
            bridge=bridge,
        )

        sb.inject_result.assert_awaited_once()
        args, kwargs = sb.inject_result.call_args
        output = kwargs.get("output") or (args[1] if len(args) > 1 else None)
        assert output is not None
        parsed = json.loads(output)
        assert parsed["status"] == "complete"
        assert parsed["files"] == 3

    @pytest.mark.asyncio
    async def test_injects_result_with_plain_value_output(self):
        """Result without to_dict is JSON-serialised directly."""
        plain_result = {"response": "Done", "count": 7}
        bridge = make_mock_bridge(return_value=plain_result)
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_plain",
            agent="coder",
            instruction="Do stuff",
            bridge=bridge,
        )

        sb.inject_result.assert_awaited_once()
        args, kwargs = sb.inject_result.call_args
        output = kwargs.get("output") or (args[1] if len(args) > 1 else None)
        assert output is not None
        parsed = json.loads(output)
        assert parsed["response"] == "Done"


# ---------------------------------------------------------------------------
# Tests: run_agent_job — graceful error handling
# ---------------------------------------------------------------------------


class TestRunAgentJobErrorHandling:
    """If bridge.execute_tool raises, inject_result is still called with error text."""

    @pytest.mark.asyncio
    async def test_injects_error_message_on_exception(self):
        """Exception from execute_tool → inject_result with 'Background task failed'."""
        bridge = make_mock_bridge(raises=RuntimeError("network timeout"))
        sb = make_mock_sideband()

        # Should NOT raise — must be caught internally
        await run_agent_job(
            sideband=sb,
            call_id="call_err",
            agent="coder",
            instruction="Do risky work",
            bridge=bridge,
        )

        sb.inject_result.assert_awaited_once()
        args, kwargs = sb.inject_result.call_args
        output = kwargs.get("output") or (args[1] if len(args) > 1 else None)
        assert output is not None
        assert "Background task failed" in output
        assert "network timeout" in output

    @pytest.mark.asyncio
    async def test_uses_correct_call_id_on_error(self):
        """call_id is preserved even when an error occurs."""
        bridge = make_mock_bridge(raises=ValueError("bad input"))
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_err_id",
            agent="coder",
            instruction="Bad work",
            bridge=bridge,
        )

        sb.inject_result.assert_awaited_once()
        args, kwargs = sb.inject_result.call_args
        # call_id is either first positional or keyword arg
        call_id_val = kwargs.get("call_id") or (args[0] if args else None)
        assert call_id_val == "call_err_id"

    @pytest.mark.asyncio
    async def test_does_not_reraise_exception(self):
        """Exception is swallowed — run_agent_job completes without raising."""
        bridge = make_mock_bridge(raises=Exception("unexpected crash"))
        sb = make_mock_sideband()

        # This must not raise
        await run_agent_job(
            sideband=sb,
            call_id="call_no_raise",
            agent="coder",
            instruction="Crashy work",
            bridge=bridge,
        )


# ---------------------------------------------------------------------------
# Tests: run_agent_job — execution_lock acquired during bridge call
# ---------------------------------------------------------------------------


class TestRunAgentJobLockUsage:
    """execution_lock is held while bridge.execute_tool runs."""

    @pytest.mark.asyncio
    async def test_lock_is_acquired_during_execute_tool(self):
        """While execute_tool runs, the execution_lock is locked."""
        lock_was_locked_during_call = False

        async def capturing_execute_tool(tool_name, args):
            nonlocal lock_was_locked_during_call
            lock_was_locked_during_call = execution_lock.locked()
            return {"result": "ok"}

        bridge = AsyncMock()
        bridge.execute_tool = capturing_execute_tool
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_lock",
            agent="coder",
            instruction="Check lock",
            bridge=bridge,
        )

        assert lock_was_locked_during_call, (
            "execution_lock was not held during execute_tool"
        )

    @pytest.mark.asyncio
    async def test_lock_is_released_after_completion(self):
        """execution_lock is released after run_agent_job completes."""
        bridge = make_mock_bridge(return_value={"done": True})
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_release",
            agent="coder",
            instruction="Release test",
            bridge=bridge,
        )

        assert not execution_lock.locked(), (
            "execution_lock was not released after completion"
        )

    @pytest.mark.asyncio
    async def test_lock_released_even_on_exception(self):
        """execution_lock is released even when execute_tool raises."""
        bridge = make_mock_bridge(raises=RuntimeError("boom"))
        sb = make_mock_sideband()

        await run_agent_job(
            sideband=sb,
            call_id="call_lock_err",
            agent="coder",
            instruction="Fail work",
            bridge=bridge,
        )

        assert not execution_lock.locked(), (
            "execution_lock was not released after exception"
        )
