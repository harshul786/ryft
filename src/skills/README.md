# Ryft Skills System

Complete guide to Ryft's extensible skill system, including discovery, metadata, execution contexts, and tool policies.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Skill Format](#skill-format)
3. [YAML Frontmatter](#yaml-frontmatter)
4. [Metadata Fields](#metadata-fields)
5. [Execution Contexts](#execution-contexts)
6. [Tool Policies](#tool-policies)
7. [Conditional Activation](#conditional-activation)
8. [Discovery & Registration](#discovery--registration)
9. [Examples](#examples)

---

## Quick Start

### Creating a Basic Skill

1. Create a directory for your skill in a skill root:
   ```
   Ryft/packs/shared/skills/my-skill/SKILL.md
   ```

2. Write the skill file with YAML frontmatter and markdown content:
   ```markdown
   ---
   title: My Skill
   description: What this skill does
   context: inline
   ---
   
   # My Skill
   
   This is my skill implementation...
   ```

3. The skill is automatically discovered and loaded when Ryft starts.

### Skill Discovery Locations

Skills are discovered from multiple sources (in order of precedence):

- **Mode-specific**: `Ryft/packs/{mode-name}/skills/`
- **Shared**: `Ryft/packs/shared/skills/`
- **Project-level**: `.ryft/skills/` (future)
- **User-level**: `~/.ryft/skills/` (future)

---

## Skill Format

### Directory Structure

Skills are organized by name in subdirectories:

```
packs/shared/skills/
├── edit/
│   └── SKILL.md
├── debug/
│   └── SKILL.md
└── browser/
    └── SKILL.md
```

The directory name becomes the skill's unique identifier. The skill file must be named `SKILL.md` (case-insensitive).

### File Format

Each skill is a single Markdown file with optional YAML frontmatter:

```markdown
---
title: Skill Display Name
description: Brief description
context: inline
allowed-tools: bash, git, node
---

# Skill Name

Detailed skill documentation and implementation goes here.

You can use markdown formatting, code blocks, etc.
```

---

## YAML Frontmatter

### Frontmatter Syntax

Frontmatter is optional YAML metadata between `---` delimiters at the top of the file:

```yaml
---
field: value
another-field: another-value
list-field: [item1, item2, item3]
---
```

### Parsing Rules

- **Booleans**: `true` or `false`
- **Numbers**: `42` or `1.5`
- **Strings**: Can be quoted `"string"` or unquoted `string`
- **Arrays**: Comma-separated `[a, b, c]` or multiline with dashes
- **Whitespace**: Automatically trimmed

---

## Metadata Fields

### Basic Metadata

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `title` | string | Display name for the skill | Extracted from `# H1` heading |
| `description` | string | Brief description of the skill | First 3 lines of markdown |
| `effort` | Low / Medium / High | Complexity level | (none) |
| `when-to-use` | string | Scenario/use case description | (none) |
| `author` | string | Author or maintainer name | (none) |
| `version` | string | Skill version (e.g., 1.0.0) | (none) |
| `tags` | [tag1, tag2, ...] | Category tags for discovery | (none) |

### Example

```markdown
---
title: Debug Performance Issues
description: Analyze and fix performance bottlenecks
effort: High
when-to-use: Use when application performance degrades
author: Performance Team
version: 2.0.1
tags: [debug, performance, monitoring]
---

# Debug Performance Issues
...
```

---

## Execution Contexts

Controls how a skill is executed and where its output goes.

### `context: inline` (Default)

Skill content expands directly into the current conversation:

```markdown
---
context: inline
---
```

- Output goes directly to the user
- Shares token budget with parent conversation
- Recommended for small, quick utilities

### `context: fork`

Skill runs as a sub-agent with separate context:

```markdown
---
context: fork
agent: Bash
---
```

- Runs independently with separate token budget
- Better for complex tasks or long-running operations
- Requires `agent` field to specify sub-agent type

---

## Tool Policies

Control which tools are available when executing this skill.

### `allowed-tools`

Whitelist of tools this skill can use:

```markdown
---
allowed-tools: bash, git, node
---
```

If specified and the tool is not in the list, the tool is disabled.

### `disabled-tools`

Blacklist of tools to prevent:

```markdown
---
disabled-tools: python, ruby
---
```

These tools are explicitly unavailable, even if normally enabled.

### Example

```markdown
---
title: Safe Build Script
description: Build without accessing certain tools
allowed-tools: bash, git, npm, node
---

# Safe Build Script
...
```

---

## Conditional Activation

Skills can be automatically activated based on file paths being viewed or modified.

### `paths`

Glob patterns for file paths this skill applies to:

```markdown
---
paths: src/**, tests/**, *.config.js
---
```

When the model touches matching files, this skill becomes available.

### Glob Pattern Examples

```yaml
paths:
  - src/**/*.js           # All .js files in src/
  - tests/**              # All files in tests/
  - *.test.ts             # Test files in root
  - src/**/{component,utils}/**    # Nested patterns
```

### Example

```markdown
---
title: Edit React Components
description: Tools for editing React .jsx/.tsx files
paths: src/**/*.jsx, src/**/*.tsx
---

# Edit React Components
...
```

---

## Discovery & Registration

### Discovery Process

1. **Initialization**: When Ryft starts, it discovers skills from all configured mode skill roots
2. **Parallel Loading**: Skill directories are scanned in parallel for performance
3. **Enrichment**: Each skill's frontmatter is parsed and metadata is extracted
4. **Deduplication**: Skills with the same realpath are deduplicated (later wins)
5. **Registration**: Skills are registered in the global registry
6. **Caching**: Skill set is cached per mode combination

### Registry Integration

The skill registry:
- Maintains central index of all available skills
- Deduplicates by file realpath (handles symlinks)
- Supports filtering by source or metadata
- Emits signals when skills change

### Performance

- **First Load**: All skill directories scanned in parallel
- **Cached Load**: Subsequent loads return cache (< 1ms)
- **Cache Invalidation**: Manual via `clearDiscoveryCache()` or automatic on file watch

---

## Examples

### Example 1: Simple Documentation Skill

```markdown
---
title: Document Function
description: Generate JSDoc documentation for a function
context: inline
user-invocable: true
---

# Document Function

Automatically generates JSDoc documentation for JavaScript functions.

Usage:
- Select a function in the editor
- Run the /document-function command
- Review and refine the generated documentation
```

### Example 2: Full-Featured Skill

```markdown
---
title: Performance Profiling
description: Profile and optimize slow code paths
context: fork
agent: Bash
allowed-tools: bash, node, typescript
paths: src/**/*.ts, src/**/*.js
effort: High
when-to-use: When application performance is degrading
author: DevTools Team
version: 1.5.0
tags: [performance, profiling, optimization]
user-invocable: true
---

# Performance Profiling

Complete guide to profiling and optimizing your code...

## Features

- Automatic hotspot detection
- Memory leak identification
- Optimization recommendations

## Usage

...
```

### Example 3: Tool-Restricted Skill

```markdown
---
title: Safe Deployment
description: Deploy with restricted tool access
context: fork
disabled-tools: rm, chmod, killall
---

# Safe Deployment

Deploys the application with safety constraints to prevent
accidental data loss or system changes.

This skill cannot use:
- File deletion (rm)
- Permission changes (chmod)
- Process termination (killall)

...
```

---

## Best Practices

### 1. **Clear Naming**
- Use descriptive skill names: `edit-react-components` not `rc`
- Skill name is derived from directory name

### 2. **Frontmatter Format**
- Always use kebab-case for field names: `user-invocable` not `userInvocable`
- Use arrays for lists: `[a, b, c]` not `a, b, c`

### 3. **Metadata Documentation**
- Include `when-to-use` to help models decide when to invoke
- Add `tags` for discoverability
- Set `effort` to manage expectation

### 4. **Tool Policies**
- Use `allowed-tools` for safety-critical operations
- Use `disabled-tools` to prevent specific dangerous actions
- Document why tools are restricted

### 5. **Execution Context**
- Use `inline` for small utilities (< 100 tokens)
- Use `fork` for complex tasks (> 1000 tokens)
- Use `agent: Bash` for shell-based skills

### 6. **Conditional Activation**
- Keep glob patterns specific to avoid overload
- Document why certain paths trigger the skill
- Test patterns before deployment

---

## API Reference

### Frontmatter Parser

```typescript
// Parse YAML frontmatter from content
function parseFrontmatter(content: string): Record<string, unknown>

// Extract metadata (title, description, etc.)
function parseSkillMetadata(content: string): SkillMetadata

// Extract execution context
function extractContext(content: string): ExecutionContext | undefined

// Extract tool policies
function extractTools(content: string): { allowed?: string[], disabled?: string[] }

// Extract conditional paths
function extractPaths(content: string): string[] | undefined

// Enrich skill by reading file and parsing all metadata
async function enrichSkillFromFile(skill: Skill, filePath: string): Promise<Skill>

// Validate frontmatter structure
function validateSkillFrontmatter(content: string): string[]
```

### Skill Registry

```typescript
// Get the global skill registry
function getGlobalSkillRegistry(): SkillRegistry

// Discover skills for given modes
async function discoverAllSkillsForModes(modes: Mode[]): Promise<Skill[]>

// Clear discovery cache
function clearDiscoveryCache(): void
```

---

## Troubleshooting

### Skill Not Being Discovered

- ✅ Check skill is in correct directory: `packs/{mode}/skills/{name}/SKILL.md`
- ✅ Verify file name is exactly `SKILL.md` (not `skill.md` or `Skill.md`)
- ✅ Check for YAML syntax errors in frontmatter
- ✅ Verify mode name is configured in catalog.ts

### Metadata Not Parsing

- ✅ Use quoted strings if value contains special characters: `title: "My Skill"`
- ✅ Use kebab-case field names: `when-to-use` not `whenToUse`
- ✅ Arrays use comma or bracket syntax: `[a, b]` or `a, b`
- ✅ Run `validateSkillFrontmatter()` to check syntax

### Performance Issues

- ✅ Skill discovery is lazy-loaded and cached per mode set
- ✅ Frontmatter parsing only happens once per skill file
- ✅ Use `clearDiscoveryCache()` to reset if making frequent changes

---

## See Also

- [Skill Registry](./registry.ts) - Central skill management
- [Frontmatter Parser](./frontmatter.ts) - Metadata extraction
- [Mode Configuration](../modes/catalog.ts) - Mode skill roots
- [Session Integration](../runtime/session.ts) - How skills are used in sessions
