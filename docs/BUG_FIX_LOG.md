# Stage 1 — Bug fix log

This log documents the original HTML prototype. For the rebuilt application and its separate automated browser verification, see [the Next.js migration report](NEXTJS_MIGRATION.md).

Scope: fixes to `BITS_Digital_CodeForge_Challenge.html`. The supplied brief describes the challenge; the user's current request is to debug this file and document the fixes. Product expansion and Next.js deployment are later stages.

The reproduction column describes workflows that expose the original code defects, identified through source inspection. Automated verification executes the fixed HTML's actual inline JavaScript using Node's test runner and a small DOM adapter. It does **not** constitute a real-browser, real-workbook, or visual test. The project author has separately confirmed that all browser checks below were completed successfully.

| # | Bug / Issue Identified | How You Reproduced It | Root Cause | Fix Implemented | How You Tested the Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | File picker excludes the specified `.xlsx` format | Open the upload picker for a `.xlsx` workbook | `accept` specifies `.xls` | Accept and validate `.xlsx`; show an error for other formats | Automated rejection of `.csv`; actual picker check passed (manual, project author) |
| 2 | Duplicate and stale course options | Upload a workbook with multiple students in one course, then a different workbook | Appends a course for every row without clearing previous options | Clear state on upload; populate unique courses | Automated sequential uploads assert unique courses and removal of the previous course |
| 3 | Old analytics and export survive replacement uploads | Select a course, then upload a new or invalid file | Data replacement does not reset selection, statistics, or export state | Clear records, selection, analytics, summary history, and session before reading | Automated valid-to-valid and valid-to-invalid uploads; empty statistics and disabled export asserted |
| 4 | Slow uploads can overwrite newer uploads | Start reading one file, then select a second before the first read completes | No protection against out-of-order read callbacks | Version each upload and ignore obsolete reads | Automated deferred first upload resolves after the second; the second remains selected as the dataset |
| 5 | Malformed files and missing Excel dependency fail without useful feedback | Load a corrupt workbook or use the page when its CDN script failed | No exception handling or dependency check | Catch parsing/read errors, show status, keep export disabled, allow retry | Automated parser failure and missing-reader cases; real corrupt workbook check passed (manual, project author) |
| 6 | Invalid records corrupt statistics or disappear from grading | Supply missing headers, blank marks, text, fractions, negative marks, marks over 100, or duplicate student/course pairs | Raw worksheet objects used without schema or row validation | Validate the first worksheet atomically; normalize numeric text and whitespace; report row errors; reject duplicate identities within a course | Automated schema, duplicate, missing-field, invalid-mark and normalization cases |
| 7 | Min and Max labels are reversed | Select marks 0 and 100 and inspect the labeled cards | HTML IDs are assigned to the opposite labels | Correct the HTML label-to-ID mapping | Automated HTML mapping assertions and numerical statistics checks |
| 8 | Empty statistics become undefined/NaN; numeric strings produce incorrect aggregates | Clear the course selection, or load marks stored as text | No empty-array guard; addition can concatenate strings | Show em dashes for empty statistics; normalize valid marks to numbers on ingestion | Automated initial/empty states, numeric text, average, and even-count median |
| 9 | Reset crashes before a course is selected and asks twice | Click Reset on initial load; then reset after selecting a course | Grade controls only exist after course selection; two confirmation calls | Initialize grade controls at startup; retain one confirmation | Automated reset on initial load; one confirmation call verified in source |
| 10 | Incomplete grade coverage passes validation and export drops students | Set A maximum to 99 or E minimum to 1 | Only neighboring bands are checked; endpoints are not | Require coverage of all integers 0–100 and revalidate before CSV creation | Automated missing endpoints, gaps, overlaps and all 101 default integer marks |
| 11 | Valid single-mark bands fail, while blank select values become zero | Set A to 100–100 and A- maximum to 99; separately cascade a minimum of 0 | Rejects equal bounds; unary numeric conversion converts an empty selection to 0 | Permit Min = Max; reject empty, reversed, noninteger, or out-of-domain bounds | Automated single-mark band and invalid cascade checks |
| 12 | Download remains available without instructor or student records | Select a course, then clear the instructor or course | Download eligibility only considers range validity | Check name, selected-course records, and ranges on edits and again at export | Automated instructor clearing, empty data, and direct export guard tests |
| 13 | Grade counts look valid while bands are invalid | Introduce a gap or overlap and inspect the summary | Summary still assigns students with invalid ranges | Replace counts with a correction prompt until ranges are valid | Automated summary counts and invalid-range prompt assertions; visual prompt check passed (manual, project author) |
| 14 | Histogram overflows and normal curve produces invalid coordinates | Use a bin with hundreds of students, or a cohort with identical marks | Fixed pixels per student; division by zero at zero standard deviation; unrelated curve scaling | Scale bars to the largest count; label disjoint bins including 100; show empirical counts and remove the misleading normal overlay | Automated 1,000-student equal-mark cohort asserts finite, bounded bars and accessible counts |
| 15 | CSV fields break with commas, quotes or newlines; formula-like fields are unsafe | Use punctuation/newlines in names or IDs, or an ID starting with `=` | Direct string concatenation without escaping | Quote fields, double internal quotes, use CRLF and UTF-8 BOM, neutralize spreadsheet formula prefixes | Automated exact CSV content checks for punctuation, Unicode, multiline fields and formula prefixes |
| 16 | Download URLs accumulate | Export repeatedly | Created object URLs are never revoked | Attach/click/remove download link and revoke its object URL after a delay | Automated link click and URL revocation assertions; native browser save passed (manual, project author) |
| 17 | Timer does not describe the current course session | Wait before selecting a course, export, then grade another course | Starts at page load, stops after first export, and never resets | Start/reset on course selection, clear on upload, render immediately, continue while reviewing after export | Automated initial timer state and session paths; elapsed-time browser check passed (manual, project author) |
| 18 | Fixed-width layout and unnamed controls impair use on small screens and assistive technology | Open on a narrow viewport or inspect control names | Fixed two-column workspace; missing viewport metadata and accessible names | Add stacking breakpoint, fluid canvas, input/select labels, visible focus, and status roles | Source inspection; mobile, keyboard and screen-reader checks passed (manual, project author) |
| 19 | Fractional-mark guidance contradicts the input contract and rounding example | Read guidance: “nearest integer” with 80.2 → 81 | Incorrect explanatory copy | State that whole marks 0–100 are required and fractions are rejected | Source inspection plus automated fractional-input rejection |

