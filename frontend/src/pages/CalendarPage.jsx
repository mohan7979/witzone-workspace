import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKEND_DAYS = new Set([0, 6]);

const TYPE_CONFIG = {
  weekend:        { bg:'rgba(148,163,184,0.08)', text:'rgba(241,245,249,0.25)', border:'rgba(255,255,255,0.05)', dot:'rgba(148,163,184,0.4)' },
  present:        { bg:'rgba(52,211,153,0.1)',   text:'#34D399', border:'rgba(52,211,153,0.3)',   dot:'#34D399' },
  half_day:       { bg:'rgba(251,191,36,0.1)',   text:'#FBBF24', border:'rgba(251,191,36,0.3)',   dot:'#FBBF24' },
  absent:         { bg:'rgba(248,113,113,0.1)',  text:'#F87171', border:'rgba(248,113,113,0.3)',  dot:'#F87171' },
  leave:          { bg:'rgba(96,165,250,0.1)',   text:'#60A5FA', border:'rgba(96,165,250,0.3)',   dot:'#60A5FA' },
  leave_upcoming: { bg:'rgba(167,139,250,0.1)',  text:'#A78BFA', border:'rgba(167,139,250,0.3)',  dot:'#A78BFA' },
  holiday:        { bg:'rgba(167,139,250,0.1)',  text:'#A78BFA', border:'rgba(167,139,250,0.3)',  dot:'#A78BFA' },
};

const LEGEND = [
  { type:'present',        label:'Present'       },
  { type:'half_day',       label:'Half Day'       },
  { type:'absent',         label:'Absent'         },
  { type:'leave',          label:'Leave'          },
  { type:'leave_upcoming', label:'Upcoming Leave' },
  { type:'holiday',        label:'Holiday'        },
  { type:'weekend',        label:'Weekend'        },
];

