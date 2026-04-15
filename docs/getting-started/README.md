# Getting Started with Ryft

Welcome to Ryft! This guide will help you get up and running quickly.

## What is Ryft?

Ryft is a lean, fast AI code assistant that works with multiple LLM providers (OpenAI, Anthropic, Google Gemini, Ollama, and compatible APIs). It combines:

- **Multi-provider LLM support** - Works with OpenAI, Anthropic Claude, Google Gemini, Ollama, and OpenAI-compatible APIs
- **Composable modes** for different tasks (coder, browser-surff, debugger)
- **Smart token budgeting** with soft warnings (70%, 90%)
- **Multiple memory modes** (normal, hierarchical, session-based contexts)
- **Browser automation** with session persistence
- **File operations** - Read, write, and edit files directly
- **Integrated MCP servers** with tool discovery

## Prerequisites

Before you start, make sure you have:

- **Node.js** ≥20.0.0 - [Download](https://nodejs.org/)
- **npm** ≥10.0.0 - Comes with Node.js
- **Git** - For cloning the repository
- **LLM API Key** - Choose one provider:
  - [OpenAI API Key](https://platform.openai.com/api-keys) for GPT-4o/GPT-4
  - [Anthropic API Key](https://console.anthropic.com/) for Claude 3.5
  - [Google API Key](https://makersuite.google.com/app/apikey) for Gemini
  - [Ollama](https://ollama.ai) for local models

Check your versions:

```bash
node --version    # Should be ≥20.0.0
npm --version     # Should be ≥10.0.0
git --version     # Any recent version is fine
```

## Installation

### Quick Install (5 minutes)

```bash
# 1. Clone the repository
git clone <repository-url> ryft
cd ryft

# 2. Install dependencies
npm install

# 3. Configure API key (choose one):
# For OpenAI:
export OPENAI_API_KEY=sk-your-key-here

# OR for Anthropic:
export ANTHROPIC_API_KEY=sk-ant-...

# OR for Google:
export GOOGLE_API_KEY=...

# OR for Ollama (local):
export OLLAMA_MODEL=llama2

# 4. Start Ryft
npm start
```

Or follow the [detailed installation guide](./installation.md) for more options.

## First Steps

Once Ryft is running, you'll see:

```bash
🤖 Ryft CLI v0.1.0
Model: openai/gpt-4o

ryft [openai/gpt-4o]>
```

Try some commands:

```bash
# Get help
ryft> /help

# View your configuration
ryft> /config view

# Check token usage
ryft> /tokens

# Ask Ryft something
ryft> Analyze this code
<paste your code here>

# Switch to browser mode
ryft> /mode browser-surff

# Exit
ryft> exit
```

## Key Commands

| Command                   | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `/help`                   | Show all available commands                   |
| `/mode <name>`            | Switch modes (coder, browser-surff, debugger) |
| `/model <id>`             | Change AI model (gpt-4o, gpt-4, etc.)         |
| `/config view`            | View current settings                         |
| `/config set <key> <val>` | Change a setting                              |
| `/tokens`                 | Show token usage                              |
| `exit`                    | Quit Ryft                                     |

## Common Tasks

### Ask Ryft to Analyze Code

```
ryft> Analyze this TypeScript code:
<paste your code>
```

### Generate Documentation

```
ryft> Document the whole project for me
```

### Use Browser Automation

```
ryft> /mode browser-surff
ryft> Navigate to example.com and summarize the content
```

### Switch Models

```
ryft> /model gpt-4-turbo
✓ Model set to openai/gpt-4-turbo
```

## Next Steps

1. **Learn about modes**: See [Modes](../modes/README.md)
2. **Explore tools**: See [Tools & Skills](../tools/README.md)
3. **Read guides**: See [Guides](../guides/README.md)
4. **Troubleshoot issues**: See [Troubleshooting](../troubleshooting/README.md)

## Need Help?

- **Installation issues**: See [Installation Guide](./installation.md)
- **Can't find your API key**: See [Configuration](./installation.md#setup-api-key)
- **Chrome won't start**: See [Troubleshooting](../troubleshooting/README.md)
- **Other problems**: See [Common Issues](../troubleshooting/common-errors.md)

## What to Do Next

- Follow the [Quick Start](./quick-start.md) for a 5-minute tutorial
- Read the [Installation Guide](./installation.md) for detailed setup options
- Check out the [Modes Documentation](../modes/README.md) to understand different ways to use Ryft

**Ready? Let's go: `npm start`** 🚀
