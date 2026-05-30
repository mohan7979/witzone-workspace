import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi, authApi } from '@/api';
import useAuthStore from '@/store/authStore';
import { Search, TrendingUp, Umbrella, Heart, RotateCcw, Monitor, Briefcase, Gem, Users } from 'lucide-react';

/* ─── Design tokens ─── */
const TOKENS = {
  casual:   { color:'#818CF8', rgb:'129,140,248', label:'Casual Leave',   icon:Umbrella,  max:12  },
  sick:     { color:'#F472B6', rgb:'244,114,182', label:'Sick Leave',     icon:Heart,     max:12  },
  compOff:  { color:'#34D399', rgb:'52,211,153',  label:'Comp Off',       icon:RotateCcw, max:6   },
  wfh:      { color:'#38BDF8', rgb:'56,189,248',  label:'WFH Leave',      icon:Monitor,   max:8   },
  wfo:      { color:'#A78BFA', rgb:'167,139,250', label:'WFO Leave',      icon:Briefcase, max:12  },
  marriage: { color:'#F9A8D4', rgb:'249,168,212', label:'Marriage Leave', icon:Gem,       max:5   },
  maternity:{ color:'#86EFAC', rgb:'134,239,172', label:'Maternity Leave',icon:Users,     max:90  },
};

const glass = (extra = {}) => ({
  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
  borderRadius:16, backdropFilter:'blur(12px)', ...extra,
});

/* ─── Progress bar ─── */
function ProgressBar({ value, max, color, rgb }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ color:'#64748B', fontSize:11 }}>{value} / {max} days</span>
        <span style={{ color, fontSize:11, fontWeight:600 }}>{pct}%</span>
      </div>
      <div style={{ height:6, background:`rgba(${rgb},0.1)`, borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,rgba(${rgb},0.6),${color})`, borderRadius:4, transition:'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ─── Summary Card (HR view) ─── */
function SummaryCard({ label, icon: Icon, color, rgb, avg }) {
  return (
    <div style={{ ...glass(), padding:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, background:`rgba(${rgb},0.08)`, borderRadius:'50%', filter:'blur(20px)' }} />
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:`rgba(${rgb},0.12)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ color:'#94A3B8', fontSize:12 }}>{label}</span>
      </div>
      <div style={{ color:'#E2E8F0', fontSize:26, fontWeight:700 }}>{avg}</div>
      <div style={{ color:'#64748B', fontSize:11, marginTop:2 }}>avg balance</div>
    </div>
  );
}

