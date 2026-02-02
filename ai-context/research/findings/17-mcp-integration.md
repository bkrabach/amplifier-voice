# MCP Integration with OpenAI Realtime API

**Research Date:** January 31, 2026  
**Status:** Active Development  
**Confidence:** High (based on official documentation and OpenAI cookbooks)

## Research Summary

Model Context Protocol (MCP) is an open standard introduced by Anthropic (November 2024) for connecting AI applications to external tools and data sources. OpenAI has adopted MCP across its platform, including support in the Agents SDK which can be used with the Realtime API for voice applications. The integration enables standardized tool calling, reusable integrations, and better security isolation compared to native function calling.

---

## 1. MCP Basics

### What is Model Context Protocol?

MCP is an open-source standard for connecting AI applications to external systems. Think of it as a "USB-C port for AI" - a standardized way to connect AI applications to:

- **Data sources** (databases, files, APIs)
- **Tools** (search engines, calculators, custom functions)
- **Workflows** (specialized prompts, orchestration)

### Core Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Client     │────▶│   MCP Server    │────▶│ External System │
│ (Claude/OpenAI) │◀────│   (Protocol)    │◀────│  (DB/API/Tool)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │    JSON-RPC 2.0       │
        │    over transport     │
        └───────────────────────┘
```

### MCP Server Capabilities

MCP servers expose three primary primitive types:

| Primitive | Description | Example |
|-----------|-------------|---------|
| **Tools** | Executable functions the model can call | Database queries, API calls |
| **Resources** | Read-only data sources | Files, configurations |
| **Prompts** | Reusable prompt templates | Specialized instructions |

### Transport Mechanisms

MCP supports multiple transport protocols:

1. **stdio** - Process-based communication via stdin/stdout (local)
2. **SSE (Server-Sent Events)** - HTTP-based for remote servers
3. **Streamable HTTP** - Modern HTTP streaming transport
4. **Custom transports** - Protocol-agnostic, can be extended

**Source:** https://modelcontextprotocol.io/

---

## 2. OpenAI + MCP Support

### Announcement Timeline

- **November 2024:** Anthropic introduces MCP as open standard
- **March 2025:** OpenAI announces MCP support in Agents SDK
- **May 2025:** OpenAI adds remote MCP server support to Responses API
- **2025-2026:** MCP becomes de-facto standard, with 11,000+ servers available

### OpenAI MCP Integration Points

| Feature | MCP Support | Notes |
|---------|-------------|-------|
| Agents SDK (Python) | Full support | Local and remote servers |
| Agents SDK (JavaScript) | Full support | WebRTC + Realtime integration |
| Responses API | Remote MCP servers | Hosted tool execution |
| Realtime API | Via Agents SDK | Voice agents with tools |

### Hosted MCP Tools

OpenAI's Responses API supports "hosted" MCP tools where the API directly invokes remote MCP servers:

```javascript
import { hostedMcpTool } from '@openai/agents';

// Hosted tools push the round-trip into the model
const tool = hostedMcpTool({
  label: "my-mcp-server",
  url: "https://my-server.com/mcp"
});
```

**Source:** https://openai.github.io/openai-agents-js/guides/mcp/

---

## 3. Tool Integration with Realtime API

### Integration Architecture for Voice

The recommended pattern for MCP + Realtime API voice agents uses a "chained" approach:

```
┌──────────┐    ┌─────────┐    ┌─────────────┐    ┌───────────┐
│  Voice   │───▶│   STT   │───▶│   Agent     │───▶│    TTS    │
│  Input   │    │ (Whisper)│    │  (Planner)  │    │ (gpt-4o)  │
└──────────┘    └─────────┘    └──────┬──────┘    └───────────┘
                                      │
                               ┌──────▼──────┐
                               │ MCP Servers │
                               │ (Tools)     │
                               └─────────────┘
```

### OpenAI Agents SDK Realtime Classes

The JavaScript SDK provides dedicated classes for Realtime + MCP:

```javascript
import { 
  RealtimeAgent,
  RealtimeSession,
  OpenAIRealtimeWebRTC,
  OpenAIRealtimeWebSocket 
} from '@openai/agents/realtime';

// MCP integration with Realtime
import { MCPServerStdio, MCPServerSSE } from '@openai/agents';
```

### Example: Voice Agent with MCP Tools

From OpenAI's official cookbook:

```python
from agents import Agent
from agents.mcp import MCPServerSse, MCPServerStdio

