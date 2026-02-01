# Monitoring Dashboard Specification: Amplifier Voice

> **Version**: 1.0.0  
> **Date**: 2026-01-31  
> **Status**: Technical Specification  
> **Purpose**: Real-time operational visibility for the voice system

---

## Executive Summary

This specification defines a monitoring dashboard for the Amplifier Voice system, providing real-time visibility into session health, latency performance, tool execution, error rates, audio quality, and Amplifier task status. The dashboard enables operators to detect issues before they impact user experience.

### Dashboard Goals

1. **Operational Awareness**: Real-time view of system health
2. **Performance Tracking**: Latency percentiles and trends
3. **Issue Detection**: Error rates and anomaly alerting
4. **Capacity Planning**: Session counts and resource utilization
5. **Quality Assurance**: Audio quality and task success metrics

---

## 1. Active Sessions Count

### Metrics

| Metric | Description | Data Type | Collection |
|--------|-------------|-----------|------------|
| `sessions.active` | Currently connected voice sessions | Gauge | Real-time |
| `sessions.total_today` | Total sessions created today | Counter | Aggregated |
| `sessions.peak_concurrent` | Max concurrent sessions (24h) | Gauge | Rolling max |
| `sessions.avg_duration_ms` | Average session duration | Histogram | Per-session |

### Data Structure

```python
@dataclass
class SessionMetrics:
    """Active session metrics."""
    
    # Current state
    active_count: int                    # Currently connected
    connecting_count: int                # In connection phase
    
    # Aggregates
    total_today: int                     # Sessions started today
    peak_concurrent_24h: int             # Max concurrent in 24h
    
    # Duration statistics
    avg_duration_ms: float               # Average session length
    median_duration_ms: float            # P50 session duration
    min_duration_ms: float               # Shortest session
    max_duration_ms: float               # Longest session
    
    # Session states breakdown
    by_state: Dict[str, int] = field(default_factory=dict)
    # {"active": 5, "idle": 2, "tool_executing": 1}
    
    # Timestamps
    last_session_started: datetime
    last_session_ended: datetime
```

### Collection Points

```python
# voice_server/service.py - session endpoints
async def create_session(request: Request):
    metrics.sessions_created.inc()
    metrics.active_sessions.inc()
    
async def on_session_end(session_id: str, duration_ms: float):
    metrics.active_sessions.dec()
    metrics.session_duration.observe(duration_ms)
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  ACTIVE SESSIONS                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ██████████████░░░░░░░░░░░░░░░░░  8 / 50           │
│                                                     │
│  Active: 8    Peak (24h): 23    Total Today: 142   │
│                                                     │
│  By State:                                          │
│    ● Active conversation: 5                         │
│    ● Tool executing: 2                              │
│    ● Idle: 1                                        │
│                                                     │
│  Avg Duration: 4m 32s    Last Started: 12s ago     │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| View | Interval | Rationale |
|------|----------|-----------|
| Active count | 1s | Critical real-time metric |
| State breakdown | 5s | Balance detail with overhead |
| Duration stats | 30s | Computed aggregate |
| Daily totals | 60s | Low-frequency counter |

---

## 2. Latency Percentiles (P50, P95, P99)

### Metrics

| Metric | Description | Target | Warning | Critical |
|--------|-------------|--------|---------|----------|
| `latency.ttfa_p50` | Time to First Audio (P50) | <400ms | >600ms | >1000ms |
| `latency.ttfa_p95` | Time to First Audio (P95) | <800ms | >1200ms | >2000ms |
| `latency.ttfa_p99` | Time to First Audio (P99) | <1500ms | >2500ms | >4000ms |
| `latency.turn_p50` | Full turn latency (P50) | <1500ms | >2000ms | >3000ms |
| `latency.turn_p95` | Full turn latency (P95) | <2500ms | >3500ms | >5000ms |
| `latency.turn_p99` | Full turn latency (P99) | <5000ms | >7000ms | >10000ms |

### Component-Level Breakdown

| Component | Metric | Target |
|-----------|--------|--------|
| WebRTC connection | `latency.webrtc_connect_ms` | <500ms |
| OpenAI session creation | `latency.session_create_ms` | <300ms |
| SDP exchange | `latency.sdp_exchange_ms` | <400ms |
| Tool execution | `latency.tool_exec_ms` | <5000ms |
| Amplifier task completion | `latency.amplifier_task_ms` | <30000ms |

### Data Structure

```python
@dataclass
class LatencyMetrics:
    """Latency percentile metrics."""
    
    # Time to First Audio (speech end -> audio playback)
    ttfa: PercentileSet
    
    # Full turn latency (user speech -> complete response)
    turn: PercentileSet
    
    # Component breakdown
    webrtc_connect: PercentileSet
    session_create: PercentileSet
    sdp_exchange: PercentileSet
    tool_execution: PercentileSet
    amplifier_task: PercentileSet
    
    # Trend data (last 1h, 5-minute buckets)
    ttfa_trend: List[PercentileSet]      # 12 data points
    turn_trend: List[PercentileSet]      # 12 data points


