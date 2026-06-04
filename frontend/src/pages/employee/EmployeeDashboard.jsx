import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Clock, TrendingUp, Timer } from 'lucide-react';
import { leaveApi, idleApi, authApi } from '@/api';
import Badge from '@/components/ui/Badge';
import ClockWidget from '@/components/ui/ClockWidget';
import { formatDuration, formatDate, formatIdleTime } from '@/lib/utils';
import useAuthStore from '@/store/authStore';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };
const glassHi = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'16px', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' };

const S = {
  th: { padding:'10px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'12px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

const BALANCE_CARDS = [
  { key:'casual_leave_balance',  label:'Claimed Leave', suffix:'d', color:'#818CF8', glow:'rgba(129,140,248,0.3)', gradient:'linear-gradient(135deg,#6366F1,#8B5CF6)', icon:CalendarCheck },
  { key:'sick_leave_balance',    label:'Sick Leave',     suffix:'d', color:'#34D399', glow:'rgba(52,211,153,0.3)',  gradient:'linear-gradient(135deg,#10B981,#34D399)', icon:Clock         },
  { key:'comp_off_balance',      label:'Comp Off',       suffix:'d', color:'#F472B6', glow:'rgba(244,114,182,0.3)',gradient:'linear-gradient(135deg,#EC4899,#F472B6)', icon:TrendingUp    },
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

  useEffect(() => {
    authApi.me().then((res) => { if (res?.user) updateUser(res.user); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toISOString().split('T')[0];

  const { data: todayData } = useQuery({ queryKey:['attendance-today'], queryFn:() => import('@/api').then(m => m.attendanceApi.today()), refetchInterval:60000 });
  const { data: leaveData } = useQuery({ queryKey:['my-leaves'],        queryFn:() => leaveApi.myLeaves({ limit:5 }) });

  const att = todayData?.attendance;
  const isActive = todayData?.state === 'session1_active' || todayData?.state === 'session2_active';

  const { data: idleData } = useQuery({ queryKey:['my-idle-today', today], queryFn:() => idleApi.mySummary({ date:today }), enabled:isActive, refetchInterval:60000 });

  const idleSeconds    = att?.idle_seconds || (idleData?.total_idle_seconds || 0);
  const effectiveHours = att?.effective_hours || att?.total_hours || 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Heading */}
      <div>
        <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
          {greeting}, {user?.first_name} 👋
        </h1>
        <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
          {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
        </p>
      </div>

      {/* Clock Widget */}
      <ClockWidget />

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
