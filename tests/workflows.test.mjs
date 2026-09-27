import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEADERS, freshRanges, normalizeStudents, sampleStudents } from '../lib/grading.mjs';
import { DRAFT_KEY, cutoffInfo, deleteDraft, exactHeaders, gradeImpact, mappedStudents, readDraftList, restoreWorkspace, saveDraft, suggestMapping } from '../lib/workflows.mjs';

function workspace() {
  return { version: 1, students: normalizeStudents(sampleStudents(), { Math: 100, Physics: 100 }), course: 'Math', instructor: 'Dr Test', filename: 'sample.xlsx', ranges: { Math: freshRanges() }, seconds: 60 };
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const draft = (id, data = workspace()) => ({ id, name: `Draft ${id}`, savedAt: '2026-09-27T12:00:00Z', workspace: data });

test('mapping accepts varied headers and extra columns only through explicit selections', () => {
  const rows = [['Name', 'Score', 'Subject', 'Student ID'], ['Person', 480, ' Math ', '001'], ['Other', 450, 'math', '002']];
  assert.deepEqual(suggestMapping(rows), [3, 2, 1]);
  assert.equal(exactHeaders(rows), false);
  assert.deepEqual(mappedStudents(rows, [3, 2, 1]), [{ id: '001', course: 'Math', marks: 480 }, { id: '002', course: 'Math', marks: 450 }]);
  assert.deepEqual(suggestMapping([['Score', 'Marks', 'Course', 'ID']]), [3, 2, -1]);
  assert.equal(exactHeaders([['Course', 'BITS ID', 'Total Marks']]), true);
});

test('mapping never silently drops invalid rows and rejects duplicate, missing or out-of-bounds selections', () => {
  const rows = [['ID', 'Subject', 'Score', 'Name'], ['001', 'Math', 90, 'A']];
  for (const mapping of [[0, 0, 2], [-1, 1, 2], [0, 1, 9], [0, 1]]) assert.throws(() => mappedStudents(rows, mapping));
  assert.throws(() => mappedStudents([rows[0], ['', '', '', 'Only name']], [0, 1, 2]), /Row 2/);
  assert.throws(() => mappedStudents([rows[0], ['001', 'Math', 90, 'A', 'Extra']], [0, 1, 2]), /beyond the header/);
  assert.throws(() => mappedStudents([], [0, 1, 2]), /empty/);
  assert.equal(mappedStudents([...rows, []], [0, 1, 2]).length, 1);
});

test('grade impact includes only changed outcomes and accurately compares normalization', () => {
  const before = normalizeStudents([{ id: 'a', course: 'Math', marks: 80 }, { id: 'b', course: 'Math', marks: 100 }], { Math: 100 });
  const ranges = freshRanges(); ranges[0].min = 85; ranges[1].max = 84;
  const changes = gradeImpact(before, before, freshRanges(), ranges);
  assert.equal(changes.length, 1);
  assert.deepEqual([changes[0].previousGrade, changes[0].nextGrade], ['A', 'A-']);
  const after = normalizeStudents(before, { Math: 200 });
  assert.deepEqual(gradeImpact(before, after, freshRanges(), freshRanges()).map(s => s.after), [40, 50]);
  assert.deepEqual(before.map(s => s.maximumMarks), [100, 100]);
  assert.equal(gradeImpact(before, before, freshRanges(), freshRanges()).length, 0);
});

test('cutoff review distinguishes nearest boundary from the next higher grade and reports raw marks needed', () => {
  const student = normalizeStudents([{ id: 'a', course: 'Math', marks: 479 }], { Math: 600 })[0];
  const info = cutoffInfo(student, freshRanges());
  assert.equal(info.near, true);
  assert.equal(info.nextGrade, 'A');
  assert.equal(info.rawMarksNeeded, 1);
  assert.equal(info.percentagePoints, 80 - student.marks);
  assert.equal(cutoffInfo({ rawMarks: 90, maximumMarks: 100, marks: 90 }, freshRanges()).near, false);
  assert.equal(cutoffInfo({ rawMarks: 80, maximumMarks: 100, marks: 80 }, freshRanges()).nextGrade, null);
  assert.equal(cutoffInfo(student, []), null);
});

test('drafts round-trip through explicit saving, updating and deletion with no mutation of the workspace', () => {
  const db = storage(), original = workspace();
  assert.deepEqual(readDraftList(db), []);
  saveDraft(db, draft('a', original));
  const restored = restoreWorkspace(readDraftList(db)[0].workspace);
  assert.deepEqual(restored.students, original.students);
  assert.equal(restored.seconds, 60);
  assert.equal(restored.instructor, original.instructor);
  saveDraft(db, { ...draft('a'), name: 'Updated' });
  assert.equal(readDraftList(db).length, 1);
  assert.equal(readDraftList(db)[0].name, 'Updated');
  deleteDraft(db, 'a');
  assert.deepEqual(readDraftList(db), []);
  assert.equal(original.students.length, 17);
});

test('draft restoration revalidates raw marks, maxima, duplicate records, course and range schemas', () => {
  const cases = [null, {}, { ...workspace(), version: 2 }, { ...workspace(), students: [] }, { ...workspace(), course: 'Missing' }, { ...workspace(), ranges: { Math: [] } }, { ...workspace(), ranges: { Math: [null] } }];
  for (const invalid of cases) assert.throws(() => restoreWorkspace(invalid));
  let invalid = workspace(); invalid.students[0].rawMarks = -1;
  assert.throws(() => restoreWorkspace(invalid));
  invalid = workspace(); invalid.students[0].maximumMarks = 90;
  assert.throws(() => restoreWorkspace(invalid), /conflicting/);
  invalid = workspace(); invalid.students.push(invalid.students[0]);
  assert.throws(() => restoreWorkspace(invalid), /Duplicate/);
  // Derived percentages are recomputed from raw scores, never trusted.
  invalid = workspace(); invalid.students[0].marks = 999;
  assert.equal(restoreWorkspace(invalid).students[0].marks, 0);
});

test('draft quota, malformed storage and persistence failures never silently replace a saved copy', () => {
  const db = storage();
  for (let i = 0; i < 5; i++) saveDraft(db, draft(String(i)));
  assert.throws(() => saveDraft(db, draft('six')), /five saved drafts/);
  const previous = db.getItem(DRAFT_KEY);
  assert.throws(() => saveDraft({ getItem: db.getItem, setItem() { throw new Error('Quota exceeded'); } }, draft('0')), /Quota/);
  assert.equal(db.getItem(DRAFT_KEY), previous);
  db.setItem(DRAFT_KEY, 'broken');
  assert.throws(() => readDraftList(db));
  assert.throws(() => saveDraft(db, draft('a')));
  assert.equal(db.getItem(DRAFT_KEY), 'broken');
});
