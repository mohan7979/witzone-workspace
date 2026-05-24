import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi, authApi } from '@/api';
import useAuthStore from '@/store/authStore';
import { Search, TrendingUp, Umbrella, Heart, RotateCcw } from 'lucide-react';

/* ─── Design tokens ─── */
const TOKENS = {
  casual:  { color: '#818CF8', rgb: '129,140,248', label: 'Casual Leave',  icon: Umbrella,   max: 12 },
  sick:    { color: '#F472B6', rgb: '244,114,182', label: 'Sick Leave',    icon: Heart,      max: 12 },
  compOff: { color: '#34D399', rgb: '52,211,153',  label: 'Comp Off',      icon: RotateCcw,  max: 6  },
};

const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.04)',
  border:     '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  ...extra,
});

/* ─── Progress bar ─── */
function ProgressBar({ value, max, color, rgb }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#64748B', fontSize: 11 }}>{value} / {max} days</span>
        <span style={{ color, fontSize: 11, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: `rgba(${rgb},0.1)`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, rgba(${rgb},0.6), ${color})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ─── Summary Card (HR view stat) ─── */
function SummaryCard({ label, icon: Icon, color, rgb, avg }) {
  return (
    <div style={{ ...glass(), padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: `rgba(${rgb},0.08)`, borderRadius: '50%', filter: 'blur(20px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(${rgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ color: '#94A3B8', fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ color: '#E2E8F0', fontSize: 28, fontWeight: 700 }}>{avg}</div>
      <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>avg balance</div>
    </div>
  );
}

/* ─── HR view: table of all employees ─── */
function HRView() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => userApi.leaveBalances().then(r => r.data),
  });

  const rows = (data || []).filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${u.first_name} ${u.last_name} ${u.employee_id} ${u.department || ''}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortKey === 'casual')  return (b.casual_leave_balance  ?? 0) - (a.casual_leave_balance  ?? 0);
    if (sortKey === 'sick')    return (b.sick_leave_balance    ?? 0) - (a.sick_leave_balance    ?? 0);
    if (sortKey === 'compoff') return (b.comp_off_balance      ?? 0) - (a.comp_off_balance      ?? 0);
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  });

  const avg = (key) => {
    if (!data?.length) return '—';
    const sum = data.reduce((acc, u) => acc + (parseFloat(u[key]) || 0), 0);
    return (sum / data.length).toFixed(1);
  };

  const thStyle = { padding: '10px 16px', textAlign: 'left', color: '#64748B', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
  const tdStyle = { padding: '14px 16px', color: '#CBD5E1', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Casual Leave" icon={Umbrella}   color={TOKENS.casual.color}  rgb={TOKENS.casual.rgb}  avg={avg('casual_leave_balance')} />
        <SummaryCard label="Sick Leave"   icon={Heart}      color={TOKENS.sick.color}    rgb={TOKENS.sick.rgb}    avg={avg('sick_leave_balance')} />
        <SummaryCard label="Comp Off"     icon={RotateCcw}  color={TOKENS.compOff.color} rgb={TOKENS.compOff.rgb} avg={avg('comp_off_balance')} />
      </div>

      {/* Table */}
      <div style={{ ...glass(), overflow: 'hidden' }}>
        {/* Table toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employee…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#CBD5E1', padding: '8px 12px 8px 34px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ color: '#64748B', fontSize: 13 }}>{rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(129,140,248,0.2)', borderTop: '3px solid #818CF8', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={thStyle} onClick={() => setSortKey('name')}>Employee {sortKey==='name' && '↑'}</th>
                  <th style={thStyle}>Department</th>
                  <th style={{ ...thStyle, color: TOKENS.casual.color }} onClick={() => setSortKey('casual')}>Casual {sortKey==='casual' && '↓'}</th>
                  <th style={{ ...thStyle, color: TOKENS.sick.color   }} onClick={() => setSortKey('sick')}>Sick {sortKey==='sick' && '↓'}</th>
                  <th style={{ ...thStyle, color: TOKENS.compOff.color }} onClick={() => setSortKey('compoff')}>Comp Off {sortKey==='compoff' && '↓'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#475569', padding: 40 }}>No employees found</td></tr>
                ) : rows.map(u => {
                  const initials = `${u.first_name?.[0]||''}${u.last_name?.[0]||''}`.toUpperCase();
                  return (
                    <tr key={u.id} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#E2E8F0' }}>{u.first_name} {u.last_name}</div>
                            <div style={{ color: '#475569', fontSize: 12 }}>{u.employee_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{u.department || <span style={{ color: '#475569' }}>—</span>}</td>
                      {[
                        [u.casual_leave_balance, TOKENS.casual],
                        [u.sick_leave_balance,   TOKENS.sick],
                        [u.comp_off_balance,     TOKENS.compOff],
                      ].map(([val, tok], i) => (
                        <td key={i} style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: tok.color, minWidth: 28 }}>{parseFloat(val) || 0}</span>
                            <span style={{ color: '#475569', fontSize: 11 }}>days</span>
                          </div>
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

/* ─── Employee view: own balances ─── */
function EmployeeView() {
  const { user } = useAuthStore();

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.user),
    initialData: user,
  });

  if (isLoading && !me) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(129,140,248,0.2)', borderTop: '3px solid #818CF8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const balances = [
    { key: 'casual',  val: parseFloat(me?.casual_leave_balance) || 0,  ...TOKENS.casual  },
    { key: 'sick',    val: parseFloat(me?.sick_leave_balance)   || 0,  ...TOKENS.sick    },
    { key: 'compOff', val: parseFloat(me?.comp_off_balance)     || 0,  ...TOKENS.compOff },
  ];

  const total = balances.reduce((s, b) => s + b.val, 0);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Total banner */}
      <div style={{ ...glass({ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }), padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={22} color="#fff" />
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 13 }}>Total Available Leaves</div>
          <div style={{ color: '#E2E8F0', fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>{total} <span style={{ fontSize: 16, color: '#64748B', fontWeight: 400 }}>days</span></div>
        </div>
      </div>

      {/* Balance cards */}
      <div style={{ display: 'grid', gap: 16 }}>
        {balances.map(({ key, val, color, rgb, label, icon: Icon, max }) => (
          <div key={key} style={{ ...glass(), padding: 24, position: 'relative', overflow: 'hidden' }}>
            {/* ambient glow */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: `rgba(${rgb},0.06)`, borderRadius: '50%', filter: 'blur(30px)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${rgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>{label}</div>
                  <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>of {max} annual days</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{val}</div>
                <div style={{ color: '#64748B', fontSize: 12 }}>days left</div>
              </div>
            </div>
            <ProgressBar value={val} max={max} color={color} rgb={rgb} />
          </div>
        ))}
      </div>

      {/* Note */}
      <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10 }}>
        <div style={{ color: '#FBBF24', fontSize: 13 }}>💡 Leave balances are updated by HR. Contact your HR admin if you notice any discrepancy.</div>
      </div>
    </div>
  );
}

/* ─── Main Export ─── */
export default function LeaveBalancePage() {
  const { user } = useAuthStore();
  const isHR = user?.role === 'hr' || user?.role === 'lead';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#E2E8F0', fontSize: 26, fontWeight: 700, margin: 0 }}>Leave Balances</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          {isHR ? 'View and manage leave balances for all active employees' : 'Your current leave day balances'}
        </p>
      </div>

      {isHR ? <HRView /> : <EmployeeView />}
    </div>
  );
}
