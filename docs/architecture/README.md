# Architecture & Design

Understanding Ryft's internals and design.

## System Overview

Ryft is composed of several interconnected systems:

```
┌─────────────────────────────────────────┐
│         User Interface (REPL)           │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ↓                ↓
   ┌─────────┐    ┌──────────────┐
   │ Command │    │ Session      │
   │ Parser  │    │ Management   │
   └────┬────┘    └──────┬───────┘
        │                │
    ┌───┴────────────────┴──────┐
    ↓                           ↓
┌──────────────┐         ┌──────────────┐
│  Modes &     │         │  Token       │
│  Skills      │         │  Budgeting   │
└──────┬───────┘         └──────┬───────┘
       │                        │
   ┌───┴────────────────────────┴──────┐
   ↓                                    ↓
┌──────────────────────────────────────────┐
│     Tool Dispatcher & Execution          │
├──────────────────────────────────────────┤
│ • Built-in Tools (File Reading)          │
│ • MCP Servers (on-demand)                │
│ • Browser Automation                     │
└──────┬───────────────────────────────────┘
       │
   ┌───┴──────────────┬──────────────┬─────────────────┐
   ↓                  ↓              ↓                 ↓
┌─────────────────────────────────────────────────────────┐
│         External Integration                          │
│ • Multi-Provider LLMs                                 │
│   - OpenAI (GPT-4o, GPT-4)                            │
│   - Anthropic (Claude 3.5, 3)                         │
│   - Google (Gemini Pro)                               │
│   - Ollama (Local Models)                             │
│ • Chrome/Chromium Browser                            │
│ • Filesystem (read/write)                            │
│ • MCP Protocol Servers                               │
└─────────────────────────────────────────────────────────┘
```

## Core Modules

### CLI Entry Point (`src/cli.ts`)

- REPL initialization
- Command routing
- Session management
- Interactive prompt

### Configuration System (`src/config/`)

- Config file loading
- Environment variables
- CLI flag parsing
- Precedence resolution

### Mode System (`src/modes/`)

- Mode pack discovery
- Skill loading
- Multi-mode merging
- Mode activation

### MCP Integration (`src/mcp/`)

- Server discovery
- On-demand spawning
- Tool schema compression
- RPC communication

### Token Management (`src/tokens/`)

- Token counting
- Budget tracking
- Usage visualization
- Session persistence

### Browser Automation (`src/browser/`)

- Chrome lifecycle management
- Session state persistence
- DevTools communication
- Screenshot capture

### Runtime (`src/runtime/`)

- Session creation
- Message history
- Tool dispatch
- Results formatting

## Data Flow

### Processing a User Query

```
1. User Input
   ↓
2. CLI Parses Input
   ↓
3. Session Processing
   - Add message to history
   - Count tokens
   - Check budget (warning at 70%, 90%)
   ↓
4. Mode Activation
   - Discover skills
   - Load MCP servers (on-demand)
   - Prepare tool schemas
   ↓
5. API Call
   - Route to configured LLM provider
   - Support: OpenAI, Anthropic, Google, Ollama, compatible APIs
   - Send message with tools parameter
   - Include system prompt with skill descriptions
   - Stream response
   ↓
6. Tool Extraction
   - Parse streaming response
   - Extract tool_use blocks
   - Extract text content
   ↓
7. Tool Execution
   - Route to correct handler
   - Execute built-in or MCP tool
   - Collect results
   ↓
8. Result Formatting
   - Format tool outputs
   - Add to message history
   - Prepare for next iteration
   ↓
9. Send to Model
   - Send results back to model
   - Model reasons over results
   - Continue conversation
   ↓
10. Output Display
    - Stream text to terminal
    - Display formatting
    - Show token count
```

## Tool Dispatch System

### Built-in Tools (Always Available)

