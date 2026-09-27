'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileCheck2, FileSpreadsheet, FolderOpen, GraduationCap, LayoutDashboard, Leaf, ListFilter, LockKeyhole, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Upload, Users, X } from 'lucide-react';
import { DEFAULTS, GRADES, HEADERS, MAX_SCORE, normalizeStudents, exportCSV, exportFilename, freshRanges, gradeCounts, gradeFor, sampleStudents, statistics, validateRanges } from '../lib/grading.mjs';
import { importFile } from '../lib/import-file.mjs';
import { cutoffInfo, exactHeaders, gradeImpact, mappedStudents, suggestMapping } from '../lib/workflows.mjs';
import Modal from './modal';
import { DraftDialog, ImportMapping, ImpactDialog } from './workflow-dialogs';

const COLORS = ['#245d4b', '#408268', '#6b9e77', '#93b286', '#babd87', '#d5b87b', '#d89e73', '#cc8475'];

function downloadText(text, name, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GradeBadge({ grade }) {
  const i = GRADES.indexOf(grade);
  return <span className="grade-badge" style={{ '--grade-color': COLORS[i] || '#757b73' }}>{grade || '—'}</span>;
}

export default function GradingConsole() {
  const [importSource, setImportSource] = useState(null);
  const [rangeEdits, setRangeEdits] = useState({});
  const [impact, setImpact] = useState(null);
  const [scaleMode, setScaleMode] = useState('import');
  const [cutoffOnly, setCutoffOnly] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [pending, setPending] = useState(null);
  const [maxima, setMaxima] = useState({});
  const [allMaximum, setAllMaximum] = useState(100);
  const [scaleIssues, setScaleIssues] = useState([]);
  const [students, setStudents] = useState([]);
  const [course, setCourse] = useState('');
  const [instructor, setInstructor] = useState('');
  const [filename, setFilename] = useState('');
  const [drafts, setDrafts] = useState({});
  const [history, setHistory] = useState({});
  const [issues, setIssues] = useState([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState('overview');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('id');
  const [page, setPage] = useState(1);
  const [start, setStart] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [exportCount, setExportCount] = useState(0);
  const input = useRef(null);
  const version = useRef(0);

  useEffect(() => {
    if (start === null) return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [start]);

  const courses = useMemo(() => [...new Set(students.map(s => s.course))], [students]);
  const selected = useMemo(() => students.filter(s => s.course === course), [students, course]);
  const appliedRanges = useMemo(() => Object.hasOwn(drafts, course) ? drafts[course] : freshRanges(), [drafts, course]);
  const proposal = Object.hasOwn(rangeEdits, course) ? rangeEdits[course] : null;
  const ranges = proposal?.ranges || appliedRanges;
  const workspace = useMemo(() => ({ version: 1, students, instructor, filename, course, ranges: drafts }), [students, instructor, filename, course, drafts]);
  const fingerprint = useMemo(() => JSON.stringify(workspace), [workspace]);
  const unsaved = students.length > 0 && (fingerprint !== savedFingerprint || Object.keys(rangeEdits).length > 0);
  const undoStack = Object.hasOwn(history, course) ? history[course] : [];
  const rangeError = validateRanges(ranges);
  const counts = useMemo(() => gradeCounts(selected, ranges), [selected, ranges]);
  const stats = useMemo(() => statistics(selected), [selected]);
  const canExport = selected.length > 0 && !rangeError && !!instructor.trim() && !loading && !proposal;
  const customized = ranges.some((r, i) => r.min !== DEFAULTS[i][0] || r.max !== DEFAULTS[i][1]);
  const bins = useMemo(() => {
    const result = Array(10).fill(0);
    selected.forEach(s => result[Math.min(9, Math.floor(s.marks / 10))]++);
    return result;
  }, [selected]);
  const filtered = useMemo(() => {
    return selected.filter(s => (!cutoffOnly || cutoffInfo(s, appliedRanges)?.near) && s.id.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || gradeFor(s.marks, appliedRanges) === filter))
      .sort((a, b) => sort === 'high' ? b.marks - a.marks || a.id.localeCompare(b.id) : sort === 'low' ? a.marks - b.marks || a.id.localeCompare(b.id) : a.id.localeCompare(b.id));
  }, [selected, query, filter, sort, appliedRanges, rangeError, cutoffOnly]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  function changeCourse(value) {
    setCourse(value); setCutoffOnly(false); setQuery(''); setFilter('all'); setPage(1); setSeconds(0); setStart(value ? Date.now() : null); setExportCount(0); setNotice('');
  }

  function clearWorkspace() {
    setImportSource(null); setRangeEdits({}); setImpact(null); setScaleMode('import'); setCutoffOnly(false); setSavedId(null); setSavedFingerprint('');
    setPending(null); setScaleIssues([]); setMaxima({}); setAllMaximum(100);
    setStudents([]); setCourse(''); setDrafts({}); setHistory({}); setFilename('');
    setIssues([]); setNotice(''); setStart(null); setSeconds(0); setExportCount(0); setQuery(''); setFilter('all'); setPage(1);
  }

  async function handleFile(file) {
    if (!file) return;
    const current = ++version.current;
    clearWorkspace(); setLoading(true); setModal(null);
    try {
      const result = await importFile(file);
      if (current !== version.current) return;
      const source = { ...result, filename: file.name };
      if (source.sheets.length === 1 && exactHeaders(source.sheets[0].rows)) {
        prepareScales({ students: mappedStudents(source.sheets[0].rows, suggestMapping(source.sheets[0].rows)), filename: file.name, note: `Imported worksheet/data source: ${source.sheets[0].name}.` });
      } else { setImportSource(source); setModal('mapping'); }
    } catch (error) {
      if (current === version.current) setIssues(error.issues || ['The file could not be read. Check its format and try again.']);
    } finally {
      if (current === version.current) setLoading(false);
      if (input.current) input.current.value = '';
    }
  }

  function prepareScales(result) {
    setPending(result); setScaleMode('import'); setScaleIssues([]);
    setMaxima(Object.fromEntries(result.students.map(s => [s.course, 100])));
    setModal('scales');
  }

  function cancelImport() {
    setImportSource(null); setPending(null); setScaleIssues([]); setModal(null);
    setNotice(scaleMode === 'edit' ? 'Course total changes discarded.' : 'Import cancelled. No records were imported.');
  }

  function confirmImport() {
    try {
      const normalized = normalizeStudents(pending.students, maxima);
      if (scaleMode === 'edit') {
        setImpact({ kind: 'maximum', course, maximum: maxima[course], beforeMaximum: selected[0].maximumMarks, afterStudents: normalized, changes: gradeImpact(selected, normalized, appliedRanges, appliedRanges) });
        setModal('impact'); return;
      }
      setStudents(normalized); setFilename(pending.filename);
      changeCourse(normalized[0].course); setNotice(pending.note);
      setImportSource(null); setPending(null); setScaleIssues([]); setModal(null);
    } catch (error) { setScaleIssues(error.issues || [error.message]); }
  }

  function loadSample() {
    ++version.current; clearWorkspace(); setLoading(false);
    setStudents(normalizeStudents(sampleStudents(), { Math: 100, Physics: 100 })); setFilename('grading-sample.xlsx'); changeCourse('Math'); setModal(null);
    setNotice('Sample loaded: 17 fictional students across Math and Physics.');
  }

  function discardRanges() {
    setRangeEdits(e => Object.fromEntries(Object.entries(e).filter(([key]) => key !== course)));
  }

  function saveRanges(next, undo = false) {
    if (JSON.stringify(next) === JSON.stringify(appliedRanges)) { discardRanges(); return; }
    setRangeEdits(e => ({ ...e, [course]: { ranges: next, undo } })); setNotice('');
  }

  function reviewRanges() {
    if (!proposal || validateRanges(ranges)) return;
    setImpact({ kind: 'ranges', course, nextRanges: ranges, previousRanges: appliedRanges, undo: proposal.undo, changes: gradeImpact(selected, selected, appliedRanges, ranges) });
    setModal('impact');
  }

  function editMaximum() {
    setScaleMode('edit'); setPending({ students: selected, filename }); setScaleIssues([]);
    setMaxima({ [course]: selected[0].maximumMarks }); setAllMaximum(selected[0].maximumMarks); setModal('scales');
  }

  function applyImpact() {
    if (impact.kind === 'ranges') {
      setHistory(h => ({ ...h, [course]: impact.undo ? undoStack.slice(0, -1) : [...undoStack, appliedRanges].slice(-30) }));
      setDrafts(d => ({ ...d, [course]: impact.nextRanges })); discardRanges();
    } else {
      const replacement = new Map(impact.afterStudents.map(s => [s.id, s]));
      setStudents(current => current.map(s => s.course === impact.course ? replacement.get(s.id) : s));
      setPending(null); setScaleIssues([]);
    }
    setExportCount(0); setModal(null); setImpact(null); setNotice('Reviewed changes applied. Save your draft to keep this version.');
  }

  function resumeWorkspace(saved, id) {
    ++version.current; clearWorkspace(); setLoading(false);
    setStudents(saved.students); setDrafts(saved.ranges); setInstructor(saved.instructor); setFilename(saved.filename);
    setCourse(saved.course); setSeconds(saved.seconds); setStart(Date.now() - saved.seconds * 1000);
    setSavedId(id); setSavedFingerprint(JSON.stringify({ version: 1, students: saved.students, instructor: saved.instructor, filename: saved.filename, course: saved.course, ranges: saved.ranges }));
    setModal(null); setNotice('Saved draft resumed. Changes are not saved automatically.');
  }

  function editRange(index, field, value) {
    const next = ranges.map(r => ({ ...r }));
    next[index][field] = value === '' ? null : Number(value) - (field === 'max' && index > 0 ? 1 : 0);
    if (field === 'min') {
      for (let i = index + 1; i < next.length; i++) next[i].max = next[i - 1].min === null ? null : next[i - 1].min - 1;
    }
    saveRanges(next);
  }

  function undo() {
    if (proposal) { discardRanges(); return; }
    if (undoStack.length) saveRanges(undoStack.at(-1), true);
  }

  function finalize() {
    if (!canExport) return;
    try {
      downloadText(exportCSV(students, appliedRanges, instructor, course), exportFilename(course));
      setExportCount(n => n + 1); setModal(null);
      setNotice(`Export ${exportCount + 1} downloaded: all ${selected.length} ${course} students included. Your session stays open for review.`);
    } catch (error) { setIssues([error.message]); setModal(null); }
  }

  function template(format) {
    const rows = sampleStudents().map(s => ({ 'BITS ID': s.id, Course: s.course, 'Total Marks': s.marks }));
    if (format === 'json') downloadText(JSON.stringify(rows, null, 2), 'marks-template.json', 'application/json');
    else downloadText(HEADERS.join(',') + '\r\n' + rows.map(r => HEADERS.map(h => r[h]).join(',')).join('\r\n'), 'marks-template.csv');
  }

  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to workspace</a>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Gradecraft home"><span className="brand-mark"><GraduationCap size={25} /></span><span>gradecraft<span className="brand-dot">.</span></span></a>
      <div className="workspace-label">INSTRUCTOR WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} aria-current={view === 'overview' ? 'page' : undefined} onClick={() => setView('overview')}><LayoutDashboard size={18} /> Overview <span className="nav-dot" /></button>
        <button className={`nav-item ${view === 'students' ? 'active' : ''}`} aria-current={view === 'students' ? 'page' : undefined} onClick={() => setView('students')}><Users size={18} /> Student records <span className="nav-count">{students.length}</span></button>
        <button className="nav-item" onClick={() => setModal('guide')}><BookOpen size={18} /> Import guide <ArrowUpRight size={14} className="nav-end" /></button>
      </nav>
      <div className="sidebar-course"><span className="workspace-label">THIS SESSION</span><div><span className="small-icon"><FolderOpen size={17} /></span><span>{courses.length ? `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} imported` : 'A fresh workspace'}<small>{students.length ? `${students.length} student records` : 'Ready when you are'}</small></span></div></div>
      <div className="sidebar-bottom"><div className="privacy-card"><LockKeyhole size={19} /><strong>Your data stays yours.</strong><p>Files are processed here. Drafts stay on this device only when you choose to save.</p><span><span className="status-dot" /> Private by design</span></div><div className="event-credit"><span className="event-logo">CF</span><div>Built for CodeForge<small>BITS Pilani Digital · V0.1</small></div></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={14} /><strong>{view === 'overview' ? 'Overview' : 'Student records'}</strong></div><div className="topbar-right"><span className="session-clock" aria-label={`Session time ${timer}`}><Clock3 size={15} />{timer}<span>session</span></span><button className="icon-button" onClick={() => setModal('guide')} aria-label="Help and import guide"><CircleHelp size={19} /></button><span className="avatar" aria-label="Instructor">{instructor.trim().slice(0, 2).toUpperCase() || 'IN'}</span></div></header>

      <main id="main">
        <div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> A LITTLE CLARITY. A LOT OF CONFIDENCE.</div><h1>{view === 'overview' ? 'Your grading workspace' : 'Every student, accounted for'}<span className="heading-dot">.</span></h1><p>{view === 'overview' ? 'From a sheet of marks to a clear picture of your class.' : 'Search, check, and review grades before you make them final.'}</p></div><button className="button primary" onClick={() => setModal('export')} disabled={!canExport}><ArrowDownToLine size={17} /> Review & export</button></div>

        <div className="session-tools"><span role="status">{students.length ? unsaved ? 'Unsaved changes on this device' : 'Saved on this device' : 'Start fresh or resume a saved draft'}</span><button className="button secondary" onClick={() => setModal('drafts')}>Saved drafts</button>{course && <button className="button secondary" disabled={!!proposal} onClick={editMaximum}>Edit course total ({selected[0]?.maximumMarks})</button>}</div>

        <div className="workflow" aria-label="Grading progress"><span className={students.length ? 'complete' : 'current'}><span className="step">{students.length ? <Check size={12} /> : '1'}</span> Import marks</span><div /><span className={course ? 'current' : ''}><span className="step">2</span> Review & configure</span><div /><span className={exportCount ? 'complete' : ''}><span className="step">{exportCount ? <Check size={12} /> : '3'}</span> Export grades</span><small><ShieldCheck size={14} /> Nothing saved to a server</small></div>

        <input ref={input} type="file" className="sr-only" tabIndex={-1} accept=".xlsx,.csv,.tsv,.json" aria-label="Upload marks file" onChange={e => handleFile(e.target.files?.[0])} />

        {!students.length && <section className={`welcome-card ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }} aria-busy={loading}>
          <div className="welcome-art" aria-hidden="true"><div className="paper"><span /><span /><span /><div><i /><i /><i /><i /></div></div><span className="art-check"><Check size={21} /></span></div>
          <div className="welcome-copy"><span className="eyebrow">YOUR NEXT GREAT WORKFLOW</span><h2>{loading ? 'Getting your marks ready…' : 'A fresh start for your marks.'}</h2><p>Drop your file here and let’s make sense of the numbers.<br />Excel, CSV, TSV or JSON · Up to 10 MB</p><div className="welcome-buttons"><button className="button primary" onClick={() => input.current.click()} disabled={loading}><Upload size={16} />{loading ? 'Reading file…' : 'Import marks'}</button><button className="button text-button" onClick={loadSample}><Sparkles size={16} /> Try sample data <ArrowRight size={15} /></button></div></div><button className="welcome-guide" onClick={() => setModal('guide')}>Need a template? <ArrowUpRight size={14} /></button>
        </section>}

        <div role="status" className={`notice ${notice ? '' : 'sr-only'}`}><CheckCheck size={16} />{notice}</div>
        {issues.length > 0 && <div className="error-box" role="alert"><div><strong>Let’s fix the import first.</strong><p>No records were imported. Correct these issues and upload again.</p><ul>{issues.slice(0, 8).map((issue, i) => <li key={i}>{issue}</li>)}</ul>{issues.length > 8 && <p>And {issues.length - 8} more issues.</p>}</div><button className="icon-button" onClick={() => setIssues([])} aria-label="Dismiss import errors"><X size={18} /></button></div>}

        <section className="context-bar" aria-label="Session settings"><div className="source-file"><span className="file-icon"><FileSpreadsheet size={21} /></span><div><strong title={filename}>{filename || 'No file imported'}</strong><small>{filename ? `${students.length} records · ${courses.length} courses` : 'Your source file will appear here'}</small></div><button className="icon-button" onClick={() => input.current.click()} aria-label={filename ? 'Replace marks file' : 'Import marks file'} title="Import marks"><Upload size={16} /></button></div><label className="field"><span>Active course</span><div className="select-wrap"><select value={course} onChange={e => changeCourse(e.target.value)} disabled={!courses.length} aria-label="Active course"><option value="" disabled>Select a course</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={14} /></div></label><label className="field instructor-field"><span>Instructor name <span className="required">*</span></span><input value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="e.g. Dr. A. Sharma" autoComplete="name" maxLength={120} /></label></section>

        {view === 'overview' && <>
          <section className="stats-grid" aria-label="Course statistics">{[
            ['Students', selected.length || '—', 'in this course', Users],
            ['Average %', stats?.average.toFixed(2) ?? '—', 'normalized percentage', BarChart3],
            ['Median %', stats?.median.toFixed(2) ?? '—', 'the middle score', SlidersHorizontal],
            ['Highest %', stats ? Number(stats.max.toFixed(2)) : '—', 'normalized percentage', ArrowUp],
            ['Lowest %', stats ? Number(stats.min.toFixed(2)) : '—', 'normalized percentage', ArrowDown]
          ].map(([label, value, sub, Icon], i) => <article className={`stat-card ${i === 0 ? 'featured' : ''}`} key={label}><div><span>{label}</span><Icon size={16} /></div><strong data-testid={`stat-${i}`}>{value}</strong><small>{sub}</small></article>)}</section>

          <div className="analysis-grid">
            <section className="card distribution-card"><div className="card-heading"><div><h2>Marks distribution</h2><p>The shape of your class, at a glance.</p></div><span className="pill"><span className="status-dot" /> {selected.length} students</span></div>
              <div className="chart-area"><div className="chart-y" aria-hidden="true"><span>{Math.max(...bins, 4)}</span><span>{Math.round(Math.max(...bins, 4) / 2)}</span><span>0</span></div><div className="chart" role="img" aria-label={selected.length ? bins.map((n, i) => `${i * 10} to ${i === 9 ? 100 : '<' + (i * 10 + 10)}: ${n} students`).join('; ') : 'Import marks to see the distribution'}><div className="chart-lines" aria-hidden="true"><i /><i /><i /></div>{bins.map((n, i) => <div className="chart-column" key={i}><div className="bar-space"><div className={`bar ${n ? '' : 'empty'}`} style={{ height: `${n / Math.max(...bins, 4) * 100}%`, '--bar-color': i >= 8 ? '#2b6753' : '#a2bdaa' }}><span>{n > 0 ? n : ''}</span></div></div><span className="bar-label">{i * 10}–{i === 9 ? 100 : '<' + (i * 10 + 10)}</span></div>)}{!selected.length && <div className="chart-empty"><BarChart3 size={25} /><span>A little data brings this to life.</span></div>}</div></div><div className="chart-caption"><span>Percentage →</span><span>Percentages · 0–100 scale</span></div>
              <div className="distribution-bottom"><div><h3>Grade breakdown</h3><span>{rangeError ? 'Resolve range errors to see grades' : proposal ? 'Preview of unapplied ranges' : 'Applied grade ranges'}</span></div><div className="grade-strip" aria-hidden="true">{GRADES.map((g, i) => <span key={g} style={{ flex: counts[g] || (selected.length && !rangeError ? 0 : 1), background: COLORS[i] }} />)}</div><div className="grade-counts">{GRADES.map((g, i) => <div key={g}><span><i style={{ background: COLORS[i] }} />{g}</span><strong>{rangeError ? '—' : counts[g]}</strong></div>)}</div></div>
            </section>

            <section className="card ranges-card"><div className="card-heading"><div><h2>Grade ranges</h2><p>Lower bounds included; upper bounds excluded, except A includes 100%.</p></div><span className={`pill ${rangeError ? 'warning' : ''}`}>{rangeError ? 'Needs review' : proposal ? 'Unapplied edits' : customized ? 'Custom' : 'Default'}</span></div>
              <div className="range-table"><div className="range-header"><span>GRADE</span><span>MIN % (≥)</span><span>UPPER %</span><span>COUNT</span></div>{GRADES.map((g, i) => <div className="range-row" key={g}><GradeBadge grade={g} /><label className="sr-only" htmlFor={`min-${i}`}>{g} minimum mark</label><input id={`min-${i}`} aria-label={`${g} minimum mark`} type="number" min="0" max="100" step="1" value={ranges[i].min ?? ''} onChange={e => editRange(i, 'min', e.target.value)} disabled={!course} /><label className="sr-only" htmlFor={`max-${i}`}>{g} maximum mark</label><input id={`max-${i}`} aria-label={`${g} maximum mark`} type="number" min="0" max="100" step="1" value={ranges[i].max === null ? '' : ranges[i].max + (i > 0 ? 1 : 0)} onChange={e => editRange(i, 'max', e.target.value)} disabled={!course} /><span className="range-count">{rangeError ? '—' : counts[g]}</span></div>)}</div>
              <div className={`range-status ${rangeError ? 'invalid' : ''}`} role="status">{rangeError ? <CircleHelp size={15} /> : <ShieldCheck size={15} />}<span>{rangeError || 'All marks covered. No gaps or overlaps.'}</span></div><div className="range-actions"><button className="button subtle" disabled={!course || !customized} onClick={() => { if (window.confirm('Reset this course to the default grade ranges?')) saveRanges(freshRanges()); }}><RotateCcw size={14} /> Reset defaults</button><button className="text-link" disabled={!proposal && !undoStack.length} onClick={undo}>Undo change</button></div>
              {proposal && <div className="range-review"><p>Student records and exports retain applied grades until you review these edits.</p><button className="button primary" disabled={!!rangeError} onClick={reviewRanges}>Review range changes</button><button className="text-link" onClick={discardRanges}>Discard range edits</button></div>}
            </section>
          </div>
        </>}

        <p className="percentage-note">Percentages are displayed to 2 decimals. Grades use unrounded percentages; exports include the original marks, course maximum and percentage.</p><section className="card student-card"><div className="card-heading"><div><h2>Student records <span className="count-tag">{selected.length}</span></h2><p>{course ? `${course} · Every mark has a story. Make sure it’s right.` : 'Your imported students will appear here.'}</p></div><span className="subtle-label"><FileCheck2 size={15} />{selected.length ? 'Validated on import' : 'Ready for your data'}</span></div><div className="table-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Search student IDs" placeholder="Search student ID…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label><div className="table-filters"><label className="cutoff-filter"><input type="checkbox" checked={cutoffOnly} onChange={e => { setCutoffOnly(e.target.checked); setPage(1); }} />Near cutoff (±2 pp)</label><div className="filter-field"><ListFilter size={15} /><select aria-label="Filter by grade" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">All grades</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div><select className="sort-field" aria-label="Sort students" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="id">Student ID</option><option value="high">Marks: high to low</option><option value="low">Marks: low to high</option></select></div></div>
          <div className="table-scroll"><table><thead><tr><th scope="col">STUDENT ID</th><th scope="col">COURSE</th><th scope="col">RAW MARKS</th><th scope="col">PERCENTAGE</th><th scope="col">GRADE</th><th scope="col">REVIEW NOTE</th></tr></thead><tbody>{visible.map(s => {
            const grade = gradeFor(s.marks, appliedRanges);
            const cutoff = cutoffInfo(s, appliedRanges);
            return <tr key={s.id}><td><span className="student-id">{s.id}</span></td><td className="muted">{s.course}</td><td><span className="mark-value">{s.rawMarks}</span><span className="out-of"> / {s.maximumMarks}</span></td><td title={`Unrounded: ${s.marks}%`}>{s.marks.toFixed(2)}%</td><td><GradeBadge grade={grade} /></td><td>{cutoff?.nextGrade ? <span className={cutoff.near ? 'review-tag' : 'ready-note'} title={`${cutoff.percentagePoints} percentage points to ${cutoff.nextGrade}`}>{Number(cutoff.percentagePoints.toPrecision(12))} pp to {cutoff.nextGrade} · {cutoff.rawMarksNeeded} raw marks</span> : <span className="ready-note"><Check size={13} /> Highest grade</span>}</td></tr>;
          })}</tbody></table>{!visible.length && <div className="table-empty"><Users size={27} /><h3>{selected.length ? 'No matching students' : 'Your class starts here'}</h3><p>{selected.length ? 'Try another student ID or grade filter.' : 'Import your marks or explore the sample to get started.'}</p>{!selected.length && <button className="text-link" onClick={loadSample}>Explore sample data <ArrowRight size={14} /></button>}</div>}</div>
          <div className="table-footer"><span>{filtered.length ? `${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, filtered.length)} of ${filtered.length}` : '0'} students{filter !== 'all' || query || cutoffOnly ? ' matching filters' : ''}</span><div><button className="icon-button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button className="icon-button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
        </section>

        <div className="export-banner"><div className="export-banner-icon"><CheckCheck size={22} /></div><div><h3>{exportCount ? 'Exported. And still in your hands.' : 'The last step deserves a second look.'}</h3><p>{!instructor.trim() ? 'Add your instructor name above to unlock your export.' : rangeError ? 'Resolve grade ranges before exporting your results.' : proposal ? 'Review or discard your range edits in Overview before exporting.' : selected.length ? `Review all ${selected.length} students, then download your final grades.` : 'Once your marks are imported, you can review and download your grades.'}</p></div><button className="button primary" disabled={!canExport} onClick={() => setModal('export')}>Review & export <ArrowRight size={16} /></button></div>
        <footer className="page-footer"><span>Made for thoughtful grading.</span><span><Leaf size={13} /> Gradecraft · A CodeForge project, not an official BITS tool</span></footer>
      </main>
    </div>

    {modal === 'drafts' && <DraftDialog workspace={{ ...workspace, seconds }} canSave={students.length > 0 && !Object.keys(rangeEdits).length && !pending && !loading} currentId={savedId} onSaved={id => { setSavedId(id); setSavedFingerprint(fingerprint); }} onResume={resumeWorkspace} onDelete={id => { if (id === null || id === savedId) { setSavedId(null); setSavedFingerprint(''); } }} onClose={() => setModal(null)} />}
    {modal === 'mapping' && importSource && <ImportMapping source={importSource} onReady={prepareScales} onCancel={cancelImport} />}
    {modal === 'impact' && impact && <ImpactDialog impact={impact} onApply={applyImpact} onClose={() => { setModal(impact.kind === 'maximum' ? 'scales' : null); setImpact(null); }} />}

    {modal === 'scales' && pending && <Modal title={scaleMode === 'edit' ? 'Correct the course total' : 'Confirm your course totals'} onClose={cancelImport}>
      <p className="modal-intro">{pending.students.length} records in {pending.filename}. Set the maximum possible marks for each course. We never infer it from the highest student score.</p>
      <div className="maximum-shortcut"><label>Maximum for all courses<input aria-label="Maximum for all courses" type="number" min="1" max={MAX_SCORE} step="1" value={allMaximum ?? ''} onChange={e => setAllMaximum(e.target.value === '' ? null : Number(e.target.value))} /></label><button className="button secondary" disabled={!Number.isSafeInteger(allMaximum) || allMaximum <= 0 || allMaximum > MAX_SCORE} onClick={() => { setMaxima(Object.fromEntries(Object.keys(maxima).map(c => [c, allMaximum]))); setScaleIssues([]); }}>Apply to all</button></div>
      <div className="course-maxima">{Object.keys(maxima).map(c => <label key={c}><span>{c}</span><input aria-label={`Maximum marks for ${c}`} type="number" min="1" max={MAX_SCORE} step="1" value={maxima[c] ?? ''} onChange={e => { setMaxima(m => ({ ...m, [c]: e.target.value === '' ? null : Number(e.target.value) })); setScaleIssues([]); }} /></label>)}</div>
      <p className="modal-intro">Example: 480 out of 600 becomes 80%. Grade boundaries apply to percentages, without rounding before grading.</p>
      {scaleIssues.length > 0 && <div className="error-box" role="alert"><div><strong>Check the course totals</strong><ul>{scaleIssues.slice(0, 8).map((issue, i) => <li key={i}>{issue}</li>)}</ul>{scaleIssues.length > 8 && <p>And {scaleIssues.length - 8} more issues.</p>}</div></div>}
      <div className="modal-actions"><button className="button secondary" onClick={cancelImport}>{scaleMode === 'edit' ? 'Cancel total changes' : 'Cancel import'}</button><button className="button primary" onClick={confirmImport}>{scaleMode === 'edit' ? 'Preview total changes' : 'Confirm & import'}</button></div>
    </Modal>}

    {modal === 'guide' && <Modal title="A good import starts here." onClose={() => setModal(null)}><p className="modal-intro">One simple structure. Four ways to bring your marks in.</p><div className="format-chips"><span>.XLSX</span><span>.CSV</span><span>.TSV</span><span>.JSON</span></div><div className="guide-example"><table><thead><tr>{HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody><tr><td>DEMO-001</td><td>Mathematics</td><td>82</td></tr><tr><td>DEMO-002</td><td>Mathematics</td><td>71</td></tr></tbody></table></div><ul className="guide-list"><li>Use BITS ID, Course and Total Marks, or map your own columns after uploading. Unmapped columns are excluded. Save IDs as text to preserve leading zeros.</li><li>Enter nonnegative whole-number marks. After upload, confirm the maximum marks for each course (default 100). Scores cannot exceed that maximum. Leave absent / NC students out of the file.</li><li>Each student ID can appear once per course. Course names ignore capitalization and surrounding spaces; the first spelling is used for display. Different courses can share a student ID.</li><li>For multi-sheet Excel files, choose the worksheet to import. CSV uses commas; TSV uses tabs. JSON uses an array of objects; their fields can be mapped too.</li><li>Up to 10 MB and 25,000 records per file. An invalid row blocks the whole import, so nobody is silently left out.</li><li>Review and apply range changes before exporting. Use Saved drafts to explicitly save and resume on this device; unsaved edits are lost on reload.</li></ul><div className="template-buttons"><button className="button secondary" onClick={() => template('csv')}><ArrowDownToLine size={15} /> CSV template</button><button className="button secondary" onClick={() => template('json')}><ArrowDownToLine size={15} /> JSON template</button><a className="button secondary" href="/samples/grading-sample.xlsx" download><ArrowDownToLine size={15} /> Excel sample</a></div><div className="modal-actions"><button className="text-link" onClick={loadSample}>Try sample data</button><button className="button primary" onClick={() => input.current.click()}><Upload size={16} /> Choose a file</button></div></Modal>}

    {modal === 'export' && <Modal title="One last look. Then you’re done." wide onClose={() => setModal(null)}><p className="modal-intro">Your CSV includes every student in <strong>{course}</strong>, regardless of table filters.</p><div className="export-summary"><div><small>INSTRUCTOR</small><strong>{instructor}</strong></div><div><small>STUDENTS</small><strong>{selected.length}</strong></div><div><small>ASSIGNED A GRADE</small><strong>{rangeError ? 0 : Object.values(counts).reduce((a, b) => a + b, 0)} / {selected.length}</strong></div></div><div className="export-grades">{GRADES.map(g => <span key={g}><GradeBadge grade={g} /><strong>{counts[g]}</strong></span>)}</div><div className="guide-example"><table><caption>Preview · first {Math.min(5, selected.length)} of {selected.length} students</caption><thead><tr><th>BITS ID</th><th>Raw / Maximum</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>{selected.slice(0, 5).map(s => <tr key={s.id}><td>{s.id}</td><td>{s.rawMarks} / {s.maximumMarks}</td><td>{s.marks.toFixed(2)}%</td><td>{rangeError ? '—' : gradeFor(s.marks, ranges)}</td></tr>)}</tbody></table></div><p className="export-note"><ShieldCheck size={16} /> All records included. Spreadsheet formula-like text is escaped for a safer export.</p><div className="export-file"><FileSpreadsheet size={21} /><div><strong>{exportFilename(course)}</strong><small>CSV · UTF-8 · Instructor and course metadata included</small></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Back to review</button><button className="button primary" onClick={finalize} disabled={!canExport}><ArrowDownToLine size={16} /> Download final grades</button></div></Modal>}
  </div>;
}
