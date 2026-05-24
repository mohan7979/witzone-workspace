import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatDate, formatTime, formatDuration, formatIdleTime } from '@/lib/utils';

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

export default function AttendancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => attendanceApi.myHistory({ limit:60 }),
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div>
        <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
          My Attendance
        </h1>
        <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
          Your clock-in/out history and attendance records
        </p>
      </div>

      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Date','Clock In','Clock Out','Total Hours','Idle Time','Effective Hrs','Status'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading records…</td></tr>
              )}
              {!isLoading && !data?.data?.length && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No attendance records found</td></tr>
              )}
              {data?.data?.map((row) => {
                const idleSec = row.idle_seconds || 0;
                const hasClocked = !!row.logout_time;
                return (
                  <tr key={row.id}
                    style={{ transition:'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{formatDate(row.date)}</td>
                    <td style={{ ...S.td, fontWeight:600, color:'#34D399' }}>{formatTime(row.login_time)}</td>
                    <td style={{ ...S.td, color:'rgba(241,245,249,0.4)' }}>{formatTime(row.logout_time)}</td>
                    <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{formatDuration(row.total_hours)}</td>
                    <td style={{ ...S.td, color: idleSec > 1800 ? '#F87171' : 'rgba(241,245,249,0.4)', fontWeight: idleSec > 1800 ? 700 : 400 }}>
                      {hasClocked ? formatIdleTime(idleSec) : '—'}
                    </td>
                    <td style={{ ...S.td, fontWeight:700, color:'#818CF8' }}>
                      {hasClocked ? formatDuration(row.effective_hours) : '—'}
                    </td>
                    <td style={S.td}><Badge status={row.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
