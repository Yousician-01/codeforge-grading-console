import { HEADERS, MAX_ROWS, ImportError, validateRows, normalizeStudents, freshRanges, validateRanges, gradeFor, GRADES } from './grading.mjs';

const ALIASES = [['bits id', 'student id', 'id', 'roll number'], ['course', 'subject', 'course name'], ['total marks', 'marks', 'score', 'total score']];

export function suggestMapping(rows) {
  const headers = (rows[0] || []).map(h => String(h ?? '').trim().toLowerCase());
  return ALIASES.map(names => {
    const matches = headers.flatMap((h, i) => names.includes(h) ? [i] : []);
    return matches.length === 1 ? matches[0] : -1;
  });
}

export function mappedStudents(rows, mapping) {
  const headers = rows[0] || [];
  if (!headers.length) throw new ImportError(['This worksheet is empty. Choose another worksheet.']);
  if (rows.length > MAX_ROWS + 1) throw new ImportError([`Import up to ${MAX_ROWS.toLocaleString()} rows at a time.`]);
  if (mapping.length !== 3 || new Set(mapping).size !== 3 || mapping.some(i => !Number.isInteger(i) || i < 0 || i >= headers.length)) throw new ImportError(['Choose a different source column for each required field.']);
  const tooWide = rows.slice(1).findIndex(row => row.slice(headers.length).some(v => v != null && String(v).trim() !== ''));
  if (tooWide !== -1) throw new ImportError([`Row ${tooWide + 2}: data extends beyond the header columns. Add a header or remove the extra values.`]);
  // Keep blank source rows, but reject populated records with missing mapped values.
  const mapped = rows.slice(1).map(row => {
    if (row.every(v => v == null || String(v).trim() === '')) return [];
    const values = mapping.map(i => row[i]);
    if (values.every(v => v == null || String(v).trim() === '')) values[2] = 'Missing mapped fields';
    return values;
  });
  return validateRows([HEADERS, ...mapped], { rawMarks: true });
}

export function exactHeaders(rows) {
  const headers = (rows[0] || []).map(h => String(h ?? '').trim());
  return headers.length === 3 && HEADERS.every(h => headers.filter(v => v === h).length === 1);
}

export function gradeImpact(before, after, previousRanges, nextRanges) {
  const byId = new Map(before.map(s => [JSON.stringify([s.course, s.id]), s]));
  return after.flatMap(student => {
    const old = byId.get(JSON.stringify([student.course, student.id]));
    if (!old) throw new Error('Cannot compare mismatched student records.');
    const previousGrade = gradeFor(old.marks, previousRanges);
    const nextGrade = gradeFor(student.marks, nextRanges);
    if (previousGrade === nextGrade && old.marks === student.marks) return [];
    return [{ id: student.id, course: student.course, before: old.marks, after: student.marks, previousGrade, nextGrade }];
  });
}

export function cutoffInfo(student, ranges) {
  if (validateRanges(ranges)) return null;
  const grade = gradeFor(student.marks, ranges), index = GRADES.indexOf(grade);
  if (index < 0) return null;
  const nearest = Math.min(...ranges.slice(0, -1).map(r => Math.abs(student.marks - r.min)));
  if (index === 0) return { near: nearest <= 2, nextGrade: null, percentagePoints: 0, rawMarksNeeded: 0 };
  const threshold = ranges[index - 1].min;
  return {
    near: nearest <= 2,
    nextGrade: GRADES[index - 1],
    percentagePoints: threshold - student.marks,
    rawMarksNeeded: Math.ceil(threshold * student.maximumMarks / 100) - student.rawMarks
  };
}

export const DRAFT_KEY = 'gradecraft.drafts.v1';
export const MAX_DRAFTS = 5;

export function readDraftList(storage) {
  const text = storage.getItem(DRAFT_KEY);
  if (!text) return [];
  const data = JSON.parse(text);
  if (data.version !== 1 || !Array.isArray(data.drafts) || data.drafts.length > MAX_DRAFTS || data.drafts.some(d => !d || typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.savedAt !== 'string') || new Set(data.drafts.map(d => d.id)).size !== data.drafts.length) throw new Error('Saved draft storage is not recognized. You can clear the saved drafts on this device.');
  return data.drafts;
}

export function restoreWorkspace(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.students) || !value.students.length || value.students.length > MAX_ROWS || typeof value.instructor !== 'string' || typeof value.filename !== 'string' || typeof value.course !== 'string') throw new Error('This draft is incomplete or uses an unsupported format.');
  const raw = validateRows([HEADERS, ...value.students.map(s => [s?.id, s?.course, s?.rawMarks])], { rawMarks: true });
  const totals = new Map();
  value.students.forEach((s, i) => {
    const course = raw[i].course;
    if (totals.has(course) && totals.get(course) !== s.maximumMarks) throw new Error('The draft has conflicting maximum marks for a course.');
    totals.set(course, s.maximumMarks);
  });
  const students = normalizeStudents(raw, Object.fromEntries(totals));
  const courses = [...totals.keys()];
  if (!courses.includes(value.course)) throw new Error('The saved active course is missing from this draft.');
  const ranges = Object.fromEntries(courses.map(c => {
    const r = value.ranges && Object.hasOwn(value.ranges, c) ? value.ranges[c] : freshRanges();
    if (!Array.isArray(r) || r.some(b => !b || typeof b !== 'object') || validateRanges(r)) throw new Error(`Invalid saved grade ranges for ${c}.`);
    return [c, r.map(({ min, max }) => ({ min, max }))];
  }));
  return { version: 1, students, course: value.course, instructor: value.instructor, filename: value.filename, ranges, seconds: Number.isSafeInteger(value.seconds) && value.seconds >= 0 ? value.seconds : 0 };
}

export function saveDraft(storage, entry) {
  const workspace = restoreWorkspace(entry.workspace);
  const list = readDraftList(storage);
  const index = list.findIndex(d => d.id === entry.id);
  if (index < 0 && list.length >= MAX_DRAFTS) throw new Error('You have five saved drafts. Delete one or update the resumed draft.');
  const draft = { ...entry, workspace };
  const next = index < 0 ? [draft, ...list] : list.map((d, i) => i === index ? draft : d);
  storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: next }));
  return next;
}

export function deleteDraft(storage, id) {
  const next = readDraftList(storage).filter(d => d.id !== id);
  storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: next }));
  return next;
}
