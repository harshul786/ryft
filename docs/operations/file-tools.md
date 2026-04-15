# Built-in File Tools Guide

Quick reference for Ryft's file reading tools that are always available to skills and models.

## Overview

Ryft includes **4 built-in file reading tools** that enable skills to read and analyze your codebase.

## Available Tools

### 1. `read_text` — Read a Single File

Reads the contents of a text file (up to 100KB).

**Usage:**
```
read_text(filePath: string, maxBytes?: number)
```

**Examples:**
- `read_text("package.json")` — Read package.json
- `read_text("src/main.ts", 50000)` — Read main.ts, cap at 50KB
- `read_text("/absolute/path/file.md")` — Use absolute paths

### 2. `list_dir` — List Directory Contents

Lists files and directories in a directory.

**Usage:**
```
list_dir(dirPath: string, maxItems?: number)
```

**Examples:**
- `list_dir("src")` — Get src/ structure
- `list_dir(".")` — Current directory contents
- `list_dir("packs/coder/skills")` — List skill directories

### 3. `read_multiple` — Read Multiple Files

Reads multiple files simultaneously (50KB max per file).

**Usage:**
```
read_multiple(filePaths: string[], maxBytesPerFile?: number)
```

**Examples:**
- `read_multiple(["package.json", "README.md"])`
- `read_multiple(["src/cli.ts", "src/models.ts"])`

### 4. `get_file_info` — Get File Metadata

Gets metadata about a file or directory (size, type, existence).

**Usage:**
```
get_file_info(filePath: string)
```

**Examples:**
- `get_file_info("src")` — Check if src is directory
- `get_file_info("large-file.bin")` — Get size before reading

## How to Use in Your Project

### Ask Ryft to Read Files

When you start analyzing your project, Ryft can automatically use these tools:

```bash
ryft> Document the whole project for me
# Ryft uses: list_dir(".") → read_text("package.json") → 
# list_dir("src") → read_multiple([...files...])

ryft> Analyze src/main.ts
# Ryft uses: read_text("src/main.ts") for analysis
```

### Document Skill Workflow

When the user asks "document the project":

1. **List structure** — `list_dir(".")` finds README, package.json, src/
2. **Understand type** — `read_text("package.json")` for dependencies
3. **Find components** — `list_dir("src")` discovers modules
4. **Read files** — `read_multiple([...])` for core files
5. **Generate docs** — Output comprehensive documentation

## Limitations

### File Size Constraints

To prevent memory issues:
- Single file: **Max 100KB** (configurable via maxBytes)
- Multiple files: **Max 50KB each** (configurable)
- Directory listings: **Max 1000 items** (configurable)

### Binary Files

These tools only support text files. Binary files will fail.

**Solution:** Use CLI tools or describe/analyze skills instead.

### Performance

Large codebases require multiple calls:
- `list_dir()` first to find relevant files
- Then `read_multiple()` to batch-read similar files
- Or `read_text()` for selected files

## Comparing Tools

| Approach | Pros | Cons |
|----------|------|------|
| **Built-in Tools** | Always available, fast, safe | Limited to file reading, size constraints |
| **CLI Tools** | Powerful, no size limits | Need shell access, slower |
| **MCP Tools** | Domain-specific, rich output | Requires external process |

**Best Practice:** Use built-in tools for basic file reading → CLI tools for pattern matching → MCP tools for sophisticated analysis.

## Examples

### Analyze a Single File

```bash
ryft> What does src/main.ts do?
# Ryft: Let me read that file for you...
# Uses: read_text("src/main.ts")
# Output: [Detailed analysis of file]
```

### Document a Project

```bash
ryft> Create documentation for this project
# Ryft: I'll explore your project structure...
# Uses: 
#   - list_dir(".")
#   - read_text("package.json")
#   - read_text("README.md")
#   - list_dir("src")
#   - read_multiple([key source files])
# Output: [Complete project documentation]
```

### Find Related Files

```bash
ryft> Find all TypeScript files in src
# Ryft: I'll list the src directory...
# Uses: list_dir("src")
# Output: [All files in src/]
```

## Troubleshooting

### "Tool not found"

Built-in tools must be registered before use. This should happen automatically at session start.

**Solution:** Restart Ryft

### "File too large"

If you get a size error:

1. Check file size: `get_file_info("large-file.ts")`
2. Increase limit: `read_text("file.ts", 200000)` for 200KB
3. Or split reading into chunks

### "Permission denied"

File exists but can't be read.

**Solution:** Check file permissions:

```bash
ls -l /path/to/file
```

### Working Directory Issues

If tools can't find files, see [Running from Different Directories](./running-from-directories.md).

## Performance Tips

### 1. Use list_dir First

Before reading, explore structure:

```bash
ryft> List the main source files
# Gets you directory overview before deep analysis
```

### 2. Batch Read Similar Files

Use `read_multiple` for files in same directory:

```bash
ryft> Read all test files
# Faster than individual read_text calls
```

### 3. Ask Ryft to Prioritize

```bash
ryft> What are the most important files to understand this project?
# Ryft: Based on package.json and structure, focus on:
# [lists key files]
```

### 4. Monitor File Sizes

Use `get_file_info` before reading large files:

```bash
ryft> What's the size of main.ts?
# Ryft: Let me check...get_file_info("src/main.ts")
# Result: 150KB
```

## See Also

- [Quick Start - File Tools](../getting-started/quick-start.md#file-tools)
- [Running from Different Directories](./running-from-directories.md)
- [Directory Exploration](./directory-exploration.md)
- [Tools & Skills](../tools/README.md)
