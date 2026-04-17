# Browser JavaScript Execution Guide

This guide explains how to use JavaScript within the browser to automate tasks. This is the primary method for scrolling, extracting data, interacting with elements, and analyzing page content.

## Overview

The `browser_evaluate` tool lets you run arbitrary JavaScript code in the browser context and get results back. This is the foundation of browser automation.

### Tool: `browser_evaluate`

**What it does**: Executes JavaScript code in the current browser page and returns the result.

**Parameters**:
- `script` (required): JavaScript code as a string. Can be simple expressions or complex functions.

**Returns**: The value returned by your JavaScript code.

---

## Common Patterns

### 1. Extract Data from the Page

**Problem**: You need to read content from the page (posts, links, text, attributes).

**Solution**: Use `document.querySelector()` and `document.querySelectorAll()` to find elements, then extract `.innerText`, `.textContent`, or attributes.

#### Example: Extract all post titles

```javascript
const posts = [];
document.querySelectorAll('.post-card, [data-post-id]').forEach(el => {
  const title = el.querySelector('.post-title')?.innerText || 'No title';
  const author = el.querySelector('.author')?.innerText || 'Unknown';
  posts.push({ title, author });
});
return posts;
```

#### Example: Get link URLs
```javascript
const links = [];
document.querySelectorAll('a[href]').forEach(el => {
  links.push({
    text: el.innerText,
    href: el.getAttribute('href')
  });
});
return links;
```

#### Example: Extract nested data
```javascript
const items = [];
document.querySelectorAll('[role="article"]').forEach(article => {
  const reactions = article.querySelector('[aria-label*="reaction"]')?.innerText || '0';
  const comments = article.querySelector('[aria-label*="comment"]')?.innerText || '0';
  const text = article.innerText?.substring(0, 200) || '';
  items.push({ reactions, comments, text });
});
return { items, count: items.length };
```

---

### 2. Scroll the Page

**Problem**: You need to scroll to load more content (infinite scroll, lazy loading).

**Solution**: Use `window.scrollBy()`, `window.scrollTo()`, or scroll specific elements.

#### Example: Scroll down 1000px
```javascript
window.scrollBy(0, 1000);
return { scrolled: true };
```

#### Example: Scroll to bottom
```javascript
window.scrollTo(0, document.body.scrollHeight);
return { scrollHeight: document.body.scrollHeight };
```

#### Example: Scroll a specific container
```javascript
const container = document.querySelector('[role="feed"]');
if (container) {
  container.scrollTop += 800;
  return { scrolled: true, newScrollTop: container.scrollTop };
}
return { scrolled: false };
```

#### Example: Scroll and return scroll position
```javascript
window.scrollBy(0, 1200);
// Do NOT use await/async — browser_evaluate is synchronous only
// Use browser_mouse_wheel instead for scrolling with built-in wait
return { scrollY: window.scrollY, scrollHeight: document.body.scrollHeight };
```

> **IMPORTANT**: Never use `await` or `async` inside `browser_evaluate` scripts.
> Playwright serializes the function and async functions are **not well-serializable**.
> For scrolling, always prefer `browser_mouse_wheel` which handles timing automatically.

---

### 3. Click Elements

**Problem**: You need to click buttons, links, or interactive elements programmatically.

**Solution**: Use `.click()` on the element found via selectors.

#### Example: Click all "Load More" buttons
```javascript
const buttons = document.querySelectorAll('button:contains("Load More"), [data-load-more]');
buttons.forEach(btn => btn.click());
return { clicked: buttons.length };
```

#### Example: Click specific button by aria-label
```javascript
const button = document.querySelector('button[aria-label="Like"]');
if (button) {
  button.click();
  return { success: true, buttonText: button.innerText };
}
return { success: false, message: 'Button not found' };
```

#### Example: Click first element matching condition
```javascript
const el = document.querySelector('[role="button"][aria-label*="Comment"]');
if (el) {
  el.click();
  return { clicked: true };
}
return { clicked: false };
```

