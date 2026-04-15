# MCP Integration

Model Context Protocol server integration in Ryft.

## Overview

Ryft uses MCP (Model Context Protocol) to integrate specialized tools and capabilities via external servers.

## What is MCP?

The Model Context Protocol (MCP) is a standard for connecting AI models with external tools and data sources via JSON-RPC.

## How Ryft Uses MCP

### Server Discovery

Servers are defined in mode `pack.json` files:

```json
{
  "mcpServers": [
    {
      "id": "browser-surff",
      "name": "Browser Automation",
      "command": "node",
      "args": ["--loader=tsx", "src/browser/mcp-server.ts"]
    }
  ]
}
```

### On-Demand Spawning

```
User asks for browser task
    ├─ Is browser server running?
    │  ├─ Yes: Use existing
    │  │
    │  └─ No: Spawn
    │     ├─ Load pack.json
    │     ├─ Get spawn command
    │     ├─ Start process
    │     ├─ Connect via stdio
    │     └─ Register tools
```

### Tool Integration

```
MCP Server Tools
    ├─ Compressed for efficiency
    ├─ Included in system prompt
    ├─ Exposed via function calling
    └─ Callable by model
```

## Tool Schemas

### Full Schema (for registration)

```json
{
  "name": "take_screenshot",
  "description": "Take a screenshot of current page",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filename": { "type": "string" }
    }
  }
}
```

### Compressed Schema (for token efficiency)

```json
{
  "name": "take_screenshot",
  "description": "Take screenshot",
  "inputSchema": { "type": "object" }
}
```

## See Also

- [Architecture Overview](./README.md)
- [Tool Calling](./tool-calling.md)
- [Tools & Skills](../tools/README.md)
