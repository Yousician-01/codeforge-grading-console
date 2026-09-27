# Final manual testing datasets

All records are fictional. Use these files with the Next.js app, not the preserved Stage 1 HTML.

## Valid dataset

Import [final-testing-valid.csv](final-testing-valid.csv): **300 records, 60 students across 5 subjects**. Each student ID intentionally appears once in each subject. Some course names include capitalization/outer-space variations; these must still resolve to only five subjects.

At the course-total confirmation step, enter:

| Course | Maximum marks | Records |
| --- | ---: | ---: |
| Mathematics for Data Science | 600 | 60 |
| Probability and Statistics | 200 | 60 |
| Python Programming | 100 | 60 |
| Machine Learning | 300 | 60 |
| Database Systems | 150 | 60 |

With default grade ranges, expect these **normalized percentage** statistics and grade counts:

| Course | Min % | Max % | Average % | Median % | A | A- | B | B- | C | C- | D | E |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mathematics for Data Science | 0.00 | 100.00 | 59.06 | 62.00 | 2 | 17 | 17 | 2 | 16 | 2 | 2 | 2 |
| Probability and Statistics | 0.00 | 100.00 | 67.09 | 73.00 | 17 | 17 | 2 | 16 | 2 | 2 | 2 | 2 |
| Python Programming | 0.00 | 100.00 | 62.35 | 67.00 | 17 | 2 | 16 | 17 | 2 | 2 | 2 | 2 |
| Machine Learning | 0.00 | 100.00 | 70.49 | 78.00 | 17 | 16 | 17 | 2 | 2 | 2 | 2 | 2 |
| Database Systems | 0.00 | 100.00 | 65.93 | 72.00 | 16 | 17 | 2 | 17 | 2 | 2 | 2 | 2 |

### Suggested walkthrough

1. Upload the valid CSV and confirm the five maxima above. Leaving all maxima at 100 must block confirmation because several raw scores exceed 100.
2. Enter an instructor name. Switch between courses, check the table above, and try pagination (six pages per subject).
3. In Mathematics, search `DEMO2026DS015`: 479/600 = 79.8333...%, grade A-. Search `DEMO2026DS016`: 480/600 = 80%, grade A. These also exercise the near-cutoff filter.
4. Change the A minimum to 85, review affected students, then cancel/discard or apply. The table must retain applied grades until confirmation. Restore defaults before comparing the statistics/counts above again.
5. Edit a course total, preview its effect, and cancel. Its original results should remain unchanged. Set Mathematics to 599 to confirm the student scoring 600 prevents application.
6. Save a named draft, reload, and resume it. Verify the student count, totals and applied ranges, then delete the saved copy if no longer needed.
7. Filter/search the student table and export. The CSV must still include all 60 students in the active course, with original marks, maximum marks, percentage and grade.

## Invalid dataset

Import [final-testing-invalid.csv](final-testing-invalid.csv): the same cohort with deliberate errors and one extra duplicate row (**301 records**). It must fail during entry validation, before course-total confirmation, with **8 errors**. No records should be committed and export must remain disabled. If you had another dataset loaded, the current import flow clears it; save a draft before replacement if needed.

Row numbers include the header as row 1:

| CSV row | Deliberate problem |
| ---: | --- |
| 9 | Negative mark: -5 |
| 15 | Fractional raw mark: 80.5 |
| 21 | Text mark: Absent |
| 27 | Text mark: NC |
| 33 | Missing mark |
| 69 | Missing student ID |
| 131 | Missing course |
| 302 | Duplicate student/course, despite course case and spacing differences |

Actual errors verified against the app validator:

- Row 9: Total Marks must be a nonnegative whole number no greater than 90071992547409.
- Row 15: Total Marks must be a nonnegative whole number no greater than 90071992547409.
- Row 21: Total Marks must be a nonnegative whole number no greater than 90071992547409.
- Row 27: Total Marks must be a nonnegative whole number no greater than 90071992547409.
- Row 33: Total Marks must be a nonnegative whole number no greater than 90071992547409.
- Row 69: BITS ID and Course must both be filled in.
- Row 131: BITS ID and Course must both be filled in.
- Row 302: Duplicate student DEMO2026DS001 in Mathematics for Data Science.

To test maximum-mark validation separately, use the **valid** file with an incorrect maximum. The invalid file stops earlier by design. Neither file tests column mapping or worksheet selection; use the existing [multiple-worksheets.xlsx](multiple-worksheets.xlsx) fixture for those workflows.
