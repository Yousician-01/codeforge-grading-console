import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from 'read-excel-file/node';
import Papa from 'papaparse';
import { normalizeStudents, MAX_SCORE } from '../lib/grading.mjs';
import { HEADERS, GRADES, MAX_ROWS, exportCSV, exportFilename, freshRanges, gradeFor, gradeCounts, parseDelimited, parseJSON, sampleStudents, statistics, validateRanges, validateRows } from '../lib/grading.mjs';

test('real Excel fixture matches demo, summary statistics and grade counts', async () => {
  const students = validateRows(await readSheet('tests/fixtures/grading-sample.xlsx'));
  assert.deepEqual(students, sampleStudents());
  const math = students.filter(s => s.course === 'Math');
  assert.deepEqual(statistics(math), { min: 0, max: 100, average: 49.5625, median: 49.5 });
  assert.deepEqual(Object.values(gradeCounts(math, freshRanges())), Array(8).fill(2));
  assert.equal(statistics([]), null);
  assert.equal(statistics([students.at(-1)]).median, 100);
});

test('Excel, CSV, TSV and JSON share the same validated record contract', async () => {
  const rows = await readSheet('tests/fixtures/grading-sample.xlsx');
  const objects = rows.slice(1).map(r => Object.fromEntries(HEADERS.map((h, i) => [h, r[i]])));
  assert.deepEqual(parseDelimited(Papa.unparse(rows)), sampleStudents());
  assert.deepEqual(parseDelimited(Papa.unparse(rows, { delimiter: '\t' }), '\t'), sampleStudents());
  assert.deepEqual(parseJSON(JSON.stringify(objects)), sampleStudents());
  assert.deepEqual(parseDelimited('\uFEFFCourse,Total Marks,BITS ID\r\nMath,80,001'), [{ id: '001', course: 'Math', marks: 80 }]);
});

test('CSV supports quoted commas, quotes, multiline fields and trailing blanks', () => {
  const rows = [HEADERS, ['id,"one"\nline', 'Math, advanced', '80'], ['002', 'Math, advanced', 100]];
  assert.deepEqual(parseDelimited(Papa.unparse(rows) + '\r\n\r\n'), validateRows(rows));
  assert.throws(() => parseDelimited('BITS ID,Course,Total Marks\n"unclosed,Math,80'), /CSV row/);
});

test('all formats reject invalid schema and values without partial ingestion', () => {
  for (const marks of ['', null, ' ', true, false, -1, 101, 80.2, '80x', Infinity, NaN]) {
    assert.throws(() => validateRows([HEADERS, ['good', 'Math', 80], ['bad', 'Math', marks]]), /Row 3/);
  }
  for (const rows of [[], [HEADERS], [['ID', 'Course', 'Marks'], ['a', 'Math', 80]], [HEADERS, ['', 'Math', 80]], [HEADERS, ['a', '', 80]], [HEADERS, [true, 'Math', 80]], [HEADERS, ['a', { name: 'Math' }, 80]], [HEADERS, ['a', 'Math', 80, 'extra']]]) assert.throws(() => validateRows(rows));
  for (const text of ['invalid', '{}', '[]', '[null]', '[{"BITS ID":"a","Course":"Math"}]', '[{"BITS ID":"a","Course":"Math","Total Marks":80,"extra":1}]']) assert.throws(() => parseJSON(text));
  assert.throws(() => validateRows([HEADERS, [9007199254740992, 'Math', 80]]), /as text/);
  assert.throws(() => validateRows([HEADERS, ...Array(MAX_ROWS + 1).fill(['a', 'Math', 80])]), /25,000/);
});

test('duplicate identity is per course; import errors include all affected row numbers', () => {
  assert.equal(validateRows([HEADERS, ['a', 'Math', 80], ['a', 'Physics', 70]]).length, 2);
  assert.throws(() => validateRows([HEADERS, [' a ', ' Math ', 80], ['a', 'Math', 70], ['b', 'Math', 'bad']]), error => {
    assert.equal(error.issues.length, 2);
    assert.match(error.issues[0], /Row 3: Duplicate/);
    assert.match(error.issues[1], /Row 4/);
    return true;
  });
});

