# Quick Start - 5 Minute Tutorial

Get Ryft running and using it in 5 minutes!

## TL;DR

```bash
# 1. Clone
git clone <repo> ryft
cd ryft

# 2. Install
npm install

# 3. Setup (choose one provider)
npm link              # Or: npm start

# For OpenAI:
export OPENAI_API_KEY=sk-your-key-here
# OR for Anthropic:
export ANTHROPIC_API_KEY=sk-ant-...
# OR for Google:
export GOOGLE_API_KEY=...
# OR for Ollama:
export OLLAMA_MODEL=llama2

# 4. Run
ryft

# 5. Try it
ryft> Analyze this code
<paste your code>
```

## Detailed Steps (5 minutes)

### Minute 1: Clone and Install

```bash
git clone <repository-url> ryft
cd ryft
npm install
```

### Minute 2: Setup API Key

Ryft works with multiple providers. Choose one:

```bash
# OpenAI
export OPENAI_API_KEY=sk-your-key-here

# Anthropic Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
export GOOGLE_API_KEY=...

# Ollama (local)
export OLLAMA_MODEL=llama2

# Or use config file (permanent)
echo '{"provider":"openai","apiKey":"sk-..."}' > ~/.ryftrc
```

### Minute 3: Install Globally (Optional)

```bash
npm link

# Verify
which ryft    # Should show /opt/homebrew/bin/ryft
```

### Minute 4: Start Ryft

```bash
# Option 1: If you installed globally
ryft

# Option 2: Development mode
npm start
```

You should see:

```
🤖 Ryft CLI v0.1.0
Model: openai/gpt-4o

ryft [openai/gpt-4o]>
```

### Minute 5: Try Examples

#### Ask about code

```bash
ryft> What does this function do?
function fibonacci(n) {
  return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);
}

# Ryft analyzes and explains
```

#### Generate tests

```bash
ryft> Generate unit tests for this function
# <paste code>

# Ryft generates test cases
```

#### Use browser mode

```bash
ryft> /mode browser-surff
ryft> Navigate to example.com and summarize the content

# Chrome launches and Ryft analyzes the page
```

#### Check token usage

```bash
ryft> /tokens

🟢 45/4096 tokens (1%)
```

## Basic Commands

Learn these 5 commands:

```bash
/help                     # Show all commands
/mode <name>              # Switch modes: coder, browser-surff, debugger
/config view              # View settings
/config set <key> <val>   # Update setting
exit                      # Quit
```

## Modes Explained

- **coder** (default) - Code analysis and generation
- **browser-surff** - Browser automation
- **debugger** - Debugging support

Switch modes:

```bash
ryft> /mode browser-surff
ryft> /mode coder,browser-surff    # Multiple modes
```

## Common Workflows

### Workflow 1: Code Review

```bash
# 1. Copy code
# 2. Start Ryft
ryft

# 3. Ask for review
ryft> Review this code for issues
<paste code>

# 4. Read feedback
```

### Workflow 2: Documentation

```bash
# 1. Start from your project directory
cd myproject
cd ../ryft && npm start

# 2. Ask Ryft to document
ryft> Document the whole project for me

# 3. Ryft analyzes and creates docs
```

### Workflow 3: Bug Debugging

```bash
# 1. Start Ryft
npm start

# 2. Paste your code
ryft> Debug this code
<paste your function>

# 3. Describe the bug
ryft> When I call it with X, it returns Y instead of Z

# 4. Get debugging help
```

### Workflow 4: Browser Automation

```bash
# 1. Switch to browser mode
ryft> /mode browser-surff

# 2. Ask Ryft to use the browser
ryft> Open google.com and search for "Ryft AI"

# 3. Ask questions about the page
ryft> What are the top 3 results?
```

## Settings to Know

View all settings:

```bash
ryft> /config view

Current Configuration:
  model         openai/gpt-4o
  apiKey        [SET]
  defaultModes  coder
  logLevel      info
```

Change settings:

```bash
# Different model
ryft> /config set model openai/gpt-4-turbo

# Enable logs
ryft> /config set logLevel debug

# Default modes on startup
ryft> /config set defaultModes coder,browser-surff
```

## Troubleshooting

### "OPENAI_API_KEY not set"

```bash
export OPENAI_API_KEY=sk-your-key-here
npm start
```

### "ryft: command not found"

```bash
npm link    # Make sure you're in ryft directory
```

### Chrome won't start

```bash
# Check Chrome is installed
open -a "Google Chrome" --version

# Set path if needed
export CHROME_BIN=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### Slow or hanging

```bash
# Check token usage
/tokens

# If high, use:
/compact
```

## Next Steps

1. **Read more**: [Getting Started](./README.md)
2. **Installation details**: [Installation Guide](./installation.md)
3. **Learn modes**: [Modes](../modes/README.md)
4. **Explore features**: [Tools & Skills](../tools/README.md)
5. **Get help**: [Troubleshooting](../troubleshooting/README.md)

## Tips & Tricks

- **Copy code easily**: Use triple backticks when pasting:

  ```
  ryft> Analyze this:
  ```

  function hello() { return "hi"; }

  ```

  ```

- **Save sessions**: Configurations auto-save to `~/.ryftrc`

- **Multiple modes**: Use comma-separated list:

  ```
  /mode coder,browser-surff,debugger
  ```

- **Token conscious**: Type `/tokens` to check usage

---

**Ready to go deeper?** Visit the [full documentation](../index.md) 🚀
