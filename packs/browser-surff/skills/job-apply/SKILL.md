---
id: job-apply
name: job-apply
description: Fill and submit job applications on company ATS portals — Workday, Greenhouse, Lever, Ashby, and BambooHR.
context: inline
effort: High
when-to-use: Use when applying to a job on a company's own website (not LinkedIn/Naukri). Handles multi-step ATS forms including personal info, work history, custom questions, EEO disclosures, and final submission.
tags: [browser, apply, jobs, ats, workday, greenhouse, lever, ashby, bamboohr]
allowed-tools: browser_navigate, browser_click, browser_type, browser_fill, browser_scroll, browser_screenshot, browser_evaluate, browser_select_option, browser_upload_file
---

# Job Apply (Generic ATS)

Handles job application forms on company ATS portals. Detect the platform first, then follow the appropriate flow.

---

## Step 0 — Detect Platform

After landing on the application page, identify the ATS from the URL or page content:

| Platform       | URL pattern                                   |
| -------------- | --------------------------------------------- |
| Workday        | `myworkdayjobs.com` or `wd3.myworkday.com`    |
| Greenhouse     | `boards.greenhouse.io` or `app.greenhouse.io` |
| Lever          | `jobs.lever.co`                               |
| Ashby          | `jobs.ashbyhq.com`                            |
| BambooHR       | `efts.bamboohr.com` or `app.bamboohr.com`     |
| Custom / other | Apply section detection approach below        |

Take a screenshot of the current page as baseline.

---

## Step 1 — Personal Information

Fill standard fields using `browser_fill` (target by `name`, `id`, or `aria-label`):

| Field               | Common selectors                                           |
| ------------------- | ---------------------------------------------------------- |
| First name          | `input[name*="firstName"]`, `input[aria-label*="First"]`   |
| Last name           | `input[name*="lastName"]`, `input[aria-label*="Last"]`     |
| Email               | `input[type="email"]`, `input[name*="email"]`              |
| Phone               | `input[type="tel"]`, `input[name*="phone"]`                |
| LinkedIn URL        | `input[name*="linkedin"]`, `input[aria-label*="LinkedIn"]` |
| Website / Portfolio | `input[name*="website"]`, `input[name*="portfolio"]`       |
| Address / Location  | `input[name*="city"]`, `input[name*="location"]`           |

---

## Step 2 — Resume & Cover Letter

1. Look for `input[type="file"]` near a "Resume" or "CV" label.
2. Invoke the **upload** skill with the resume file path.
3. If a cover letter upload is present and the user has one, invoke **upload** again.
4. If the form offers "Use resume on file" / auto-parse option — prefer that over re-uploading.

---

## Step 3 — Work Experience & Education

- If the form has manual work history fields, fill each role sequentially:
  - Company, Title, Start/End dates, Description.
- If there's a "+" Add Position button, click it for each additional role.
- For education: Institution, Degree, Field of Study, Graduation year.
- If the form offers parsing from resume (e.g., Workday "Import from resume"), use that to pre-fill then verify.

---

## Step 4 — Custom Application Questions

For each custom question:

1. Read the question text carefully.
2. If it's a yes/no: use `browser_select_option` or click the radio button.
3. If it's a dropdown (e.g., "Years of experience", "Work authorisation"): use `browser_select_option`.
4. If it's a text area: use `browser_type` to compose a relevant answer.
5. For work authorisation questions: answer truthfully based on user profile — if unknown, ask the user.

---

## Step 5 — EEO / Demographic Questions (Optional)

These are marked voluntary. Follow user preference:

- If user said "skip voluntary": select "Decline to self-identify" / "Prefer not to say" for each.
- Otherwise fill as instructed.

---

## Step 6 — Multi-Step Navigation

- After filling each section, click **Next**, **Continue**, or **Save & Continue**.
- Track progress via a step indicator (e.g., "Step 2 of 4") — screenshot each step completion.
- On the **Review** page: screenshot the summary for user confirmation before submitting.
- Click **Submit** only after user confirms (or if the user said "just apply").

---

## Platform-Specific Notes

### Workday

- Forms are dynamically rendered in iframes — use `browser_evaluate` if standard selectors fail.
- Resume upload can trigger auto-parse; wait for parsing to complete before editing fields.
- Date fields use separate Month / Day / Year dropdowns.

### Greenhouse

- Straightforward single-page or short multi-step forms.
- Custom questions are clearly labelled.
- EEO section is at the end and fully optional.

### Lever

- Single-page form — all fields visible at once.
- "Apply" button at the bottom — scroll down to confirm all fields are filled before submitting.

### Ashby

- Modal-based form with tabs.
- Look for `role="dialog"` container for all inputs.

### BambooHR

- May redirect to a company-branded domain but forms are standard.
- File uploads accept PDF and DOCX.

---

## Error Handling

- **Required field validation error**: Screenshot the error, identify the missing field, fill it, and retry the step.
- **CAPTCHA / bot check**: Stop and notify the user — do not attempt to solve.
- **SSO / Login required**: Stop and ask the user to log in manually.
- **File format rejected**: Ask user to provide the file in an accepted format (PDF preferred).
- **Session timeout**: Navigate back and restart from the last saved step.
