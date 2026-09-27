const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../BITS_Digital_CodeForge_Challenge.html'),'utf8');
const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];

// A deliberately small DOM adapter: tests execute the actual inline application
// code, but do not substitute for visual/browser or SheetJS integration checks.
function app(){
  const registry=new Map();
  const drawing=[];
  class Element{
    constructor(tag='div'){this.tag=tag;this.children=[];this.options=[];this._value='';this.textContent='';this.style={};this.attributes={};this.classList={add(){},remove(){}};}
    set id(id){this._id=id;registry.set(id,this);}
    get id(){return this._id;}
    set value(value){value=String(value);this._value=this.tag==='select'&&!this.options.some(o=>o.value===value)?'':value;}
    get value(){return this._value;}
    set innerHTML(value){this.children=[];if(value.includes('class="min"')){this.minChild=new Element();}}
    add(option){this.options.push(option);if(this.options.length===1||option.selected)this._value=option.value;}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.options=[];this.children=[];this._value='';children.forEach(c=>this.add(c));}
    querySelector(){return this.minChild;}
    setAttribute(name,value){this.attributes[name]=value;}
    getContext(){return {clearRect(){},fillRect(...args){drawing.push(args);},fillText(){}};}
    click(){this.clicked=true;}
    remove(){}
  }
  for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)){
    const element=new Element(match[1]);element.id=match[2];
  }
  const links=[];
  const document={getElementById:id=>registry.get(id),createElement:tag=>{const el=new Element(tag);if(tag==='a')links.push(el);return el;},body:new Element('body')};
  const timers=[];
  const context=vm.createContext({document,Option:function(text,value,defaultSelected,selected){this.text=String(text);this.value=String(value);this.selected=selected;},
    setInterval:()=>1,clearInterval(){},setTimeout:fn=>timers.push(fn),confirm:()=>true,Blob,
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>{context.revoked=url;}}});
  vm.runInContext(source,context);
  return {context,registry,drawing,links,timers,run:code=>vm.runInContext(code,context)};
}
const headers=['BITS ID','Course','Total Marks'];
function load(a,rows){
  a.context.rows=[headers,...rows];
  a.run('data=parseRows(rows);course.add(new Option("Math","Math"));course.value="Math";instructor.value="Dr Test";course.onchange()');
}

