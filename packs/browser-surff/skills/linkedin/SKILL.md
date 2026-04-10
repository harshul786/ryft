---
id: linkedin
name: linkedin
description: Automate LinkedIn actions — browse feed, search jobs, Easy Apply, post, comment, connect, and message.
context: inline
effort: High
when-to-use: Use for any task on linkedin.com — reading feed, applying to jobs, writing posts, leaving comments, sending connection requests, or messaging contacts.
tags: [browser, linkedin, jobs, social, apply, post, comment, connect]
allowed-tools: browser_navigate, browser_click, browser_type, browser_mouse_wheel, browser_fill_form, browser_take_screenshot, browser_evaluate, browser_select_option, browser_file_upload
---

# LinkedIn

Handles all major LinkedIn workflows. Pick the relevant section below based on the user's task.

---

## A. Browse Feed

1. Navigate to `https://www.linkedin.com/feed/` if not already there.
2. Use the **browse-feed** skill to scroll and collect posts.
3. For each post, extract: author name, post text, reaction count, comment count.

### Liking a Post

1. Locate the Like button: `button[aria-label*="React Like"]` within the post card.
2. Call `browser_click` on it.
3. Confirm the button label changed (indicates success).

### Commenting on a Post

1. Click the Comment button: `button[aria-label*="Comment"]`.
2. Wait for the comment input box to appear: `.comments-comment-box__form-container`.
3. Click inside the text area and type the comment with `browser_type`.
4. Click **Post** button: `button.comments-comment-box__submit-button`.

---

## B. Jobs — Search & Filter

1. Navigate to `https://www.linkedin.com/jobs/`.
2. Type role in the "Search jobs" input: `input[aria-label="Search by title, skill, or company"]`.
3. Type location in the "Search location" input: `input[aria-label="City, state, or zip code"]`.
4. Press Enter / click Search.
5. Apply filters using the filter pills at the top (Experience Level, Date Posted, Remote/On-site, etc.) — click each pill, select options, click "Show results".

## B1. Easy Apply

1. Click a job card from the results list.
2. Check for the **Easy Apply** button: `button.jobs-apply-button[aria-label*="Easy Apply"]`.
3. If present:
   a. Click it to open the application modal.
   b. For each step in the multi-step form, fill fields (phone, address, custom questions).
   c. Use `browser_fill_form` for text inputs, `browser_select_option` for dropdowns.
   d. If a resume upload prompt appears, invoke the **upload** skill.
   e. Click **Next** until the final **Submit application** button, then click it.
   f. Screenshot the confirmation screen.
4. If **Apply** (external) instead: note the redirect URL and invoke the **job-apply** skill.

---

## C. Post to Feed

1. Navigate to `https://www.linkedin.com/feed/`.
2. Click the **Start a post** box at the top of the feed.
3. Type content in the modal using `browser_type` on `.ql-editor`.
4. If attaching an image/document: click the media icon and invoke **upload** skill.
5. Click **Post** button to publish.
6. Screenshot the published post as confirmation.

---

## D. Connect / Follow

1. Navigate to the person's profile URL (user provides it, or search first).
2. Click **Connect**: `button[aria-label*="Connect"]`.
3. In the "Add a note" modal: optionally type a personalised message.
4. Click **Send** to confirm.
5. If the button says **Follow** instead of Connect, click Follow.

---

## E. Send a Message

1. Navigate to the person's profile or `https://www.linkedin.com/messaging/`.
2. Click **Message**: `button[aria-label*="Message"]`.
3. Type the message in `.msg-form__contenteditable`.
4. Click the Send button: `button[aria-label="Send"]`.

---

## Error Handling

- **Login wall**: If redirected to `/login`, stop and ask the user to log in — do not attempt to automate credentials.
- **CAPTCHA**: Stop and notify the user immediately.
- **Rate limiting / "Try again later"**: Wait and retry once after 5 seconds; if it persists, report to user.
- **Modal not appearing**: Try `browser_mouse_wheel` up and retry the click.
