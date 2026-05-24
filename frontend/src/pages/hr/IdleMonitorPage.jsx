import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import { idleApi } from '@/api';
import { formatIdleTime, formatTime } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, WifiOff, Activity, Clock, X } from 'lucide-react';
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
    return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  };

  const timeline  = data?.timeline || [];
  const totalWork = timeline.filter(t => t.type === 'work').reduce((s, t) => s + t.duration_minutes, 0);
  const totalIdle = timeline.filter(t => t.type === 'idle').reduce((s, t) => s + t.duration_minutes, 0);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'560px', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>

        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)', flexShrink:0 }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <div>
            <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Idle Timeline — {name}</p>
            <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>{date}</p>
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
                  { icon:null, label:`Work: ${totalWork}m`, bg:'rgba(52,211,153,0.15)', color:'#34D399', border:'rgba(52,211,153,0.3)' },
                  { icon:null, label:`Idle: ${formatIdleTime(totalIdle * 60)}`, bg:'rgba(248,113,113,0.15)', color:'#F87171', border:'rgba(248,113,113,0.3)' },
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
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color: isIdle ? '#F87171' : '#34D399' }}>
                              {isIdle ? 'Idle' : 'Working'}
                            </span>
                            <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', fontWeight:600 }}>{entry.duration_minutes}m</span>
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
  const gradients = { disconnected:'linear-gradient(135deg,#334155,#475569)', idle:'linear-gradient(135deg,#EF4444,#F87171)', active:'linear-gradient(135deg,#10B981,#34D399)' };

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0, background:gradients[type], display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:700, boxShadow:`0 0 12px rgba(${type==='active'?'52,211,153':type==='idle'?'248,113,113':'148,163,184'},0.3)` }}>
          {user.first_name?.[0]}{user.last_name?.[0]}
        </div>
        <div>
          <p style={{ fontSize:'13px', fontWeight:600, color:'#F1F5F9' }}>{user.first_name} {user.last_name}</p>
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
        {type === 'idle' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, background:'rgba(248,113,113,0.15)', color:'#F87171', border:'1px solid rgba(248,113,113,0.3)' }}>
            <AlertTriangle size={11} /> {formatIdleTime(user.idle_seconds)} idle
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

export default function IdleMonitorPage() {
  const [timeline, setTimeline] = useState(null);

  const { data:live, dataUpdatedAt } = useQuery({ queryKey:['idle-live'], queryFn:idleApi.live, refetchInterval:30000 });

  const today = new Date().toISOString().split('T')[0];
  const { data:team } = useQuery({ queryKey:['idle-team', today], queryFn:() => idleApi.teamSummary({ date:today }) });

  const active       = live?.active       || [];
  const idle         = live?.idle         || [];
  const disconnected = live?.disconnected || [];
  const total        = active.length + idle.length + disconnected.length;

  const alertedHighIdle     = useRef(new Set());
  const alertedDisconnected = useRef(new Set());

  useEffect(() => {
    if (!live) return;
    idle.forEach((u) => {
      if (u.idle_seconds >= HIGH_IDLE && !alertedHighIdle.current.has(u.user_id)) {
        alertedHighIdle.current.add(u.user_id);
        toast(`${u.first_name} ${u.last_name} has been idle for ${formatIdleTime(u.idle_seconds)}`, { icon:'⚠️', style:{ background:'rgba(248,113,113,0.15)', color:'#F87171', fontWeight:600, border:'1px solid rgba(248,113,113,0.3)' }, duration:6000 });
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
    { label:'Active', count:active.length, color:'#34D399', glow:'rgba(52,211,153,0.25)', gradient:'linear-gradient(135deg,#10B981,#34D399)', icon:<Activity size={18} color="white" /> },
    { label:'Idle',   count:idle.length,   color:'#F87171', glow:'rgba(248,113,113,0.25)', gradient:'linear-gradient(135deg,#EF4444,#F87171)', icon:<AlertTriangle size={18} color="white" /> },
    { label:'Offline',count:disconnected.length, color:'#94A3B8', glow:'rgba(148,163,184,0.15)', gradient:'linear-gradient(135deg,#475569,#64748B)', icon:<WifiOff size={18} color="white" /> },
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
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
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Employee','Department','Idle Events','Total Idle Time','Risk Level',''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!team?.data?.length ? (
                <tr><td colSpan={6} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No idle data recorded today</td></tr>
              ) : (
                team.data.map((row, i) => {
                  const secs   = parseInt(row.dataValues?.total_idle_seconds || row.total_idle_seconds || 0);
                  const isHigh = secs > HIGH_IDLE;
                  return (
                    <tr key={i} style={{ transition:'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={S.td}>
                        <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{row.user?.first_name} {row.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'2px' }}>{row.user?.employee_id}</p>
                      </td>
                      <td style={S.td}>{row.user?.department || '—'}</td>
                      <td style={{ ...S.td, fontWeight:600 }}>{row.dataValues?.idle_events || row.idle_events || 0}</td>
                      <td style={{ ...S.td, fontWeight:700, color: isHigh ? '#F87171' : '#34D399' }}>{formatIdleTime(secs)}</td>
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
      </div>

      {timeline && <IdleTimelineModal userId={timeline.userId} date={timeline.date} name={timeline.name} onClose={() => setTimeline(null)} />}
    </div>
  );
}
