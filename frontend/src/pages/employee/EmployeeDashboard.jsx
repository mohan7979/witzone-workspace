import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, CalendarCheck, Clock, TrendingUp, Timer, CheckCircle2, Zap } from 'lucide-react';
import { attendanceApi, leaveApi, idleApi, authApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatTime, formatDuration, formatDate, formatIdleTime } from '@/lib/utils';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };
const glassHi = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'16px', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' };

const S = {
  th: { padding:'10px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'12px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

const BALANCE_CARDS = [
  { key:'casual_leave_balance',  label:'Casual Leave',  suffix:'d', color:'#818CF8', glow:'rgba(129,140,248,0.3)', gradient:'linear-gradient(135deg,#6366F1,#8B5CF6)', icon:CalendarCheck },
  { key:'sick_leave_balance',    label:'Sick Leave',    suffix:'d', color:'#34D399', glow:'rgba(52,211,153,0.3)',  gradient:'linear-gradient(135deg,#10B981,#34D399)', icon:Clock         },
  { key:'comp_off_balance',      label:'Comp Off',      suffix:'d', color:'#F472B6', glow:'rgba(244,114,182,0.3)',gradient:'linear-gradient(135deg,#EC4899,#F472B6)', icon:TrendingUp    },
];

function BalanceCard({ label, value, color, glow, gradient, icon: Icon }) {
  return (
    <div style={{ ...glass, padding:'20px', position:'relative', overflow:'hidden', transition:'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 16px 32px ${glow}`; e.currentTarget.style.borderColor=`${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; }}
    >
      <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:'1px', background:`linear-gradient(90deg,transparent,${color}60,transparent)` }} />
      <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', borderRadius:'50%', background:`radial-gradient(circle,${glow} 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:gradient, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'14px', boxShadow:`0 6px 16px ${glow}` }}>
        <Icon size={16} color="white" />
      </div>
      <p style={{ fontSize:'28px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-1px', lineHeight:1, marginBottom:'4px' }}>{value}</p>
      <p style={{ fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.4)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</p>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    authApi.me().then((res) => { if (res?.user) updateUser(res.user); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toISOString().split('T')[0];

  const { data: todayData } = useQuery({ queryKey:['attendance-today'], queryFn:attendanceApi.today, refetchInterval:60000 });
  const { data: leaveData } = useQuery({ queryKey:['my-leaves'],        queryFn:() => leaveApi.myLeaves({ limit:5 }) });

  const att = todayData?.attendance;
  const isClockedIn  = !!att?.login_time && !att?.logout_time;
  const isClockedOut = !!att?.logout_time;

  const { data: idleData } = useQuery({ queryKey:['my-idle-today', today], queryFn:() => idleApi.mySummary({ date:today }), enabled:isClockedIn, refetchInterval:60000 });

  const clockIn  = useMutation({ mutationFn:attendanceApi.clockIn,  onSuccess:() => { toast.success('Clocked in');  qc.invalidateQueries(['attendance-today']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });
  const clockOut = useMutation({ mutationFn:attendanceApi.clockOut, onSuccess:() => { toast.success('Clocked out'); qc.invalidateQueries(['attendance-today']); qc.invalidateQueries(['my-idle-today']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });

  const hoursWorked = isClockedIn ? ((now - new Date(att.login_time)) / 3600000).toFixed(1) : att?.total_hours || 0;
  const idleSeconds = isClockedOut ? (att?.idle_seconds || 0) : (idleData?.total_idle_seconds || 0);
  const effectiveHours = isClockedOut ? (att?.effective_hours || att?.total_hours || 0) : Math.max(0, hoursWorked - idleSeconds / 3600).toFixed(1);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Heading */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            {greeting}, {user?.first_name} 👋
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
            {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:'7px',
          background: isClockedIn ? 'rgba(52,211,153,0.1)' : isClockedOut ? 'rgba(255,255,255,0.05)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${isClockedIn ? 'rgba(52,211,153,0.3)' : isClockedOut ? 'rgba(255,255,255,0.1)' : 'rgba(251,191,36,0.3)'}`,
          borderRadius:'20px', padding:'7px 14px',
          fontSize:'12px', fontWeight:600,
          color: isClockedIn ? '#34D399' : isClockedOut ? 'rgba(241,245,249,0.5)' : '#FBBF24',
        }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:isClockedIn ? '#34D399' : isClockedOut ? 'rgba(241,245,249,0.3)' : '#FBBF24', animation: isClockedIn ? 'pulse-glow 2s infinite' : 'none' }} />
          {isClockedIn ? 'Active shift' : isClockedOut ? 'Shift ended' : 'Not clocked in'}
        </div>
      </div>

      {/* Hero Clock Card */}
      <div style={{
        borderRadius:'20px', padding:'28px 32px',
        background:`linear-gradient(135deg, rgba(12,18,50,0.9) 0%, rgba(30,27,75,0.9) 100%)`,
        border:'1px solid rgba(99,102,241,0.2)',
        backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
        boxShadow:'0 20px 60px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px',
        position:'relative', overflow:'hidden',
      }}>
        {/* Glow orbs inside card */}
        <div style={{ position:'absolute', top:'-40px', left:'-40px', width:'200px', height:'200px', borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-30px', right:'80px', width:'150px', height:'150px', borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)', pointerEvents:'none' }} />
        {/* Top shimmer line */}
        <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)' }} />

        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <Zap size={11} color="#818CF8" fill="#818CF8" />
            <p style={{ fontSize:'10px', fontWeight:700, color:'rgba(129,140,248,0.7)', textTransform:'uppercase', letterSpacing:'1px' }}>Today's Attendance</p>
          </div>
          <p style={{ fontSize:'28px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1, marginBottom:'10px' }}>
            {isClockedIn ? 'On Shift' : isClockedOut ? 'Completed' : 'Not Started'}
          </p>
          {att?.login_time && (
            <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.5)' }}>
              In: <span style={{ color:'#F1F5F9', fontWeight:600 }}>{formatTime(att.login_time)}</span>
              {att.logout_time ? (
                <>
                  {' · '}Out: <span style={{ color:'#F1F5F9', fontWeight:600 }}>{formatTime(att.logout_time)}</span>
                  {' · '}<span style={{ color:'#818CF8' }}>{formatDuration(att.total_hours)} total</span>
                  {idleSeconds > 0 && <>{' · '}<span style={{ color:'#F87171' }}>{formatIdleTime(idleSeconds)} idle</span>{' · '}<span style={{ color:'#34D399' }}>{formatDuration(effectiveHours)} effective</span></>}
                </>
              ) : (
                <>
                  {' · '}<span style={{ color:'#818CF8' }}>{hoursWorked}h elapsed</span>
                  {idleSeconds > 0 && <>{' · '}<span style={{ color:'#F87171' }}>{formatIdleTime(idleSeconds)} idle</span></>}
                </>
              )}
            </p>
          )}
          {!att?.login_time && (
            <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)' }}>
              Shift starts at <span style={{ color:'#818CF8' }}>{user?.shift_start?.slice(0,5) ?? '09:00'}</span>
            </p>
          )}
        </div>

        <div>
          {!isClockedIn && !isClockedOut && (
            <button onClick={() => clockIn.mutate()} disabled={clockIn.isPending} style={{
              display:'inline-flex', alignItems:'center', gap:'8px',
              padding:'13px 28px',
              background:'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color:'white', fontSize:'14px', fontWeight:700, borderRadius:'12px', border:'none',
              cursor:clockIn.isPending ? 'not-allowed' : 'pointer',
              boxShadow:'0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              opacity:clockIn.isPending ? 0.7 : 1, transition:'all 0.2s',
            }}
              onMouseEnter={e => { if (!clockIn.isPending) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; }}
            >
              <LogIn size={16} /> Clock In
            </button>
          )}
          {isClockedIn && (
            <button onClick={() => clockOut.mutate()} disabled={clockOut.isPending} style={{
              display:'inline-flex', alignItems:'center', gap:'8px',
              padding:'13px 28px',
              background:'linear-gradient(135deg, #EF4444, #F87171)',
              color:'white', fontSize:'14px', fontWeight:700, borderRadius:'12px', border:'none',
              cursor:clockOut.isPending ? 'not-allowed' : 'pointer',
              boxShadow:'0 8px 24px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              opacity:clockOut.isPending ? 0.7 : 1, transition:'all 0.2s',
            }}>
              <LogOut size={16} /> Clock Out
            </button>
          )}
          {isClockedOut && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'13px 22px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'12px', color:'#34D399', fontSize:'14px', fontWeight:600 }}>
              <CheckCircle2 size={16} />
              {formatDuration(effectiveHours)} effective
            </div>
          )}
        </div>
      </div>

      {/* Balance Cards + Effective Hours */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px' }}>
        {BALANCE_CARDS.map(c => (
          <BalanceCard key={c.key} label={c.label} value={`${user?.[c.key] ?? 0}${c.suffix}`} color={c.color} glow={c.glow} gradient={c.gradient} icon={c.icon} />
        ))}
        <BalanceCard label="Effective Hrs" value={`${effectiveHours}h`} color="#FBBF24" glow="rgba(251,191,36,0.3)" gradient="linear-gradient(135deg,#F59E0B,#FBBF24)" icon={Timer} />
      </div>

      {/* Recent Leave Requests */}
      <div style={glassHi}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9', letterSpacing:'-0.1px' }}>Recent Leave Requests</p>
            <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>Your last 5 applications</p>
          </div>
          <a href="/leaves" style={{ fontSize:'12px', color:'#818CF8', textDecoration:'none', fontWeight:600 }}>View all →</a>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Type','Period','Duration','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!leaveData?.data?.length ? (
                <tr><td colSpan={4} style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No leave requests yet</td></tr>
              ) : leaveData.data.map((leave) => (
                <tr key={leave.id}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  style={{ transition:'background 0.12s' }}
                >
                  <td style={{ ...S.td, fontWeight:600, textTransform:'capitalize', color:'#F1F5F9' }}>{leave.type}</td>
                  <td style={{ ...S.td, fontSize:'12px' }}>{formatDate(leave.start_date)}{leave.start_date !== leave.end_date ? ` — ${formatDate(leave.end_date)}` : ''}</td>
                  <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{leave.duration_days}d</td>
                  <td style={S.td}><Badge status={leave.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
