# Skills Documentation

Learn about skills and how to create your own.

## What are Skills?

Skills are specialized AI-powered capabilities that Ryft provides. Each skill focuses on a specific task:

- **Analyze** - Understand code and explain it
- **Document** - Generate documentation
- **Refactor** - Suggest improvements
- **Generate** - Create code from descriptions
- **Debug** - Help identify and fix bugs

## Available Skills by Mode

Ryft includes **12 total skills across 4 packs**:

### Coder Mode Skills (6 skills)

- **analyze** - Code analysis and explanation
  - Understand what code does
  - Identify patterns and design
  - Explain complex logic
  
- **document** - Generate project/file documentation
  - Create README files
  - Generate API documentation
  - Document modules and functions
  
- **refactor** - Suggest code improvements
  - Identify code smells
  - Suggest better patterns
  - Optimize performance
  
- **generate** - Generate code from requirements
  - Create new functions/components
  - Build modules from scratch
  - Fix bugs
  
- **test** - Generate unit tests
  - Create test cases
  - Generate test suites
  - Set up testing frameworks
  
- **debug** - Debugging assistance
  - Identify bugs and issues
  - Suggest fixes
  - Trace execution

### Browser Mode Skills (3+ skills)

- **navigate** - Open and browse URLs
  - Open URLs and navigate pages
  - Follow links
  - Browse multi-page sites
  
- **extract** - Extract data from web pages
  - Scrape content
  - Find specific information
  - Parse structured data
  
- **interact** - Click elements, fill forms
  - Click buttons and links
  - Fill text fields and forms
  - Trigger interactions

### Debugger Mode Skills

- Debugging and inspection capabilities
- Stack trace analysis
- Variable inspection
- Execution flow tracking

### Shared Skills (2+ skills)

- **memory** - Manage conversation context
  - View memory state
  - Clear history
  - Switch memory modes (normal, hierarchy, session)
  
- **compact** - Reset session tokens
  - Clear old messages
  - Reset context
  - Start fresh session

## Using Skills

Skills are invoked automatically when you ask for something:

```bash
ryft> Analyze this function
# Uses: analyze skill

ryft> Create tests for this code
# Uses: test skill

ryft> Document this project
# Uses: document skill

ryft> Navigate to example.com and summarize
# Uses: navigate + extract skills
```

You can also explicitly trigger skills:

```bash
ryft> /skill analyze
<paste code>

ryft> /skill document
<documentation request>
```

## Skill Capabilities

Each skill includes:

- **Description** - What it does
- **Usage Examples** - How to use it
- **Tools** - What tools it can use (file reading, browser, etc.)
- **Context** - How it works internally

## Creating Custom Skills

To extend Ryft with your own skills:

### Step 1: Create Skill File

```markdown
# My Custom Skill

Description of what this skill does.

## Context

Explain how the skill works.

## Usage

Show examples of how to use it.
```

### Step 2: Place in Pack

```
packs/coder/skills/my-skill/SKILL.md
```

### Step 3: Enable in Pack Config

Update `packs/coder/pack.json`:

```json
{
  "skills": [
    { "name": "my-skill", "enabled": true }
  ]
}
```

### Step 4: Test

```bash
ryft> /mode coder
ryft> ask about your skill
```

## Skill Structure

### File Format

Skills are documented in markdown (SKILL.md):

```markdown
# Skill Name

One-line description.

## Context

Detailed explanation of what the skill does and how it works.

## Usage

Show examples of how to use the skill.

## Tools

List of tools this skill uses:
- Built-in: file reading
- Browser: navigation
- MCP: custom servers
```

### YAML Frontmatter (Optional)

```yaml
---
name: skill-name
description: Brief description
tools:
  - read_text
  - list_dir
enabled: true
---

# Skill Name
...
```

## Best Practices for Skills

1. **One responsibility** - Each skill should do one thing well
2. **Clear names** - Descriptive, lowercase-with-hyphens
3. **Good documentation** - Examples and context
4. **Right tool** - Use appropriate tools for the job
5. **Token efficient** - Minimize context sent to model

## Skill Performance Tips

- Use file tools strategically
- Read only necessary files
- Batch read related files
- Provide targeted context to model
- Include examples in prompts

## Debugging Skills

### Check if Skill Loads

```bash
ryft> /tokens
# Lists all available skills
```

### Enable Logging

```bash
RYFT_LOG_LEVEL=debug npm start
/skill my-skill
# Check logs: ryft logs view general Skills
```

### Verify Pack Config

```bash
# Check pack definition
cat packs/coder/pack.json
```

## Skill Limitations

- No persistent state between sessions
- Cannot modify files (read-only by default)
- Max context size per skill
- Network access restricted

## Advanced: Multi-Tool Skills

Skills can use multiple tools in sequence:

```
1. list_dir() to find files
2. read_multiple() to read related files
3. Process and analyze
4. Return formatted results
```

Example:

```bash
ryft> Document this project
# Skill workflow:
# 1. list_dir(".") → find structure
# 2. read_text("package.json") → get metadata
# 3. list_dir("src") → find modules
# 4. read_multiple([key files]) → read core files
# 5. Generate documentation
```

## See Also

- [Development Guide](./development.md) - Detailed development guide
- [Tools & Skills](../tools/README.md) - Available tools
- [Architecture](../architecture/README.md) - How skills are invoked
