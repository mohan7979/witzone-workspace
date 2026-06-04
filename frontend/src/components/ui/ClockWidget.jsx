/**
 * ClockWidget — shared attendance clock-in/out + break component.
 * Used on every dashboard (employee, HR, lead).
 *
 * Props:
 *   compact  — boolean, render a smaller card (for HR/Lead dashboards)
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, Coffee, PlayCircle, CheckCircle2, Zap, Clock } from 'lucide-react';
import { attendanceApi } from '@/api';
import { formatTime, formatDuration } from '@/lib/utils';
import toast from 'react-hot-toast';

/* ── tiny helpers ─────────────────────────────────────────── */
const fmt = (secs) => {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const elapsed = (from) => {
  if (!from) return 0;
  return Math.round((Date.now() - new Date(from).getTime()) / 1000);
};

/* ── state → display config ───────────────────────────────── */
const STATE_CONFIG = {
  not_started:       { label: 'Not Started',     dot: '#FBBF24', dotAnim: false },
  session1_active:   { label: 'Active (S1)',      dot: '#34D399', dotAnim: true  },
  on_break:          { label: 'On Break',         dot: '#F59E0B', dotAnim: true  },
  between_sessions:  { label: 'Session 1 Done',   dot: '#818CF8', dotAnim: false },
  session2_active:   { label: 'Active (S2)',      dot: '#34D399', dotAnim: true  },
  day_complete:      { label: 'Day Complete',     dot: '#34D399', dotAnim: false },
};

export default function ClockWidget({ compact = false }) {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0); // drives live timers

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn:  attendanceApi.today,
    refetchInterval: 60000,
  });

  const att   = data?.attendance;
  const state = data?.state || 'not_started';
  const cfg   = STATE_CONFIG[state] || STATE_CONFIG.not_started;

  /* live timers */
  const liveShiftSecs  = (state === 'session1_active' || state === 'session2_active')
    ? elapsed(state === 'session2_active' ? att?.login_time_2 : att?.login_time)
    : 0;
  const liveBreakSecs  = state === 'on_break' ? elapsed(att?.break_start) : 0;
  const totalBreakSecs = (att?.total_break_seconds || 0) + (state === 'on_break' ? liveBreakSecs : 0);

  /* mutations */
  const refresh = () => {
    qc.invalidateQueries(['attendance-today']);
    qc.invalidateQueries(['dashboard-stats']);
    qc.invalidateQueries(['my-idle-today']);
  };

  const doClockIn    = useMutation({ mutationFn: attendanceApi.clockIn,    onSuccess: (r) => { toast.success(r.message || 'Clocked in');    refresh(); }, onError: (e) => toast.error(e.message) });
  const doClockOut   = useMutation({ mutationFn: attendanceApi.clockOut,   onSuccess: (r) => { toast.success(r.message || 'Clocked out');   refresh(); }, onError: (e) => toast.error(e.message) });
  const doStartBreak = useMutation({ mutationFn: attendanceApi.startBreak, onSuccess: (r) => { toast.success(r.message || 'Break started'); refresh(); }, onError: (e) => toast.error(e.message) });
  const doEndBreak   = useMutation({ mutationFn: attendanceApi.endBreak,   onSuccess: (r) => { toast.success(r.message || r.data?.message || 'Break ended'); refresh(); }, onError: (e) => toast.error(e.message) });

  const anyPending = doClockIn.isPending || doClockOut.isPending || doStartBreak.isPending || doEndBreak.isPending;

  /* ── helpers to format session times ───────────────────── */
  const sessionLine = (login, logout, label) => {
    if (!login) return null;
    const out   = logout ? formatTime(logout) : 'active';
    const color = logout ? 'rgba(241,245,249,0.5)' : '#34D399';
    return (
      <span style={{ fontSize: compact ? 11 : 12, color:'rgba(241,245,249,0.4)', display:'block', marginTop:2 }}>
        <span style={{ color:'rgba(241,245,249,0.3)' }}>{label}:</span>{' '}
        <span style={{ color:'#F1F5F9', fontWeight:600 }}>{formatTime(login)}</span>
        {' → '}
        <span style={{ color }}>{out}</span>
      </span>
    );
  };

  /* ── button factory ─────────────────────────────────────── */
  const Btn = ({ onClick, disabled, bg, shadow, children }) => (
    <button onClick={onClick} disabled={disabled || anyPending} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding: compact ? '8px 16px' : '11px 22px',
      background: bg,
      border:'none', borderRadius:10, cursor: disabled || anyPending ? 'not-allowed' : 'pointer',
      color:'white', fontSize: compact ? 12 : 13, fontWeight:700,
      boxShadow: shadow, opacity: disabled || anyPending ? 0.65 : 1,
      transition:'all 0.18s', whiteSpace:'nowrap',
    }}
      onMouseEnter={e => { if (!disabled && !anyPending) e.currentTarget.style.transform='translateY(-1px)'; }}
      onMouseLeave={e => e.currentTarget.style.transform='none'}
    >
      {children}
    </button>
  );

  if (isLoading) {
    return (
      <div style={{ padding:compact ? 16 : 24, display:'flex', alignItems:'center', gap:10, color:'rgba(241,245,249,0.3)', fontSize:13 }}>
        <div style={{ width:16, height:16, border:'2px solid rgba(129,140,248,0.3)', borderTopColor:'#818CF8', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        Loading attendance…
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: compact ? 14 : 20,
      padding: compact ? '16px 20px' : '26px 30px',
      background:'linear-gradient(135deg, rgba(12,18,50,0.92) 0%, rgba(30,27,75,0.92) 100%)',
      border:'1px solid rgba(99,102,241,0.2)',
      backdropFilter:'blur(20px)',
      boxShadow:'0 16px 48px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
      position:'relative', overflow:'hidden',
    }}>
      {/* shimmer line */}
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.4),transparent)', pointerEvents:'none' }} />
      {/* glow orb */}
      <div style={{ position:'absolute', top:-30, left:-30, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 65%)', pointerEvents:'none' }} />

      <div style={{ display:'flex', alignItems: compact ? 'center' : 'flex-start', justifyContent:'space-between', gap:12, position:'relative', flexWrap:'wrap' }}>

        {/* ── Left: info ── */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:compact ? 4 : 8 }}>
            <Zap size={10} color="#818CF8" fill="#818CF8" />
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(129,140,248,0.7)', textTransform:'uppercase', letterSpacing:'1px' }}>Today's Attendance</span>
          </div>

          {/* Status badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20,
            background: state === 'on_break' ? 'rgba(245,158,11,0.12)' : state === 'day_complete' ? 'rgba(52,211,153,0.1)' : state.includes('active') ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
            border:`1px solid ${state === 'on_break' ? 'rgba(245,158,11,0.3)' : state.includes('active') ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
            marginBottom: compact ? 4 : 10,
          }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot, animation: cfg.dotAnim ? 'pulse-glow 2s infinite' : 'none' }} />
            <span style={{ fontSize:11, fontWeight:700, color: state === 'on_break' ? '#F59E0B' : cfg.dot }}>{cfg.label}</span>
            {(state === 'session1_active' || state === 'session2_active') && (
              <span style={{ fontSize:11, color:'#818CF8', fontWeight:600 }}>{fmt(liveShiftSecs)}</span>
            )}
            {state === 'on_break' && (
              <span style={{ fontSize:11, color:'#F59E0B', fontWeight:600 }}>{fmt(liveBreakSecs)}</span>
            )}
          </div>

          {/* Session times */}
          {!compact && (
            <div>
              {sessionLine(att?.login_time, att?.logout_time, 'S1')}
              {att?.login_time_2 && sessionLine(att?.login_time_2, att?.logout_time_2, 'S2')}
              {att?.total_hours > 0 && (
                <span style={{ fontSize:11, color:'rgba(241,245,249,0.35)', display:'block', marginTop:2 }}>
                  Total: <span style={{ color:'#818CF8', fontWeight:600 }}>{formatDuration(att.total_hours)}</span>
                  {att.total_break_seconds > 0 && <> · Break: <span style={{ color:'#F59E0B' }}>{fmt(att.total_break_seconds)}</span></>}
                  {att.effective_hours > 0 && <> · Effective: <span style={{ color:'#34D399' }}>{formatDuration(att.effective_hours)}</span></>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right: action buttons ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>

          {/* ON BREAK */}
          {state === 'on_break' && (
            <Btn onClick={() => doEndBreak.mutate()}
              bg="linear-gradient(135deg,#F59E0B,#FBBF24)"
              shadow="0 6px 20px rgba(245,158,11,0.35)">
              <PlayCircle size={14} /> Back from Break
            </Btn>
          )}

          {/* SESSION 1 ACTIVE */}
          {state === 'session1_active' && (
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={() => doStartBreak.mutate()}
                bg="rgba(245,158,11,0.15)"
                shadow="none"
                style={{ border:'1px solid rgba(245,158,11,0.3)', color:'#FBBF24' }}>
                <Coffee size={14} /> Break
              </Btn>
              <Btn onClick={() => doClockOut.mutate()}
                bg="linear-gradient(135deg,#EF4444,#F87171)"
                shadow="0 6px 20px rgba(239,68,68,0.35)">
                <LogOut size={14} /> Clock Out
              </Btn>
            </div>
          )}

          {/* BETWEEN SESSIONS */}
          {state === 'between_sessions' && (
            <Btn onClick={() => doClockIn.mutate()}
              bg="linear-gradient(135deg,#8B5CF6,#A78BFA)"
              shadow="0 6px 20px rgba(139,92,246,0.35)">
              <LogIn size={14} /> Clock In (Session 2)
            </Btn>
          )}

          {/* SESSION 2 ACTIVE */}
          {state === 'session2_active' && (
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={() => doStartBreak.mutate()}
                bg="rgba(245,158,11,0.15)"
                shadow="none">
                <Coffee size={14} /> Break
              </Btn>
              <Btn onClick={() => doClockOut.mutate()}
                bg="linear-gradient(135deg,#EF4444,#F87171)"
                shadow="0 6px 20px rgba(239,68,68,0.35)">
                <LogOut size={14} /> Clock Out
              </Btn>
            </div>
          )}

          {/* NOT STARTED */}
          {state === 'not_started' && (
            <Btn onClick={() => doClockIn.mutate()}
              bg="linear-gradient(135deg,#6366F1,#8B5CF6)"
              shadow="0 6px 20px rgba(99,102,241,0.4)">
              <LogIn size={14} /> Clock In
            </Btn>
          )}

          {/* DAY COMPLETE */}
          {state === 'day_complete' && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:10, color:'#34D399', fontSize:13, fontWeight:600 }}>
              <CheckCircle2 size={14} />
              {formatDuration(att?.total_hours)} total
            </div>
          )}

          {/* Compact session detail */}
          {compact && att?.login_time && (
            <div style={{ fontSize:11, color:'rgba(241,245,249,0.35)', textAlign:'right' }}>
              {formatTime(att.login_time)}{att.logout_time ? ` → ${formatTime(att.logout_time)}` : ' → active'}
              {att.login_time_2 && <><br/>S2: {formatTime(att.login_time_2)}{att.logout_time_2 ? ` → ${formatTime(att.logout_time_2)}` : ' → active'}</>}
            </div>
          )}
        </div>
      </div>

      {/* Break info bar */}
      {(state === 'on_break' || totalBreakSecs > 0) && !compact && (
        <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, fontSize:12, color:'rgba(241,245,249,0.5)' }}>
          <Clock size={11} style={{ display:'inline', marginRight:5, verticalAlign:'middle' }} />
          {state === 'on_break'
            ? <>On break for <span style={{ color:'#FBBF24', fontWeight:600 }}>{fmt(liveBreakSecs)}</span> · Total break today: <span style={{ color:'#FBBF24', fontWeight:600 }}>{fmt(totalBreakSecs)}</span></>
            : <>Total break today: <span style={{ color:'#FBBF24', fontWeight:600 }}>{fmt(totalBreakSecs)}</span> — Break time is not counted as idle.</>
          }
        </div>
      )}
    </div>
  );
}
