---
id: naukri
name: naukri
description: Search jobs on Naukri.com, apply filters, read job details, and apply — either natively or by handing off to job-apply.
context: inline
effort: High
when-to-use: Use for any task on naukri.com — searching jobs, filtering by role/location/experience/salary, reading JDs, and submitting applications.
tags: [browser, naukri, jobs, apply, india, search]
allowed-tools: browser_navigate, browser_click, browser_type, browser_mouse_wheel, browser_fill_form, browser_take_screenshot, browser_evaluate, browser_select_option, browser_file_upload
---

# Naukri

Handles job search and application workflows on naukri.com.

---

## A. Job Search

1. Navigate to `https://www.naukri.com/`.
2. Click the search bar: `input#qsb-keyword-sugg` (keyword/role).
3. Type the role using `browser_type`.
4. Click the location bar: `input#qsb-location-sugg` and type the city/region.
5. Click the **Search** button or press Enter.
6. Wait for results page to load (URL changes to `/jobs-listings/...` or contains `?k=`).

## A1. Apply Filters

After search results load, apply filters from the left sidebar:

| Filter       | selector / approach                                     |
| ------------ | ------------------------------------------------------- |
| Experience   | Click `.exp-filter` range slider or dropdown options    |
| Salary       | Click `.sal-filter`, set min/max range                  |
| Job Type     | Click checkboxes under "Employment Type"                |
| Work Mode    | Click Remote / WFH / Work from office checkboxes        |
| Date Posted  | Click "1 day" / "3 days" / "7 days" / "15 days" options |
| Company Type | Click MNC / Startup / Fortune 500 checkboxes            |

After selecting each filter, wait for the results count to update before proceeding.

---

## B. Browse Job Listings

Use the **browse-feed** skill to scroll through `.jobTuple` or `article.jobTuple` cards.

For each job card, extract:

- Job title (`.title`)
- Company name (`.comp-name`)
- Location (`.loc`)
- Experience required (`.exp`)
- Salary if listed (`.sal`)
- Posted date (`.freshness`)

---

## C. Read a Job Description

1. Click the job card title to open the detail panel on the right (or a new page).
2. Extract full JD text from `.job-desc` or `#job-description`.
3. Summarise key requirements: role, experience, skills, location, salary band.

---

## D. Apply — Internal (Naukri Native)

1. Click **Apply** button on the job detail: `button.apply-button` or `a[title="Apply"]`.
2. **If a resume selector modal appears**:
   - List available resumes shown in the modal.
   - Select the most relevant one (or the one user specifies) — click its radio button.
   - If "Upload new resume" is shown, invoke the **upload** skill.
3. If additional questions appear (notice period, current CTC, expected CTC, etc.):
   - Fill each field using `browser_fill_form` or `browser_select_option`.
4. Click **Apply** / **Submit** to finish.
5. Screenshot the confirmation ("Application submitted successfully").

---

## E. Apply — External Redirect

1. If clicking Apply redirects to a company website (URL changes away from naukri.com):
   - Note the destination URL and the company name.
   - Invoke the **job-apply** skill to handle the external ATS form.

---

## F. Save a Job

1. Click the bookmark / heart icon on the job card: `button[title="Save Job"]`.
2. Confirm the icon state changes (filled = saved).

---

## Error Handling

- **Login wall / "Sign in to apply"**: Stop and ask user to log in — do not automate credentials.
- **"Profile not complete" modal**: Note the missing fields for the user and ask if they want to continue.
- **CAPTCHA**: Stop and notify the user.
- **Pagination**: If the user wants more results than one page shows, click **Next** (`.pagination a.fright`) and continue.
