# BITS Digital Grading Console

A work-in-progress improvement of the sample **BITS Pilani Digital Advanced Grading Console** provided as part of the CodeForge challenge. The current stage fixes the original HTML app; the full product and Next.js deployment come later.

---

## Project Objective

The challenge provides a working prototype of a grading console that allows an instructor to:

- Upload student marks
- Select a course
- View basic marks analytics
- Configure grade ranges
- Review grade distributions
- Validate grading ranges
- Export final grades as CSV

The provided application serves as the starting point for this project.

My approach is divided into three stages:

### Stage 1 - Debug

First, I am working with the provided application to:

- Understand the existing implementation
- Explore the application through different workflows
- Reproduce existing bugs and edge cases
- Identify their root causes
- Implement targeted fixes
- Test the fixes
- Document the debugging process

The goal of this stage is to make the original grading workflow reliable without changing its core functionality.

Open `BITS_Digital_CodeForge_Challenge.html` in a browser to run it. Network access is needed for its existing Excel-reader dependency. Upload an `.xlsx` workbook whose first worksheet has exactly `BITS ID`, `Course`, and `Total Marks`; marks must be whole numbers from 0 to 100. Enter an instructor name, select a course, review ranges, then download grades.

- [Sample Excel workbook with fictional students](tests/fixtures/grading-sample.xlsx)
- [Bug fix log and completed browser checks](docs/BUG_FIX_LOG.md)
- [Product and Next.js deployment roadmap](docs/PRODUCT_ROADMAP.md)

Run the dependency-free application-logic checks with Node.js 18 or later:

```sh
node --test tests/grading.test.cjs
```

The automated tests use a small DOM adapter. The project author has also confirmed that the manual browser and real-workbook checklist passed. CSV/JSON ingestion, the broader redesign, Next.js migration and deployment are planned work, not implemented features.

The debugging process follows:

```text
Explore
   ↓
Reproduce
   ↓
Diagnose
   ↓
Fix
   ↓
Test
   ↓
Document
```
