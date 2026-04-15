# How to Run Ryft from Any Directory

## The Problem

When you want to analyze a different project (e.g., Sentiment-Analysis), Ryft needs to know where that project is located. By default, Ryft uses the current working directory when started.

## Solutions

### Option 1: Use `--cwd` Flag (Easiest for Development)

Start Ryft with the `--cwd` flag pointing to your project:

```bash
cd /Users/harshul/Desktop/browser-agent/Ryft
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis
```

Or with a relative path:
```bash
cd /Users/harshul/Desktop/browser-agent/Ryft
npm start -- --cwd ../Sentiment-Analysis
```

**Why it works:**
- The `--cwd` flag explicitly tells Ryft which directory contains the code you want to analyze
- File reading tools automatically use this directory for resolving paths
- This is the most reliable method for development/testing

---

### Option 2: Use Global Install + bin/ryft.js Wrapper (Recommended for Production)

Install Ryft globally so you can run it from anywhere:

```bash
# One time setup: create global symlink
cd /Users/harshul/Desktop/browser-agent/Ryft
npm link

# Now you can run from anywhere:
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft

# The wrapper script automatically captures the working directory
# and sets RYFT_ORIGINAL_CWD for all file tools
```

**Why it works:**
- The `bin/ryft.js` wrapper script captures your current directory before changing to the Ryft installation
- Exports `RYFT_ORIGINAL_CWD` environment variable
- File tools automatically use this for path resolution
- Works seamlessly from any directory

**Uninstall if needed:**
```bash
cd /Users/harshul/Desktop/browser-agent/Ryft
npm unlink
```

---

### Option 3: Helper Script (For Frequent Project Switching)

Create a helper script that runs Ryft with the correct context:

```bash
#!/bin/bash
# Save as: ~/bin/ryft-analyze

RYFT_PATH="/Users/harshul/Desktop/browser-agent/Ryft"
cd "$RYFT_PATH"
npm start -- --cwd "$@"
```

Make it executable:
```bash
chmod +x ~/bin/ryft-analyze
```

Use it:
```bash
cd ~/Desktop/Sentiment-Analysis
ryft-analyze .

# Or analyze a specific project:
ryft-analyze /Users/harshul/Desktop/Sentiment-Analysis
```

---

## Testing It Works

After starting Ryft with correct context, you can verify by asking:

```
You: can you see the codebase? list the files
```

Ryft should respond with the actual files in your project directory:
- ✅ For Sentiment-Analysis: `emotions.txt, main.py, main_nltk.py, read.txt, settings.py`
- ✅ For Ryft itself: `src/, packs/, package.json, bin/, ...`

---

## Examples

### Scenario 1: Analyze Sentiment-Analysis Project

```bash
# Method 1: Using --cwd flag
cd /Users/harshul/Desktop/browser-agent/Ryft
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis
# Or:
npm start -- --cwd ../Sentiment-Analysis

# Method 2: Using global install
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft  # Requires: npm link setup

# Then ask:
# "document the whole project for me"
# "analyze the main.py file"
# "what does this codebase do?"
```

### Scenario 2: Analyze Ryft Project

```bash
# Method 1: Using --cwd flag
cd /Users/harshul/Desktop/browser-agent/Ryft
npm start -- --cwd .

# Or just:
npm start

# Method 2: Using global install
cd /Users/harshul/Desktop/browser-agent/Ryft
ryft  # If npm link was run
```

---

## How It Works Internally

### Without --cwd flag:
```
User runs: npm start (from Ryft directory)
├─ process.cwd() = /Users/harshul/Desktop/browser-agent/Ryft
├─ RYFT_ORIGINAL_CWD not set
└─ File tools resolve relative to Ryft directory ❌
```

### With --cwd flag:
```
User runs: npm start -- --cwd ../Sentiment-Analysis
├─ CLI parses --cwd flag
├─ Sets: process.env.RYFT_ORIGINAL_CWD = ../Sentiment-Analysis
├─ File tools call getWorkingDir()
└─ Paths resolve relative to Sentiment-Analysis ✅
```

### With global install (bin/ryft.js wrapper):
```
User runs: cd /path/to/project && ryft
├─ Shell wrapper captures PWD beforechanging directories
├─ Sets: export RYFT_ORIGINAL_CWD="$PWD"
├─ Starts Ryft from install directory
├─ File tools call getWorkingDir()
└─ Paths resolve relative to user's directory ✅
```

---

## Troubleshooting

### Files still not found after using --cwd

**Check:** Is the path absolute or relative?
- Absolute: `/Users/harshul/Desktop/Sentiment-Analysis` ✅
- Relative: `../Sentiment-Analysis` ✅
- Wrong: `Sentiment-Analysis` (without leading ..) ❌

**Fix:** Use absolute paths if uncertain:
```bash
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis
```

### Got "Tool execution failed" error

**Check:** Does the directory actually exist?
```bash
ls -la /Users/harshul/Desktop/Sentiment-Analysis
```

**Check:** Are there permission issues?
```bash
# Test read access
head -1 /Users/harshul/Desktop/Sentiment-Analysis/main.py
```

---

## Recommended Setup

For regular development work:

### Quick Option
```bash
# Put this in ~/.zshrc or ~/.bashrc:
alias ryft='cd /Users/harshul/Desktop/browser-agent/Ryft && npm start -- --cwd'

# Then use:
ryft /Users/harshul/Desktop/Sentiment-Analysis
ryft .
```

### Production Option
```bash
# One time:
cd /Users/harshul/Desktop/browser-agent/Ryft
npm link

# Then from anywhere:
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft
```

---

## See Also

- [BUILTIN_TOOLS_GUIDE.md](./BUILTIN_TOOLS_GUIDE.md) - File reading tools reference
- [QUICK_START_FILE_TOOLS.md](./QUICK_START_FILE_TOOLS.md) - Quick start examples
- [src/cli.ts](./src/cli.ts) - CLI implementation (see --cwd option)
- [src/tools/fileReader.ts](./src/tools/fileReader.ts) - How tools determine working directory
