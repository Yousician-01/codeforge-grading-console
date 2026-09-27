# Sample grading workbook

[grading-sample.xlsx](grading-sample.xlsx) contains fictional student IDs and the exact marks used in the browser verification checklist. All identifiers are stored as text and marks as numbers.

Upload it to the grading console, enter an instructor name, and select a course.

| Course | Students | Min | Max | Average | Median | Default grades |
| --- | --- | --- | --- | --- | --- | --- |
| Math | 16 | 0 | 100 | 49.56 | 49.5 | Two students in each grade |
| Physics | 1 | 100 | 100 | 100.00 | 100 | One A |

The workbook contains one worksheet named `Marks` with exactly `BITS ID`, `Course`, and `Total Marks`. It supplies the valid baseline dataset; the invalid-input and replacement-workbook checks require separate edited copies.