test('course casing is normalized across imports and exports, preserving first spelling', () => {
  const rows = [HEADERS, ['001', ' Math ', 80], ['002', 'math', 70], ['003', 'MATH', 60], ['001', 'Physics', 90]];
  const expected = [
    { id: '001', course: 'Math', marks: 80 },
    { id: '002', course: 'Math', marks: 70 },
    { id: '003', course: 'Math', marks: 60 },
    { id: '001', course: 'Physics', marks: 90 }
  ];
  const objects = rows.slice(1).map(row => Object.fromEntries(HEADERS.map((h, i) => [h, row[i]])));
  for (const students of [validateRows(rows), parseDelimited(Papa.unparse(rows)), parseDelimited(Papa.unparse(rows, { delimiter: '\t' }), '\t'), parseJSON(JSON.stringify(objects))]) {
    assert.deepEqual(students, expected);
    const csv = Papa.parse(exportCSV(students, freshRanges(), 'Dr Test', 'Math'), { skipEmptyLines: true }).data;
    assert.deepEqual(csv.slice(3).map(row => row[0]), ['001', '002', '003']);
  }
  assert.equal(validateRows([HEADERS, ['a', ' math ', 80], ['b', 'Math', 90]])[1].course, 'math');
  // Display spelling is scoped to each import, not a previous file.
  assert.equal(validateRows([HEADERS, ['a', 'MATH', 80]])[0].course, 'MATH');
});

test('case-varied course duplicates are rejected without changing student ID matching', () => {
  assert.throws(() => validateRows([HEADERS, ['001', 'Math', 80], ['001', ' MATH ', 90]]), /Row 3: Duplicate student 001 in Math/);
  assert.equal(validateRows([HEADERS, ['abc', 'Math', 80], ['ABC', 'math', 90]]).length, 2);
  assert.equal(validateRows([HEADERS, ['a', 'constructor', 80], ['b', 'CONSTRUCTOR', 90]])[1].course, 'constructor');
});

test('default ranges grade every integer 0–100 exactly once', () => {
  const ranges = freshRanges();
  assert.equal(validateRanges(ranges), '');
  for (let mark = 0; mark <= 100; mark++) {
    assert.equal(ranges.filter(r => mark >= r.min && mark <= r.max).length, 1);
    assert.ok(GRADES.includes(gradeFor(mark, ranges)));
  }
  assert.equal(gradeFor(100, ranges), 'A');
  assert.equal(gradeFor(0, ranges), 'E');
});

test('range validation allows singleton bands, rejects gaps, overlaps, empty bounds and uncovered ends', () => {
  const singleton = freshRanges(); singleton[0].min = 100; singleton[1].max = 99;
  assert.equal(validateRanges(singleton), '');
  for (const [i, field, value] of [[0, 'max', 99], [7, 'min', 1], [1, 'max', 78], [1, 'max', 80], [0, 'min', null], [0, 'min', 80.5], [0, 'min', 101]]) {
    const ranges = freshRanges(); ranges[i][field] = value;
    assert.notEqual(validateRanges(ranges), '');
    assert.throws(() => exportCSV(sampleStudents(), ranges, 'Dr Test', 'Math'));
  }
});

