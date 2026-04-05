# Phase 9C: Model Proxy Selector - Implementation Complete

## Issues Found & Fixed

### Root Cause: Library Incompatibility

The original `/model` selector used the `prompts` library which **cannot work inside an already-active readline REPL loop**. Both libraries compete for stdin control, causing hangs.

**Solution**: Refactored to use `readline.question()` directly (same interface already active in REPL), avoiding the library conflict.

## What Was Built

### Files Created:

1. **src/models/savedModels.ts** (170 lines)
   - `getSavedModels()` - Load all saved models from ~/.ryftrc
   - `saveSingleModel()` - Save/update a model
   - `deleteSavedModel()` - Remove a saved model
   - `isValidProxyUrl()` - Validate proxy URLs
   - `generateModelId()` - Safe ID generation from labels

2. **src/models/modelSelectorWithSaved.ts** (280 lines)
   - `interactiveModelSelectorWithSaved()` - Main selector using readline
   - Displays built-in OpenAI models + saved custom proxies
   - Allows adding new custom proxy URLs interactively
   - Uses pure readline (no prompts library)

### Files Updated:

- **src/cli.ts** - Import and wire `interactiveModelSelectorWithSaved` to `/model` command

## How It Works

### User runs `/model` in REPL:

```
ryft [OpenAI/gpt-4.1]> /model

Current model: GPT-4.1 (gpt-4.1)

Available Models:

  OpenAI
    ● 1. GPT-4.1
       Balanced general-purpose model for code and analysis.
      2. GPT-4.1 Mini
       Faster and cheaper model for lightweight coding work.
      3. GPT-4.1 Nano
       Smallest option for quick, low-cost tasks.

  Local Proxy
      4. Local GPT-4.1 Mini
       Use the project proxy with a compact coding profile.
      5. Custom Proxy Model
       Use the current proxy base URL with a custom model name.

  Saved Models
      6. My Private LLM [my-llm]
         http://localhost:8000/v1

      7. + Add custom proxy model

Select model (1-7)> _
```

### User can:

1. **Select built-in model** (1-3): Sets immediately, optionally saves to config
2. **Select saved model** (4+): Sets immediately, optionally saves as default
3. **Add custom proxy** (last option):
   - Prompts for proxy URL (validated with URL constructor)
   - Asks for model name
   - Asks for friendly label
   - Auto-generates model ID
   - Automatically saves to ~/.ryftrc for future sessions

## Technical Details

### Why readline.question() works but prompts doesn't:

- `readline.question()` reuses the SAME readline interface already active in the main REPL loop
- The `prompts` library creates its OWN readline interface, causing conflict
- In REPL context, we must use the existing readline interface

### Type Safety:

- ✅ Zero TypeScript errors
- ✅ Full type definitions (SavedModelEntry, ModelOption)
- ✅ Proper async/await error handling

### Data Persistence:

- Saved models stored in `~/.ryftrc` under `savedModels` array
- Each entry: `{id, provider, baseUrl, label}`
- Loaded on startup, merged with built-in models

## Testing

### Manual Test:

```bash
npm start

# In REPL, type:
/model

# Select option by number (e.g., "1" for GPT-4.1)
1

# Optionally save to config:
no  # or "yes"

# Should see model changed:
modes=coder  memory=claude-like  model=gpt-4.1
```

### Add Custom Proxy:

```bash
npm start

/model
7  # Select "Add custom proxy model"

# Enter: http://localhost:8000/v1
# Model name: claude-3-sonnet
# Label: My Sonnet Model
# (model saved automatically)

# Next /model call will show: My Sonnet Model in Saved Models section
```

## Phase 9D: Command Suggestions (Not Yet Started)

The user mentioned "suggestions when we enter /". This is **Phase 9D - Command Autocomplete**, which will:

- Detect when user types `/`
- Show dropdown menu of available commands
- Support Tab completion

This is why claude-cli-source-code uses Ink (React terminal UI) - it gives them unified I/O and easy UI layering. For Ryft, Phase 9D will:

1. Create suggestions module with AVAILABLE_COMMANDS array
2. Modify REPL input loop to detect `/` and buffer input
3. Show formatted command menu
4. Handle Tab/Enter to complete/select

## Build & Runtime

**Development**: `npm start` runs tsx (TypeScript loader) - sees live changes

**Global install**: `npm link` creates symlink to bin/ryft.js → bin/cli.ts → src/cli.ts

**Build output**: `npm run build` creates dist/ directory (not used by npm start, but available for bundling)

## Status Summary

✅ **Phase 9C Complete**:

- Saved models management module
- Enhanced interactive selector (readline-based)
- /model command wired
- Custom proxy URL support
- Automatic config persistence

🟡 **Known Limitations**:

- No keyboard navigation (arrow keys) for selection yet
- No fuzzy search/filtering
- Tab completion not implemented (Phase 9D)
- Suggestions on `/` input not implemented (Phase 9D)

⏳ **Phase 9D Planned**:

- Command suggestions dropdown
- Tab completion
- `/` prefix detection
