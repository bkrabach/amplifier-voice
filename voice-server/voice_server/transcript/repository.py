"""Simple JSON file-based transcript repository.

Temporary PoC implementation - stores sessions as JSON files.
Can be replaced with SQLite or proper Amplifier integration later.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import TranscriptEntry, VoiceSession

logger = logging.getLogger(__name__)


class TranscriptRepository:
    """
    Simple file-based transcript storage.

    Structure:
        {storage_dir}/
            sessions.json           # Index of all sessions
            {session_id}/
                session.json        # Session metadata
                transcript.jsonl    # Transcript entries (append-only)
    """

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir:
            self._storage_dir = Path(storage_dir)
        else:
            # Default to ~/.amplifier-voice/sessions
            self._storage_dir = Path.home() / ".amplifier-voice" / "sessions"

        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._sessions_index = self._storage_dir / "sessions.json"

        # Initialize sessions index if needed
        if not self._sessions_index.exists():
            self._write_json(self._sessions_index, {"sessions": []})

        logger.info(f"TranscriptRepository initialized at {self._storage_dir}")

    def _write_json(self, path: Path, data: dict) -> None:
        """Write JSON file atomically."""
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w") as f:
            json.dump(data, f, indent=2)
        tmp_path.rename(path)

    def _read_json(self, path: Path) -> dict:
        """Read JSON file."""
        with open(path) as f:
            return json.load(f)

    def _session_dir(self, session_id: str) -> Path:
        """Get directory for a session."""
        return self._storage_dir / session_id

    # --- Session Management ---

    def create_session(self, session_id: Optional[str] = None) -> VoiceSession:
        """Create a new session."""
        session = VoiceSession(id=session_id) if session_id else VoiceSession()

        # Create session directory
        session_dir = self._session_dir(session.id)
        session_dir.mkdir(parents=True, exist_ok=True)

        # Write session metadata
        self._write_json(session_dir / "session.json", session.to_dict())

        # Initialize empty transcript
        (session_dir / "transcript.jsonl").touch()

        # Update sessions index
        index = self._read_json(self._sessions_index)
        index["sessions"].insert(
            0,
            {
                "id": session.id,
                "created_at": session.created_at,
                "title": session.title,
                "status": session.status,
            },
        )
        self._write_json(self._sessions_index, index)

        logger.info(f"Created session: {session.id}")
        return session

    def get_session(self, session_id: str) -> Optional[VoiceSession]:
        """Get session by ID."""
        session_file = self._session_dir(session_id) / "session.json"
        if not session_file.exists():
            return None

        return VoiceSession.from_dict(self._read_json(session_file))

    def update_session(self, session: VoiceSession) -> None:
        """Update session metadata."""
        session.updated_at = datetime.utcnow().isoformat()

        session_dir = self._session_dir(session.id)
        if not session_dir.exists():
            logger.warning(f"Session directory not found: {session.id}")
            return

        self._write_json(session_dir / "session.json", session.to_dict())

        # Update index
        index = self._read_json(self._sessions_index)
        for s in index["sessions"]:
            if s["id"] == session.id:
                s["title"] = session.title
                s["status"] = session.status
                break
        self._write_json(self._sessions_index, index)

    def list_sessions(
        self, status: Optional[str] = None, limit: int = 20
    ) -> list[VoiceSession]:
        """List sessions, most recent first."""
        index = self._read_json(self._sessions_index)
        sessions = []

        for s in index["sessions"][:limit]:
            if status and s.get("status") != status:
                continue

            full_session = self.get_session(s["id"])
            if full_session:
                sessions.append(full_session)

        return sessions

    # --- Transcript Management ---

    def add_entry(self, entry: TranscriptEntry) -> str:
        """Add a transcript entry. Returns entry ID."""
        session_dir = self._session_dir(entry.session_id)

        if not session_dir.exists():
            logger.warning(f"Session not found, creating: {entry.session_id}")
            self.create_session(entry.session_id)

        # Append to transcript file
        transcript_file = session_dir / "transcript.jsonl"
        with open(transcript_file, "a") as f:
            f.write(json.dumps(entry.to_dict()) + "\n")

        # Update session stats
        session = self.get_session(entry.session_id)
        if session:
            session.message_count += 1
            if entry.entry_type == "tool_call":
                session.tool_call_count += 1

            # Track first/last messages for preview
            if entry.entry_type == "user" and entry.text:
                if not session.first_message:
                    session.first_message = entry.text[:100]
                    # Auto-generate title from first message
                    session.title = entry.text[:50] + (
                        "..." if len(entry.text) > 50 else ""
                    )
                session.last_message = entry.text[:100]

            self.update_session(session)

        return entry.id

    def get_transcript(
        self, session_id: str, limit: Optional[int] = None
    ) -> list[TranscriptEntry]:
        """Get transcript entries for a session."""
        transcript_file = self._session_dir(session_id) / "transcript.jsonl"

        if not transcript_file.exists():
            return []

        entries = []
        with open(transcript_file) as f:
            for line in f:
                if line.strip():
                    entries.append(TranscriptEntry.from_dict(json.loads(line)))

        if limit:
            entries = entries[-limit:]

        return entries

    def get_resumption_context(
        self, session_id: str, max_entries: int = 30
    ) -> list[dict]:
        """
        Get conversation context for session resumption.

        Returns list of messages in OpenAI conversation format.
        """
        entries = self.get_transcript(session_id)

        # For long sessions, take last N entries
        if len(entries) > max_entries:
            entries = entries[-max_entries:]

        # Convert to OpenAI conversation format
        context = []
        for entry in entries:
            if entry.entry_type == "user" and entry.text:
                context.append(
                    {
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_text", "text": entry.text}],
                    }
                )
            elif entry.entry_type == "assistant" and entry.text:
                context.append(
                    {
                        "type": "message",
                        "role": "assistant",
                        # GA API requires 'output_text' for assistant content, not 'text'
                        "content": [{"type": "output_text", "text": entry.text}],
                    }
                )
            # Skip tool calls for now - they complicate resumption

        return context
