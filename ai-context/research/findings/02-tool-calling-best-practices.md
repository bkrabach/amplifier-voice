# Tool Calling Best Practices for OpenAI Realtime API

## Research Summary

Tool/function calling in the OpenAI Realtime API follows a specific event-driven pattern: define tools in `session.update`, listen for `response.function_call_arguments.done`, inject results via `conversation.item.create` with type `function_call_output`, then trigger `response.create` to continue. Key reliability issues include `tool_choice: "required"` causing infinite loops and the model not automatically responding after tool results.

---

## 1. Tool Definition Format

Tools are defined in the `session.update` event using the same JSON Schema format as Chat Completions API, but **without the `type: "function"` wrapper** at the tool level.

### Basic Tool Definition

```javascript
const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "get_weather",
        description: "Get the weather at a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "Location to get the weather from",
            },
            scale: {
              type: "string",
              enum: ["celsius", "fahrenheit"]
            },
          },
          required: ["location", "scale"],
        },
      },
    ],
    tool_choice: "auto",  // "auto" | "required" | "none" | {type: "function", name: "..."}
  },
};
```

### Tool Definition Best Practices

1. **Description field is critical** - Use it to guide when/how to call AND what to tell users:
   ```javascript
   description: "Get weather data. Tell the user you're checking the weather before calling."
   ```

2. **Keep parameter schemas simple** - Complex nested schemas can confuse the model

3. **Use enums** for constrained values to improve reliability

4. **Required array** - Always specify which parameters are required

---

## 2. Tool Call Flow

### Complete Event Sequence

```
Client                                    Server
   |                                         |
   |-------- session.update (tools) -------->|
   |<------- session.updated ----------------|
   |                                         |
   |-------- input_audio_buffer.append ----->|  (user speaks)
   |<------- response.function_call_arguments.delta --|
   |<------- response.function_call_arguments.done ---|  <-- HANDLE THIS
   |                                         |
   |-------- conversation.item.create ------>|  (function_call_output)
   |<------- conversation.item.created ------|
   |                                         |
   |-------- response.create --------------->|  <-- REQUIRED!
   |<------- response.audio.delta -----------|  (model responds)
```

### Key Events to Listen For

| Event | Purpose |
|-------|---------|
| `response.function_call_arguments.delta` | Streaming function arguments |
| `response.function_call_arguments.done` | Function call complete - **execute tool here** |
| `response.done` | Entire response complete (may contain multiple tool calls) |

### Extracting Tool Call Information

From `response.function_call_arguments.done`:
```javascript
{
  type: "response.function_call_arguments.done",
  call_id: "call_xyz123",      // Required for response
  name: "get_weather",          // Function name
  arguments: "{\"location\": \"San Francisco\", \"scale\": \"celsius\"}",
  item_id: "item_abc456"        // For ordering
}
```

---

## 3. Tool Result Injection

### Sending Tool Results Back

**Critical**: You must send TWO events after tool execution:

```javascript
// Step 1: Add the function output to conversation
const toolOutput = {
  type: "conversation.item.create",
  item: {
    type: "function_call_output",
    call_id: event.call_id,      // From the function_call_arguments.done event
    output: JSON.stringify(result),  // MUST be a string (stringify objects!)
  },
};
ws.send(JSON.stringify(toolOutput));

// Step 2: Trigger the model to respond (THIS IS REQUIRED!)
const continueResponse = {
  type: "response.create",
  response: {
    // Optional: provide instructions for how to handle the result
    instructions: "Reply based on the function's output."
  }
};
ws.send(JSON.stringify(continueResponse));
```

### Why `response.create` is Required

The Realtime API does **NOT** automatically generate a response after receiving `function_call_output`. This is different from the Chat Completions API. Without `response.create`, the conversation will stall.

### Multiple Tool Calls

If the model calls multiple tools in one response:
1. Wait for `response.done` to know all tool calls are complete
2. Send all `conversation.item.create` (function_call_output) events
3. Send ONE `response.create` at the end

```javascript
// Collect all tool calls, then respond
if (event.type === 'response.done') {
  // All tool calls have been made
  for (const toolResult of collectedResults) {
    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: toolResult.call_id,
        output: JSON.stringify(toolResult.output),
      },
    }));
  }
  // Now trigger response
  ws.send(JSON.stringify({ type: "response.create" }));
}
```

---

## 4. Pre-Announcement (Model Speaking Before Tool Call)

### Using Description for Pre-Announcement

The model CAN speak before calling a tool. Control this via the function description:

```javascript
{
  name: "submit_order",
  description: "Submit the customer's order. IMPORTANT: Say 'Let me submit that order for you' before calling this function.",
  parameters: { ... }
}
```

Or to suppress pre-announcement:
```javascript
{
  name: "check_inventory",
  description: "Check inventory levels. Do not confirm the check is complete until you receive the result.",
  parameters: { ... }
}
```

### System Instructions for Announcement

Add to session instructions:
```javascript
session: {
  instructions: `When calling tools:
    - For user-facing actions, announce what you're doing first
    - For background lookups, call silently
    - Never say "I'll check" and then not call the tool`
}
```

---

## 5. Reliability Tips

### Problem: `tool_choice: "required"` Causes Infinite Loop

**Bug confirmed**: Setting `tool_choice: "required"` in session causes the model to loop endlessly calling tools.