@dataclass
class PercentileSet:
    """Percentile distribution for a metric."""
    
    p50: float      # Median
    p75: float      # 75th percentile
    p90: float      # 90th percentile
    p95: float      # 95th percentile
    p99: float      # 99th percentile
    min: float      # Minimum observed
    max: float      # Maximum observed
    count: int      # Sample count
    
    # Window metadata
    window_start: datetime
    window_end: datetime
```

### Collection Points

```python
# Timestamp events for latency calculation
class LatencyTracker:
    """Track latency events per conversation turn."""
    
    def __init__(self, turn_id: str):
        self.turn_id = turn_id
        self.events: Dict[str, float] = {}
    
    def mark(self, event: str):
        """Mark timestamp for event."""
        self.events[event] = time.monotonic()
    
    def calculate_ttfa(self) -> float:
        """Calculate Time to First Audio."""
        return (
            self.events.get("audio_playback_start", 0) - 
            self.events.get("speech_end_detected", 0)
        ) * 1000  # Convert to ms
    
    def calculate_turn_latency(self) -> float:
        """Calculate full turn latency."""
        return (
            self.events.get("response_complete", 0) - 
            self.events.get("speech_end_detected", 0)
        ) * 1000

# Events to track:
# - speech_end_detected: VAD triggers end of user speech
# - transcription_complete: STT finished (OpenAI internal)
# - llm_first_token: LLM starts generating
# - tool_call_started: Tool execution begins
# - tool_call_complete: Tool execution ends
# - tts_first_byte: Audio generation starts
# - audio_playback_start: Client begins playing audio
# - response_complete: Full response delivered
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  LATENCY PERCENTILES                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Time to First Audio (TTFA)                         │
│  ┌────────────────────────────────────────────┐    │
│  │ P50: 320ms ✓  P95: 680ms ✓  P99: 1.2s ✓   │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  Full Turn Latency                                  │
│  ┌────────────────────────────────────────────┐    │
│  │ P50: 1.4s ✓   P95: 2.8s ⚠  P99: 4.5s ✓    │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  Trend (1h)          ▃▅▇█▆▄▃▃▄▅▆▇                  │
│                                                     │
│  Component Breakdown:                               │
│    WebRTC connect:   180ms ███░░░░░░░              │
│    Session create:   120ms ██░░░░░░░░              │
│    Tool execution:  2.1s   █████████░ (when used)  │
│    Amplifier task:  8.4s   ██████████ (when used)  │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| Metric | Interval | Rationale |
|--------|----------|-----------|
| Current percentiles | 5s | Balance accuracy with overhead |
| Trend data | 5m | Bucket aggregation period |
| Component breakdown | 10s | Lower priority, computed |

---

## 3. Tool Call Statistics

### Metrics

| Metric | Description | Data Type |
|--------|-------------|-----------|
| `tools.calls_total` | Total tool calls (all time) | Counter |
| `tools.calls_per_minute` | Current call rate | Gauge |
| `tools.success_rate` | Successful executions % | Gauge |
| `tools.by_name` | Calls per tool name | Counter map |
| `tools.avg_duration_ms` | Average execution time | Histogram |

### Data Structure

```python
@dataclass
class ToolCallMetrics:
    """Tool call statistics."""
    
    # Aggregate counters
    total_calls: int                     # All-time total
    calls_last_hour: int                 # Rolling 1h count
    calls_per_minute: float              # Current rate
    
    # Success/failure
    success_count: int
    failure_count: int
    success_rate: float                  # 0.0 - 1.0
    
    # Per-tool breakdown
    by_tool: Dict[str, ToolStats]
    
    # Timing
    avg_duration_ms: float
    p50_duration_ms: float
    p95_duration_ms: float
    
    # Recent calls (for activity feed)
    recent_calls: List[ToolCallRecord]   # Last 20 calls


@dataclass
class ToolStats:
    """Statistics for a single tool."""
    
    tool_name: str
    call_count: int
    success_count: int
    failure_count: int
    avg_duration_ms: float
    last_called: datetime
    
    # For task tool specifically
    agents_delegated: Optional[Dict[str, int]] = None
    # {"modular-builder": 5, "bug-hunter": 2}


@dataclass
class ToolCallRecord:
    """Individual tool call record."""
    
    call_id: str
    tool_name: str
    session_id: str
    started_at: datetime
    duration_ms: float
    success: bool
    error: Optional[str] = None
    
    # For task tool
    agent_name: Optional[str] = None
    instruction_preview: Optional[str] = None  # First 100 chars
```

### Collection Points

