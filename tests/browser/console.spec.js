import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import Papa from 'papaparse';
import AxeBuilder from '@axe-core/playwright';

const sample = 'tests/fixtures/grading-sample.xlsx';
const uploader = page => page.getByLabel('Upload marks file', { exact: true });
async function startSample(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data' }).click();
}

test('real Excel import, grade boundaries, name guard, reset, undo and course drafts', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeDisabled();
  await uploader(page).setInputFiles(sample);
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.getByLabel('Active course')).toHaveValue('Math');
  await expect(page.getByTestId('stat-0')).toHaveText('16');
  await expect(page.getByTestId('stat-1')).toHaveText('49.56');
  await expect(page.getByTestId('stat-2')).toHaveText('49.50');
  await expect(page.getByTestId('stat-3')).toHaveText('100');
  await expect(page.getByTestId('stat-4')).toHaveText('0');
  await page.getByLabel('Instructor name').fill('Dr Test');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeEnabled();
  await page.getByLabel('A maximum mark', { exact: true }).fill('99');
  await expect(page.getByText('Cover the full scale:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Undo change' }).click();
  await page.getByLabel('A minimum mark', { exact: true }).fill('100');
  await expect(page.getByLabel('A- maximum mark', { exact: true })).toHaveValue('100');
  await page.getByLabel('Active course').selectOption('Physics');
  await expect(page.getByTestId('stat-0')).toHaveText('1');
  await page.getByLabel('Active course').selectOption('Math');
  await expect(page.getByLabel('A minimum mark', { exact: true })).toHaveValue('100');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset defaults' }).click();
  await expect(page.getByLabel('A minimum mark', { exact: true })).toHaveValue('80');
  await page.getByLabel('Instructor name').fill('');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeDisabled();
  expect(errors).toEqual([]);
});

test('export includes all course students even when the table is filtered', async ({ page }) => {
  await startSample(page);
  await page.getByLabel('Instructor name').fill('Dr "Test", Jos\u00e9');
  await page.getByLabel('Search student IDs').fill('001');
  await expect(page.locator('.student-card tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Review & export' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('16 / 16', { exact: true })).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download final grades' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('Math-grades.csv');
  const csv = await fs.readFile(await download.path(), 'utf8');
  const rows = Papa.parse(csv, { skipEmptyLines: true }).data;
  expect(rows).toHaveLength(19);
  expect(rows[0][1]).toBe('Dr "Test", Jos\u00e9');
  expect(rows.slice(3).filter(row => row[2] === 'A')).toHaveLength(2);
  await expect(page.getByText('Export 1 downloaded:', { exact: false })).toBeVisible();
});

test('CSV, JSON and TSV imports replace data and invalid rows block the entire upload', async ({ page }) => {
  await startSample(page);
  for (const [name, content] of [
    ['biology.csv', 'BITS ID,Course,Total Marks\r\n001,Biology,90'],
    ['biology.json', '[{"BITS ID":"001","Course":"Biology","Total Marks":90}]'],
    ['biology.tsv', 'BITS ID\tCourse\tTotal Marks\n001\tBiology\t90']
  ]) {
    await uploader(page).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await page.getByRole('button', { name: 'Confirm & import' }).click();
    await expect(page.getByLabel('Active course')).toHaveValue('Biology');
    await expect(page.getByLabel('Active course').locator('option')).toHaveCount(2);
    await expect(page.getByTestId('stat-1')).toHaveText('90.00');
    await expect(page.getByText('001', { exact: true })).toBeVisible();
  }
  for (const mark of ['80.2', '-1', 'bad', '']) {
    await uploader(page).setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(`BITS ID,Course,Total Marks\n001,Biology,${mark}`) });
    await expect(page.locator('.error-box')).toContainText('Row 2');
    await expect(page.getByLabel('Active course')).toBeDisabled();
    await expect(page.getByTestId('stat-0')).toHaveText('—');
  }
  await uploader(page).setInputFiles({ name: 'corrupt.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not an excel file') });
  await expect(page.locator('.error-box')).toContainText('Could not read this workbook');
});

test('student search, filters, sorting and pagination work together', async ({ page }) => {
  await startSample(page);
  await expect(page.locator('.student-card tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.student-card tbody tr')).toHaveCount(6);
  await page.getByLabel('Filter by grade').selectOption('A');
  await expect(page.locator('.student-card tbody tr')).toHaveCount(2);
  await page.getByLabel('Sort students').selectOption('high');
  await expect(page.locator('.student-card tbody tr').first()).toContainText('100');
  await page.getByLabel('Search student IDs').fill('no-such-id');
  await expect(page.getByText('No matching students')).toBeVisible();
});

