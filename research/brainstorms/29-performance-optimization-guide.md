# Performance Optimization Guide: Voice + Amplifier System

## Overview

This guide documents performance optimizations for the integrated voice assistant system combining OpenAI Realtime API with Amplifier tool execution. The target is **sub-800ms voice-to-voice latency** with responsive tool execution.

### Latency Budget

| Component | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| Connection setup | <200ms | <500ms | >1000ms |
| Audio round-trip | <100ms | <200ms | >300ms |
| Speech detection (VAD) | <50ms | <100ms | >200ms |
| LLM inference (TTFT) | <300ms | <500ms | >800ms |
| Tool execution | <500ms | <2000ms | >5000ms |
| **Total voice-to-voice** | **<800ms** | **<1200ms** | **>2000ms** |

---

## 1. Connection Setup Time

Connection setup is critical for perceived responsiveness. Users expect immediate interaction when starting a voice session.

### 1.1 Pre-Connection Warming

**Problem:** Cold connections add 200-500ms of setup latency.

**Solution:** Establish connections before user interaction begins.

```python
# voice_server/connection_pool.py
import asyncio
from typing import Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class WarmConnection:
    """Pre-established connection ready for immediate use."""
    session_data: dict
    created_at: datetime
    expires_at: datetime
    
    @property
    def is_valid(self) -> bool:
        return datetime.utcnow() < self.expires_at

class ConnectionPool:
    """Pool of pre-warmed OpenAI Realtime sessions."""
    
    def __init__(self, pool_size: int = 3, ttl_seconds: int = 45):
        self._pool: list[WarmConnection] = []
        self._pool_size = pool_size
        self._ttl = timedelta(seconds=ttl_seconds)
        self._lock = asyncio.Lock()
        self._warming_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start background connection warming."""
        self._warming_task = asyncio.create_task(self._warm_connections())
    
    async def stop(self):
        """Stop warming and cleanup."""
        if self._warming_task:
            self._warming_task.cancel()
            try:
                await self._warming_task
            except asyncio.CancelledError:
                pass
    
    async def _warm_connections(self):
        """Background task to maintain warm connection pool."""
        while True:
            try:
                async with self._lock:
                    # Remove expired connections
                    self._pool = [c for c in self._pool if c.is_valid]
                    
                    # Fill pool to target size
                    while len(self._pool) < self._pool_size:
                        conn = await self._create_warm_connection()
                        if conn:
                            self._pool.append(conn)
                
                # Check every 10 seconds
                await asyncio.sleep(10)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Connection warming error: {e}")
                await asyncio.sleep(5)
    
    async def _create_warm_connection(self) -> Optional[WarmConnection]:
        """Create a pre-authenticated session."""
        try:
            # Create session without voice-specific config
            session_data = await create_base_session()
            
            now = datetime.utcnow()
            return WarmConnection(
                session_data=session_data,
                created_at=now,
                expires_at=now + self._ttl
            )
        except Exception as e:
            logger.error(f"Failed to create warm connection: {e}")
            return None
    
    async def get_connection(self) -> Optional[dict]:
        """Get a pre-warmed connection or create new one."""
        async with self._lock:
            # Try to get valid connection from pool
            while self._pool:
                conn = self._pool.pop(0)
                if conn.is_valid:
                    return conn.session_data
            
        # Fallback to creating new connection
        return await create_base_session()
```

### 1.2 HTTP Keep-Alive and Connection Reuse

**Problem:** Each HTTP request incurs TCP + TLS handshake overhead.

**Solution:** Reuse HTTP connections with persistent client.

```python
# voice_server/http_client.py
import httpx
from contextlib import asynccontextmanager

class PersistentHTTPClient:
    """Singleton HTTP client with connection pooling."""
    
    _instance: Optional["PersistentHTTPClient"] = None
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
    
    @classmethod
    def get_instance(cls) -> "PersistentHTTPClient":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                # Connection pooling settings
                limits=httpx.Limits(
                    max_keepalive_connections=20,
                    max_connections=100,
                    keepalive_expiry=30.0,  # 30 second keep-alive
                ),
                # Timeouts optimized for voice
                timeout=httpx.Timeout(
                    connect=5.0,     # Fast connect timeout
                    read=30.0,       # Allow for long responses
                    write=10.0,
                    pool=5.0,        # Don't wait long for pool
                ),
                # HTTP/2 for multiplexing
                http2=True,
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

# Usage in realtime.py
async def create_realtime_session(amplifier: AmplifierBridge, voice: str = "ash"):
    """Create session using persistent HTTP client."""
    client_manager = PersistentHTTPClient.get_instance()
    client = await client_manager.get_client()
    
    headers = {
        "Authorization": f"Bearer {settings.realtime.openai_api_key}",
        "Content-Type": "application/json",
    }
    
    # Reuses existing connection if available
    resp = await client.post(
        CLIENT_SECRETS_ENDPOINT,
        json=session_config,
        headers=headers
    )
    # ...
```

### 1.3 Amplifier Bridge Initialization

**Problem:** Amplifier bridge initialization (bundle loading, module resolution) takes 2-5 seconds.

**Solution:** Eager initialization at service startup, not on first request.

```python
# voice_server/service.py - Current pattern (GOOD)
@asynccontextmanager
async def service_lifespan():
    """Initialize Amplifier at startup, not on first request."""
    global _amplifier_bridge
    
    # Initialize BEFORE accepting requests
    logger.info("Initializing Amplifier bridge...")
    _amplifier_bridge = await get_amplifier_bridge(
        bundle=settings.amplifier.bundle,
        cwd=settings.amplifier.cwd
    )
    logger.info(f"Amplifier ready with {len(_amplifier_bridge.get_tools())} tools")
    
    yield  # Now accept requests
    
    # Cleanup on shutdown
    await cleanup_amplifier_bridge()
```

