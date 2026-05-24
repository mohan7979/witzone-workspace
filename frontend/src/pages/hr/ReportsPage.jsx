import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reportApi, userApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatDate, formatDuration, formatIdleTime } from '@/lib/utils';

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  dateInput: {
    padding:'8px 12px', fontSize:'13px', background:'rgba(255,255,255,0.05)',
    border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px',
    color:'#F1F5F9', outline:'none', transition:'all 0.2s', fontFamily:'inherit',
  },
};

const TABS = [
  { key:'attendance', label:'Attendance', color:'#818CF8' },
  { key:'leaves',     label:'Leaves',     color:'#F472B6' },
  { key:'idle',       label:'Idle Time',  color:'#A78BFA' },
];

function downloadCSV(data, filename) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map((row) => keys.map((k) => `"${row[k] ?? ''}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
  a.download = filename;
  a.click();
}

const LEAVE_TYPES  = ['casual','sick','comp_off','permission','unpaid'];
const LEAVE_STATUS = ['pending','approved','rejected','cancelled'];

const selectStyle = {
  padding:'7px 28px 7px 10px', fontSize:'12px', fontWeight:500,
  border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px',
  background:'rgba(255,255,255,0.05)', color:'rgba(241,245,249,0.7)', outline:'none',
  cursor:'pointer', appearance:'none',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center',
  transition:'all 0.2s',
};

export default function ReportsPage() {
  const [tab, setTab]       = useState('attendance');
  const [range, setRange]   = useState({ start:new Date(new Date().setDate(1)).toISOString().split('T')[0], end:new Date().toISOString().split('T')[0] });
  const [filters, setFilters] = useState({ department:'', employee:'', leaveType:'', leaveStatus:'', riskLevel:'' });

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]:val }));

  const { data:deptData }  = useQuery({ queryKey:['departments'], queryFn:userApi.departments, staleTime:5*60*1000 });
  const departments        = deptData?.departments || [];
  const { data:empData }   = useQuery({ queryKey:['report-employees'], queryFn:() => userApi.list({ limit:200 }) });
  const employeeOptions    = (empData?.data || []).filter(u => !filters.department || u.department === filters.department);

  const attParams   = { ...range, ...(filters.department && { department:filters.department }), ...(filters.employee && { user_id:filters.employee }) };
  const leaveParams = { ...range, ...(filters.department && { department:filters.department }), ...(filters.employee && { user_id:filters.employee }), ...(filters.leaveType && { type:filters.leaveType }), ...(filters.leaveStatus && { status:filters.leaveStatus }) };
  const idleParams  = { ...range, ...(filters.department && { department:filters.department }), ...(filters.employee && { user_id:filters.employee }) };

  const attReport   = useQuery({ queryKey:['report-attendance', attParams],  queryFn:() => reportApi.attendance(attParams),  enabled:tab==='attendance' });
  const leaveReport = useQuery({ queryKey:['report-leaves', leaveParams],    queryFn:() => reportApi.leaves(leaveParams),    enabled:tab==='leaves'     });
  const idleReport  = useQuery({ queryKey:['report-idle', idleParams],       queryFn:() => reportApi.idle(idleParams),       enabled:tab==='idle'       });

  const activeTab = TABS.find(t => t.key === tab);

  const ExportBtn = ({ onClick }) => (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:'6px',
      padding:'9px 18px', fontSize:'12px', fontWeight:700,
      background:'linear-gradient(135deg,#6366F1,#8B5CF6)', color:'white', border:'none',
      borderRadius:'10px', cursor:'pointer', boxShadow:'0 4px 16px rgba(99,102,241,0.35)', transition:'all 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.45)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(99,102,241,0.35)'; }}>
      <Download size={13} /> Export CSV
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>Reports</h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Detailed workforce analytics and exports</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <input type="date" value={range.start} onChange={(e) => setRange({ ...range, start:e.target.value })} style={S.dateInput}
            onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }} />
          <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.3)', fontWeight:600 }}>to</span>
          <input type="date" value={range.end} onChange={(e) => setRange({ ...range, end:e.target.value })} style={S.dateInput}
            onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px', width:'fit-content' }}>
        {TABS.map(({ key, label, color }) => (
          <button key={key} onClick={() => { setTab(key); setFilters({ department:'', employee:'', leaveType:'', leaveStatus:'', riskLevel:'' }); }} style={{
            padding:'8px 20px', fontSize:'13px', fontWeight:600,
            background: tab === key ? `rgba(${color==='#818CF8'?'129,140,248':color==='#F472B6'?'244,114,182':'167,139,250'},0.15)` : 'transparent',
            border:'none', cursor:'pointer',
            borderRadius:'9px',
            color: tab === key ? color : 'rgba(241,245,249,0.4)',
            boxShadow: tab === key ? `0 0 0 1px ${color}50` : 'none',
            transition:'all 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ ...glass, padding:'14px 18px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.25)', textTransform:'uppercase', letterSpacing:'1px', marginRight:'4px' }}>Filters</span>

        <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department:e.target.value, employee:'' }))} style={selectStyle}
          onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
          <option value="" style={{ background:'#0D1117' }}>All Departments</option>
          {departments.map(d => <option key={d} value={d} style={{ background:'#0D1117' }}>{d}</option>)}
        </select>

        <select value={filters.employee} onChange={e => setFilter('employee', e.target.value)} style={{ ...selectStyle, minWidth:'160px' }}
          onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
          <option value="" style={{ background:'#0D1117' }}>All Employees</option>
          {employeeOptions.map(u => <option key={u.id} value={u.id} style={{ background:'#0D1117' }}>{u.first_name} {u.last_name} ({u.employee_id})</option>)}
        </select>

        {tab === 'leaves' && (
          <>
            <select value={filters.leaveType} onChange={e => setFilter('leaveType', e.target.value)} style={selectStyle}
              onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
              <option value="" style={{ background:'#0D1117' }}>All Types</option>
              {LEAVE_TYPES.map(t => <option key={t} value={t} style={{ background:'#0D1117' }}>{t.replace('_',' ')}</option>)}
            </select>
            <select value={filters.leaveStatus} onChange={e => setFilter('leaveStatus', e.target.value)} style={selectStyle}
              onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
              <option value="" style={{ background:'#0D1117' }}>All Status</option>
              {LEAVE_STATUS.map(s => <option key={s} value={s} style={{ background:'#0D1117' }}>{s}</option>)}
            </select>
          </>
        )}

        {tab === 'idle' && (
          <select value={filters.riskLevel} onChange={e => setFilter('riskLevel', e.target.value)} style={selectStyle}
            onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
            <option value="" style={{ background:'#0D1117' }}>All Risk Levels</option>
            <option value="high"   style={{ background:'#0D1117' }}>High Only</option>
            <option value="normal" style={{ background:'#0D1117' }}>Normal Only</option>
          </select>
        )}

        {Object.values(filters).some(Boolean) && (
          <>
            <button onClick={() => setFilters({ department:'', employee:'', leaveType:'', leaveStatus:'', riskLevel:'' })} style={{
              padding:'6px 12px', fontSize:'11px', fontWeight:700,
              background:'rgba(248,113,113,0.1)', color:'#F87171',
              border:'1px solid rgba(248,113,113,0.25)', borderRadius:'7px', cursor:'pointer',
            }}>✕ Clear</button>
            <span style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, background:`rgba(${activeTab?.color==='#818CF8'?'129,140,248':'99,102,241'},0.15)`, color:activeTab?.color, border:`1px solid ${activeTab?.color}40` }}>
              {Object.values(filters).filter(Boolean).length} filter{Object.values(filters).filter(Boolean).length > 1 ? 's' : ''} active
            </span>
          </>
        )}
      </div>

      {/* Attendance Report */}
      {tab === 'attendance' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ExportBtn onClick={() => downloadCSV(attReport.data?.data?.map(r => ({ employee:`${r.user?.first_name} ${r.user?.last_name}`, department:r.user?.department, present:r.present_days, absent:r.absent_days, half_day:r.half_days, on_leave:r.leave_days, total_hours:r.total_hours, idle_minutes:Math.round((r.total_idle_seconds||0)/60), effective_hours:r.effective_hours })), 'attendance_report.csv')} />
          </div>
          <div style={glass}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
                <thead><tr>{['Employee','Department','Present','Absent','Half Day','On Leave','Total Hours','Idle Time','Effective Hrs'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {attReport.isLoading && <tr><td colSpan={9} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
                  {!attReport.isLoading && !attReport.data?.data?.length && <tr><td colSpan={9} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No data for selected range</td></tr>}
                  {attReport.data?.data?.map((row) => {
                    const idleSec = parseInt(row.total_idle_seconds || 0);
                    return (
                      <tr key={row.user_id} style={{ transition:'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{row.user?.first_name} {row.user?.last_name}</td>
                        <td style={S.td}>{row.user?.department || '—'}</td>
                        <td style={{ ...S.td, fontWeight:700, color:'#34D399' }}>{row.present_days || 0}</td>
                        <td style={{ ...S.td, fontWeight:700, color:'#F87171' }}>{row.absent_days || 0}</td>
                        <td style={{ ...S.td, color:'#FBBF24' }}>{row.half_days || 0}</td>
                        <td style={{ ...S.td, color:'#60A5FA' }}>{row.leave_days || 0}</td>
                        <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{formatDuration(row.total_hours)}</td>
                        <td style={{ ...S.td, color: idleSec > 0 ? '#F87171' : 'rgba(241,245,249,0.3)', fontWeight: idleSec > 0 ? 700 : 400 }}>{idleSec > 0 ? formatIdleTime(idleSec) : '—'}</td>
                        <td style={{ ...S.td, fontWeight:700, color:'#818CF8' }}>{formatDuration(row.effective_hours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Leave Report */}
      {tab === 'leaves' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ExportBtn onClick={() => downloadCSV(leaveReport.data?.data?.map(r => ({ employee:`${r.user?.first_name} ${r.user?.last_name}`, department:r.user?.department, type:r.type, start:r.start_date, end:r.end_date, days:r.duration_days, status:r.status })), 'leave_report.csv')} />
          </div>
          <div style={glass}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
                <thead><tr>{['Employee','Type','From','To','Days','Status','Reviewed By'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {leaveReport.isLoading && <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
                  {!leaveReport.isLoading && !leaveReport.data?.data?.length && <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No data for selected range</td></tr>}
                  {leaveReport.data?.data?.map((row) => (
                    <tr key={row.id} style={{ transition:'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={S.td}>
                        <p style={{ fontWeight:600, color:'#F1F5F9' }}>{row.user?.first_name} {row.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)' }}>{row.user?.department}</p>
                      </td>
                      <td style={{ ...S.td, textTransform:'capitalize' }}>{row.type}</td>
                      <td style={{ ...S.td, fontSize:'12px' }}>{formatDate(row.start_date)}</td>
                      <td style={{ ...S.td, fontSize:'12px' }}>{formatDate(row.end_date)}</td>
                      <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{row.duration_days}</td>
                      <td style={S.td}><Badge status={row.status} /></td>
                      <td style={S.td}>{row.reviewer ? `${row.reviewer.first_name} ${row.reviewer.last_name}` : <span style={{ color:'rgba(241,245,249,0.2)' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Idle Report */}
      {tab === 'idle' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ExportBtn onClick={() => downloadCSV(idleReport.data?.data?.map(r => ({ employee:`${r.user?.first_name} ${r.user?.last_name}`, department:r.user?.department, date:r.date, idle_minutes:Math.round((r.total_idle_seconds||0)/60), idle_events:r.idle_events })), 'idle_report.csv')} />
          </div>
          <div style={glass}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
                <thead><tr>{['Employee','Date','Idle Events','Total Idle','Risk Level'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {idleReport.isLoading && <tr><td colSpan={5} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
                  {!idleReport.isLoading && !idleReport.data?.data?.length && <tr><td colSpan={5} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No data for selected range</td></tr>}
                  {idleReport.data?.data?.filter(row => {
                    const secs = parseInt(row.total_idle_seconds || 0);
                    if (filters.riskLevel === 'high')   return secs > 1800;
                    if (filters.riskLevel === 'normal') return secs <= 1800;
                    return true;
                  }).map((row, i) => {
                    const totalSec = parseInt(row.total_idle_seconds || 0);
                    const isHigh   = totalSec > 1800;
                    return (
                      <tr key={i} style={{ transition:'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{row.user?.first_name} {row.user?.last_name}</td>
                        <td style={{ ...S.td, fontSize:'12px' }}>{formatDate(row.date)}</td>
                        <td style={S.td}>{row.idle_events || 0}</td>
                        <td style={{ ...S.td, fontWeight:700, color: isHigh ? '#F87171' : '#34D399' }}>{formatIdleTime(totalSec)}</td>
                        <td style={S.td}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background: isHigh ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', color: isHigh ? '#F87171' : '#34D399', border:`1px solid ${isHigh ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}` }}>
                            {isHigh ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                            {isHigh ? 'High' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
