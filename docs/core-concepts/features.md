# Features Documentation

Feature-specific documentation and implementation details.

## Available Features

Ryft includes several key features that enhance its capabilities:

### Core Features

- **Multi-Provider LLM Support** - Work with OpenAI, Anthropic, Google, Ollama, and compatible APIs
- **Token Budgeting** - Track and manage token usage
- **Configuration Management** - Flexible config system with 5-level precedence
- **MCP Server Integration** - Auto-discovery and on-demand spawning
- **Browser Automation** - Chrome/Chromium automation
- **Session Persistence** - Save and restore browser state
- **Multi-Mode Support** - Compose different modes

### Recent Features

- **File Write Tools** - Create and edit files (Coder mode)
- **Built-in File Tools** - File reading without external tools
- **Memory Modes** - Multiple context management strategies (normal, hierarchy, session)
- **Auto Working Directory Detection** - Seamless project analysis (RYFT_ORIGINAL_CWD fix)
- **Skills & Tools System** - AI-powered capabilities (12 total skills)
- **Streaming Responses** - Real-time output

## Feature Guides

### Token Budgeting

**What it does:** Tracks LLM API token usage across your session.

**Why it matters:** Prevents unexpected API bills, helps optimize prompts, shows cost impacts.

**Soft warnings at:**

- 70% of budget - Yellow warning
- 90% of budget - Red warning
- No hard limit (you can continue if needed)

**How to use:**

```bash
/tokens              # Quick overview
/tokens detailed     # Detailed breakdown
/config set showTokens true  # Always show tokens
```

See: [Token Management Guide](../guides/token-management.md)

### Configuration Management

**What it does:** Unified configuration system with multiple sources.

**Priority order:**

1. CLI flags
2. Environment variables
3. Workspace config (`.ryft.json`)
4. User config (`~/.ryftrc`)
5. Defaults

**Usage:**

```bash
/config view                          # See current config
/config set model openai/gpt-4o      # Update setting
export OPENAI_API_KEY=sk-...         # Environment variable
ryft --model gpt-4-turbo             # CLI flag
```

See: [Installation Guide](../getting-started/installation.md)

### Built-in File Tools

**What it does:** Read and edit files without external commands.

**File reading tools:**

- `read_text` - Read file contents
- `list_dir` - List directory structure
- `read_multiple` - Read multiple files at once
- `get_file_info` - Get file metadata

**File writing tools (Coder mode):**

- `write_file` - Create or overwrite files
- `str_replace_in_file` - Replace text in existing files

**Usage:**

```bash
ryft> Document this project
# Automatically uses file tools to analyze project

ryft> Add error handling to this function
# Uses read_text to get file
# Uses str_replace_in_file to update it
```

See: [File Tools Guide](../guides/file-tools.md)

### Browser Automation

**What it does:** Automate web browsing tasks and extract data.

**Capabilities:**

- Navigate to URLs
- Execute JavaScript
- Take screenshots
- Extract page content
- Fill forms and interact

**Usage:**

```bash
/mode browser-surff
ryft> Navigate to example.com and tell me about it
```

See: [Browser Mode](../modes/browser-surff.md)

### Session Persistence

**What it does:** Saves browser state between sessions.

**Benefits:**

- Restore previous URLs and tabs
- Maintain login state
- Keep page history

**Auto-enabled** when using browser mode.

### Multi-Mode Support

**What it does:** Combine different operational modes.

**Example:**

```bash
/mode coder,browser-surff
ryft> Analyze this web app and suggest improvements
```

**Available modes:**

- coder - Code analysis
- browser-surff - Web automation
- debugger - Process debugging

See: [Modes Documentation](../modes/README.md)

### Skills & Tools System

**What it does:** AI-powered capabilities organized as skills.

**How it works:**

1. Model sees available skills
2. Model invokes appropriate skill
3. Skill executes with available tools
4. Results fed back to model
5. Model continues reasoning

**Example skills:**

- analyze - Understand code
- document - Generate docs
- generate - Write code
- debug - Fix issues

See: [Skills Documentation](../skills/README.md)

### Multi-Provider LLM Support

**What it does:** Work with OpenAI, Anthropic, Google, Ollama, and OpenAI-compatible APIs.

**Supported Providers:**

