import Papa from 'papaparse';
import { MAX_BYTES, MAX_ROWS, ImportError } from './grading.mjs';

export async function importFile(file) {
  if (file.size > MAX_BYTES) throw new ImportError(['This file is larger than 10 MB. Split it into smaller files and try again.']);
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    try {
      const sheets = await readXlsxFile(file);
      if (!sheets.length) throw new ImportError(['The workbook has no worksheets.']);
      return { sheets: sheets.map(s => ({ name: s.sheet, rows: s.data })) };
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError(['Could not read this workbook. Open it in Excel and save a valid .xlsx copy.']);
    }
  }
  if (!['csv', 'tsv', 'json'].includes(extension)) throw new ImportError(['Choose an .xlsx, .csv, .tsv or .json file.']);
  const text = (await file.text()).replace(/^\uFEFF/, '');
  let rows;
  if (extension === 'json') {
    let records;
    try { records = JSON.parse(text); }
    catch { throw new ImportError(['This is not valid JSON. Use an array of student objects.']); }
    if (!Array.isArray(records) || !records.length || records.length > MAX_ROWS || records.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new ImportError(['JSON must contain 1 to 25,000 student objects.']);
    const headers = [...new Set(records.flatMap(r => Object.keys(r)))];
    rows = [headers, ...records.map(r => headers.map(h => r[h]))];
  } else {
    const parsed = Papa.parse(text, { delimiter: extension === 'tsv' ? '\t' : ',', skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new ImportError(parsed.errors.map(e => `CSV row ${(e.row ?? 0) + 1}: ${e.message}`));
    rows = parsed.data;
  }
  return { sheets: [{ name: file.name, rows }] };
}