```python
# voice_server/amplifier_bridge.py
async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
    call_id = str(uuid.uuid4())
    start_time = time.monotonic()
    
    metrics.tool_calls_total.labels(tool=tool_name).inc()
    metrics.tool_calls_in_progress.labels(tool=tool_name).inc()
    
    try:
        result = await tool.execute(arguments)
        
        duration_ms = (time.monotonic() - start_time) * 1000
        metrics.tool_call_duration.labels(tool=tool_name).observe(duration_ms)
        metrics.tool_calls_success.labels(tool=tool_name).inc()
        
        # Emit event for real-time dashboard
        await emit_tool_event(ToolCallRecord(
            call_id=call_id,
            tool_name=tool_name,
            duration_ms=duration_ms,
            success=True,
            agent_name=arguments.get("agent") if tool_name == "task" else None
        ))
        
        return ToolResult(success=True, output=result)
        
    except Exception as e:
        metrics.tool_calls_failure.labels(tool=tool_name).inc()
        await emit_tool_event(ToolCallRecord(
            call_id=call_id,
            tool_name=tool_name,
            duration_ms=(time.monotonic() - start_time) * 1000,
            success=False,
            error=str(e)
        ))
        raise
        
    finally:
        metrics.tool_calls_in_progress.labels(tool=tool_name).dec()
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  TOOL CALL STATISTICS                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Rate: 2.4 calls/min    Success: 94.2%             │
│                                                     │
│  By Tool (Last Hour):                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ task         ████████████████░░░░  42 calls  │  │
│  │ read_file    ████░░░░░░░░░░░░░░░░   8 calls  │  │
│  │ bash         ██░░░░░░░░░░░░░░░░░░   4 calls  │  │
│  │ grep         █░░░░░░░░░░░░░░░░░░░   2 calls  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Agents Delegated (task tool):                      │
│    modular-builder: 28  │  bug-hunter: 8           │
│    zen-architect: 4     │  security-guardian: 2    │
│                                                     │
│  Recent Activity:                                   │
│    12:34:21  task → modular-builder  ✓  8.2s       │
│    12:33:45  task → bug-hunter       ✓  12.4s      │
│    12:33:12  task → modular-builder  ✗  Error      │
│    12:32:58  task → modular-builder  ✓  6.8s       │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| Metric | Interval | Rationale |
|--------|----------|-----------|
| Call rate | 5s | Real-time activity |
| Success rate | 10s | Rolling window calculation |
| By-tool breakdown | 15s | Lower frequency aggregate |
| Recent activity | 2s | Live feed updates |

---

## 4. Error Rates by Type

### Error Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `infrastructure` | Connection and transport errors | WebRTC failure, timeout |
| `openai_api` | OpenAI Realtime API errors | Rate limit, auth, model errors |
| `amplifier` | Amplifier bridge errors | Tool not found, execution failure |
| `audio` | Audio processing errors | Codec error, buffer underrun |
| `session` | Session lifecycle errors | Invalid state, cleanup failure |

### Metrics

| Metric | Description | Warning | Critical |
|--------|-------------|---------|----------|
| `errors.rate_total` | Total errors per minute | >5/min | >20/min |
| `errors.rate_by_category` | Errors per category | varies | varies |
| `errors.session_failure_rate` | % sessions with errors | >10% | >25% |

### Data Structure

```python
@dataclass
class ErrorMetrics:
    """Error rate metrics by category."""
    
    # Aggregate rates
    total_errors_per_minute: float
    session_failure_rate: float          # % of sessions with errors
    
    # By category
    by_category: Dict[str, CategoryErrorStats]
    
    # Recent errors (for investigation)
    recent_errors: List[ErrorRecord]     # Last 50 errors
    
    # Trend data
    error_trend: List[ErrorTrendPoint]   # Last 1h, 5-min buckets


@dataclass
class CategoryErrorStats:
    """Error statistics for a category."""
    
    category: str
    count_last_hour: int
    rate_per_minute: float
    
    # Specific error codes within category
    by_code: Dict[str, int]
    # {"rate_limit_exceeded": 5, "timeout": 3}
    
    # Severity
    warning_threshold: float
    critical_threshold: float
    status: str  # "ok" | "warning" | "critical"


@dataclass
class ErrorRecord:
    """Individual error record."""
    
    error_id: str
    timestamp: datetime
    category: str
    code: str
    message: str
    session_id: Optional[str]
    
    # Context
    stack_trace: Optional[str]
    request_context: Optional[Dict[str, Any]]


