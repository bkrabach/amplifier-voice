"""
Voice Approval System - Handles tool approval for voice interactions.

In voice mode, we typically auto-approve most tool executions since
the user can't easily review and approve each action. This system
provides configurable approval policies for voice interactions.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class ApprovalPolicy(Enum):
    """Approval policies for voice interactions."""
    AUTO_APPROVE = "auto_approve"  # Automatically approve all tools
    SAFE_ONLY = "safe_only"  # Auto-approve safe tools, deny dangerous
    CONFIRM_DANGEROUS = "confirm_dangerous"  # Ask for dangerous, auto-approve safe
    ALWAYS_ASK = "always_ask"  # Always ask for approval (not recommended for voice)


class ApprovalChoice(Enum):
    """Possible approval choices."""
    ALLOW_ONCE = "allow_once"
    ALLOW_ALWAYS = "allow_always"
    DENY = "deny"


@dataclass
class ApprovalRequest:
    """A request for tool approval."""
    id: str
    tool_name: str
    arguments: Dict[str, Any]
    prompt: str
    is_dangerous: bool = False
    timeout: float = 30.0  # Shorter timeout for voice
    options: List[str] = field(default_factory=lambda: [
        "Allow once",
        "Allow always",
        "Deny"
    ])


@dataclass
class ApprovalResult:
    """Result of an approval request."""
    choice: ApprovalChoice
    tool_name: str
    remember: bool = False


class VoiceApprovalSystem:
    """
    Approval system optimized for voice interactions.

    Features:
    - Configurable auto-approval policies
    - Remembers allowed tools per session
    - Identifies dangerous operations
    - Short timeouts appropriate for voice
    """

    # Tools considered safe for auto-approval
    SAFE_TOOLS: Set[str] = {
        # Read-only operations
        "read_file", "list_directory", "get_file_info",
        "read", "ls", "cat", "head", "tail", "find", "grep",
        "filesystem_read_file", "filesystem_list_directory",

        # Web read operations
        "fetch", "web_fetch", "search", "web_search",

        # Git read operations
        "git_status", "git_log", "git_diff", "git_show",
    }

    # Tools that require extra caution
    DANGEROUS_TOOLS: Set[str] = {
        # Write/modify operations
        "write_file", "delete_file", "move_file", "create_directory",
        "filesystem_write_file", "filesystem_delete",

        # System operations
        "bash", "execute", "run", "shell",
        "tool-bash",

        # Git write operations
        "git_commit", "git_push", "git_reset", "git_checkout",
    }

    def __init__(
        self,
        policy: ApprovalPolicy = ApprovalPolicy.AUTO_APPROVE,
        approval_callback: Optional[Callable] = None
    ):
        """
        Initialize the voice approval system.

        Args:
            policy: Default approval policy
            approval_callback: Called when approval is needed (for voice prompt)
        """
        self.policy = policy
        self._callback = approval_callback
        self._allowed_tools: Set[str] = set()
        self._denied_tools: Set[str] = set()
        self._pending_requests: Dict[str, ApprovalRequest] = {}

    async def request_approval(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        request_id: Optional[str] = None
    ) -> ApprovalResult:
        """
        Request approval for a tool execution.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments
            request_id: Optional ID for tracking

        Returns:
            ApprovalResult with the decision
        """
        request_id = request_id or f"approval_{tool_name}_{id(arguments)}"

        # Check if already allowed/denied
        if tool_name in self._allowed_tools:
            return ApprovalResult(
                choice=ApprovalChoice.ALLOW_ONCE,
                tool_name=tool_name,
                remember=True
            )

        if tool_name in self._denied_tools:
            return ApprovalResult(
                choice=ApprovalChoice.DENY,
                tool_name=tool_name,
                remember=True
            )

        # Apply policy
        is_dangerous = self._is_dangerous(tool_name, arguments)

        if self.policy == ApprovalPolicy.AUTO_APPROVE:
            return ApprovalResult(
                choice=ApprovalChoice.ALLOW_ONCE,
                tool_name=tool_name
            )

        elif self.policy == ApprovalPolicy.SAFE_ONLY:
            if not is_dangerous:
                return ApprovalResult(
                    choice=ApprovalChoice.ALLOW_ONCE,
                    tool_name=tool_name
                )
            else:
                return ApprovalResult(
                    choice=ApprovalChoice.DENY,
                    tool_name=tool_name
                )

        elif self.policy == ApprovalPolicy.CONFIRM_DANGEROUS:
            if not is_dangerous:
                return ApprovalResult(
                    choice=ApprovalChoice.ALLOW_ONCE,
                    tool_name=tool_name
                )
            # Fall through to ask for approval

        # Need to ask for approval
        request = ApprovalRequest(
            id=request_id,
            tool_name=tool_name,
            arguments=arguments,
            prompt=self._generate_prompt(tool_name, arguments, is_dangerous),
            is_dangerous=is_dangerous
        )

        return await self._ask_approval(request)

    def _is_dangerous(self, tool_name: str, arguments: Dict[str, Any]) -> bool:
        """Determine if a tool operation is dangerous."""
        # Check tool name
        tool_lower = tool_name.lower()

        if any(dangerous in tool_lower for dangerous in self.DANGEROUS_TOOLS):
            return True

        # Check if it's a safe read operation
        if any(safe in tool_lower for safe in self.SAFE_TOOLS):
            return False

        # Check arguments for dangerous patterns
        args_str = str(arguments).lower()

        dangerous_patterns = [
            "rm ", "rm -", "delete", "remove",
            "> /", ">/",  # Redirect to root
            "sudo ", "chmod ", "chown ",
            "curl ", "wget ",  # With output
            "| sh", "|sh", "| bash", "|bash",
        ]

        for pattern in dangerous_patterns:
            if pattern in args_str:
                return True

        return False

    def _generate_prompt(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        is_dangerous: bool
    ) -> str:
        """Generate a voice-friendly approval prompt."""
        if is_dangerous:
            prefix = "I need to perform a potentially sensitive action: "
        else:
            prefix = "May I "

        # Generate description based on tool
        if "bash" in tool_name.lower() or "execute" in tool_name.lower():
            cmd = arguments.get("command", "run a command")
            return f"{prefix}run the command: {cmd[:50]}?"

        elif "write" in tool_name.lower():
            path = arguments.get("path", "a file")
            return f"{prefix}write to {path}?"

        elif "delete" in tool_name.lower():
            path = arguments.get("path", "something")
            return f"{prefix}delete {path}?"

        else:
            return f"{prefix}use {tool_name}?"

    async def _ask_approval(self, request: ApprovalRequest) -> ApprovalResult:
        """Ask for approval through the callback."""
        self._pending_requests[request.id] = request

        if self._callback:
            try:
                # Call the approval callback (should trigger voice prompt)
                result = await self._callback(request)

                if isinstance(result, ApprovalResult):
                    return result
                elif isinstance(result, str):
                    choice = self._parse_choice(result)
                    return ApprovalResult(
                        choice=choice,
                        tool_name=request.tool_name,
                        remember=choice == ApprovalChoice.ALLOW_ALWAYS
                    )

            except Exception as e:
                logger.error(f"Approval callback error: {e}")

        # Default to deny if no callback or error
        return ApprovalResult(
            choice=ApprovalChoice.DENY,
            tool_name=request.tool_name
        )

    def _parse_choice(self, choice_str: str) -> ApprovalChoice:
        """Parse a string choice to enum."""
        choice_lower = choice_str.lower()

        if "always" in choice_lower:
            return ApprovalChoice.ALLOW_ALWAYS
        elif "allow" in choice_lower or "yes" in choice_lower or "ok" in choice_lower:
            return ApprovalChoice.ALLOW_ONCE
        else:
            return ApprovalChoice.DENY

    def respond_to_request(self, request_id: str, choice: str) -> Optional[ApprovalResult]:
        """
        Respond to a pending approval request.

        Args:
            request_id: ID of the request
            choice: The choice made

        Returns:
            ApprovalResult if request was found
        """
        request = self._pending_requests.pop(request_id, None)
        if not request:
            return None

        parsed_choice = self._parse_choice(choice)
        result = ApprovalResult(
            choice=parsed_choice,
            tool_name=request.tool_name,
            remember=parsed_choice == ApprovalChoice.ALLOW_ALWAYS
        )

        # Remember the choice if requested
        if result.remember:
            if result.choice == ApprovalChoice.ALLOW_ALWAYS:
                self._allowed_tools.add(request.tool_name)
            elif result.choice == ApprovalChoice.DENY:
                self._denied_tools.add(request.tool_name)

        return result

    def allow_tool(self, tool_name: str) -> None:
        """Permanently allow a tool for this session."""
        self._allowed_tools.add(tool_name)
        self._denied_tools.discard(tool_name)

    def deny_tool(self, tool_name: str) -> None:
        """Permanently deny a tool for this session."""
        self._denied_tools.add(tool_name)
        self._allowed_tools.discard(tool_name)

    def reset_permissions(self) -> None:
        """Reset all remembered permissions."""
        self._allowed_tools.clear()
        self._denied_tools.clear()

    def set_policy(self, policy: ApprovalPolicy) -> None:
        """Change the approval policy."""
        self.policy = policy

    def set_callback(self, callback: Callable) -> None:
        """Set the approval callback."""
        self._callback = callback

    def get_pending_requests(self) -> Dict[str, ApprovalRequest]:
        """Get all pending approval requests."""
        return dict(self._pending_requests)
