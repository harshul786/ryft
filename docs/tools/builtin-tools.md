# Built-in File Tools

Complete reference for Ryft's built-in file operation tools, including reading and writing capabilities.

## Overview

Ryft includes **comprehensive file operation tools** that are always available:

### File Reading Tools (Always Available)

- `read_text` - Read single file
- `list_dir` - List directory contents
- `read_multiple` - Read multiple files
- `get_file_info` - Get file metadata

### File Writing Tools (Coder Mode)

- `write_file` - Create or overwrite files
- `str_replace_in_file` - Replace text in existing files

## Tools Reference

### Tool 1: `read_text` — Read a Single File

Reads the complete contents of a text file.

**Signature:**

```
read_text(filePath: string, maxBytes?: number): Promise<{success: boolean, content?: string, error?: string}>
```

**Parameters:**

- `filePath` (string) - Path to file (relative or absolute)
- `maxBytes` (number, optional) - Max bytes to read (default: 102400)

**Returns:**

```json
{
  "success": true,
  "content": "file content here..."
}
```

**Size Limits:**

- Default: 100KB
- Configurable up to available memory

**Error Handling:**

- Non-existent file: Returns error
- Permission denied: Returns error
- Binary file: Attempts text read (may fail)

**Examples:**

```
read_text("package.json")
read_text("src/main.ts", 50000)
read_text("/absolute/path/file.md")
read_text("../../../file.txt")
```

---

### Tool 2: `list_dir` — List Directory Contents

Lists files and subdirectories in a directory.

**Signature:**

```
list_dir(dirPath: string, maxItems?: number): Promise<{success: boolean, files?: string[], directories?: string[]}>
```

**Parameters:**

- `dirPath` (string) - Path to directory
- `maxItems` (number, optional) - Max items to return (default: 1000)

**Returns:**

```json
{
  "success": true,
  "files": ["package.json", "README.md", "tsconfig.json"],
  "directories": ["src", "dist", "test"]
}
```

**Size Limits:**

- Max items: 1000 (default)
- Configurable

**Behavior:**

- Returns both files and directories separately
- Does not recurse into subdirectories
- Sorted alphabetically

**Examples:**

```
list_dir(".")
list_dir("src")
list_dir("packs/coder/skills")
list_dir("/absolute/path")
```

---

### Tool 3: `read_multiple` — Read Multiple Files

Reads multiple files simultaneously in one call.

**Signature:**

```
read_multiple(filePaths: string[], maxBytesPerFile?: number): Promise<{success: boolean, files?: Record<string, string>, errors?: Record<string, string>}>
```

**Parameters:**

- `filePaths` (string[]) - Array of file paths
- `maxBytesPerFile` (number, optional) - Max bytes per file (default: 51200)

**Returns:**

```json
{
  "success": true,
  "files": {
    "src/cli.ts": "export async function main() { ... }",
    "package.json": "{\"name\": \"ryft\", ...}"
  },
  "errors": {}
}
```

**Size Limits:**

- Per file: 50KB (default)
- Configurable

**Behavior:**

- Reads all files to max bytes each
- Returns successful reads in `files`
- Returns errors in `errors`

**Examples:**

```
read_multiple(["package.json", "README.md"])
read_multiple(["src/cli.ts", "src/models.ts", "src/types.ts"])
read_multiple(["src/index.ts", "packs/coder/skills/analyze/SKILL.md"])
```

---

### Tool 4: `get_file_info` — Get File Metadata

Gets information about a file or directory without reading its contents.

**Signature:**

```
get_file_info(filePath: string): Promise<{success: boolean, isFile?: boolean, isDirectory?: boolean, size?: number, path?: string}>
```

**Parameters:**

- `filePath` (string) - Path to file or directory

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

**Information Provided:**

- `isFile` - Whether it's a regular file
- `isDirectory` - Whether it's a directory
- `size` - File size in bytes
- `path` - Absolute path

**Use Cases:**

- Check if file exists
- Check if path is file or directory
- Check file size before reading
- Verify paths before operation

**Examples:**

```
get_file_info("src")
get_file_info("large-file.bin")
get_file_info("package.json")
get_file_info("/absolute/path")
```

---

## Common Workflows

### Workflow 1: Analyze a Module

