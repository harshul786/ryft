---
id: analyze
name: analyze
description: Research and understand project structure, modules, and functionality
context: inline
paths:
  [
    "**/*.ts",
    "**/*.js",
    "**/*.jsx",
    "**/*.tsx",
    "**/*.md",
    "package.json",
    "README*",
  ]
---

# Analyze

Analyze and research code projects to understand their structure, dependencies, and functionality.

You have access to command-line tools to explore the project:

**Explore Directory Structure:**

```bash
tree -L 3 -I 'node_modules|.git|dist'     # Visual tree (Unix/Linux/Mac)
find . -type f -name "*.ts" | head -20     # Find TypeScript files
ls -la src/                                 # List directory contents
```

**Understand Project Type:**

```bash
cat package.json                            # Node/Python project info
cat pyproject.toml                          # Python project config
cat requirements.txt                        # Python dependencies
head -50 README.md                          # Project overview
```

**Find Key Components:**

```bash
grep -r "export.*class\|export.*function" src  # Find exports
grep -r "interface.*{" src                      # Find interfaces
find src -name "*test*" -o -name "*spec*"       # Find tests
```

**Get Project Statistics:**

```bash
find . -type f -name "*.ts" | wc -l         # Count files
find src -type f | xargs wc -l              # Lines of code
```

## When to Use

Use this skill when you need to:

- Understand project structure and organization
- Identify modules, classes, and functions
- Research how components work together
- Understand dependencies and APIs
- Generate documentation from code
- Discover test files and entry points

## How to Use

1. **First**: Call shell commands to see project structure

   ```bash
   find . -type f -name "*.json" -o -name "*.md"  # Config files
   tree -L 2 -I 'node_modules'                     # Overview
   ```

2. **Then**: Read key files to understand the project

   ```bash
   cat README.md                # Project purpose
   cat package.json             # Dependencies
   cat src/index.ts             # Entry point
   ```

3. **Identify** the main modules and their purposes
4. **Map out** relationships between components
5. **Note** important APIs and interfaces
6. **Identify** patterns and best practices

## Example Workflow

**User:** "Research the src/ directory and explain how the authentication system works."

**Your response:**

1. Run `tree -L 3 src/` to see structure
2. Find auth-related files: `find src -name "*auth*"`
3. Read the main auth file: `cat src/auth/index.ts`
4. Follow imports: `grep -n "import.*from" src/auth/index.ts`
5. Read related modules
6. Explain the system with code references

## Output

The skill provides:

- Structured overview of project organization (directory tree)
- Key files and their purposes
- Main components and their relationships (with code snippets)
- Important APIs and interfaces
- Dependencies and architecture patterns
