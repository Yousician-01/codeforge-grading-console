# Stage 2 — Next.js product migration

The active application is now **Gradecraft**, a Next.js App Router app. The Stage 1 HTML and its bug log remain in the repository as a reviewable record of the original fixes.

## Preserved functionality

| Original behavior | Next.js implementation |
| --- | --- |
| Excel marks upload | Read real `.xlsx` files locally; explicitly select a worksheet when more than one exists |
| Course selection | Unique course options with per-course analytics and exports |
| Instructor name requirement | Export remains disabled until a name is entered |
| Basic analytics | Count, minimum, maximum, mean, median, histogram and grade distribution |
| Eight adjustable grade bands | Same A through E grades and whole-score outcomes; percentage boundaries with inclusive minima and exclusive upper limits (A includes 100%) |
| Range validation | Complete 0–100 coverage, no gaps/overlaps, valid single-mark bands |
| Reset grade ranges | Confirmation stages defaults; review grade impact before applying |
| Session timer | Starts on course selection; resets on course change; continues after exporting |
| Final grade CSV | All selected-course students, instructor/course metadata, escaped fields, formula-prefix handling and UTF-8 BOM |
| Import errors | Invalid uploads clear stale records and prevent export; row-level diagnostics; latest upload wins |

## Added functionality

- CSV, TSV and structured JSON ingestion, sharing the Excel validation contract.
- Sample-data mode and downloadable Excel, CSV and JSON examples.
- Searchable student records with grade filters, mark sorting and pagination.
- A filter for students within two percentage points of any grade boundary, plus distance to the next higher grade and additional whole raw marks required.
- Column mapping for Excel, CSV, TSV and JSON. Standard three-column single-sheet files keep the short import flow; other files show source preview and mapping controls. Unmapped columns are excluded only after confirmation.
- Worksheet selection for multi-sheet Excel files, including workbooks with instructions on the first sheet.
- Grade changes staged per course, with paginated before/after student outcomes and explicit apply/discard. Tables and exports use applied grades. Exports are blocked for the active course while its edits are pending.
- Corrections to course totals after import with raw-score validation and a percentage/grade impact preview before applying.
- Up to five named local drafts with explicit save, update, resume and delete controls. Saved records, maxima and ranges are revalidated on resume; derived percentages are recomputed.
- Grade settings retained per course **for this browser session**, with up to 30 undo steps per course. This intentionally improves on the original reset-on-course-switch behavior.
- Export review dialog with record reconciliation, grade counts, a preview and a course-specific filename. Filtering the student table never filters the export.
- Responsive sidebar/header, mobile stacking, accessible labels, keyboard focus, live validation messages, and native dialogs.
- CSS entrance fades, dialog pop-ins, chart and control transitions, with animations and transitions disabled for reduced-motion preferences.
- Dependencies and fonts installed locally and pinned through `package-lock.json`; the Next.js app does not use the original external SheetJS CDN.

## Input contract

Three fields are required: `BITS ID`, `Course`, and `Total Marks`. Header order can vary, and custom headers can be mapped to these fields. Selected source columns must be distinct. Extra columns are shown in the source preview and excluded after mapping confirmation. Raw marks must be nonnegative integers; fractional raw marks are rejected. Import waits for explicit maximum marks per course (default 100, with an apply-to-all shortcut). Scores cannot exceed the confirmed maximum. Percentages are calculated as raw marks * 100 / maximum, without rounding before grading. Course names are matched without capitalization differences and with surrounding spaces trimmed; the first spelling in each import is kept for display and export. Duplicate student IDs are rejected within that normalized course. Student IDs remain case-sensitive. Blank source rows are ignored; populated rows with missing mapped fields block the full import.

JSON example:

```json
[
  { "BITS ID": "DEMO-001", "Course": "Math", "Total Marks": 82 },
  { "BITS ID": "DEMO-002", "Course": "Math", "Total Marks": 71 }
]
```

CSV uses commas and TSV uses tabs; quoted fields are supported. Limit: 10 MB and 25,000 records per import. Store identifiers as text to preserve leading zeros. Only `.xlsx` Excel files are supported, not legacy `.xls` files.

## Course totals and percentage boundaries

