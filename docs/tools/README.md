# Tools & Skills Reference

Learn about the tools and skills available in Ryft.

## What are Tools?

Tools are capabilities that Ryft can use to analyze your code and complete tasks. They're organized by feature:

- **File Tools** - Read and analyze files
- **Browser Tools** - Automate web tasks
- **MCP Tools** - External integrations
- **Skills** - AI-powered capabilities

## Built-in File Tools

Ryft includes comprehensive file operation tools:

### File Reading Tools

- `read_text` - Read a single file (up to 100KB)
- `list_dir` - List directory contents
- `read_multiple` - Read multiple files at once
- `get_file_info` - Get file metadata

### File Writing Tools

- `write_file` - Create or overwrite files
- `str_replace_in_file` - Replace text in files (in Coder mode)

Learn more: [File Tools Guide](../guides/file-tools.md)

## Browser Tools

When browser mode is active, you can:

- Open URLs in Chrome
- List open tabs
- Take screenshots
- Access DevTools
- Navigate pages

Activate: `ryft> /mode browser-surff`

Learn more: [Browser Mode](../modes/browser-surff.md)

## Skills

Skills are how Ryft accomplishes real work. Each skill is a specialized capability:

### Coder Skills

- **analyze** - Analyze code and explain what it does
- **document** - Generate documentation for code
- **refactor** - Suggest code improvements
- **generate** - Generate code from descriptions
- **debug** - Help debug issues

### Browser Skills

- **navigate** - Open URLs and browse
- **screenshot** - Take page screenshots
- **extract** - Extract data from pages
- **interact** - Click buttons, fill forms, etc.

### Shared Skills

- **memory** - Manage conversation context
- **compact** - Reset session to save tokens

## MCP Servers

MCP (Model Context Protocol) servers provide additional tools:

1. **Browser Server** - Chrome and DevTools automation
2. **Coder Server** - Enhanced code analysis
3. **Custom Servers** - Add your own (coming soon)

### Auto-Discovery

Tools are automatically discovered when you:

1. Activate a mode: `ryft> /mode browser-surff`
2. Use a skill that needs MCP tools
3. The MCP server spawns automatically (first use)

### On-Demand Spawning

- Servers start only when needed
- Not running at startup (saves resources)
- Stopped when session ends (auto cleanup)

## Using Tools

### In Chat

Simply ask Ryft to do something:

```bash
ryft> Analyze this code
ryft> Generate tests for this function
ryft> Navigate to example.com and summarize
```

Ryft automatically determines which tools to use.

### Viewing Tool Schemas

See what tools are available:

```bash
ryft> /tokens
# Shows available tools with token count

ryft> show me available tools
# Lists all active tools
```

## Tool Limitations

### File Tools

- Maximum file size: **100KB** per file
- Maximum directory items: **1000** per listing
- Text files only (binary files not supported)

### Browser Tools

- Chrome/Chromium required
- Single browser instance per session
- Screen size: 1920x1080 (default)

### General

- No persistent storage between sessions
- No network access (read from filesystem only)
- Sandboxed for security

## Comparing Approaches

| Need             | Recommended Tool    | Why                    |
| ---------------- | ------------------- | ---------------------- |
| Read files       | Built-in File Tools | Always available, fast |
| Analyze patterns | CLI grep tool       | More powerful          |
| Browser tasks    | Browser Tools       | Specialized            |
| Domain-specific  | Custom MCP          | Most flexible          |

## Next Steps

- **Learning file tools?** → [File Tools Guide](../guides/file-tools.md)
- **Using browser?** → [Browser Mode](../modes/browser-surff.md)
- **Building skills?** → [Development Guide](../skills/development.md)
- **Need specific tool?** → [API Reference](../architecture/README.md)

---

## Tool Availability by Mode

| Tool           | Coder | Browser | Debugger |
| -------------- | ----- | ------- | -------- |
| File Tools     | ✅    | ✅      | ✅       |
| Browser Tools  | ❌    | ✅      | ❌       |
| Coder Skills   | ✅    | ✅      | ✅       |
| Browser Skills | ❌    | ✅      | ❌       |
| Memory         | ✅    | ✅      | ✅       |

## See Also

- [Built-in File Tools](../guides/file-tools.md) - Complete file tools reference
- [Modes](../modes/README.md) - Tool availability by mode
- [Skills Development](../skills/development.md) - Creating new skills
- [Architecture](../architecture/README.md) - How tools are dispatched
