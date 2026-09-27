# Product roadmap

## Completed: Stage 1 debugging

The provided HTML app was fixed and documented in [the bug log](BUG_FIX_LOG.md). Its source and regression suite remain intact as the challenge baseline.

## Implemented: Stage 2 product rebuild

The active application is now a Next.js workspace with a redesigned responsive interface. It preserves the original grading contract while adding structured imports, record review and a clearer export process.

- **Ingestion:** Excel, CSV, TSV and JSON; worksheet selection and column mapping; shared validation; per-course maximum-mark confirmation and percentage normalization; row errors; sample data and downloadable templates.
- **Analytics:** count, mean, median, minimum, maximum, marks histogram and live grade counts.
- **Review:** student search, grade filtering, mark sorting, pagination, a near-cutoff filter and distance to the next grade.
- **Grading:** per-course session settings, reset, undo, complete grade coverage and before/after impact review; post-import course-total correction.
- **Exports:** preview, student reconciliation, all-course-record export regardless of table filters, course-specific filenames and escaped CSV content.
- **Drafts:** explicit on-device saving, resuming, updating and deletion, with validation of restored data.
- **Usability:** responsive layout, labeled controls, visible keyboard focus, accessible dialogs and local fonts.

See [migration details](NEXTJS_MIGRATION.md) for intentional behavior changes, data handling and limits.

## Remaining review and future work

1. Human screen-reader testing, instructor feedback and cross-browser verification beyond Chrome.
2. Deployment smoke tests and operational review of the chosen hosting environment.
3. Optional future account-based collaboration only after deciding permissions and student-data handling.

Excel export was explicitly excluded from the current feature request; CSV remains the output format.

## Stage 3: deployment

The Next.js migration is implemented; public deployment remains separate work.

Before publishing, run the tests and production build on the final revision, verify the target environment, and smoke-test the hosted URL with the fictional fixtures. Include the original bug log, the enhancement summary and the repository link in the submission.

Student data stays in browser memory unless the instructor explicitly saves a draft in this browser. No backend or accounts are used. Any future server storage requires an explicit product decision.
