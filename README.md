# Gradecraft · CodeForge grading console

A clean, browser-based grading workspace built with Next.js for CodeForge V0.1, BITS Pilani Digital MSc DS/AI. Import marks, understand a class, configure grade bands, review students and export final grades.

This is an independent challenge project, not an official BITS grading tool.

## Run locally

Use Node.js 20.9 or later:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

For a production build:

```sh
npm run build
npm start
```

## What you can do

- Import `.xlsx`, `.csv`, `.tsv` or `.json`, or start with the built-in sample.
- Select an Excel worksheet and map custom columns such as Student ID, Subject and Score.
- Switch courses and inspect count, mean, median, minimum, maximum and distributions.
- Preview affected students before applying grade-band changes, including reset and undo.
- Correct course maximum marks after import with a before/after percentage and grade review.
- Keep separate grade settings for each course during the session.
- Search student IDs, filter grades, sort marks and filter students within two percentage points of a cutoff. See the distance and raw marks needed for the next grade.
- Explicitly save, resume, update and delete up to five drafts in this browser.
- Preview and reconcile every student before downloading a course-specific CSV with raw marks, maximum marks, percentage and grade.

Files are processed in browser memory. **Saved drafts** stores a copy on this device only when you choose to save. Refreshing clears the open workspace; you can then resume a saved copy. Later edits are not saved automatically. Drafts contain student records and are accessible to anyone using the same browser profile. No student data is uploaded to a server, and the app does not require accounts.

## Import format

Use these standard headers, in any order, for the shortest import flow. Other column names can be mapped after upload:

| BITS ID | Course | Total Marks |
| --- | --- | --- |
| DEMO-001 | Math | 82 |
| DEMO-002 | Math | 71 |

Marks must be nonnegative whole numbers. After upload, confirm the maximum possible marks for each detected course (100 by default), or apply one maximum to all courses. Scores above that maximum block confirmation. The app normalizes scores to percentages without rounding before grading. Keep identifiers as text and exclude absent/NC students. Each ID may appear once per course. Course names ignore capitalization and surrounding spaces (Math, math and MATH are one course); the first spelling is retained. Student IDs remain case-sensitive. Multi-sheet Excel files prompt for worksheet selection. JSON uses an array of objects whose keys become mappable columns. Unmapped columns are explicitly excluded. The limit is 10 MB and 25,000 records per selected worksheet/file. Invalid rows block the entire import with actionable errors.

- [Sample Excel workbook](tests/fixtures/grading-sample.xlsx)
- [Multi-worksheet mapping example](tests/fixtures/multiple-worksheets.xlsx)
- [Expected sample results](tests/fixtures/README.md)

CSV and JSON templates are available inside **Import guide**.

## Tests

```sh
npm test
npm run test:e2e
```

The browser suite uses an installed Google Chrome browser and starts the development server automatically. It can reuse an existing server on port 3000. Install Chrome first if unavailable, or configure Playwright for another installed browser.

The logic suite covers the original prototype and the new data/grading modules. Browser checks cover real file imports, downloads, mobile layout and automated WCAG AA rules. Desktop/mobile screenshots are generated under `test-results/` and are not committed.

## Continuous integration

[App CI](.github/workflows/ci.yml) runs on every push and pull request, and can also be started manually from GitHub's Actions tab. It uses Node.js 22, installs locked dependencies with `npm ci`, runs the logic tests, builds the production app, and runs the Chrome browser/accessibility suite against the development server. Failed runs retain available browser diagnostics for seven days.

Commit and push the workflow to enable it on GitHub. No repository secrets are required.

## Project structure

| Location | Purpose |
| --- | --- |
| `app/` | Next.js page, layout, local fonts and responsive styling |
| `components/grading-console.js` | Interactive grading workspace |
| `lib/` | Shared import, validation, statistics and export logic |
| `tests/` | Original regression suite, product tests, browser tests and fixtures |
| `public/samples/` | Downloadable Excel sample |
| `BITS_Digital_CodeForge_Challenge.html` | Preserved Stage 1 prototype |

## Challenge documentation

- [Stage 1 bug fix log and author's manual verification](docs/BUG_FIX_LOG.md)
- [Next.js migration, feature details and limitations](docs/NEXTJS_MIGRATION.md)
- [Product roadmap and remaining deployment work](docs/PRODUCT_ROADMAP.md)

The Next.js app is ready for local review; it has not been publicly deployed. The original HTML remains independently runnable and retains its original CDN dependency.
