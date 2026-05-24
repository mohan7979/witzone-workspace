import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, CalendarClock, ArrowUpRight, TrendingUp } from 'lucide-react';
import { reportApi, attendanceApi, leaveApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatTime } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const glass   = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' };
const glassHi = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '16px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' };

const STATS = [
  { label: 'Total Employees', key: 'total',   icon: Users,        color: '#818CF8', glow: 'rgba(129,140,248,0.25)', gradient: 'linear-gradient(135deg,#6366F1,#8B5CF6)', route: '/employees' },
  { label: 'Present Today',   key: 'present', icon: UserCheck,    color: '#34D399', glow: 'rgba(52,211,153,0.25)',  gradient: 'linear-gradient(135deg,#10B981,#34D399)', route: '/attendance' },
  { label: 'Absent Today',    key: 'absent',  icon: UserX,        color: '#F87171', glow: 'rgba(248,113,113,0.25)', gradient: 'linear-gradient(135deg,#EF4444,#F87171)', route: '/attendance' },
  { label: 'Pending Leaves',  key: 'pending', icon: CalendarClock,color: '#FBBF24', glow: 'rgba(251,191,36,0.25)',  gradient: 'linear-gradient(135deg,#F59E0B,#FBBF24)', route: '/leaves'     },
];

