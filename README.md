# Ryft - Multi-Provider AI Code Assistant

A lean, fast AI code assistant that works with any LLM provider. Supports OpenAI, Anthropic Claude, Google Gemini, **Ollama open-source models**, and OpenAI-compatible APIs. Combines composable modes, intelligent MCP integration, real-time token budgeting, and browser automation into a unified CLI.

**Key Features:**

- 🚀 **Multi-provider LLM support** - OpenAI, Anthropic Claude, Google Gemini, Ollama (open-source), and compatible APIs
- 💰 **Use free open-source models** - Ollama support for local, privacy-respecting inference
- 🎨 Composable modes (coder, browser-surff, debugger)
- 🔗 Auto-discovered MCP servers with on-demand spawning
- 🌐 Browser automation with session state persistence
- 💰 Smart token budgeting with soft warnings
- 💾 Configuration management (file + CLI precedence)
- ⚡ Fast startup with lazy initialization
- 🛠️ **Integrated Skills & Tools System** - Models discover, understand, and invoke tools with automatic result feedback

## Build & Setup

### Prerequisites

- **Node.js**: ≥20.0.0 ([download](https://nodejs.org/))
- **npm**: ≥10.0.0 (comes with Node.js)
- **Git**: For cloning the repository
- **macOS/Linux/Windows**: All supported (Chrome binary path may differ on Windows)

### Step 1: Clone the Repository

```bash
git clone <repository-url> ryft
cd ryft
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages:

- `tsx` - TypeScript execution
- `chalk` - Terminal colors
- `commander` - CLI parsing
- `js-tiktoken` - Token counting
- `typescript` - Type checking

### Step 3: Choose Your Installation

#### Option A: Global Install (Recommended for end users)

```bash
npm link

# Now available globally as 'ryft'
ryft --help
ryft
```

#### Option B: Development Mode (for developers)

```bash
# Either of these works:
npm start
npm run typecheck  # Type checking only
```

### Step 4: Verify Installation

Test that the installation works:

```bash
# Check command exists
which ryft

# Check help works
ryft --help

# Check CLI starts
ryft --version  # (if supported)
```

### Step 5: Set Up LLM Provider

Choose your LLM provider (OpenAI, Anthropic Claude, Google Gemini, **Ollama**, or compatible):

```bash
# For OpenAI:
export OPENAI_API_KEY=sk-your-key-here

# For Anthropic Claude:
export ANTHROPIC_API_KEY=sk-ant-...

# For Google Gemini:
export GOOGLE_API_KEY=...

# For Ollama (local, free, open-source):
export OLLAMA_MODEL=llama2

# Or set in config file (~/.ryftrc):
echo '{"provider": "ollama", "model": "llama2"}' > ~/.ryftrc
```

### Step 6: Test with a Simple Query

```bash
ryft

ryft [openai/gpt-4o]> /help
ryft [openai/gpt-4o]> /config view
```

## Installation

### Quick Install (One-liner)

If you already have Node.js ≥20 and an LLM provider configured:

```bash
git clone <repo> ryft && cd ryft && npm install && npm link && export OPENAI_API_KEY=sk-... && ryft
# Or: export ANTHROPIC_API_KEY=sk-ant-... && ryft
# Or: export OLLAMA_MODEL=llama2 && ryft
```

### Global Install (Recommended)

```bash
# Clone and install globally
git clone <repo> ryft
cd ryft
npm install
npm link

# Now use ryft from anywhere
ryft
```

### Or: Direct Development Mode

```bash
cd /path/to/ryft
npm install

# Set your LLM provider
export OLLAMA_MODEL=llama2  # Use free local model
# OR: export OPENAI_API_KEY=sk-...

npm start
```

## Quick Start

```bash
# Start interactive REPL
$ ryft

🤖 Ryft CLI v0.1.0
Model: openai/gpt-4o

ryft [openai/gpt-4o]> What does this function do?
<paste code>

ryft [openai/gpt-4o]> /help
```

## Usage

### Chat

Simply type queries. Ryft processes them using current model and active modes:

```bash
ryft> Analyze this TypeScript code
<paste code>

ryft> Generate unit tests

ryft> Debug this edge case
```

### Key Commands

| Command                   | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `/mode <name>`            | Activate mode(s): `coder`, `browser-surff`, `debugger` |
| `/model <id>`             | Switch model (gpt-4o, gpt-4, etc.)                     |
| `/config view`            | Show all settings                                      |
| `/config set <key> <val>` | Update config                                          |
| `/tokens`                 | Show token usage breakdown                             |
| `/help`                   | List all commands                                      |
| `exit`                    | Close session                                          |

### Modes

```bash
# Default coding mode
ryft> /mode coder

# Add browser automation
ryft> /mode browser-surff

# Use all modes
ryft> /mode coder,browser-surff,debugger
```

### Token Budgeting

```bash
# Quick check
ryft> /tokens
🟢 45/4096 tokens

# Detailed breakdown
ryft> /tokens detailed
Token Budget Breakdown:
  coder:    120 tokens (5 entries)
  browser:  45 tokens (2 entries)
  other:    80 tokens (3 entries)
  Remaining: 3851 tokens
```

### Configuration

Settings saved to `~/.ryftrc` (user) or `.ryft.json` (workspace). Supports all LLM providers:

```bash
# OpenAI
ryft> /config set provider openai
ryft> /config set model gpt-4o

# Anthropic Claude
ryft> /config set provider anthropic
ryft> /config set model claude-3-5-sonnet

# Google Gemini
ryft> /config set provider google
ryft> /config set model gemini-pro

# Ollama (local models)
ryft> /config set provider ollama
ryft> /config set model llama2

# View all config
ryft> /config view
```

## Environment Setup

Configure your LLM provider. Multiple providers supported:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
export GOOGLE_API_KEY=...

# Ollama (free, open-source, local)
export OLLAMA_MODEL=llama2

# Or use config file (~/.ryftrc)
echo '{"provider": "ollama", "model": "llama2"}' > ~/.ryftrc

# Or in REPL
ryft> /config set model ollama/llama2
```

## Using Ollama (Open-Source Models)

Run local LLMs with Ollama for privacy and cost savings:

```bash
# Install Ollama: https://ollama.ai

# Pull a model
ollama pull llama2
ollama pull mistral  # Lighter, faster
ollama pull neural-chat  # Optimized for chat

# Use with Ryft
export OLLAMA_MODEL=llama2
ryft

# Ryft will automatically connect to local Ollama server
ryft [ollama/llama2]> Analyze this code
```

**Benefits of Ollama:**

- 🔐 **Privacy** - Models run locally, no data sent to cloud
- 💰 **Free** - No API costs
- ⚡ **Fast** - Local inference
- 📚 **Many models** - Llama 2, Mistral, Neural Chat, and more

## Features

### Browser Automation

```bash
ryft> /mode browser-surff

# First browser action spawns Chrome
ryft> Navigate to example.com and summarize
```

### Composable Modes

- **coder**: Code analysis, generation, testing
- **browser-surff**: URL navigation, tab management, DevTools
- **debugger**: Process inspection, debugging

### Smart Token Budgeting

- Default 4096 tokens per session
- Soft warnings at 70% and 90% (no hard limits)
- Detailed breakdown of token usage by phase

### MCP Server Integration

- Auto-discovered from mode packs
- Spawn on-demand (not at startup)
- Tool schemas compressed for efficiency

### Integrated Skills & Tools System (Phase 2 - NEW)

Ryft now provides **comprehensive tool integration** that enables AI models to discover, understand, and invoke specialized capabilities:

#### Multi-Channel Tool Access

1. **System Prompt Context** - Models see available tools as text descriptions in the system prompt
2. **Formal Tool Schemas** - Tools passed via OpenAI function calling API for structured declaration
3. **Tool Invocation** - Models can invoke tools using `<tool_use>` XML blocks
4. **Result Feedback** - Tool execution results automatically appended to conversation for multi-turn reasoning

#### How It Works

When you start a session, Ryft:

1. Discovers all skills and tools from active modes
2. Spawns MCP servers for skill invocation
3. Includes tool schemas in system prompt (text format)
4. Passes tools parameter to OpenAI/Claude API (structured format)
5. Extracts and executes `<tool_use>` blocks from model responses
6. Returns execution results to model for continued reasoning

#### Example Interaction

```bash
ryft> /mode coder
ryft> Analyze this code and fix any issues

# Model sees:
# - Available skills (in system prompt)
# - Available tools (via function calling)
# - Can invoke: <tool_use id="tool_1" name="invoke_skill" input='{"skill": "compact"}'></tool_use>

# Ryft automatically:
# - Extracts tool_use block
# - Executes the skill via MCP
# - Appends results to conversation
# - Model continues reasoning with results
```

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Model (GPT-4/Claude)                                    │
│ Receives: System Prompt + Tool Schemas + History        │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        ↓                    ↓
    System Prompt       Tools Parameter
    (Text Context)      (Structured API)
        │                    │
        └─────────┬──────────┘
                  ↓
        ┌─────────────────────┐
        │ REPL streams chat   │
        │ completion          │
        └────────────┬────────┘
                     ↓
        ┌─────────────────────┐
        │ Extract tool_use    │
        │ blocks from response│
        └────────────┬────────┘
                     ↓
        ┌─────────────────────────────┐
        │ ToolDispatcher executes     │
        │ tools via MCP servers       │
        └────────────┬────────────────┘
                     ↓
        ┌─────────────────────────────┐
        │ Format results              │
        │ Append to session history   │
        └─────────────────────────────┘
                     ↓
        ┌─────────────────────────────┐
        │ Model sees results,         │
        │ continues reasoning         │
        └─────────────────────────────┘
```

#### What This Enables

- ✅ Model understands available capabilities before responding
- ✅ Structured tool invocation via multiple formats (text + API)
- ✅ Automatic tool execution with result feedback
- ✅ Multi-turn conversations with tool context preservation
- ✅ Skills as first-class tools accessible to AI models
- ✅ Extensible architecture for adding new tools and skills

## Configuration Files

### Global Config (~/.ryftrc)

```json
{
  "model": "openai/gpt-4o",
  "apiKey": "sk-...",
  "defaultModes": ["coder"],
  "showTokens": true,
  "logLevel": "info"
}
```

### Workspace Config (.ryft.json)

```json
{
  "model": "openai/gpt-4-turbo",
  "defaultModes": ["coder", "browser-surff"]
}
```

## Development

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
npm test
```

### Project Structure

```
Ryft/
├── src/
│   ├── cli.ts              # REPL entry point
│   ├── config/             # Configuration system
│   ├── models/             # Model registry
│   ├── modes/              # Mode pack system
│   ├── mcp/                # MCP protocol & orchestration
│   ├── browser/            # Browser automation
│   ├── tokens/             # Token counting & budgeting
│   └── runtime/            # Session & persistence
├── packs/
│   ├── coder/              # Coder mode
│   ├── browser-surff/      # Browser mode
│   ├── debugger/           # Debugger mode
│   └── shared/             # Shared skills
├── bin/
│   └── ryft.js             # CLI entry point
└── package.json
```

## Troubleshooting

| Issue                     | Solution                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `ryft: command not found` | Run `npm link` from Ryft directory to install globally                     |
| `OPENAI_API_KEY not set`  | `export OPENAI_API_KEY=sk-...` or `/config set apiKey sk-...`              |
| Chrome won't start        | Set `export CHROME_BIN=/path/to/chrome`                                    |
| Port 9222 in use          | Kill existing Chrome: `lsof -i :9222 \| awk '{print $2}' \| xargs kill -9` |

## Learn More

- See [SKILL.md](SKILL.md) for detailed development guide
- Available models: gpt-4, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
