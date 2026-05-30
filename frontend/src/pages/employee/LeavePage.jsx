import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CalendarDays, FileText } from 'lucide-react';
import { leaveApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th:    { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td:    { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  input: { width:'100%', padding:'10px 14px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'inherit' },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'7px' },
};

const pink = { focus: 'rgba(244,114,182,0.6)', glow: 'rgba(244,114,182,0.1)' };
const onFocus = (e) => { e.target.style.borderColor = pink.focus; e.target.style.boxShadow = `0 0 0 3px ${pink.glow}`; };
const onBlur  = (e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; };

const LEAVE_TYPES = [
  { value:'casual',     label:'Casual Leave',            policy:'' },
  { value:'wfh',        label:'WFH Leave',               policy:'8 days / year (carry forward)' },
  { value:'wfo',        label:'WFO Leave',               policy:'12 days / year' },
  { value:'sick',       label:'Sick Leave',              policy:'Document required' },
  { value:'marriage',   label:'Marriage Leave',          policy:'5 days' },
  { value:'maternity',  label:'Maternity Leave',         policy:'3 months (90 days)' },
  { value:'comp_off',   label:'Comp Off',                policy:'' },
  { value:'permission', label:'Permission (Hourly)',     policy:'' },
  { value:'unpaid',     label:'Unpaid Leave',            policy:'' },
];

const TYPE_LABELS = Object.fromEntries(LEAVE_TYPES.map(t => [t.value, t.label]));
const FILTERS = ['all', 'pending', 'approved', 'rejected'];

function TlStatusPill({ leave }) {
  if (leave.status === 'rejected' && leave.tl_status === 'rejected') {
    return <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px', background:'rgba(251,191,36,0.12)', color:'#FBBF24', border:'1px solid rgba(251,191,36,0.3)', fontWeight:600 }}>TL Rejected</span>;
  }
  if (leave.tl_status === 'approved' && leave.status === 'pending') {
    return <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px', background:'rgba(16,185,129,0.1)', color:'#34D399', border:'1px solid rgba(16,185,129,0.25)', fontWeight:600 }}>TL ✓ → HR Pending</span>;
  }
  return null;
}

function ApplyLeaveModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type:'casual', start_date:'', end_date:'', start_time:'', end_time:'', reason:'', document_note:'' });
  const isPermission = form.type === 'permission';
  const isSick       = form.type === 'sick';
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const selectedType = LEAVE_TYPES.find(t => t.value === form.type);

  const apply = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      toast.success('Leave request submitted — your TL will be notified');
      qc.invalidateQueries(['my-leaves']);
      qc.invalidateQueries(['dashboard-stats']);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto' }}>

        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(244,114,182,0.5),transparent)' }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'sticky', top:0, background:'rgba(13,17,30,0.98)', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#F472B6,#EC4899)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CalendarDays size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Apply for Leave</p>
              <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>TL → HR two-level approval</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); apply.mutate(form); }} style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>

          {/* Leave type */}
          <div>
            <label style={S.label}>Leave Type</label>
            <select value={form.type} onChange={f('type')} style={S.input} onFocus={onFocus} onBlur={onBlur}>
              {LEAVE_TYPES.map(({ value, label, policy }) => (
                <option key={value} value={value} style={{ background:'#0D1117' }}>
                  {label}{policy ? ` — ${policy}` : ''}
                </option>
              ))}
            </select>
            {selectedType?.policy && (
              <p style={{ fontSize:'11px', color:'rgba(244,114,182,0.7)', marginTop:'5px' }}>
                📋 Policy: {selectedType.policy}
              </p>
            )}
          </div>

          {/* Dates */}
          <div style={{ display:'grid', gridTemplateColumns: isPermission ? '1fr' : '1fr 1fr', gap:'12px' }}>
            <div>
              <label style={S.label}>{isPermission ? 'Date' : 'From Date'}</label>
              <input type="date" required value={form.start_date} onChange={f('start_date')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
            </div>
            {!isPermission && (
              <div>
                <label style={S.label}>To Date</label>
                <input type="date" required value={form.end_date} onChange={f('end_date')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
            )}
          </div>

          {/* Time (permission only) */}
          {isPermission && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={S.label}>From Time</label>
                <input type="time" required value={form.start_time} onChange={f('start_time')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={S.label}>To Time</label>
                <input type="time" required value={form.end_time} onChange={f('end_time')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={S.label}>Reason</label>
            <textarea required rows={3} value={form.reason} onChange={f('reason')}
              placeholder="Briefly describe the reason…"
              style={{ ...S.input, resize:'none', lineHeight:1.6 }}
              onFocus={onFocus} onBlur={onBlur} />
          </div>

          {/* Document note — only for sick leave */}
          {isSick && (
            <div style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:'12px', padding:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }}>
                <FileText size={14} color="#FBBF24" />
                <span style={{ fontSize:'12px', fontWeight:700, color:'#FBBF24' }}>Medical Document Required</span>
              </div>
              <label style={{ ...S.label, color:'rgba(251,191,36,0.7)' }}>Document / Doctor Note</label>
              <textarea rows={2} value={form.document_note} onChange={f('document_note')}
                placeholder="e.g. Doctor's certificate from City Hospital, dated 24 May 2026…"
                style={{ ...S.input, resize:'none', lineHeight:1.6, borderColor:'rgba(251,191,36,0.3)' }}
                onFocus={e => { e.target.style.borderColor='rgba(251,191,36,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(251,191,36,0.08)'; }}
                onBlur={e => { e.target.style.borderColor='rgba(251,191,36,0.3)'; e.target.style.boxShadow='none'; }} />
            </div>
          )}

          {/* Approval flow info */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#FBBF24', flexShrink:0 }} />
            <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>Your request goes to</span>
            <span style={{ fontSize:'11px', fontWeight:700, color:'#FBBF24' }}>Team Lead</span>
            <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>→ then</span>
            <span style={{ fontSize:'11px', fontWeight:700, color:'#818CF8' }}>HR</span>
            <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>for final approval</span>
          </div>

          <div style={{ display:'flex', gap:'12px', paddingTop:'4px' }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'12px', fontSize:'13px', fontWeight:600,
              color:'rgba(241,245,249,0.6)', background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', cursor:'pointer', transition:'all 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
              Cancel
            </button>
            <button type="submit" disabled={apply.isPending} style={{
              flex:1, padding:'12px', fontSize:'13px', fontWeight:700, color:'white',
              background: apply.isPending ? 'rgba(244,114,182,0.5)' : 'linear-gradient(135deg,#F472B6,#EC4899)',
              border:'none', borderRadius:'10px',
              cursor: apply.isPending ? 'not-allowed' : 'pointer',
              boxShadow: apply.isPending ? 'none' : '0 4px 16px rgba(244,114,182,0.4)', transition:'all 0.2s',
            }}>
              {apply.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeavePage() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter]       = useState('all');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-leaves', filter],
    queryFn:  () => leaveApi.myLeaves({ limit:50, status: filter === 'all' ? undefined : filter }),
  });

  const cancel = useMutation({
    mutationFn: leaveApi.cancel,
    onSuccess: () => { toast.success('Request cancelled'); qc.invalidateQueries(['my-leaves']); qc.invalidateQueries(['dashboard-stats']); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            Leaves & Permissions
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
            Apply for leave or view your request history
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          display:'inline-flex', alignItems:'center', gap:'7px',
          padding:'11px 20px', background:'linear-gradient(135deg,#F472B6,#EC4899)', color:'white',
          fontSize:'13px', fontWeight:700, borderRadius:'10px', border:'none',
          cursor:'pointer', boxShadow:'0 4px 16px rgba(244,114,182,0.4)', transition:'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(244,114,182,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(244,114,182,0.4)'; }}>
          <Plus size={15} /> Apply Leave
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px', width:'fit-content' }}>
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:'7px 18px', fontSize:'12px', fontWeight:600, borderRadius:'9px',
            border:'none', cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s',
            background: filter === s ? 'rgba(244,114,182,0.15)' : 'transparent',
            color:      filter === s ? '#F472B6' : 'rgba(241,245,249,0.4)',
            boxShadow:  filter === s ? '0 0 0 1px rgba(244,114,182,0.3)' : 'none',
          }}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Type','Period','Duration','Reason','TL / HR Status','Remarks',''].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>
              )}
              {!isLoading && !data?.data?.length && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No records found</td></tr>
              )}
              {data?.data?.map((leave) => (
                <tr key={leave.id}
                  style={{ transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>
                    {TYPE_LABELS[leave.type] || leave.type}
                  </td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap' }}>
                    {formatDate(leave.start_date)}{leave.start_date !== leave.end_date ? ` — ${formatDate(leave.end_date)}` : ''}
                  </td>
                  <td style={{ ...S.td, fontWeight:700, color:'#F1F5F9' }}>{leave.duration_days}d</td>
                  <td style={{ ...S.td, maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leave.reason}</td>
                  <td style={S.td}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      <Badge status={leave.status} />
                      <TlStatusPill leave={leave} />
                    </div>
                  </td>
                  <td style={{ ...S.td, color:'rgba(241,245,249,0.3)', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {leave.reviewer_comment || leave.tl_comment || '—'}
                  </td>
                  <td style={S.td}>
                    {leave.status === 'pending' && (
                      <button onClick={() => cancel.mutate(leave.id)} style={{
                        fontSize:'11px', fontWeight:700, color:'#F87171',
                        background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)',
                        cursor:'pointer', padding:'5px 10px', borderRadius:'7px', transition:'all 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <ApplyLeaveModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