function StatCard({ cfg, value, sub, onClick }) {
  const Icon = cfg.icon;
  return (
    <div onClick={onClick} style={{ ...glass, padding: '22px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 20px 40px ${cfg.glow}`; e.currentTarget.style.borderColor = `${cfg.color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <div style={{ position:'absolute', top:'-30px', right:'-30px', width:'120px', height:'120px', borderRadius:'50%', background:`radial-gradient(circle,${cfg.glow} 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:'1px', background:`linear-gradient(90deg,transparent,${cfg.color}60,transparent)` }} />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'18px', position:'relative' }}>
        <div style={{ width:'46px', height:'46px', borderRadius:'13px', background:cfg.gradient, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 20px ${cfg.glow}` }}>
          <Icon size={20} color="white" />
        </div>
        <ArrowUpRight size={14} color="rgba(241,245,249,0.2)" />
      </div>
      <p style={{ fontSize:'36px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-2px', lineHeight:1, marginBottom:'6px', position:'relative' }}>{value ?? '—'}</p>
      <p style={{ fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.45)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'2px' }}>{cfg.label}</p>
      <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.28)' }}>{sub}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(10,14,26,0.95)', borderRadius:'12px', padding:'10px 16px', fontSize:'12px', color:'#F1F5F9', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(10px)' }}>
      <p style={{ fontWeight:600, marginBottom:'4px', color:'rgba(241,245,249,0.6)' }}>{label}</p>
      <p style={{ color:'#818CF8', fontWeight:700 }}>{payload[0]?.value} employees</p>
    </div>
  );
};

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

export default function HRDashboard() {
  const navigate = useNavigate();
  const { data: stats }         = useQuery({ queryKey:['dashboard-stats'],       queryFn: reportApi.dashboard,                              refetchInterval:30000 });
  const { data: teamAtt }       = useQuery({ queryKey:['team-attendance-today'], queryFn:() => attendanceApi.teamAttendance({ limit:8 }), refetchInterval:30000 });
  const { data: pendingLeaves } = useQuery({ queryKey:['pending-leaves'],        queryFn:() => leaveApi.pending({ limit:6 }),             refetchInterval:30000 });

  const total   = stats?.total_employees || 0;
  const present = stats?.present_today   || 0;
  const absent  = stats?.absent_today    || 0;
  const pending = stats?.pending_leaves  || 0;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  const chartData = [
    { name:'Present',  count:present },
    { name:'Absent',   count:absent  },
    { name:'On Leave', count:0       },
  ];
  const statValues = { total, present, absent, pending };
  const statSubs   = { total:'Active accounts', present:`${pct}% attendance rate`, absent:`${total-present} not clocked in`, pending:'Awaiting approval' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Heading */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            Good {greeting} 👋
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Here's what's happening with your workforce today.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:600, color:'#34D399' }}>
          <div style={{ width:'6px', height:'6px', background:'#34D399', borderRadius:'50%', animation:'pulse-glow 2s infinite' }} />
          Live · auto-refresh
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px' }}>
        {STATS.map(cfg => <StatCard key={cfg.key} cfg={cfg} value={statValues[cfg.key]} sub={statSubs[cfg.key]} onClick={() => navigate(cfg.route)} />)}
      </div>

      {/* Middle row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'16px' }}>

        {/* Chart */}
        <div style={glassHi}>
          <div style={{ padding:'20px 22px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:'14px', fontWeight:700, color:'#F1F5F9', letterSpacing:'-0.2px' }}>Attendance Overview</p>
              <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>Today's workforce breakdown</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:'8px', padding:'5px 10px' }}>
              <TrendingUp size={12} color="#818CF8" />
              <span style={{ fontSize:'11px', color:'#818CF8', fontWeight:600 }}>{pct}% present</span>
            </div>
          </div>
          <div style={{ padding:'20px' }}>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                <defs>
                  <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818CF8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'rgba(241,245,249,0.3)', fontWeight:500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'rgba(241,245,249,0.2)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke:'rgba(255,255,255,0.06)', strokeWidth:1 }} />
                <Area type="monotone" dataKey="count" stroke="#818CF8" strokeWidth={2.5} fill="url(#glassGrad)" dot={{ fill:'#818CF8', strokeWidth:0, r:4 }} activeDot={{ r:6, fill:'#818CF8' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending */}
        <div style={glassHi}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9' }}>Pending Approvals</p>
            <a href="/leaves" style={{ fontSize:'11px', color:'#F472B6', textDecoration:'none', fontWeight:600, display:'flex', alignItems:'center', gap:'2px' }}>View all <ArrowUpRight size={11} /></a>
          </div>
          <div>
            {!pendingLeaves?.data?.length ? (
              <div style={{ padding:'40px 20px', textAlign:'center' }}>
                <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.2)' }}>No pending requests</p>
              </div>
            ) : pendingLeaves.data.map((leave) => (
              <div key={leave.id} style={{ padding:'11px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                  <div style={{ width:'30px', height:'30px', borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#F472B6,#EC4899)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'10px', fontWeight:700, boxShadow:'0 0 12px rgba(244,114,182,0.3)' }}>
                    {leave.user?.first_name?.[0]}{leave.user?.last_name?.[0]}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:'12px', fontWeight:600, color:'#F1F5F9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{leave.user?.first_name} {leave.user?.last_name}</p>
                    <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', textTransform:'capitalize' }}>{leave.type} · {leave.duration_days}d</p>
                  </div>
                </div>
                <Badge status="pending" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div style={glassHi}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize:'14px', fontWeight:700, color:'#F1F5F9', letterSpacing:'-0.2px' }}>Today's Attendance</p>
          <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>Live clock-in records</p>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Employee','Department','Clock In','Clock Out','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!teamAtt?.data?.length ? (
                <tr><td colSpan={5} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No attendance records yet today</td></tr>
              ) : teamAtt.data.map((row) => (
                <tr key={row.id} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={{ transition:'background 0.12s' }}>
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:700, flexShrink:0, boxShadow:'0 0 10px rgba(99,102,241,0.3)' }}>
                        {row.user?.first_name?.[0]}{row.user?.last_name?.[0]}
                      </div>
                      <div>
                        <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{row.user?.first_name} {row.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)' }}>{row.user?.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={S.td}><span style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'3px 8px', fontSize:'12px' }}>{row.user?.department ?? '—'}</span></td>
                  <td style={{ ...S.td, fontWeight:600, color:'#34D399' }}>{formatTime(row.login_time)}</td>
                  <td style={{ ...S.td, color:'rgba(241,245,249,0.4)' }}>{formatTime(row.logout_time)}</td>
                  <td style={S.td}><Badge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