```
1. get_file_info("src/module.ts")     // Check it exists
2. read_text("src/module.ts")         // Read contents
3. Result: File analyzed
```

### Workflow 2: Document a Project

```
1. list_dir(".")                      // Find structure
2. read_text("package.json")          // Get metadata
3. list_dir("src")                    // Find modules
4. read_multiple([src files])         // Read key files
5. Result: Project documented
```

### Workflow 3: Find Large File

```
1. list_dir(".")                      // List contents
2. get_file_info("large.tar.gz")      // Check size
3. If large, then describe instead of read
4. Result: Size-optimal solution
```

### Workflow 4: Check Structure

```
1. get_file_info("src")               // Is it a directory?
2. list_dir("src")                    // List contents
3. Read only relevant files
4. Result: Targeted analysis
```

---

## Integration with Skills

### How Skills Use These Tools

When a skill needs to read files:

1. **Skill requests tool** - "I need to read src/main.ts"
2. **Tool dispatcher** - Finds and calls `read_text` tool
3. **Tool executes** - Reads file with size limits
4. **Result returned** - Skill gets file content
5. **Skill analyzes** - Processes content and responds

### Automatic Registration

These tools are automatically:

- Registered at session startup
- Available to all skills without configuration
- Available via OpenAI function calling (if using native tools)
- Included in system prompt for text-based invocation

### Tool Parameters in System Prompt

Models receive tool hints in the system prompt:

```
Available file tools:
- read_text(path, [maxBytes]) → Read a file
- list_dir(path, [maxItems]) → List directory
- read_multiple(paths, [maxBytesPerFile]) → Read multiple files
- get_file_info(path) → Get file metadata
```

---

## Constraints & Limits

### File Size Constraints

| Tool                     | Default Limit | Configurable |
| ------------------------ | ------------- | ------------ |
| `read_text`              | 100KB         | Yes          |
| `read_multiple` per file | 50KB          | Yes          |
| `list_dir` items         | 1000 items    | Yes          |

### Why Limits?

- **Memory protection** - Prevent huge files from consuming memory
- **Token efficiency** - Large files increase token usage
- **Performance** - Keeps operations fast
- **Stability** - Prevents crashes on malformed data

### Handling Large Files

**Option 1: Adjust limit**

```
read_text("huge-file.ts", 500000)  // 500KB
```

**Option 2: Split reading**

```
read_multiple(["file1.ts", "file2.ts"])  // Multiple smaller reads
```

**Option 3: Use CLI tools**

```
ryft> Use grep to find the function definition
```

---

## Error Handling

### Common Errors

| Error             | Cause                        | Solution                          |
| ----------------- | ---------------------------- | --------------------------------- |
| File not found    | Path doesn't exist           | Verify path with `list_dir` first |
| Permission denied | No read access               | Check file permissions            |
| File too large    | Exceeds maxBytes             | Increase limit or use CLI         |
| Invalid path      | Malformed path               | Use absolute paths for clarity    |
| Not a directory   | Using directory tool on file | Check type with `get_file_info`   |

### Error Recovery

```
1. get_file_info(path)        // Verify path exists and type
2. If not found, list_dir()   // Find correct path
3. Try read again with correct path
```

---

## Performance Tips

### 1. Call `get_file_info` First

Before reading large file:

```
get_file_info("file.ts")  // 150KB - too large?
```

### 2. Use `list_dir` Before Reading

Explore before deep analysis:

```
list_dir("src")           // What files exist?
read_text("src/main.ts")  // Read specific one
```

### 3. Batch Read with `read_multiple`

More efficient than individual reads:

```
// Good
read_multiple(["file1.ts", "file2.ts", "file3.ts"])

// Less efficient
read_text("file1.ts")
read_text("file2.ts")
read_text("file3.ts")
```

### 4. Use CLI for Patterns

For complex pattern matching:

```
// Instead of: read_text() then search
// Use CLI: grep -r "pattern" src/
```

---

## Examples

### Example 1: Simple File Read

```
User: "What does main.ts do?"

Tool Calls:
1. read_text("src/main.ts")

Result:
- File content read
- Analysis provided
```

### Example 2: Project Structure

```
User: "Show me the project structure"

Tool Calls:
1. list_dir(".")
2. read_text("package.json")
3. list_dir("src")

Result:
- Project overview provided
- Brief description of contents
```

