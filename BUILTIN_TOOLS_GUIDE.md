# Built-in File Reading Tools for Ryft

## Overview

Ryft now includes **built-in file reading tools** that are always available to skills and models. These tools enable features like the `document` skill to analyze codebases without requiring external MCP servers or shell command access.

## Available Tools

### 1. `read_text` — Read a Single File

Reads the contents of a text file (up to 100KB).

**Usage:**
```
read_text(filePath: string, maxBytes?: number)
```

**Parameters:**
- `filePath` - Path to file (relative or absolute)
- `maxBytes` - Maximum bytes to read (default: 102400)

**Returns:**
```json
{
  "success": true,
  "content": "file content here..."
}
```

**Examples:**
- `read_text("package.json")` → Read package.json from current directory
- `read_text("src/main.ts", 50000)` → Read main.ts, cap at 50KB
- `read_text("/absolute/path/file.md")` → Use absolute paths

---

### 2. `list_dir` — List Directory Contents

Lists files and directories in a directory.

**Usage:**
```
list_dir(dirPath: string, maxItems?: number)
```

**Parameters:**
- `dirPath` - Path to directory (relative or absolute)
- `maxItems` - Maximum items to list (default: 1000)

**Returns:**
```json
{
  "success": true,
  "files": ["package.json", "README.md", "tsconfig.json"],
  "directories": ["src", "dist", "test"]
}
```

**Examples:**
- `list_dir("src")` → Get src/ structure
- `list_dir(".")` → Current directory contents
- `list_dir("packs/coder/skills")` → List skill directories

---

### 3. `read_multiple` — Read Multiple Files

Reads multiple files simultaneously (50KB max per file).

**Usage:**
```
read_multiple(filePaths: string[], maxBytesPerFile?: number)
```

**Parameters:**
- `filePaths` - Array of file paths
- `maxBytesPerFile` - Max bytes per file (default: 51200)

**Returns:**
```json
{
  "success": true,
  "files": {
    "src/cli.ts": "export async function main() { ... }",
    "package.json": "{ \"name\": \"ryft\", ... }"
  },
  "errors": {}
}
```

**Examples:**
- `read_multiple(["package.json", "README.md"])`
- `read_multiple(["src/types.ts", "src/models.ts"])`

---

### 4. `get_file_info` — Get File Metadata

Gets metadata about a file or directory.

**Usage:**
```
get_file_info(filePath: string)
```

**Parameters:**
- `filePath` - Path to file or directory

**Returns:**
```json
{
  "success": true,
  "isFile": true,
  "isDirectory": false,
  "size": 12345,
  "path": "/absolute/path/to/file.ts"
}
```

**Examples:**
- `get_file_info("src")` → Check if src is directory
- `get_file_info("large-file.bin")` → Get size before reading

---

## How Skills Use These Tools

### Document Skill Workflow

When the user asks "document the whole project":

1. **List Project Structure**
   ```
   list_dir(".")  →  Find README, package.json, src/, docs/
   ```

2. **Understand Project Type**
   ```
   read_text("package.json")  →  Get dependencies, scripts, name
   read_text("README.md")  →  Get overview, usage guide
   ```

3. **Find Key Files**
   ```
   list_dir("src")  →  Discover main modules
   list_dir("packs/coder/skills")  →  Find skill definitions
   ```

4. **Analyze Components**
   ```
   read_multiple([
     "src/cli.ts",
     "src/runtime/session.ts",
     "src/modes/catalog.ts"
   ])  →  Read all core files at once
   ```

5. **Generate Documentation**
   ```
   Output: Comprehensive project guide with:
   - Project overview
   - Architecture diagram
   - Key components and their purposes
   - How to run/extend
   - API reference
   ```

---

## Integration Points

### Native Tool Support

For models with native function-calling support (OpenAI, Anthropic, etc.):

- Tools appear in the function-calling schema with full descriptions
- Models can call them like any other tool
- Results are automatically fed back to the model

### Text-Based Invocation

For models without native tool support:

- Skills include tool hints in their instructions
- The skill describes what information is needed
- Results are incorporated into the analysis