### 1.4 WebRTC ICE Optimization

**Problem:** ICE candidate gathering adds connection delay.

**Solution:** Optimize ICE settings for faster connection establishment.

```javascript
// voice-client/src/webrtc-config.ts

const OPTIMIZED_RTC_CONFIG: RTCConfiguration = {
  // Use only STUN initially - faster than TURN
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  
  // Aggressive ICE candidate selection
  iceCandidatePoolSize: 2,  // Pre-gather candidates
  
  // Use relay only as fallback
  iceTransportPolicy: 'all',  // 'relay' forces TURN
  
  // Faster connection bundling
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Trickle ICE - don't wait for all candidates
async function setupConnection() {
  const pc = new RTCPeerConnection(OPTIMIZED_RTC_CONFIG);
  
  // Start gathering immediately
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  // Send offer immediately (trickle ICE)
  // Don't wait for ICE gathering complete
  const response = await fetch('/sdp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ephemeralToken}`,
      'Content-Type': 'application/sdp',
    },
    body: pc.localDescription.sdp,
  });
  
  // Set answer while ICE continues gathering
  const answerSdp = await response.text();
  await pc.setRemoteDescription({
    type: 'answer',
    sdp: answerSdp,
  });
}
```

### Connection Setup Checklist

- [ ] Pre-warm connections before user interaction
- [ ] Use persistent HTTP client with keep-alive
- [ ] Initialize Amplifier at service startup
- [ ] Enable HTTP/2 for connection multiplexing
- [ ] Use trickle ICE for faster WebRTC setup
- [ ] Monitor connection setup times (target: <200ms)

---

## 2. Audio Processing Latency

Audio latency directly impacts conversational naturalness. Target: <100ms round-trip audio latency.

### 2.1 VAD (Voice Activity Detection) Tuning

**Problem:** Default VAD settings cause delayed turn detection.

**Solution:** Tune silence duration and threshold for responsiveness.

```python
# voice_server/config.py

class VADSettings:
    """Voice Activity Detection configuration."""
    
    # Silence duration before response triggers
    # Lower = faster response, but may cut off pauses
    SILENCE_DURATION_MS_FAST = 400    # Quick Q&A
    SILENCE_DURATION_MS_NORMAL = 500  # Conversational
    SILENCE_DURATION_MS_SLOW = 800    # Thoughtful dialogue
    
    # Speech detection threshold (0.0-1.0)
    # Higher = requires clearer speech, faster detection
    SPEECH_THRESHOLD_QUIET = 0.3      # Quiet environments
    SPEECH_THRESHOLD_NORMAL = 0.5     # Normal environments
    SPEECH_THRESHOLD_NOISY = 0.7      # Noisy environments
    
    # Minimum speech duration before processing
    MIN_SPEECH_DURATION_MS = 100      # Ignore very short sounds

# Session configuration with optimized VAD
def get_session_config(environment: str = "normal") -> dict:
    """Get VAD-optimized session configuration."""
    
    vad_settings = {
        "quiet": {
            "silence_duration_ms": VADSettings.SILENCE_DURATION_MS_FAST,
            "threshold": VADSettings.SPEECH_THRESHOLD_QUIET,
        },
        "normal": {
            "silence_duration_ms": VADSettings.SILENCE_DURATION_MS_NORMAL,
            "threshold": VADSettings.SPEECH_THRESHOLD_NORMAL,
        },
        "noisy": {
            "silence_duration_ms": VADSettings.SILENCE_DURATION_MS_SLOW,
            "threshold": VADSettings.SPEECH_THRESHOLD_NOISY,
        },
    }
    
    vad = vad_settings.get(environment, vad_settings["normal"])
    
    return {
        "turn_detection": {
            "type": "server_vad",
            "silence_duration_ms": vad["silence_duration_ms"],
            "threshold": vad["threshold"],
            "create_response": True,
        }
    }
```

### 2.2 Audio Buffer Optimization

**Problem:** Large buffers add latency; small buffers cause glitches.

**Solution:** Adaptive buffer sizing based on network conditions.

```javascript
// voice-client/src/audio-buffer.ts

interface BufferConfig {
  minBufferMs: number;
  maxBufferMs: number;
  targetBufferMs: number;
}

const BUFFER_PROFILES: Record<string, BufferConfig> = {
  // Ultra-low latency - good network required
  aggressive: {
    minBufferMs: 40,
    maxBufferMs: 150,
    targetBufferMs: 80,
  },
  // Balanced - good for most connections
  balanced: {
    minBufferMs: 80,
    maxBufferMs: 300,
    targetBufferMs: 150,
  },
  // Conservative - handles poor networks
  conservative: {
    minBufferMs: 150,
    maxBufferMs: 500,
    targetBufferMs: 250,
  },
};

class AdaptiveAudioBuffer {
  private config: BufferConfig;
  private jitterHistory: number[] = [];
  private underrunCount = 0;
  
  constructor(profile: keyof typeof BUFFER_PROFILES = 'balanced') {
    this.config = BUFFER_PROFILES[profile];
  }
  
