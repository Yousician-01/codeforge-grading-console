import Papa from 'papaparse';

export const GRADES = ['A', 'A-', 'B', 'B-', 'C', 'C-', 'D', 'E'];
export const HEADERS = ['BITS ID', 'Course', 'Total Marks'];
export const DEFAULTS = [[80, 100], [70, 79], [60, 69], [50, 59], [40, 49], [30, 39], [20, 29], [0, 19]];
export const freshRanges = () => DEFAULTS.map(([min, max]) => ({ min, max }));
export const MAX_SCORE = Math.floor(Number.MAX_SAFE_INTEGER / 100);
export const MAX_ROWS = 25000;
export const MAX_BYTES = 10 * 1024 * 1024;

export class ImportError extends Error {
  constructor(issues) {
    super(issues[0]);
    this.issues = issues;
  }
}

export function validateRows(rows, { rawMarks = false } = {}) {
  if (!rows.length) throw new ImportError(['The file is empty. Add the three column headers and at least one student.']);
  const headers = rows[0].map(v => String(v ?? '').replace(/^\uFEFF/, '').trim());
  if (headers.length !== 3 || HEADERS.some(h => headers.filter(v => v === h).length !== 1)) {
    throw new ImportError(['Use exactly these column headers: BITS ID, Course, Total Marks. Their order can vary.']);
  }
  if (rows.length > MAX_ROWS + 1) throw new ImportError([`Import up to ${MAX_ROWS.toLocaleString()} rows at a time.`]);
  const issues = [], students = [], seen = new Set(), courseNames = new Map();
  rows.slice(1).forEach((row, index) => {
    if (row.every(v => v == null || String(v).trim() === '')) return;
    const values = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    const prefix = `Row ${index + 2}: `;
    const id = typeof values['BITS ID'] === 'string' || typeof values['BITS ID'] === 'number' ? String(values['BITS ID']).trim() : '';
    const course = typeof values.Course === 'string' ? values.Course.trim() : '';
    const raw = values['Total Marks'];
    const marks = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(?:\.0+)?$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!id || !course) issues.push(prefix + 'BITS ID and Course must both be filled in.');
    else if (typeof values['BITS ID'] === 'number' && !Number.isSafeInteger(values['BITS ID'])) issues.push(prefix + 'Store the BITS ID as text to preserve its digits.');
    else if (!Number.isSafeInteger(marks) || marks < 0 || marks > (rawMarks ? MAX_SCORE : 100)) issues.push(prefix + (rawMarks ? `Total Marks must be a nonnegative whole number no greater than ${MAX_SCORE}.` : 'Total Marks must be a whole number from 0 to 100.'));
    else if (row.slice(3).some(v => v != null && String(v).trim() !== '')) issues.push(prefix + 'Remove the extra columns.');
    else {
      // Match courses without casing differences while retaining the first
      // trimmed spelling for the selector, statistics, drafts and exports.
      const courseKey = course.toLowerCase();
      if (!courseNames.has(courseKey)) courseNames.set(courseKey, course);
      const displayCourse = courseNames.get(courseKey);
      const key = JSON.stringify([id, courseKey]);
      if (seen.has(key)) issues.push(prefix + `Duplicate student ${id} in ${displayCourse}.`);
      else { seen.add(key); students.push({ id, course: displayCourse, marks }); }
    }
  });
  if (issues.length) throw new ImportError(issues);
  if (!students.length) throw new ImportError(['No student records found. Add at least one row below the headers.']);
  return students;
}