test('course names matching object properties remain valid editable courses', async ({ page }) => {
  await page.goto('/');
  await uploader(page).setInputFiles({ name: 'courses.csv', mimeType: 'text/csv', buffer: Buffer.from('BITS ID,Course,Total Marks\na,constructor,80\nb,__proto__,90') });
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  for (const course of ['constructor', '__proto__']) {
    await page.getByLabel('Active course').selectOption(course);
    await page.getByLabel('A minimum mark', { exact: true }).fill('85');
    await page.getByRole('button', { name: 'Undo change' }).click();
    await expect(page.getByLabel('A minimum mark', { exact: true })).toHaveValue('80');
  }
});

test('a slower earlier import cannot replace the latest file', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      if (this.name === 'slow.csv') return new Promise(resolve => { window.finishSlowImport = async () => resolve(await original.call(this)); });
      return original.call(this);
    };
  });
  await page.goto('/');
  await uploader(page).setInputFiles({ name: 'slow.csv', mimeType: 'text/csv', buffer: Buffer.from('BITS ID,Course,Total Marks\na,Old,40') });
  await uploader(page).setInputFiles({ name: 'fast.csv', mimeType: 'text/csv', buffer: Buffer.from('BITS ID,Course,Total Marks\nb,Latest,90') });
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.getByLabel('Active course')).toHaveValue('Latest');
  await page.evaluate(() => window.finishSlowImport());
  await expect(page.getByLabel('Active course')).toHaveValue('Latest');
  await expect(page.getByTestId('stat-1')).toHaveText('90.00');
});

test('mobile layout fits, navigation works, dialog supports Escape, and sample works offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startSample(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Student records/ }).click();
  await expect(page.getByRole('heading', { name: /Every student, accounted for/ })).toBeVisible();
  await page.getByRole('button', { name: /Import guide/, exact: false }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await context.setOffline(true);
  await page.getByLabel('Instructor name').fill('Offline instructor');
  await page.getByRole('button', { name: 'Review & export' }).first().click();
  await expect(page.getByRole('button', { name: 'Download final grades' })).toBeEnabled();
  await context.setOffline(false);
});

test('desktop and mobile visual evidence', async ({ page }) => {
  await startSample(page);
  await page.getByLabel('Instructor name').fill('Dr. A. Sharma');
  await page.getByRole('heading', { name: 'Your grading workspace.' }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
});

test('per-course maxima normalize raw scores, block invalid totals and preserve export evidence', async ({ page }) => {
  await page.goto('/');
  await uploader(page).setInputFiles({ name: 'raw.csv', mimeType: 'text/csv', buffer: Buffer.from('BITS ID,Course,Total Marks\na,Math,479\nb,math,480\nc,Physics,150') });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Maximum marks for Math', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Active course')).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.locator('.error-box')).toContainText('score 479 exceeds the maximum 100');
  await page.getByLabel('Maximum for all courses', { exact: true }).fill('600');
  await page.getByRole('button', { name: 'Apply to all' }).click();
  await expect(page.getByLabel('Maximum marks for Physics', { exact: true })).toHaveValue('600');
  await page.getByLabel('Maximum marks for Physics', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.locator('.error-box')).toContainText('positive whole number');
  await page.getByLabel('Maximum marks for Physics', { exact: true }).fill('200');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.getByTestId('stat-0')).toHaveText('2');
  await expect(page.locator('.student-card tbody tr').first()).toContainText('79.83%');
  await expect(page.locator('.student-card tbody tr').first().locator('.grade-badge')).toHaveText('A-');
  await expect(page.locator('.student-card tbody tr').nth(1).locator('.grade-badge')).toHaveText('A');
  await page.getByLabel('Instructor name').fill('Dr Test');
  await page.getByRole('button', { name: 'Review & export' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('479 / 600');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download final grades' }).click();
  const download = await event;
  const rows = Papa.parse(await fs.readFile(await download.path(), 'utf8'), { skipEmptyLines: true }).data;
  expect(rows[3]).toEqual(['a', '479', 'A-', '600', String(47900 / 600)]);
  await page.getByLabel('Active course').selectOption('Physics');
  await expect(page.getByTestId('stat-1')).toHaveText('75.00');
  await expect(page.locator('.student-card tbody tr').first()).toContainText('150 / 200');
});

test('cancelling course totals never commits the pending dataset', async ({ page }) => {
  await startSample(page);
  await uploader(page).setInputFiles(sample);
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByLabel('Active course')).toBeDisabled();
  await expect(page.getByTestId('stat-0')).toHaveText('—');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeDisabled();
  await uploader(page).setInputFiles(sample);
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.getByTestId('stat-0')).toHaveText('16');
});

test('workspace and dialogs have no automatically detectable WCAG AA violations', async ({ page }) => {
  await startSample(page);
  await page.getByLabel('Instructor name').fill('Dr Test');
  for (const surface of ['workspace', 'export', 'guide']) {
    if (surface === 'export') await page.getByRole('button', { name: 'Review & export' }).first().click();
    if (surface === 'guide') await page.getByRole('button', { name: 'Help and import guide' }).click();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
    if (surface !== 'workspace') await page.getByRole('button', { name: 'Close dialog' }).click();
  }
});