# Error code definitions
ERROR_CODES = {
    "infrastructure": {
        "webrtc_connect_failed": "WebRTC connection establishment failed",
        "webrtc_ice_timeout": "ICE candidate gathering timeout",
        "websocket_closed": "WebSocket connection closed unexpectedly",
        "network_timeout": "Network request timeout",
    },
    "openai_api": {
        "rate_limit_exceeded": "OpenAI rate limit exceeded",
        "auth_error": "OpenAI authentication failed",
        "model_unavailable": "Realtime model unavailable",
        "session_expired": "Session token expired",
        "invalid_response": "Invalid response from OpenAI",
    },
    "amplifier": {
        "tool_not_found": "Requested tool not available",
        "tool_execution_failed": "Tool execution threw exception",
        "agent_spawn_failed": "Failed to spawn sub-agent",
        "session_not_initialized": "Amplifier session not ready",
        "capability_missing": "Required capability not registered",
    },
    "audio": {
        "codec_error": "Audio codec encoding/decoding error",
        "buffer_underrun": "Audio buffer underrun",
        "invalid_format": "Invalid audio format received",
        "vad_failure": "Voice Activity Detection failure",
    },
    "session": {
        "invalid_state": "Session in invalid state for operation",
        "cleanup_failed": "Session cleanup failed",
        "duplicate_session": "Duplicate session ID detected",
        "session_not_found": "Session ID not found",
    },
}
```

### Collection Points

```python
# Centralized error tracking
class ErrorTracker:
    """Track and categorize errors."""
    
    def __init__(self):
        self.errors: List[ErrorRecord] = []
        self.counters: Dict[str, Counter] = {}
    
    def record_error(
        self,
        category: str,
        code: str,
        message: str,
        session_id: Optional[str] = None,
        exc: Optional[Exception] = None
    ):
        error = ErrorRecord(
            error_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            category=category,
            code=code,
            message=message,
            session_id=session_id,
            stack_trace=traceback.format_exc() if exc else None
        )
        
        self.errors.append(error)
        metrics.errors_total.labels(category=category, code=code).inc()
        
        # Emit for real-time dashboard
        await emit_error_event(error)
        
        # Log with structured data
        logger.error(
            f"[{category}:{code}] {message}",
            extra={
                "error_id": error.error_id,
                "session_id": session_id,
                "category": category,
                "code": code
            }
        )

# Usage throughout codebase:
try:
    result = await openai_client.create_session(...)
except RateLimitError as e:
    error_tracker.record_error(
        category="openai_api",
        code="rate_limit_exceeded",
        message=str(e),
        session_id=session_id,
        exc=e
    )
    raise
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  ERROR RATES BY TYPE                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Total: 3.2/min ✓    Session Failure Rate: 4.8% ✓  │
│                                                     │
│  By Category:                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │ ✓ infrastructure  0.4/min   ░░░░░░░░░░░░░░   │  │
│  │ ⚠ openai_api      1.8/min   ██████░░░░░░░░   │  │
│  │ ✓ amplifier       0.6/min   ██░░░░░░░░░░░░   │  │
│  │ ✓ audio           0.2/min   █░░░░░░░░░░░░░   │  │
│  │ ✓ session         0.2/min   █░░░░░░░░░░░░░   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  OpenAI API Breakdown:                              │
│    rate_limit_exceeded: 12    (67%)                 │
│    session_expired: 4         (22%)                 │
│    model_unavailable: 2       (11%)                 │
│                                                     │
│  Recent Errors:                                     │
│    12:34:21  openai_api:rate_limit_exceeded         │
│    12:33:45  amplifier:tool_execution_failed        │
│    12:33:12  openai_api:rate_limit_exceeded         │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| Metric | Interval | Rationale |
|--------|----------|-----------|
| Total rate | 5s | Real-time awareness |
| By-category rates | 10s | Aggregate calculation |
| Code breakdown | 30s | Detailed analysis |
| Recent errors | 2s | Live feed |

### Alert Thresholds

| Category | Warning | Critical | Action |
|----------|---------|----------|--------|
| infrastructure | >1/min | >5/min | Check network, WebRTC |
| openai_api | >2/min | >10/min | Check rate limits, API status |
| amplifier | >1/min | >5/min | Check bundle, tool health |
| audio | >0.5/min | >2/min | Check codec, audio pipeline |
| session | >0.5/min | >2/min | Check session lifecycle |

---

## 5. Audio Quality Metrics

### Metrics

| Metric | Description | Target | Warning |
|--------|-------------|--------|---------|
| `audio.packet_loss_pct` | WebRTC packet loss | <1% | >3% |
| `audio.jitter_ms` | Audio jitter | <30ms | >50ms |
| `audio.rtt_ms` | Round-trip time | <100ms | >200ms |
| `audio.mos_score` | Mean Opinion Score (estimated) | >4.0 | <3.5 |

### Data Structure

```python
@dataclass
class AudioQualityMetrics:
    """Audio quality metrics from WebRTC stats."""
    
    # Network quality
    packet_loss_pct: float               # 0.0 - 100.0
    jitter_ms: float                     # Audio jitter
    rtt_ms: float                        # Round-trip time
    
    # Codec info
    codec: str                           # "opus"
    bitrate_kbps: float                  # Current bitrate
    sample_rate_hz: int                  # 24000 for Realtime API
    
    # Quality scores
    mos_score: float                     # Estimated MOS (1-5)
    quality_rating: str                  # "excellent" | "good" | "fair" | "poor"
    
    # Voice Activity Detection
    vad_triggered_count: int             # VAD activations
    false_positive_interrupts: int       # Bad VAD triggers
    
    # Audio buffer health
    buffer_underruns: int                # Playback buffer starvation
    buffer_level_ms: float               # Current buffer depth
    
    # Per-session aggregates
    avg_by_session: Dict[str, SessionAudioStats]


@dataclass
class SessionAudioStats:
    """Audio stats for a single session."""
    
    session_id: str
    duration_ms: float
    
    # Averages over session
    avg_packet_loss_pct: float
    avg_jitter_ms: float
    avg_rtt_ms: float
    avg_mos: float
    
    # Issues
    total_underruns: int
    total_dropouts_ms: float             # Total audio dropout time


def estimate_mos_score(packet_loss: float, jitter: float, rtt: float) -> float:
    """
    Estimate Mean Opinion Score from network metrics.
    
    Based on ITU-T G.107 E-model simplified calculation.
    """
    # R-factor calculation (simplified)
    r = 93.2  # Base R-factor
    
    # Degrade for delay
    delay_factor = 0.024 * rtt + 0.11 * (rtt - 177.3) * (rtt > 177.3)
    r -= delay_factor
    
    # Degrade for packet loss
    loss_factor = 7.2 + 0.18 * packet_loss + 0.023 * packet_loss * packet_loss
    r -= loss_factor
    
    # Degrade for jitter
    jitter_factor = 0.1 * jitter
    r -= jitter_factor
    
    # Convert R to MOS
    if r < 0:
        return 1.0
    elif r > 100:
        return 4.5
    else:
        return 1 + 0.035 * r + 7e-6 * r * (r - 60) * (100 - r)
```