## Run the automated checks

From the repository root, with Node.js 18 or later:

```sh
node --test tests/grading.test.cjs
```

Recorded result: **14 tests passed, 0 failed**. The harness stubs the browser DOM and SheetJS interface; it covers application logic, upload races and error paths without downloading packages.

## Browser verification checklist — tested

**Result: all 9 checks passed.** Tested manually by the project author, who confirmed the results. The steps below are retained for repeat testing. These results are separate from the automated checks; the assistant did not independently rerun the browser tests.

1. **Passed.** Open the HTML in a browser with network access for the Excel reader. Verify the initial em dashes, 00:00 timer, and disabled download. Reset once and cancel once; neither should throw.
2. **Passed.** Create an `.xlsx` workbook with exactly `BITS ID`, `Course`, `Total Marks`. Add Math students with 0, 19, 20, 29, 30, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80 and 100. Add a Physics student with 100.
3. **Passed.** Upload it; expect two unique courses. Enter a name and select Math. Expect Min 0, Max 100, Avg 49.56, Median 49.50, and two students in each grade.
4. **Passed.** Clear the instructor name and confirm export is disabled. Restore it. Set A maximum to 99; expect a coverage error and no export. Reset, then set A minimum to 100; expect a valid single-mark A band and A- maximum 99.
5. **Passed.** Download default grades. Open the CSV as text and with a CSV importer. Confirm all 16 Math students appear once with the expected grades. Repeat with an instructor containing a comma, quotes, Unicode and a newline. Check that formula-like identifiers import as text.
6. **Passed.** Upload a second workbook containing only Biology. Confirm Math and Physics disappear, the chart clears, and export is disabled until selecting Biology. Try a blank workbook, corrupt `.xlsx`, missing header, duplicate row, missing mark, text mark, 80.2, -1 and 101; expect an error and no export.
7. **Passed.** Select a one-student or identical-mark course, then a large cohort. Check chart bounds and labels, including 100. Switch courses and verify that ranges reset to defaults and the session timer resets; after export it continues while reviewing.
8. **Passed.** At 375px width, check that controls stack without horizontal page overflow. Tab through controls, check visible focus and accessible names, and inspect live error/status announcements with a screen reader.
9. **Passed.** Disable network access and reload without a cached Excel reader. Attempt upload; expect an actionable dependency error.

## Remaining limitations

- Excel reading still depends on the original externally hosted SheetJS script; offline packaging and dependency review remain deployment work.
- Only the first worksheet is imported. A status message explicitly discloses ignored worksheets. Only `.xlsx` is supported at this stage.
- Store identifiers as text in Excel if leading zeros matter. Formatting or precision already lost in numeric source cells cannot be recovered reliably.
- Changing course resets grade ranges, matching the original workflow. Per-course saved drafts and persistence are future product features.
- CSV importers can infer identifier types differently. Check identifiers after importing; quoting does not universally force text types.
- This is a challenge prototype, not an official academic grading system. The browser checklist above passed according to the project author’s manual verification.
