---
id: upload
name: upload
description: Upload a file (resume, cover letter, portfolio) to any browser file input or drag-and-drop zone.
context: inline
effort: Low
when-to-use: Use whenever a form requires uploading a file — resume, cover letter, portfolio, or any document. Called by linkedin, naukri, and job-apply skills when file upload is needed.
tags: [browser, upload, resume, file, form]
allowed-tools: browser_click, browser_file_upload, browser_evaluate, browser_take_screenshot, browser_mouse_wheel
---

# Upload

Handles file upload to any browser form — file input fields, drag-and-drop zones, or button-triggered pickers.

The user must provide the absolute file path. If no path is given, ask: "What is the full path to the file you want to upload?"

---

## Step 1 — Identify the Upload Target

Look for one of these patterns on the current page:

| Type                | Detection                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| Standard file input | `input[type="file"]` — may be hidden                                     |
| Upload button       | Button with label containing "Upload", "Attach", "Choose file", "Browse" |
| Drag-and-drop zone  | `div` with `dropzone` attribute or text "Drag and drop"                  |

Use `browser_evaluate` to find the element:

```js
document.querySelector('input[type="file"]')?.outerHTML;
```

---

## Step 2 — Upload via File Input

If an `input[type="file"]` element exists (visible or hidden):

1. Call `browser_file_upload` with:
   - `selector`: the CSS selector for the file input (e.g., `input[type="file"]`)
   - `files`: array containing the absolute path to the file

2. If the selector doesn't work because the input is hidden inside a shadow DOM or iframe, try clicking the visible "Upload" button first, then retry `browser_file_upload`.

---

## Step 3 — Upload via Drag-and-Drop Zone

If no `input[type="file"]` is found but a drop zone is visible:

1. Use `browser_evaluate` to trigger a synthetic drop event:

```js
const dt = new DataTransfer();
// Note: programmatic drag-and-drop with real files requires Playwright's setInputFiles
```

2. Fall back to clicking the drop zone — most drop zones also trigger a file picker on click.
3. After the click triggers the file picker, use `browser_file_upload` with the drop zone selector.

---

## Step 4 — Verify Upload Success

After uploading, verify using one of these signals:

| Signal                   | What to check                                   |
| ------------------------ | ----------------------------------------------- |
| Filename displayed       | Look for the filename text near the upload area |
| Progress bar             | Wait for it to reach 100% / disappear           |
| Checkmark / success icon | Green tick or success state on upload element   |
| "File uploaded" message  | Text confirmation near the upload field         |

Screenshot the success state as confirmation.

---

## Accepted File Formats

- **Resume / CV**: PDF preferred; DOCX accepted by most platforms.
- **Cover letter**: PDF or DOCX.
- **Portfolio**: PDF, ZIP, or the platform's accepted formats.

If the upload is rejected due to file type, report the error and ask the user to provide the file in an accepted format.

---

## Error Handling

- **File not found**: Report the exact path and ask the user to verify it.
- **Size limit exceeded**: Report the limit shown on the page and ask for a smaller file.
- **Wrong file type**: Report accepted types shown on the page.
- **Upload stuck / no progress**: Wait 5 seconds, screenshot, and report to user.
