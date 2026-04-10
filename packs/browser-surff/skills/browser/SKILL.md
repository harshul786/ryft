---
id: browser
name: browser
description: General-purpose browser automation — search the web, navigate to pages, read content, click, type, and report findings.
requiredTools:
  - browser_navigate
  - browser_snapshot
---

# Browser

> **Do not call this skill again after it has been loaded. It is loaded once. Proceed with the tools listed below.**

## Core rules

1. **Never type into a search box to search.** Always search by navigating directly to the search URL. `browser_type` is only for filling forms after you have already landed on the target page.
2. **Prefer `browser_snapshot` over `browser_take_screenshot`.** Snapshot returns a text/DOM representation of the page — it is much faster and cheaper than a screenshot. Use `browser_take_screenshot` only when you specifically need to see visual layout (images, charts, rendered UI elements).
3. **Read the snapshot/screenshot and answer immediately.** Do not re-type, re-navigate, or re-search after you have received page content. Extract the answer and respond.
4. **Never ask the user to review the page or take a screenshot.** You do that yourself.
5. **Do not loop.** If you have looked at the page twice and still have no answer, use `browser_evaluate` with `document.body.innerText` and answer from that.
6. **If you typed into a form field and need to submit, always follow with `browser_press_key key="Enter"`.** Do not re-type the same text.

---

## Web search workflow

**Step 1 — Navigate directly to the search result page**

```
browser_navigate  url="https://www.google.com/search?q=<your+query+here>"
```

**Do NOT** navigate to `google.com` and then type. Build the full URL directly. Encode spaces as `+`.

**Step 2 — Read the page with snapshot**

```
browser_snapshot
```

Snapshots contain the full page text including Google featured snippets, weather boxes, knowledge panels, and top answers. Read the result and extract the answer.

**Step 3 — Answer**

If the answer is in the snapshot, respond now. No screenshot needed, no further tools.

**Step 4 — Only if truly not in snapshot: take one screenshot**

```
browser_take_screenshot
```

Read the image and answer. This is the last resort — do not loop back to typing after this.

---

## General page workflow (non-search)

1. `browser_navigate` to the target URL
2. `browser_snapshot` — read visible text content
3. If the answer requires seeing visual elements: `browser_take_screenshot`
4. If more content is needed below: `browser_mouse_wheel direction="down" amount=800` then `browser_snapshot`
5. Answer from what you see

---

## Tool reference

| Task                          | Tool                            | Speed                             |
| ----------------------------- | ------------------------------- | --------------------------------- |
| Navigate to URL or search     | `browser_navigate`              | fast                              |
| Read page text/DOM            | `browser_snapshot`              | fast (~1KB)                       |
| See visual page layout        | `browser_take_screenshot`       | slow (~50KB, avoid unless needed) |
| Click a link or button        | `browser_click`                 | fast                              |
| Type into a focused input     | `browser_type`                  | fast                              |
| Submit a form / press Enter   | `browser_press_key key="Enter"` | fast                              |
| Fill a form field by selector | `browser_fill_form`             | fast                              |
| Scroll the page               | `browser_mouse_wheel`           | fast                              |
| Run JavaScript                | `browser_evaluate`              | fast                              |
| Upload a file                 | `browser_file_upload`           | fast                              |

---

## Anti-loop checklist

- **Stuck typing the same text repeatedly?** Stop. You are on a homepage. Use `browser_navigate` with a full search URL instead.
- **Took a screenshot but still confused?** Re-read it carefully — the answer is likely already visible. Do not type or navigate again.
- **Same screenshot twice (same byte size)?** The page has not changed. Use `browser_evaluate` with `document.body.innerText` to get the text, then answer.
- **After typing in a field, action seems stuck?** Follow with `browser_press_key key="Enter"` to submit.
  | Type into a focused input field | `browser_type` |
  | Fill a form field by selector | `browser_fill_form` |
  | Scroll the page | `browser_mouse_wheel` |
  | Run JavaScript | `browser_evaluate` |
  | Upload a file | `browser_file_upload` |

---

## Anti-hallucination checklist

- **Stuck in a type/screenshot loop?** Stop. You are trying to search by typing. Use `browser_navigate` with the full search URL instead.
- **Screenshot received but no answer yet?** Re-read the image carefully. The answer is likely already visible.
- **Still nothing after 2 screenshots?** Use `browser_evaluate` with `document.body.innerText`, read the text output, and answer from that.