- **OpenAI** - GPT-4o, GPT-4, GPT-4-turbo models
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 (Opus, Sonnet, Haiku) models
- **Google** - Gemini Pro, Gemini Pro with Vision
- **Ollama** - Local models (Llama 2, Mistral, etc.)
- **Compatible APIs** - Any OpenAI-compatible API endpoint

**Why it matters:**

- Choose based on cost and capability
- Use local models (Ollama) for privacy
- Mix and match providers per mode

**How to use:**

```bash
# Set provider via environment variable
export OPENAI_API_KEY=sk-...
# OR
export ANTHROPIC_API_KEY=sk-ant-...
# OR
export GOOGLE_API_KEY=...
# OR
export OLLAMA_MODEL=llama2

# Or set in config (~/.ryftrc)
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-3-5-sonnet"
}
```

See: [Installation Guide](../getting-started/installation.md)

### Memory Modes

**What it does:** Choose how Ryft manages conversation history.

**Available modes:**

- **normal** - Full history (best for Claude, short conversations)
- **hierarchy** - Hierarchical compression (best for long conversations)
- **session** - Single-session only (lowest cost, no history)

**Why it matters:**

- Save costs on long conversations
- Keep full context for better reasoning
- Trade off cost vs. context retention

**How to use:**

```bash
/memory-mode hierarchy              # Switch to hierarchy mode
/memory-mode session               # Switch to session-only
export RYFT_MEMORY_MODE=normal # Set default
```

See: [Memory Modes Guide](../guides/memory-modes.md)

## Feature Specifications

### Token Budget

- **Default limit:** 4096 tokens/session
- **Soft warnings:** At 70% and 90%
- **Hard limits:** None (responses may shorten)
- **Reset:** Use `/compact` command

### File Tool Limits

- **Single file:** 100KB max (read)
- **Multiple files:** 50KB each max (read)
- **Directory listing:** 1000 items max
- **File write:** Up to 50MB per file
- **Text files only:** Binary files not supported

### Browser Automation

- **Chrome version:** Recent (stable or beta)
- **Debugger port:** 9222 (configurable)
- **Screen size:** 1920x1080 (default)
- **Timeout:** 30 seconds per operation

### MCP Server Specs

- **Protocol:** JSON-RPC 2.0 over stdio
- **Auto-spawn:** On first tool use
- **Auto-cleanup:** On session end
- **Max servers:** Depends on resources

## Implementation Details

### Feature: Working Directory Auto-Detection

**Problem:** Ryft needed to know which project to analyze.

**Solution:** Auto-detect current working directory.

**How it works:**

- File tools check `RYFT_ORIGINAL_CWD` env var
- Falls back to process working directory
- Explicit `--cwd` flag can override

See: [Working Directory Resolution](./cwd-resolution.md)

### Feature: Built-in File Tools

**Problem:** Skills couldn't read files without external tools.

**Solution:** Implement 4 built-in file reading tools.

**Implementation:**

- `src/tools/fileReader.ts` - File operations
- `src/mcp/builtin-tools.ts` - Tool registration
- Auto-registered at session startup

See: [Issue Resolution](./issue-resolution.md)

## Planned Features

Features being developed:

- [ ] Persistent memory across sessions
- [ ] Custom tool registration
- [ ] Plugin system
- [ ] Web dashboard
- [ ] Team collaboration
- [ ] Advanced caching

---

## Feature Catalog

| Feature         | Status    | Mode          | Documentation                         |
| --------------- | --------- | ------------- | ------------------------------------- |
| Token Budgeting | ✅ Active | All           | [Link](../guides/token-management.md) |
| File Tools      | ✅ Active | All           | [Link](../guides/file-tools.md)       |
| Browser Auto    | ✅ Active | browser-surff | [Link](../modes/browser-surff.md)     |
| Session Persist | ✅ Active | browser-surff | [Link](../modes/browser-surff.md)     |
| Multi-Mode      | ✅ Active | All           | [Link](../modes/README.md)            |
| Skills System   | ✅ Active | All           | [Link](../skills/README.md)           |
| Debug Logging   | ✅ Active | All           | [Link](../guides/logging.md)          |

## See Also

- [Architecture Overview](../architecture/README.md) - Design details
- [Feature Delivery Reports](./README.md) - Implementation reports
- [Modes Documentation](../modes/README.md) - Feature availability