  /**
   * Update target buffer based on observed jitter.
   */
  updateJitter(measuredJitterMs: number): void {
    this.jitterHistory.push(measuredJitterMs);
    
    // Keep last 50 samples
    if (this.jitterHistory.length > 50) {
      this.jitterHistory.shift();
    }
    
    // Calculate P95 jitter
    const sorted = [...this.jitterHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Jitter = sorted[p95Index] || measuredJitterMs;
    
    // Target = 2x P95 jitter, within bounds
    this.config.targetBufferMs = Math.max(
      this.config.minBufferMs,
      Math.min(this.config.maxBufferMs, p95Jitter * 2)
    );
  }
  
  /**
   * Report buffer underrun - increase buffer size.
   */
  reportUnderrun(): void {
    this.underrunCount++;
    
    // If multiple underruns, increase buffer
    if (this.underrunCount > 2) {
      this.config.targetBufferMs = Math.min(
        this.config.maxBufferMs,
        this.config.targetBufferMs * 1.5
      );
      this.underrunCount = 0;
    }
  }
  
  get targetMs(): number {
    return this.config.targetBufferMs;
  }
}
```

### 2.3 Opus Codec Configuration

**Problem:** Default codec settings may not optimize for voice latency.

**Solution:** Configure Opus for low-latency voice.

```javascript
// voice-client/src/opus-config.ts

const OPUS_VOICE_CONFIG = {
  // Packetization time - tradeoff between latency and overhead
  // 20ms is default, good balance
  // 10ms for ultra-low latency (higher bandwidth)
  ptime: 20,
  
  // Bitrate - voice doesn't need high bitrate
  // 24-32 kbps is excellent for voice
  maxBitrate: 32000,
  
  // Enable forward error correction
  // Helps with packet loss, minimal latency impact
  fec: true,
  
  // Enable discontinuous transmission
  // Saves bandwidth during silence
  dtx: true,
  
  // Mono for voice (stereo unnecessary)
  stereo: false,
  
  // Application mode
  // 'voip' optimized for voice over 'audio'
  application: 'voip',
};

// Apply via SDP munging
function applyOpusConfig(sdp: string): string {
  // Set max playback rate to 24kHz (voice range)
  sdp = sdp.replace(
    /a=fmtp:111 /g,
    'a=fmtp:111 maxplaybackrate=24000;sprop-maxcapturerate=24000;'
  );
  
  // Set ptime
  if (!sdp.includes('a=ptime:')) {
    sdp = sdp.replace(
      /a=rtpmap:111 opus/g,
      `a=rtpmap:111 opus\r\na=ptime:${OPUS_VOICE_CONFIG.ptime}`
    );
  }
  
  return sdp;
}
```

### 2.4 Streaming Audio Playback

**Problem:** Waiting for complete audio before playback adds latency.

**Solution:** Start playback on first audio chunk.

```javascript
// voice-client/src/streaming-playback.ts

class StreamingAudioPlayer {
  private audioContext: AudioContext;
  private scheduledTime = 0;
  private isPlaying = false;
  
  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
  }
  
  /**
   * Process audio chunk immediately - don't wait for complete response.
   */
  async playChunk(audioData: ArrayBuffer): Promise<void> {
    const audioBuffer = await this.audioContext.decodeAudioData(audioData);
    
    // Schedule playback
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    // First chunk - start immediately
    if (!this.isPlaying) {
      this.scheduledTime = this.audioContext.currentTime;
      this.isPlaying = true;
    }
    
    // Schedule this chunk after previous
    source.start(this.scheduledTime);
    this.scheduledTime += audioBuffer.duration;
    
    // Track when playback ends
    source.onended = () => {
      if (this.audioContext.currentTime >= this.scheduledTime) {
        this.isPlaying = false;
      }
    };
  }
  
  /**
   * Stop playback immediately (for interruptions).
   */
  stop(): void {
    // Create new context to immediately stop all audio
    this.audioContext.close();
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.scheduledTime = 0;
    this.isPlaying = false;
  }
}
```

### Audio Latency Checklist

- [ ] Tune VAD silence duration (400-600ms for most cases)
- [ ] Use adaptive audio buffers based on network conditions
- [ ] Configure Opus for voice (20ms ptime, FEC enabled)
- [ ] Start playback on first audio chunk (streaming)
- [ ] Monitor audio buffer underruns and jitter
- [ ] Test across different network conditions

---

## 3. Tool Execution Speed

Tool execution is often the largest latency contributor in agentic voice applications.

### 3.1 Direct Python Calls vs Subprocess

**Problem:** CLI subprocess overhead adds 100-300ms per tool call.

**Solution:** Direct Python integration (current architecture is optimal).

```python
# Current AmplifierBridge pattern - OPTIMAL
# voice_server/amplifier_bridge.py

class AmplifierBridge:
    """Direct Python integration - no subprocess overhead."""
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> ToolResult:
        """Execute tool via direct coordinator call."""
        
        # Direct Python call - no subprocess
        tool = self._tools[tool_name]["tool"]
        result = await tool.execute(arguments)
        
        return ToolResult(success=True, output=result)

# ANTI-PATTERN: Subprocess execution (DO NOT USE)
# async def execute_tool_slow(tool_name: str, args: dict):
#     # 100-300ms overhead per call!
#     proc = await asyncio.create_subprocess_exec(
#         "amplifier", "tool", tool_name, json.dumps(args),
#         stdout=asyncio.subprocess.PIPE
#     )
#     stdout, _ = await proc.communicate()
#     return json.loads(stdout)
```

### 3.2 Tool Result Caching

**Problem:** Repeated identical tool calls waste time.

**Solution:** Cache recent tool results with TTL.

```python
# voice_server/tool_cache.py
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Optional
from dataclasses import dataclass

@dataclass
class CachedResult:
    result: Any
    cached_at: datetime
    ttl: timedelta
    
    @property
    def is_valid(self) -> bool:
        return datetime.utcnow() < self.cached_at + self.ttl