test('initial/reset/empty states are safe and cannot export',()=>{
  const a=app();
  assert.equal(a.run('download.disabled'),true);
  assert.equal(a.run('avg.textContent'),'—');
  assert.equal(a.run('document.getElementById("timerText").textContent'),'00:00');
  a.run('resetRanges.onclick()');
  assert.throws(()=>a.run('buildCSV()'),/select a course/);
});
test('statistics use numeric values and correct Min/Max labels',()=>{
  const a=app();load(a,[['a','Math','0'],['b','Math','20'],['c','Math',80],['d','Math',100]]);
  assert.equal(a.run('min.textContent'),0);
  assert.equal(a.run('max.textContent'),100);
  assert.equal(a.run('avg.textContent'),'50.00');
  assert.equal(a.run('med.textContent'),50);
  assert.match(html,/Min<br><b id="min"/);
  assert.match(html,/Max<br><b id="max"/);
});
test('every integer mark maps to exactly one default grade',()=>{
  const a=app();load(a,Array.from({length:101},(_,i)=>['s'+i,'Math',i]));
  const rows=a.run('buildCSV()').trim().split('\r\n').slice(4);
  assert.equal(rows.length,101);
  assert.deepEqual(a.registry.get('gradeSummary').children.map(el=>el.textContent),
    ['A: 21','A-: 10','B: 10','B-: 10','C: 10','C-: 10','D: 10','E: 20']);
  assert.equal(a.run('med.textContent'),50);
  for(let mark=0;mark<=100;mark++){
    const expected=mark>=80?'A':mark>=70?'A-':mark>=60?'B':mark>=50?'B-':mark>=40?'C':mark>=30?'C-':mark>=20?'D':'E';
    assert.equal(rows[mark],`"s${mark}","${mark}","${expected}"`);
  }
});
test('invalid, blank, fractional, boolean, and out-of-range marks are rejected',()=>{
  const a=app();
  for(const mark of [null,'', ' ',true,false,NaN,Infinity,-1,101,80.2,'eighty','0x50']){
    a.context.rows=[headers,['a','Math',mark]];
    assert.throws(()=>a.run('parseRows(rows)'),/Row 2: Total Marks/);
  }
});
test('schema, missing identity, duplicates and empty sheets are rejected',()=>{
  const a=app();
  for(const rows of [[],[headers],[['BITS ID','Course','Score'],['a','Math',50]],
    [headers,['','Math',50]],[headers,['a','',50]],
    [headers,['a','Math',50],['a','Math',60]],
    [headers,['a','Math',50,'extra']]]){
    a.context.rows=rows;assert.throws(()=>a.run('parseRows(rows)'));
  }
  a.context.rows=[headers,[' a ',' Math ','80'],[],['a','Physics',60]];
  assert.equal(a.run('parseRows(rows).length'),2);
  assert.equal(a.run('parseRows(rows)[0].Course'),'Math');
});
test('ranges reject missing endpoints, gaps, overlaps, reversed and blank bounds',()=>{
  const a=app();load(a,[['a','Math',50]]);
  for(const [id,value] of [['Amax',99],['Emin',1],['A-max',78],['A-max',80],['Amin',100],['A-max',-1]]){
    a.run('buildGradeUI()');a.registry.get(id).value=value;
    assert.notEqual(a.run('validateRanges()'),'');
    a.run('updateAll()');assert.equal(a.run('download.disabled'),true);
    assert.match(a.run('gradeSummary.textContent'),/Fix grade ranges/);
    assert.throws(()=>a.run('buildCSV()'));
  }
});
test('single-mark bands are valid and invalid cascading is blocked',()=>{
  const a=app();load(a,[['a','Math',100]]);
  a.run('document.getElementById("Amin").value=100;cascadeMaxFrom(0)');
  assert.equal(a.run('validateRanges()'),'');
  assert.match(a.run('buildCSV()'),/"100","A"/);
  a.run('document.getElementById("Amin").value=0;cascadeMaxFrom(0)');
  assert.notEqual(a.run('validateRanges()'),'');
});
test('removing the instructor disables export and a direct call is guarded',()=>{
  const a=app();load(a,[['a','Math',50]]);
  assert.equal(a.run('download.disabled'),false);
  a.run('instructor.value=" ";instructor.oninput()');
  assert.equal(a.run('download.disabled'),true);
  assert.throws(()=>a.run('buildCSV()'));
});
test('CSV escapes commas, quotes, newlines, Unicode and formula prefixes',()=>{
  const a=app();load(a,[['=1+1','Math',50],['ID,"two"\nline','Math',80]]);
  a.context.name='Dr. "A", José\nTeacher';a.run('instructor.value=name');
  const csv=a.run('buildCSV()');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Dr. ""A"", José\nTeacher"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"ID,""two""\nline"'));
});
test('histogram remains finite and within canvas for a large identical cohort',()=>{
  const a=app();load(a,Array.from({length:1000},(_,i)=>['s'+i,'Math',100]));
  for(const rect of a.drawing){assert.ok(rect.every(Number.isFinite));assert.ok(rect[1]>=0);assert.ok(rect[3]<=170);}
  assert.match(a.registry.get('hist').attributes['aria-label'],/90 to 100: 1000 students/);
});
function reader(a){a.context.XLSX={read:buffer=>({SheetNames:['Sheet1'],Sheets:{Sheet1:buffer}}),utils:{sheet_to_json:sheet=>sheet}};}
async function upload(a,rows,name='marks.xlsx'){
  a.context.event={target:{files:[{name,arrayBuffer:async()=>rows}]}};
  await a.run('file.onchange(event)');
}
test('reuploads deduplicate courses and clear stale records, analytics and export',async()=>{
  const a=app();reader(a);
  await upload(a,[headers,['a','Math',50],['b','Math',70]]);
  assert.equal(a.registry.get('course').options.length,2);
  a.run('course.value="Math";instructor.value="Dr Test";course.onchange()');
  await upload(a,[headers,['c','Physics',80]]);
  assert.deepEqual(a.registry.get('course').options.map(x=>x.value),['','Physics']);
  assert.equal(a.run('download.disabled'),true);
  assert.equal(a.run('avg.textContent'),'—');
  assert.equal(a.run('data.length'),1);
});
test('a stale asynchronous upload cannot overwrite the latest workbook',async()=>{
  const a=app();reader(a);let resolve;
  a.context.event={target:{files:[{name:'slow.xlsx',arrayBuffer:()=>new Promise(r=>resolve=r)}]}};
  const slow=a.run('file.onchange(event)');
  await upload(a,[headers,['b','Physics',90]]);
  resolve([headers,['a','Math',50]]);await slow;
  assert.equal(a.run('data[0].Course'),'Physics');
});
test('failed reads, bad rows, unsupported files and missing reader leave no stale export',async()=>{
  const a=app();reader(a);
  await upload(a,[headers,['a','Math',50]]);
  await upload(a,[headers,['a','Math','bad']]);
  assert.equal(a.run('data.length'),0);
  assert.equal(a.run('course.disabled'),true);
  assert.match(a.run('uploadStatus.textContent'),/Row 2/);
  await upload(a,[],'marks.csv');assert.match(a.run('uploadStatus.textContent'),/xlsx/);
  a.context.XLSX.read=()=>{throw new Error('Corrupt workbook');};
  await upload(a,[]);assert.match(a.run('uploadStatus.textContent'),/Corrupt workbook/);
  delete a.context.XLSX;await upload(a,[]);assert.match(a.run('uploadStatus.textContent'),/reader did not load/);
});
test('downloads attach and click a link and release the object URL',()=>{
  const a=app();load(a,[['a','Math',50]]);
  a.run('download.onclick()');
  assert.equal(a.links[0].clicked,true);
  assert.equal(a.links[0].download,'grades.csv');
  a.timers.forEach(fn=>fn());assert.equal(a.context.revoked,'blob:test');
});
