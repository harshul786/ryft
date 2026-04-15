# Using Ryft as a Direct Command

Learn how to use Ryft as a global command on your system.

## Installation

First, install Ryft globally:

```bash
cd /path/to/ryft
npm install
npm link
```

This creates a symlink so you can use `ryft` from anywhere.

## Using the Global Command

From anywhere on your system:

```bash
ryft                          # Start interactive REPL
ryft --help                   # Show help
ryft --mode browser-surff     # Start with specific mode
ryft --model gpt-4o           # Use specific model
```

## How It Works

### The Entry Point Chain

```
/opt/homebrew/bin/ryft (symlink created by npm link)
    ↓
Ryft/bin/ryft.js (shell script wrapper)
    ↓
Ryft/bin/cli.ts (TypeScript loader)
    ↓
Ryft/src/cli.ts (actual CLI)
```

### Environment: `NODE_OPTIONS="--import tsx"`

The wrapper script sets NODE_OPTIONS to enable TypeScript support:

- Enables tsx loader
- Allows Node.js to run `.ts` files directly
- All transpilation happens on-the-fly

## Common Commands

```bash
# Start REPL
ryft

# Show help
ryft --help

# Start with specific mode
ryft --mode browser-surff

# Use specific model
ryft --model gpt-4-turbo

# Set working directory
ryft --cwd /path/to/project
```

## Analyze Any Project

With the global command installed, analyzing projects is simple:

```bash
# Navigate to your project
cd /path/to/my-project

# Start Ryft (uses current directory)
ryft

# Ask to analyze
ryft> Document this project
```

See [Running from Different Directories](./running-from-directories.md) for more examples.

## Uninstalling the Global Command

If you want to remove the global `ryft` command:

```bash
npm unlink ryft
```

Or completely uninstall:

```bash
npm uninstall -g ryft
```

## Troubleshooting

### "ryft: command not found"

After `npm link`, the command should be available. If not:

```bash
# Make sure you're in the Ryft directory  
cd /path/to/ryft

# Reinstall global link
npm link

# Verify it's linked
which ryft    # Should show /opt/homebrew/bin/ryft or similar
```

### Command Not in PATH

```bash
# Check your PATH
echo $PATH

# The npm global bin directory should be in PATH
# Usually: /opt/homebrew/bin (macOS with Homebrew)
# Or: /usr/local/bin (Linux)

# If not in PATH, add it to ~/.zshrc or ~/.bash_profile:
export PATH="/opt/homebrew/bin:$PATH"
```

### TypeScript Errors

If you get TypeScript errors:

1. Make sure tsx is installed: `npm install`
2. TypeScript files exist in src/: `ls src/cli.ts`
3. Node.js version is correct: `node --version` (must be ≥20)

## Development vs Production

### During Development

Use `npm start` for immediate testing:

```bash
npm start
```

### For End Users

Use global command:

```bash
npm link
ryft
```

Both run the exact same CLI code - just different entry points.

## Advanced: Custom Alias

You can create custom aliases for common tasks:

```bash
# Add to ~/.zshrc or ~/.bash_profile
alias ryft-coder='ryft --mode coder'
alias ryft-browser='ryft --mode browser-surff'
alias ryft-debug='RYFT_LOG_LEVEL=debug ryft'
```

Then use:

```bash
ryft-coder          # Starts with coder mode
ryft-browser        # Starts with browser mode
ryft-debug          # Starts with debug logging
```

## See Also

- [Getting Started](../getting-started/README.md)
- [Installation Guide](../getting-started/installation.md)
- [Running from Different Directories](./running-from-directories.md)
