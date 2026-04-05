/**
 * Skill Builder Tool
 * 
 * Enables LLM and manual creation of new skills with automatic ID assignment.
 * Skills are registered in skills-db.json with sequential numeric IDs.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNextSkillId } from './id-manager.ts';
import type { Skill } from '../types.ts';

/**
 * Template for skill definition passed to builder
 */
export interface SkillTemplate {
  name: string;
  title: string;
  description: string;
  content: string; // Full markdown content with frontmatter
  modes: string[];
  requiredTools?: string[];
  context?: 'inline' | 'fork';
  agent?: string;
  allowedTools?: string[];
  disabledTools?: string[];
}

/**
 * Result from skill creation
 */
export interface SkillCreationResult {
  id: number;
  name: string;
  path: string;
  registered: boolean;
  message: string;
}

/**
 * Pre-instructions/system prompt for LLM skill builder
 * 
 * This prompt guides LLMs on how to create well-structured skills
 * following Ryft's conventions and best practices.
 */
export const SKILL_BUILDER_SYSTEM_PROMPT = `# Skill Builder Assistant

You are a Skill Builder that helps create new reusable skills for Ryft.

## Your Task
When asked to create a skill, you will:
1. Ask clarifying questions to understand what the skill should do
2. Design the skill with proper metadata and structure
3. Generate a complete SKILL.md file with YAML frontmatter

## Skill Format Requirements

### 1. Frontmatter (required)
Every skill must start with YAML frontmatter:
\`\`\`yaml
---
name: skill-name              # Unique identifier (kebab-case)
description: Short description  # One-liner explaining what this skill does
context: inline               # 'inline' or 'fork' (default: inline)
allowed-tools:               # Optional: comma-separated tools this needs
  - tool1
  - tool2
effort: Medium               # Low, Medium, or High
when_to_use: "Use when..."   # When Claude should invoke this
---
\`\`\`

### 2. Content Structure
After frontmatter, structure as:
\`\`\`markdown
# Skill Title

Brief description of what this skill does.

## When to Use
Detailed explanation of use cases and examples.

## How It Works
Step-by-step explanation of the process.

## Success Criteria
What success looks like (clear definition of "done").

## Example
If applicable, provide a concrete example.
\`\`\`

## Best Practices

### Naming
- Use kebab-case for skill names: \`my-skill\`, not \`MySkill\`
- Name should be descriptive but concise
- Avoid generic names like \`helper\` or \`tool\`

### Descriptions
- One-line descriptions should be actionable and specific
- "Fix bugs in code" is better than "Debug things"
- "Analyze git logs to identify root causes" is better than "Log analysis"

### Modes
- Skills must specify which modes they're available in: coder, browser-surff, debugger
- Think about which modes would benefit from this skill
- A skill can be in multiple modes

### Context
- \`inline\`: Skill runs in current conversation (default)
- \`fork\`: Skill runs as independent sub-agent (for self-contained tasks)
- Use \`fork\` when: no mid-process user input needed, self-contained task
- Use \`inline\` when: needs user steering, provides context back to main conversation

### Tools
- List tools the skill genuinely needs to function
- \`allowed-tools\` restricts what this skill can use
- Leave empty if no restrictions
- Examples: \`editor\`, \`browser\`, \`bash\`, \`git\`

### Effort Level
- \`Low\`: Quick skill, <5 steps, minimal decision points
- \`Medium\`: Standard workflow, 5-15 steps, some complexity
- \`High\`: Complex skill, >15 steps, many decision points

## Example Skill

\`\`\`markdown
---
name: cherry-pick-pr
description: Cherry-pick a merged PR to a release branch
context: inline
allowed-tools:
  - bash
  - git
effort: High
when_to_use: "Use when you need to backport a merged PR to a release branch. Examples: 'cherry-pick this to v2', 'backport to stable'"
---

# Cherry-Pick PR to Release Branch

Backports a merged PR from main to a release branch with minimal conflicts.

## When to Use
- Post-release hotfixes already merged to main
- Backporting features to older releases
- Selective cherry-picking without full branch merge

## How It Works
1. Ask which release branch to target
2. Determine the commit SHA from PR number
3. Cherry-pick the commit to the target branch
4. Handle any conflicts (interactive)
5. Push to release branch (with user confirmation)

## Success Criteria
- Cherry-pick completed without unresolved conflicts
- Code builds on target branch
- Tests pass on target branch
\`\`\`

## Conversation Flow

When creating a skill, follow this pattern:

### Round 1: Understanding
- Ask what problem this skill solves
- Ask what inputs it needs
- Ask what success looks like

### Round 2: Structure
- Suggest skill name, modes, effort level
- Ask for confirmation or changes

### Round 3: Content
- Ask detailed questions about each step
- Understand any special considerations

### Round 4: Review
- Present the complete SKILL.md for review
- Make changes based on feedback

## Important Notes
- Never create skills without understanding the full workflow
- Skills should be reusable and not tied to specific projects
- Document edge cases and error conditions
- Include success criteria on every step
- Ask for confirmation before finalizing
`;

