---
id: browse-feed
name: browse-feed
description: Scroll through and extract items from infinite-scroll feeds on any website.
context: inline
effort: Medium
when-to-use: Use when the user wants to browse, read, or collect posts/jobs/listings from a feed that loads more content as you scroll.
tags: [browser, feed, scroll, linkedin, naukri]
allowed-tools: browser_mouse_wheel, browser_take_screenshot, browser_evaluate, browser_navigate
---

# Browse Feed

Use this skill to scroll through infinite-scroll feeds and extract items (posts, jobs, listings).

## Critical Rules

- **NEVER use `browser_evaluate` to scroll.** `browser_evaluate` scripts are synchronous only — using `window.scrollBy()`, `await`, or `setTimeout` inside them causes a "Passed function is not well-serializable!" error.
- **ALWAYS use `browser_mouse_wheel`** for all scrolling. It handles timing automatically.
- **`browser_evaluate` is for data extraction only** — DOM queries, reading text, counting elements.
- **USE VISION TO ANALYZE SCREENSHOTS**: When you call `browser_take_screenshot`, you receive an image that you CAN analyze. Extract text, post content, engagement metrics, and other visual details using your vision capabilities. Do not say you cannot analyze images or perform OCR — you can see the screenshots and should describe/analyze them.

## Procedure

1. **Take an initial screenshot** with `browser_take_screenshot` to establish the current scroll position and visible items. Analyze it visually.
2. **Check initial scroll position** using `browser_evaluate`: `return document.documentElement.scrollTop`
3. **Extract visible items** using `browser_evaluate` to query the DOM for feed item selectors (post cards, job cards, article tiles, etc.). If the selectors return empty results ([]): STOP and use your vision to extract from the screenshot instead — read the text, titles, engagement numbers, author names directly from the image. Do not retry the same selector.
4. **If vision extraction failed or returned no data**, try `browser_evaluate` with a different selector pattern or use browser_snapshot to get text content via DOM.
5. **Scroll down** using `browser_mouse_wheel` with `{"deltaY": 800}`. Note: **deltaY MUST be POSITIVE for downward scrolls**. Never send negative deltaY unless you intentionally want to scroll UP.
6. **MANDATORY: Take a screenshot immediately after scrolling** — call `browser_take_screenshot` RIGHT AWAY and analyze it visually. Compare to the previous screenshot:
   - If screenshots show DIFFERENT posts/content → scroll worked, continue to step 7
   - If screenshots are IDENTICAL → scroll position didn't change. Proceed to step 8 (fallback)
7. **Extract items from new screenshot** — use your vision to extract post text, engagement metrics, author names. Do not wait for DOM queries — the selectors may not work, but you can see and analyze the screenshot.
8. **If scroll failed (screenshots identical)** — try `browser_press_key` with `key="PageDown"` as alternate scroll method, then take another screenshot
9. **Repeat steps 5–8** until stop condition is met

## CRITICAL: Do NOT stop after one failed scroll attempt. Try the fallback method first.

## Stop Conditions

Stop scrolling when ANY of the following is true:

- Collected the target number of items (default: 10 unless user specified)
- The item count stops increasing after 2 consecutive scrolls (end of feed)
- A "No more results" / "You're all caught up" message is visible
- 20 scroll iterations have been completed (safety limit)

## Output Format

After collecting items, present them as a numbered list with:

- **Title / headline** of the item
- **Author / source** (if visible)
- **Brief summary** (1–2 sentences from visible text)
- **Link or identifier** if available

## Notes

- Do NOT open each item in a new tab unless the user explicitly asks.
- If a "Show more" / "Load more" button appears instead of auto-scroll, click it with `browser_click` instead of scrolling.
- The correct parameter for `browser_mouse_wheel` is `deltaY` (a number, e.g. 800). Do NOT use `direction` or `amount` — those are not valid parameters.
- If `browser_mouse_wheel` has no effect after 2 attempts, switch to `browser_press_key` with `key="PageDown"`.
- For LinkedIn feed: post cards use `[data-id]` or `.feed-shared-update-v2` selectors.
- For Naukri job listings: job cards use `.jobTuple` or `[data-job-id]` selectors.
