# Scroll Implementation Guide

## Overview

Ryft supports multiple scrolling mechanisms through Playwright MCP. This guide documents all available scroll methods and best practices.

## Available Scroll Tools

### 1. **`browser_mouse_wheel`** (Recommended)

**Source:** Playwright MCP  
**Purpose:** Simulate mouse wheel scrolling

**Usage:**

```javascript
browser_mouse_wheel direction="down" amount=800
```

**Parameters:**

- `direction`: "up" or "down"
- `amount`: pixels to scroll (typically 800-1200 for viewport height)

**Advantages:**

- Fast and reliable
- Triggers lazy-loading on infinite-scroll feeds
- Simulates real user behavior
- Works on most websites

**When to use:**

- Infinite-scroll feeds (LinkedIn, Twitter, job listings)
- E-commerce product lists
- Content discovery
- Any page with lazy-loaded content

---

### 2. **JavaScript-based Scrolling** (Alternative)

**Tool:** `browser_evaluate`  
**Methods:**

#### Scroll by pixels

```javascript
window.scrollBy(0, 1000);
return { scrolled: true };
```

#### Scroll to position

```javascript
window.scrollTo(0, document.body.scrollHeight);
return { scrollHeight: document.body.scrollHeight };
```

#### Scroll container

```javascript
const container = document.querySelector('[role="feed"]');
if (container) {
  container.scrollTop += 800;
  return { scrolled: true };
}
return { scrolled: false };
```

#### Scroll with wait for new content

```javascript
window.scrollBy(0, 1200);
await new Promise((r) => setTimeout(r, 1000));
return { message: "Scrolled and waited" };
```

**When to use:**

- Complex scroll scenarios
- Scrolling within specific containers
- Need to check for new content after scroll
- Debugging scroll behavior

---

## Implementation Pattern: Infinite Scroll

This is the standard pattern used by `browse-feed` skill:

```
1. Take screenshot/snapshot (baseline)
2. Extract visible items
3. Scroll: browser_mouse_wheel direction="down" amount=800
4. Wait briefly for content to load
5. Check item count increased
6. Repeat 2-5 until:
   - Target items collected
   - Item count plateaus (2x checks)
   - "No more content" visible
   - 20 iterations max
```

## Troubleshooting

### Issue: Page doesn't scroll

**Solution:**

1. Check if page has scrollable content:
   ```javascript
   return {
     scrollHeight: document.documentElement.scrollHeight,
     clientHeight: document.documentElement.clientHeight,
     canScroll:
       document.documentElement.scrollHeight >
       document.documentElement.clientHeight,
   };
   ```
2. Verify container is scrollable, not the window
3. Try JavaScript scroll first to diagnose

### Issue: Scroll works but no new content loads

**Solution:**

1. Wait after scroll:
   ```javascript
   window.scrollBy(0, 1000);
   await new Promise((r) => setTimeout(r, 2000));
   return { ok: true };
   ```
2. Check for loading indicators
3. Verify lazy-loading is enabled in network tab

### Issue: Scroll amount not enough

**Solution:**

- Increase `amount` parameter (1000-1500 for viewport)
- Multiple smaller scrolls: 3x `amount=600` better than 1x `amount=1800` sometimes
- Check viewport height first

## Skills Using Scroll

| Skill         | Scroll Method                  | Use Case                      |
| ------------- | ------------------------------ | ----------------------------- |
| `browse-feed` | `browser_mouse_wheel`          | Generic infinite-scroll feeds |
| `linkedin`    | JavaScript (`window.scrollBy`) | LinkedIn feed browsing        |
| `naukri`      | `browser_mouse_wheel`          | Job listing pagination        |
| `job-apply`   | Light scroll only              | Form completion               |

## Related Playwright MCP Tools

- `browser_mouse_wheel` - Scroll using mouse wheel (70 total browser\_\* tools available)
- `browser_navigate` - Navigate to URLs
- `browser_click` - Click elements (for load-more buttons)
- `browser_evaluate` - Execute arbitrary JavaScript
- `browser_take_screenshot` - Capture page state
- `browser_snapshot` - Get accessibility tree (text content)

## Database References

**Skills Database:** `/Ryft/skills-db.json`

- Updated tool references from `browser_scroll` → `browser_mouse_wheel` ✅
- Updated from `browser_screenshot` → `browser_take_screenshot` ✅
- Updated from `browser_fill` → `browser_fill_form` ✅

## Next Steps

If scrolling still doesn't work:

1. ✅ Database fixed (browser_scroll → browser_mouse_wheel)
2. ✅ Tool names aligned with Playwright MCP
3. Test with: `Go to LinkedIn` → `Use browse-feed skill`
4. Verify in browser output: "Scroll: browser_mouse_wheel direction=down amount=800"
