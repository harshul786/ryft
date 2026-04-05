# Build & Setup Guide for Ryft

Quick reference for building and setting up Ryft from scratch.

## TL;DR (5 minutes)

```bash
# 1. Clone
git clone <repo> ryft
cd ryft

# 2. Install
npm install

# 3. Setup (pick one)
npm link              # Global command
# OR
npm start             # Local dev mode

# 4. Configure API key
export OPENAI_API_KEY=sk-your-key-here

# 5. Run
ryft
```

## Full Setup Steps

### Prerequisites Check

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

### 1. Clone Repository

```bash
# SSH (recommended if you have SSH key)
git clone git@github.com:yourusername/ryft.git

# HTTPS
git clone https://github.com/yourusername/ryft.git

# Then enter directory
cd ryft
```

### 2. Install Dependencies

```bash
npm install
```

**What gets installed:**

- `tsx` (v4.21) - TypeScript execution
- `typescript` (v6) - Type checking
- `chalk` (v5.4) - Terminal colors
- `commander` (v13) - CLI parsing
- `js-tiktoken` (v1) - Token counting

### 3. Choose One Installation Method

#### A. Global Command (Recommended for Users)

```bash
npm link

# Verify it works
which ryft                # Should show /opt/homebrew/bin/ryft
ryft --help              # Should show help text
```

**Uninstall:**

```bash
npm unlink ryft
```

#### B. Development Mode (Recommended for Developers)

```bash
# Either of these:
npm start               # Run CLI directly
npm run typecheck       # Just validate types
npm test               # Run tests (when available)
```

### 4. Add OpenAI API Key

**Permanent (saved to `~/.ryftrc`):**

```bash
export OPENAI_API_KEY=sk-your-key-here

# Then run
ryft

# Once started, save it:
ryft> /config set apiKey sk-your-key-here
```

**Temporary (current terminal session only):**

```bash
export OPENAI_API_KEY=sk-your-key-here
ryft
```

**In config file:**

```bash
# Create/edit ~/.ryftrc
{
  "apiKey": "sk-your-key-here",
  "model": "openai/gpt-4o"
}
```

### 5. Verify Everything Works

```bash
# Start the REPL
ryft

# Inside REPL, test:
ryft> /config view
ryft> /help
ryft> /tokens
ryft> exit
```

## Troubleshooting

### "ryft: command not found"

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
# Set it
export OPENAI_API_KEY=sk-your-key-here

# Or via config
ryft
/config set apiKey sk-your-key-here
```

### "Chrome won't start" (browser-surff mode)

```bash
# Set Chrome path if not at default location
export CHROME_BIN=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Then try
ryft
/mode browser-surff
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

## Project Structure After Build

```
ryft/
├── node_modules/          # Dependencies (created by npm install)
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
│   ├── ryft.js          # Global command (symlinked)
│   └── cli.ts           # TypeScript loader
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
└── README.md            # User guide
```

## Next Steps

1. **User**: See [README.md](README.md) for usage guide
2. **Developer**: See [SKILL.md](SKILL.md) for full API reference
3. **Integration**: See [DIRECT_COMMAND_SETUP.md](DIRECT_COMMAND_SETUP.md) for how the CLI works

## Common Commands Reference

| Task                     | Command                                 |
| ------------------------ | --------------------------------------- |
| Build & install globally | `npm install && npm link`               |
| Run in dev mode          | `npm start`                             |
| Type check only          | `npm run typecheck`                     |
| Run tests                | `npm test`                              |
| Start REPL               | `ryft` (if linked) or `npm start`       |
| Show help                | `ryft --help`                           |
| View config              | `ryft --mode coder` then `/config view` |

## Getting Help

- **Usage questions**: See [README.md](README.md)
- **Development guide**: See [SKILL.md](SKILL.md)
- **CLI internals**: See [DIRECT_COMMAND_SETUP.md](DIRECT_COMMAND_SETUP.md)
- **Troubleshooting**: See "Troubleshooting" section above