/* ─── HR view ─── */
function HRView() {
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState('name');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn:  () => userApi.leaveBalances().then(r => r.data),
  });

  const rows = (data || []).filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${u.first_name} ${u.last_name} ${u.employee_id} ${u.department || ''}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    const keys = { casual:'casual_leave_balance', sick:'sick_leave_balance', compoff:'comp_off_balance',
                   wfh:'wfh_leave_balance', wfo:'wfo_leave_balance', marriage:'marriage_leave_balance', maternity:'maternity_leave_balance' };
    if (keys[sortKey]) return (b[keys[sortKey]] ?? 0) - (a[keys[sortKey]] ?? 0);
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  });

  const avg = (key) => {
    if (!data?.length) return '—';
    const sum = data.reduce((acc, u) => acc + (parseFloat(u[key]) || 0), 0);
    return (sum / data.length).toFixed(1);
  };

  const thStyle = { padding:'10px 14px', textAlign:'left', color:'#64748B', fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' };
  const tdStyle = { padding:'13px 14px', color:'#CBD5E1', fontSize:13, borderBottom:'1px solid rgba(255,255,255,0.04)' };

  const balanceCols = [
    { key:'casual',    field:'casual_leave_balance',    tok:TOKENS.casual },
    { key:'sick',      field:'sick_leave_balance',      tok:TOKENS.sick },
    { key:'compoff',   field:'comp_off_balance',        tok:TOKENS.compOff },
    { key:'wfh',       field:'wfh_leave_balance',       tok:TOKENS.wfh },
    { key:'wfo',       field:'wfo_leave_balance',       tok:TOKENS.wfo },
    { key:'marriage',  field:'marriage_leave_balance',  tok:TOKENS.marriage },
    { key:'maternity', field:'maternity_leave_balance', tok:TOKENS.maternity },
  ];

  return (
    <>
      {/* Summary cards — 4 per row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <SummaryCard label="Casual"   icon={Umbrella}  color={TOKENS.casual.color}   rgb={TOKENS.casual.rgb}   avg={avg('casual_leave_balance')} />
        <SummaryCard label="Sick"     icon={Heart}     color={TOKENS.sick.color}     rgb={TOKENS.sick.rgb}     avg={avg('sick_leave_balance')} />
        <SummaryCard label="WFH"      icon={Monitor}   color={TOKENS.wfh.color}      rgb={TOKENS.wfh.rgb}      avg={avg('wfh_leave_balance')} />
        <SummaryCard label="WFO"      icon={Briefcase} color={TOKENS.wfo.color}      rgb={TOKENS.wfo.rgb}      avg={avg('wfo_leave_balance')} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        <SummaryCard label="Marriage" icon={Gem}       color={TOKENS.marriage.color}  rgb={TOKENS.marriage.rgb}  avg={avg('marriage_leave_balance')} />
        <SummaryCard label="Maternity"icon={Users}     color={TOKENS.maternity.color} rgb={TOKENS.maternity.rgb} avg={avg('maternity_leave_balance')} />
        <SummaryCard label="Comp Off" icon={RotateCcw} color={TOKENS.compOff.color}   rgb={TOKENS.compOff.rgb}   avg={avg('comp_off_balance')} />
      </div>

      <div style={{ ...glass(), overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <Search size={15} color="#64748B" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#CBD5E1', padding:'8px 12px 8px 34px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ color:'#64748B', fontSize:13 }}>{rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
        </div>

        {isLoading ? (
          <div style={{ padding:40, textAlign:'center' }}>
            <div style={{ width:36, height:36, border:'3px solid rgba(129,140,248,0.2)', borderTop:'3px solid #818CF8', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }} />
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.02)' }}>
                  <th style={thStyle} onClick={() => setSortKey('name')}>Employee {sortKey==='name' && '↑'}</th>
                  <th style={thStyle}>Dept</th>
                  {balanceCols.map(({ key, tok }) => (
                    <th key={key} style={{ ...thStyle, color:tok.color }} onClick={() => setSortKey(key)}>
                      {tok.label.replace(' Leave','').replace(' Off','')} {sortKey===key && '↓'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign:'center', color:'#475569', padding:40 }}>No employees found</td></tr>
                ) : rows.map(u => {
                  const initials = `${u.first_name?.[0]||''}${u.last_name?.[0]||''}`.toUpperCase();
                  return (
                    <tr key={u.id} style={{ transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={tdStyle}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#818CF8,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials}</div>
                          <div>
                            <div style={{ fontWeight:600, color:'#E2E8F0', fontSize:13 }}>{u.first_name} {u.last_name}</div>
                            <div style={{ color:'#475569', fontSize:11 }}>{u.employee_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{u.department || <span style={{ color:'#475569' }}>—</span>}</td>
                      {balanceCols.map(({ field, tok }) => (
                        <td key={field} style={tdStyle}>
                          <span style={{ fontSize:16, fontWeight:700, color:tok.color }}>{parseFloat(u[field]) || 0}</span>
                          <span style={{ color:'#475569', fontSize:11, marginLeft:4 }}>d</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Employee view ─── */
function EmployeeView() {
  const { user } = useAuthStore();
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn:  () => authApi.me().then(r => r.user),
    initialData: user,
  });

  if (isLoading && !me) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh' }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(129,140,248,0.2)', borderTop:'3px solid #818CF8', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  );

  const balances = [
    { key:'casual',   val:parseFloat(me?.casual_leave_balance)    || 0, ...TOKENS.casual   },
    { key:'wfh',      val:parseFloat(me?.wfh_leave_balance)       || 0, ...TOKENS.wfh      },
    { key:'wfo',      val:parseFloat(me?.wfo_leave_balance)       || 0, ...TOKENS.wfo      },
    { key:'sick',     val:parseFloat(me?.sick_leave_balance)      || 0, ...TOKENS.sick     },
    { key:'marriage', val:parseFloat(me?.marriage_leave_balance)  || 0, ...TOKENS.marriage },
    { key:'maternity',val:parseFloat(me?.maternity_leave_balance) || 0, ...TOKENS.maternity},
    { key:'compOff',  val:parseFloat(me?.comp_off_balance)        || 0, ...TOKENS.compOff  },
  ];

  const total = balances.reduce((s, b) => s + b.val, 0);

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      {/* Total */}
      <div style={{ ...glass({ background:'rgba(129,140,248,0.06)', border:'1px solid rgba(129,140,248,0.15)' }), padding:'20px 28px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#818CF8,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <TrendingUp size={22} color="#fff" />
        </div>
        <div>
          <div style={{ color:'#64748B', fontSize:13 }}>Total Available Leaves</div>
          <div style={{ color:'#E2E8F0', fontSize:32, fontWeight:700, lineHeight:1.2 }}>
            {total} <span style={{ fontSize:16, color:'#64748B', fontWeight:400 }}>days</span>
          </div>
        </div>
      </div>

      {/* Balance cards */}
      <div style={{ display:'grid', gap:14 }}>
        {balances.map(({ key, val, color, rgb, label, icon: Icon, max }) => (
          <div key={key} style={{ ...glass(), padding:22, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, background:`rgba(${rgb},0.06)`, borderRadius:'50%', filter:'blur(30px)', pointerEvents:'none' }} />
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`rgba(${rgb},0.12)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ color:'#E2E8F0', fontWeight:600, fontSize:15 }}>{label}</div>
                  <div style={{ color:'#64748B', fontSize:12, marginTop:2 }}>of {max} annual days</div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ color, fontSize:36, fontWeight:800, lineHeight:1 }}>{val}</div>
                <div style={{ color:'#64748B', fontSize:12 }}>days left</div>
              </div>
            </div>
            <ProgressBar value={val} max={max} color={color} rgb={rgb} />
          </div>
        ))}
      </div>

      <div style={{ marginTop:20, padding:'14px 18px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.15)', borderRadius:10 }}>
        <div style={{ color:'#FBBF24', fontSize:13 }}>💡 Leave balances are updated by HR. Contact your HR admin if you notice any discrepancy.</div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function LeaveBalancePage() {
  const { user } = useAuthStore();
  const isHR = user?.role === 'hr' || user?.role === 'lead';
  return (
    <div style={{ paddingBottom:40 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#E2E8F0', fontSize:26, fontWeight:700, margin:0 }}>Leave Balances</h1>
        <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>
          {isHR ? 'View and manage leave balances for all active employees' : 'Your current leave day balances'}
        </p>
      </div>
      {isHR ? <HRView /> : <EmployeeView />}
    </div>
  );
}
