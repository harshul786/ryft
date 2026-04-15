# Installation Guide

Complete installation instructions for different use cases.

## Prerequisites

- **Node.js**: ≥20.0.0 ([download](https://nodejs.org/))
- **npm**: ≥10.0.0 (comes with Node.js)
- **Git**: For cloning the repository
- **macOS/Linux/Windows**: All supported (Chrome binary path may differ on Windows)

### Verify Prerequisites

```bash
# Node.js ≥20
node --version

# npm ≥10
npm --version

# Git (for cloning)
git --version
```

If any are missing, install from:

- Node.js: https://nodejs.org/ (includes npm)
- Git: https://git-scm.com/

## Step 1: Clone Repository

```bash
# SSH (recommended if you have SSH key)
git clone git@github.com:yourusername/ryft.git

# HTTPS
git clone https://github.com/yourusername/ryft.git

# Then enter directory
cd ryft
```

## Step 2: Install Dependencies

```bash
npm install
```

**What gets installed:**

- `tsx` - TypeScript execution engine
- `typescript` - Type checking
- `chalk` - Terminal colors
- `commander` - CLI parsing
- `js-tiktoken` - Token counting

## Step 3: Choose Your Installation Method

### Option A: Global Command (Recommended for Users)

```bash
npm link

# Verify it works
which ryft                # Should show /opt/homebrew/bin/ryft (macOS)
ryft --help              # Should show help text
```

**Using the global command:**

```bash
# From anywhere on your system
ryft                      # Start interactive REPL
ryft --help              # Show help
ryft --mode browser-surff # Start with browser mode
```

**Uninstall global command if needed:**

```bash
npm unlink ryft
```

### Option B: Development Mode (Recommended for Developers)

```bash
npm start               # Run CLI directly
npm run typecheck       # Just validate types without running
npm test               # Run tests (when available)
```

## Step 4: Set Up LLM Provider

Ryft works with multiple LLM providers. Choose one:

### Supported Providers

| Provider      | API Key Variable    | Get Key                                              | Cost                |
| ------------- | ------------------- | ---------------------------------------------------- | ------------------- |
| **OpenAI**    | `OPENAI_API_KEY`    | [Get here](https://platform.openai.com/api-keys)     | Pay-as-you-go       |
| **Anthropic** | `ANTHROPIC_API_KEY` | [Get here](https://console.anthropic.com/)           | Pay-as-you-go       |
| **Google**    | `GOOGLE_API_KEY`    | [Get here](https://makersuite.google.com/app/apikey) | Free tier available |
| **Ollama**    | `OLLAMA_MODEL`      | [Download](https://ollama.ai)                        | Free (local)        |

### Option 1: Temporary (Current Session Only)

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-key-here
npm start

# OR for Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
npm start

# OR for Google
export GOOGLE_API_KEY=...
npm start

# OR for Ollama (local)
export OLLAMA_MODEL=llama2
npm start
```

### Option 2: Permanent (Saved to `~/.ryftrc`)

```bash
# Create/edit ~/.ryftrc
{
  "provider": "openai",          # or "anthropic", "google", "ollama"
  "apiKey": "sk-your-key-here",  # your API key
  "model": "gpt-4o"              # optional: default model
}
```

For Anthropic:

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-3-5-sonnet"
}
```

For Google:

```json
{
  "provider": "google",
  "apiKey": "...",
  "model": "gemini-pro"
}
```

For Ollama:

```json
{
  "provider": "ollama",
  "model": "llama2"
}
```

### Option 3: Environment Variable + Defaults

```bash
# Set in your shell profile (~/.bashrc, ~/.zshrc, etc.)
export OPENAI_API_KEY=sk-your-key-here
# OR
export ANTHROPIC_API_KEY=sk-ant-...
# OR
export GOOGLE_API_KEY=...

# Then Ryft uses that provider automatically
npm start
```

## Step 5: Verify Everything Works

```bash
# Start the REPL
npm start
# OR if you installed globally:
# ryft

# Inside REPL:
ryft> /config view        # Check configuration
ryft> /help              # List all commands
ryft> /tokens            # Check token budget
ryft> exit               # Exit
```

## Troubleshooting

### "ryft: command not found" (after `npm link`)

```bash
# Make sure you're in the ryft directory
cd /path/to/ryft

# Reinstall global link
npm link

# Or run in dev mode
npm start
```

### "Cannot find module tsx"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "OPENAI_API_KEY not found"

```bash
# Set it temporarily
export OPENAI_API_KEY=sk-your-key-here

# Or set it permanently in ~/.ryftrc
{
  "apiKey": "sk-your-key-here"
}

# Or set in REPL
ryft> /config set apiKey sk-your-key-here
```

### "Chrome won't start" (browser-surff mode)

```bash
# Check if Chrome is installed
# macOS:
open -a "Google Chrome" --version

# Set Chrome path if not at default location
export CHROME_BIN=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Then try
ryft
/mode browser-surff
```

### Node.js version error

```bash
# Check your version
node --version            # Must be ≥20.0.0

# If too old, install Node 20+
# Visit: https://nodejs.org/
```

### Type Checking Errors

```bash
# Verify Node.js version
node --version           # Must be ≥20.0.0

# Clean rebuild
npm run typecheck        # Should show no errors
```

## Build Outputs

### Development Build

```bash
npm start
```

- Runs TypeScript directly via tsx
- No output files created
- Best for debugging

### Type Checking

```bash
npm run typecheck
```

- Validates all TypeScript
- No output files
- Run before committing

### Production Build (Optional)

```bash
# Compile to JavaScript
npx tsc --declaration --outDir dist --skipLibCheck

# Result: dist/src/**/*.js files
```

## Project Structure

```
ryft/
├── src/                   # TypeScript source
│   ├── cli.ts            # Entry point
│   ├── config/           # Configuration system
│   ├── models/           # Model registry
│   ├── modes/            # Mode packs
│   ├── mcp/              # MCP protocol
│   ├── browser/          # Browser automation
│   ├── tokens/           # Token counting
│   └── runtime/          # Session state
├── packs/                # Mode definitions
│   ├── coder/
│   ├── browser-surff/
│   ├── debugger/
│   └── shared/
├── bin/                  # CLI entry points
│   ├── ryft.js          # Global command entry
│   └── cli.ts           # TypeScript loader
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
└── README.md            # User guide
```

## Next Steps

1. **User**: See [Quick Start](./quick-start.md)
2. **Developer**: See [Development Guide](../skills/development.md)
3. **Integration**: See [Using Ryft as a Direct Command](../guides/direct-command.md)

## Common Commands Reference

| Task                     | Command                           |
| ------------------------ | --------------------------------- |
| Build & install globally | `npm install && npm link`         |
| Run in dev mode          | `npm start`                       |
| Type check only          | `npm run typecheck`               |
| Run tests                | `npm test`                        |
| Start REPL               | `ryft` (if linked) or `npm start` |
| Show help                | `ryft --help`                     |
| View config              | `ryft` then `/config view`        |

## Getting Help

- **Usage questions**: See [Quick Start](./quick-start.md)
- **Development**: See [Development Guide](../skills/development.md)
- **Issues**: See [Troubleshooting](../troubleshooting/README.md)
