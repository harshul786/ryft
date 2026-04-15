# Working Directory Resolution

Solving working directory and file path issues in Ryft.

## Problem: "Can't find my project's files"

Ryft needs to know which directory contains the code you want to analyze.

## Root Causes

### Cause 1: Wrong Directory Context

Ryft is analyzing the Ryft installation instead of your project.

**Symptoms:**

- File tools show Ryft's src/ directory
- Can't find your project files
- Asking for "main.ts" shows Ryft's main.ts

**Diagnosis:**

```bash
ryft> list the files
# Shows: src/, packs/, bin/ (Ryft files)
# Expected: your project files
```

### Cause 2: Working Directory Not Detected

The working directory detection isn't working.

**Symptoms:**

- Using `npm start` but tools don't find files
- Explicitly passing `--cwd` doesn't work
- Environment variable not set

### Cause 3: Incorrect Path

Files exist but paths are relative to wrong directory.

**Symptoms:**

- `read_text("src/main.ts")` fails
- But `read_text("/absolute/path/src/main.ts")` works

## Solutions

### Solution 1: Use Auto-Detection (Easiest)

Auto-detection works automatically in most cases:

```bash
# 1. Navigate to your project
cd /Users/harshul/Desktop/Sentiment-Analysis

# 2. Go to Ryft directory and start Ryft
cd ../browser-agent/Ryft && npm start

# 3. Ryft now analyzes Sentiment-Analysis automatically
ryft> list the files
# Shows: Sentiment-Analysis files ✓
```

**Why it works:**

- Ryft remembers the directory it was started from
- File tools use that directory context
- No configuration needed

### Solution 2: Use --cwd Flag (Explicit)

Explicitly specify which directory to analyze:

```bash
cd /Users/harshul/Desktop/browser-agent/Ryft

npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis
# or
npm start -- --cwd ../Sentiment-Analysis

# Now Ryft analyzes the specified directory
ryft> list the files
# Shows: Sentiment-Analysis files ✓
```

**Why use it:**

- Explicit control over context
- Works from any directory
- Good for scripting

### Solution 3: Global Install (Most Convenient)

Install globally for seamless usage:

```bash
# One-time setup
cd /Users/harshul/Desktop/browser-agent/Ryft
npm link

# Now from anywhere:
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft

# Automatically analyzes current directory
ryft> list the files
# Shows: Sentiment-Analysis files ✓
```

See: [Using Ryft as a Direct Command](../guides/direct-command.md)

---

## Priority Order

Ryft uses this priority to determine working directory:

```
1. --cwd flag (if provided)
   npm start -- --cwd /explicit/path

2. RYFT_ORIGINAL_CWD env var (global install)
   (Set automatically by npm link wrapper)

3. Current working directory (auto-detect)
   process.cwd()
```

---

## Common Scenarios

### Scenario 1: Sibling Projects

```
~/Desktop/
├── browser-agent/Ryft/
├── Sentiment-Analysis/     ← Analyze this
└── OtherProject/           ← Or this
```

**Solution: Auto-detection**

```bash
cd ~/Desktop/Sentiment-Analysis
cd ../browser-agent/Ryft && npm start
# Ryft analyzes Sentiment-Analysis
```

### Scenario 2: Nested Projects

```
~/workspace/
├── ryft/              ← Ryft installation
├── frontends/
│   ├── react-app/
│   └── vue-app/
└── backends/
    ├── api/           ← Analyze this
    └── worker/
```

**Solution: Explicit --cwd**

```bash
cd ~/workspace/ryft
npm start -- --cwd ../backends/api
# Analyzes ~/workspace/backends/api
```

### Scenario 3: Multiple Projects (Batch)

```bash
# Create helper script
#!/bin/bash
cd /path/to/ryft
for project in ~/projects/*/; do
  npm start -- --cwd "$project" << EOF
  Document this project
  exit
EOF
done
```

### Scenario 4: From IDE Terminal

Using VS Code or other IDEs:

```bash
# Terminal should open in project directory
cd ~/MyProject

# If not, change directory first
# Then start Ryft from Ryft directory
cd ~/ryft && npm start

# Ryft analyses ~/MyProject
```

---

## Verifying Directory Context

### Test 1: List Files

```bash
ryft> list the files

# Should show YOUR project files
# NOT Ryft's files (src/, packs/, bin/)
```

### Test 2: Check Specific File

```bash
ryft> Does this project have a package.json?

# Should find YOUR package.json
# NOT Ryft's package.json
```

### Test 3: Analyze Project Structure

```bash
ryft> Tell me about this project

# Should describe YOUR project
# NOT Ryft itself
```

---

## Troubleshooting

### "Still showing Ryft files"

1. Verify working directory:

   ```bash
   # In Ryft:
   ryft> what files are in this directory?
   # If shows Ryft files, wrong directory
   ```

2. Use explicit flag:

   ```bash
   npm start -- --cwd /path/to/your/project
   ```

3. Verify path:
   ```bash
   ls /path/to/your/project
   # Should show your files
   ```

### "--cwd flag not working"

**Check syntax:**

```bash
# ✓ Correct
npm start -- --cwd /path

# ✗ Wrong (missing --)
npm start --cwd /path
```

**Verify path:**

```bash
# Path must exist
ls /path/to/project
# Should not error
```

### "File not found with correct path"

**Issue:** Path exists but file tools can't find it

**Solutions:**

1. Use absolute path:

   ```bash
   read_text("/absolute/path/to/file.ts")
   ```

2. Check file exists:

   ```bash
   get_file_info("file.ts")
   ```

3. Use relative from context:
   ```bash
   # If analysis context is /project:
   read_text("src/main.ts")  # relative
   ```

---

## Advanced: Manual Configuration

### Set Environment Variable

```bash
# Set working directory via environment
export RYFT_ORIGINAL_CWD=/path/to/project
npm start
```

### Check What's Set

```bash
# Check current value
echo $RYFT_ORIGINAL_CWD

# Check from Ryft
ryft> What directory am I analyzing?
```

### Reset to Current

```bash
# Use current directory
unset RYFT_ORIGINAL_CWD
npm start
```

---

## File Write Operations & CWD

### Important: RYFT_ORIGINAL_CWD for File Writes

**Recent Fix (v0.1.0)**: File write tools now correctly use `RYFT_ORIGINAL_CWD` to ensure files are written to your project directory, not Ryft's directory.

This means:

- When you call `write_file()` or `str_replace_in_file()`, files are written to your project
- Your project files are modified, not Ryft's internal files
- Works correctly with global install (`npm link`)
- Works correctly with `--cwd` flag

**Example:**

```bash
# Navigate to your project
cd ~/Desktop/MyProject

# Global install scenario
ryft

# When you ask Ryft to create a file:
ryft> Create a new config.json file
# Result: ~/Desktop/MyProject/config.json (✓ correct)
# NOT: ~/ryft/config.json (✗ wrong)
```

### Verifying File Writes Are Correct

Test that files are written to the right place:

```bash
# In your project directory
ryft> Create a test file called test-marker.txt

# Then verify (outside of Ryft)
ls -la test-marker.txt
# Should find it in YOUR project, not Ryft's

# If NOT found in your project
echo $RYFT_ORIGINAL_CWD
# Should show your project path
```

---

## See Also

- [Running from Different Directories](../guides/running-from-directories.md) - Complete guide
- [File Tools Guide](../guides/file-tools.md) - How file tools work
- [Direct Command](../guides/direct-command.md) - Global install
- [Troubleshooting](./README.md) - General troubleshooting