class ToolResultCache:
    """LRU cache for tool execution results."""
    
    # Tools safe to cache (read-only, deterministic)
    CACHEABLE_TOOLS = {
        "read_file": timedelta(seconds=30),
        "glob": timedelta(seconds=30),
        "grep": timedelta(seconds=30),
        "web_fetch": timedelta(minutes=5),
        "LSP": timedelta(seconds=10),
    }
    
    # Tools that should NEVER be cached (side effects)
    NEVER_CACHE = {
        "write_file",
        "edit_file",
        "bash",
        "task",  # Agent delegation
    }
    
    def __init__(self, max_size: int = 100):
        self._cache: dict[str, CachedResult] = {}
        self._max_size = max_size
        self._access_order: list[str] = []
    
    def _make_key(self, tool_name: str, arguments: dict) -> str:
        """Create deterministic cache key."""
        # Sort arguments for consistent hashing
        args_str = json.dumps(arguments, sort_keys=True)
        return hashlib.sha256(f"{tool_name}:{args_str}".encode()).hexdigest()
    
    def get(self, tool_name: str, arguments: dict) -> Optional[Any]:
        """Get cached result if available and valid."""
        if tool_name in self.NEVER_CACHE:
            return None
        
        if tool_name not in self.CACHEABLE_TOOLS:
            return None
        
        key = self._make_key(tool_name, arguments)
        cached = self._cache.get(key)
        
        if cached and cached.is_valid:
            # Update access order (LRU)
            self._access_order.remove(key)
            self._access_order.append(key)
            return cached.result
        
        # Remove expired
        if cached:
            del self._cache[key]
            self._access_order.remove(key)
        
        return None
    
    def set(self, tool_name: str, arguments: dict, result: Any) -> None:
        """Cache tool result."""
        if tool_name in self.NEVER_CACHE:
            return
        
        ttl = self.CACHEABLE_TOOLS.get(tool_name)
        if not ttl:
            return
        
        key = self._make_key(tool_name, arguments)
        
        # Evict LRU if at capacity
        while len(self._cache) >= self._max_size:
            oldest_key = self._access_order.pop(0)
            del self._cache[oldest_key]
        
        self._cache[key] = CachedResult(
            result=result,
            cached_at=datetime.utcnow(),
            ttl=ttl
        )
        self._access_order.append(key)

