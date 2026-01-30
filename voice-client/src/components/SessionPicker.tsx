/**
 * SessionPicker - UI for selecting and resuming previous voice sessions
 */

import { useEffect, useState } from 'react';
import { useTranscriptStore, VoiceSession } from '../stores/transcriptStore';

interface SessionPickerProps {
  onSessionSelect: (sessionId: string, isResume: boolean) => void;
  onNewSession: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionPicker: React.FC<SessionPickerProps> = ({
  onSessionSelect,
  onNewSession,
  isOpen,
  onClose,
}) => {
  const { sessions, loadSessions, isLoading } = useTranscriptStore();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, loadSessions]);

  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSessionClick = (session: VoiceSession) => {
    setSelectedSession(session.id);
  };

  const handleResume = () => {
    if (selectedSession) {
      onSessionSelect(selectedSession, true);
      onClose();
    }
  };

  const handleNewSession = () => {
    onNewSession();
    onClose();
  };

  return (
    <div className="session-picker-overlay" onClick={onClose}>
      <div className="session-picker" onClick={(e) => e.stopPropagation()}>
        <div className="session-picker-header">
          <h2>Voice Sessions</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="session-picker-actions">
          <button className="new-session-btn" onClick={handleNewSession}>
            + New Session
          </button>
        </div>

        <div className="session-list">
          {isLoading ? (
            <div className="loading">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <p>No previous sessions found.</p>
              <p>Start a new session to begin!</p>
            </div>
          ) : (
            sessions.map((session: VoiceSession) => (
              <div
                key={session.id}
                className={`session-item ${selectedSession === session.id ? 'selected' : ''}`}
                onClick={() => handleSessionClick(session)}
              >
                <div className="session-title">
                  {session.title || 'Untitled Session'}
                </div>
                <div className="session-meta">
                  <span className="session-time">{formatDate(session.created_at)}</span>
                  <span className="session-stats">
                    {session.message_count} messages
                    {session.tool_call_count > 0 && ` · ${session.tool_call_count} tools`}
                  </span>
                </div>
                {session.last_message && (
                  <div className="session-preview">
                    {session.last_message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedSession && (
          <div className="session-picker-footer">
            <button className="resume-btn" onClick={handleResume}>
              Resume Session
            </button>
          </div>
        )}
      </div>

      <style>{`
        .session-picker-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .session-picker {
          background: #1a1a2e;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          border: 1px solid #333;
        }

        .session-picker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #333;
        }

        .session-picker-header h2 {
          margin: 0;
          font-size: 18px;
          color: #fff;
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #fff;
        }

        .session-picker-actions {
          padding: 12px 20px;
          border-bottom: 1px solid #333;
        }

        .new-session-btn {
          width: 100%;
          padding: 12px;
          background: #4a9eff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }

        .new-session-btn:hover {
          background: #3a8eef;
        }

        .session-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .loading, .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #888;
        }

        .empty-state p {
          margin: 8px 0;
        }

        .session-item {
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 4px;
          border: 2px solid transparent;
        }

        .session-item:hover {
          background: #252540;
        }

        .session-item.selected {
          background: #252540;
          border-color: #4a9eff;
        }

        .session-title {
          font-weight: 500;
          color: #fff;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-meta {
          font-size: 12px;
          color: #888;
          display: flex;
          gap: 8px;
        }

        .session-preview {
          font-size: 13px;
          color: #666;
          margin-top: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-picker-footer {
          padding: 16px 20px;
          border-top: 1px solid #333;
        }

        .resume-btn {
          width: 100%;
          padding: 12px;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }

        .resume-btn:hover {
          background: #16a34a;
        }
      `}</style>
    </div>
  );
};

export default SessionPicker;
