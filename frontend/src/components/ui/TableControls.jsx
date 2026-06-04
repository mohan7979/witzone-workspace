import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────── */
const getPath = (obj, path) =>
  typeof path === 'function' ? path(obj) : path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const na = typeof a === 'number' ? a : parseFloat(a);
  const nb = typeof b === 'number' ? b : parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/* ── hook: client-side search + sort + pagination ────────────────── */
export function useTableControls(rows, { searchKeys = [], initialSort = null, pageSize = 10 } = {}) {
  const [search, setSearchRaw] = useState('');
  const [sort, setSort] = useState(initialSort); // { key, dir }
  const [page, setPage] = useState(1);

  const setSearch = (v) => { setSearchRaw(v); setPage(1); };

  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click clears sorting
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !searchKeys.length) return rows || [];
    return (rows || []).filter((r) =>
      searchKeys.some((k) => {
        const v = getPath(r, k);
        return v != null && String(v).toLowerCase().includes(q);
      }));
  }, [rows, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => cmp(getPath(a, sort.key), getPath(b, sort.key)) * mul);
  }, [filtered, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const view = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  return { view, total, search, setSearch, sort, toggleSort, page: safePage, setPage, pageCount, pageSize };
}

/* ── Toolbar: search box + optional right-side filters + count ────── */
export function TableToolbar({ search, setSearch, total, placeholder = 'Search…', children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ position:'relative', flex:'1 1 220px', maxWidth:'320px' }}>
        <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'rgba(241,245,249,0.35)', pointerEvents:'none' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{ width:'100%', padding:'9px 12px 9px 34px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
          onFocus={(e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
          onBlur={(e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
        />
      </div>
      {children}
      <span style={{ marginLeft:'auto', fontSize:'12px', color:'rgba(241,245,249,0.35)', whiteSpace:'nowrap' }}>
        {total} result{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/* ── Sortable header cell ─────────────────────────────────────────── */
const thBase = { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' };

export function SortTh({ label, sortKey, sort, toggleSort, style }) {
  const active = sort && sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th style={{ ...thBase, cursor:'pointer', userSelect:'none', ...style }} onClick={() => toggleSort(sortKey)}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', color: active ? '#818CF8' : undefined }}>
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} />
      </span>
    </th>
  );
}

/* ── Pagination footer ────────────────────────────────────────────── */
export function Pagination({ page, pageCount, setPage, total, pageSize }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = (disabled) => ({
    display:'inline-flex', alignItems:'center', gap:'4px', padding:'6px 10px', fontSize:'12px', fontWeight:600,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(129,140,248,0.1)',
    color: disabled ? 'rgba(241,245,249,0.25)' : '#818CF8',
    border:`1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(129,140,248,0.25)'}`,
    borderRadius:'8px', cursor: disabled ? 'not-allowed' : 'pointer', transition:'all 0.15s',
  });
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.05)', flexWrap:'wrap' }}>
      <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)' }}>Showing {from}–{to} of {total}</span>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={btn(page <= 1)}><ChevronLeft size={13} /> Prev</button>
        <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.5)', fontWeight:600, minWidth:'70px', textAlign:'center' }}>Page {page} / {pageCount}</span>
        <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} style={btn(page >= pageCount)}>Next <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}
