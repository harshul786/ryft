# Troubleshooting

Common issues and solutions for Ryft.

## Quick Reference

| Problem                   | Solution                                                                        |
| ------------------------- | ------------------------------------------------------------------------------- |
| "ryft: command not found" | Run `npm link` in Ryft directory                                                |
| "OPENAI_API_KEY not set"  | `export OPENAI_API_KEY=sk-...`                                                  |
| Chrome won't start        | Check Chrome installation, set `CHROME_BIN`                                     |
| High token usage          | Check `/tokens`, use `/compact` to reset                                        |
| Files not found           | See [Running from Different Directories](../guides/running-from-directories.md) |
| Tools not available       | Ensure mode is active with `/ tokens`                                           |

## Installation & Setup Issues

### "ryft: command not found"

**After `npm link`, ryft still not found:**

```bash
# Make sure you're in Ryft directory
cd /path/to/ryft

# Reinstall the link
npm link

# Verify
which ryft                # Should show the path
npm list -g ryft         # Should show ryft listed
```

**Still not working:**

1. Check npm global bin directory is in PATH:

   ```bash
   echo $PATH | grep homebrew    # or /usr/local
   ```

2. Add to PATH if needed:
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   export PATH="/opt/homebrew/bin:$PATH"
   source ~/.zshrc
   ```

### "Cannot find module tsx"

**Error when running `npm start`:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify installation
npm list --depth=0
```

### "OPENAI_API_KEY not found"

**Model can't call API:**

```bash
# Option 1: Set environment variable
export OPENAI_API_KEY=sk-your-key-here

# Option 2: Set in config file
mkdir -p ~/.config
echo '{"apiKey":"sk-your-key-here"}' > ~/.ryftrc

# Option 3: Set in REPL
ryft> /config set apiKey sk-your-key-here
```

**Don't have an API key?**

Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

### "Node.js version too old"

**Error: Node.js must be ≥20:**

```bash
# Check your version
node --version

# Install Node 20+
# Visit: https://nodejs.org/

# Or use nvm:
nvm install 20
nvm use 20
```

---

## Browser & Automation Issues

### "Chrome won't start" (browser-surff mode)

**Error when switching to browser mode:**

```bash
# Check Chrome is installed
open -a "Google Chrome" --version    # macOS

# Or find Chrome path
which google-chrome                   # Linux
which chromium                        # Alternative

# Set Chrome path if not standard:
export CHROME_BIN=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Restart Ryft
npm start
/mode browser-surff
```

### "Port 9222 already in use"

**Error: Chrome DevTools port conflict:**

```bash
# Find and kill existing Chrome
lsof -i :9222 | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Or just restart
ps aux | grep -i chrome | grep -v grep | awk '{print $2}' | xargs kill -9

# Restart Ryft
npm start
```

### "Browser automation not working"

**Tools show up but browser isn't launching:**

1. Check mode is active:

   ```bash
   /tokens
   # Should show browser tools
   ```

2. Verify Chrome path:

   ```bash
   echo $CHROME_BIN
   ```

3. Check Chrome is actually installed:
   ```bash
   open -a "Google Chrome"   # Should open Chrome
   ```

---

## File & Directory Issues

### "Can't find my project's files"

**File tools say files don't exist:**

```bash
# 1. Verify working directory
ryft> list the files

# 2. If wrong directory, see:
# [Running from Different Directories](../guides/running-from-directories.md)

# 3. Or use explicit --cwd flag:
npm start -- --cwd /path/to/project
```

See complete guide: [Running from Different Directories](../guides/running-from-directories.md)

### "File too large to read"

**Error: File exceeds size limit:**

```bash
# Check file size first
get_file_info("large-file.ts")

# Option 1: Use smaller portion
ryft> Read the first 50 lines of this file

# Option 2: Extract specific function
ryft> Find the calculate() function

# Option 3: Use CLI tools
ryft> Use grep to find the pattern
```

