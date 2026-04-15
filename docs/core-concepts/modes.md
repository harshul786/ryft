# Ryft Modes

Understand and use Ryft's different operational modes.

## What are Modes?

Modes are different operational contexts that Ryft can run in. Each mode provides specific tools and capabilities for particular tasks.

## Available Modes

### Coder Mode

The default mode for code analysis and generation.

**Capabilities:**
- Code analysis and explanation
- Documentation generation
- Test generation
- Code refactoring suggestions
- Bug detection and debugging

**Skills:**
- analyze - Understand code
- document - Generate documentation
- refactor - Improve code
- generate - Write new code
- test - Create tests
- debug - Help fix issues

**When to use:**
- Analyzing source code
- Writing or debugging code
- Generating documentation
- Understanding projects

**Example:**
```bash
/mode coder
ryft> Analyze this function
ryft> Generate tests for this class
ryft> Document this module
```

---

### Browser-Surff Mode

Automate web browsing and extract information from websites.

**Capabilities:**
- Open and navigate URLs
- Execute JavaScript on pages
- Take screenshots
- Extract data from HTML
- Fill forms and click elements
- Access browser DevTools

**Skills:**
- navigate - Go to URLs and browse
- extract - Get information from pages
- interact - Click buttons, fill forms
- screenshot - Capture page content

**When to use:**
- Browser automation tasks
- Web scraping
- Testing web applications
- Analyzing websites

**Example:**
```bash
/mode browser-surff
ryft> Navigate to example.com and tell me about it
ryft> Search for "Ryft AI" on Google
ryft> Screenshot this page
```

---

### Debugger Mode

Advanced debugging and process inspection.

**Capabilities:**
- Process inspection
- Variable examination
- Breakpoint management  
- Stack trace analysis
- Memory profiling

**When to use:**
- Debugging running processes
- Performance analysis
- Memory investigation
- Complex issue diagnosis

**Example:**
```bash
/mode debugger
ryft> Analyze this stack trace
ryft> Debug memory leak in this code
```

---

## Using Modes

### Switch to a Single Mode

```bash
/mode coder          # Switch to coder
/mode browser-surff  # Switch to browser
/mode debugger       # Switch to debugger
```

### Use Multiple Modes

Combine modes to get their tools:

```bash
/mode coder,browser-surff
# Now you have both coder AND browser tools

/mode coder,browser-surff,debugger
# Use all three modes together
```

### Check Active Modes

```bash
/tokens
# Shows which modes are active and their tool counts
```

### Reset to Default

```bash
/mode coder
# Back to just coder mode
```

## Mode Switching Workflow

### From Coder to Browser

```bash
# Start with code analysis
ryft> /mode coder
ryft> Analyze src/api.ts

# Now switch to browser to test it
ryft> /mode browser-surff

# Use browser tools
ryft> Start a local server and test this API
```

### From Browser to Coder

```bash
# Start by extracting data from web
ryft> /mode browser-surff
ryft> Extract all links from github.com/trending

# Switch to coder to process results
ryft> /mode coder
ryft> Organize this data and create a summary
```

## Mode Capabilities Comparison

| Feature | Coder | Browser | Debugger |
|---------|-------|---------|----------|
| Code Analysis | ✅ | ✅ | ✅ |
| Documentation | ✅ | ❌ | ❌ |
| Code Generation | ✅ | ❌ | ❌ |
| Browser Tasks | ❌ | ✅ | ❌ |
| Web Scraping | ✅†  | ✅ | ❌ |
| Debugging | ✅ | ❌ | ✅ |

†Coder mode can read files but not automate browser

## Default Mode on Startup

By default, Ryft starts with coder mode:

```bash
ryft
# Starts with /mode coder
```

### Change Default

Permanently change default mode:

```bash
/config set defaultModes coder,browser-surff
```

Or just add to startup:

```bash
ryft --mode browser-surff
```

## Mode Details

### Coder Mode Deep Dive

See [Coder Mode Documentation](./coder.md)

Skills, tools, and examples for code analysis.

### Browser Mode Deep Dive

See [Browser Mode Documentation](./browser-surff.md)

Browser automation, web scraping, and testing.

### Debugger Mode Deep Dive

See [Debugger Mode Documentation](./debugger.md)

Process debugging and analysis.

## Token Usage by Mode

Each mode uses different amounts of tokens:

```bash
ryft> /tokens

Token Budget Breakdown:
  coder:      150 tokens (skills, tools)
  browser:    200 tokens (browser tools)
  debugger:   100 tokens (debugging symbols)
  Total:      450 / 4096 tokens (11%)
```

Fewer active modes = Lower token usage

### Optimization

- Use only the modes you need
- Switch modes when done with one task
- Reset with `/compact` if token usage high

## Common Workflows

### Workflow 1: Code Review with Browser Testing

```bash
1. /mode coder
2. Review the code
3. /mode browser-surff
4. Test the application
5. /mode coder
6. Provide feedback
```

### Workflow 2: Web Scraping with Data Processing

```bash
1. /mode browser-surff
2. Navigate and extract data
3. /mode coder
4. Process and analyze data
5. Generate report
```

### Workflow 3: Multi-Mode Analysis

```bash
1. /mode coder,browser-surff,debugger
2. Analyze all aspects
3. Process results
4. Generate recommendations
```

## Troubleshooting

### Mode Not Available

```bash
# Check modes exist
ls packs/*/pack.json

# Check config
/config view
```

### Tools Not Showing

```bash
# Switch mode
/mode <name>

# Check with
/tokens

# If still missing, start fresh
exit
ryft
```

### High Token Usage

```bash
# Check what's active
/tokens

# Remove unneeded modes
/mode coder  # Just coder

# Or reset
/compact
```

## See Also

- [Coder Mode](./coder.md) - Code analysis details
- [Browser Mode](./browser-surff.md) - Web automation details
- [Debugger Mode](./debugger.md) - Debugging guide
- [Token Management](../guides/token-management.md) - Token optimization