### Collection Points

```python
# Client-side WebRTC stats collection (voice-client)
async function collectWebRTCStats(peerConnection: RTCPeerConnection) {
    const stats = await peerConnection.getStats();
    
    let audioStats = {
        packetLoss: 0,
        jitter: 0,
        rtt: 0,
        bytesReceived: 0,
        bytesSent: 0
    };
    
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            audioStats.packetsLost = report.packetsLost;
            audioStats.packetsReceived = report.packetsReceived;
            audioStats.jitter = report.jitter * 1000; // Convert to ms
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            audioStats.rtt = report.currentRoundTripTime * 1000;
        }
    });
    
    // Send to server
    await fetch('/api/metrics/audio', {
        method: 'POST',
        body: JSON.stringify(audioStats)
    });
}

// Run every 5 seconds during active session
setInterval(() => collectWebRTCStats(pc), 5000);
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  AUDIO QUALITY                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MOS Score: 4.2 ✓ (Good)                           │
│  ████████████████░░░░  4.2 / 5.0                   │
│                                                     │
│  Network Metrics:                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Packet Loss:  0.8%  ✓   ██░░░░░░░░░░░░░░░░  │  │
│  │ Jitter:       22ms  ✓   ████░░░░░░░░░░░░░░  │  │
│  │ RTT:          65ms  ✓   ██████░░░░░░░░░░░░  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Audio Pipeline:                                    │
│    Codec: Opus @ 48kbps                            │
│    Buffer: 120ms (healthy)                          │
│    Underruns (1h): 2                                │
│                                                     │
│  VAD Performance:                                   │
│    Activations: 156    False Positives: 3 (1.9%)   │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| Metric | Interval | Rationale |
|--------|----------|-----------|
| Network metrics | 5s | Real-time quality tracking |
| MOS score | 5s | Derived from network |
| Buffer health | 2s | Critical for audio quality |
| VAD stats | 30s | Aggregate counter |

---

## 6. Amplifier Task Status

### Metrics

| Metric | Description | Data Type |
|--------|-------------|-----------|
| `amplifier.task_active` | Currently executing tasks | Gauge |
| `amplifier.task_queue_depth` | Queued tasks waiting | Gauge |
| `amplifier.task_success_rate` | Task completion rate | Gauge |
| `amplifier.task_avg_duration_ms` | Average task duration | Histogram |
| `amplifier.agents_spawned` | Agent spawn count | Counter |

### Data Structure

```python
@dataclass
class AmplifierTaskMetrics:
    """Amplifier task execution metrics."""
    
    # Bridge status
    bridge_initialized: bool
    bridge_tools_count: int
    
    # Active tasks
    active_tasks: List[ActiveTask]
    active_count: int
    queue_depth: int
    
    # Completion stats
    total_completed: int
    total_failed: int
    success_rate: float
    
    # Timing
    avg_duration_ms: float
    p50_duration_ms: float
    p95_duration_ms: float
    
    # Agent delegation breakdown
    by_agent: Dict[str, AgentStats]
    
    # Session health
    session_uptime_seconds: float
    last_health_check: datetime
    health_status: str  # "healthy" | "degraded" | "unhealthy"


@dataclass
class ActiveTask:
    """Currently executing task."""
    
    task_id: str
    session_id: str
    agent_name: str
    instruction_preview: str             # First 100 chars
    started_at: datetime
    elapsed_ms: float
    status: str  # "initializing" | "executing" | "completing"
    
    # Progress indicators (if available)
    progress_pct: Optional[float]
    current_step: Optional[str]


@dataclass
class AgentStats:
    """Statistics for a delegated agent."""
    
    agent_name: str
    spawn_count: int
    success_count: int
    failure_count: int
    avg_duration_ms: float
    
    # Recent activity
    last_spawned: datetime
    last_result: str  # "success" | "failure" | "timeout"


# Task lifecycle events
class TaskLifecycleEvents:
    """Events emitted during task execution."""
    
    TASK_STARTED = "task.started"
    TASK_AGENT_SPAWNED = "task.agent_spawned"
    TASK_PROGRESS = "task.progress"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
