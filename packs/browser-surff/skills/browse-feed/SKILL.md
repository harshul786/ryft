---
id: browse-feed
name: browse-feed
description: Scroll through and extract items from infinite-scroll feeds on any website.
context: inline
effort: Medium
when-to-use: Use when the user wants to browse, read, or collect posts/jobs/listings from a feed that loads more content as you scroll.
tags: [browser, feed, scroll, linkedin, naukri]
allowed-tools: browser_scroll, browser_screenshot, browser_evaluate, browser_navigate
---

# Browse Feed

Use this skill to scroll through infinite-scroll feeds and extract items (posts, jobs, listings).

## Procedure

1. **Take an initial screenshot** with `browser_screenshot` to establish the current scroll position and visible items.
2. **Extract visible items** using `browser_evaluate` to query the DOM for feed item selectors (post cards, job cards, article tiles, etc.).
3. **Scroll down** one viewport height using `browser_scroll` with `direction: "down"` and `amount: 800`.
4. **Wait for new content** — call `browser_evaluate` to check if the item count increased or a loading spinner disappeared.
5. **Repeat steps 2–4** until a stop condition is met.

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
- For LinkedIn feed: post cards use `[data-id]` or `.feed-shared-update-v2` selectors.
- For Naukri job listings: job cards use `.jobTuple` or `[data-job-id]` selectors.
