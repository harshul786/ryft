---
id: linkedin
name: linkedin
description: Filter LinkedIn feed by engagement potential and return top 3 posts to comment on.
context: inline
effort: High
when-to-use: When user asks to browse/filter LinkedIn feed for high-engagement posts.
tags: [browser, linkedin, feed, engagement]
allowed-tools: browser_navigate, browser_take_screenshot, browser_evaluate, browser_mouse_wheel, browser_press_key
disable-model-invocation: false
user-invocable: true
---

# LinkedIn Feed Filter

Execute autonomously. No confirmation needed. Return top 3 posts by engagement score.

---

## Filter Top Posts by Engagement

1. `browser_navigate` → `"https://www.linkedin.com/feed/"`
2. `browser_take_screenshot`
3. **Extract & Scroll Loop** (repeat 5x):
   - `browser_evaluate` (extract posts):

   ```javascript
   const posts = [];
   document
     .querySelectorAll("[data-id], .feed-shared-update-v2")
     .forEach((el) => {
       const text = el.innerText?.substring(0, 200) || "";
       const reactions =
         el
           .querySelector('[aria-label*="reaction"]')
           ?.innerText?.match(/\d+/)?.[0] || "0";
       const comments =
         el
           .querySelector('[aria-label*="comment"]')
           ?.innerText?.match(/\d+/)?.[0] || "0";
       const author =
         el.querySelector('a[href*="/in/"]')?.href?.split("/").pop() ||
         "Unknown";
       if (text.length > 30)
         posts.push({
           author,
           text,
           reactions: +reactions,
           comments: +comments,
         });
     });
   return posts;
   ```

   - `browser_evaluate` (check scroll position before):

   ```javascript
   return document.documentElement.scrollTop;
   ```

   - `browser_mouse_wheel` with `{"deltaY": 1200}` to scroll down
   - `browser_evaluate` (verify scroll position changed):

   ```javascript
   return document.documentElement.scrollTop;
   ```

   - If scroll position did NOT change, use `browser_press_key` with `key="PageDown"` as fallback

4. **Score all posts**:

   ```
   score = (reactions × 0.5) + (comments × 1.5)
   if 10 ≤ comments ≤ 100: score += 15
   if comments > 500: score -= 10
   ```

5. **Return top 3** sorted by score:

   ```
   Post #1 [Score: XXX]
   Author: [name]
   Content: [150 chars...]
   Engagement: [X reactions, Y comments]

   Post #2 [Score: XXX]
   ...
   ```
