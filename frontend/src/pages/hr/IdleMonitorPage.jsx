import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import { idleApi, reportApi, userApi } from '@/api';
import { formatHMS, formatTime, formatDate } from '@/lib/utils';
import { useTableControls, TableToolbar, SortTh, Pagination } from '@/components/ui/TableControls';
import { AlertTriangle, CheckCircle2, WifiOff, Activity, Clock, X, Coffee, Download, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };
const glassHi = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'16px', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

const HIGH_IDLE = 1800;

function IdleTimelineModal({ userId, date, name, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['idle-detail', userId, date],
    queryFn: () => idleApi.detail({ user_id:userId, date }),
    enabled: !!userId,
  });

  const formatHHMM = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false });
  };

  const timeline  = data?.timeline || [];
  const totalWork = timeline.filter(t => t.type === 'work').reduce((s, t) => s + t.duration_minutes, 0);
  const totalIdleSecs  = data?.total_idle_seconds ?? timeline.filter(t => t.type === 'idle').reduce((s, t) => s + (t.duration_seconds ?? t.duration_minutes * 60), 0);
  const totalBreakSecs = data?.total_break_seconds ?? 0;
  const longIdleCount  = data?.long_idle_sessions ?? timeline.filter(t => t.type === 'idle' && t.long_idle).length;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'560px', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>

        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)', flexShrink:0 }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <div>
            <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Idle Timeline — {name}</p>
            <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>{formatDate(date)}</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 24px', flex:1 }}>
          {isLoading && <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.3)', textAlign:'center', padding:'24px' }}>Loading timeline…</p>}
          {!isLoading && !data?.attendance?.login_time && <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.3)', textAlign:'center', padding:'24px' }}>No attendance record found for this date.</p>}

          {!isLoading && data?.attendance?.login_time && (
            <>
              <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
                {[
                  { icon:<Clock size={11}/>, label:`Clocked in: ${formatTime(data.attendance.login_time)}`, bg:'rgba(129,140,248,0.15)', color:'#818CF8', border:'rgba(129,140,248,0.3)' },
                  ...(data.attendance.logout_time ? [{ icon:<Clock size={11}/>, label:`Clocked out: ${formatTime(data.attendance.logout_time)}`, bg:'rgba(255,255,255,0.06)', color:'rgba(241,245,249,0.6)', border:'rgba(255,255,255,0.12)' }] : []),
                  ...(data.attendance.login_time_2 ? [{ icon:<Clock size={11}/>, label:`2nd clock-in: ${formatTime(data.attendance.login_time_2)}`, bg:'rgba(129,140,248,0.15)', color:'#818CF8', border:'rgba(129,140,248,0.3)' }] : []),
                  ...(data.attendance.logout_time_2 ? [{ icon:<Clock size={11}/>, label:`2nd clock-out: ${formatTime(data.attendance.logout_time_2)}`, bg:'rgba(255,255,255,0.06)', color:'rgba(241,245,249,0.6)', border:'rgba(255,255,255,0.12)' }] : []),
                  { icon:null, label:`Work: ${totalWork}m`, bg:'rgba(52,211,153,0.15)', color:'#34D399', border:'rgba(52,211,153,0.3)' },
                  { icon:null, label:`Idle Time: ${formatHMS(totalIdleSecs)}`, bg:'rgba(248,113,113,0.15)', color:'#F87171', border:'rgba(248,113,113,0.3)' },
                  { icon:null, label:`Break Time: ${formatHMS(totalBreakSecs)}`, bg:'rgba(251,191,36,0.15)', color:'#FBBF24', border:'rgba(251,191,36,0.3)' },
                  ...(longIdleCount > 0 ? [{ icon:<AlertTriangle size={11}/>, label:`${longIdleCount} long idle (≥30m)`, bg:'rgba(248,113,113,0.2)', color:'#F87171', border:'rgba(248,113,113,0.4)' }] : []),
                ].map(({ icon, label, bg, color, border }, i) => (
                  <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, background:bg, color, border:`1px solid ${border}` }}>
                    {icon}{label}
                  </span>
                ))}
              </div>

              {timeline.length === 0 ? (
                <div style={{ textAlign:'center', padding:'16px', fontSize:'13px', color:'rgba(241,245,249,0.3)' }}>No idle sessions recorded — employee was active all day.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {timeline.map((entry, i) => {
                    const isIdle = entry.type === 'idle';
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'stretch', gap:'12px' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'16px', flexShrink:0 }}>
                          <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: isIdle ? '#F87171' : '#34D399', border:'2px solid rgba(13,17,30,0.98)', boxShadow:'0 0 0 2px ' + (isIdle ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'), flexShrink:0, marginTop:'13px' }} />
                          {i < timeline.length - 1 && <div style={{ flex:1, width:'2px', background:'rgba(255,255,255,0.07)', minHeight:'8px' }} />}
                        </div>
                        <div style={{ flex:1, padding:'10px 14px', marginBottom:'4px', borderRadius:'10px', border:'1px solid', background: isIdle ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', borderColor: isIdle ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color: isIdle ? '#F87171' : '#34D399' }}>
                              {isIdle ? 'Idle' : 'Working'}
                              {isIdle && entry.long_idle && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', textTransform:'none', letterSpacing:0, fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'5px', background:'rgba(248,113,113,0.2)', color:'#F87171', border:'1px solid rgba(248,113,113,0.4)' }}>
                                  <AlertTriangle size={9} /> Long idle
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', fontWeight:600 }}>
                              {isIdle ? formatHMS(entry.duration_seconds ?? entry.duration_minutes * 60) : `${entry.duration_minutes}m`}
                            </span>
                          </div>
                          <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.5)', marginTop:'3px' }}>
                            {formatHHMM(entry.start)} → {formatHHMM(entry.end)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function timeSince(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function UserRow({ user, type }) {
  const gradients = { disconnected:'linear-gradient(135deg,#334155,#475569)', idle:'linear-gradient(135deg,#EF4444,#F87171)', active:'linear-gradient(135deg,#10B981,#34D399)', break:'linear-gradient(135deg,#F59E0B,#FBBF24)' };
  const glowRgb = { active:'52,211,153', idle:'248,113,113', break:'251,191,36', disconnected:'148,163,184' }[type] || '148,163,184';

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0, background:gradients[type], display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:700, boxShadow:`0 0 12px rgba(${glowRgb},0.3)` }}>
          {user.first_name?.[0]}{user.last_name?.[0]}
        </div>
        <div>
          <p style={{ fontSize:'13px', fontWeight:600, color:'#F1F5F9', display:'flex', alignItems:'center', gap:'6px' }}>
            {user.first_name} {user.last_name}
            {user.session === 2 && (
              <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 6px', borderRadius:'5px', background:'rgba(129,140,248,0.15)', color:'#818CF8', border:'1px solid rgba(129,140,248,0.3)' }}>SESSION 2</span>
            )}
          </p>
          <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>{user.department} · {user.employee_id}</p>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
        <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)' }}>Last ping: {timeSince(user.last_heartbeat)}</span>
        {type === 'disconnected' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background:'rgba(148,163,184,0.1)', color:'#94A3B8', border:'1px solid rgba(148,163,184,0.25)' }}>
            <WifiOff size={11} /> Offline
          </span>
        )}
        {type === 'break' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background:'rgba(251,191,36,0.15)', color:'#FBBF24', border:'1px solid rgba(251,191,36,0.3)' }}>
            <Coffee size={11} /> On Break
          </span>
        )}
        {type === 'idle' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background:'rgba(248,113,113,0.15)', color:'#F87171', border:'1px solid rgba(248,113,113,0.3)' }}>
            <AlertTriangle size={11} /> {formatHMS(user.idle_seconds)} idle
          </span>
        )}
        {type === 'active' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background:'rgba(52,211,153,0.15)', color:'#34D399', border:'1px solid rgba(52,211,153,0.3)' }}>
            <Activity size={11} /> Active
          </span>
        )}
      </div>
    </div>
  );
}

