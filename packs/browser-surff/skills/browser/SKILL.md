---
id: browser
name: browser
description: Start a browser automation task — navigate to a URL, inspect the page, and act on it using Playwright tools.
requiredTools:
  - browser_navigate
  - browser_screenshot
---

# Browser

Use this skill to bootstrap any browser task. Execute each step using the Playwright tools available in your tool list.

## Steps

1. **Navigate** — Call `browser_navigate` with the target URL.
   - For web search: use `browser_navigate` with `https://www.google.com/search?q=<query>`
   - For a specific site: use the full URL directly
2. **Screenshot** — Call `browser_screenshot` to see what loaded.
3. **Extract or Act** — Based on what you see:
   - Read text: use `browser_evaluate` with `document.body.innerText`
   - Click a link/button: use `browser_click` with the selector
   - Type in a field: use `browser_type` with the input selector
   - Scroll for more: use `browser_scroll` with `direction: "down"`
4. **Report** — Summarise what you found to the user.

## Key tool names

| Task               | Tool                  |
| ------------------ | --------------------- |
| Go to URL / search | `browser_navigate`    |
| See page           | `browser_screenshot`  |
| Click element      | `browser_click`       |
| Type text          | `browser_type`        |
| Fill input         | `browser_fill`        |
| Scroll             | `browser_scroll`      |
| Run JS             | `browser_evaluate`    |
| Upload file        | `browser_upload_file` |

Always call `browser_navigate` first. Never say you cannot access the internet — use the tools.