/**
 * Generate a skill from a description and template
 * 
 * This creates a new skill file and registers it in skills-db.json.
 * The skill is assigned a sequential numeric ID automatically.
 * 
 * @param template - Skill template with name, description, content, modes, etc.
 * @param skillsPath - Where to save the skill file (e.g., "packs/shared/skills")
 * @returns Result with assigned ID and registration status
 * 
 * @example
 * const result = await createSkillFromTemplate({
 *   name: 'my-skill',
 *   title: 'My Skill',
 *   description: 'Describes what my skill does',
 *   content: '# My Skill\n\n...',
 *   modes: ['coder'],
 *   requiredTools: [],
 * }, 'packs/shared/skills');
 * 
 * console.log(`Created skill with ID ${result.id}`);
 */
export async function createSkillFromTemplate(
  template: SkillTemplate,
  skillsPath: string
): Promise<SkillCreationResult> {
  try {
    // Assign next sequential ID
    const skillId = getNextSkillId();
    
    // Create skill directory
    const skillDir = join(process.cwd(), skillsPath, template.name);
    const skillFile = join(skillDir, 'SKILL.md');
    
    // Ensure directories exist
    const fs = require('node:fs');
    fs.mkdirSync(skillDir, { recursive: true });
    
    // Write skill file
    writeFileSync(skillFile, template.content, 'utf-8');
    
    // Register in skills-db.json
    await registerSkillInDatabase(skillId, template, skillsPath);
    
    return {
      id: skillId,
      name: template.name,
      path: `${skillsPath}/${template.name}/SKILL.md`,
      registered: true,
      message: `✅ Skill created with ID ${skillId}: ${template.name}`,
    };
  } catch (error) {
    return {
      id: -1,
      name: template.name,
      path: '',
      registered: false,
      message: `❌ Failed to create skill: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Register a skill in the skills database
 * 
 * @internal
 */
async function registerSkillInDatabase(
  skillId: number,
  template: SkillTemplate,
  skillsPath: string
): Promise<void> {
  try {
    const dbPath = join(process.cwd(), 'skills-db.json');
    const dbContent = readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(dbContent);
    
    // Add skill entry
    db.skills[String(skillId)] = {
      id: skillId,
      name: template.name,
      path: `${skillsPath}/${template.name}/SKILL.md`,
      description: template.description,
      modes: template.modes,
      requiredTools: template.requiredTools || [],
      requiresPermission: false,
    };
    
    // Update ID counter if needed
    db.idCounter = Math.max(db.idCounter || skillId, skillId + 1);
    
    // Write back
    writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to register skill in database: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Validate a skill template before creation
 * 
 * @returns Array of validation errors (empty if valid)
 */
export function validateSkillTemplate(template: SkillTemplate): string[] {
  const errors: string[] = [];
  
  if (!template.name || !/^[a-z0-9-]+$/.test(template.name)) {
    errors.push('Skill name must be kebab-case (lowercase, hyphens only)');
  }
  
  if (!template.title || template.title.length === 0) {
    errors.push('Skill must have a title');
  }
  
  if (!template.description || template.description.length === 0) {
    errors.push('Skill must have a description');
  }
  
  if (!template.content || template.content.length < 100) {
    errors.push('Skill content must be substantial (at least 100 characters)');
  }
  
  if (!template.modes || template.modes.length === 0) {
    errors.push('Skill must specify at least one mode');
  }
  
  const validModes = ['coder', 'browser-surff', 'debugger'];
  for (const mode of template.modes) {
    if (!validModes.includes(mode)) {
      errors.push(`Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
    }
  }
  
  if (template.context && !['inline', 'fork'].includes(template.context)) {
    errors.push('Context must be "inline" or "fork"');
  }
  
  return errors;
}
