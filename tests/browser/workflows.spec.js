import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DRAFT_KEY } from '../../lib/workflows.mjs';

async function sample(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data' }).click();
  await page.getByLabel('Instructor name').fill('Dr Workflow');
}
async function applyRanges(page) {
  await page.getByRole('button', { name: 'Review range changes' }).click();
  await page.getByRole('button', { name: 'Apply reviewed changes' }).click();
}
async function checkAccessibility(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}

test('range previews show changed students before applying and exports cannot use unapplied edits', async ({ page }) => {
  await sample(page);
  await page.getByLabel('Search student IDs').fill('015');
  const badge = page.locator('.student-card tbody tr .grade-badge');
  await expect(badge).toHaveText('A');
  await page.getByLabel('A minimum mark', { exact: true }).fill('85');
  await expect(badge).toHaveText('A');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Review range changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('1 student changes grade');
  await expect(page.getByRole('dialog')).toContainText('DEMO-MATH-015');
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'Back to editing' }).click();
  await expect(badge).toHaveText('A');
  await applyRanges(page);
  await expect(badge).toHaveText('A-');
  await expect(page.getByRole('button', { name: 'Review & export' }).first()).toBeEnabled();
  await page.getByRole('button', { name: 'Undo change' }).click();
  await expect(badge).toHaveText('A-');
  await applyRanges(page);
  await expect(badge).toHaveText('A');
  await expect(page.getByRole('button', { name: 'Undo change' })).toBeDisabled();
});

test('correcting a course total requires validation and an impact review', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Edit course total (100)' }).click();
  await page.getByLabel('Maximum marks for Math', { exact: true }).fill('99');
  await page.getByRole('button', { name: 'Preview total changes' }).click();
  await expect(page.locator('.error-box')).toContainText('exceeds the maximum 99');
  await page.getByLabel('Maximum marks for Math', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Preview total changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('Maximum marks: 100 → 200');
  await expect(page.getByTestId('stat-1')).toHaveText('49.56');
  await expect(page.getByRole('dialog')).toContainText('15 records affected');
  await page.getByRole('button', { name: 'Next changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('Page 2 of 2');
  await page.getByRole('button', { name: 'Apply reviewed changes' }).click();
  await expect(page.getByTestId('stat-1')).toHaveText('24.78');
  await page.getByLabel('Active course').selectOption('Physics');
  await expect(page.getByRole('button', { name: 'Edit course total (100)' })).toBeVisible();
  await expect(page.getByTestId('stat-1')).toHaveText('100.00');
  await page.getByLabel('Active course').selectOption('Math');
  await page.getByRole('button', { name: 'Edit course total (200)' }).click();
  await page.getByLabel('Maximum marks for Math', { exact: true }).fill('300');
  await page.getByRole('button', { name: 'Cancel total changes' }).click();
  await expect(page.getByTestId('stat-1')).toHaveText('24.78');
});

test('Excel sheet selection and source-column mapping import only chosen data', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Upload marks file', { exact: true }).setInputFiles('tests/fixtures/multiple-worksheets.xlsx');
  await expect(page.getByRole('dialog')).toContainText('Choose your data');
  await page.getByLabel('Worksheet', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Source column for BITS ID')).toHaveValue('0');
  await expect(page.getByLabel('Source column for Course')).toHaveValue('1');
  await expect(page.getByLabel('Source column for Total Marks')).toHaveValue('2');
  await page.getByLabel('Source column for Total Marks').selectOption('0');
  await page.getByRole('button', { name: 'Continue to course totals' }).click();
  await expect(page.locator('.error-box')).toContainText('different source column');
  await page.getByLabel('Source column for Total Marks').selectOption('2');
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'Continue to course totals' }).click();
  await page.getByLabel('Maximum marks for Algebra').fill('600');
  await page.getByRole('button', { name: 'Confirm & import' }).click();
  await expect(page.getByLabel('Active course')).toHaveValue('Algebra');
  await expect(page.getByTestId('stat-0')).toHaveText('2');
  await expect(page.getByText('Imported 2 records from Actual scores. 1 unmapped column(s) excluded.')).toBeVisible();
});

test('CSV and JSON custom columns can be mapped and cancelled without importing', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Upload marks file', { exact: true });
  for (const [name, text] of [
    ['custom.csv', 'Identifier,Class,Result,Notes\n001,Math,75,Keep private'],
    ['custom.json', '[{"Identifier":"001","Class":"Math","Result":75,"Notes":"Keep private"}]']
  ]) {
    await input.setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
    await page.getByLabel('Source column for BITS ID').selectOption('0');
    await page.getByLabel('Source column for Course').selectOption('1');
    await page.getByLabel('Source column for Total Marks').selectOption('2');
    await page.getByRole('button', { name: 'Continue to course totals' }).click();
    await page.getByRole('button', { name: 'Confirm & import' }).click();
    await expect(page.getByTestId('stat-1')).toHaveText('75.00');
  }
  await input.setInputFiles({ name: 'cancel.csv', mimeType: 'text/plain', buffer: Buffer.from('ID,Subject,Score\n002,Other,70') });
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByLabel('Active course')).toBeDisabled();
});

test('save, reload, resume, update and delete drafts are explicit and preserve applied grades', async ({ page }) => {
  await sample(page);
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await page.getByLabel('A minimum mark', { exact: true }).fill('85');
  await applyRanges(page);
  await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await checkAccessibility(page);
  await page.getByLabel('Draft name').fill('Term 1');
  await page.getByRole('button', { name: 'Save a new draft' }).click();
  await expect(page.getByText('Draft saved on this browser.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('stat-0')).toHaveText('—');
  await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await page.getByRole('button', { name: 'Resume Term 1', exact: true }).click();
  await expect(page.getByLabel('Instructor name')).toHaveValue('Dr Workflow');
  await expect(page.getByLabel('A minimum mark', { exact: true })).toHaveValue('85');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.getByLabel('Instructor name').fill('Updated instructor');
  await expect(page.getByText('Unsaved changes on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await page.getByLabel('Draft name').fill('Term 1');
  await page.getByRole('button', { name: 'Update resumed draft' }).click();
  await page.getByRole('button', { name: 'Delete Term 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page.getByText('No drafts saved in this browser yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace' }).click();
  await expect(page.getByTestId('stat-0')).toHaveText('16');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(saved.drafts).toEqual([]);
});

test('damaged drafts and blocked storage are reported without loading or claiming to save', async ({ page }) => {
  await sample(page);
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, drafts: [{ id: 'bad', name: 'Broken', savedAt: new Date().toISOString(), workspace: {} }] })), DRAFT_KEY);
  await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await page.getByRole('button', { name: 'Resume Broken' }).click();
  await expect(page.locator('.error-box')).toContainText('failed validation');
  await expect(page.getByTestId('stat-0')).toHaveText('16');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save a new draft' }).click();
  await expect(page.locator('.error-box')).toContainText('no space');
  await expect(page.getByText('Draft saved on this browser.', { exact: false })).toHaveCount(0);
});

test('cutoff review reports distance to next grade and composes with other filters', async ({ page }) => {
  await sample(page);
  await page.getByRole('checkbox', { name: 'Near cutoff' }).check();
  await expect(page.locator('.table-footer')).toContainText('14 students matching filters');
  await page.getByLabel('Search student IDs').fill('014');
  await expect(page.locator('.student-card tbody tr')).toHaveCount(1);
  await expect(page.locator('.student-card tbody tr')).toContainText('1 pp to A · 1 raw marks');
  await page.getByLabel('Filter by grade').selectOption('A');
  await expect(page.getByText('No matching students')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
