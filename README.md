# Ryft

<p align="center">
  <strong>Switch models, not workflows.</strong>
  <br />
  A lean coding CLI for people who want one sharp terminal workflow across OpenAI, Claude, Gemini, Ollama, and OpenAI-compatible backends.
</p>

<p align="center">
  <img alt="Node 20+" src="https://img.shields.io/badge/Node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-First-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="REPL" src="https://img.shields.io/badge/Terminal-REPL-111111?style=flat-square" />
  <img alt="Browser automation" src="https://img.shields.io/badge/Browser-Automation-0F766E?style=flat-square" />
  <img alt="MCP" src="https://img.shields.io/badge/MCP-Ready-7C3AED?style=flat-square" />
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-Local_Models-444444?style=flat-square" />
</p>

> Most AI coding tools ask you to commit to a vendor first. Ryft keeps the workflow steady and lets the model be interchangeable.

Ryft is built for the developer who wants to compare answers, swap providers mid-stream, bring in browser automation when the UI is the source of truth, and keep the whole thing inside a fast CLI instead of a bloated orchestration layer.

## The Pitch

| What matters | What Ryft gives you |
| --- | --- |
| You use more than one model | The same REPL and command set across OpenAI, Claude, Gemini, Ollama, and OpenAI-compatible backends |
| You debug real apps, not toy prompts | `browser-surff` mode can inspect and act through a live browser session |
| You want capability without clutter | Modes, skills, and MCP-backed tools add power only when you ask for it |
| You care about signal, not spectacle | Lean startup, token budgeting, and memory controls keep sessions usable |

## What It Feels Like

```text
$ ryft

ryft> /model
  OpenAI · Claude · Gemini · Ollama

ryft> /mode coder browser-surff
ryft> Open localhost:3000, inspect the signup flow, and explain why the button stays disabled.
ryft> /model claude-sonnet-4-6
ryft> Sanity-check the fix and tell me what GPT missed.
```

That is the whole point: one workflow, multiple brains.

## Why It Hits

- **Model choice stays fluid.** Use GPT for one turn, Claude for the next, local models when you want privacy, or a custom OpenAI-compatible endpoint when your stack demands it.
- **Modes are composable, not ceremonial.** `coder`, `browser-surff`, and `debugger` can be mixed per task instead of cramming everything into one giant system prompt.
- **Browser mode exists for a reason.** When the browser is the ground truth, Ryft can treat it that way instead of pretending screenshots and guesses are enough.
- **Skills can become project memory.** Project, user, and mode-level skills let Ryft grow into a codebase instead of acting like a generic assistant forever.
- **The terminal stays the center of gravity.** Fast startup, direct commands, and practical config make it feel like a tool you keep open all day.

## Quick Start

### 1. Install

```bash
git clone <repository-url> ryft
cd ryft
npm install
npm link
```

### 2. Bring a model

Use whichever provider you already trust:

```bash
export OPENAI_API_KEY=sk-...
# or: export ANTHROPIC_API_KEY=...
# or: export GEMINI_API_KEY=...
# or: export GOOGLE_API_KEY=...
```

If you want local inference, run Ollama on `http://localhost:11434` and choose an Ollama model from `/model`.

### 3. Launch

```bash
ryft
```

On first run, Ryft walks through setup. After that, the commands you will actually use are:

```text
/help          Show commands
/model         Pick a provider and model
/mode          Switch modes
/config        View current config
/config edit   Edit and save config
/skills        List skills for the current mode
/memory        Show current context usage
```

## Modes

| Mode | Use it when |
| --- | --- |
| `coder` | You want code editing, analysis, and general implementation work |
| `browser-surff` | You need a live browser session for navigation, inspection, or DevTools-driven debugging |
| `debugger` | You want evidence-first diagnosis, failure analysis, and root-cause work |

You can combine them:

```bash
ryft --mode coder browser-surff

# or inside the REPL
/mode coder browser-surff
```

## Bring Your Own Backend

Ryft is happy with first-party providers, but it does not force them on you. If your stack uses a proxy or an OpenAI-compatible model gateway, point Ryft at it directly:

```bash
ryft --base-url http://localhost:4000/v1 --api-key dummy --model my-model
```

That makes Ryft useful in the real world, not just in the default cloud path.

## Configuration

Ryft loads config in this order:

`defaults < ~/.ryftrc < ./.ryft.json < environment variables < CLI flags`

Example `~/.ryftrc`:

```json
{
  "model": "gpt-4.1",
  "defaultModes": ["coder"],
  "defaultMemoryMode": "normal",
  "showTokens": true
}
```

Useful flags:

```bash
ryft --model claude-sonnet-4-6
ryft --mode coder debugger
ryft --browser
ryft --prompt "Summarize the repo structure"
```

## Development

```bash
npm start
npm run typecheck
npm test
npm run build
```

Project layout:

```text
src/        CLI, runtime, modes, models, tools
packs/      Mode packs and shared skills
docs/       Deeper docs and architecture notes
test/       Automated tests and utility scripts
```

## Docs

- [Getting started](docs/index.md)
- [Core concepts](docs/core-concepts/README.md)
- [Skills](docs/skills/README.md)
- [Tools](docs/tools/README.md)
- [Configuration](docs/configuration/README.md)