async def create_voice_agent(mcp_servers: list[MCPServer]) -> Agent:
    """Create a voice agent with MCP tools"""
    return Agent(
        name="VoiceAssistant",
        instructions="""
        Use the tools provided to answer questions.
        - sqlite: for database lookups
        - rag_output: for knowledge retrieval
        - web_search: for general questions
        """,
        mcp_servers=mcp_servers,
        model="gpt-4.1-mini",  # Balance between speed and reasoning
    )

# Initialize MCP servers
async with MCPServerSse(
    name="RAG Server",
    params={"url": "http://localhost:8000/sse"}
) as search_server:
    async with MCPServerStdio(
        params={"command": "uvx", "args": ["mcp-server-sqlite", "--db-path", "./data.db"]}
    ) as sql_server:
        agent = await create_voice_agent([search_server, sql_server])
```

**Source:** https://developers.openai.com/cookbook/examples/partners/mcp_powered_voice_agents/mcp_powered_agents_cookbook

---

## 4. Context Sharing via MCP

### Dynamic Context Management

MCP enables dynamic context injection through:

1. **Resources** - Expose documents, configurations as context
2. **RAG Integration** - Vector store queries via MCP tools
3. **Session State** - Maintain conversation context across tools

### Example: RAG as MCP Tool

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Context Server")

@mcp.tool()
def generate_rag_output(query: str) -> str:
    """Retrieve context from knowledge base"""
    results = client.vector_stores.search(
        vector_store_id=vector_store_id,
        query=query,
        rewrite_query=True,
    )
    return summarize_results(results)

@mcp.resource("config://settings")
def get_settings() -> str:
    """Expose configuration as resource"""
    return json.dumps(app_settings)
```

---

## 5. Implementation Patterns

### Pattern 1: Local MCP Servers (Development)

```python
# stdio transport - client spawns server process
async with MCPServerStdio(
    cache_tools_list=True,
    params={
        "command": "python",
        "args": ["my_mcp_server.py"]
    }
) as server:
    agent = Agent(mcp_servers=[server])
```

### Pattern 2: Remote MCP Servers (Production)

```python
# SSE transport - server runs independently
async with MCPServerSse(
    name="Production Server",
    params={
        "url": "https://mcp.example.com/sse",
        "timeout": 15.0
    }
) as server:
    agent = Agent(mcp_servers=[server])
```

### Pattern 3: Hosted MCP (OpenAI Managed)

```javascript
// OpenAI invokes the MCP server directly
const agent = new Agent({
  tools: [
    hostedMcpTool({
      label: "github",
      url: "https://mcp.github.com/sse"
    })
  ]
});
```

### Pattern 4: Multiple MCP Servers

```python
# Combine multiple specialized servers
servers = [
    MCPServerStdio(params={"command": "mcp-server-sqlite"}),
    MCPServerSse(params={"url": "http://localhost:8000/sse"}),
    MCPServerStdio(params={"command": "mcp-server-github"}),
]

agent = Agent(
    mcp_servers=servers,
    instructions="Use appropriate tools based on the query type"
)
```

---

## 6. Benefits vs Native Function Calling

### Comparison Table

| Aspect | Native Function Calling | MCP |
|--------|------------------------|-----|
| **Architecture** | Embedded in API request | Client-server separation |
| **Reusability** | Per-application | Cross-application |
| **Portability** | Vendor-specific | Provider-agnostic |
| **Security** | Application-level | Server-level isolation |
| **Maintenance** | Coupled to app code | Independent deployment |
| **Ecosystem** | Custom per integration | 11,000+ prebuilt servers |

### When to Use MCP

**Use MCP when:**
- Building production voice agents
- Need reusable tool integrations
- Require security isolation (credentials stay on server)
- Plan to switch AI providers
- Want to leverage existing MCP servers

**Use native function calling when:**
- Building simple prototypes
- Only 2-3 custom functions needed
- Single provider, single application
- Minimal latency requirements

### Security Advantages

```python
# Native function calling - credentials in app
def get_database_records(query):
    db_password = os.getenv("DATABASE_PASSWORD")  # Exposed
    return connection.execute(query)

# MCP - credentials isolated on server
@mcp.tool()
async def get_database_records(query: str):
    # Credentials never leave server
    connection = connect_to_db(password=SERVER_DB_PASSWORD)
    return execute_query(connection, query)
```

