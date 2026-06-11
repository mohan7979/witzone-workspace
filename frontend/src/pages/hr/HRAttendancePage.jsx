import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { attendanceApi, userApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatTime, formatDuration, formatHMS, formatDate } from '@/lib/utils';
import { useTableControls, TableToolbar, SortTh, Pagination } from '@/components/ui/TableControls';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  input: {
    padding:'9px 12px 9px 34px', fontSize:'13px', background:'rgba(255,255,255,0.05)',
    border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9',
    outline:'none', fontFamily:'inherit', cursor:'pointer', transition:'all 0.2s',
  },
  select: {
    padding:'9px 14px', fontSize:'13px', background:'rgba(255,255,255,0.05)',
    border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9',
    outline:'none', fontFamily:'inherit', cursor:'pointer', transition:'all 0.2s',
  },
};

const FILTERS = [
  { key:'all',      label:'All'      },
  { key:'present',  label:'Present'  },
  { key:'absent',   label:'Absent'   },
  { key:'on_leave', label:'On Leave' },
  { key:'half_day', label:'Half Day' },
];

const today = new Date().toISOString().slice(0, 10);

export default function HRAttendancePage() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [date, setDate] = useState(today);
  const [department, setDepartment] = useState('');

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f) setFilter(f);
  }, [searchParams]);

  const { data: deptData } = useQuery({ queryKey:['departments'], queryFn:userApi.departments, staleTime:5*60*1000 });
  const departments = deptData?.departments || [];

  const { data, isLoading } = useQuery({
    queryKey: ['team-attendance', date, department],
    queryFn: () => attendanceApi.teamAttendance({ date, department, limit:100 }),
  });

  const isWeekend = data?.weekend === true;
  const rows = (data?.data || []).filter((row) => filter === 'all' ? true : row.status === filter);

  const tc = useTableControls(rows, {
    searchKeys: ['user.first_name', 'user.last_name', 'user.employee_id', 'user.department'],
    initialSort: { key: 'user.first_name', dir: 'asc' },
    pageSize: 12,
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            Team Attendance
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
            Daily clock-in/out records for your team
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:600, color:'#34D399' }}>
          <div style={{ width:'6px', height:'6px', background:'#34D399', borderRadius:'50%', animation:'pulse-glow 2s infinite' }} />
          Live records
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'center' }}>
        {/* Date picker */}
        <div style={{ position:'relative' }}>
          <Calendar size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'rgba(241,245,249,0.35)', pointerEvents:'none' }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input}
            onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }} />
        </div>

        {/* Department filter */}
        {departments.length > 0 && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={S.select}
            onFocus={e => e.target.style.borderColor='rgba(129,140,248,0.6)'}
            onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}>
            <option value="" style={{ background:'#0D1117' }}>All Departments</option>
            {departments.map((d) => <option key={d} value={d} style={{ background:'#0D1117' }}>{d}</option>)}
          </select>
        )}

        {/* Status filter tabs */}
        <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px' }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding:'6px 14px', fontSize:'12px', fontWeight:600,
              borderRadius:'9px', border:'none', cursor:'pointer',
              textTransform:'capitalize', transition:'all 0.15s',
              background: filter === f.key ? 'rgba(129,140,248,0.2)' : 'transparent',
              color: filter === f.key ? '#818CF8' : 'rgba(241,245,249,0.4)',
              boxShadow: filter === f.key ? '0 0 0 1px rgba(129,140,248,0.3)' : 'none',
              whiteSpace:'nowrap',
            }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Weekend notice */}
      {isWeekend && (
        <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'18px 22px', borderRadius:'14px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
          <span style={{ fontSize:'22px' }}>🏖️</span>
          <div>
            <p style={{ fontWeight:700, color:'#FBBF24', fontSize:'14px' }}>Weekend — Non-working day</p>
            <p style={{ color:'rgba(251,191,36,0.6)', fontSize:'12px', marginTop:'2px' }}>
              {formatDate(date)} is a weekend, so employees are off and never marked absent. Only those who actually
              worked (emergency / overtime) are listed below.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {(
        <div style={glass}>
          <TableToolbar search={tc.search} setSearch={tc.setSearch} total={tc.total} placeholder="Search name, ID or department…" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:'1080px', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <SortTh label="Employee"   sortKey="user.first_name" sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Department"  sortKey="user.department" sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Clock In"    sortKey="login_time"   sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Clock Out"   sortKey="logout_time"  sort={tc.sort} toggleSort={tc.toggleSort} />
                  <th style={S.th}>2nd In</th>
                  <th style={S.th}>2nd Out</th>
                  <SortTh label="Break"       sortKey="total_break_seconds" sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Idle"        sortKey="idle_seconds" sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Total Hrs"   sortKey="total_hours"  sort={tc.sort} toggleSort={tc.toggleSort} />
                  <SortTh label="Status"      sortKey="status"       sort={tc.sort} toggleSort={tc.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>
                )}
                {!isLoading && !tc.total && (
                  <tr><td colSpan={10} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>
                    {isWeekend ? `No employees worked on ${formatDate(date)}` : `No ${filter === 'all' ? '' : filter} records for ${formatDate(date)}`}
                  </td></tr>
                )}
                {tc.view.map((row) => (
                  <tr key={row.id || row.user_id}
                    style={{ transition:'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={S.td}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <Avatar user={row.user} size={32} glow="rgba(99,102,241,0.3)" fontSize="11px" />
                        <div>
                          <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{row.user?.first_name} {row.user?.last_name}</p>
                          <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)' }}>{row.user?.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}><span style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'3px 8px', fontSize:'12px' }}>{row.user?.department || '—'}</span></td>
                    <td style={{ ...S.td, fontWeight:600, color:'#34D399' }}>{formatTime(row.login_time)}</td>
                    <td style={{ ...S.td, color:'rgba(241,245,249,0.4)' }}>{formatTime(row.logout_time)}</td>
                    <td style={{ ...S.td, fontWeight:600, color: row.login_time_2 ? '#34D399' : 'rgba(241,245,249,0.25)' }}>{row.login_time_2 ? formatTime(row.login_time_2) : '—'}</td>
                    <td style={{ ...S.td, color:'rgba(241,245,249,0.4)' }}>{row.logout_time_2 ? formatTime(row.logout_time_2) : '—'}</td>
                    <td style={{ ...S.td, color: row.total_break_seconds > 0 ? '#FBBF24' : 'rgba(241,245,249,0.3)', fontVariantNumeric:'tabular-nums' }}>{formatHMS(row.total_break_seconds || 0)}</td>
                    <td style={{ ...S.td, color: (row.idle_seconds || 0) > 1800 ? '#F87171' : 'rgba(241,245,249,0.5)', fontVariantNumeric:'tabular-nums' }}>{row.login_time ? formatHMS(row.idle_seconds || 0) : '—'}</td>
                    <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{formatDuration(row.total_hours)}</td>
                    <td style={S.td}><Badge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={tc.page} pageCount={tc.pageCount} setPage={tc.setPage} total={tc.total} pageSize={tc.pageSize} />
        </div>
      )}
    </div>
  );
}
