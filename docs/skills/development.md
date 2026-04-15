# Skills Development Guide

Comprehensive guide for building custom skills in Ryft.

## Getting Started

Skills are markdown files that describe AI capabilities. They're how you extend Ryft's functionality.

### Skill File Structure

```
packs/<mode>/skills/<skill-name>/
├── SKILL.md          # Skill documentation
└── (optional files)
```

### Minimal Skill Example

**File: `packs/coder/skills/analyze-json/SKILL.md`**

```markdown
# Analyze JSON

Analyzes JSON structures and explains the schema.

## Context

This skill reads JSON files and describes:

- Structure and hierarchy
- Data types
- Purpose of each field
- Potential issues

## Usage

Ask Ryft to analyze a JSON file:

\`\`\`
Ryft> Analyze this JSON structure
{
"name": "John",
"age": 30
}
\`\`\`

Ryft will describe the structure and suggest improvements.
```

## Skill Components

### 1. Skill Name (Markdown H1)

```markdown
# Skill Display Name
```

Should be:

- Descriptive
- Clear about what it does
- Human-readable

### 2. Description (Subtitle)

```markdown
# Skill Name

One-line description of what this skill does.
```

Keep it short and actionable.

### 3. Context Section

```markdown
## Context

Detailed explanation of:

- What the skill does
- How it works
- When to use it
- What tools it can use
```

This helps the AI understand when and how to use the skill.

### 4. Usage Section

```markdown
## Usage

Examples of how to invoke the skill:

### Example 1: Basic Usage

\`\`\`
User: Analyze this code
Model uses the skill...
Result: ...
\`\`\`

### Example 2: Advanced Usage

\`\`\`
User: Find performance issues
Model uses the skill...
Result: ...
\`\`\`
```

Include realistic examples.

## Advanced: YAML Frontmatter

Add metadata to your skill:

```yaml
---
name: skill-identifier # Used internally
label: Display Name # Show to user
description: Brief desc # For listings
tools: # Tools this
  skill uses
  - read_text
  - list_dir
enabled: true # Enabled by default
---
# Skill Name

...rest of markdown...
```

## Skill Best Practices

### 1. Single Responsibility

Each skill should do ONE thing well:

✅ Good:

```markdown
# Analyze JSON Structure

Analyzes and explains JSON schemas.
```

❌ Too broad:

```markdown
# Analyze Everything

Analyzes code, JSON, XML, etc.
```

### 2. Clear Naming

Use descriptive, lowercase-with-hyphens:

✅ Good: `analyze-performance`, `extract-data`, `find-bugs`

❌ Avoid: `do-stuff`, `process`, `general-tool`

### 3. Rich Context

Help the AI understand your skill:

```markdown
## Context

This skill helps analyze JSON files by:

1. Reading the JSON structure
2. Identifying patterns
3. Checking for common issues
4. Suggesting improvements

Use this when you want to understand:

- Schema of a data structure
- Relationships between fields
- Data validation needs
- Performance implications
```

### 4. Practical Examples

Show real usage scenarios:

```markdown
## Usage

### Example: API Response Analysis

\`\`\`
User: Analyze this API response structure
{
"data": [...],
"meta": {...}
}
Result: Description of structure and recommendations
\`\`\`

### Example: Schema Validation

\`\`\`
User: Check this config schema for issues
{
"database": {...}
}
Result: Validation report
\`\`\`
```

### 5. Tool Documentation

List what tools your skill uses:

```markdown
## Tools Used

This skill can use:

- **read_text** - Read JSON files
- **list_dir** - Find JSON files in projects
- **read_multiple** - Read multiple related JSON files

No external tools required.
```

## Creating Your First Skill

### Step 1: Plan Your Skill

```
What does it do? Validate TypeScript config files
When to use? When working with tsconfig.json
What tools? File reading (built-in)
How to invoke? "Validate my TypeScript config"
```

### Step 2: Create the Skill File