**Source:** https://www.descope.com/blog/post/mcp-vs-function-calling

---

## 7. Limitations & Current State

### Current Limitations

| Limitation | Description | Mitigation |
|------------|-------------|------------|
| **Latency** | Extra hop to MCP server | Use hosted tools, local servers |
| **Complexity** | More infrastructure | Start with stdio, graduate to SSE |
| **Maturity** | Still evolving | Follow spec updates |
| **Realtime-specific** | No direct Realtime API MCP support | Use Agents SDK wrapper |

### Security Concerns

1. **Prompt Injection**
   - Malicious instructions in external content
   - Can manipulate tool calls
   - Mitigation: Input validation, output sanitization

2. **Tool Poisoning**
   - Malicious tool descriptions
   - Can mislead agents into unsafe actions
   - Mitigation: Tool source verification, sandbox execution

3. **Credential Exposure**
   - Misconfigured servers may leak secrets
   - Mitigation: OAuth 2.1, least privilege, credential rotation

### Best Practices

```python
# 1. Validate tool sources
MCP_TRUSTED_SERVERS = ["https://verified-mcp.example.com"]

# 2. Implement rate limiting
@mcp.tool()
@rate_limit(calls=100, period=60)
async def sensitive_tool(query: str):
    ...

# 3. Log all tool invocations
@mcp.tool()
async def audited_tool(context: dict, query: str):
    audit_log(user=context["user"], tool="audited_tool", args=query)
    ...

# 4. Use role-based access
@mcp.tool()
async def admin_tool(context: dict, query: str):
    if context.get("user_role") != "admin":
        raise PermissionError("Admin access required")
    ...
```

**Sources:** 
- https://medium.com/@ckekula/model-context-protocol-mcp-and-its-limitations-4d3c2561b206
- https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp

---

## 8. Implementation Recommendations for Amplifier Voice

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Amplifier Voice App                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  WebRTC     │  │  Realtime   │  │   OpenAI Agents     │ │
│  │  Transport  │──│  Session    │──│   SDK (MCP Host)    │ │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘ │
└───────────────────────────────────────────────┼─────────────┘
                                                │
                    ┌───────────────────────────┼───────────────┐
                    │                           │               │
              ┌─────▼─────┐  ┌─────────────┐  ┌─▼───────────┐  │
              │ Local MCP │  │ Remote MCP  │  │ Hosted MCP  │  │
              │ (stdio)   │  │ (SSE)       │  │ (OpenAI)    │  │
              └───────────┘  └─────────────┘  └─────────────┘  │
                    │               │               │          │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐    │
              │ File Sys  │  │ Custom    │  │ GitHub/   │    │
              │ SQLite    │  │ RAG/Tools │  │ Slack     │    │
              └───────────┘  └───────────┘  └───────────┘    │
```

### Implementation Steps

1. **Phase 1: Basic Integration**
   - Use OpenAI Agents SDK with Realtime transport
   - Add local MCP servers (stdio) for development
   - Implement basic tool calling

2. **Phase 2: Production Hardening**
   - Deploy remote MCP servers (SSE/HTTP)
   - Add authentication (OAuth 2.1)
   - Implement audit logging

3. **Phase 3: Advanced Features**
   - Multi-server orchestration
   - Dynamic tool discovery
   - Context caching and optimization

---

## Key Resources

### Official Documentation
- MCP Specification: https://modelcontextprotocol.io/
- OpenAI Agents SDK MCP Guide: https://openai.github.io/openai-agents-js/guides/mcp/
- OpenAI Voice Cookbook: https://developers.openai.com/cookbook/examples/partners/mcp_powered_voice_agents/

### Code Examples
- OpenAI Realtime Agents: https://github.com/openai/openai-realtime-agents
- MCP Server Registry: https://mcpmarket.com/

### Security Resources
- MCP Auth Specification: https://www.descope.com/blog/post/mcp-auth-sdk
- Microsoft MCP Security Guide: https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp

---

## Conclusion

MCP provides a robust, standardized way to integrate external tools with OpenAI's Realtime API for voice applications. While it adds some architectural complexity compared to native function calling, the benefits of reusability, security isolation, and ecosystem support make it the recommended approach for production voice agents.

The OpenAI Agents SDK provides first-class MCP support that can be combined with the Realtime API through the voice pipeline architecture, enabling sophisticated voice agents with access to databases, RAG systems, and external APIs.
