import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, authApi, leaveApi } from '@/api';
import useAuthStore from '@/store/authStore';
import { Search, TrendingUp, Umbrella, Heart, RotateCcw, Gem, Users, RefreshCw, Plus, Home, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Design tokens ─── */
// "personal" = casual_leave_balance — max and carry-forward depend on work_mode
const TOKENS = {
  personal: { color:'#818CF8', rgb:'129,140,248', label:'Personal Leave', icon:Umbrella,
               maxWfo:12, maxWfh:8, carryMax:16,
               annual:true, carryForwardWfh:true, carryForwardWfo:false,
               policy_wfo:'12 days / year · resets annually',
               policy_wfh:'8 days / year · unused carries forward (max 16)' },
  sick:     { color:'#F472B6', rgb:'244,114,182', label:'Sick Leave',     icon:Heart,
               max:12, annual:true, carryForward:false,
               policy:'12 days / year · medical document required', docRequired:true },
  compOff:  { color:'#34D399', rgb:'52,211,153',  label:'Comp Off',       icon:RotateCcw,
               max:null, annual:false, carryForward:false,
               policy:'Earned · granted by HR for working on holidays/weekends' },
  marriage: { color:'#F9A8D4', rgb:'249,168,212', label:'Marriage Leave', icon:Gem,
               max:5,  annual:false, carryForward:false,
               policy:'One-time entitlement of 5 days' },
  maternity:{ color:'#86EFAC', rgb:'134,239,172', label:'Maternity Leave',icon:Users,
               max:90, annual:false, carryForward:false,
               policy:'One-time entitlement of up to 90 days (3 months)' },
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
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('name');
  const [showConfirm, setShowConfirm] = useState(false);
  const { user } = useAuthStore();
  const isHRRole = user?.role === 'hr' || user?.role === 'superuser';
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn:  () => userApi.leaveBalances().then(r => r.data),
  });

  const resetMutation = useMutation({
    mutationFn: leaveApi.resetAnnualLeaves,
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Annual leave balances reset successfully');
      qc.invalidateQueries(['leave-balances']);
      setShowConfirm(false);
    },
    onError: (e) => toast.error(e.message || 'Reset failed'),
  });

  const [grantModal, setGrantModal] = useState(null); // { id, name }
  const [grantDays, setGrantDays]   = useState('');
  const grantMutation = useMutation({
    mutationFn: ({ id, days }) => userApi.grantCompOff(id, { days: parseFloat(days) }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Comp Off granted');
      qc.invalidateQueries(['leave-balances']);
      setGrantModal(null); setGrantDays('');
    },
    onError: (e) => toast.error(e.message || 'Failed to grant Comp Off'),
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
    { key:'personal',  field:'casual_leave_balance',   tok:TOKENS.personal  },
    { key:'sick',      field:'sick_leave_balance',     tok:TOKENS.sick      },
    { key:'compoff',   field:'comp_off_balance',       tok:TOKENS.compOff   },
    { key:'marriage',  field:'marriage_leave_balance', tok:TOKENS.marriage  },
    { key:'maternity', field:'maternity_leave_balance',tok:TOKENS.maternity },
  ];

  return (
    <>
      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:24 }}>
        <SummaryCard label="Personal"  icon={Umbrella}  color={TOKENS.personal.color}  rgb={TOKENS.personal.rgb}  avg={avg('casual_leave_balance')} />
        <SummaryCard label="Sick"      icon={Heart}     color={TOKENS.sick.color}       rgb={TOKENS.sick.rgb}      avg={avg('sick_leave_balance')} />
        <SummaryCard label="Comp Off"  icon={RotateCcw} color={TOKENS.compOff.color}    rgb={TOKENS.compOff.rgb}   avg={avg('comp_off_balance')} />
        <SummaryCard label="Marriage"  icon={Gem}       color={TOKENS.marriage.color}   rgb={TOKENS.marriage.rgb}  avg={avg('marriage_leave_balance')} />
        <SummaryCard label="Maternity" icon={Users}     color={TOKENS.maternity.color}  rgb={TOKENS.maternity.rgb} avg={avg('maternity_leave_balance')} />
      </div>

      {/* Grant Comp Off modal */}
      {grantModal && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(4,7,18,0.85)', backdropFilter:'blur(8px)' }}>
          <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,0.7)', width:'100%', maxWidth:400, padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'rgba(52,211,153,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <RotateCcw size={18} color="#34D399" />
              </div>
              <div>
                <p style={{ fontSize:16, fontWeight:700, color:'#F1F5F9', margin:0 }}>Grant Comp Off</p>
                <p style={{ fontSize:12, color:'rgba(241,245,249,0.4)', marginTop:2 }}>{grantModal.name}</p>
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:7 }}>Days to Grant</label>
              <input type="number" min="0.5" step="0.5" value={grantDays} onChange={e => setGrantDays(e.target.value)}
                placeholder="e.g. 1, 1.5, 2"
                style={{ width:'100%', padding:'10px 14px', fontSize:14, background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(52,211,153,0.3)', borderRadius:10, color:'#F1F5F9', outline:'none', boxSizing:'border-box' }} />
              <p style={{ fontSize:11, color:'rgba(52,211,153,0.6)', marginTop:5 }}>Fractions allowed (e.g. 0.5 = half day)</p>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => { setGrantModal(null); setGrantDays(''); }}
                style={{ flex:1, padding:'11px', fontSize:13, fontWeight:600, color:'rgba(241,245,249,0.6)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => grantMutation.mutate({ id: grantModal.id, days: grantDays })}
                disabled={!grantDays || grantMutation.isPending}
                style={{ flex:1, padding:'11px', fontSize:13, fontWeight:700, color:'white', background: (!grantDays || grantMutation.isPending) ? 'rgba(52,211,153,0.4)' : 'linear-gradient(135deg,#34D399,#10B981)', border:'none', borderRadius:10, cursor:(!grantDays || grantMutation.isPending) ? 'not-allowed' : 'pointer', boxShadow:'0 4px 16px rgba(52,211,153,0.3)' }}>
                {grantMutation.isPending ? 'Granting…' : 'Grant Days'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog for annual reset */}
      {showConfirm && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(4,7,18,0.85)', backdropFilter:'blur(8px)' }}>
          <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,0.7)', width:'100%', maxWidth:440, padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'rgba(248,113,113,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <RefreshCw size={18} color="#F87171" />
              </div>
              <div>
                <p style={{ fontSize:16, fontWeight:700, color:'#F1F5F9', margin:0 }}>Reset Annual Leave Balances</p>
                <p style={{ fontSize:12, color:'rgba(241,245,249,0.4)', marginTop:3 }}>This action will affect all active employees</p>
              </div>
            </div>
            <div style={{ background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.18)', borderRadius:10, padding:'14px 16px', marginBottom:20, fontSize:13, color:'rgba(241,245,249,0.65)', lineHeight:1.7 }}>
              <strong style={{ color:'#F87171' }}>What this does:</strong>
              <ul style={{ margin:'8px 0 0', paddingLeft:18, display:'flex', flexDirection:'column', gap:4 }}>
                <li>Casual, Sick, WFO — reset to annual defaults (12 / 12 / 12 days)</li>
                <li>WFH — carry forward unused balance + 8 days, capped at 16</li>
                <li>Marriage, Maternity, Comp Off — <strong style={{ color:'#34D399' }}>untouched</strong></li>
              </ul>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex:1, padding:'11px', fontSize:13, fontWeight:600, color:'rgba(241,245,249,0.6)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} style={{ flex:1, padding:'11px', fontSize:13, fontWeight:700, color:'white', background: resetMutation.isPending ? 'rgba(248,113,113,0.5)' : 'linear-gradient(135deg,#F87171,#EF4444)', border:'none', borderRadius:10, cursor: resetMutation.isPending ? 'not-allowed' : 'pointer', boxShadow:'0 4px 16px rgba(248,113,113,0.35)' }}>
                {resetMutation.isPending ? 'Resetting…' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...glass(), overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:200, maxWidth:320 }}>
            <Search size={15} color="#64748B" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#CBD5E1', padding:'8px 12px 8px 34px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ color:'#64748B', fontSize:13 }}>{rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
            {isHRRole && (
              <button onClick={() => setShowConfirm(true)} style={{
                display:'inline-flex', alignItems:'center', gap:7, padding:'8px 16px',
                background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)',
                borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700, color:'#F87171', transition:'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(248,113,113,0.18)'; e.currentTarget.style.borderColor='rgba(248,113,113,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor='rgba(248,113,113,0.25)'; }}>
                <RefreshCw size={13} /> Reset Annual Balances
              </button>
            )}
          </div>
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
                  <th style={thStyle}>Dept / Mode</th>
                  {balanceCols.map(({ key, tok }) => (
                    <th key={key} style={{ ...thStyle, color:tok.color }} onClick={() => setSortKey(key)}>
                      {tok.label.replace(' Leave','').replace(' Off','')} {sortKey===key && '↓'}
                    </th>
                  ))}
                  {isHRRole && <th style={thStyle}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={isHRRole ? 8 : 7} style={{ ...tdStyle, textAlign:'center', color:'#475569', padding:40 }}>No employees found</td></tr>
                ) : rows.map(u => {
                  const initials = `${u.first_name?.[0]||''}${u.last_name?.[0]||''}`.toUpperCase();
                  const isWFH = u.work_mode === 'wfh';
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
                      <td style={tdStyle}>
                        <div style={{ fontSize:12, color:'#94A3B8' }}>{u.department || '—'}</div>
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4, marginTop:3, display:'inline-flex', alignItems:'center', gap:3,
                          background: isWFH ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)',
                          color: isWFH ? '#38BDF8' : '#A78BFA',
                          border: isWFH ? '1px solid rgba(56,189,248,0.25)' : '1px solid rgba(167,139,250,0.25)' }}>
                          {isWFH ? <Home size={9}/> : <Building2 size={9}/>} {isWFH ? 'WFH' : 'WFO'}
                        </span>
                      </td>
                      {balanceCols.map(({ field, tok }) => (
                        <td key={field} style={tdStyle}>
                          <span style={{ fontSize:16, fontWeight:700, color:tok.color }}>{parseFloat(u[field]) || 0}</span>
                          <span style={{ color:'#475569', fontSize:11, marginLeft:4 }}>d</span>
                        </td>
                      ))}
                      {isHRRole && (
                        <td style={tdStyle}>
                          <button onClick={() => { setGrantModal({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setGrantDays(''); }}
                            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', fontSize:11, fontWeight:700, color:'#34D399', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:7, cursor:'pointer', transition:'all 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(52,211,153,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(52,211,153,0.1)'}>
                            <Plus size={11}/> Comp Off
                          </button>
                        </td>
                      )}
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

  const isWFH = me?.work_mode === 'wfh';
  const personalTok = {
    ...TOKENS.personal,
    max:          isWFH ? TOKENS.personal.maxWfh : TOKENS.personal.maxWfo,
    carryForward: isWFH ? TOKENS.personal.carryForwardWfh : TOKENS.personal.carryForwardWfo,
    policy:       isWFH ? TOKENS.personal.policy_wfh : TOKENS.personal.policy_wfo,
  };
  const balances = [
    { key:'personal', val:parseFloat(me?.casual_leave_balance)    || 0, ...personalTok   },
    { key:'sick',     val:parseFloat(me?.sick_leave_balance)      || 0, ...TOKENS.sick    },
    { key:'marriage', val:parseFloat(me?.marriage_leave_balance)  || 0, ...TOKENS.marriage},
    { key:'maternity',val:parseFloat(me?.maternity_leave_balance) || 0, ...TOKENS.maternity},
    { key:'compOff',  val:parseFloat(me?.comp_off_balance)        || 0, ...TOKENS.compOff },
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
        {balances.map(({ key, val, color, rgb, label, icon: Icon, max, annual, carryForward, carryMax, policy, docRequired }) => (
          <div key={key} style={{ ...glass(), padding:22, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, background:`rgba(${rgb},0.06)`, borderRadius:'50%', filter:'blur(30px)', pointerEvents:'none' }} />
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`rgba(${rgb},0.12)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <div style={{ color:'#E2E8F0', fontWeight:600, fontSize:15 }}>{label}</div>
                    {carryForward && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(56,189,248,0.12)', color:'#38BDF8', border:'1px solid rgba(56,189,248,0.25)', letterSpacing:'0.3px' }}>
                        ↗ Carry Forward
                      </span>
                    )}
                    {docRequired && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(251,191,36,0.1)', color:'#FBBF24', border:'1px solid rgba(251,191,36,0.25)', letterSpacing:'0.3px' }}>
                        📄 Doc Required
                      </span>
                    )}
                  </div>
                  <div style={{ color:'#64748B', fontSize:11, marginTop:3 }}>
                    {annual ? `${max} days / year` : !max ? 'Earned leave' : 'One-time entitlement'}
                    {carryForward && carryMax ? ` · max ${carryMax} days` : ''}
                  </div>
                  {policy && (
                    <div style={{ color:'rgba(100,116,139,0.8)', fontSize:11, marginTop:3, fontStyle:'italic' }}>{policy}</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ color, fontSize:36, fontWeight:800, lineHeight:1 }}>{val}</div>
                <div style={{ color:'#64748B', fontSize:12 }}>days left</div>
                {carryForward && max && (
                  <div style={{ color:'rgba(56,189,248,0.6)', fontSize:10, marginTop:3 }}>
                    max {carryMax} w/ carry
                  </div>
                )}
              </div>
            </div>
            {max && (
              <ProgressBar value={val} max={carryForward ? carryMax : max} color={color} rgb={rgb} />
            )}
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
export default function LeaveBalancePage({ forceEmployee = false }) {
  const { user } = useAuthStore();
  const isHR = !forceEmployee && (user?.role === 'hr' || user?.role === 'lead' || user?.role === 'superuser');
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