# Integration with AmplifierBridge
class CachedAmplifierBridge(AmplifierBridge):
    """AmplifierBridge with result caching."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache = ToolResultCache()
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> ToolResult:
        # Check cache first
        cached = self._cache.get(tool_name, arguments)
        if cached is not None:
            logger.debug(f"Cache hit for {tool_name}")
            return ToolResult(success=True, output=cached)
        
        # Execute tool
        result = await super().execute_tool(tool_name, arguments)
        
        # Cache successful results
        if result.success:
            self._cache.set(tool_name, arguments, result.output)
        
        return result
```

### 3.3 Parallel Tool Execution

**Problem:** Sequential tool calls compound latency.

**Solution:** Execute independent tools in parallel.

```python
# voice_server/parallel_tools.py
import asyncio
from typing import List, Dict, Any, Tuple

async def execute_tools_parallel(
    bridge: AmplifierBridge,
    tool_calls: List[Dict[str, Any]]
) -> List[ToolResult]:
    """Execute multiple independent tools in parallel."""
    
    async def execute_one(call: Dict[str, Any]) -> Tuple[str, ToolResult]:
        tool_name = call["name"]
        arguments = call.get("arguments", {})
        result = await bridge.execute_tool(tool_name, arguments)
        return (call.get("call_id", tool_name), result)
    
    # Execute all tools concurrently
    tasks = [execute_one(call) for call in tool_calls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any exceptions
    processed = []
    for result in results:
        if isinstance(result, Exception):
            processed.append(ToolResult(
                success=False,
                output=None,
                error=str(result)
            ))
        else:
            processed.append(result[1])
    
    return processed

# Usage when OpenAI sends multiple tool calls
async def handle_tool_calls(bridge: AmplifierBridge, event: dict):
    """Handle multiple tool calls from OpenAI."""
    tool_calls = event.get("tool_calls", [])
    
    if len(tool_calls) == 1:
        # Single call - execute directly
        call = tool_calls[0]
        return await bridge.execute_tool(
            call["name"],
            call.get("arguments", {})
        )
    
    # Multiple calls - execute in parallel
    return await execute_tools_parallel(bridge, tool_calls)
```

### 3.4 Streaming Tool Results

**Problem:** Long tool outputs delay response start.

**Solution:** Stream results back progressively.

```python
# voice_server/streaming_results.py
from typing import AsyncIterator

async def stream_tool_result(
    bridge: AmplifierBridge,
    tool_name: str,
    arguments: dict
) -> AsyncIterator[str]:
    """Stream tool results for faster perceived response."""
    
    # For file reading - stream chunks
    if tool_name == "read_file":
        file_path = arguments.get("file_path")
        chunk_size = 1000  # lines
        
        offset = 1
        while True:
            result = await bridge.execute_tool("read_file", {
                "file_path": file_path,
                "offset": offset,
                "limit": chunk_size
            })
            
            if not result.success or not result.output:
                break
            
            yield result.output
            
            # Check if more content
            if result.output.get("lines_read", 0) < chunk_size:
                break
            
            offset += chunk_size
    
    # For search results - yield as found
    elif tool_name == "grep":
        result = await bridge.execute_tool(tool_name, arguments)
        if result.success and result.output:
            # Yield matches incrementally
            matches = result.output.get("matches", [])
            for i in range(0, len(matches), 10):
                yield {"matches": matches[i:i+10]}
    
    # Default: single result
    else:
        result = await bridge.execute_tool(tool_name, arguments)
        yield result.output
```

### Tool Execution Checklist

- [ ] Use direct Python integration (no subprocess)
- [ ] Cache read-only tool results with appropriate TTL
- [ ] Execute independent tools in parallel
- [ ] Stream large results progressively
- [ ] Monitor tool execution times per tool type
- [ ] Set timeout limits for long-running tools

---

## 4. Memory Usage

Memory optimization prevents OOM issues and improves performance through better cache utilization.

### 4.1 Conversation Context Management

**Problem:** Unbounded conversation history consumes memory and increases token costs.

**Solution:** Rolling context window with intelligent summarization.

```python
# voice_server/context_manager.py
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class ContextConfig:
    """Configuration for context management."""
    max_turns: int = 20              # Keep last N turns
    max_tokens: int = 8000           # Target token limit
    summarize_after: int = 10        # Summarize after N turns
    keep_tool_results: int = 5       # Keep last N tool results

class ConversationContextManager:
    """Manages conversation context to prevent unbounded growth."""
    
    def __init__(self, config: Optional[ContextConfig] = None):
        self.config = config or ContextConfig()
        self.turns: List[Dict[str, Any]] = []
        self.summary: Optional[str] = None
        self.tool_results: List[Dict[str, Any]] = []
    
    def add_turn(self, role: str, content: str, **metadata) -> None:
        """Add a conversation turn."""
        self.turns.append({
            "role": role,
            "content": content,
            **metadata
        })
        
        # Trigger summarization if needed
        if len(self.turns) > self.config.summarize_after:
            self._summarize_old_turns()
    
    def add_tool_result(self, tool_name: str, result: Any) -> None:
        """Add tool result with size management."""
        # Truncate large results
        result_str = str(result)
        if len(result_str) > 5000:
            result_str = result_str[:5000] + "... [truncated]"
        
        self.tool_results.append({
            "tool": tool_name,
            "result": result_str
        })
        
        # Keep only recent tool results
        if len(self.tool_results) > self.config.keep_tool_results:
            self.tool_results = self.tool_results[-self.config.keep_tool_results:]
    
    def _summarize_old_turns(self) -> None:
        """Summarize older turns to save memory."""
        if len(self.turns) <= self.config.max_turns:
            return
        
        # Keep recent turns, summarize rest
        keep_count = self.config.max_turns // 2
        to_summarize = self.turns[:-keep_count]
        self.turns = self.turns[-keep_count:]
        
        # Create summary (simplified - use LLM in production)
        summary_parts = []
        for turn in to_summarize:
            summary_parts.append(f"- {turn['role']}: {turn['content'][:100]}...")
        
        new_summary = "\n".join(summary_parts)
        
        if self.summary:
            self.summary = f"{self.summary}\n\n{new_summary}"
        else:
            self.summary = new_summary
    
    def get_context(self) -> List[Dict[str, Any]]:
        """Get optimized context for LLM."""
        context = []
        
        # Add summary if exists
        if self.summary:
            context.append({
                "role": "system",
                "content": f"Previous conversation summary:\n{self.summary}"
            })
        
        # Add recent turns
        context.extend(self.turns)
        
        return context
    
    def estimate_tokens(self) -> int:
        """Estimate current token count."""
        # Rough estimate: 4 chars per token
        total_chars = sum(len(str(t.get("content", ""))) for t in self.turns)
        if self.summary:
            total_chars += len(self.summary)
        return total_chars // 4
```

### 4.2 Tool Output Size Limits

**Problem:** Large tool outputs (file contents, search results) consume excessive memory.

**Solution:** Limit and paginate tool outputs.

```python
# voice_server/output_limits.py
from typing import Any, Dict

# Maximum sizes for tool outputs
OUTPUT_LIMITS = {
    "read_file": {
        "max_lines": 500,
        "max_chars_per_line": 1000,
    },
    "grep": {
        "max_matches": 100,
        "max_content_lines": 200,
    },
    "bash": {
        "max_output_bytes": 50_000,  # 50KB
    },
    "web_fetch": {
        "max_bytes": 100_000,  # 100KB
    },
    "default": {
        "max_output_bytes": 100_000,  # 100KB
    }
}

def truncate_tool_output(tool_name: str, output: Any) -> Any:
    """Truncate tool output to prevent memory issues."""
    limits = OUTPUT_LIMITS.get(tool_name, OUTPUT_LIMITS["default"])
    
    if isinstance(output, str):
        max_bytes = limits.get("max_output_bytes", 100_000)
        if len(output) > max_bytes:
            return output[:max_bytes] + f"\n... [truncated, {len(output)} total bytes]"
    
    elif isinstance(output, dict):
        # Handle specific tool output structures
        if "content" in output and isinstance(output["content"], str):
            max_bytes = limits.get("max_output_bytes", 100_000)
            if len(output["content"]) > max_bytes:
                output["content"] = output["content"][:max_bytes] + "... [truncated]"
                output["truncated"] = True
        
        if "matches" in output and isinstance(output["matches"], list):
            max_matches = limits.get("max_matches", 100)
            if len(output["matches"]) > max_matches:
                output["matches"] = output["matches"][:max_matches]
                output["truncated"] = True
                output["total_matches"] = len(output["matches"])
    
    elif isinstance(output, list):
        max_items = limits.get("max_matches", 100)
        if len(output) > max_items:
            return output[:max_items] + [f"... [{len(output) - max_items} more items]"]
    
    return output
```

### 4.3 Connection Resource Cleanup

**Problem:** Leaked connections and unclosed resources accumulate memory.

**Solution:** Proper resource lifecycle management.

```python
# voice_server/resource_manager.py
import asyncio
import weakref
from typing import Set
from contextlib import asynccontextmanager

class ResourceManager:
    """Tracks and cleans up resources."""
    
    def __init__(self):
        self._active_sessions: Set[str] = set()
        self._cleanup_tasks: weakref.WeakSet = weakref.WeakSet()
    
    def register_session(self, session_id: str) -> None:
        """Register active session."""
        self._active_sessions.add(session_id)
    
    def unregister_session(self, session_id: str) -> None:
        """Unregister session on close."""
        self._active_sessions.discard(session_id)
    
    @asynccontextmanager
    async def managed_task(self, coro):
        """Context manager for tracked async tasks."""
        task = asyncio.create_task(coro)
        self._cleanup_tasks.add(task)
        try:
            yield task
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
    
    async def cleanup_all(self) -> None:
        """Clean up all tracked resources."""
        # Cancel all tracked tasks
        for task in list(self._cleanup_tasks):
            if not task.done():
                task.cancel()
        
        # Wait for cancellation
        if self._cleanup_tasks:
            await asyncio.gather(
                *self._cleanup_tasks,
                return_exceptions=True
            )
        
        self._active_sessions.clear()
    
    def get_stats(self) -> Dict[str, int]:
        """Get resource usage statistics."""
        return {
            "active_sessions": len(self._active_sessions),
            "tracked_tasks": len(self._cleanup_tasks),
        }

# Global resource manager
_resource_manager = ResourceManager()

# Usage in session lifecycle
async def handle_session(session_id: str):
    _resource_manager.register_session(session_id)
    try:
        # ... session logic
        pass
    finally:
        _resource_manager.unregister_session(session_id)
```

### Memory Usage Checklist

- [ ] Implement rolling context window (max 20 turns)
- [ ] Summarize old conversation turns
- [ ] Limit tool output sizes
- [ ] Track and cleanup session resources
- [ ] Monitor memory usage per session
- [ ] Set memory limits for long-running processes

---

## 5. CPU Optimization

CPU efficiency affects both latency and system capacity.

### 5.1 Async-First Architecture

**Problem:** Blocking operations consume threads and add latency.

**Solution:** Use async/await throughout the stack.

```python
# voice_server/async_patterns.py
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Callable, Any

# Thread pool for unavoidable blocking operations
_thread_pool = ThreadPoolExecutor(max_workers=4)

async def run_blocking(func: Callable, *args, **kwargs) -> Any:
    """Run blocking function in thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _thread_pool,
        partial(func, *args, **kwargs)
    )

