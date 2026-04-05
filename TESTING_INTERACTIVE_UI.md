# Ryft Interactive CLI - Testing Guide

## Problem Solved

**Issue**: Interactive UI wasn't showing when running `npm run build && npm link && ryft`

**Root Cause**:

1. The model selector (Phase 9C) uses `readline.question()` which doesn't work with piped/non-TTY input
2. When testing with piped input, readline gets confused and causes crashes
3. Onboarding uses `prompts` library which also needs interactive TTY

**Solution**: Added TTY detection - interactive prompts only show when `process.stdin.isTTY === true`

---

## How to Properly Test

### Test 1: Fresh Onboarding (First Time User)

```bash
# Remove existing config to simulate first-time user
rm ~/.ryftrc ~/.ryftrc.backup*

# Build and link
npm run build
npm link

# NOW run ryft in your terminal (NOT piped)
ryft
```

**Expected**:

- Welcome banner shows
- Step 1: Enter API key (masked input)
- Step 2: Choose model setup (quick/manual)
- Step 3: Select modes
- Quick setup: Choose OpenAI model
- Onboarding summary
- Config saved to ~/.ryftrc
- REPL starts

### Test 2: Model Selector (Second Run)

```bash
# Already have config from Test 1
ryft
```

**In the REPL, type**:

```
/model
```

**Expected**:

```
Current model: GPT-4.1 (gpt-4.1)

Available Models:

  OpenAI
    ● 1. GPT-4.1
    2. GPT-4.1 Mini
    3. GPT-4.1 Nano

  Local Proxy
    4. Local GPT-4.1 Mini
    5. Custom Proxy Model

    6. + Add custom proxy model

Select model (1-6)>
```

Select option: `1`

Save to config: `no`

### Test 3: Add Custom Proxy Model

```bash
ryft
```

**In REPL**:

```
/model
6  # Select "Add custom proxy model"
```

**Prompts**:

- Proxy URL: `http://localhost:8000/v1`
- Model name: `my-model`
- Label: `My Custom Model`

**Expected**:

- Model saved automatically
- Returns to REPL
- Next time `/model` is run, shows "My Custom Model" in "Saved Models" section

---

## Important Notes

### Why No UI in Piped/Script Tests?

When testing like this:

```bash
(echo "/model"; echo "1"; echo "no") | npm start
```

The interactive UI **intentionally skips** because:

- `process.stdin.isTTY` is `false` (stdin is a pipe, not a terminal)
- Interactive prompts don't work with piped input
- This matches behavior of other CLIs (e.g., `git` skips interactive mode when piped)

This is **correct behavior**. Scripts and pipes should use non-interactive mode:

```bash
# Non-interactive: use model by name argument
ryft --model gpt-4.1-mini

# Or update config first, then pipe commands
echo '{"model": "gpt-4.1-mini"}' | ryft --config set
```

### About `npm start` vs `npm link`

**`npm start`**:

- Uses `tsx` to load TypeScript directly
- `process.stdin.isTTY` may not work properly
- Good for development, piped testing

**`npm link && ryft`**:

- Uses bin/ryft.js with NODE_OPTIONS="--import tsx"
- `process.stdin.isTTY` works correctly
- Matches real-world usage
- **Use this for testing interactive features**

---

## Build & Install Commands

```bash
# Development: TypeScript direct
npm start

# Build TypeScript to dist/
npm run build

# Check for errors
npm run typecheck

# Install globally (creates /opt/homebrew/bin/ryft symlink)
npm link

# Uninstall global
npm unlink

# Run the global command
ryft                                # Interactive TTY
cat commands.txt | ryft             # Piped input (no UI)
```

---

## Architecture

### Onboarding (Phase 9B)

- **File**: src/onboarding/onboardingFlow.ts
- **Trigger**: First run or version mismatch
- **UI Library**: `prompts` (needs TTY)
- **When**: Before REPL starts

### Model Selector (Phase 9C)

- **File**: src/models/modelSelectorWithSaved.ts
- **Trigger**: User types `/model` with no args
- **UI Library**: readline.question()
- **When**: In REPL, requires TTY
- **Fallback**: Returns `null` if not TTY, command no-ops gracefully

### Saved Models

- **File**: src/models/savedModels.ts
- **Storage**: ~/.ryftrc under `savedModels` array
- **Persistence**: Auto-save after adding custom proxy

---

## Files Created/Modified

**Created**:

- src/models/savedModels.ts (170 lines) - Model storage & management
- src/models/modelSelectorWithSaved.ts (280 lines) - Interactive selector w/ TTY check

**Modified**:

- src/cli.ts - Wire /model command to selector
- src/config/config-writer.ts - (no changes, already works)
- src/models/modelSelectorWithSaved.ts - Added TTY check

**Status**:

- ✅ TypeScript: 0 errors
- ✅ Build: Completes successfully
- ✅ Global install: Works via npm link
- ✅ Interactive UI: Shows when stdin is TTY
- ✅ Piped input: Doesn't crash, gracefully skips UI

---

## Debug

If something isn't working:

```bash
# Test build
npm run build
npm run typecheck

# Test global install
npm link
ryft --help

# Test with verbose stderr
ryft 2>&1 | more

# Check config
cat ~/.ryftrc | jq .

# Reset config (will trigger onboarding next run)
rm ~/.ryftrc
```

---

## Next Phase (9D): Command Autocomplete

**Not yet started**

Will implement:

- Detect `/` at start of input
- Show dropdown menu of available commands
- Support Tab completion
- Uses readline manipulation to intercept input

Requires understanding of:

- readline.on('keypress') events
- stdin manipulation for command hints