```

### Collection Points

```python
# voice_server/amplifier_bridge.py - spawn capability
async def spawn_capability(
    agent_name: str,
    instruction: str,
    parent_session: Any,
    ...
) -> Dict[str, Any]:
    task_id = str(uuid.uuid4())
    
    # Emit start event
    await emit_task_event(TaskLifecycleEvents.TASK_STARTED, {
        "task_id": task_id,
        "agent_name": agent_name,
        "instruction_preview": instruction[:100]
    })
    
    metrics.amplifier_tasks_active.inc()
    metrics.amplifier_agents_spawned.labels(agent=agent_name).inc()
    start_time = time.monotonic()
    
    try:
        result = await self._prepared.spawn(
            child_bundle=child_bundle,
            instruction=instruction,
            ...
        )
        
        duration_ms = (time.monotonic() - start_time) * 1000
        metrics.amplifier_task_duration.labels(agent=agent_name).observe(duration_ms)
        metrics.amplifier_tasks_success.labels(agent=agent_name).inc()
        
        await emit_task_event(TaskLifecycleEvents.TASK_COMPLETED, {
            "task_id": task_id,
            "agent_name": agent_name,
            "duration_ms": duration_ms,
            "success": True
        })
        
        return result
        
    except Exception as e:
        metrics.amplifier_tasks_failure.labels(agent=agent_name).inc()
        await emit_task_event(TaskLifecycleEvents.TASK_FAILED, {
            "task_id": task_id,
            "agent_name": agent_name,
            "error": str(e)
        })
        raise
        
    finally:
        metrics.amplifier_tasks_active.dec()
```

### Display Component

```
┌─────────────────────────────────────────────────────┐
│  AMPLIFIER TASK STATUS                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Bridge: ✓ Healthy    Tools: 13    Uptime: 4h 32m  │
│                                                     │
│  Active Tasks: 2                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ ● modular-builder  "Implement the user..."    │  │
│  │   Running: 8.4s    Status: executing          │  │
│  │                                                │  │
│  │ ● bug-hunter       "Fix the failing test..."  │  │
│  │   Running: 12.1s   Status: executing          │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Completion Stats (1h):                             │
│    Success: 94.2%    Avg Duration: 14.2s           │
│    Completed: 48     Failed: 3                      │
│                                                     │
│  Agent Performance:                                 │
│  ┌──────────────────────────────────────────────┐  │
│  │ modular-builder   28 tasks   ✓ 96%   ~12s    │  │
│  │ bug-hunter         8 tasks   ✓ 88%   ~18s    │  │
│  │ zen-architect      4 tasks   ✓ 100%  ~8s     │  │
│  │ security-guardian  2 tasks   ✓ 100%  ~6s     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Refresh Interval

| Metric | Interval | Rationale |
|--------|----------|-----------|
| Bridge health | 30s | Health check frequency |
| Active tasks | 2s | Real-time task tracking |
| Completion stats | 15s | Aggregate calculation |
| Agent performance | 30s | Lower frequency summary |

---

## 7. Dashboard Layout

### Overall Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AMPLIFIER VOICE MONITORING DASHBOARD                    🔄 Live  │ ⚙️     │
├────────────────────────────────────┬────────────────────────────────────────┤
│                                    │                                        │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │                              │  │  │                                  │  │
│  │     ACTIVE SESSIONS          │  │  │     LATENCY PERCENTILES          │  │
│  │                              │  │  │                                  │  │
│  │     [Section 1 content]      │  │  │     [Section 2 content]          │  │
│  │                              │  │  │                                  │  │
│  └──────────────────────────────┘  │  └──────────────────────────────────┘  │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                        │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │                              │  │  │                                  │  │
│  │     TOOL CALL STATISTICS     │  │  │     ERROR RATES BY TYPE          │  │
│  │                              │  │  │                                  │  │
│  │     [Section 3 content]      │  │  │     [Section 4 content]          │  │
│  │                              │  │  │                                  │  │
│  └──────────────────────────────┘  │  └──────────────────────────────────┘  │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                        │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │                              │  │  │                                  │  │
│  │     AUDIO QUALITY            │  │  │     AMPLIFIER TASK STATUS        │  │
│  │                              │  │  │                                  │  │
│  │     [Section 5 content]      │  │  │     [Section 6 content]          │  │
│  │                              │  │  │                                  │  │
│  └──────────────────────────────┘  │  └──────────────────────────────────┘  │
│                                    │                                        │
└────────────────────────────────────┴────────────────────────────────────────┘
```

### Grid Specification

| Property | Value |
|----------|-------|
| Layout | CSS Grid, 2 columns |
| Column width | 1fr 1fr (equal) |
| Row height | auto (content-based) |
| Gap | 16px |
| Panel min-height | 280px |
| Panel max-height | 400px (with scroll) |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1200px) | 2-column grid |
| Tablet (768-1200px) | 2-column grid, smaller panels |
| Mobile (<768px) | Single column, stacked |

### Color Coding

| Status | Color | Usage |
|--------|-------|-------|
| OK/Healthy | `#10B981` (green) | Metrics within targets |
| Warning | `#F59E0B` (amber) | Approaching thresholds |
| Critical | `#EF4444` (red) | Exceeded thresholds |
| Neutral | `#6B7280` (gray) | Informational |
| Active | `#3B82F6` (blue) | Currently processing |

