---
id: document
name: document
description: Generate comprehensive documentation from code analysis
context: inline
paths: ["**/*.ts", "**/*.js", "**/*.md", "README*", "docs/**"]
---

# Document

Generate professional documentation from code, including API docs, architecture guides, and usage examples.

## When to Use

Use this skill when you need to:

- Create API documentation
- Generate architecture guides
- Document modules and functions
- Create usage examples
- Generate README sections
- Document interfaces and types
- Create architecture diagrams in text form

## How to Use

1. **Read files** using the available file reading tools:
   - `read_text(filePath)` - Read a single file (max 100KB)
   - `read_multiple(filePaths)` - Read multiple files at once
   - `list_dir(dirPath)` - List files to understand structure
2. Analyze the code structure and relationships
3. Identify key components to document
4. Extract docstrings, comments, and type information
5. Create organized documentation with examples
6. Structure the output in appropriate format (API docs, guide, etc.)

## Available Tools

When documenting, you have access to these file reading tools:

- **read_text** - Read a file's content (text files up to 100KB)
- **read_multiple** - Read multiple files simultaneously
- **list_dir** - List directory contents to find relevant files
- **get_file_info** - Get file metadata (size, type)

These tools enable you to explore the codebase without CLI access limitations.

## Documentation Formats

- **API Documentation**: Function signatures, parameters, return types, examples
- **Architecture Guide**: System overview, component relationships, data flow
- **Implementation Guide**: How to use and extend the module
- **Type Documentation**: TypeScript interfaces and types

## Example

"Document the authentication module with API reference, architecture, and usage examples."

## Output

The skill provides:

- Well-structured markdown documentation
- Code examples and usage patterns
- Type definitions and interfaces
- Architecture diagrams (as text)
- Configuration options
- Error handling documentation
