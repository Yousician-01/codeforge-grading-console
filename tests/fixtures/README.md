# Sample grading workbook

## Final testing datasets

- [final-testing-valid.csv](final-testing-valid.csv): 300 fictional records across five subjects, with 60 students per subject and varied maximum marks.
- [final-testing-invalid.csv](final-testing-invalid.csv): the same cohort with eight deliberate entry-validation errors.
- [Final testing guide](FINAL_TESTING_GUIDE.md): required course totals, expected statistics/grade counts, error row numbers and a manual walkthrough. Enter the documented totals during import; they are intentionally not embedded in the three-column CSV.

## Original sample

[grading-sample.xlsx](grading-sample.xlsx) contains fictional student IDs and the exact marks used in the browser verification checklist. All identifiers are stored as text and marks as numbers.

Upload it to the grading console, enter an instructor name, and select a course.

| Course | Students | Min | Max | Average | Median | Default grades |
| --- | --- | --- | --- | --- | --- | --- |
| Math | 16 | 0 | 100 | 49.56 | 49.5 | Two students in each grade |
| Physics | 1 | 100 | 100 | 100.00 | 100 | One A |

The workbook contains one worksheet named `Marks` with exactly `BITS ID`, `Course`, and `Total Marks`. It supplies the valid baseline dataset; the invalid-input and replacement-workbook checks require separate edited copies.

## Worksheet and column-mapping example

[multiple-worksheets.xlsx](multiple-worksheets.xlsx) has an `Instructions` sheet and an `Actual scores` sheet. Choose `Actual scores`, map `Student ID`, `Subject` and `Score` to the required fields, and exclude `Comment`. Confirm Algebra's maximum as **600**. The fictional students `001` and `002` have 479 and 480 marks, resulting in A- and A respectively under default ranges.
