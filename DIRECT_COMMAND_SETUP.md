# Using Ryft as a Direct Command

## Installation Complete

Ryft is now available as a global `ryft` command on your system:

```bash
$ ryft
🤖 Ryft OpenAI-native modular code CLI
```

## Quick Start

```bash
# Start interactive REPL
$ ryft

# Get help
$ ryft --help

# Run with options
$ ryft --mode coder,browser-surff --model gpt-4o
```

## How It Works

### Global Installation

When you run `npm link` in the Ryft directory, npm creates a symlink in `/opt/homebrew/bin/ryft` that points to:

- `bin/ryft.js` - The shell script entry point
- `bin/cli.ts` - The TypeScript CLI loader
- `src/cli.ts` - The actual Ryft REPL

### The Entry Point Chain

```
/opt/homebrew/bin/ryft (symlink)
    ↓
Ryft/bin/ryft.js (shell script with NODE_OPTIONS)
    ↓
Ryft/bin/cli.ts (import loader)
    ↓
Ryft/src/cli.ts (actual CLI)
```

### Environment: `NODE_OPTIONS="--import tsx"`

- Enables TypeScript support via the tsx loader
- Allows Node.js to run `.ts` files directly
- All transpilation happens on-the-fly

## Commands Available

From anywhere on your system:

```bash
ryft                          # Start REPL
ryft --help                   # Show help
ryft --mode browser-surff     # Start with specific mode
ryft --model gpt-4o           # Use specific model
ryft --prompt "analyze this"  # Run single prompt
```

## Uninstalling the Command

If you ever want to remove the global `ryft` command:

```bash
npm unlink ryft
```

Or uninstall completely:

```bash
npm uninstall -g ryft
```

## Reinstalling After Changes

If you change the CLI code and want to test it:

```bash
cd /Users/harshul/Desktop/browser-agent/Ryft

# Make sure it's still linked
npm link

# Test the command
ryft --help
```

## Troubleshooting

### Command Not Found

```bash
cd /Users/harshul/Desktop/browser-agent/Ryft
npm link
```

### Path Issues

The shell script uses `readlink -f` to resolve the actual file location even when called from a symlink:

```bash
readlink -f "$0"  # Resolves symlink to actual file
```

### TypeScript Errors

If you get TypeScript errors, make sure:

1. tsx is installed: `npm install`
2. TypeScript files are in src/: `ls src/cli.ts`
3. Node.js version is ≥20: `node --version`

## Files Modified for Global Command

- `bin/ryft.js` - Shell script wrapper (uses NODE_OPTIONS with tsx)
- `bin/cli.ts` - TypeScript entry point
- `package.json` - `"bin"` field points to `./bin/ryft.js`

## Direct vs npm start

| Method      | Command                    | Use Case                        |
| ----------- | -------------------------- | ------------------------------- |
| `ryft`      | Direct command (recommend) | Production, sharing with others |
| `npm start` | Local dev mode             | Development, debugging          |

Both run the exact same CLI code - just different entry points.

---

**You can now use `ryft` just like any other CLI tool on your system!** 🚀
