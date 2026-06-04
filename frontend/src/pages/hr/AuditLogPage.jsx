import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { auditApi } from '@/api';

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)', verticalAlign:'top' },
};

// Human-readable labels for the stable action keys recorded by the backend.
const ACTION_LABELS = {
  'work_mode.change': 'Work Mode Changed',
  'role.change':      'Role Changed',
  'leave.tl_review':  'Leave — TL Review',
  'leave.hr_review':  'Leave — HR/Superuser Review',
};
const ACTION_COLORS = {
  'work_mode.change': '#38BDF8',
  'role.change':      '#F472B6',
  'leave.tl_review':  '#FBBF24',
  'leave.hr_review':  '#34D399',
};

const FILTERS = [
  { key:'',                  label:'All Events' },
  { key:'leave.hr_review',   label:'Leave Decisions' },
  { key:'leave.tl_review',   label:'TL Reviews' },
  { key:'work_mode.change',  label:'Work Mode' },
  { key:'role.change',       label:'Role Changes' },
];

function fmtWhen(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });
}

export default function AuditLogPage() {
  const [action, setAction] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: () => auditApi.list({ ...(action && { action }), limit: 100 }),
    refetchInterval: 60000,
  });

  const rows = data?.data || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2, display:'flex', alignItems:'center', gap:'10px' }}>
            <ShieldCheck size={24} color="#A78BFA" /> Audit Log
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Immutable trail of approvals, role changes and work-mode changes</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px', width:'fit-content', flexWrap:'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setAction(f.key)} style={{
            padding:'7px 16px', fontSize:'12px', fontWeight:600, borderRadius:'9px', border:'none', cursor:'pointer', transition:'all 0.15s',
            background: action === f.key ? 'rgba(167,139,250,0.15)' : 'transparent',
            color:      action === f.key ? '#A78BFA' : 'rgba(241,245,249,0.4)',
            boxShadow:  action === f.key ? '0 0 0 1px rgba(167,139,250,0.35)' : 'none',
          }}>{f.label}</button>
        ))}
      </div>

      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
            <thead><tr>{['When','Performed By','Action','Subject','Change'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
              {!isLoading && !rows.length && <tr><td colSpan={5} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No audit events</td></tr>}
              {rows.map((e) => {
                const color = ACTION_COLORS[e.action] || '#94A3B8';
                const decision = e.metadata?.decision;
                return (
                  <tr key={e.id} style={{ transition:'background 0.12s' }} onMouseEnter={ev => ev.currentTarget.style.background='rgba(255,255,255,0.025)'} onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                    <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap', color:'rgba(241,245,249,0.5)' }}>{fmtWhen(e.created_at)}</td>
                    <td style={S.td}>
                      <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{e.actor_name || e.actor?.first_name ? `${e.actor?.first_name || ''} ${e.actor?.last_name || ''}`.trim() || e.actor_name : 'System'}</p>
                      <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', textTransform:'capitalize' }}>{e.actor_role || '—'}</p>
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 9px', borderRadius:'6px', background:`${color}1f`, color, border:`1px solid ${color}55`, whiteSpace:'nowrap' }}>
                        {ACTION_LABELS[e.action] || e.action}
                      </span>
                      {decision && <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)', marginTop:'4px', textTransform:'capitalize' }}>{decision}</p>}
                    </td>
                    <td style={{ ...S.td, fontSize:'12px', color:'#F1F5F9' }}>{e.entity_label || `${e.entity_type || ''} ${e.entity_id || ''}`.trim() || '—'}</td>
                    <td style={S.td}>
                      {e.old_value || e.new_value ? (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', flexWrap:'wrap' }}>
                          {e.old_value && <span style={{ color:'rgba(241,245,249,0.45)' }}>{e.old_value}</span>}
                          {e.old_value && e.new_value && <ArrowRight size={12} color="rgba(241,245,249,0.3)" />}
                          {e.new_value && <span style={{ color:'#F1F5F9', fontWeight:600 }}>{e.new_value}</span>}
                        </div>
                      ) : (e.metadata?.comment
                        ? <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.5)', fontStyle:'italic' }}>"{e.metadata.comment}"</span>
                        : <span style={{ color:'rgba(241,245,249,0.2)' }}>—</span>)}
                    </td>
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