### Session Initialization

Built-in tools are registered during session creation:

```typescript
// src/runtime/session.ts
registerBuiltinTools(toolRegistry);  // Done automatically
```

Tools are available immediately, before any MCP servers spawn.

---

## Limitations

### File Size Constraints

To prevent memory issues:
- Single file max: **100KB** (configurable via maxBytes)
- Multiple files: **50KB each** (configurable via maxBytesPerFile)
- Directory listings: **1000 items max** (configurable via maxItems)

### Binary Files

These tools only support text files. Binary files (images, compiled code) will fail:
- Solution: Use CLI tools like `file` to detect type first
- Or: Use describe/analyze skills instead of document

### Performance

Large codebases with many files require multiple calls:
- `list_dir()` first to find relevant files
- Then `read_multiple()` to read similar files in one batch
- Or use `read_text()` for selected files

---

## Comparing with CLI Tools

| Approach | Pros | Cons |
|----------|------|------|
| **Built-in Tools** (file reading) | Always available, fast, safe | Limited to file reading, size constraints |
| **CLI Tools** (tree, find, grep) | Powerful, no size limits | Requires shell access, slower |
| **MCP Tools** (if available) | Domain-specific, rich output | Requires external process |

**Best Practice:** Use built-in tools for basic file reading → CLI tools for pattern matching → MCP tools for sophisticated analysis.

---

## Example: Document Skill in Action

### User Request
```
"Document the whole project for me in an md file"
```

### Skill Execution (with built-in tools)

**Step 1: Discover Structure**
```
Tool: list_dir "."
Result: 
  files: [package.json, README.md, tsconfig.json, ...]
  directories: [src, packs, tests, ...]
```

**Step 2: Understand Type**
```
Tool: read_text "package.json"
Result: project name, dependencies, scripts, etc.
```

**Step 3: Find Key Components**
```
Tool: list_dir "src"
Result: [cli.ts, runtime/, modes/, tools/, ...]

Tool: list_dir "packs/coder/skills"
Result: [analyze/, document/, refactor/, ...]
```

**Step 4: Read Core Files**
```
Tool: read_multiple [
  "src/cli.ts",
  "src/runtime/session.ts",
  "src/modes/catalog.ts"
]
Result: All files read in one call
```

**Step 5: Generate Documentation**
```
Output:
# Project Documentation

## Overview
Ryft - OpenAI-native AI code assistant (from package.json)

## Architecture
- CLI Entry: src/cli.ts
- Runtime: src/runtime/session.ts
- Modes: 6 core modes (coder, browser-surff, etc.)
- Skills: 8 coder skills (analyze, document, etc.)

## Key Components
[Detailed descriptions from analyzed code]

## How to Extend
[Instructions based on architecture]
```

---

## For Developers

### Adding Skills that Use File Tools

1. **Get file paths** from user input or directory scanning
2. **Use list_dir** to explore structure
3. **Use read_text/read_multiple** to analyze files
4. **Process results** and output documentation/analysis

### Registering New Built-in Tools

Update `src/mcp/builtin-tools.ts`:

```typescript
const BUILTIN_TOOLS = [
  {
    name: "my_tool",
    description: "My tool description",
    schema: { /* ... */ },
    compressed: { /* ... */ }
  },
  // Add more...
];

export async function executeBuiltinTool(toolName, params) {
  switch(toolName) {
    case "my_tool":
      return await myToolImplementation(params);
  }
}
```

### Troubleshooting

**Tool not found:** Built-in tools must be registered in `BUILTIN_TOOLS` array

**File too large:** Increase `maxBytes` parameter or split reading into multiple calls

**Permission denied:** File exists but is not readable by Node.js process

---

## See Also

- [Directory Exploration Guide](./DIRECTORY_EXPLORATION_GUIDE.md) - Using CLI tools alongside built-in tools
- [Document Skill](./packs/coder/skills/document/SKILL.md) - How document skill uses these tools
- [Analyze Skill](./packs/coder/skills/analyze/SKILL.md) - Systematic codebase analysis