test('export reconciles the selected course and preserves escaped fields', () => {
  const students = [...sampleStudents(), { id: '=SUM(1,2)', marks: 80, course: 'Math' }, { id: 'ID,"x"\nline', course: 'Math', marks: 99 }];
  const csv = exportCSV(students, freshRanges(), 'Dr "Test", Jos\u00e9', 'Math');
  const rows = Papa.parse(csv, { skipEmptyLines: true }).data;
  assert.equal(rows[0][1], 'Dr "Test", Jos\u00e9');
  assert.equal(rows.length, 3 + 18);
  assert.equal(rows.at(-2)[0], "'=SUM(1,2)");
  assert.equal(rows.at(-1)[0], 'ID,"x"\nline');
  assert.ok(rows.slice(3).every(r => GRADES.includes(r[2])));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.throws(() => exportCSV(students, freshRanges(), ' ', 'Math'));
  assert.throws(() => exportCSV(students, freshRanges(), 'Dr Test', 'Missing'));
  assert.equal(exportFilename('../../Math: advanced'), 'Math-advanced-grades.csv');
});

test('raw imports accept scores over 100 only before explicit course normalization', () => {
  const rows = [HEADERS, ['a', 'Math', 479], ['b', 'math', 480], ['c', 'Physics', 150]];
  const records = rows.slice(1).map(r => Object.fromEntries(HEADERS.map((h, i) => [h, r[i]])));
  for (const raw of [validateRows(rows, { rawMarks: true }), parseDelimited(Papa.unparse(rows), ',', { rawMarks: true }), parseDelimited(Papa.unparse(rows, { delimiter: '\t' }), '\t', { rawMarks: true }), parseJSON(JSON.stringify(records), { rawMarks: true })]) {
    const students = normalizeStudents(raw, { Math: 600, Physics: 200 });
    assert.equal(students[0].rawMarks, 479);
    assert.equal(students[0].maximumMarks, 600);
    assert.equal(students[0].marks, 47900 / 600);
    assert.deepEqual(students.map(s => gradeFor(s.marks, freshRanges())), ['A-', 'A', 'A-']);
    const csv = Papa.parse(exportCSV(students, freshRanges(), 'Dr Test', 'Math'), { skipEmptyLines: true }).data;
    assert.deepEqual(csv[2], ['BITS ID', 'Total Marks', 'Grade', 'Maximum Marks', 'Percentage']);
    assert.deepEqual(csv[3], ['a', '479', 'A-', '600', String(47900 / 600)]);
    assert.deepEqual(csv[4], ['b', '480', 'A', '600', '80']);
  }
});

test('normalization rejects missing, zero, negative, fractional or unsafe maxima and excessive scores', () => {
  const raw = [{ id: 'a', course: 'Math', marks: 480 }];
  for (const maximum of [undefined, null, '', '600', 0, -1, 600.5, Infinity, MAX_SCORE + 1, 479]) {
    assert.throws(() => normalizeStudents(raw, { Math: maximum }));
  }
  assert.throws(() => normalizeStudents(raw, {}));
  assert.throws(() => normalizeStudents([{ id: 'a', course: 'constructor', marks: 10 }], {}));
  for (const mark of [-1, 0.5, MAX_SCORE + 1]) assert.throws(() => validateRows([HEADERS, ['a', 'Math', mark]], { rawMarks: true }));
  const students = normalizeStudents(raw, { Math: 600 });
  assert.deepEqual(normalizeStudents(students, { Math: 600 }), students);
  assert.throws(() => exportCSV([{ ...students[0], marks: 81 }], freshRanges(), 'Dr Test', 'Math'));
});

test('continuous percentage bands cover fractional scores without rounding up', () => {
  const ranges = freshRanges();
  for (let mark = 0; mark <= 10000; mark++) assert.ok(gradeFor(mark / 100, ranges));
  for (let i = 0; i < 7; i++) {
    const boundary = ranges[i].min;
    assert.equal(gradeFor(boundary, ranges), GRADES[i]);
    assert.equal(gradeFor(boundary - 0.000001, ranges), GRADES[i + 1]);
  }
  for (const mark of [NaN, Infinity, -0.1, 100.1]) assert.equal(gradeFor(mark, ranges), null);
  assert.equal(gradeFor(normalizeStudents([{ id: 'a', course: 'Math', marks: 58 }], { Math: 100 })[0].marks, [{ min: 58, max: 100 }]), 'A');
});