```
User Request
    ↓
Tool Dispatcher
    ├─ Is it a built-in tool?
    │  ├─ Yes: Execute directly
    │  │  └─ Return result
    │  │
    │  └─ No: Continue to MCP
    │
    └─ MCP Tool?
       ├─ Is server running?
       │  ├─ Yes: Call server
       │  └─ No: Spawn first
       ├─ Return result
```

### On-Demand MCP Spawning

```
Need MCP Tool
    ↓
Check if Server Running?
    ├─ Yes: Use existing
    │
    └─ No: Spawn
       ├─ Load pack.json
       ├─ Get spawn command
       ├─ Start process
       ├─ Connect via stdio
       └─ Register tools
       ↓
       Call Tool
       ↓
       Return Result
```

## Configuration Precedence

Lower number = Higher priority:

1. **CLI Flags** - `ryft --model gpt-4o`
2. **Environment Variables** - `export OPENAI_API_KEY=...`
3. **Workspace Config** - `.ryft.json` in project root
4. **User Config** - `~/.ryftrc` in home directory
5. **Built-in Defaults** - Hardcoded values

## Token Budget System

### Tracking

```
Session Start
    ├─ Initialize: 0 tokens
    │
Each Operation
    ├─ Message added: +tokens
    ├─ Tools called: +tokens
    ├─ Results returned: +tokens
    │
Check Warning Points:
    ├─ 70% (once): Warn "token usage high"
    ├─ 90% (repeated): Warn "nearing limit"
    │
Session Continues
    ├─ No hard limit
    ├─ Responses may shorten
    └─ Can use /compact to reset
```

### Budget Calculation

```
Token count includes:
- User message
- System prompt
- Mode skills text
- Tool schemas
- Conversation history
- MCP tool descriptions

Total ≤ 4096 tokens (default)
```

## File Reading Tools Implementation

### Tool Registration

```
Session Creation
    ├─ Create Tool Registry
    ├─ Load Built-in Tools
    │  ├─ read_text
    │  ├─ list_dir
    │  ├─ read_multiple
    │  └─ get_file_info
    ├─ Make available immediately
```

### File Tool Execution

```
Tool Call: read_text("file.ts")
    ├─ Get working directory
    ├─ Resolve path
    ├─ Check size limit
    ├─ Read file
    ├─ Return content
```

## Working Directory Resolution

### Priority Order

```
Tool Call
    ├─ Check RYFT_ORIGINAL_CWD env var
    │  ├─ If set: Use it
    │  └─ If not: Continue
    │
    ├─ Check --cwd CLI flag
    │  ├─ If set: Use it
    │  └─ If not: Continue
    │
    ├─ Use process.cwd()
```

## Performance Optimizations

### Lazy Initialization

- Modes load only when used
- MCP servers spawn on-demand
- Browser only launches when needed
- Config files cached

### Token Efficiency

- Tool schemas compressed
- Tool descriptions abbreviated
- Unnecessary context pruned
- History can be compacted

### Streaming Response

- Text streamed immediately
- Tools extracted and executed in parallel
- Results appended as received
- No buffering until complete

## Extending Ryft

### Add a Skill

1. Create `packs/<mode>/skills/<skill>/SKILL.md`
2. Update `pack.json` to include skill
3. Skill available automatically

### Add a Mode

1. Create `packs/<new-mode>/`
2. Create `pack.json` with mode definition
3. Create `skills/` directory
4. Auto-discovered by pack loader

### Add an MCP Server

1. Define in mode's `pack.json`:
   ```json
   {
     "mcpServers": [
       {
         "id": "server-name",
         "command": "node",
         "args": ["path/to/server.ts"]
       }
     ]
   }
   ```
2. Server auto-discovered
3. Spawned on first tool use

## See Also

- [Tool Calling Architecture](./tool-calling.md) - Deep dive into tool invocation
- [MCP Integration](./mcp-integration.md) - Model Context Protocol details
- [Development Guide](../skills/development.md) - Building extensions