const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt12(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function Tooltip({ entry, dateStr, x, y, visible }) {
  if (!visible || !entry) return null;
  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.absent;

  const style = {
    position:'fixed', zIndex:9999,
    background:'rgba(10,14,26,0.97)',
    border:`1px solid ${cfg.border}`,
    borderRadius:'12px', padding:'14px 16px',
    minWidth:'200px', maxWidth:'260px',
    boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
    backdropFilter:'blur(12px)',
    pointerEvents:'none',
  };

  if (x + 270 > window.innerWidth) style.right  = window.innerWidth - x + 8;
  else                              style.left   = x + 12;
  if (y + 160 > window.innerHeight) style.bottom = window.innerHeight - y + 8;
  else                              style.top    = y + 12;

  const [yyyy, mm, dd] = dateStr.split('-');
  const displayDate = `${dd} ${MONTH_NAMES[parseInt(mm) - 1]} ${yyyy}`;

  return (
    <div style={style}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:cfg.dot, flexShrink:0 }} />
        <span style={{ color:'#F1F5F9', fontSize:'12px', fontWeight:700 }}>{entry.label}</span>
        <span style={{ color:'rgba(241,245,249,0.35)', fontSize:'11px', marginLeft:'auto' }}>{displayDate}</span>
      </div>
      {entry.detail && <p style={{ color:'rgba(241,245,249,0.5)', fontSize:'12px', lineHeight:1.5, marginBottom:0 }}>{entry.detail}</p>}
      {(entry.login_time || entry.logout_time) && (
        <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'16px' }}>
          {entry.login_time && (
            <div>
              <p style={{ color:'rgba(241,245,249,0.3)', fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Clock In</p>
              <p style={{ color:'#34D399', fontSize:'12px', fontWeight:700 }}>{fmt12(entry.login_time)}</p>
            </div>
          )}
          {entry.logout_time && (
            <div>
              <p style={{ color:'rgba(241,245,249,0.3)', fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Clock Out</p>
              <p style={{ color:'#F87171', fontSize:'12px', fontWeight:700 }}>{fmt12(entry.logout_time)}</p>
            </div>
          )}
        </div>
      )}
      {entry.leave_status === 'pending' && (
        <div style={{ marginTop:'8px', display:'inline-block', padding:'3px 10px', borderRadius:'20px', background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.35)', color:'#FBBF24', fontSize:'10px', fontWeight:700 }}>
          Pending Approval
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [tooltip, setTooltip] = useState({ visible:false, entry:null, dateStr:'', x:0, y:0 });

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-calendar', year, month],
    queryFn: () => attendanceApi.calendar({ year, month }),
  });

  const days    = data?.days    || {};
  const summary = data?.summary || {};

  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  const handleMouseEnter = useCallback((e, dateStr, entry) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ visible:true, entry, dateStr, x:rect.right, y:rect.top });
  }, []);
  const handleMouseLeave = useCallback(() => setTooltip(t => ({ ...t, visible:false })), []);

  const SUMMARY_ITEMS = [
    { key:'present',  label:'Present',  type:'present'  },
    { key:'half_day', label:'Half Day', type:'half_day' },
    { key:'absent',   label:'Absent',   type:'absent'   },
    { key:'leave',    label:'Leave',    type:'leave'    },
    { key:'holiday',  label:'Holiday',  type:'holiday'  },
  ];

  return (
    <div style={{ maxWidth:'960px', margin:'0 auto', animation:'slide-up 0.4s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>Attendance Calendar</h1>
          <p style={{ color:'rgba(241,245,249,0.4)', fontSize:'13px', marginTop:'5px' }}>Your monthly attendance overview</p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {[{ fn:prevMonth, Icon:ChevronLeft }, { fn:nextMonth, Icon:ChevronRight }].map(({ fn, Icon }, i) => (
            i === 0 ? (
              <button key="prev" onClick={prevMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(241,245,249,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
                <ChevronLeft size={16} />
              </button>
            ) : (
              <button key="next" onClick={nextMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(241,245,249,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
                <ChevronRight size={16} />
              </button>
            )
          ))}
          <div style={{ textAlign:'center', minWidth:'150px' }}>
            <p style={{ color:'#F1F5F9', fontSize:'16px', fontWeight:700, margin:0, letterSpacing:'-0.4px' }}>
              {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
        {SUMMARY_ITEMS.map(({ key, label, type }) => {
          const cfg   = TYPE_CONFIG[type];
          const count = summary[key] ?? 0;
          return (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 14px', borderRadius:'20px', background:cfg.bg, border:`1px solid ${cfg.border}` }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:cfg.dot }} />
              <span style={{ color:'rgba(241,245,249,0.6)', fontSize:'12px', fontWeight:500 }}>{label}</span>
              <span style={{ color:cfg.dot, fontSize:'13px', fontWeight:700 }}>{isLoading ? '—' : count}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar card */}
      <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', overflow:'hidden', backdropFilter:'blur(12px)' }}>
        {/* Day-of-week header */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
          {DAY_NAMES.map((d, i) => (
            <div key={d} style={{ padding:'12px 0', textAlign:'center', color: i===0||i===6 ? '#F87171' : 'rgba(241,245,249,0.4)', fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>
              {d}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div style={{ padding:'60px', textAlign:'center', color:'rgba(241,245,249,0.2)', fontSize:'14px' }}>Loading calendar…</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)' }}>
            {cells.map((day, idx) => {
              if (!day) return (
                <div key={`empty-${idx}`} style={{ minHeight:'80px', borderBottom:'1px solid rgba(255,255,255,0.04)', borderRight:(idx+1)%7!==0?'1px solid rgba(255,255,255,0.04)':'none', background:'rgba(255,255,255,0.01)' }} />
              );

              const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const colIdx    = idx % 7;
              const isWeekend = WEEKEND_DAYS.has(colIdx);
              const entry     = isWeekend ? { type:'weekend', label:'Weekend', detail:'Non-working day' } : (days[dateStr] || null);
              const cfg       = entry ? TYPE_CONFIG[entry.type] : null;
              const isToday   = dateStr === todayStr;
              const rowEnd    = Math.floor(idx/7) === Math.floor((cells.length-1)/7);

              return (
                <div key={dateStr}
                  onMouseEnter={entry ? (e) => handleMouseEnter(e, dateStr, entry) : undefined}
                  onMouseLeave={entry ? handleMouseLeave : undefined}
                  style={{
                    minHeight:'80px', padding:'10px 8px',
                    position:'relative', cursor: entry ? 'pointer' : 'default',
                    borderBottom: !rowEnd ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    borderRight:  colIdx !== 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: cfg ? cfg.bg : 'transparent',
                    transition:'background 0.12s',
                  }}
                >
                  <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'50%', background: isToday ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent', marginBottom:'5px', boxShadow: isToday ? '0 0 10px rgba(99,102,241,0.4)' : 'none' }}>
                    <span style={{ fontSize:'13px', fontWeight: isToday ? 700 : 500, color: isToday ? '#fff' : isWeekend ? 'rgba(248,113,113,0.6)' : 'rgba(241,245,249,0.55)' }}>
                      {day}
                    </span>
                  </div>

                  {cfg && !isWeekend && (
                    <div style={{ padding:'3px 7px', borderRadius:'6px', background: cfg.bg, border:`1px solid ${cfg.border}`, display:'inline-flex', alignItems:'center', gap:'4px' }}>
                      <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:cfg.dot, flexShrink:0 }} />
                      <span style={{ fontSize:'10px', fontWeight:700, color:cfg.dot, lineHeight:1, whiteSpace:'nowrap' }}>{entry.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginTop:'16px', padding:'12px 18px', background:'rgba(255,255,255,0.04)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ color:'rgba(241,245,249,0.25)', fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginRight:'8px' }}>Legend</span>
        {LEGEND.map(({ type, label }) => {
          const cfg = TYPE_CONFIG[type];
          return (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'5px', marginRight:'12px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'3px', background:cfg.dot }} />
              <span style={{ color:'rgba(241,245,249,0.45)', fontSize:'11px', fontWeight:500 }}>{label}</span>
            </div>
          );
        })}
      </div>

      <Tooltip {...tooltip} />
    </div>
  );
}