### Status Indicators

```
✓  - OK/Success (green)
⚠  - Warning (amber)
✗  - Error/Critical (red)
●  - Active/In-progress (blue, pulsing)
○  - Inactive/Idle (gray)
```

---

## 8. Refresh Intervals Summary

### Real-time Updates (1-5s)

| Metric | Interval | Transport |
|--------|----------|-----------|
| Active session count | 1s | SSE |
| Active tasks list | 2s | SSE |
| Recent errors feed | 2s | SSE |
| Recent tool calls feed | 2s | SSE |
| Audio buffer health | 2s | SSE |
| Latency percentiles | 5s | SSE |
| Network metrics | 5s | SSE |

### Periodic Updates (10-60s)

| Metric | Interval | Transport |
|--------|----------|-----------|
| Error rate by category | 10s | Polling |
| Tool call breakdown | 15s | Polling |
| Agent performance | 30s | Polling |
| Bridge health check | 30s | Polling |
| Session duration stats | 30s | Polling |
| Daily totals | 60s | Polling |

### Data Transport

```python
# SSE endpoint for real-time updates
@app.get("/metrics/stream")
async def metrics_stream(request: Request):
    """Server-sent events for real-time metrics."""
    
    async def event_generator():
        while True:
            # Check for client disconnect
            if await request.is_disconnected():
                break
            
            # Collect real-time metrics
            metrics = {
                "sessions": get_session_metrics(),
                "latency": get_latency_metrics(),
                "errors_recent": get_recent_errors(),
                "tools_recent": get_recent_tool_calls(),
                "tasks_active": get_active_tasks(),
                "audio": get_audio_metrics()
            }
            
            yield f"data: {json.dumps(metrics)}\n\n"
            await asyncio.sleep(2)  # Base refresh rate
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


# Polling endpoint for aggregate metrics
@app.get("/metrics/summary")
async def metrics_summary():
    """Periodic polling endpoint for aggregate metrics."""
    
    return {
        "sessions": get_session_summary(),
        "latency": get_latency_summary(),
        "errors": get_error_summary(),
        "tools": get_tool_summary(),
        "amplifier": get_amplifier_summary(),
        "audio": get_audio_summary()
    }
```

---

## 9. Implementation Modules

### Module Structure

```
voice-server/
└── voice_server/
    └── monitoring/
        ├── __init__.py
        ├── metrics.py           # Metric definitions and storage
        ├── collectors.py        # Data collection logic
        ├── aggregators.py       # Percentile and rate calculations
        ├── events.py            # SSE event emitters
        └── endpoints.py         # FastAPI routes for dashboard
```

### Module Contracts

#### `metrics.py`

```python
"""Metric definitions and in-memory storage."""

from dataclasses import dataclass, field
from typing import Dict, List
from collections import deque
import threading

@dataclass
class MetricsStore:
    """Thread-safe metrics storage."""
    
    # Session metrics
    active_sessions: int = 0
    session_durations: deque = field(default_factory=lambda: deque(maxlen=1000))
    
    # Latency metrics (sliding windows)
    ttfa_samples: deque = field(default_factory=lambda: deque(maxlen=1000))
    turn_samples: deque = field(default_factory=lambda: deque(maxlen=1000))
    
    # Error tracking
    errors: deque = field(default_factory=lambda: deque(maxlen=500))
    error_counts: Dict[str, int] = field(default_factory=dict)
    
    # Tool calls
    tool_calls: deque = field(default_factory=lambda: deque(maxlen=500))
    tool_counts: Dict[str, int] = field(default_factory=dict)
    
    # Active tasks
    active_tasks: Dict[str, ActiveTask] = field(default_factory=dict)
    
    # Lock for thread safety
    _lock: threading.Lock = field(default_factory=threading.Lock)

# Global metrics instance
metrics_store = MetricsStore()
```

#### `collectors.py`

```python
"""Data collection functions."""

def record_session_start(session_id: str) -> None:
    """Record session creation."""
    pass

def record_session_end(session_id: str, duration_ms: float) -> None:
    """Record session termination."""
    pass

def record_latency_sample(
    sample_type: str,  # "ttfa" | "turn"
    value_ms: float,
    session_id: str
) -> None:
    """Record latency measurement."""
    pass

def record_error(
    category: str,
    code: str,
    message: str,
    session_id: Optional[str] = None
) -> None:
    """Record error occurrence."""
    pass

def record_tool_call(
    tool_name: str,
    duration_ms: float,
    success: bool,
    session_id: str,
    agent_name: Optional[str] = None
) -> None:
    """Record tool execution."""
    pass

def record_task_start(task: ActiveTask) -> None:
    """Record task execution start."""
    pass

def record_task_end(task_id: str, success: bool, duration_ms: float) -> None:
    """Record task completion."""
    pass

def record_audio_stats(stats: AudioQualityMetrics, session_id: str) -> None:
    """Record audio quality metrics from client."""
    pass
```