export function parseDelimited(text, delimiter = ',', options) {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { delimiter, skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new ImportError(parsed.errors.map(e => `CSV row ${(e.row ?? 0) + 1}: ${e.message}`));
  return validateRows(parsed.data, options);
}

export function parseJSON(text, options) {
  let records;
  try { records = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new ImportError(['This is not valid JSON. Use an array of objects with BITS ID, Course and Total Marks.']); }
  if (!Array.isArray(records) || !records.length) throw new ImportError(['JSON must contain a nonempty array of student objects.']);
  const invalid = records.findIndex(row => !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 3 || HEADERS.some(h => !Object.hasOwn(row, h)));
  if (invalid !== -1) throw new ImportError([`JSON record ${invalid + 1}: use exactly BITS ID, Course and Total Marks.`]);
  return validateRows([HEADERS, ...records.map(row => HEADERS.map(h => row[h]))], options);
}

// Confirm course maxima before committing any imported records.
export function normalizeStudents(students, maxima) {
  const issues = [];
  const result = students.map(student => {
    const maximumMarks = Object.hasOwn(maxima, student.course) ? maxima[student.course] : undefined;
    const rawMarks = student.rawMarks ?? student.marks;
    if (!Number.isSafeInteger(maximumMarks) || maximumMarks <= 0 || maximumMarks > MAX_SCORE) {
      const message = `${student.course}: maximum marks must be a positive whole number no greater than ${MAX_SCORE}.`;
      if (!issues.includes(message)) issues.push(message);
    } else if (!Number.isSafeInteger(rawMarks) || rawMarks < 0 || rawMarks > maximumMarks) {
      issues.push(`${student.course}, student ${student.id}: score ${rawMarks} exceeds the maximum ${maximumMarks} or is not a nonnegative whole number.`);
    }
    return { ...student, rawMarks, maximumMarks, marks: rawMarks * 100 / maximumMarks };
  });
  if (issues.length) throw new ImportError(issues);
  return result;
}

export function validateRanges(ranges) {
  if (ranges.length !== GRADES.length) return 'All eight grade bands are required.';
  for (const [i, range] of ranges.entries()) {
    const { min, max } = range;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) return `${GRADES[i]} needs whole-number bounds from 0 to 100, with minimum no greater than maximum.`;
    if (i === 0 && max !== 100 || i === 7 && min !== 0) return 'Cover the full scale: A must end at 100 and E must start at 0.';
    if (i > 0 && max !== ranges[i - 1].min - 1) return `There is a gap or overlap between ${GRADES[i - 1]} and ${GRADES[i]}. Their boundaries must meet.`;
  }
  return '';
}

export function gradeFor(marks, ranges) {
  if (!Number.isFinite(marks) || marks < 0 || marks > 100) return null;
  // Existing integer band storage: lower bands end exclusively at max + 1.
  const index = ranges.findIndex(({ min, max }, i) => marks >= min && (i === 0 ? marks <= max : marks < max + 1));
  return index === -1 ? null : GRADES[index];
}

export function statistics(students) {
  if (!students.length) return null;
  const marks = students.map(s => s.marks).sort((a, b) => a - b), n = marks.length;
  return { min: marks[0], max: marks[n - 1], average: marks.reduce((a, b) => a + b, 0) / n, median: n % 2 ? marks[Math.floor(n / 2)] : (marks[n / 2 - 1] + marks[n / 2]) / 2 };
}

export function gradeCounts(students, ranges) {
  const counts = Object.fromEntries(GRADES.map(g => [g, 0]));
  if (validateRanges(ranges)) return counts;
  students.forEach(s => { const g = gradeFor(s.marks, ranges); if (g) counts[g]++; });
  return counts;
}

export function csvCell(value) {
  let text = String(value);
  if (/^\s*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function exportCSV(students, ranges, instructor, course) {
  const error = validateRanges(ranges);
  if (error) throw new Error(error);
  const selected = students.filter(s => s.course === course);
  if (!instructor.trim() || !course || !selected.length) throw new Error('Enter your name and select a course with students before exporting.');
  const rows = [['Instructor', instructor.trim()], ['Course', course], [], ['BITS ID', 'Total Marks', 'Grade', 'Maximum Marks', 'Percentage']];
  for (const student of selected) {
    const grade = gradeFor(student.marks, ranges);
    const rawMarks = student.rawMarks ?? student.marks;
    const maximumMarks = student.maximumMarks ?? 100;
    if (!grade || !Number.isSafeInteger(rawMarks) || !Number.isSafeInteger(maximumMarks) || maximumMarks <= 0 || maximumMarks > MAX_SCORE || rawMarks < 0 || rawMarks > maximumMarks || student.marks !== rawMarks * 100 / maximumMarks) throw new Error(`Student ${student.id} could not be graded. Review the source marks.`);
    rows.push([student.id, rawMarks, grade, maximumMarks, student.marks]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function exportFilename(course) {
  return `${course.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'course'}-grades.csv`;
}

export function sampleStudents() {
  const marks = [0, 19, 20, 29, 30, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80, 100];
  return [...marks.map((marks, i) => ({ id: `DEMO-MATH-${String(i + 1).padStart(3, '0')}`, course: 'Math', marks })), { id: 'DEMO-PHYS-001', course: 'Physics', marks: 100 }];
}