const PERIODS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
];
const SCOPES = [
  { key: 'global',     label: 'Global' },
  { key: 'department', label: 'Department' },
  { key: 'employee',   label: 'Employee' },
];

const fmtHours = (h) => {
  const n = Number(h) || 0;
  const hh = Math.floor(n);
  const mm = Math.round((n - hh) * 60);
  return `${hh}h ${mm}m`;
};

const selectStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '9px', color: '#F1F5F9', fontSize: '13px', fontWeight: 600,
  padding: '8px 12px', cursor: 'pointer', outline: 'none', minWidth: '180px',
};

// Period × scope historical idle / work report (deferred item #6).
function IdleHistoryReport() {
  const [period, setPeriod] = useState('monthly');
  const [anchor, setAnchor] = useState(() => new Date().toISOString().split('T')[0]);
  const [scope, setScope]   = useState('global');
  const [dept, setDept]     = useState('');
  const [emp, setEmp]       = useState('');

  const { data: deptData } = useQuery({ queryKey: ['idle-rep-depts'], queryFn: userApi.departments, staleTime: 300000 });
  const departments = deptData?.departments || [];
  const { data: empData } = useQuery({ queryKey: ['idle-rep-emps'], queryFn: () => userApi.list({ limit: 300, status: 'active' }), staleTime: 300000, enabled: scope === 'employee' });
  const employees = empData?.data || [];

  const params = { period, date: anchor };
  if (scope === 'department' && dept) params.department = dept;
  if (scope === 'employee'   && emp)  params.user_id = emp;

  const { data, isFetching } = useQuery({
    queryKey: ['idle-history', period, anchor, scope, dept, emp],
    queryFn: () => reportApi.idleHistory(params),
    keepPreviousData: true,
  });

  const shiftAnchor = (dir) => {
    const d = new Date(anchor + 'T00:00:00');
    if (period === 'daily')   d.setDate(d.getDate() + dir);
    if (period === 'weekly')  d.setDate(d.getDate() + dir * 7);
    if (period === 'monthly') d.setMonth(d.getMonth() + dir);
    if (period === 'yearly')  d.setFullYear(d.getFullYear() + dir);
    setAnchor(d.toISOString().split('T')[0]);
  };

  const rows   = data?.data   || [];
  const totals = data?.totals || {};
  const tc = useTableControls(rows, {
    searchKeys: ['user.first_name', 'user.last_name', 'user.employee_id', 'user.department'],
    initialSort: { key: 'idle_seconds', dir: 'desc' },
    pageSize: 10,
  });

  const rangeLabel = data
    ? (data.start === data.end ? formatDate(data.start) : `${formatDate(data.start)} — ${formatDate(data.end)}`)
    : '…';

  const exportCsv = () => {
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const head = ['Employee', 'Employee ID', 'Department', 'Present Days', 'Work Hours', 'Idle Time', 'Break Time', 'Effective Hours', 'Idle Events', 'Long Idle (>=30m)'];
    const body = rows.map(r => [
      `${r.user.first_name} ${r.user.last_name}`, r.user.employee_id, r.user.department || '',
      r.present_days, r.work_hours, formatHMS(r.idle_seconds), formatHMS(r.break_seconds), r.effective_hours, r.idle_events, r.long_idle,
    ]);
    const csv = [head, ...body].map(line => line.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `idle-report-${period}-${data?.start}_${data?.end}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const summary = [
    { label: 'Employees',        value: totals.employees ?? 0,             color: '#818CF8' },
    { label: 'Total Work',       value: fmtHours(totals.work_hours),       color: '#34D399' },
    { label: 'Total Idle',       value: formatHMS(totals.idle_seconds || 0),  color: '#F87171' },
    { label: 'Total Break',      value: formatHMS(totals.break_seconds || 0), color: '#FBBF24' },
    { label: 'Long Idle (≥30m)', value: totals.long_idle ?? 0,             color: '#F87171' },
  ];

  const seg = (active) => ({
    padding: '7px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
    border: '1px solid ' + (active ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'),
    background: active ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.03)',
    color: active ? '#A78BFA' : 'rgba(241,245,249,0.55)', transition: 'all 0.15s',
  });

  return (
    <div style={glass}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#A78BFA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(167,139,250,0.3)' }}>
            <BarChart3 size={17} color="white" />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.2px' }}>Idle Report</p>
            <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)', marginTop: '2px' }}>Idle, work &amp; break time aggregated by period and scope</p>
          </div>
        </div>
        <button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', cursor: 'pointer', padding: '8px 14px', borderRadius: '9px' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,211,153,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,211,153,0.1)'}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* Period segmented control */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={seg(period === p.key)}>{p.label}</button>
          ))}
        </div>
        {/* Anchor navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => shiftAnchor(-1)} title="Previous" style={{ display: 'flex', padding: '7px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(241,245,249,0.6)' }}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9', minWidth: '170px', textAlign: 'center' }}>{rangeLabel}</span>
          <button onClick={() => shiftAnchor(1)} title="Next" style={{ display: 'flex', padding: '7px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(241,245,249,0.6)' }}><ChevronRight size={15} /></button>
        </div>
        {/* Scope */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {SCOPES.map(s => (
            <button key={s.key} onClick={() => { setScope(s.key); if (s.key !== 'department') setDept(''); if (s.key !== 'employee') setEmp(''); }} style={seg(scope === s.key)}>{s.label}</button>
          ))}
        </div>
        {scope === 'department' && (
          <select value={dept} onChange={e => setDept(e.target.value)} style={selectStyle}>
            <option value="" style={{ background: '#0D1117' }}>All departments</option>
            {departments.map(d => <option key={d} value={d} style={{ background: '#0D1117' }}>{d}</option>)}
          </select>
        )}
        {scope === 'employee' && (
          <select value={emp} onChange={e => setEmp(e.target.value)} style={selectStyle}>
            <option value="" style={{ background: '#0D1117' }}>Select employee…</option>
            {employees.map(u => <option key={u.id} value={u.id} style={{ background: '#0D1117' }}>{u.first_name} {u.last_name} ({u.employee_id})</option>)}
          </select>
        )}
        {isFetching && <span style={{ fontSize: '11px', color: 'rgba(167,139,250,0.7)' }}>Loading…</span>}
      </div>

      {/* Summary chips */}
      <div style={{ padding: '14px 22px', display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {summary.map(s => (
          <div key={s.label} style={{ flex: '1 1 130px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px 14px' }}>
            <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(241,245,249,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '3px' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <TableToolbar search={tc.search} setSearch={tc.setSearch} total={tc.total} placeholder="Search name, ID or department…" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortTh label="Employee"        sortKey="user.first_name" sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Department"      sortKey="user.department" sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Present Days"    sortKey="present_days"    sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Work Hrs"        sortKey="work_hours"      sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Idle Time"       sortKey="idle_seconds"    sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Break Time"      sortKey="break_seconds"   sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Effective Hrs"   sortKey="effective_hours" sort={tc.sort} toggleSort={tc.toggleSort} />
              <SortTh label="Long Idle"       sortKey="long_idle"       sort={tc.sort} toggleSort={tc.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {!tc.total ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'rgba(241,245,249,0.2)' }}>No idle / attendance data for this period</td></tr>
            ) : (
              tc.view.map((row, i) => {
                const isHigh = row.idle_seconds > HIGH_IDLE;
                return (
                  <tr key={row.user?.id || i} style={{ transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={S.td}>
                      <p style={{ fontWeight: 600, color: '#F1F5F9', fontSize: '13px' }}>{row.user?.first_name} {row.user?.last_name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(241,245,249,0.3)', marginTop: '2px' }}>{row.user?.employee_id}</p>
                    </td>
                    <td style={S.td}>{row.user?.department || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{row.present_days}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(row.work_hours)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: isHigh ? '#F87171' : 'rgba(241,245,249,0.75)', fontVariantNumeric: 'tabular-nums' }}>{formatHMS(row.idle_seconds)}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#FBBF24', fontVariantNumeric: 'tabular-nums' }}>{formatHMS(row.break_seconds)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#818CF8', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(row.effective_hours)}</td>
                    <td style={S.td}>
                      {row.long_idle > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '7px', fontSize: '11px', fontWeight: 700, background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}><AlertTriangle size={10} /> {row.long_idle}</span>
                        : <span style={{ color: 'rgba(241,245,249,0.3)' }}>0</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={tc.page} pageCount={tc.pageCount} setPage={tc.setPage} total={tc.total} pageSize={tc.pageSize} />
    </div>
  );
}

export default function IdleMonitorPage() {
  const [timeline, setTimeline] = useState(null);

  const { data:live, dataUpdatedAt } = useQuery({ queryKey:['idle-live'], queryFn:idleApi.live, refetchInterval:30000 });

  const today = new Date().toISOString().split('T')[0];
  const { data:team } = useQuery({ queryKey:['idle-team', today], queryFn:() => idleApi.teamSummary({ date:today }) });

  // Normalise the aggregated idle rows so search/sort work on plain fields.
  const idleRows = (team?.data || []).map((r) => ({
    user: r.user,
    _idle:   parseInt(r.dataValues?.total_idle_seconds || r.total_idle_seconds || 0),
    _break:  parseInt(r.total_break_seconds || 0),
    _events: r.dataValues?.idle_events || r.idle_events || 0,
  }));
  const stc = useTableControls(idleRows, {
    searchKeys: ['user.first_name', 'user.last_name', 'user.employee_id', 'user.department'],
    initialSort: { key: '_idle', dir: 'desc' },
    pageSize: 10,
  });

  const active       = live?.active       || [];
  const idle         = live?.idle         || [];
  const onBreak      = live?.break        || [];
  const disconnected = live?.disconnected || [];
  const total        = active.length + idle.length + onBreak.length + disconnected.length;

  const alertedHighIdle     = useRef(new Set());
  const alertedDisconnected = useRef(new Set());

  useEffect(() => {
    if (!live) return;
    idle.forEach((u) => {
      if (u.idle_seconds >= HIGH_IDLE && !alertedHighIdle.current.has(u.user_id)) {
        alertedHighIdle.current.add(u.user_id);
        toast(`${u.first_name} ${u.last_name} has been idle for ${formatHMS(u.idle_seconds)}`, { icon:'⚠️', style:{ background:'rgba(248,113,113,0.15)', color:'#F87171', fontWeight:600, border:'1px solid rgba(248,113,113,0.3)' }, duration:6000 });
      }
    });
    disconnected.forEach((u) => {
      if (!alertedDisconnected.current.has(u.user_id)) {
        alertedDisconnected.current.add(u.user_id);
        toast(`${u.first_name} ${u.last_name} went offline`, { icon:'🔌', style:{ background:'rgba(255,255,255,0.06)', color:'rgba(241,245,249,0.8)', fontWeight:600, border:'1px solid rgba(255,255,255,0.12)' }, duration:6000 });
      }
    });
    active.forEach((u) => { alertedHighIdle.current.delete(u.user_id); alertedDisconnected.current.delete(u.user_id); });
  }, [live]);

  const STAT_CARDS = [
    { label:'Active',   count:active.length,       color:'#34D399', glow:'rgba(52,211,153,0.25)', gradient:'linear-gradient(135deg,#10B981,#34D399)', icon:<Activity size={18} color="white" /> },
    { label:'Idle',     count:idle.length,         color:'#F87171', glow:'rgba(248,113,113,0.25)', gradient:'linear-gradient(135deg,#EF4444,#F87171)', icon:<AlertTriangle size={18} color="white" /> },
    { label:'On Break', count:onBreak.length,      color:'#FBBF24', glow:'rgba(251,191,36,0.25)',  gradient:'linear-gradient(135deg,#F59E0B,#FBBF24)', icon:<Coffee size={18} color="white" /> },
    { label:'Offline',  count:disconnected.length, color:'#94A3B8', glow:'rgba(148,163,184,0.15)', gradient:'linear-gradient(135deg,#475569,#64748B)', icon:<WifiOff size={18} color="white" /> },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>Idle Monitor</h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Real-time agent status for all clocked-in employees</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:600, color:'#A78BFA' }}>
          <div style={{ width:'6px', height:'6px', background:'#A78BFA', borderRadius:'50%', animation:'pulse-glow 2s infinite' }} />
          LIVE · 30s refresh
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px' }}>
        {STAT_CARDS.map(({ label, count, color, glow, gradient, icon }) => (
          <div key={label} style={{ ...glass, padding:'22px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'100px', height:'100px', borderRadius:'50%', background:`radial-gradient(circle,${glow} 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:'1px', background:`linear-gradient(90deg,transparent,${color}60,transparent)` }} />
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px', position:'relative' }}>
              <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:gradient, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 6px 16px ${glow}` }}>{icon}</div>
            </div>
            <p style={{ fontSize:'34px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-2px', lineHeight:1, marginBottom:'4px', position:'relative' }}>{count}</p>
            <p style={{ fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.4)', textTransform:'uppercase', letterSpacing:'0.6px' }}>{label}</p>
            <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.25)', marginTop:'2px' }}>of {total} clocked in</p>
          </div>
        ))}
      </div>

      {/* Live status */}
      <div style={glassHi}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'14px', fontWeight:700, color:'#F1F5F9', letterSpacing:'-0.2px' }}>Live Agent Status</p>
            <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>All employees clocked in today — updated every 30 seconds</p>
          </div>
          {dataUpdatedAt && <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.25)' }}>Updated {timeSince(new Date(dataUpdatedAt))}</span>}
        </div>

        {total === 0 ? (
          <div style={{ padding:'48px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
            <CheckCircle2 size={36} color="rgba(52,211,153,0.5)" />
            <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.25)' }}>No employees have clocked in today</p>
          </div>
        ) : (
          <>
            {disconnected.length > 0 && (
              <div>
                <div style={{ padding:'8px 20px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <WifiOff size={11} /> Offline / Disconnected ({disconnected.length})
                  </p>
                  <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.2)', marginTop:'2px' }}>Clocked in but no agent heartbeat in 5+ minutes</p>
                </div>
                {disconnected.map((u) => <UserRow key={u.user_id} user={u} type="disconnected" />)}
              </div>
            )}
            {onBreak.length > 0 && (
              <div>
                <div style={{ padding:'8px 20px', background:'rgba(251,191,36,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'#FBBF24', textTransform:'uppercase', letterSpacing:'0.6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <Coffee size={11} /> On Break ({onBreak.length})
                  </p>
                  <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.2)', marginTop:'2px' }}>On an active break — idle time is not counted</p>
                </div>
                {onBreak.map((u) => <UserRow key={u.user_id} user={u} type="break" />)}
              </div>
            )}
            {idle.length > 0 && (
              <div>
                <div style={{ padding:'8px 20px', background:'rgba(248,113,113,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'#F87171', textTransform:'uppercase', letterSpacing:'0.6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <AlertTriangle size={11} /> Idle ({idle.length})
                  </p>
                  <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.2)', marginTop:'2px' }}>Agent online but no keyboard/mouse activity detected</p>
                </div>
                {idle.map((u) => <UserRow key={u.user_id} user={u} type="idle" />)}
              </div>
            )}
            {active.length > 0 && (
              <div>
                <div style={{ padding:'8px 20px', background:'rgba(52,211,153,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'#34D399', textTransform:'uppercase', letterSpacing:'0.6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <Activity size={11} /> Active ({active.length})
                  </p>
                  <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.2)', marginTop:'2px' }}>Agent sending regular heartbeats with active usage</p>
                </div>
                {active.map((u) => <UserRow key={u.user_id} user={u} type="active" />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Daily summary table */}
      <div style={glass}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize:'14px', fontWeight:700, color:'#F1F5F9', letterSpacing:'-0.2px' }}>Today's Idle Summary</p>
          <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>Aggregated idle time per employee</p>
        </div>
        <TableToolbar search={stc.search} setSearch={stc.setSearch} total={stc.total} placeholder="Search name, ID or department…" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <SortTh label="Employee"   sortKey="user.first_name" sort={stc.sort} toggleSort={stc.toggleSort} />
                <SortTh label="Department"  sortKey="user.department" sort={stc.sort} toggleSort={stc.toggleSort} />
                <SortTh label="Idle Events" sortKey="_events" sort={stc.sort} toggleSort={stc.toggleSort} />
                <SortTh label="Total Idle Time" sortKey="_idle" sort={stc.sort} toggleSort={stc.toggleSort} />
                <SortTh label="Total Break Time" sortKey="_break" sort={stc.sort} toggleSort={stc.toggleSort} />
                <th style={S.th}>Risk Level</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {!stc.total ? (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No idle data recorded today</td></tr>
              ) : (
                stc.view.map((row, i) => {
                  const secs      = row._idle;
                  const breakSecs = row._break;
                  const isHigh    = secs > HIGH_IDLE;
                  return (
                    <tr key={row.user?.id || i} style={{ transition:'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={S.td}>
                        <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{row.user?.first_name} {row.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'2px' }}>{row.user?.employee_id}</p>
                      </td>
                      <td style={S.td}>{row.user?.department || '—'}</td>
                      <td style={{ ...S.td, fontWeight:600 }}>{row._events}</td>
                      <td style={{ ...S.td, fontWeight:700, color: isHigh ? '#F87171' : '#34D399', fontVariantNumeric:'tabular-nums' }}>{formatHMS(secs)}</td>
                      <td style={{ ...S.td, fontWeight:700, color:'#FBBF24', fontVariantNumeric:'tabular-nums' }}>{formatHMS(breakSecs)}</td>
                      <td style={S.td}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background: isHigh ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', color: isHigh ? '#F87171' : '#34D399', border:`1px solid ${isHigh ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}` }}>
                          {isHigh ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                          {isHigh ? 'High' : 'Normal'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button onClick={() => setTimeline({ userId:row.user?.id, date:today, name:`${row.user?.first_name} ${row.user?.last_name}` })} style={{
                          display:'inline-flex', alignItems:'center', gap:'5px',
                          fontSize:'12px', fontWeight:700, color:'#A78BFA',
                          background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)',
                          cursor:'pointer', padding:'5px 12px', borderRadius:'7px', transition:'all 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(167,139,250,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background='rgba(167,139,250,0.1)'}>
                          <Clock size={12} /> Timeline
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={stc.page} pageCount={stc.pageCount} setPage={stc.setPage} total={stc.total} pageSize={stc.pageSize} />
      </div>

      {/* Historical report — daily / weekly / monthly / yearly, global / dept / employee */}
      <IdleHistoryReport />

      {timeline && <IdleTimelineModal userId={timeline.userId} date={timeline.date} name={timeline.name} onClose={() => setTimeline(null)} />}
    </div>
  );
}
