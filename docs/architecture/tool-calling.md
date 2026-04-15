# Tool Calling Architecture

How Ryft invokes and manages tools.

## Overview

Ryft uses a sophisticated tool calling system to enable AI models to invoke specialized capabilities.

## Architecture

```
User Query
    ↓
Model Receives:
  - System Prompt (with tool hints)
  - Tools Schemas (function calling format)
  - Conversation History
    ↓
Model Analyzes & Chooses Tools
    ↓
Model Invokes <tool_use> blocks:
  {
    "id": "tool_1",
    "name": "read_text",
    "input": { "filePath": "src/main.ts" }
  }
    ↓
Ryft Dispatcher:
  1. Extract tool_use blocks
  2. Route to handler
  3. Execute tool
  4. Collect results
    ↓
Format Results:
  {
    "tool_result": {
      "id": "tool_1",
      "content": "[file content]"
    }
  }
    ↓
Send Back to Model:
  - Model sees results
  - Continues reasoning
  - May invoke more tools
```

## Tool Registration

Tools are registered in this order:

1. **Built-in Tools** - File reading (always available)
2. **Mode Tools** - From active mode packs
3. **MCP Server Tools** - From spawned servers
4. **Custom Tools** - User-defined (future)

## Tool Dispatch

```
Tool Call Received
    ├─ Is it built-in?
    │  ├─ Yes: Execute directly
    │  │  └─ Return result
    │  │
    │  └─ Is it MCP?
    │     ├─ Server running?
    │     │  ├─ Yes: Call RPC
    │     │  └─ No: Spawn first
```

## See Also

- [Architecture Overview](./README.md)
- [MCP Integration](./mcp-integration.md)
- [Tools & Skills](../tools/README.md)