---

### 4. Type Text into Fields

**Problem**: You need to fill text input fields or contenteditable areas.

**Solution**: Focus the element, clear it, then set the value or innerText.

#### Example: Fill a search field
```javascript
const input = document.querySelector('input[placeholder="Search"]');
if (input) {
  input.focus();
  input.value = 'my search term';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true };
}
return { success: false };
```

#### Example: Type into contenteditable
```javascript
const editor = document.querySelector('[contenteditable="true"]');
if (editor) {
  editor.focus();
  editor.innerText = 'My comment text';
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  return { success: true };
}
return { success: false };
```

---

### 5. Monitor Page Changes / Wait for Elements

**Problem**: You scrolled and need to wait for new content to appear before extracting.

**Solution**: Use `MutationObserver` or simple polling with `setTimeout`.

#### Example: Check if element is present (synchronous)
```javascript
// Do NOT use async/await — browser_evaluate is synchronous only
const el = document.querySelector('.new-post-card');
return { found: !!el };
// Then use browser_wait_for tool if you need to wait for the element to appear
```

#### Example: Check if loader is gone (synchronous)
```javascript
// Do NOT use async/await — browser_evaluate is synchronous only
const loader = document.querySelector('.loading, [role="progressbar"]');
return { loading: !!loader };
// Use browser_wait_for tool to wait for the loader to disappear
```

> **CRITICAL**: `browser_evaluate` scripts MUST be synchronous. Never use `async`, `await`, or
> `new Promise()` inside a `browser_evaluate` script — Playwright will throw
> "Passed function is not well-serializable!".
> Use `browser_wait_for` (the MCP tool) to wait for elements/state changes between steps.

---

### 6. Parse and Calculate

**Problem**: You extracted data and need to parse numbers, filter, or rank items.

**Solution**: Use JavaScript array methods and string parsing.

#### Example: Parse numeric engagement metrics
```javascript
const rawReactions = "1.2K reactions";
const rawComments = "45 comments";

const reactions = parseInt(rawReactions.replace(/[^0-9]/g, '')) || 0;
const comments = parseInt(rawComments.replace(/[^0-9]/g, '')) || 0;

const score = (reactions * 0.5) + (comments * 1.5);

return { reactions, comments, score };
```

#### Example: Filter and rank items
```javascript
const posts = [
  { id: 1, likes: 100, comments: 20 },
  { id: 2, likes: 50, comments: 120 },
  { id: 3, likes: 300, comments: 5 }
];

posts.forEach(p => {
  p.score = (p.likes * 0.5) + (p.comments * 1.5);
});

const ranked = posts.sort((a, b) => b.score - a.score);
return ranked.slice(0, 3);  // Top 3
```

---

### 7. Check Page State

**Problem**: You need to verify if you're on the right page, if content loaded, etc.

**Solution**: Query the page for specific elements or text.

#### Example: Check if logged in
```javascript
const loggedIn = !!document.querySelector('[aria-label*="Profile"], .user-menu');
const url = window.location.href;
return { loggedIn, url };
```

#### Example: Check if page finished loading
```javascript
const pageTitle = document.title;
const hasContent = document.querySelectorAll('[role="article"], .post').length > 0;
const errors = document.querySelectorAll('[role="alert"], .error').length;

return {
  title: pageTitle,
  hasContent,
  errorCount: errors,
  ready: hasContent && errors === 0
};
```

#### Example: Get current scroll position
```javascript
return {
  scrollTop: window.scrollY,
  scrollHeight: document.documentElement.scrollHeight,
  clientHeight: window.innerHeight,
  atBottom: window.scrollY >= (document.documentElement.scrollHeight - window.innerHeight - 100)
};
```

---

## Important Notes

### Selectors

