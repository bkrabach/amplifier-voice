# Advanced Amplifier Integration Patterns

> **Date**: 2026-01-31
> **Status**: Advanced Architecture Design
> **Purpose**: Deep integration patterns for Voice + Amplifier agent orchestration, focusing on intelligent routing, parallel execution, and cost optimization

---

## Table of Contents

1. [Agent Specialization](#1-agent-specialization)
2. [Parallel Execution](#2-parallel-execution)
3. [Bidirectional Communication](#3-bidirectional-communication)
4. [Shared Context & Memory Sync](#4-shared-context--memory-sync)
5. [Quality-Based Routing](#5-quality-based-routing)
6. [Cost Optimization](#6-cost-optimization)
7. [Integration Matrix](#7-integration-matrix)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Agent Specialization

### Overview

Route different voice intents to specialized Amplifier agents based on the nature of the request. Each agent has deep expertise in its domain, leading to better results than a generalist approach.

### 1.1 Agent Registry Architecture

```python
@dataclass
class AgentProfile:
    """Profile defining an agent's specialization."""
    name: str
    description: str
    capabilities: List[str]
    intent_patterns: List[str]  # Regex patterns for intent matching
    confidence_threshold: float  # Minimum confidence to route
    priority: int  # Higher = preferred when multiple match
    model_tier: str  # "fast", "standard", "powerful"
    avg_latency_ms: int
    cost_per_1k_tokens: float

AGENT_REGISTRY: Dict[str, AgentProfile] = {
    "zen-architect": AgentProfile(
        name="zen-architect",
        description="System design, architecture planning, code review",
        capabilities=["design", "review", "refactor", "plan"],
        intent_patterns=[
            r"design.*system",
            r"architect.*",
            r"review.*code",
            r"how should (I|we) structure",
            r"what's the best way to organize",
        ],
        confidence_threshold=0.7,
        priority=10,
        model_tier="powerful",
        avg_latency_ms=5000,
        cost_per_1k_tokens=0.03
    ),
    
    "modular-builder": AgentProfile(
        name="modular-builder",
        description="Implementation, coding, file modifications",
        capabilities=["implement", "write", "modify", "create"],
        intent_patterns=[
            r"(write|create|implement|build|add).*",
            r"make.*change",
            r"fix.*bug",
            r"update.*file",
        ],
        confidence_threshold=0.6,
        priority=8,
        model_tier="standard",
        avg_latency_ms=3000,
        cost_per_1k_tokens=0.01
    ),
    
    "bug-hunter": AgentProfile(
        name="bug-hunter",
        description="Debugging, error analysis, test failures",
        capabilities=["debug", "analyze", "diagnose", "test"],
        intent_patterns=[
            r"(why|what).*error",
            r"debug.*",
            r"fix.*crash",
            r"test.*fail",
            r"not working",
        ],
        confidence_threshold=0.65,
        priority=9,
        model_tier="standard",
        avg_latency_ms=4000,
        cost_per_1k_tokens=0.01
    ),
    
    "quick-answerer": AgentProfile(
        name="quick-answerer",
        description="Simple questions, file lookups, quick info",
        capabilities=["explain", "find", "show", "list"],
        intent_patterns=[
            r"(what|where) is.*",
            r"show me.*",
            r"find.*file",
            r"list.*",
            r"how many.*",
        ],
        confidence_threshold=0.5,
        priority=5,
        model_tier="fast",
        avg_latency_ms=500,
        cost_per_1k_tokens=0.0005
    ),
    
    "security-guardian": AgentProfile(
        name="security-guardian",
        description="Security review, vulnerability analysis",
        capabilities=["security", "audit", "vulnerability", "auth"],
        intent_patterns=[
            r"security.*",
            r"vulnerab.*",
            r"(is|are).*safe",
            r"audit.*",
            r"auth.*issue",
        ],
        confidence_threshold=0.75,
        priority=10,
        model_tier="powerful",
        avg_latency_ms=6000,
        cost_per_1k_tokens=0.03
    ),
}
```

### 1.2 Intent Classification Engine

```python
class IntentClassifier:
    """Classify voice intents and route to appropriate agents."""
    
    def __init__(self, registry: Dict[str, AgentProfile]):
        self.registry = registry
        self.intent_history: List[IntentMatch] = []
        
    async def classify_intent(
        self, 
        transcript: str,
        conversation_context: Optional[str] = None
    ) -> List[AgentMatch]:
        """
        Classify user intent and return ranked agent matches.
        
        Returns:
            List of (agent_name, confidence, reasoning) tuples
        """
        matches: List[AgentMatch] = []
        
        # Phase 1: Pattern matching (fast)
        for agent_name, profile in self.registry.items():
            pattern_score = self._pattern_match(transcript, profile.intent_patterns)
            if pattern_score > 0:
                matches.append(AgentMatch(
                    agent=agent_name,
                    confidence=pattern_score * 0.6,  # Pattern is 60% weight
                    source="pattern"
                ))
        
        # Phase 2: Semantic matching (if patterns inconclusive)
        if not matches or max(m.confidence for m in matches) < 0.7:
            semantic_matches = await self._semantic_classify(
                transcript, 
                conversation_context
            )
            
            # Merge with pattern matches
            for sm in semantic_matches:
                existing = next((m for m in matches if m.agent == sm.agent), None)
                if existing:
                    existing.confidence = (existing.confidence + sm.confidence * 0.4)
                else:
                    sm.confidence *= 0.4
                    matches.append(sm)
        
        # Phase 3: Context boosting
        if conversation_context:
            self._apply_context_boost(matches, conversation_context)
        
        # Sort by confidence and priority
        matches.sort(
            key=lambda m: (
                m.confidence, 
                self.registry[m.agent].priority
            ), 
            reverse=True
        )
        
        return matches
    
    def _pattern_match(self, text: str, patterns: List[str]) -> float:
        """Fast regex-based pattern matching."""
        text_lower = text.lower()
        match_count = 0
        for pattern in patterns:
            if re.search(pattern, text_lower):
                match_count += 1
        return min(match_count / len(patterns) * 2, 1.0) if patterns else 0
    
    async def _semantic_classify(
        self, 
        transcript: str,
        context: Optional[str]
    ) -> List[AgentMatch]:
        """Use LLM for semantic intent classification."""
        
        # Build agent descriptions for classification
        agent_descriptions = "\n".join([
            f"- {name}: {profile.description}"
            for name, profile in self.registry.items()
        ])
        
        prompt = f"""Classify the user's intent and match to the best agent.

User said: "{transcript}"
{f"Context: {context}" if context else ""}

Available agents:
{agent_descriptions}

Return JSON: {{"matches": [{{"agent": "name", "confidence": 0.0-1.0, "reasoning": "why"}}]}}
"""
        
        # Use fast model for classification
        result = await self.fast_llm.classify(prompt)
        return [
            AgentMatch(
                agent=m["agent"],
                confidence=m["confidence"],
                source="semantic",
                reasoning=m.get("reasoning")
            )
            for m in result.get("matches", [])
        ]
    
    def _apply_context_boost(
        self, 
        matches: List[AgentMatch], 
        context: str
    ) -> None:
        """Boost confidence for agents matching conversation context."""
        # If recently discussed code, boost builder
        if "file" in context.lower() or "code" in context.lower():
            for m in matches:
                if m.agent == "modular-builder":
                    m.confidence *= 1.2
        
        # If error/debug in context, boost bug-hunter
        if "error" in context.lower() or "bug" in context.lower():
            for m in matches:
                if m.agent == "bug-hunter":
                    m.confidence *= 1.2


@dataclass
class AgentMatch:
    agent: str
    confidence: float
    source: str  # "pattern" | "semantic" | "context"
    reasoning: Optional[str] = None
```

### 1.3 Voice-to-Agent Router

```python
class VoiceAgentRouter:
    """Route voice requests to specialized agents."""
    
    def __init__(
        self,
        classifier: IntentClassifier,
        agent_pool: AgentPool,
        fallback_agent: str = "modular-builder"
    ):
        self.classifier = classifier
        self.agent_pool = agent_pool
        self.fallback_agent = fallback_agent
        
    async def route_request(
        self,
        transcript: str,
        session_context: SessionContext
    ) -> AgentResponse:
        """
        Route a voice transcript to the appropriate agent.
        
        Flow:
        1. Classify intent
        2. Select best agent
        3. Prepare context injection
        4. Execute agent task
        5. Return response
        """
        # Classify intent
        matches = await self.classifier.classify_intent(
            transcript,
            session_context.conversation_summary
        )
        
        # Select agent (with fallback)
        selected = self._select_agent(matches, session_context)
        
        # Prepare agent-specific context
        agent_context = self._prepare_context(
            selected,
            transcript,
            session_context
        )
        
        # Log routing decision for learning
        await self._log_routing_decision(
            transcript=transcript,
            matches=matches,
            selected=selected,
            context=session_context
        )
        
        # Execute via selected agent
        try:
            result = await self.agent_pool.execute(
                agent=selected.agent,
                instruction=transcript,
                context=agent_context
            )
            
            return AgentResponse(
                success=True,
                agent=selected.agent,
                result=result,
                confidence=selected.confidence
            )
            
        except AgentError as e:
            # Fallback to general agent
            return await self._fallback_execution(
                transcript,
                session_context,
                original_error=e
            )
    
    def _select_agent(
        self,
        matches: List[AgentMatch],
        context: SessionContext
    ) -> AgentMatch:
        """Select best agent from matches."""
        if not matches:
            return AgentMatch(
                agent=self.fallback_agent,
                confidence=0.5,
                source="fallback"
            )
        
        # Get top match
        top = matches[0]
        profile = self.classifier.registry[top.agent]
        
        # Check if confidence meets threshold
        if top.confidence < profile.confidence_threshold:
            # Use fallback if confidence too low
            return AgentMatch(
                agent=self.fallback_agent,
                confidence=0.5,
                source="fallback_low_confidence"
            )
        
        return top
    
    def _prepare_context(
        self,
        selected: AgentMatch,
        transcript: str,
        session: SessionContext
    ) -> str:
        """Prepare agent-specific context injection."""
        profile = self.classifier.registry[selected.agent]
        
        context_parts = [
            f"Voice request from user: {transcript}",
            f"Working directory: {session.cwd}",
        ]
        
        # Add active files if relevant
        if session.active_files and selected.agent in ["modular-builder", "bug-hunter"]:
            context_parts.append(f"Recently discussed files: {', '.join(session.active_files[:5])}")
        
        # Add conversation summary for context
        if session.conversation_summary:
            context_parts.append(f"Conversation context: {session.conversation_summary}")
        
        # Agent-specific instructions
        if selected.agent == "quick-answerer":
            context_parts.append("Keep response brief and voice-friendly (under 100 words)")
        elif selected.agent == "zen-architect":
            context_parts.append("Provide architectural guidance suitable for voice explanation")
        
        return "\n\n".join(context_parts)
```

### 1.4 Dynamic Agent Discovery

```python
class DynamicAgentDiscovery:
    """
    Dynamically discover available agents from Amplifier.
    Supports hot-loading new agents without restart.
    """
    
    def __init__(self, amplifier_bridge: AmplifierBridge):
        self.bridge = amplifier_bridge
        self.cached_agents: Dict[str, AgentProfile] = {}
        self.last_refresh: float = 0
        self.refresh_interval: float = 300  # 5 minutes
        
    async def discover_agents(self, force: bool = False) -> Dict[str, AgentProfile]:
        """Discover available agents from Amplifier."""
        now = time.time()
        
        if not force and (now - self.last_refresh) < self.refresh_interval:
            return self.cached_agents
        
        # Query Amplifier for available agents
        agent_list = await self.bridge.list_agents()
        
        new_agents = {}
        for agent_info in agent_list:
            profile = self._build_profile(agent_info)
            new_agents[profile.name] = profile
        
        self.cached_agents = new_agents
        self.last_refresh = now
        
        return self.cached_agents
    
    def _build_profile(self, agent_info: dict) -> AgentProfile:
        """Build agent profile from Amplifier agent info."""
        return AgentProfile(
            name=agent_info["name"],
            description=agent_info.get("description", ""),
            capabilities=agent_info.get("capabilities", []),
            intent_patterns=self._generate_patterns(agent_info),
            confidence_threshold=agent_info.get("confidence_threshold", 0.6),
            priority=agent_info.get("priority", 5),
            model_tier=agent_info.get("model_tier", "standard"),
            avg_latency_ms=agent_info.get("avg_latency_ms", 3000),
            cost_per_1k_tokens=agent_info.get("cost_per_1k_tokens", 0.01)
        )
    
    def _generate_patterns(self, agent_info: dict) -> List[str]:
        """Generate intent patterns from agent capabilities."""
        patterns = []
        for capability in agent_info.get("capabilities", []):
            # Convert capability to regex pattern
            patterns.append(rf"\b{capability}\b")
        return patterns
```

---

## 2. Parallel Execution

### Overview

Voice triggers multiple agent tasks simultaneously, combining results for comprehensive responses. Reduces latency for complex requests that naturally decompose into independent subtasks.

### 2.1 Parallel Task Orchestrator

```python
class ParallelTaskOrchestrator:
    """Orchestrate parallel execution of multiple agents."""
    
    def __init__(
        self,
        agent_pool: AgentPool,
        max_parallel: int = 5,
        timeout: float = 30.0
    ):
        self.agent_pool = agent_pool
        self.max_parallel = max_parallel
        self.timeout = timeout
        self.semaphore = asyncio.Semaphore(max_parallel)
        
    async def execute_parallel(
        self,
        tasks: List[ParallelTask],
        strategy: str = "all"  # "all", "first", "majority"
    ) -> ParallelResult:
        """
        Execute multiple tasks in parallel.
        
        Strategies:
        - "all": Wait for all tasks, combine results
        - "first": Return first successful result
        - "majority": Wait for majority, combine agreeing results
        """
        # Create task coroutines with timeout
        task_coros = [
            self._execute_with_timeout(task)
            for task in tasks
        ]
        
        if strategy == "first":
            return await self._first_success(task_coros)
        elif strategy == "majority":
            return await self._majority_consensus(task_coros)
        else:  # "all"
            return await self._all_results(task_coros)
    
    async def _execute_with_timeout(
        self, 
        task: ParallelTask
    ) -> TaskResult:
        """Execute single task with semaphore and timeout."""
        async with self.semaphore:
            try:
                result = await asyncio.wait_for(
                    self.agent_pool.execute(
                        agent=task.agent,
                        instruction=task.instruction,
                        context=task.context
                    ),
                    timeout=self.timeout
                )
                return TaskResult(
                    task_id=task.id,
                    agent=task.agent,
                    success=True,
                    result=result,
                    duration=time.time() - task.started_at
                )
            except asyncio.TimeoutError:
                return TaskResult(
                    task_id=task.id,
                    agent=task.agent,
                    success=False,
                    error="Timeout",
                    duration=self.timeout
                )
            except Exception as e:
                return TaskResult(
                    task_id=task.id,
                    agent=task.agent,
                    success=False,
                    error=str(e),
                    duration=time.time() - task.started_at
                )
    
    async def _all_results(
        self, 
        coros: List[Coroutine]
    ) -> ParallelResult:
        """Wait for all tasks, combine results."""
        results = await asyncio.gather(*coros, return_exceptions=True)
        
        successful = [r for r in results if isinstance(r, TaskResult) and r.success]
        failed = [r for r in results if isinstance(r, TaskResult) and not r.success]
        
        return ParallelResult(
            strategy="all",
            total_tasks=len(coros),
            successful=successful,
            failed=failed,
            combined_result=self._combine_results(successful)
        )
    
    async def _first_success(
        self, 
        coros: List[Coroutine]
    ) -> ParallelResult:
        """Return first successful result, cancel others."""
        pending = set()
        
        for coro in coros:
            pending.add(asyncio.create_task(coro))
        
        first_result = None
        while pending and not first_result:
            done, pending = await asyncio.wait(
                pending,
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in done:
                result = task.result()
                if isinstance(result, TaskResult) and result.success:
                    first_result = result
                    break
        
        # Cancel remaining tasks
        for task in pending:
            task.cancel()
        
        return ParallelResult(
            strategy="first",
            total_tasks=len(coros),
            successful=[first_result] if first_result else [],
            failed=[],
            combined_result=first_result.result if first_result else None
        )
    
    def _combine_results(self, results: List[TaskResult]) -> str:
        """Combine multiple task results into unified response."""
        if not results:
            return "No results available."
        
        if len(results) == 1:
            return results[0].result
        
        # Multi-result combination
        combined = ["Here's what I found from multiple analyses:\n"]
        for r in results:
            combined.append(f"**{r.agent}**: {r.result[:500]}...")
        
        return "\n\n".join(combined)


@dataclass
class ParallelTask:
    id: str
    agent: str
    instruction: str
    context: Optional[str] = None
    started_at: float = field(default_factory=time.time)

@dataclass
class TaskResult:
    task_id: str
    agent: str
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None
    duration: float = 0.0

@dataclass
class ParallelResult:
    strategy: str
    total_tasks: int
    successful: List[TaskResult]
    failed: List[TaskResult]
    combined_result: Optional[str]
```

### 2.2 Task Decomposition Engine

```python
class TaskDecomposer:
    """Decompose complex requests into parallel subtasks."""
    
    # Patterns that suggest parallelizable requests
    PARALLEL_PATTERNS = {
        "multi_file": r"(files|all|each|every)\s+\w+",
        "comparison": r"(compare|difference|vs|versus)",
        "multi_action": r"(and|also|plus|as well as)",
        "comprehensive": r"(full|complete|entire|whole|comprehensive)",
    }
    
    async def decompose(
        self,
        transcript: str,
        context: SessionContext
    ) -> List[ParallelTask]:
        """
        Decompose a voice request into parallel tasks.
        
        Examples:
        - "Analyze auth.py and review database.py" → 2 parallel review tasks
        - "Run tests and check lint" → 2 parallel tool tasks
        - "What's in src/ and tests/?" → 2 parallel read tasks
        """
        # Check if parallelizable
        if not self._is_parallelizable(transcript):
            return []  # Single task, no decomposition
        
        # Detect decomposition type
        decomposition_type = self._detect_type(transcript)
        
        if decomposition_type == "multi_file":
            return await self._decompose_multi_file(transcript, context)
        elif decomposition_type == "multi_action":
            return await self._decompose_multi_action(transcript, context)
        elif decomposition_type == "comparison":
            return await self._decompose_comparison(transcript, context)
        elif decomposition_type == "comprehensive":
            return await self._decompose_comprehensive(transcript, context)
        
        return []
    
    def _is_parallelizable(self, transcript: str) -> bool:
        """Check if request can be parallelized."""
        for pattern in self.PARALLEL_PATTERNS.values():
            if re.search(pattern, transcript.lower()):
                return True
        return False
    
    def _detect_type(self, transcript: str) -> str:
        """Detect the type of parallelization needed."""
        scores = {}
        for ptype, pattern in self.PARALLEL_PATTERNS.items():
            if re.search(pattern, transcript.lower()):
                scores[ptype] = scores.get(ptype, 0) + 1
        
        return max(scores.keys(), key=lambda k: scores[k]) if scores else "unknown"
    
    async def _decompose_multi_file(
        self,
        transcript: str,
        context: SessionContext
    ) -> List[ParallelTask]:
        """Decompose multi-file operations."""
        # Extract file references
        files = self._extract_files(transcript, context)
        
        # Create parallel task for each file
        base_action = self._extract_action(transcript)
        
        return [
            ParallelTask(
                id=f"file_{i}",
                agent=self._select_agent_for_action(base_action),
                instruction=f"{base_action} {file}",
                context=context.conversation_summary
            )
            for i, file in enumerate(files)
        ]
    
    async def _decompose_multi_action(
        self,
        transcript: str,
        context: SessionContext
    ) -> List[ParallelTask]:
        """Decompose requests with multiple actions."""
        # Split by conjunctions
        actions = re.split(r'\s+(?:and|also|plus)\s+', transcript.lower())
        
        return [
            ParallelTask(
                id=f"action_{i}",
                agent=self._select_agent_for_action(action),
                instruction=action.strip(),
                context=context.conversation_summary
            )
            for i, action in enumerate(actions)
            if action.strip()
        ]
    
    async def _decompose_comprehensive(
        self,
        transcript: str,
        context: SessionContext
    ) -> List[ParallelTask]:
        """
        Decompose comprehensive analysis requests.
        
        "Do a full review" → security + code quality + architecture
        """
        if "review" in transcript.lower():
            return [
                ParallelTask(
                    id="security",
                    agent="security-guardian",
                    instruction=f"Security review: {transcript}",
                    context=context.conversation_summary
                ),
                ParallelTask(
                    id="quality",
                    agent="bug-hunter",
                    instruction=f"Code quality review: {transcript}",
                    context=context.conversation_summary
                ),
                ParallelTask(
                    id="architecture",
                    agent="zen-architect",
                    instruction=f"Architecture review: {transcript}",
                    context=context.conversation_summary
                ),
            ]
        
        return []
```

### 2.3 Speculative Execution

```python
class SpeculativeExecutor:
    """
    Speculatively execute likely follow-up tasks while user is listening.
    Reduces perceived latency for common patterns.
    """
    
    # Common follow-up patterns
    FOLLOW_UP_PATTERNS = {
        "read_file": ["edit_file", "explain_code"],
        "run_tests": ["show_failures", "fix_test"],
        "search_code": ["read_file", "explain_match"],
        "check_lint": ["fix_lint", "explain_issue"],
    }
    
    def __init__(self, agent_pool: AgentPool):
        self.agent_pool = agent_pool
        self.speculative_cache: Dict[str, SpeculativeResult] = {}
        self.active_speculations: Dict[str, asyncio.Task] = {}
        
    async def maybe_speculate(
        self,
        completed_action: str,
        result: str,
        context: SessionContext
    ) -> None:
        """Start speculative execution based on completed action."""
        
        likely_followups = self._predict_followups(completed_action, result)
        
        for followup in likely_followups[:2]:  # Max 2 speculative tasks
            if followup.id not in self.active_speculations:
                task = asyncio.create_task(
                    self._speculative_execute(followup)
                )
                self.active_speculations[followup.id] = task
    
    def _predict_followups(
        self,
        action: str,
        result: str
    ) -> List[SpeculativeTask]:
        """Predict likely follow-up actions."""
        predictions = []
        
        # Pattern-based prediction
        for pattern, followups in self.FOLLOW_UP_PATTERNS.items():
            if pattern in action.lower():
                for followup in followups:
                    predictions.append(SpeculativeTask(
                        id=f"spec_{action}_{followup}",
                        predicted_action=followup,
                        context_from=result[:1000],
                        confidence=0.6
                    ))
        
        # File-specific predictions
        if "read" in action.lower() and ".py" in action:
            # After reading Python file, likely to ask about it
            predictions.append(SpeculativeTask(
                id=f"spec_{action}_explain",
                predicted_action="explain_structure",
                context_from=result[:2000],
                confidence=0.5
            ))
        
        return sorted(predictions, key=lambda p: p.confidence, reverse=True)
    
    async def _speculative_execute(
        self,
        task: SpeculativeTask
    ) -> None:
        """Execute speculative task in background."""
        try:
            result = await asyncio.wait_for(
                self._execute_prediction(task),
                timeout=10.0  # Short timeout for speculative work
            )
            
            self.speculative_cache[task.id] = SpeculativeResult(
                task_id=task.id,
                result=result,
                created_at=time.time(),
                expires_at=time.time() + 60  # Cache for 60 seconds
            )
        except Exception:
            pass  # Silently fail speculative execution
        finally:
            self.active_speculations.pop(task.id, None)
    
    def get_cached_result(self, action: str) -> Optional[str]:
        """Get cached speculative result if available."""
        for cache_id, result in self.speculative_cache.items():
            if action.lower() in cache_id.lower():
                if result.expires_at > time.time():
                    return result.result
        return None
    
    def clear_stale_cache(self) -> None:
        """Remove expired speculative results."""
        now = time.time()
        self.speculative_cache = {
            k: v for k, v in self.speculative_cache.items()
            if v.expires_at > now
        }


@dataclass
class SpeculativeTask:
    id: str
    predicted_action: str
    context_from: str
    confidence: float

@dataclass
class SpeculativeResult:
    task_id: str
    result: str
    created_at: float
    expires_at: float
```

---

## 3. Bidirectional Communication

### Overview

Amplifier pushes updates to voice proactively, enabling real-time progress feedback, interruption handling, and status notifications without polling.

### 3.1 Event Push Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     BIDIRECTIONAL COMMUNICATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│     Voice Session                    Event Bus                    Amplifier     │
│          │                              │                            │          │
│          │                              │                            │          │
│  ┌───────┴───────┐              ┌───────┴───────┐            ┌───────┴───────┐  │
│  │   Subscribe   │──subscribe──▶│   Channel     │◀─publish───│   Executor    │  │
│  │   Handler     │◀───events────│   Manager     │            │   Events      │  │
│  └───────────────┘              └───────────────┘            └───────────────┘  │
│                                                                                 │
│  Event Types:                                                                   │
│  ────────────                                                                   │
│  • progress_update: Task progress (%, message)                                  │
│  • status_change: Agent state transitions                                       │
│  • notification: Important updates requiring attention                          │
│  • approval_request: Agent needs user input                                     │
│  • result_preview: Partial results during execution                             │
│  • context_update: Shared context modifications                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Event Bus Implementation

```python
class AmplifierEventBus:
    """Central event bus for Amplifier-to-Voice communication."""
    
    def __init__(self):
        self.subscribers: Dict[str, List[EventHandler]] = defaultdict(list)
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self.running = False
        
    async def start(self) -> None:
        """Start the event bus processor."""
        self.running = True
        asyncio.create_task(self._process_events())
    
    async def stop(self) -> None:
        """Stop the event bus."""
        self.running = False
    
    def subscribe(
        self,
        event_type: str,
        handler: Callable[[AmplifierEvent], Awaitable[None]],
        session_id: Optional[str] = None
    ) -> str:
        """
        Subscribe to events.
        
        Args:
            event_type: Type of event to subscribe to ("*" for all)
            handler: Async callback function
            session_id: Optional session filter
            
        Returns:
            Subscription ID
        """
        sub_id = f"sub_{uuid.uuid4().hex[:8]}"
        self.subscribers[event_type].append(EventHandler(
            id=sub_id,
            callback=handler,
            session_filter=session_id
        ))
        return sub_id
    
    def unsubscribe(self, subscription_id: str) -> None:
        """Remove a subscription."""
        for event_type, handlers in self.subscribers.items():
            self.subscribers[event_type] = [
                h for h in handlers if h.id != subscription_id
            ]
    
    async def publish(self, event: AmplifierEvent) -> None:
        """Publish an event to the bus."""
        await self.event_queue.put(event)
    
    async def _process_events(self) -> None:
        """Process events from the queue."""
        while self.running:
            try:
                event = await asyncio.wait_for(
                    self.event_queue.get(),
                    timeout=1.0
                )
                await self._dispatch_event(event)
            except asyncio.TimeoutError:
                continue
    
    async def _dispatch_event(self, event: AmplifierEvent) -> None:
        """Dispatch event to matching subscribers."""
        # Get handlers for this event type + wildcard handlers
        handlers = (
            self.subscribers.get(event.type, []) +
            self.subscribers.get("*", [])
        )
        
        for handler in handlers:
            # Apply session filter if set
            if handler.session_filter and event.session_id != handler.session_filter:
                continue
            
            try:
                await handler.callback(event)
            except Exception as e:
                logger.error(f"Event handler error: {e}")


@dataclass
class AmplifierEvent:
    type: str
    session_id: str
    timestamp: float
    data: Dict[str, Any]
    priority: str = "normal"  # "low", "normal", "high", "critical"

@dataclass
class EventHandler:
    id: str
    callback: Callable[[AmplifierEvent], Awaitable[None]]
    session_filter: Optional[str] = None
```

### 3.3 Progress Streaming

```python
class ProgressStreamer:
    """Stream progress updates from Amplifier to Voice."""
    
    def __init__(self, event_bus: AmplifierEventBus):
        self.event_bus = event_bus
        self.active_streams: Dict[str, ProgressStream] = {}
        
    async def start_stream(
        self,
        task_id: str,
        session_id: str,
        description: str
    ) -> ProgressStream:
        """Start a new progress stream for a task."""
        stream = ProgressStream(
            task_id=task_id,
            session_id=session_id,
            description=description,
            started_at=time.time()
        )
        self.active_streams[task_id] = stream
        
        # Emit start event
        await self.event_bus.publish(AmplifierEvent(
            type="task_started",
            session_id=session_id,
            timestamp=time.time(),
            data={
                "task_id": task_id,
                "description": description
            }
        ))
        
        return stream
    
    async def update_progress(
        self,
        task_id: str,
        progress: float,  # 0.0 - 1.0
        message: str,
        details: Optional[Dict] = None
    ) -> None:
        """Send progress update."""
        stream = self.active_streams.get(task_id)
        if not stream:
            return
        
        stream.current_progress = progress
        stream.last_message = message
        
        await self.event_bus.publish(AmplifierEvent(
            type="progress_update",
            session_id=stream.session_id,
            timestamp=time.time(),
            data={
                "task_id": task_id,
                "progress": progress,
                "message": message,
                "details": details,
                "elapsed_ms": (time.time() - stream.started_at) * 1000
            }
        ))
    
    async def stream_partial_result(
        self,
        task_id: str,
        partial_result: str
    ) -> None:
        """Stream partial results during execution."""
        stream = self.active_streams.get(task_id)
        if not stream:
            return
        
        await self.event_bus.publish(AmplifierEvent(
            type="result_preview",
            session_id=stream.session_id,
            timestamp=time.time(),
            data={
                "task_id": task_id,
                "preview": partial_result[:500],
                "is_partial": True
            }
        ))
    
    async def complete_stream(
        self,
        task_id: str,
        success: bool,
        result: Optional[str] = None,
        error: Optional[str] = None
    ) -> None:
        """Complete and close progress stream."""
        stream = self.active_streams.pop(task_id, None)
        if not stream:
            return
        
        await self.event_bus.publish(AmplifierEvent(
            type="task_completed",
            session_id=stream.session_id,
            timestamp=time.time(),
            data={
                "task_id": task_id,
                "success": success,
                "result_preview": result[:200] if result else None,
                "error": error,
                "duration_ms": (time.time() - stream.started_at) * 1000
            }
        ))


@dataclass
class ProgressStream:
    task_id: str
    session_id: str
    description: str
    started_at: float
    current_progress: float = 0.0
    last_message: str = ""
```

### 3.4 Voice Interjection System

```python
class VoiceInterjectionManager:
    """Manage proactive voice interjections based on Amplifier events."""
    
    # Interjection priorities and thresholds
    INTERJECTION_RULES = {
        "task_started": {
            "priority": "low",
            "delay_ms": 2000,  # Wait before speaking
            "template": "I'm starting to {description}.",
            "interruptible": True
        },
        "progress_update": {
            "priority": "low", 
            "min_interval_ms": 10000,  # Min time between updates
            "template": "{message}. About {progress}% done.",
            "interruptible": True
        },
        "task_completed": {
            "priority": "normal",
            "delay_ms": 0,
            "template": "Done. {result_preview}",
            "interruptible": False
        },
        "approval_request": {
            "priority": "high",
            "delay_ms": 0,
            "template": "I need your input: {question}",
            "interruptible": False
        },
        "error_occurred": {
            "priority": "high",
            "delay_ms": 0,
            "template": "I ran into an issue: {error}",
            "interruptible": False
        }
    }
    
    def __init__(
        self,
        voice_session: VoiceSession,
        event_bus: AmplifierEventBus
    ):
        self.voice = voice_session
        self.event_bus = event_bus
        self.last_interjection: Dict[str, float] = {}
        self.pending_interjections: asyncio.Queue = asyncio.Queue()
        
        # Subscribe to relevant events
        self._setup_subscriptions()
    
    def _setup_subscriptions(self) -> None:
        """Set up event subscriptions."""
        for event_type in self.INTERJECTION_RULES:
            self.event_bus.subscribe(
                event_type,
                self._handle_event,
                session_id=self.voice.session_id
            )
    
    async def _handle_event(self, event: AmplifierEvent) -> None:
        """Handle incoming event and decide on interjection."""
        rules = self.INTERJECTION_RULES.get(event.type)
        if not rules:
            return
        
        # Check rate limiting
        if not self._should_interject(event.type, rules):
            return
        
        # Build interjection
        interjection = Interjection(
            priority=rules["priority"],
            message=rules["template"].format(**event.data),
            interruptible=rules["interruptible"],
            delay_ms=rules.get("delay_ms", 0)
        )
        
        await self.pending_interjections.put(interjection)
    
    def _should_interject(self, event_type: str, rules: dict) -> bool:
        """Check if interjection should occur based on rate limits."""
        now = time.time() * 1000  # Convert to ms
        
        min_interval = rules.get("min_interval_ms", 0)
        last_time = self.last_interjection.get(event_type, 0)
        
        if now - last_time < min_interval:
            return False
        
        self.last_interjection[event_type] = now
        return True
    
    async def process_interjections(self) -> None:
        """Process pending interjections with priority."""
        while True:
            interjection = await self.pending_interjections.get()
            
            # Wait for delay if specified
            if interjection.delay_ms > 0:
                await asyncio.sleep(interjection.delay_ms / 1000)
            
            # Check if voice is busy (unless high priority)
            if interjection.priority != "high" and self.voice.is_speaking:
                if interjection.interruptible:
                    continue  # Skip this interjection
            
            # Deliver interjection
            await self.voice.speak(interjection.message)


@dataclass
class Interjection:
    priority: str
    message: str
    interruptible: bool
    delay_ms: int
```

### 3.5 Approval Gate System

```python
class ApprovalGateManager:
    """Manage approval requests from Amplifier requiring voice confirmation."""
    
    def __init__(
        self,
        voice_session: VoiceSession,
        event_bus: AmplifierEventBus
    ):
        self.voice = voice_session
        self.event_bus = event_bus
        self.pending_approvals: Dict[str, ApprovalRequest] = {}
        
        # Subscribe to approval events
        self.event_bus.subscribe(
            "approval_request",
            self._handle_approval_request,
            session_id=self.voice.session_id
        )
    
    async def _handle_approval_request(self, event: AmplifierEvent) -> None:
        """Handle incoming approval request."""
        request = ApprovalRequest(
            id=event.data["request_id"],
            question=event.data["question"],
            options=event.data.get("options", ["yes", "no"]),
            timeout_ms=event.data.get("timeout_ms", 30000),
            default_action=event.data.get("default", "deny"),
            created_at=time.time()
        )
        
        self.pending_approvals[request.id] = request
        
        # Speak the approval question
        await self.voice.speak(request.question)
        
        # Start timeout handler
        asyncio.create_task(
            self._handle_timeout(request.id, request.timeout_ms)
        )
    
    async def process_user_response(self, transcript: str) -> bool:
        """Process user's voice response to approval request."""
        # Find pending approval
        if not self.pending_approvals:
            return False
        
        # Check most recent approval first
        request = list(self.pending_approvals.values())[-1]
        
        # Parse response
        decision = self._parse_decision(transcript, request.options)
        
        if decision:
            await self._resolve_approval(request.id, decision)
            return True
        
        return False
    
    def _parse_decision(
        self, 
        transcript: str, 
        options: List[str]
    ) -> Optional[str]:
        """Parse user response into approval decision."""
        transcript_lower = transcript.lower()
        
        # Check for affirmative
        affirmatives = ["yes", "yeah", "sure", "okay", "ok", "do it", "go ahead", "proceed"]
        for word in affirmatives:
            if word in transcript_lower:
                return "approve"
        
        # Check for negative
        negatives = ["no", "nope", "don't", "stop", "cancel", "abort"]
        for word in negatives:
            if word in transcript_lower:
                return "deny"
        
        return None
    
    async def _resolve_approval(self, request_id: str, decision: str) -> None:
        """Resolve an approval request."""
        request = self.pending_approvals.pop(request_id, None)
        if not request:
            return
        
        # Publish resolution event
        await self.event_bus.publish(AmplifierEvent(
            type="approval_response",
            session_id=self.voice.session_id,
            timestamp=time.time(),
            data={
                "request_id": request_id,
                "decision": decision,
                "response_time_ms": (time.time() - request.created_at) * 1000
            }
        ))
    
    async def _handle_timeout(self, request_id: str, timeout_ms: int) -> None:
        """Handle approval timeout."""
        await asyncio.sleep(timeout_ms / 1000)
        
        request = self.pending_approvals.get(request_id)
        if request:
            await self.voice.speak(
                f"No response received. Defaulting to {request.default_action}."
            )
            await self._resolve_approval(request_id, request.default_action)


@dataclass
class ApprovalRequest:
    id: str
    question: str
    options: List[str]
    timeout_ms: int
    default_action: str
    created_at: float
```

---

## 4. Shared Context & Memory Sync

### Overview

Maintain synchronized context between Voice and Amplifier sessions, enabling seamless conversation continuity, file tracking, and preference persistence.

### 4.1 Shared Context Store

```python
class SharedContextStore:
    """
    Centralized context store shared between Voice and Amplifier.
    Provides bidirectional synchronization with conflict resolution.
    """
    
    def __init__(self, persistence_path: str):
        self.persistence_path = persistence_path
        self.context: SharedContext = SharedContext()
        self.sync_lock = asyncio.Lock()
        self.dirty = False
        self.last_sync = 0.0
        
    async def update(
        self,
        field: str,
        value: Any,
        source: str,  # "voice" | "amplifier"
        merge_strategy: str = "latest"  # "latest" | "merge" | "voice_wins" | "amplifier_wins"
    ) -> None:
        """
        Update a context field with conflict resolution.
        """
        async with self.sync_lock:
            current_value = getattr(self.context, field, None)
            
            # Apply merge strategy
            if merge_strategy == "merge" and isinstance(current_value, list):
                new_value = self._merge_lists(current_value, value)
            elif merge_strategy == "merge" and isinstance(current_value, dict):
                new_value = {**current_value, **value}
            elif merge_strategy == "voice_wins" and source != "voice":
                return  # Don't update
            elif merge_strategy == "amplifier_wins" and source != "amplifier":
                return  # Don't update
            else:  # "latest"
                new_value = value
            
            # Update with version tracking
            setattr(self.context, field, new_value)
            self.context.version += 1
            self.context.last_modified = time.time()
            self.context.modified_by = source
            self.dirty = True
    
    async def get(self, field: str) -> Any:
        """Get a context field value."""
        return getattr(self.context, field, None)
    
    async def sync_from_voice(self, voice_context: VoiceContext) -> None:
        """Sync context from voice session."""
        await self.update("active_files", voice_context.mentioned_files, "voice", "merge")
        await self.update("conversation_summary", voice_context.summary, "voice", "latest")
        await self.update("user_preferences", voice_context.preferences, "voice", "merge")
        await self.update("recent_queries", voice_context.queries[-10:], "voice", "latest")
    
    async def sync_from_amplifier(self, amplifier_state: AmplifierState) -> None:
        """Sync context from Amplifier session."""
        await self.update("modified_files", amplifier_state.modified_files, "amplifier", "merge")
        await self.update("discoveries", amplifier_state.discoveries, "amplifier", "merge")
        await self.update("task_history", amplifier_state.task_history, "amplifier", "latest")
        await self.update("cwd", amplifier_state.cwd, "amplifier", "latest")
    
    async def get_voice_context(self) -> Dict[str, Any]:
        """Get context optimized for voice session."""
        return {
            "summary": self._compress_for_voice(self.context.conversation_summary),
            "active_files": self.context.active_files[:5],  # Top 5 most relevant
            "recent_changes": self._summarize_changes(self.context.modified_files),
            "user_preferences": self.context.user_preferences,
        }
    
    async def get_amplifier_context(self) -> Dict[str, Any]:
        """Get context optimized for Amplifier session."""
        return {
            "conversation_context": self.context.conversation_summary,
            "files_discussed": self.context.active_files,
            "user_queries": self.context.recent_queries,
            "preferences": self.context.user_preferences,
            "cwd": self.context.cwd,
        }
    
    def _compress_for_voice(self, text: str, max_words: int = 100) -> str:
        """Compress text for voice-friendly delivery."""
        if not text:
            return ""
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words]) + "..."
    
    def _summarize_changes(self, files: List[FileChange]) -> str:
        """Summarize file changes for voice."""
        if not files:
            return "No recent changes."
        
        summary_parts = []
        for f in files[-3:]:  # Last 3 changes
            summary_parts.append(f"{f.action} {f.filename}")
        
        return "Recent changes: " + ", ".join(summary_parts)
    
    async def persist(self) -> None:
        """Persist context to disk."""
        if not self.dirty:
            return
        
        async with self.sync_lock:
            with open(self.persistence_path, "w") as f:
                json.dump(asdict(self.context), f, indent=2, default=str)
            self.dirty = False
            self.last_sync = time.time()
    
    async def load(self) -> None:
        """Load context from disk."""
        try:
            with open(self.persistence_path, "r") as f:
                data = json.load(f)
                self.context = SharedContext(**data)
        except FileNotFoundError:
            self.context = SharedContext()


@dataclass
class SharedContext:
    # Identification
    session_id: str = ""
    version: int = 0
    last_modified: float = 0.0
    modified_by: str = ""
    
    # Files
    active_files: List[str] = field(default_factory=list)
    modified_files: List[FileChange] = field(default_factory=list)
    
    # Conversation
    conversation_summary: str = ""
    recent_queries: List[str] = field(default_factory=list)
    
    # Amplifier state
    cwd: str = ""
    discoveries: List[str] = field(default_factory=list)
    task_history: List[TaskSummary] = field(default_factory=list)
    
    # User
    user_preferences: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FileChange:
    filename: str
    action: str  # "created", "modified", "deleted"
    timestamp: float
    summary: Optional[str] = None
```

### 4.2 Memory Synchronization Engine

```python
class MemorySyncEngine:
    """
    Synchronize memory between Voice and Amplifier in real-time.
    Handles bidirectional updates with conflict resolution.
    """
    
    SYNC_INTERVAL = 5.0  # Seconds between periodic syncs
    
    def __init__(
        self,
        context_store: SharedContextStore,
        event_bus: AmplifierEventBus
    ):
        self.store = context_store
        self.event_bus = event_bus
        self.sync_running = False
        
        # Track pending changes from each side
        self.voice_changes: asyncio.Queue = asyncio.Queue()
        self.amplifier_changes: asyncio.Queue = asyncio.Queue()
        
        # Subscribe to context events
        self.event_bus.subscribe("context_update", self._handle_amplifier_update)
    
    async def start(self) -> None:
        """Start the sync engine."""
        self.sync_running = True
        asyncio.create_task(self._sync_loop())
        asyncio.create_task(self._process_voice_changes())
        asyncio.create_task(self._process_amplifier_changes())
    
    async def stop(self) -> None:
        """Stop the sync engine."""
        self.sync_running = False
        await self.store.persist()
    
    async def record_voice_change(self, change: ContextChange) -> None:
        """Record a context change from voice session."""
        await self.voice_changes.put(change)
    
    async def _handle_amplifier_update(self, event: AmplifierEvent) -> None:
        """Handle context update from Amplifier."""
        change = ContextChange(
            source="amplifier",
            field=event.data["field"],
            value=event.data["value"],
            timestamp=event.timestamp
        )
        await self.amplifier_changes.put(change)
    
    async def _process_voice_changes(self) -> None:
        """Process voice context changes."""
        while self.sync_running:
            try:
                change = await asyncio.wait_for(
                    self.voice_changes.get(),
                    timeout=1.0
                )
                await self.store.update(
                    field=change.field,
                    value=change.value,
                    source="voice"
                )
                
                # Notify Amplifier of change
                await self.event_bus.publish(AmplifierEvent(
                    type="context_sync",
                    session_id=self.store.context.session_id,
                    timestamp=time.time(),
                    data={
                        "field": change.field,
                        "value": change.value,
                        "source": "voice"
                    }
                ))
            except asyncio.TimeoutError:
                continue
    
    async def _process_amplifier_changes(self) -> None:
        """Process Amplifier context changes."""
        while self.sync_running:
            try:
                change = await asyncio.wait_for(
                    self.amplifier_changes.get(),
                    timeout=1.0
                )
                await self.store.update(
                    field=change.field,
                    value=change.value,
                    source="amplifier"
                )
            except asyncio.TimeoutError:
                continue
    
    async def _sync_loop(self) -> None:
        """Periodic sync and persistence."""
        while self.sync_running:
            await asyncio.sleep(self.SYNC_INTERVAL)
            await self.store.persist()


@dataclass
class ContextChange:
    source: str
    field: str
    value: Any
    timestamp: float
```

### 4.3 Conversation Continuity Manager

```python
class ConversationContinuityManager:
    """
    Maintain conversation continuity across voice session timeouts.
    Summarizes context for new sessions.
    """
    
    def __init__(
        self,
        context_store: SharedContextStore,
        llm_client: LLMClient
    ):
        self.store = context_store
        self.llm = llm_client
        
    async def save_session_state(
        self,
        voice_session: VoiceSession
    ) -> SessionSnapshot:
        """
        Save session state before timeout/disconnect.
        
        Creates a compressed snapshot for recovery.
        """
        # Get conversation transcripts
        transcripts = voice_session.get_transcripts()
        
        # Generate summary
        summary = await self._generate_summary(transcripts)
        
        # Create snapshot
        snapshot = SessionSnapshot(
            session_id=voice_session.session_id,
            created_at=time.time(),
            conversation_summary=summary,
            last_n_turns=transcripts[-5:],  # Keep last 5 verbatim
            active_files=list(self.store.context.active_files),
            pending_tasks=[t for t in self.store.context.task_history if t.status == "running"],
            user_preferences=dict(self.store.context.user_preferences)
        )
        
        # Persist snapshot
        await self._persist_snapshot(snapshot)
        
        return snapshot
    
    async def restore_session_context(
        self,
        snapshot_id: str
    ) -> Optional[str]:
        """
        Restore session context and generate continuation prompt.
        
        Returns context injection for new voice session.
        """
        snapshot = await self._load_snapshot(snapshot_id)
        if not snapshot:
            return None
        
        # Build context injection
        context_parts = [
            f"Previous conversation summary: {snapshot.conversation_summary}",
        ]
        
        if snapshot.active_files:
            context_parts.append(
                f"Files being discussed: {', '.join(snapshot.active_files[:3])}"
            )
        
        if snapshot.pending_tasks:
            task_summaries = [t.description for t in snapshot.pending_tasks[:2]]
            context_parts.append(
                f"Tasks in progress: {'; '.join(task_summaries)}"
            )
        
        return "\n".join(context_parts)
    
    async def generate_session_handoff(
        self,
        old_session: VoiceSession
    ) -> str:
        """
        Generate a voice-friendly handoff message.
        
        Example: "I remember you were working on the auth module..."
        """
        summary = await self._generate_summary(
            old_session.get_transcripts(),
            style="handoff"
        )
        
        return f"I remember our previous conversation. {summary}"
    
    async def _generate_summary(
        self,
        transcripts: List[ConversationTurn],
        style: str = "summary"
    ) -> str:
        """Generate conversation summary using LLM."""
        
        if not transcripts:
            return "No previous context."
        
        transcript_text = "\n".join([
            f"{t.role}: {t.content}"
            for t in transcripts[-20:]  # Last 20 turns max
        ])
        
        if style == "handoff":
            prompt = f"""Summarize this conversation in one sentence for continuing later.
Focus on what the user was working on and key decisions made.

Conversation:
{transcript_text}

One-sentence summary for resuming:"""
        else:
            prompt = f"""Summarize this conversation concisely.
Include: main topic, key files discussed, decisions made, current state.

Conversation:
{transcript_text}

Summary (2-3 sentences):"""
        
        result = await self.llm.generate(prompt, max_tokens=150)
        return result.strip()


@dataclass
class SessionSnapshot:
    session_id: str
    created_at: float
    conversation_summary: str
    last_n_turns: List[ConversationTurn]
    active_files: List[str]
    pending_tasks: List[TaskSummary]
    user_preferences: Dict[str, Any]
```

---

## 5. Quality-Based Routing

### Overview

Route requests to appropriate model tiers based on complexity. Simple queries use fast/cheap models; complex tasks use powerful models. Optimizes for both cost and quality.

### 5.1 Complexity Analysis Engine

```python
class ComplexityAnalyzer:
    """Analyze request complexity for routing decisions."""
    
    # Complexity indicators
    SIMPLE_INDICATORS = [
        r"^(what|where|which|how many)\s+\w+",  # Simple questions
        r"^(show|list|find)\s+\w+",  # Direct lookups
        r"^(read|open)\s+\w+",  # File reads
    ]
    
    MEDIUM_INDICATORS = [
        r"(change|modify|update|fix)\s+\w+",  # Modifications
        r"(explain|describe)\s+.{20,}",  # Explanations
        r"(why|how)\s+.{20,}",  # Analysis questions
    ]
    
    COMPLEX_INDICATORS = [
        r"(design|architect|refactor)\s+",  # Architecture
        r"(review|audit|analyze)\s+.*security",  # Security
        r"(implement|build|create)\s+.*feature",  # Features
        r"(compare|evaluate|assess)\s+",  # Comparisons
        r"multiple|all|entire|complete|comprehensive",  # Scope words
    ]
    
    async def analyze_complexity(
        self,
        request: str,
        context: Optional[SessionContext] = None
    ) -> ComplexityScore:
        """
        Analyze request complexity.
        
        Returns:
            ComplexityScore with tier recommendation
        """
        # Phase 1: Pattern-based analysis (fast)
        pattern_score = self._pattern_analysis(request)
        
        # Phase 2: Length-based heuristics
        length_score = self._length_analysis(request)
        
        # Phase 3: Context factors
        context_score = self._context_analysis(request, context) if context else 0.5
        
        # Combine scores
        final_score = (
            pattern_score * 0.5 +
            length_score * 0.2 +
            context_score * 0.3
        )
        
        # Determine tier
        if final_score < 0.3:
            tier = "fast"
        elif final_score < 0.7:
            tier = "standard"
        else:
            tier = "powerful"
        
        return ComplexityScore(
            score=final_score,
            tier=tier,
            reasoning=self._generate_reasoning(pattern_score, length_score, context_score)
        )
    
    def _pattern_analysis(self, request: str) -> float:
        """Score based on pattern matching."""
        request_lower = request.lower()
        
        # Check simple patterns
        for pattern in self.SIMPLE_INDICATORS:
            if re.search(pattern, request_lower):
                return 0.2
        
        # Check complex patterns
        for pattern in self.COMPLEX_INDICATORS:
            if re.search(pattern, request_lower):
                return 0.9
        
        # Check medium patterns
        for pattern in self.MEDIUM_INDICATORS:
            if re.search(pattern, request_lower):
                return 0.5
        
        return 0.5  # Default to medium
    
    def _length_analysis(self, request: str) -> float:
        """Score based on request length and structure."""
        words = request.split()
        word_count = len(words)
        
        # Very short = simple
        if word_count < 5:
            return 0.2
        
        # Short = likely simple
        if word_count < 15:
            return 0.4
        
        # Medium length
        if word_count < 30:
            return 0.6
        
        # Long = likely complex
        return 0.8
    
    def _context_analysis(
        self,
        request: str,
        context: SessionContext
    ) -> float:
        """Score based on context factors."""
        score = 0.5
        
        # Recent errors suggest debugging (medium)
        if context.recent_errors:
            score = max(score, 0.6)
        
        # Multiple files involved
        if len(context.active_files) > 3:
            score = max(score, 0.7)
        
        # Large files being discussed
        if any(f.size > 500 for f in context.file_metadata.values()):
            score = max(score, 0.6)
        
        return score


@dataclass
class ComplexityScore:
    score: float  # 0.0 - 1.0
    tier: str  # "fast", "standard", "powerful"
    reasoning: str
```

### 5.2 Quality Router

```python
class QualityRouter:
    """Route requests to appropriate model tier based on complexity."""
    
    # Model tier configurations
    MODEL_TIERS = {
        "fast": {
            "models": ["gpt-4o-mini", "claude-3-haiku"],
            "max_tokens": 1000,
            "timeout_ms": 5000,
            "cost_per_1k": 0.0005,
            "use_cases": ["simple lookups", "file reads", "quick answers"]
        },
        "standard": {
            "models": ["gpt-4o", "claude-3.5-sonnet"],
            "max_tokens": 4000,
            "timeout_ms": 30000,
            "cost_per_1k": 0.01,
            "use_cases": ["code changes", "explanations", "debugging"]
        },
        "powerful": {
            "models": ["claude-3.5-sonnet", "gpt-4o"],
            "max_tokens": 8000,
            "timeout_ms": 60000,
            "cost_per_1k": 0.03,
            "use_cases": ["architecture", "security review", "complex features"]
        }
    }
    
    def __init__(
        self,
        complexity_analyzer: ComplexityAnalyzer,
        model_pool: ModelPool
    ):
        self.analyzer = complexity_analyzer
        self.model_pool = model_pool
        self.routing_history: List[RoutingDecision] = []
        
    async def route(
        self,
        request: str,
        context: Optional[SessionContext] = None,
        override_tier: Optional[str] = None
    ) -> RoutingResult:
        """
        Route request to appropriate model tier.
        
        Returns model configuration for execution.
        """
        # Analyze complexity
        complexity = await self.analyzer.analyze_complexity(request, context)
        
        # Apply override if provided
        tier = override_tier or complexity.tier
        
        # Get tier configuration
        tier_config = self.MODEL_TIERS[tier]
        
        # Select best available model in tier
        model = await self._select_model(tier_config["models"])
        
        # Record routing decision
        decision = RoutingDecision(
            request_preview=request[:100],
            complexity_score=complexity.score,
            selected_tier=tier,
            selected_model=model,
            reasoning=complexity.reasoning,
            timestamp=time.time()
        )
        self.routing_history.append(decision)
        
        return RoutingResult(
            model=model,
            tier=tier,
            max_tokens=tier_config["max_tokens"],
            timeout_ms=tier_config["timeout_ms"],
            estimated_cost_per_1k=tier_config["cost_per_1k"],
            complexity=complexity
        )
    
    async def _select_model(self, models: List[str]) -> str:
        """Select best available model from tier."""
        for model in models:
            if await self.model_pool.is_available(model):
                return model
        
        # Fallback to first model
        return models[0]
    
    def get_routing_stats(self) -> Dict[str, Any]:
        """Get routing statistics for monitoring."""
        if not self.routing_history:
            return {}
        
        tier_counts = defaultdict(int)
        for decision in self.routing_history[-100:]:  # Last 100
            tier_counts[decision.selected_tier] += 1
        
        return {
            "tier_distribution": dict(tier_counts),
            "avg_complexity": sum(d.complexity_score for d in self.routing_history[-100:]) / min(len(self.routing_history), 100),
            "total_routed": len(self.routing_history)
        }


@dataclass
class RoutingDecision:
    request_preview: str
    complexity_score: float
    selected_tier: str
    selected_model: str
    reasoning: str
    timestamp: float

@dataclass
class RoutingResult:
    model: str
    tier: str
    max_tokens: int
    timeout_ms: int
    estimated_cost_per_1k: float
    complexity: ComplexityScore
```

### 5.3 Adaptive Quality Scaling

```python
class AdaptiveQualityScaler:
    """
    Dynamically adjust quality routing based on real-time feedback.
    Learns from user corrections and satisfaction signals.
    """
    
    def __init__(self, quality_router: QualityRouter):
        self.router = quality_router
        self.feedback_log: List[QualityFeedback] = []
        self.tier_adjustments: Dict[str, float] = defaultdict(float)
        
    async def record_feedback(
        self,
        routing_decision: RoutingDecision,
        feedback_type: str,  # "correction", "approval", "reroute"
        details: Optional[str] = None
    ) -> None:
        """Record quality feedback for learning."""
        feedback = QualityFeedback(
            decision=routing_decision,
            feedback_type=feedback_type,
            details=details,
            timestamp=time.time()
        )
        self.feedback_log.append(feedback)
        
        # Update tier adjustments based on feedback
        await self._update_adjustments(feedback)
    
    async def _update_adjustments(self, feedback: QualityFeedback) -> None:
        """Update tier adjustments based on feedback."""
        tier = feedback.decision.selected_tier
        
        if feedback.feedback_type == "correction":
            # User corrected output - maybe needed higher tier
            self.tier_adjustments[tier] -= 0.05  # Increase threshold slightly
        elif feedback.feedback_type == "reroute":
            # Had to reroute to higher tier
            self.tier_adjustments[tier] -= 0.1  # Increase threshold more
        elif feedback.feedback_type == "approval":
            # User approved - tier was appropriate
            self.tier_adjustments[tier] += 0.01  # Slight positive reinforcement
    
    def get_adjusted_complexity(
        self,
        base_complexity: float,
        tier: str
    ) -> float:
        """Get adjusted complexity threshold for tier."""
        adjustment = self.tier_adjustments.get(tier, 0.0)
        return max(0.0, min(1.0, base_complexity + adjustment))
    
    async def suggest_tier_upgrade(
        self,
        current_result: str,
        original_tier: str
    ) -> Optional[str]:
        """Suggest tier upgrade if result seems inadequate."""
        # Simple heuristics for now
        if len(current_result) < 50 and original_tier == "fast":
            return "standard"
        
        if "I'm not sure" in current_result or "error" in current_result.lower():
            if original_tier == "fast":
                return "standard"
            elif original_tier == "standard":
                return "powerful"
        
        return None


@dataclass
class QualityFeedback:
    decision: RoutingDecision
    feedback_type: str
    details: Optional[str]
    timestamp: float
```

---

## 6. Cost Optimization

### Overview

Minimize API costs while maintaining quality through intelligent model selection, request batching, caching, and usage monitoring.

### 6.1 Cost-Aware Executor

```python
class CostAwareExecutor:
    """Execute tasks with cost optimization."""
    
    def __init__(
        self,
        model_pool: ModelPool,
        budget_tracker: BudgetTracker
    ):
        self.model_pool = model_pool
        self.budget = budget_tracker
        self.execution_log: List[ExecutionCost] = []
        
    async def execute(
        self,
        request: str,
        preferred_tier: str,
        context: Optional[str] = None,
        cost_limit: Optional[float] = None
    ) -> ExecutionResult:
        """
        Execute request with cost awareness.
        
        May downgrade tier if approaching budget limits.
        """
        # Check budget status
        budget_status = await self.budget.get_status()
        
        # Potentially downgrade tier if budget constrained
        actual_tier = self._adjust_tier_for_budget(
            preferred_tier,
            budget_status,
            cost_limit
        )
        
        # Estimate cost before execution
        estimated_cost = self._estimate_cost(request, actual_tier)
        
        # Check if within limits
        if cost_limit and estimated_cost > cost_limit:
            return ExecutionResult(
                success=False,
                error=f"Estimated cost ${estimated_cost:.4f} exceeds limit ${cost_limit:.4f}",
                tier_used=actual_tier,
                cost=0.0
            )
        
        # Execute
        start_time = time.time()
        try:
            model = self._get_model_for_tier(actual_tier)
            result = await self.model_pool.execute(
                model=model,
                prompt=self._build_prompt(request, context),
                max_tokens=self._get_max_tokens(actual_tier)
            )
            
            # Calculate actual cost
            actual_cost = self._calculate_cost(
                result.input_tokens,
                result.output_tokens,
                model
            )
            
            # Log execution
            self.execution_log.append(ExecutionCost(
                tier=actual_tier,
                model=model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                cost=actual_cost,
                duration_ms=(time.time() - start_time) * 1000
            ))
            
            # Update budget
            await self.budget.record_cost(actual_cost)
            
            return ExecutionResult(
                success=True,
                result=result.content,
                tier_used=actual_tier,
                cost=actual_cost
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=str(e),
                tier_used=actual_tier,
                cost=0.0
            )
    
    def _adjust_tier_for_budget(
        self,
        preferred: str,
        budget_status: BudgetStatus,
        cost_limit: Optional[float]
    ) -> str:
        """Adjust tier based on budget constraints."""
        # If over 80% of budget, downgrade
        if budget_status.percent_used > 80:
            if preferred == "powerful":
                return "standard"
            elif preferred == "standard":
                return "fast"
        
        # If over 95%, always use fast
        if budget_status.percent_used > 95:
            return "fast"
        
        return preferred
    
    def _estimate_cost(self, request: str, tier: str) -> float:
        """Estimate cost before execution."""
        # Rough token estimates
        input_tokens = len(request.split()) * 1.3
        output_tokens = self._get_max_tokens(tier) * 0.5  # Assume 50% usage
        
        rates = {
            "fast": (0.00015, 0.0006),  # (input, output) per 1K
            "standard": (0.005, 0.015),
            "powerful": (0.01, 0.03)
        }
        
        input_rate, output_rate = rates.get(tier, rates["standard"])
        
        return (input_tokens * input_rate + output_tokens * output_rate) / 1000


@dataclass
class ExecutionCost:
    tier: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    duration_ms: float

@dataclass
class ExecutionResult:
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None
    tier_used: str = ""
    cost: float = 0.0
```

### 6.2 Budget Tracking System

```python
class BudgetTracker:
    """Track and manage API usage budget."""
    
    def __init__(
        self,
        daily_limit: float = 10.0,
        session_limit: float = 5.0,
        alert_threshold: float = 0.8
    ):
        self.daily_limit = daily_limit
        self.session_limit = session_limit
        self.alert_threshold = alert_threshold
        
        self.daily_usage: float = 0.0
        self.session_usage: float = 0.0
        self.day_start: float = time.time()
        self.session_start: float = time.time()
        
        self.cost_history: List[CostEntry] = []
        
    async def record_cost(self, amount: float) -> None:
        """Record a cost entry."""
        self._check_day_rollover()
        
        self.daily_usage += amount
        self.session_usage += amount
        
        self.cost_history.append(CostEntry(
            amount=amount,
            timestamp=time.time(),
            daily_total=self.daily_usage,
            session_total=self.session_usage
        ))
        
        # Check alerts
        await self._check_alerts()
    
    async def get_status(self) -> BudgetStatus:
        """Get current budget status."""
        self._check_day_rollover()
        
        return BudgetStatus(
            daily_used=self.daily_usage,
            daily_limit=self.daily_limit,
            daily_remaining=max(0, self.daily_limit - self.daily_usage),
            percent_used=(self.daily_usage / self.daily_limit) * 100,
            session_used=self.session_usage,
            session_limit=self.session_limit,
            is_over_budget=self.daily_usage >= self.daily_limit
        )
    
    async def _check_alerts(self) -> None:
        """Check and trigger budget alerts."""
        status = await self.get_status()
        
        if status.percent_used >= self.alert_threshold * 100:
            # Trigger alert (implementation depends on notification system)
            logger.warning(
                f"Budget alert: {status.percent_used:.1f}% of daily limit used"
            )
    
    def _check_day_rollover(self) -> None:
        """Check if day has rolled over."""
        now = time.time()
        if now - self.day_start > 86400:  # 24 hours
            self.daily_usage = 0.0
            self.day_start = now
    
    def reset_session(self) -> None:
        """Reset session budget."""
        self.session_usage = 0.0
        self.session_start = time.time()
    
    def get_cost_breakdown(self) -> Dict[str, float]:
        """Get cost breakdown by time period."""
        now = time.time()
        
        last_hour = sum(
            e.amount for e in self.cost_history
            if now - e.timestamp < 3600
        )
        
        last_day = sum(
            e.amount for e in self.cost_history
            if now - e.timestamp < 86400
        )
        
        return {
            "last_hour": last_hour,
            "last_day": last_day,
            "session": self.session_usage
        }


@dataclass
class BudgetStatus:
    daily_used: float
    daily_limit: float
    daily_remaining: float
    percent_used: float
    session_used: float
    session_limit: float
    is_over_budget: bool

@dataclass
class CostEntry:
    amount: float
    timestamp: float
    daily_total: float
    session_total: float
```

### 6.3 Request Batching

```python
class RequestBatcher:
    """Batch similar requests to reduce API calls."""
    
    def __init__(
        self,
        max_batch_size: int = 5,
        max_wait_ms: int = 1000
    ):
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.pending_batches: Dict[str, PendingBatch] = {}
        
    async def add_request(
        self,
        request: BatchableRequest
    ) -> str:
        """Add request to batch, returns batch ID."""
        batch_key = self._get_batch_key(request)
        
        if batch_key not in self.pending_batches:
            self.pending_batches[batch_key] = PendingBatch(
                key=batch_key,
                requests=[],
                created_at=time.time()
            )
            # Start timer for this batch
            asyncio.create_task(
                self._batch_timeout(batch_key)
            )
        
        batch = self.pending_batches[batch_key]
        batch.requests.append(request)
        
        # Execute immediately if batch is full
        if len(batch.requests) >= self.max_batch_size:
            await self._execute_batch(batch_key)
        
        return batch_key
    
    def _get_batch_key(self, request: BatchableRequest) -> str:
        """Generate batch key for grouping similar requests."""
        # Group by operation type and target
        return f"{request.operation}:{request.target_type}"
    
    async def _batch_timeout(self, batch_key: str) -> None:
        """Execute batch after timeout."""
        await asyncio.sleep(self.max_wait_ms / 1000)
        
        if batch_key in self.pending_batches:
            await self._execute_batch(batch_key)
    
    async def _execute_batch(self, batch_key: str) -> None:
        """Execute all requests in batch together."""
        batch = self.pending_batches.pop(batch_key, None)
        if not batch or not batch.requests:
            return
        
        # Combine requests
        combined = self._combine_requests(batch.requests)
        
        # Execute combined request
        result = await self._execute_combined(combined)
        
        # Distribute results
        await self._distribute_results(batch.requests, result)
    
    def _combine_requests(
        self,
        requests: List[BatchableRequest]
    ) -> str:
        """Combine multiple requests into single prompt."""
        combined_parts = ["Process the following requests:\n"]
        
        for i, req in enumerate(requests, 1):
            combined_parts.append(f"{i}. {req.content}")
        
        combined_parts.append("\nProvide results for each numbered item:")
        
        return "\n".join(combined_parts)


@dataclass
class BatchableRequest:
    id: str
    operation: str  # "read", "search", "explain"
    target_type: str  # "file", "code", "docs"
    content: str
    callback: Callable[[str], Awaitable[None]]

@dataclass
class PendingBatch:
    key: str
    requests: List[BatchableRequest]
    created_at: float
```

### 6.4 Intelligent Caching

```python
class IntelligentCache:
    """Cache results with intelligent invalidation."""
    
    def __init__(
        self,
        max_size: int = 1000,
        default_ttl: int = 300  # 5 minutes
    ):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: Dict[str, CacheEntry] = {}
        self.hit_count = 0
        self.miss_count = 0
        
    async def get(
        self,
        key: str,
        context_hash: Optional[str] = None
    ) -> Optional[str]:
        """Get cached result if valid."""
        entry = self.cache.get(key)
        
        if not entry:
            self.miss_count += 1
            return None
        
        # Check expiration
        if time.time() > entry.expires_at:
            del self.cache[key]
            self.miss_count += 1
            return None
        
        # Check context invalidation
        if context_hash and entry.context_hash != context_hash:
            self.miss_count += 1
            return None
        
        self.hit_count += 1
        entry.access_count += 1
        entry.last_accessed = time.time()
        
        return entry.result
    
    async def set(
        self,
        key: str,
        result: str,
        ttl: Optional[int] = None,
        context_hash: Optional[str] = None,
        cost_saved: float = 0.0
    ) -> None:
        """Cache a result."""
        # Evict if at capacity
        if len(self.cache) >= self.max_size:
            await self._evict_lru()
        
        self.cache[key] = CacheEntry(
            result=result,
            created_at=time.time(),
            expires_at=time.time() + (ttl or self.default_ttl),
            context_hash=context_hash,
            cost_saved=cost_saved
        )
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern."""
        to_remove = [
            key for key in self.cache
            if re.match(pattern, key)
        ]
        
        for key in to_remove:
            del self.cache[key]
        
        return len(to_remove)
    
    async def _evict_lru(self) -> None:
        """Evict least recently used entries."""
        if not self.cache:
            return
        
        # Sort by last access time
        sorted_entries = sorted(
            self.cache.items(),
            key=lambda x: x[1].last_accessed
        )
        
        # Remove bottom 10%
        to_remove = len(sorted_entries) // 10 or 1
        for key, _ in sorted_entries[:to_remove]:
            del self.cache[key]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self.hit_count + self.miss_count
        hit_rate = self.hit_count / total_requests if total_requests > 0 else 0
        
        total_cost_saved = sum(e.cost_saved for e in self.cache.values())
        
        return {
            "size": len(self.cache),
            "hit_count": self.hit_count,
            "miss_count": self.miss_count,
            "hit_rate": hit_rate,
            "total_cost_saved": total_cost_saved
        }


@dataclass
class CacheEntry:
    result: str
    created_at: float
    expires_at: float
    context_hash: Optional[str] = None
    cost_saved: float = 0.0
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
```

---

## 7. Integration Matrix

### Pattern Compatibility Matrix

```
┌────────────────────┬────────────┬─────────┬────────────┬─────────┬─────────┬──────────┐
│                    │ Agent      │ Parallel│ Bidir      │ Shared  │ Quality │ Cost     │
│                    │ Specialize │ Execute │ Communicate│ Context │ Route   │ Optimize │
├────────────────────┼────────────┼─────────┼────────────┼─────────┼─────────┼──────────┤
│ Agent Specialize   │     -      │   ✓✓    │     ✓✓     │   ✓✓    │   ✓✓✓   │    ✓✓    │
│ Parallel Execute   │    ✓✓      │    -    │     ✓✓✓    │   ✓✓    │    ✓    │    ✓✓✓   │
│ Bidir Communicate  │    ✓✓      │  ✓✓✓    │      -     │  ✓✓✓    │    ✓    │     ✓    │
│ Shared Context     │    ✓✓      │   ✓✓    │    ✓✓✓     │    -    │   ✓✓    │     ✓    │
│ Quality Route      │   ✓✓✓      │    ✓    │      ✓     │   ✓✓    │    -    │   ✓✓✓    │
│ Cost Optimize      │    ✓✓      │  ✓✓✓    │      ✓     │    ✓    │  ✓✓✓    │     -    │
└────────────────────┴────────────┴─────────┴────────────┴─────────┴─────────┴──────────┘

Legend: ✓ = Compatible, ✓✓ = Synergistic, ✓✓✓ = Highly Synergistic
```

### Recommended Combinations

| Use Case | Primary Pattern | Supporting Patterns |
|----------|----------------|---------------------|
| **Development Flow** | Agent Specialization | Quality Routing, Shared Context |
| **Code Review** | Parallel Execution | Agent Specialization, Cost Optimization |
| **Debugging** | Bidirectional Communication | Shared Context, Quality Routing |
| **Architecture Planning** | Agent Specialization | Quality Routing (powerful tier) |
| **Quick Lookups** | Cost Optimization | Quality Routing (fast tier), Caching |
| **Comprehensive Analysis** | Parallel Execution | All patterns |

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Agent Registry & Basic Classification                        │
│    - Define core agent profiles                                 │
│    - Pattern-based intent matching                              │
│    - Fallback routing                                           │
│                                                                 │
│ 2. Event Bus Infrastructure                                     │
│    - Publish/subscribe system                                   │
│    - Session-scoped events                                      │
│    - Basic progress reporting                                   │
│                                                                 │
│ 3. Shared Context Store                                         │
│    - File-based persistence                                     │
│    - Basic sync operations                                      │
│    - Context injection for agents                               │
│                                                                 │
│ Deliverable: Voice can route to appropriate agents with         │
│              basic progress feedback                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Intelligence (Week 3-4)

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Intelligence                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Quality-Based Routing                                        │
│    - Complexity analysis engine                                 │
│    - Model tier configuration                                   │
│    - Dynamic tier adjustment                                    │
│                                                                 │
│ 2. Cost Optimization                                            │
│    - Budget tracking system                                     │
│    - Cost-aware execution                                       │
│    - Basic caching                                              │
│                                                                 │
│ 3. Enhanced Classification                                      │
│    - Semantic intent matching                                   │
│    - Context-aware routing                                      │
│    - Routing analytics                                          │
│                                                                 │
│ Deliverable: Intelligent routing with cost awareness            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Advanced Features (Week 5-6)

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Advanced Features                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Parallel Execution                                           │
│    - Task decomposition engine                                  │
│    - Parallel orchestrator                                      │
│    - Result combination                                         │
│                                                                 │
│ 2. Bidirectional Communication                                  │
│    - Voice interjection system                                  │
│    - Approval gates                                             │
│    - Real-time progress streaming                               │
│                                                                 │
│ 3. Session Continuity                                           │
│    - Conversation summarization                                 │
│    - Session recovery                                           │
│    - Memory synchronization                                     │
│                                                                 │
│ Deliverable: Full-featured voice-agent integration              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Optimization (Week 7-8)

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Optimization                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Speculative Execution                                        │
│    - Follow-up prediction                                       │
│    - Background pre-computation                                 │
│    - Result caching strategy                                    │
│                                                                 │
│ 2. Request Batching                                             │
│    - Batch identification                                       │
│    - Combined execution                                         │
│    - Result distribution                                        │
│                                                                 │
│ 3. Adaptive Learning                                            │
│    - Routing feedback loop                                      │
│    - Quality scaling                                            │
│    - Cost optimization tuning                                   │
│                                                                 │
│ 4. Performance Tuning                                           │
│    - Latency optimization                                       │
│    - Cache warming                                              │
│    - Load balancing                                             │
│                                                                 │
│ Deliverable: Production-ready, optimized system                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Integration Principles

1. **Specialize Deeply**: Route to expert agents rather than generalists for better results
2. **Execute in Parallel**: Decompose complex requests for faster response times
3. **Communicate Bidirectionally**: Keep users informed with proactive updates
4. **Share Context**: Maintain memory across sessions and between systems
5. **Route by Quality**: Match model power to task complexity
6. **Optimize Costs**: Use caching, batching, and tier selection to minimize spend

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Routing Accuracy | >85% | User corrections / total routes |
| Response Latency | <3s (simple), <30s (complex) | P95 response time |
| Cost per Session | <$0.50 | Total API cost / sessions |
| Cache Hit Rate | >40% | Cache hits / total requests |
| User Satisfaction | >4.5/5 | Post-session surveys |
| Parallel Speedup | >2x | Sequential time / parallel time |

### Open Questions

1. How to handle agent unavailability gracefully?
2. What's the optimal batch window for cost vs. latency?
3. How to prevent context bloat in long sessions?
4. Should speculative execution be user-configurable?
5. How to balance parallel execution cost vs. speed?