After parsing a file, course records remain pending until the instructor confirms their maximum marks. Cancel discards the pending import; the previous dataset has already been cleared to prevent stale exports. Maxima are never inferred from observed scores. Maximum marks must be positive integers up to 90,071,992,547,409, a numerical precision guard.

For Math out of 600, 479 becomes 79.8333...% (A-) and 480 becomes 80% (A). For Physics out of 200, 150 becomes 75% (A-). Courses sharing a case-insensitive name share one maximum. Built-in sample data has a known maximum of 100.

The interface shows A as 80–100% inclusive and A- as 70–<80%, continuing down to E as 0–<20%. It displays percentages to two decimal places; grades use unrounded values. Statistics, histogram bins and cutoff notes use percentages. CSV keeps the original first three columns (`BITS ID`, `Total Marks`, `Grade`) and appends `Maximum Marks` and `Percentage`; total marks remains the raw score and percentage is exported without display rounding.

Internally the original integer band representation is retained for compatibility: a non-A stored maximum of 79 is presented and evaluated as an exclusive boundary of 80. Existing whole-number grading results are unchanged.

## Data handling and limitations

Student data is processed in browser memory. There are no upload endpoints, accounts, server storage, analytics trackers or automatic saving. Clicking Save in the Saved drafts dialog writes a named copy to browser localStorage. It contains student records, course totals, applied ranges, instructor name, source filename, active course and session time. Undo history, unapplied changes and import source columns are not saved. Saving is blocked until all pending range edits are applied or discarded.

Anyone using the same browser profile can access these unencrypted local drafts. The dialog explains this before saving. Browser cleanup may remove drafts, and quota/access failures are reported without claiming a save succeeded. Refreshing clears the live workspace; resume explicitly loads a saved copy after validation. Up to five saved copies are allowed, and deleting one does not erase the currently open workspace. Fonts and dependencies are served with the app.

This is not a fully offline/PWA application: a first visit and uncached application chunks need connectivity. Once loaded, the grading logic works locally. The browser suite checks an already-loaded session with connectivity disabled.

CSV importers can still infer identifier types differently. The file protects formula-like text, but CSV quoting cannot force every spreadsheet to preserve numeric-looking IDs. Excel export is intentionally excluded from the current scope. Saved drafts do not sync between devices or browser profiles.

## Verification

Recorded local verification before the CI timing fix: **34 logic tests passed, 18 Chrome browser tests passed, and the production build passed.** Browser coverage includes worksheet selection, mapping, course-total correction, impact review, draft persistence/deletion/failures, cutoff filtering, normalization, cancellation, boundary grades and CSV evidence. Automated WCAG A/AA checks reported no violations on the populated workspace, import guide, mapping, draft, impact, course-total confirmation and export dialogs. Desktop and 375px mobile screenshots were inspected.

A subsequent GitHub run caught two contrast scans during translucent animation frames. The shared `tests/browser/accessibility.js` helper now waits for fonts and finite animations to finish before running axe, without disabling motion or accessibility rules. Both affected tests passed three consecutive local runs each after this fix. These results are historical verification, not a claim that every later revision or GitHub run passed.

[App CI](../.github/workflows/ci.yml) uses Node.js 22 and runs locked dependency installation, logic tests, the production build and Chrome browser tests on pushes, pull requests and manual dispatch. Browser tests use the development server; the build is checked separately. Available failure diagnostics are uploaded for seven days. Deployment is not part of this workflow.

The [final testing guide](../tests/fixtures/FINAL_TESTING_GUIDE.md) supplies five-subject valid and invalid CSV datasets, course maxima, expected analytics and validation errors.

`npm test` runs the original 14 regression tests, 13 product tests and 7 workflow tests, including real Excel fixtures and equivalent CSV/TSV/JSON data. `npm run test:e2e` runs Chrome browser checks for ingestion, errors, statistics, grading, saved drafts, search, pagination, native downloads, modal keyboard interaction, mobile overflow and automated accessibility checks. It also creates desktop/mobile screenshots in the ignored `test-results` directory.

Automated accessibility checks do not replace human screen-reader and usability testing. The original bug log records the project author's manual verification of Stage 1, not manual verification of this new UI.

No public deployment is performed by this migration.
