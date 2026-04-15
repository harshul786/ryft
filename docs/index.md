# Ryft Documentation

Welcome to the Ryft documentation. This guide will help you understand, install, use, and extend Ryft - a lean, multi-provider AI code assistant that works with OpenAI, Anthropic Claude, Google Gemini, Ollama, and other OpenAI-compatible models.

## Quick Links

### 👤 New Users

- **[Getting Started](./getting-started/README.md)** - Installation and first steps
- **[Installation](./getting-started/installation.md)** - Detailed setup guides
- **[Quick Start](./getting-started/quick-start.md)** - Get running in 5 minutes

### 🛠️ Development

- **[Development Guide](./skills/development.md)** - How to build and extend Ryft
- **[Architecture Overview](./architecture/README.md)** - System design and components
- **[Tools Reference](./tools/README.md)** - Tool API reference

### 📚 Core Concepts

- **[Core Concepts](./core-concepts/README.md)** - Modes, skills, and features
- **[Modes](./core-concepts/modes.md)** - Coder, Browser-Surff, Debugger
- **[Skills & Tools](./core-concepts/skills.md)** - Available capabilities

### ⚙️ Operations & Configuration

- **[Operations](./operations/README.md)** - How to use Ryft
- **[Memory Management](./memory/README.md)** - Context strategies (normal, hierarchy, session)
- **[Configuration](./configuration/README.md)** - Tokens, logging, and more
- **[Troubleshooting](./troubleshooting/README.md)** - Common issues and solutions

---

## What is Ryft?

Ryft is a lean, fast AI code assistant that works with multiple LLM providers. It combines:

- 🚀 **Multi-provider LLM support** - OpenAI, Anthropic Claude, Google Gemini, Ollama, and OpenAI-compatible APIs
- 🎨 **Composable modes** (coder, browser-surff, debugger)
- 🔗 **Auto-discovered MCP servers** with on-demand spawning
- 🌐 **Browser automation** with session state persistence
- 💾 **Smart token budgeting** with soft warnings (no hard limits)
- 🧠 **Multiple memory modes** - normal, hierarchical, and session-based contexts
- 💾 **Configuration management** (file + CLI precedence)
- ⚡ **Fast startup** with lazy initialization
- 🛠️ **File operations** - Read, write, and modify files directly
- 🧠 **Extended thinking** - Claude-only support for deep reasoning (awaiting OpenAI updates)

---

## Getting Started

### 1. Prerequisites

- **Node.js**: ≥20.0.0
- **npm**: ≥10.0.0
- **Git**: For version control
- **LLM API Key**: Get from one of:
  - [OpenAI](https://platform.openai.com/api-keys) (GPT-4o, GPT-4-turbo)
  - [Anthropic](https://console.anthropic.com/) (Claude 3.5, Claude 3)
  - [Google](https://makersuite.google.com/app/apikey) (Gemini)
  - [Ollama](https://ollama.ai) (Local models)

### 2. Quick Install (5 minutes)

```bash
# Clone the repository
git clone <repository-url> ryft
cd ryft

# Install dependencies
npm install

# Set up API key (choose one)
export OPENAI_API_KEY=sk-your-key-here      # OpenAI
# OR
export ANTHROPIC_API_KEY=sk-ant-...         # Claude
# OR
export GOOGLE_API_KEY=...                   # Gemini

# Run Ryft
npm start
# or install globally: npm link
# then run: ryft
```

### 3. First Command

```bash
ryft> What does this function do?
<paste code>

ryft> Generate unit tests

ryft> /help
```

---

## Documentation Structure

```
docs/
├── getting-started/        # Installation and quick start
│   ├── README.md          # Getting started overview
│   ├── installation.md    # Detailed installation guide
│   └── quick-start.md     # 5-minute quick start
│
├── core-concepts/          # Understanding Ryft fundamentals
│   ├── README.md          # Overview
│   ├── features.md        # Ryft features
│   ├── modes.md           # Modes overview
│   ├── modes-coder.md     # Coder mode details
│   ├── modes-browser-surff.md   # Browser-Surff mode
│   ├── modes-debugger.md  # Debugger mode
│   └── skills.md          # Skills reference
│
├── operations/             # How to use Ryft
│   ├── README.md          # Operations overview
│   ├── file-tools.md      # File reading and writing
│   ├── running-from-directories.md  # Working directory
│   ├── direct-command.md  # Global installation
│   └── logging.md         # Debugging with logs
│
├── configuration/          # Customize Ryft
│   ├── README.md          # Configuration overview
│   ├── memory-modes.md    # Context management
│   ├── token-management.md # Token tracking
│   └── logging.md         # Logging configuration
│
├── tools/                  # Tool reference
│   ├── README.md          # Tools overview
│   └── builtin-tools.md   # Built-in file tools API
│
├── skills/                 # Skills development
│   ├── README.md          # Skills overview
│   └── development.md     # Creating custom skills
│
├── architecture/           # System design (developers)
│   ├── README.md          # Architecture overview
│   ├── mcp-integration.md # MCP servers
│   └── tool-calling.md    # Tool dispatch system
│
├── troubleshooting/        # Problem solving
│   ├── README.md          # Troubleshooting guide
│   ├── cwd-resolution.md  # Working directory issues
│   └── issue-resolution.md # Common problems
│
└── index.md               # This file
```

---

## Key Concepts

### Modes

Ryft operates in composable modes, each providing different capabilities:

- **Coder** - Code analysis and generation (default)
- **Browser-Surff** - Browser automation
- **Debugger** - Process debugging

### Skills

Skills are specialized capabilities that modes provide. For example:

- Code analysis
- Documentation generation
- Testing
- Debugging

### Token Budgeting

Ryft tracks token usage and warns you when approaching limits:

- Default: 4096 tokens per session
- Soft warnings at 70% and 90%
- No hard limits, but responses may be shortened

### MCP Servers

Model Context Protocol servers provide tools to Ryft:

- Auto-discovered from mode packs
- Spawn on-demand when needed
- Tools compressed for efficiency

---

## Common Commands

```bash
# Switch modes
/mode browser-surff
/mode coder,browser-surff,debugger

# Configuration
/config view
/config set model openai/gpt-4o
/config set apiKey sk-...

# Monitor usage
/tokens
/tokens detailed

# Navigation
/help
exit
```

---

## Learning Path

1. **Start here**: [Getting Started](./getting-started/README.md)
2. **Install**: [Installation Guide](./getting-started/installation.md)
3. **Learn basics**: [Quick Start](./getting-started/quick-start.md)
4. **Explore modes**: [Modes Documentation](./modes/README.md)
5. **Understand tools**: [Tools Reference](./tools/README.md)
6. **Develop extensions**: [Development Guide](./skills/development.md)

---

## Contributing

To contribute documentation:

1. Follow the existing structure
2. Use markdown with proper formatting
3. Include examples and code blocks
4. Link to related documentation
5. Keep content up-to-date

---

## Support

- **Issues**: See [Troubleshooting](./troubleshooting/README.md)
- **Development**: See [Development Guide](./skills/development.md)
- **Architecture**: See [Architecture Overview](./architecture/README.md)

---

## License

See LICENSE in the root directory.
