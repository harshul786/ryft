---
name: create-skill
description: Create a new skill interactively using LLM-guided interview
context: inline
effort: Medium
when_to_use: "Use when you want to build a new reusable skill for your project. The LLM will guide you through a 3-round interview to define the skill's purpose, scope, and implementation."
---

# Create Skill

Build new reusable skills for Ryft with LLM-assisted guidance. The skill builder conducts a 3-round interview to help you define, scope, and structure your new skill.

## When to Use

- **Creating a new workflow skill**: When you have a process you want to reuse
- **Building domain-specific helpers**: For project-specific tasks and patterns
- **Automating repetitive processes**: To turn manual steps into automated skills
- **Extending Ryft capabilities**: For new coding, debugging, or testing workflows

## How It Works

The `/create-skill` command starts an interactive 3-round interview:

### Round 1: Problem Definition
**Question**: "What problem does this skill solve?"
- Describe the use case and benefit
- Explain why this skill would be useful
- Example: "Automate cherry-picking PRs to release branches"

### Round 2: Scope & Dependencies
**Question**: "What files/contexts does it operate on? What tools needed?"
- Specify file patterns it works with (*.ts, src/*, etc.)
- List required tools (bash, git, files, browser, etc.)
- Example: "Works on git repos, needs bash and git commands"

### Round 3: Effort Estimation
**Question**: "What's the effort level? Choose: Low/Medium/High"
- Low: < 5 steps
- Medium: 5-15 steps
- High: > 15 steps

## Generated Skill Structure

Your new skill is created as a SKILL.md file with:

```yaml
---
name: skill-name              # Unique kebab-case identifier
description: What it does     # One-line description
context: inline               # inline or fork
allowed-tools:                # Tools this skill needs
  - bash
  - git
effort: Medium                # Low, Medium, or High
when_to_use: "Use when..."    # When Claude should invoke this
---
```

Followed by markdown content with:
- **Problem description**: What it solves
- **Contexts**: File patterns it operates on
- **Tools**: Required capabilities
- **How it works**: Step-by-step process
- **Success criteria**: Definition of "done"

## Tool Tracking

The skill builder automatically:
- Tracks tools mentioned in your responses
- Auto-fills the `allowed-tools` field
- Detects: bash, git, files, browser, http, docker, database, json

## Examples

### Example 1: Git Workflow Skill
```
Round 1: "Automate cherry-picking PRs to release branches"
Round 2: "Works on git repos, needs bash, git, and shell commands"
Round 3: "High - involves multiple steps and conflict handling"

→ Generates skill: cherry-pick-pr
```

### Example 2: File Processing Skill
```
Round 1: "Convert Python files from tabs to spaces"
Round 2: "Operates on *.py files in src/, needs file editing"
Round 3: "Low - simple file transformation"

→ Generates skill: normalize-python-files
```

## Features

✅ **LLM-Guided**: Interactive interview for structured input
✅ **Tool Detection**: Automatically identifies and tracks tool usage
✅ **YAML Generation**: Creates production-ready SKILL.md files
✅ **Hot Reload**: Skills work immediately without restart
✅ **User Review**: Shows YAML preview before saving
✅ **Flexible**: Works with all available models (Claude, Gemma)

## Success Criteria

A successful skill creation means:
1. Interview completes 3 rounds without cancellation
2. SKILL.md file is generated in `.ryft/skills/` directory
3. File contains valid YAML frontmatter
4. Skill is immediately discoverable by `/skills list`
5. Skill can be invoked with `/{skill-name}` command

## Tips & Best Practices

- **Clear problem statement**: "Fix all TypeScript errors" vs "Automate TypeScript fixing"
- **Specific tools**: List exact tools needed, not generic categories
- **Realistic effort**: Be honest about complexity
- **Focused scope**: One skill = one clear problem
- **Testable**: Skills should have clear success criteria

## Cancellation

Cancel skill creation anytime by responding with:
- `cancel`
- `quit`
- `exit`

## Error Handling

If skill creation fails:
- Check file permissions on `.ryft/` directory
- Ensure valid YAML in responses
- Verify model API connection
- Try again with simpler problem statement

## Next Steps

After creating a skill:
1. Use `/skills list` to see your new skill
2. Test it: `/skill-name` in a conversation
3. Refine: Edit `.ryft/skills/{skill-name}/SKILL.md` if needed
4. Share: Copy skill directory to other projects

## Integration

The skill builder integrates with:
- **Skills Registry**: New skills auto-register
- **Hot Reload**: Changes apply immediately (Feature 5)
- **Mode System**: Skills available in all active modes
- **LLM Context**: New skills included in system prompt
- **Tool Tracking**: Capability detection for safety

---

**Information**: Run `/help create-skill` for command syntax
**Feature**: Feature 6 - Skill Builder LLM-Assisted Creation
**Version**: 1.0.0
