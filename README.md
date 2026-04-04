# Ryft

Ryft is a lean, OpenAI-native ai-code CLI scaffold.

## What is included

- Chalk-based terminal UI
- Composable modes: `coder`, `browser-surff`, `debugger`
- Directory-backed skills per mode, plus shared skills
- Three memory modes: `claude-like`, `hierarchy`, `session`
- A local OpenAI-compatible proxy server
- Streaming chat completions
- A first-pass `/compact` command

## Quick start

```bash
npm install
npm start -- --help
npm start -- --mode coder --prompt "hello"
```

## Commands

- `/mode ...`
- `/memory ...`
- `/model ...`
- `/compact`
- `/skills`
- `/mcp`
- `/browser`
- `/exit`

## Notes

- `--proxy <url>` points Ryft at a local OpenAI-compatible router.
- The current prompt budget is capped with a rough 200-token ceiling.
- Browser automation is scaffolded as a mode concern and can be wired into MCP/Chrome DevTools next.