### Example 3: Code Analysis

```
User: "Find TypeScript issues in src/"

Tool Calls:
1. list_dir("src")
2. get_file_info("src/large.ts")  // Check size
3. read_text("src/small.ts")
4. read_multiple([other files])

Result:
- Issues identified
- Fixes suggested
```

---

## File Writing Tools (Coder Mode)

File write operations are available when using Coder mode. These tools allow Ryft to create and modify files in your project.

### Tool 5: `write_file` — Create or Overwrite Files

Creates a new file or overwrites an existing one with the given content.

**Signature:**

```
write_file(path: string, content: string): Promise<{success: boolean, message?: string, error?: string}>
```

**Parameters:**

- `path` (string) - File path (relative or absolute)
- `content` (string) - File content to write

**Returns:**

```json
{
  "success": true,
  "message": "File written: src/new-file.ts"
}
```

**Behavior:**

- Creates parent directories if needed
- Overwrites existing files
- Uses RYFT_ORIGINAL_CWD for correct working directory resolution
- Respects .gitignore and other ignore files

**Examples:**

```
write_file("src/utils.ts", "export function helper() { ... }")
write_file("config.json", "{\"version\": \"1.0.0\"}")
write_file("README.md", "# My Project\n\nDescription here")
```

---

### Tool 6: `str_replace_in_file` — Replace Text in Files

Finds and replaces text in an existing file.

**Signature:**

```
str_replace_in_file(path: string, oldText: string, newText: string): Promise<{success: boolean, message?: string, error?: string}>
```

**Parameters:**

- `path` (string) - File path
- `oldText` (string) - Text to find (must be exact match)
- `newText` (string) - Replacement text

**Returns:**

```json
{
  "success": true,
  "message": "Replaced 1 occurrence in src/main.ts"
}
```

**Important Notes:**

- Must match exact text including whitespace
- Only replaces first occurrence
- File must exist
- Preserves file permissions

**Best Practices:**

- Include context (3+ lines before/after target text)
- Ensure unique match to avoid accidental replacements
- Test changes locally before committing

**Examples:**

```
str_replace_in_file("src/config.ts",
  "const API_URL = \"http://localhost\"",
  "const API_URL = \"https://api.example.com\"")

str_replace_in_file("package.json",
  "\"version\": \"1.0.0\"",
  "\"version\": \"1.1.0\"")
```

---

## Write Tools Constraints

### Availability

- **Read Tools**: Available in all modes
- **Write Tools**: Available in **Coder mode only**
- **Reason**: Safety & session isolation

### Security Features

- **Path Validation**: Prevents writing outside project
- **CWD Resolution**: Uses RYFT_ORIGINAL_CWD for correct paths
- **Ignore Files**: Respects .gitignore, .prettierignore, etc.
- **Permissions**: Preserves file access permissions

### Size Limits

- **File Content**: Up to 50MB per file
- **Operations**: Unlimited write operations per session

---

## Working Directory Resolution (RYFT_ORIGINAL_CWD)

**Important:** File tools automatically resolve paths relative to your project directory using the `RYFT_ORIGINAL_CWD` environment variable. This ensures files are created/modified in the correct location, even when Ryft is installed globally.

See [Running from Directories](../guides/running-from-directories.md) for details.

---

## Workflow Examples

### Workflow: Generate a New Component

```
1. read_text("src/existing-component.ts")    // Analyze pattern
2. write_file("src/new-component.ts", "...") // Create new file
3. read_text("src/index.ts")                 // Get exports
4. str_replace_in_file("src/index.ts",
     "export { OldComponent }",
     "export { OldComponent, NewComponent }")
5. Result: New component integrated
```

### Workflow: Fix Multiple Files

```
1. list_dir("src")                    // Find files
2. read_multiple([files to modify])   // Read all
3. str_replace_in_file(file1, ...)    // Fix file 1
4. str_replace_in_file(file2, ...)    // Fix file 2
5. str_replace_in_file(file3, ...)    // Fix file 3
6. Result: Batch fixes applied
```

---

## See Also

- [File Tools Guide](../guides/file-tools.md) - Quick reference
- [Running from Directories](../guides/running-from-directories.md) - Working directory context
- [Tools & Skills](./README.md) - Complete tools reference
