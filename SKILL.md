# Ryft CLI - Development Skill Guide

## Overview

This skill documents how to build, run, and deploy the Ryft CLI - a lean, OpenAI-native AI code assistant with composable modes, MCP server support, token budgeting, and browser automation.

## Prerequisites

- **Node.js**: ≥20.0.0 ([download](https://nodejs.org/))
- **npm**: ≥10.0.0 (comes with Node.js)
- **Git**: For version control
- **Chrome/Chromium**: For browser automation features (optional, needed for browser-surff mode)
- **OpenAI API Key**: For model inference (get from [OpenAI](https://platform.openai.com/api-keys))

## Complete Build & Setup Guide

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd ryft
```

### Step 2: Install Node Dependencies

```bash
npm install
```

This installs:

- **typescript** - Type checking
- **tsx** - TypeScript execution engine
- **chalk** - Terminal styling
- **commander** - CLI framework
- **js-tiktoken** - Token counting

### Step 3: Verify Installation

```bash
# Check Node.js version
node --version          # Should be ≥20.0.0

# Check npm version
npm --version           # Should be ≥10.0.0

# Check installed packages
npm list --depth=0
```

### Step 4: Choose Developer Setup

#### Development Mode (Fastest)

```bash
# Run directly from source
npm start
```

#### Global Command for Testing

```bash
# Link globally (create /opt/homebrew/bin/ryft symlink)
npm link

# Test from anywhere
ryft --help
ryft
```

#### Unlink Global Command

```bash
npm unlink ryft
```

### Step 5: Setup API Key

```bash
# Set environment variable (temporary, current session only)
export OPENAI_API_KEY=sk-your-key-here

# OR create user config (permanent)
mkdir -p ~/.config
echo '{"apiKey": "sk-your-key-here"}' > ~/.ryftrc

# OR set in local project (workspace-only)
echo '{"apiKey": "sk-your-key-here"}' > .ryft.json
```

### Step 6: Verify Build Works

```bash
# Type checking (recommended before each commit)
npm run typecheck

# Should output nothing if successful
# (TypeScript validates without emitting)
```

## Installation

### Recommended: Global Installation

```bash
cd /path/to/ryft
npm install
npm link

# Now available anywhere as `ryft`
ryft --help
```

### Development Mode

```bash
cd /path/to/ryft
npm install
npm start
```

### Verify Installation

```bash
ryft --help
npm run typecheck
```

## Building

### Type Checking

```bash
npm run typecheck
```

Validates the entire TypeScript codebase without emitting output. No compilation artifacts produced - just validation.

### Development Build (Hot Reload)

```bash
npm start
```

Uses tsx to run TypeScript directly from source files. Ideal for development with instant changes.

### Production Build

The project uses tsx which handles TypeScript + ESM at runtime. For production distribution:

#### Option 1: Compile to JavaScript

```bash
# Compile to dist/ directory
npx tsc --declaration --outDir dist --skipLibCheck

# Point bin/ryft.js to dist output:
# Edit bin/ryft.js to use dist/src/cli.js instead
```

#### Option 2: Ship with npm (Recommended)

```bash
# Just publish the source - npm users will have tsx available
npm publish

# Users install and run via:
npm install -g ryft
ryft
```

#### Option 3: Bundle with pkg (Standalone Executable)

```bash
# Install pkg
npm install -D pkg

# Create standalone executable
npx pkg . --targets node20-macos-arm64
```

# Then point `npm start` or bin/ryft.js to dist/

````

## Running the Project

### Start Interactive REPL
```bash
ryft
````

### With Arguments

```bash
ryft --model gpt-4o
ryft --logLevel debug
```

```
/mode <name>              - Switch modes (coder, browser-surff, debugger)
/model <id>               - Switch model (gpt-4, gpt-4o, etc.)
/config                   - View current configuration
/config set <key> <val>   - Update config (model, defaultModes, etc.)
/tokens                   - Show token usage breakdown
/help                     - Show all commands
exit                      - Quit REPL
```

### Example Session

```bash
$ ryft

🤖 Ryft CLI v0.1.0
Model: openai/gpt-4o

ryft [openai/gpt-4o]> /mode browser-surff
✓ Modes updated: coder, browser-surff

ryft [openai/gpt-4o]> /tokens
Token Budget Breakdown:
  Total: 45 / 4096 (1%)

ryft [openai/gpt-4o]> /config view
Current Configuration:
  model         openai/gpt-4o
  apiKey        [SET]
  defaultModes  coder
  logLevel      info

ryft [openai/gpt-4o]> <your query here>
```

## Configuration

### Config Files (in order of precedence, highest to lowest)

1. **CLI Flags** - `npm start --model=gpt-4`
2. **Environment Variables** - `OPENAI_API_KEY=...`
3. **Workspace Config** - `.ryft.json` in project root
4. **User Config** - `~/.ryftrc` in home directory
5. **Defaults** - Built-in hardcoded values

### Example `.ryft.json`

```json
{
  "model": "openai/gpt-4o",
  "apiKey": "sk-...",
  "defaultModes": ["coder", "browser-surff"],
  "defaultMemoryMode": "normal",
  "showTokens": true,
  "logLevel": "info"
}
```

### Config Fields

- `model`: Model ID (e.g., `openai/gpt-4o`, `openai/gpt-4-turbo`)
- `apiKey`: OpenAI API key
- `provider`: Provider name (`openai`, etc.)
- `baseUrl`: Custom API endpoint (optional)
- `proxyUrl`: HTTP proxy for requests (optional)
- `defaultModes`: Comma-separated modes to load on startup
- `defaultMemoryMode`: Memory mode (`normal`, `basic`)
- `showTokens`: Show token indicators in REPL (`true`/`false`)
- `logLevel`: Log verbosity (`debug`, `info`, `warn`, `error`)

## Architecture

### Mode Packs

Modes are auto-discovered from `Ryft/packs/<mode>/`:

- **coder**: Code analysis and generation (default)
- **browser-surff**: Browser automation via Chrome remote debugging
- **debugger**: Debugging support
- **shared**: Shared skills across modes

Each pack contains:

- `pack.json`: Mode definition + MCP server config
- `skills/`: Markdown files with capabilities

### MCP Servers

Composable AI capabilities registered per mode:

- Auto-discovered from pack definitions
- Spawn on-demand when tools are first called
- Communicate via JSON-RPC stdio transport
- Tools compressed for token efficiency

### Token Budget

- Default: 4096 tokens per session
- Soft warnings at 70% (once), 90% (repeated)
- No hard limit - responses may be shortened
- Detailed breakdown available via `/tokens`

### Browser Automation

Activate browser mode to enable web automation:

```bash
ryft> /mode browser-surff
✓ Modes updated: coder, browser-surff

# Now you can ask Ryft to use the browser
ryft> Navigate to example.com and summarize the content

# First browser action spawns Chrome on port 9222
# Subsequent sessions restore previous URLs/tabs
```

## Modes Deep Dive

### Coder Mode

Default coding assistance mode with:

- Code analysis and generation skills
- Debugging capabilities
- Memory management

**Load**: `npm start` (auto-loads)

### Browser-Surff Mode

Browser automation with:

- URL navigation (`open_url`)
- Tab listing (`list_tabs`)
- DevTools access (`open_devtools`)

**Load**:

```bash
npm start  # In REPL: /mode browser-surff
```

**First browser action triggers:**

1. Spawns Chrome process on port 9222
2. Discovers browser MCP tools
3. Registers tools for LLM use

### Debugger Mode

Debugging support with:

- Process inspection
- Variable introspection
- Breakpoint management

**Load**: `/mode debugger` in REPL

## Skills

Skills are markdown files in `Ryft/packs/<mode>/skills/`:

### Structure

```markdown
# Skill Name

Description of capability

## Context

What this skill does

## Usage

How to invoke it
```

### Examples

- `coder/skills/javascript.md` - JavaScript/TypeScript analysis
- `browser-surff/skills/navigation.md` - URL navigation
- `shared/skills/memory.md` - Memory management

### Multi-Mode Merging

When multiple modes active:

- Skills merged by precedence order
- Deterministic conflict resolution
- Tool enable/disable lists respected

## MCP (Model Context Protocol)

### Discovery

Servers auto-discovered from mode pack definitions:

```json
{
  "mcpServers": [
    {
      "id": "browser-surff",
      "name": "Browser Surff",
      "command": "node",
      "args": ["--loader=tsx", "dist/src/browser/mcp-server.ts"]
    }
  ]
}
```

### Schema Compression

Tool schemas compressed for token efficiency:

- Description: First sentence only
- Input fields: Top 3 only
- Estimated: ~1 token per 4 characters

### Tool Dispatch

LLM tool calls dispatched directly:

```
LLM Response → Extract tool use → Find server → Call RPC → Format result
```

## Debugging

### Enable Debug Logging

```bash
# Via config
/config set logLevel debug

# Via environment
LOG_LEVEL=debug ryft

# Via CLI flag
ryft --logLevel=debug
```

### Inspect Session State

In REPL:

```
/config view       - Show all settings
/tokens            - Show token breakdown
/help              - List all commands
```

### Check MCP Server Status

Browser tools will only be available if browser mode active:

```
/mode browser-surff   # Register browser server
/tokens               # Should include browser tools
```

## Testing

### Type Checking

```bash
npm run typecheck
```

### Run Test Suite

```bash
npm test
```

(Currently minimal - manual validation recommended)

## Deployment

### Create Standalone Package

```bash
# Build TypeScript
tsc --declaration --outDir dist --skipLibCheck

# Package for npm
npm pack
```

### Publish to npm

```bash
npm publish
```

### Use from npm

```bash
npm install -g ryft
ryft
```

## Common Tasks

### Switch Models at Runtime

```
ryft> /model gpt-4o
✓ Model set to openai/gpt-4o (saved to ~/.ryftrc)
```

### Add Browser Automation

```
ryft> /mode browser-surff
✓ Modes updated: coder, browser-surff

# First browser tool call will spawn Chrome
ryft> Use the browser to navigate to example.com
```

### Save Configuration Permanently

```
ryft> /config set defaultModes coder,browser-surff,debugger
✓ Config updated (saved to ~/.ryftrc)

# Restart REPL and modes load automatically
```

### Monitor Token Usage

```bash
ryft --showTokens true

# In REPL
/tokens                      # Quick summary
/tokens detailed             # Full breakdown
```

## Troubleshooting

| Issue                    | Solution                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY not set` | `export OPENAI_API_KEY=sk-...` or `/config set apiKey sk-...`                                   |
| Chrome won't start       | Check Chrome installed at `/Applications/Google Chrome.app` or set `CHROME_BIN=/path/to/chrome` |
| Port 9222 already in use | Kill existing Chrome: `lsof -i :9222 \| grep -v COMMAND \| awk '{print $2}' \| xargs kill -9`   |
| Mode not loading         | Check pack exists: `ls Ryft/packs/<mode>/pack.json`                                             |
| Tools not appearing      | Ensure mode active (`/mode <name>`) and MCP server configured in pack.json                      |
| High token usage         | Check /tokens breakdown; compress prompt if needed; use /compact to reset                       |

## Project Structure

```
Ryft/
├── src/
│   ├── cli.ts              # Entry point
│   ├── config/             # Configuration system
│   ├── models/             # Model registry
│   ├── modes/              # Mode pack system
│   ├── mcp/                # MCP protocol & orchestration
│   ├── browser/            # Browser automation
│   ├── tokens/             # Token counting & budgeting
│   ├── runtime/            # Session & persistence
│   └── skills/             # Skill loading
├── packs/
│   ├── coder/              # Coder mode
│   ├── browser-surff/      # Browser automation mode
│   ├── debugger/           # Debugger mode
│   └── shared/             # Shared skills
├── bin/
│   └── ryft.js             # CLI entry point
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## Key Files to Know

- `src/cli.ts` - REPL initialization, command routing
- `src/config/types.ts` - Configuration schema
- `src/modes/pack-loader.ts` - Pack discovery
- `src/mcp/mode-manager.ts` - MCP orchestration
- `src/tokens/ui.ts` - Token warning display
- `src/browser/lifecycle.ts` - On-demand browser spawning

## Next Steps

1. **Manual Testing** - Follow "Example Session" above
2. **Add Custom Skills** - Create markdown files in pack directories
3. **Extend MCP Servers** - Add new servers in pack definitions
4. **Production Deployment** - Follow "Deployment" section
5. **Customize Configuration** - Edit `.ryft.json` for your defaults