#### `aggregators.py`

```python
"""Metric aggregation and calculation."""

def calculate_percentiles(samples: List[float]) -> PercentileSet:
    """Calculate P50, P75, P90, P95, P99 from samples."""
    pass

def calculate_rate(count: int, window_seconds: float) -> float:
    """Calculate rate per minute from count and window."""
    pass

def calculate_success_rate(success: int, total: int) -> float:
    """Calculate success percentage."""
    pass

def aggregate_session_metrics() -> SessionMetrics:
    """Aggregate current session metrics."""
    pass

def aggregate_latency_metrics() -> LatencyMetrics:
    """Aggregate latency percentiles."""
    pass

def aggregate_error_metrics() -> ErrorMetrics:
    """Aggregate error rates by category."""
    pass

def aggregate_tool_metrics() -> ToolCallMetrics:
    """Aggregate tool call statistics."""
    pass

def aggregate_amplifier_metrics() -> AmplifierTaskMetrics:
    """Aggregate Amplifier task metrics."""
    pass

def aggregate_audio_metrics() -> AudioQualityMetrics:
    """Aggregate audio quality metrics."""
    pass
```

#### `endpoints.py`

```python
"""FastAPI routes for monitoring dashboard."""

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/metrics", tags=["monitoring"])

@router.get("/stream")
async def metrics_stream(request: Request):
    """SSE endpoint for real-time metrics."""
    pass

@router.get("/summary")
async def metrics_summary():
    """Polling endpoint for aggregate metrics."""
    pass

@router.get("/sessions")
async def session_metrics():
    """Detailed session metrics."""
    pass

@router.get("/latency")
async def latency_metrics():
    """Detailed latency metrics with trends."""
    pass

@router.get("/errors")
async def error_metrics():
    """Detailed error metrics."""
    pass

@router.get("/tools")
async def tool_metrics():
    """Detailed tool call metrics."""
    pass

@router.get("/amplifier")
async def amplifier_metrics():
    """Detailed Amplifier task metrics."""
    pass

@router.get("/audio")
async def audio_metrics():
    """Detailed audio quality metrics."""
    pass

@router.get("/health")
async def health_check():
    """System health check for alerting."""
    pass
```

---

## 10. Alert Configuration

### Alert Rules

```yaml
alerts:
  # Latency alerts
  - name: high_ttfa_p95
    metric: latency.ttfa_p95
    condition: "> 1200"
    severity: warning
    message: "TTFA P95 exceeds 1.2s"
    
  - name: critical_ttfa_p95
    metric: latency.ttfa_p95
    condition: "> 2000"
    severity: critical
    message: "TTFA P95 exceeds 2s - user experience degraded"

  # Error alerts
  - name: high_error_rate
    metric: errors.rate_total
    condition: "> 5"
    severity: warning
    message: "Error rate exceeds 5/min"
    
  - name: critical_error_rate
    metric: errors.rate_total
    condition: "> 20"
    severity: critical
    message: "Error rate exceeds 20/min - investigate immediately"

  # Session alerts
  - name: high_session_failure
    metric: errors.session_failure_rate
    condition: "> 10"
    severity: warning
    message: "Session failure rate exceeds 10%"

  # Audio quality alerts
  - name: poor_audio_quality
    metric: audio.mos_score
    condition: "< 3.5"
    severity: warning
    message: "Audio quality degraded - MOS below 3.5"
    
  - name: high_packet_loss
    metric: audio.packet_loss_pct
    condition: "> 3"
    severity: warning
    message: "Packet loss exceeds 3%"

  # Amplifier alerts
  - name: amplifier_unhealthy
    metric: amplifier.health_status
    condition: "!= healthy"
    severity: critical
    message: "Amplifier bridge unhealthy"
    
  - name: task_backlog
    metric: amplifier.queue_depth
    condition: "> 10"
    severity: warning
    message: "Amplifier task queue backing up"
```

### Alert Notification Channels

| Severity | Channels | Response Time |
|----------|----------|---------------|
| Critical | Slack, PagerDuty | Immediate |
| Warning | Slack | Within 30 min |
| Info | Dashboard only | Review daily |

---

## 11. Success Criteria

### Dashboard Implementation Checklist

- [ ] All 6 metric sections displaying correctly
- [ ] Real-time updates via SSE working
- [ ] Latency percentile calculations accurate
- [ ] Error categorization complete
- [ ] Audio quality metrics from WebRTC
- [ ] Amplifier task tracking integrated
- [ ] Responsive layout working
- [ ] Alert thresholds configured
- [ ] Health check endpoint functional

### Performance Targets

| Target | Metric |
|--------|--------|
| Dashboard load time | <2s |
| SSE latency | <100ms |
| Memory overhead | <50MB |
| CPU overhead | <5% |

---

*Specification created: 2026-01-31*
*For implementation by: modular-builder agent*
