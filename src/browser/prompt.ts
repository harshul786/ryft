export const BROWSER_SURFF_PROMPT = `# Ryft Browser Automation

Use the browser session when the user wants to inspect or manipulate web pages.

Rules:
- Start by reading the current tab context before creating or switching tabs.
- Prefer the current browser session and its existing tabs unless the user asks for a fresh tab.
- Keep the work focused on the user's page, not on broad browsing.
- Avoid dialog-heavy flows unless the user explicitly asked for them.
- Inspect console output and page state before guessing.
- If the browser gets flaky or the tab context is stale, stop and ask before retrying blindly.
`;

export const BROWSER_SURFF_SKILL_HINT = `Browser automation tools are listed in the Available Tools section above. Use them directly to carry out any browser task — do not say you cannot access a website. If a browser tool is listed, call it.`;
