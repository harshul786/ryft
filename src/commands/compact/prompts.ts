export const COMPACT_PROMPT = `# Ryft Compaction Prompt

You are compressing a long-running coding conversation for later continuation.

Goals:
- Reduce token usage aggressively while keeping the important decisions.
- Preserve the user's explicit requests, the current plan, and any constraints.
- Keep the architecture simple and avoid repeating low-value chatter.
- Preserve file paths, function names, command names, and concrete errors or fixes.
- Preserve current work, open tasks, and anything the next turn must know.

Output format:
- Use concise markdown.
- Prefer headings and bullets.
- Do not invent details.
- Do not include a preamble.

Required sections:
1. Primary Request and Intent
2. Key Technical Concepts
3. Files and Code Sections
4. Errors and Fixes
5. Problem Solving
6. Pending Tasks
7. Current Work

Compaction rules:
- Keep the summary dense enough to support a large context reduction.
- Preserve the most important retained facts, not the full history.
- If there is a memory mode active, include only the durable facts that should survive compaction.
- If there are browser or model decisions, preserve the current choice and why it was made.
- If there are unresolved tradeoffs, preserve them explicitly.
`;