### "Permission denied" on files

**Can't read a file that exists:**

```bash
# Check file permissions
ls -la /path/to/file

# Fix permissions
chmod 644 /path/to/file

# Or try reading with absolute path
read_text("/absolute/path/to/file")
```

---

## Token & Performance Issues

### "High token usage"

**Tokens running out quickly:**

```bash
# Check current usage
/tokens

# See detailed breakdown
/tokens detailed

# Reduce active modes
/mode coder  # Just coder, remove others

# Or reset session
/compact
```

See: [Token Management Guide](../guides/token-management.md)

### "Ryft is slow"

**Commands taking a long time:**

```bash
# Check if browser is running
/tokens

# Close browser if not needed
# (Browser adds latency)

# Use fewer modes
/mode coder

# Check system resources
# system activity monitor
```

### "Out of memory"

**Error: Ryft crashes or won't start:**

1. Close other applications
2. Start Ryft again
3. Use smaller files: `read_text("file.ts", 50000)`

---

## Logging & Debugging

### "Enable debug logging"

**To see detailed logs:**

```bash
# Start with debug logging
RYFT_LOG_LEVEL=debug npm start

# In REPL:
# Set any time
/config set logLevel debug

# View logs
ryft logs view general
ryft logs view error
```

### "Check what's happening"

**If Ryft isn't responding:**

1. Check logs:

   ```bash
   ryft logs view error
   ryft logs view general
   ```

2. Check tokens:

   ```bash
   /tokens
   ```

3. Try reset:
   ```bash
   /compact
   ```

### "View detailed configuration"

```bash
/config view
# Shows: model, modes, apiKey status, logLevel
```

---

## Configuration & Setup Issues

### "Config not being read"

**Changes to config file don't take effect:**

```bash
# Config precedence (highest to lowest):
# 1. CLI flags: ryft --model gpt-4o
# 2. Environment: export OPENAI_API_KEY=...
# 3. Workspace: .ryft.json (current dir)
# 4. User: ~/.ryftrc (home dir)
# 5. Built-in defaults

# Verify which config is being used
/config view

# Force via environment
export OPENAI_API_KEY=sk-...
npm start

# Force via REPL
ryft> /config set model openai/gpt-4o
```

### "Can't change model"

**Model switch not working:**

```bash
# Check availability
/config view

# Set model
/model openai/gpt-4o

# Verify change
/config view

# Or set from CLI
npm start -- --model openai/gpt-4o
```

---

## Advanced Troubleshooting

### Run Ryft with Full Diagnostics

```bash
# Enable all logging and run
RYFT_LOG_LEVEL=debug RYFT_LOGS_ENABLED=1 npm start

# In REPL, perform your action
# Then check logs:
tail -f ~/.ryft/logs/general.log
tail -f ~/.ryft/logs/error.log
```

### Reset Everything

```bash
# Clear logs
rm -rf ~/.ryft/logs

# Clear config
rm ~/.ryftrc

# Reinstall
npm install
npm link

# Start fresh
ryft
```

### Collect Diagnostic Information

If reporting an issue, collect:

```bash
# OS info
uname -a

# Node.js version
node --version

# npm version
npm --version

# Ryft version
cd /path/to/ryft && git log -1

# Package info
cat package.json

# Last error logs
tail -50 ~/.ryft/logs/error.log
```

---

## Getting Help

If your issue isn't listed:

1. Check the [complete documentation](../index.md)
2. See [Architecture](../architecture/README.md) for technical details
3. Enable debug logging and check logs
4. Try `/compact` to reset token state
5. Restart Ryft: `exit` then `ryft`

## See Also

- [Issue Resolution Summary](./issue-resolution.md) - Detailed issue investigations
- [CWD Resolution](./cwd-resolution.md) - Working directory issues
- [Running from Directories](../guides/running-from-directories.md) - Project switching
- [Logging Guide](../guides/logging.md) - Debug logging setup
