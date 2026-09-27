# Product direction after debugging

The current stage fixes the supplied HTML app and records evidence. It does not deploy the app, migrate frameworks, or claim production readiness.

## Stage 2 — Make the workflow usable

Preserve the core contract: select a course, inspect validated marks, configure complete grade bands, review every student's assigned grade, and export without silent omissions.

Prioritize these improvements:

1. **Guided ingestion:** Excel and CSV first, followed by structured JSON. Provide column mapping, preview, per-row errors and a clear policy for duplicate identities and multiple worksheets. Reuse one normalized data contract across formats. Never silently round marks or drop rows.
2. **Review before export:** searchable student table, grade and boundary filters, grade-change preview, and a reconciliation showing imported, graded, and exported record counts.
3. **Grading drafts:** retain settings per course, support undo/reset, and show unsaved changes. Decide whether drafts stay on the device or require accounts before introducing storage.
4. **Analytics that answer instructor questions:** distribution counts, mean/median, boundary students and the effect of changing thresholds. Provide text/table alternatives to charts.
5. **Clear, accessible interaction:** consistent labeled controls, keyboard workflows, responsive layout, readable contrast, and actionable errors beside affected data.
6. **Reliable exports:** previews, course-specific filenames, explicit metadata, and spreadsheet output that preserves identifier strings. Verify record reconciliation and safe text handling.

These address UI, analytics, interactions, product features, validation, responsiveness, accessibility and exports without adding features merely to fill categories.

## Stage 3 — Next.js and deployment

For the final deployment phase, migrate to Next.js while preserving the grading rules and regression coverage. Port pure ingestion, validation, grading and export logic into testable modules, then build the application UI around them.

Before the deployment commit:

- Complete browser tests with real workbooks, CSVs and JSON fixtures, including invalid inputs and grading boundaries.
- Package and review dependencies; replace reliance on a floating CDN script.
- Decide data handling, persistence and access requirements. A client-only workflow can avoid uploading student records to a server; server storage needs an explicit product decision.
- Verify mobile layout, keyboard navigation, accessible errors, export fidelity and production build.
- Deploy the finished app, smoke-test its public URL, and include the bug log plus a concise enhancement summary in the submission.

Migration is a planned deliverable, not part of the current Stage 1 changes.
