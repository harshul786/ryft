# Running Ryft from Different Directories

Learn how to analyze projects located in different directories.

## The Problem

When you want to analyze a different project (e.g., Sentiment-Analysis), Ryft needs to know where that project is located. By default, Ryft uses the current working directory when started.

## Solutions

### Solution 1: Auto-Detection (Easiest)

Ryft automatically uses your current working directory when started.

```bash
# Simply navigate to your project and start Ryft from the Ryft directory

# Example: Analyze Sentiment-Analysis
cd /Users/harshul/Desktop/Sentiment-Analysis

# Go to Ryft directory and start
cd ../browser-agent/Ryft
npm start

# Ryft automatically knows to analyze Sentiment-Analysis
ryft> document this project
```

**Why it works:**
- File tools automatically use your original working directory
- No configuration needed
- Seamless experience

### Solution 2: Use `--cwd` Flag (Explicit Control)

Explicitly specify which directory to analyze:

```bash
cd /Users/harshul/Desktop/browser-agent/Ryft

# Analyze a specific project
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis

# Or with relative path
npm start -- --cwd ../Sentiment-Analysis
```

**Why use it:**
- Explicit control over context
- Clear in scripts and automation
- Guaranteed to work anywhere

### Solution 3: Global Install (Recommended for Frequent Use)

Install Ryft globally so you can run it from any directory:

```bash
# One-time setup
cd /Users/harshul/Desktop/browser-agent/Ryft
npm link

# Now from anywhere:
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft
# Ryft automatically analyzes your current directory

# Optional: Switch contexts
ryft> /mode browser-surff
```

**Why it's best:**
- Works from any directory
- No need to navigate to Ryft directory
- Automatic context detection
- Most convenient for daily use

See [Using Ryft as a Direct Command](./direct-command.md) for more details.

### Solution 4: Helper Script (For Frequent Project Switching)

Create a convenient wrapper script:

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
# Analyze current directory
cd ~/Desktop/Sentiment-Analysis
ryft-analyze .

# Or analyze a specific project
ryft-analyze /Users/harshul/Desktop/Sentiment-Analysis
```

## Priority Order

Ryft uses this priority when determining working directory:

1. **Explicit `--cwd` flag** (if provided)
2. **Global install wrapper environment variable** (if installed globally)
3. **Current working directory** (auto-detected)

Example:

```bash
# These are equivalent - all analyze Sentiment-Analysis
cd /Users/harshul/Desktop/Sentiment-Analysis
npm start

# OR explicitly specify
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis

# OR with global install
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft
```

## Common Workflows

### Workflow 1: Quick Analysis (Easiest)

```bash
# 1. Go to project
cd /path/to/my-project

# 2. Start Ryft from Ryft directory
cd /path/to/ryft && npm start

# 3. Ryft automatically analyzes your project
ryft> Document this project
```

### Workflow 2: Global Install (Most Convenient)

```bash
# One-time setup
cd /path/to/ryft
npm link

# Then from anywhere:
cd /path/to/any/project
ryft

# Automatic analysis
ryft> Analyze and document this project
```

### Workflow 3: Batch Analysis

```bash
# Analyze multiple projects in a script
#!/bin/bash

for project in ~/projects/*/; do
  echo "Analyzing $(basename $project)..."
  npm start -- --cwd "$project" <<EOF
  Document this project
  exit
EOF
done
```

### Workflow 4: IDE Integration

```bash
# Run from VS Code terminal in project directory
# Terminal should be in project directory by default
cd /path/to/my-project
ryft
```

## Directory Structure Examples

### Example 1: Analyze Sentiment-Analysis Project

```
/Users/harshul/Desktop/
├── browser-agent/
│   └── Ryft/
│       ├── src/
│       ├── packs/
│       └── ... (Ryft files)
└── Sentiment-Analysis/
    ├── src/
    ├── package.json
    └── ... (project files)
```

**Analyze:**

```bash
# Option 1: auto-detection
cd /Users/harshul/Desktop/Sentiment-Analysis
cd ../browser-agent/Ryft && npm start

# Option 2: explicit --cwd
npm start -- --cwd /Users/harshul/Desktop/Sentiment-Analysis

# Option 3: global install
npm link  # (one-time, in /Users/harshul/Desktop/browser-agent/Ryft)
cd /Users/harshul/Desktop/Sentiment-Analysis
ryft
```

### Example 2: Nested Projects

```
/home/user/workspace/
├── ryft/             (Ryft installation)
├── project-a/       (project to analyze)
├── project-b/
└── temp/
    └── project-c/
```

**Analyze any:**

```bash
# Project A (sibling of Ryft)
cd /home/user/workspace/project-a
cd ../ryft && npm start

# Project B (sibling)
cd /home/user/workspace/project-b
cd ../ryft && npm start

# Project C (nested)
cd /home/user/workspace/temp/project-c
cd ../../ryft && npm start

# OR with --cwd (works from anywhere)
cd /home/user/workspace/ryft
npm start -- --cwd ../project-a
npm start -- --cwd ../project-b
npm start -- --cwd ../temp/project-c
```

## Verification

### Check That Auto-Detection Works

```bash
cd /path/to/your/project
cd ../ryft && npm start

# In Ryft, ask to list files
ryft> list the files in this directory
# Should show YOUR PROJECT files, not Ryft files
```

### Check Global Install Defaults

```bash
cd /path/to/your/project
ryft

# In Ryft, ask about the project
ryft> what project Am I analyzing?
# Should recognize YOUR PROJECT

# Verify with file tools
ryft> list the files
# Should show YOUR PROJECT files
```

## Troubleshooting

### "Can't find files in my project"

**Cause:** Ryft is still analyzing the Ryft directory

**Solution:**
1. Navigate to your project first: `cd /path/to/your/project`
2. Then start Ryft from Ryft directory: `cd ../ryft && npm start`
3. Verify in Ryft: `try list the files` - should show your project's files

### "--cwd flag doesn't work"

**Check syntax:**

```bash
# Correct: with --
npm start -- --cwd /path/to/project

# Wrong: without --
npm start --cwd /path/to/project   # This won't work
```

### Global install analyzing wrong directory

```bash
# Verify which directory npm link detected
echo $RYFT_ORIGINAL_CWD

# Navigate to correct project first
cd /path/to/project
ryft
```

## Advanced: Environment Variables

Internally, Ryft uses `RYFT_ORIGINAL_CWD` to track working directory:

```bash
# Check it
echo $RYFT_ORIGINAL_CWD

# Set it explicitly (most setups don't need this)
export RYFT_ORIGINAL_CWD=/path/to/project
npm start
```

## See Also

- [Using Ryft as a Direct Command](./direct-command.md) - Global installation
- [File Tools Guide](./file-tools.md) - How file tools work
- [Getting Started](../getting-started/README.md)