# Example: Blocking JSON serialization
async def serialize_large_result(data: dict) -> str:
    """Serialize large data without blocking event loop."""
    import json
    
    # For small data, serialize directly
    if len(str(data)) < 10000:
        return json.dumps(data)
    
    # For large data, use thread pool
    return await run_blocking(json.dumps, data)

# Example: CPU-intensive processing
async def process_audio_analysis(audio_data: bytes) -> dict:
    """Run CPU-intensive audio analysis in thread pool."""
    
    def _analyze(data: bytes) -> dict:
        # CPU-intensive processing
        import numpy as np
        samples = np.frombuffer(data, dtype=np.int16)
        return {
            "rms": float(np.sqrt(np.mean(samples**2))),
            "peak": float(np.max(np.abs(samples))),
            "duration_ms": len(samples) / 24,  # 24kHz sample rate
        }
    
    return await run_blocking(_analyze, audio_data)
```

### 5.2 Efficient JSON Handling

**Problem:** JSON serialization/deserialization is CPU-intensive.

**Solution:** Use optimized JSON libraries and minimize serialization.

```python
# voice_server/json_optimization.py

# Use orjson for faster serialization (3-10x faster than stdlib json)
try:
    import orjson
    
    def json_dumps(obj: Any) -> str:
        return orjson.dumps(obj).decode('utf-8')
    
    def json_loads(s: str) -> Any:
        return orjson.loads(s)
    
except ImportError:
    import json
    json_dumps = json.dumps
    json_loads = json.loads

# Avoid redundant serialization
class LazyJSONResult:
    """Delay JSON serialization until needed."""
    
    def __init__(self, data: Any):
        self._data = data
        self._json: Optional[str] = None
    
    @property
    def data(self) -> Any:
        return self._data
    
    def to_json(self) -> str:
        if self._json is None:
            self._json = json_dumps(self._data)
        return self._json
    
    def to_dict(self) -> dict:
        """Return dict without serializing."""
        return self._data

# Pre-serialize static tool definitions
class CachedToolDefinitions:
    """Cache serialized tool definitions."""
    
    def __init__(self):
        self._definitions: Optional[List[dict]] = None
        self._json_cache: Optional[str] = None
    
    def set_definitions(self, definitions: List[dict]) -> None:
        self._definitions = definitions
        self._json_cache = json_dumps(definitions)
    
    def get_json(self) -> str:
        """Return pre-serialized JSON."""
        return self._json_cache
    
    def get_definitions(self) -> List[dict]:
        """Return raw definitions."""
        return self._definitions
```

### 5.3 Event Loop Optimization

**Problem:** Slow event loop handlers block all concurrent operations.

**Solution:** Profile and optimize hot paths.

```python
# voice_server/profiling.py
import time
import asyncio
from functools import wraps
from typing import Dict, List
from dataclasses import dataclass, field

