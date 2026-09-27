'use client';
import { useEffect, useState } from 'react';
import Modal from './modal';
import { HEADERS } from '../lib/grading.mjs';
import { DRAFT_KEY, deleteDraft, readDraftList, restoreWorkspace, saveDraft, suggestMapping, mappedStudents } from '../lib/workflows.mjs';

export function ImportMapping({ source, onReady, onCancel }) {
  const [sheet, setSheet] = useState(0);
  const [mapping, setMapping] = useState(() => suggestMapping(source.sheets[0].rows));
  const [issues, setIssues] = useState([]);
  const rows = source.sheets[sheet].rows;
  const headers = rows[0] || [];
  function proceed() {
    try {
      const students = mappedStudents(rows, mapping);
      onReady({ students, filename: source.filename, note: `Imported ${students.length} records from ${source.sheets[sheet].name}. ${headers.length - 3} unmapped column(s) excluded.` });
    } catch (error) { setIssues(error.issues || [error.message]); }
  }
  return <Modal title="Choose your data" onClose={onCancel} wide>
    <p className="modal-intro">Select a worksheet and connect its columns to the three fields used for grading. Only the selected worksheet and mapped columns will be imported.</p>
    <label className="workflow-field">Worksheet<select aria-label="Worksheet" value={sheet} onChange={e => { const index = Number(e.target.value); setSheet(index); setMapping(suggestMapping(source.sheets[index].rows)); setIssues([]); }}>{source.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({Math.max(0, s.rows.length - 1)} rows)</option>)}</select></label>
    <div className="mapping-fields">{HEADERS.map((field, index) => <label key={field} className="workflow-field">{field}<select aria-label={`Source column for ${field}`} value={mapping[index]} onChange={e => { setMapping(m => m.map((v, i) => i === index ? Number(e.target.value) : v)); setIssues([]); }}><option value={-1}>Choose a column</option>{headers.map((header, i) => <option key={i} value={i}>{String(header ?? '').trim() || 'Unnamed column'} · column {i + 1}</option>)}</select></label>)}</div>
    <p className="percentage-note">Matching headers are suggested, not assumed. Unmapped columns are excluded. The first row must contain headers.</p>
    <div className="guide-example"><table><caption>Source preview · first 3 records</caption><thead><tr>{headers.map((h, i) => <th key={i}>{String(h ?? '') || `Column ${i + 1}`}</th>)}</tr></thead><tbody>{rows.slice(1, 4).map((row, i) => <tr key={i}>{headers.map((_, j) => <td key={j}>{String(row[j] ?? '')}</td>)}</tr>)}</tbody></table></div>
    {issues.length > 0 && <div className="error-box" role="alert"><ul>{issues.slice(0, 8).map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
    <div className="modal-actions"><button className="button secondary" onClick={onCancel}>Cancel import</button><button className="button primary" onClick={proceed}>Continue to course totals</button></div>
  </Modal>;
}

export function ImpactDialog({ impact, onApply, onClose }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(impact.changes.length / 10));
  const gradeChanges = impact.changes.filter(s => s.previousGrade !== s.nextGrade).length;
  return <Modal title={impact.kind === 'ranges' ? 'Review grade changes' : 'Review course total changes'} onClose={onClose} wide>
    <p className="modal-intro">{impact.course} · {gradeChanges} student{gradeChanges === 1 ? '' : 's'} {gradeChanges === 1 ? 'changes' : 'change'} grade. {impact.changes.length} record{impact.changes.length === 1 ? '' : 's'} affected. Changes are not applied yet.</p>
    {impact.kind === 'maximum' && <p className="percentage-note">Maximum marks: {impact.beforeMaximum} → {impact.maximum}. Original scores stay unchanged; percentages and grades are recalculated.</p>}
    {impact.kind === 'ranges' && <div className="guide-example"><table><caption>Proposed boundaries (upper bounds excluded except A)</caption><thead><tr><th>Grade</th><th>Before %</th><th>After %</th></tr></thead><tbody>{impact.nextRanges.map((r, i) => <tr key={i}><td>{['A','A-','B','B-','C','C-','D','E'][i]}</td><td>{impact.previousRanges[i].min}–{i ? '<' : ''}{impact.previousRanges[i].max + (i ? 1 : 0)}</td><td>{r.min}–{i ? '<' : ''}{r.max + (i ? 1 : 0)}</td></tr>)}</tbody></table></div>}
    {impact.changes.length ? <div className="guide-example impact-table"><table><caption>Affected students · all records considered, regardless of table filters</caption><thead><tr><th>Student ID</th><th>Before %</th><th>After %</th><th>Before grade</th><th>After grade</th></tr></thead><tbody>{impact.changes.slice((page - 1) * 10, page * 10).map(s => <tr key={s.id}><td>{s.id}</td><td title={String(s.before)}>{s.before.toFixed(2)}</td><td title={String(s.after)}>{s.after.toFixed(2)}</td><td>{s.previousGrade}</td><td>{s.nextGrade}</td></tr>)}</tbody></table></div> : <p className="notice">No student outcomes change with these settings.</p>}
    {pages > 1 && <div className="impact-pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous changes</button><span>Page {page} of {pages}</span><button className="button secondary" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next changes</button></div>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Back to editing</button><button className="button primary" onClick={onApply}>Apply reviewed changes</button></div>
  </Modal>;
}

export function DraftDialog({ workspace, canSave, currentId, onSaved, onResume, onDelete, onClose }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState(workspace.filename || 'Grading session');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [removeId, setRemoveId] = useState(null);
  useEffect(() => {
    try { const stored = readDraftList(window.localStorage); setList(stored); const current = stored.find(d => d.id === currentId); if (current) setName(current.name); setReady(true); }
    catch { setError('Saved drafts could not be read. Storage may be blocked or damaged. You can still use the workspace without saving.'); }
  }, []);
  function save(replace) {
    try {
      if (!name.trim()) throw new Error('Enter a draft name.');
      const id = replace ? currentId : crypto.randomUUID();
      setList(saveDraft(window.localStorage, { id, name: name.trim(), savedAt: new Date().toISOString(), workspace }));
      onSaved(id); setError(''); setMessage('Draft saved on this browser. Later edits are not saved automatically.');
    } catch (e) { setError(e.name === 'QuotaExceededError' ? 'This browser has no space for the draft. Delete an old draft or keep working without saving.' : e.message || 'Could not save the draft.'); }
  }
  function resume(draft) {
    try { onResume(restoreWorkspace(draft.workspace), draft.id); }
    catch { setError('This draft failed validation and was not loaded. Its marks, course totals or grading ranges may be damaged.'); }
  }
  function remove(id) {
    try { setList(deleteDraft(window.localStorage, id)); onDelete(id); setRemoveId(null); setMessage('Saved draft deleted. The open workspace was not cleared.'); setError(''); }
    catch { setError('The draft could not be deleted. Browser storage may be blocked.'); }
  }
  return <Modal title="Saved drafts on this device" onClose={onClose} wide>
    <p className="modal-intro">Saving stores student records, instructor name, course totals and applied grade settings in this browser. Anyone using this browser profile can access them. Nothing is sent to a server. Save only on a device you trust.</p>
    <label className="workflow-field">Draft name<input aria-label="Draft name" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
    <div className="draft-save-actions"><button className="button primary" disabled={!canSave || !ready} onClick={() => save(false)}>Save a new draft</button>{currentId && list.some(d => d.id === currentId) && <button className="button secondary" disabled={!canSave || !ready} onClick={() => save(true)}>Update resumed draft</button>}</div>
    {!canSave && <p className="percentage-note">Import records and apply or discard pending range edits before saving.</p>}
    <p className="percentage-note">Up to five drafts. Browser cleanup can remove saved drafts. Resume replaces the open workspace with the saved version; save current changes first.</p>
    {error && <div role="alert" className="error-box">{error}</div>}
    {message && <p role="status" className="notice">{message}</p>}
    <div className="draft-list">{list.map(d => <article key={d.id}><div><strong>{d.name}</strong><small>{Number.isNaN(Date.parse(d.savedAt)) ? 'Unknown save date' : new Date(d.savedAt).toLocaleString()}</small></div><div><button className="button secondary" onClick={() => resume(d)}>Resume {d.name}</button><button className="text-link" onClick={() => setRemoveId(d.id)}>Delete {d.name}</button></div>{removeId === d.id && <p className="delete-confirm">Delete this saved copy? <button className="button secondary" onClick={() => remove(d.id)}>Confirm delete</button><button className="text-link" onClick={() => setRemoveId(null)}>Keep draft</button></p>}</article>)}</div>
    {ready && !list.length && <p className="notice">No drafts saved in this browser yet.</p>}
    {!ready && <button className="button secondary" onClick={() => { if (window.confirm('Delete all Gradecraft drafts from this browser?')) { try { window.localStorage.removeItem(DRAFT_KEY); setList([]); setReady(true); setError(''); onDelete(null); } catch { setError('Browser storage is blocked.'); } } }}>Clear unreadable draft storage</button>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Back to workspace</button></div>
  </Modal>;
}