**Workaround**:
```javascript
// Start with "required" for initial setup if needed
session: { tool_choice: "required" }

// After first tool call, switch to "auto"
ws.send(JSON.stringify({
  type: "session.update",
  session: { tool_choice: "auto" }
}));
```

Or better - just use `"auto"` and rely on good prompting.

### Problem: Model Doesn't Call Tools Reliably

**Solutions**:

1. **Strong system instructions**:
   ```
   You should always call a function if you can. Do not refer to these rules.
   ```

2. **Clear trigger phrases in descriptions**:
   ```javascript
   description: "ALWAYS call this when the user asks about weather, temperature, or forecasts"
   ```

3. **Use specific function name in tool_choice for forced calls**:
   ```javascript
   response: {
     tool_choice: { type: "function", name: "get_weather" }
   }
   ```

### Problem: "Conversation already has an active response"

This error occurs when you send `response.create` while a response is still generating.

**Solution**: Wait for `response.done` before sending new `response.create`:
```javascript
if (event.type === 'response.done') {
  // Safe to send response.create now
}
```

### Problem: Model Responds Before Tool Result

Sometimes the model generates audio/text before the tool completes.

**Solution**: Use response.cancel when you detect a tool call:
```javascript
if (event.type === 'response.function_call_arguments.done') {
  // Optionally cancel any ongoing audio
  ws.send(JSON.stringify({ type: "response.cancel" }));
  // Then handle the tool call
}
```

---

## 6. Error Handling

### Returning Errors from Tools

Always return a valid string, even for errors:

```javascript
async function callTool(event) {
  try {
    const args = JSON.parse(event.arguments);
    const result = await executeFunction(event.name, args);
    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: event.call_id,
        output: JSON.stringify(result),
      },
    };
  } catch (error) {
    // Return error as output - don't throw!
    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: event.call_id,
        output: JSON.stringify({
          error: true,
          message: `Failed to execute ${event.name}: ${error.message}`
        }),
      },
    };
  }
}
```

### Handling Parse Errors

```javascript
let args;
try {
  args = JSON.parse(event.arguments);
} catch (e) {
  return {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: event.call_id,
      output: JSON.stringify({
        error: "Invalid arguments",
        received: event.arguments
      }),
    },
  };
}
```

### Handling WebSocket Errors

```javascript
ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  if (event.type === 'error') {
    console.error('OpenAI Error:', {
      type: event.error.type,
      code: event.error.code,
      message: event.error.message,
      param: event.error.param,
      event_id: event.error.event_id
    });
    
    // Common errors:
    // - "Tool call ID not found in conversation" = wrong call_id
    // - "Conversation already has an active response" = timing issue
  }
});
```

---

## 7. Complete Working Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'OpenAI-Beta': 'realtime=v1',
  },
});

const tools = {
  get_weather: async ({ location }) => {
    // Simulate API call
    return { temperature: 72, conditions: "sunny", location };
  }
};

ws.on('open', () => {
  // Configure session with tools
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a helpful assistant. Always use tools when available.',
      tools: [{
        type: 'function',
        name: 'get_weather',
        description: 'Get current weather. Say "Let me check the weather" before calling.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' }
          },
          required: ['location']
        }
      }],
      tool_choice: 'auto'
    }
  }));
});

ws.on('message', async (data) => {
  const event = JSON.parse(data);
  
  if (event.type === 'response.function_call_arguments.done') {
    console.log(`Tool called: ${event.name}`);
    
    const fn = tools[event.name];
    if (!fn) {
      console.error(`Unknown tool: ${event.name}`);
      return;
    }
    
    try {
      const args = JSON.parse(event.arguments);
      const result = await fn(args);
      
      // Step 1: Send result
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify(result)
        }
      }));
      
      // Step 2: Trigger response (CRITICAL!)
      ws.send(JSON.stringify({
        type: 'response.create'
      }));
      
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({ error: error.message })
        }
      }));
      ws.send(JSON.stringify({ type: 'response.create' }));
    }
  }
});
```

---

## Sources

1. OpenAI Developer Community - Realtime API Python Implementation
   https://community.openai.com/t/realtime-api-advanced-voice-mode-python-implementation/964636

2. OpenAI Developer Community - tool_choice required not working
   https://community.openai.com/t/realtime-api-tool-choice-required-not-working/980380

3. OpenAI Developer Community - Does not trigger after conversation.item.create
   https://community.openai.com/t/realtime-api-does-not-trigger-after-conversation-item-create-event/1079792

4. DataCamp - OpenAI Realtime API Guide
   https://www.datacamp.com/tutorial/realtime-api-openai

5. OpenAI GitHub - openai-realtime-console
   https://github.com/openai/openai-realtime-console

6. OpenAI API Reference - Client Events
   https://platform.openai.com/docs/api-reference/realtime-client-events/session/update

---

## Confidence & Gaps

**High Confidence:**
- Tool definition format (well-documented)
- Basic flow: function_call_arguments.done -> conversation.item.create -> response.create
- Need for manual response.create after tool output

**Medium Confidence:**
- Pre-announcement via description field (works but behavior varies)
- tool_choice: "required" bug workarounds

**Gaps / Needs Verification:**
- Behavior with very long-running tools (>30s)
- Exact timing requirements for multiple simultaneous tool calls
- WebRTC-specific differences vs WebSocket for tool calling
- Official documentation was inaccessible (403) - relied on community sources