@dataclass
class LatencyStats:
    """Track latency statistics for a metric."""
    samples: List[float] = field(default_factory=list)
    max_samples: int = 1000
    
    def record(self, latency_ms: float) -> None:
        self.samples.append(latency_ms)
        if len(self.samples) > self.max_samples:
            self.samples = self.samples[-self.max_samples:]
    
    @property
    def p50(self) -> float:
        if not self.samples:
            return 0
        sorted_samples = sorted(self.samples)
        return sorted_samples[len(sorted_samples) // 2]
    
    @property
    def p99(self) -> float:
        if not self.samples:
            return 0
        sorted_samples = sorted(self.samples)
        idx = int(len(sorted_samples) * 0.99)
        return sorted_samples[min(idx, len(sorted_samples) - 1)]

# Global metrics
_metrics: Dict[str, LatencyStats] = {}

def track_latency(metric_name: str):
    """Decorator to track function latency."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000
                
                if metric_name not in _metrics:
                    _metrics[metric_name] = LatencyStats()
                _metrics[metric_name].record(elapsed_ms)
                
                # Warn on slow operations
                if elapsed_ms > 100:
                    logger.warning(
                        f"Slow operation: {metric_name} took {elapsed_ms:.1f}ms"
                    )
        return wrapper
    return decorator

# Usage
@track_latency("tool_execution")
async def execute_tool(name: str, args: dict):
    # ... implementation
    pass

@track_latency("session_creation")
async def create_session():
    # ... implementation
    pass

# Expose metrics endpoint
async def get_latency_metrics() -> Dict[str, Dict[str, float]]:
    return {
        name: {"p50": stats.p50, "p99": stats.p99}
        for name, stats in _metrics.items()
    }
```

### CPU Optimization Checklist

- [ ] Use async/await throughout (no blocking in event loop)
- [ ] Run CPU-intensive work in thread pool
- [ ] Use orjson for faster JSON handling
- [ ] Cache serialized static data
- [ ] Profile hot paths and optimize
- [ ] Monitor event loop latency

---

## 6. Network Efficiency

Network optimization reduces latency and improves reliability.

### 6.1 Request/Response Compression

**Problem:** Large payloads increase network latency.

**Solution:** Enable compression for API responses.

```python
# voice_server/compression.py
from fastapi import FastAPI
from starlette.middleware.gzip import GZipMiddleware

def setup_compression(app: FastAPI):
    """Enable response compression."""
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000,  # Only compress responses > 1KB
        compresslevel=6,    # Balance speed vs compression ratio
    )

# For WebSocket messages - compress large payloads
import zlib

def compress_ws_message(data: bytes, threshold: int = 1000) -> tuple[bytes, bool]:
    """Compress WebSocket message if large enough."""
    if len(data) < threshold:
        return data, False
    
    compressed = zlib.compress(data, level=6)
    
    # Only use compression if it actually helps
    if len(compressed) < len(data) * 0.9:
        return compressed, True
    
    return data, False

def decompress_ws_message(data: bytes, is_compressed: bool) -> bytes:
    """Decompress WebSocket message if needed."""
    if is_compressed:
        return zlib.decompress(data)
    return data
```

### 6.2 Batching and Debouncing

**Problem:** Many small requests create overhead.

**Solution:** Batch related requests together.

```python
# voice_server/batching.py
import asyncio
from typing import Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass

@dataclass
class BatchedRequest:
    """A request waiting to be batched."""
    key: str
    data: Any
    future: asyncio.Future

class RequestBatcher:
    """Batch multiple requests into single operation."""
    
    def __init__(
        self,
        batch_handler: Callable[[List[Any]], Awaitable[Dict[str, Any]]],
        max_batch_size: int = 10,
        max_wait_ms: float = 50,
    ):
        self._handler = batch_handler
        self._max_batch_size = max_batch_size
        self._max_wait = max_wait_ms / 1000
        self._pending: List[BatchedRequest] = []
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None
    
    async def submit(self, key: str, data: Any) -> Any:
        """Submit request to batch."""
        future = asyncio.get_event_loop().create_future()
        request = BatchedRequest(key=key, data=data, future=future)
        
        async with self._lock:
            self._pending.append(request)
            
            # Start flush timer if this is first request
            if len(self._pending) == 1:
                self._flush_task = asyncio.create_task(
                    self._delayed_flush()
                )
            
            # Flush immediately if batch is full
            if len(self._pending) >= self._max_batch_size:
                if self._flush_task:
                    self._flush_task.cancel()
                await self._flush()
        
        return await future
    
    async def _delayed_flush(self):
        """Flush after max wait time."""
        await asyncio.sleep(self._max_wait)
        async with self._lock:
            await self._flush()
    
    async def _flush(self):
        """Process all pending requests."""
        if not self._pending:
            return
        
        requests = self._pending
        self._pending = []
        
        try:
            # Execute batch handler
            results = await self._handler([r.data for r in requests])
            
            # Resolve futures
            for request in requests:
                if request.key in results:
                    request.future.set_result(results[request.key])
                else:
                    request.future.set_exception(
                        KeyError(f"No result for key: {request.key}")
                    )
        except Exception as e:
            # Propagate exception to all futures
            for request in requests:
                request.future.set_exception(e)

# Example: Batch transcript sync
transcript_batcher = RequestBatcher(
    batch_handler=sync_transcripts_batch,
    max_batch_size=20,
    max_wait_ms=100,
)

async def sync_transcript_entry(session_id: str, entry: dict):
    """Sync single entry - gets batched automatically."""
    return await transcript_batcher.submit(
        key=entry["id"],
        data={"session_id": session_id, "entry": entry}
    )
```

### 6.3 Connection Health Monitoring

**Problem:** Degraded connections cause poor user experience.

**Solution:** Monitor connection health and adapt.

```javascript
// voice-client/src/connection-monitor.ts

interface ConnectionStats {
  latencyMs: number;
  packetLoss: number;
  jitter: number;
}

class ConnectionMonitor {
  private statsHistory: ConnectionStats[] = [];
  private degradedThreshold = {
    latencyMs: 200,
    packetLoss: 0.05,
    jitter: 50,
  };
  
  /**
   * Update stats from WebRTC.
   */
  async updateStats(pc: RTCPeerConnection): Promise<ConnectionStats> {
    const stats = await pc.getStats();
    
    let latencyMs = 0;
    let packetLoss = 0;
    let jitter = 0;
    
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        latencyMs = report.currentRoundTripTime * 1000;
      }
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        packetLoss = report.packetsLost / (report.packetsReceived + report.packetsLost);
        jitter = report.jitter * 1000;
      }
    });
    
    const currentStats = { latencyMs, packetLoss, jitter };
    this.statsHistory.push(currentStats);
    
    // Keep last 30 samples
    if (this.statsHistory.length > 30) {
      this.statsHistory.shift();
    }
    
    return currentStats;
  }
  
  /**
   * Check if connection is degraded.
   */
  isDegraded(): boolean {
    if (this.statsHistory.length < 5) {
      return false;
    }
    
    const recent = this.statsHistory.slice(-5);
    const avgLatency = recent.reduce((s, r) => s + r.latencyMs, 0) / recent.length;
    const avgLoss = recent.reduce((s, r) => s + r.packetLoss, 0) / recent.length;
    const avgJitter = recent.reduce((s, r) => s + r.jitter, 0) / recent.length;
    
    return (
      avgLatency > this.degradedThreshold.latencyMs ||
      avgLoss > this.degradedThreshold.packetLoss ||
      avgJitter > this.degradedThreshold.jitter
    );
  }
  
  /**
   * Get recommended quality settings.
   */
  getQualityRecommendation(): 'high' | 'medium' | 'low' {
    if (!this.isDegraded()) {
      return 'high';
    }
    
    const recent = this.statsHistory.slice(-5);
    const avgLatency = recent.reduce((s, r) => s + r.latencyMs, 0) / recent.length;
    
    if (avgLatency > 500) {
      return 'low';
    }
    
    return 'medium';
  }
}
```

### 6.4 Prompt Caching for Cost & Latency

**Problem:** Repeated prompt processing wastes resources.

**Solution:** Leverage OpenAI's automatic prompt caching.

```python
# voice_server/prompt_optimization.py

class OptimizedPromptBuilder:
    """Build prompts optimized for caching."""
    
    # Static content goes FIRST (cached)
    STATIC_PREFIX = """You are a helpful voice assistant integrated with Amplifier tools.

## Core Capabilities
- Execute code and file operations via Amplifier
- Search and analyze codebases
- Run shell commands and manage projects

## Response Guidelines
- Keep responses concise for voice (1-3 sentences typically)
- Confirm actions before executing destructive operations
- Summarize long outputs verbally

## Tool Usage
When using tools:
1. Explain what you're about to do
2. Execute the tool
3. Summarize the results conversationally
"""
    
    def __init__(self):
        # Pre-compute static prefix token count (~400 tokens)
        self._static_tokens = len(self.STATIC_PREFIX) // 4
    
    def build_prompt(
        self,
        context: List[dict],
        tools: List[dict],
    ) -> dict:
        """Build prompt with static content first for caching."""
        
        # Structure for optimal caching:
        # [STATIC] System prompt + Tool definitions
        # [DYNAMIC] Conversation context
        
        messages = [
            {"role": "system", "content": self.STATIC_PREFIX},
        ]
        
        # Add conversation context (dynamic, at end)
        messages.extend(context)
        
        return {
            "messages": messages,
            "tools": tools,  # Tool definitions are also cached
        }
    
    def estimate_cached_tokens(self, prompt: dict) -> int:
        """Estimate how many tokens will be cached."""
        # Static prefix + tool definitions are typically cached
        tool_tokens = sum(len(str(t)) // 4 for t in prompt.get("tools", []))
        return self._static_tokens + tool_tokens
```

### Network Efficiency Checklist

- [ ] Enable gzip compression for responses >1KB
- [ ] Batch related requests together
- [ ] Monitor connection health (latency, packet loss, jitter)
- [ ] Adapt quality based on network conditions
- [ ] Structure prompts for caching (static first)
- [ ] Use HTTP/2 for connection multiplexing
- [ ] Implement request debouncing where appropriate

---

## Performance Monitoring

### Key Metrics to Track

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Connection setup time | <200ms | >500ms | >1000ms |
| Voice-to-voice latency | <800ms | >1200ms | >2000ms |
| Tool execution P50 | <500ms | >1000ms | >2000ms |
| Tool execution P99 | <2000ms | >5000ms | >10000ms |
| Memory per session | <50MB | >100MB | >200MB |
| Event loop latency | <10ms | >50ms | >100ms |
| Packet loss | <1% | >3% | >5% |
| Cache hit rate | >50% | <30% | <10% |

### Monitoring Implementation

```python
# voice_server/metrics.py
from prometheus_client import Histogram, Gauge, Counter

# Latency histograms
connection_setup_time = Histogram(
    'voice_connection_setup_seconds',
    'Time to establish voice connection',
    buckets=[0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
)

voice_to_voice_latency = Histogram(
    'voice_to_voice_latency_seconds',
    'End-to-end voice response latency',
    buckets=[0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0]
)

tool_execution_time = Histogram(
    'tool_execution_seconds',
    'Tool execution time',
    ['tool_name'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

# Resource gauges
active_sessions = Gauge(
    'voice_active_sessions',
    'Number of active voice sessions'
)

memory_per_session = Gauge(
    'voice_memory_bytes',
    'Memory usage per session',
    ['session_id']
)

# Counters
cache_hits = Counter(
    'tool_cache_hits_total',
    'Tool result cache hits',
    ['tool_name']
)

cache_misses = Counter(
    'tool_cache_misses_total',
    'Tool result cache misses',
    ['tool_name']
)
```

---

## Quick Wins Summary

### Immediate (< 1 day effort)

1. **Tune VAD settings** - Reduce silence_duration_ms to 400-500ms
2. **Enable HTTP keep-alive** - Reuse connections
3. **Add tool result caching** - Cache read-only operations
4. **Enable response compression** - GZip for large payloads

### Short-term (1-3 days effort)

1. **Implement connection pooling** - Pre-warm connections
2. **Add latency monitoring** - Track P50/P99 metrics
3. **Optimize JSON handling** - Use orjson
4. **Implement context rolling** - Limit conversation history

### Medium-term (1-2 weeks effort)

1. **Parallel tool execution** - Run independent tools concurrently
2. **Adaptive audio buffers** - Adjust based on network conditions
3. **Connection health monitoring** - Adapt quality dynamically
4. **Full metrics dashboard** - Prometheus + Grafana

---

## References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [WebRTC Performance Best Practices](https://webrtc.org/getting-started/media-devices)
- [Opus Codec Recommendations](https://opus-codec.org/docs/)
- Research findings: `research/findings/47-latency-deep-dive.md`
- Research findings: `research/findings/06-latency-optimization.md`
- Research findings: `research/findings/27-streaming-patterns.md`

---

*Guide created: January 2026*