Use CSS selectors to find elements:
- `.class-name` - By class
- `#id` - By ID
- `[attribute]` - By attribute existence
- `[attribute="value"]` - By attribute value
- `[attribute*="text"]` - By attribute containing text
- `[role="button"]` - By ARIA role
- `[aria-label*="Like"]` - By aria-label containing text

### Tips

1. **Use optional chaining** (`?.`) to avoid errors:
   ```javascript
   const text = el.querySelector('.title')?.innerText || 'N/A';
   ```

2. **Always return data** - The return value is sent back to you:
   ```javascript
   return { success: true, data: extractedData };
   ```

3. **Handle missing elements gracefully**:
   ```javascript
   const button = document.querySelector('button[aria-label="Submit"]');
   if (button) {
     button.click();
     return { clicked: true };
   }
   return { clicked: false, reason: 'Button not found' };
   ```

4. **Use async/await for waiting**:
   ```javascript
   await new Promise(r => setTimeout(r, 1000));  // Wait 1 second
   ```

5. **Test selectors in browser console first** - Open DevTools and paste your selector code to verify it works before using it in a skill.

---

## Common Mistakes

❌ **Mistake**: Forgetting to return a value
```javascript
document.querySelector('button').click();  // Nothing returned
```

✅ **Fix**: Always return something
```javascript
document.querySelector('button').click();
return { clicked: true };
```

---

❌ **Mistake**: Not handling missing elements
```javascript
document.querySelector('.post-title').innerText;  // Crashes if not found
```

✅ **Fix**: Use optional chaining
```javascript
document.querySelector('.post-title')?.innerText || 'N/A';
```

---

❌ **Mistake**: Assuming content loads instantly
```javascript
window.scrollBy(0, 1000);
const posts = document.querySelectorAll('.post');  // May be old content
```

✅ **Fix**: Wait after scrolling
```javascript
window.scrollBy(0, 1000);
await new Promise(r => setTimeout(r, 1000));
const posts = document.querySelectorAll('.post');  // Fresh content
```

---

## LinkedIn Examples

### Extract posts with metrics
```javascript
const posts = [];
document.querySelectorAll('[data-id], .feed-shared-update-v2').forEach(el => {
  const text = el.innerText?.substring(0, 300) || '';
  const reactions = el.querySelector('[aria-label*="reaction"]')?.innerText || '0';
  const comments = el.querySelector('[aria-label*="comment"]')?.innerText || '0';
  const author = el.querySelector('a[href*="/in/"]')?.href?.split('/').pop() || 'Unknown';
  posts.push({ author, text, reactions, comments });
});
return { posts, count: posts.length };
```

### Scroll and check for new posts
```javascript
const beforeCount = document.querySelectorAll('[data-id]').length;
window.scrollBy(0, 1200);
await new Promise(r => setTimeout(r, 1500));
const afterCount = document.querySelectorAll('[data-id]').length;
return { beforeCount, afterCount, newPosts: afterCount - beforeCount };
```

### Click comment button on first post
```javascript
const firstPost = document.querySelector('[data-id], .feed-shared-update-v2');
if (firstPost) {
  const commentBtn = firstPost.querySelector('button[aria-label*="Comment"]');
  if (commentBtn) {
    commentBtn.click();
    return { success: true, postId: firstPost.getAttribute('data-id') };
  }
}
return { success: false };
```

---

## When to Use vs. When NOT to Use `browser_evaluate`

### ✅ Use `browser_evaluate` for:
- Extracting data from the page
- Scrolling and adjusting content
- Clicking elements and buttons
- Reading page state
- Parsing and analyzing extracted data
- Waiting for content to load

### ❌ Use other browser tools for:
- Navigating to new URLs → use `browser_navigate`
- Taking screenshots → use `browser_take_screenshot`
- Selecting dropdown options → use `browser_select_option` (if available)
- Uploading files → use `browser_file_upload`
- Filling forms with simple inputs → use `browser_fill_form` (if available)

---

This guide is your reference for writing browser automation scripts. Test your JavaScript in the browser console first, then use it in skills!