```
mkdir -p packs/coder/skills/validate-tsconfig
touch packs/coder/skills/validate-tsconfig/SKILL.md
```

### Step 3: Write the Skill

```markdown
# Validate TypeScript Configuration

Analyzes tsconfig.json files and validates configuration.

## Context

This skill helps understand and validate TypeScript configurations by:

1. Reading tsconfig.json
2. Explaining all settings
3. Identifying potential issues
4. Suggesting improvements for:
   - Performance
   - Compatibility
   - Strictness

Use this skill when:

- Setting up a new TypeScript project
- Troubleshooting TypeScript errors
- Optimizing compiler settings

## Usage

### Example: Validate Config

\`\`\`
User: Check my TypeScript configuration
Result: Analysis of tsconfig.json settings
\`\`\`

### Example: Optimize Settings

\`\`\`
User: Suggest TypeScript strict mode settings
Result: Recommended configuration changes
\`\`\`
```

### Step 4: Register in Pack

Edit `packs/coder/pack.json`:

```json
{
  "skills": [
    { "name": "validate-tsconfig", "enabled": true },
    { "name": "analyze", "enabled": true }
  ]
}
```

### Step 5: Test Your Skill

```bash
npm start
/mode coder

ryft> Validate my TypeScript config
{
  "compilerOptions": {
    "strict": true
  }
}
```

## Working with Tools

### Using File Reading Tools

Skills automatically have access to file tools:

```markdown
## Context

This skill can:

- Read configuration files
- List directories to find configs
- Compare multiple versions

Example process:

1. read_text("config.ts") → get file
2. read_multiple([...]) → get related files
3. list_dir(".") → find more configs
```

### Using Conditionally

Skills can suggest when to use tools:

```markdown
## Usage

The skill might:

- Ask you to paste code (simple)
- Read files directly (for projects)
- Explore directory structure (for large analysis)
```

## Multi-Skill Workflows

Skills can complement each other:

```
1. analyze skill → Understand code
2. generate skill → Create tests
3. refactor skill → Improve implementation

User: Analyze this, fix it, and add tests
Result: All three skills work in sequence
```

## Skill Performance Tips

### 1. Minimize Context

Only describe necessary context:

✅ Good:

```markdown
## Context

Validates JSON against basic schema rules.
```

❌ Too long:

```markdown
## Context

JSON Schema validation was invented by...
Here's the complete history...
[pages of background]
```

### 2. Focused Examples

Show specific, realistic scenarios:

✅ Good:

```
Analyze a React component
Generate tests for a function
```

❌ Too generic:

```
Analyze something
Process things
```

### 3. Tool Efficiency

Suggest efficient tool usage:

```markdown
## Context

This skill:

- First lists directory (minimal tokens)
- Then reads key files only
- Avoids reading large files unnecessarily
```

## Debugging Your Skill

### Check if Skill Loads

```bash
/tokens
# Should list your skill if in active mode

/mode coder  # Reload mode
```

### Enable Debug Logging

```bash
RYFT_LOG_LEVEL=debug npm start

# Use your skill
ryft> <describe what your skill should do>

# Check logs
ryft logs view general
```

### Test in Isolation

```bash
# Start fresh instance
npm start
/mode coder

# Try just your skill
ryft> <test your skill directly>
```

## Publishing Your Skill

### Share with Community

1. Put skill pack in a GitHub repo
2. Document in README
3. Include examples
4. Share the link

### Within Organization

1. Add to shared packs directory
2. Document in company wiki
3. Add to internal skill registry

## Advanced: Skill Hooks (Future)

Planned features for skills:

- Before/after hooks
- Skill composition
- Conditional logic
- Custom tool registration

## See Also

- [Skills Documentation](./README.md) - Overview
- [Tools & Skills](../tools/README.md) - Tools reference
- [Modes Documentation](../modes/README.md) - Mode packs
- [Architecture](../architecture/README.md) - System design
