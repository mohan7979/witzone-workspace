import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { leaveApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  input: {
    width:'100%', padding:'10px 14px', fontSize:'13px',
    background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)',
    borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box',
    transition:'all 0.2s', fontFamily:'inherit',
  },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'7px' },
};

const FILTERS = ['pending', 'approved', 'rejected'];

function ReviewModal({ leave, onClose }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const review = useMutation({
    mutationFn: ({ action }) => leaveApi.review(leave.id, { action, comment }),
    onSuccess: (_, { action }) => {
      toast.success(`Leave ${action}`);
      qc.invalidateQueries(['pending-leaves']);
      qc.invalidateQueries(['dashboard-stats']);
      qc.invalidateQueries(['team-attendance-today']);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'480px', overflow:'hidden' }}>

        {/* Top shimmer */}
        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)' }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Review Leave Request</p>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', padding:'16px', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['Employee',   `${leave.user?.first_name} ${leave.user?.last_name} (${leave.user?.department ?? ''})`],
              ['Leave Type', leave.type],
              ['Period',     `${formatDate(leave.start_date)} — ${formatDate(leave.end_date)} (${leave.duration_days}d)`],
              ['Reason',     leave.reason],
            ].map(([k, v]) => (
              <div key={k} style={{ display:'flex', gap:'14px', marginBottom:'12px' }}>
                <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.3)', width:'88px', flexShrink:0, marginTop:'1px' }}>{k}</span>
                <span style={{ fontSize:'12px', color:'#F1F5F9', fontWeight:600, textTransform:'capitalize' }}>{v}</span>
              </div>
            ))}
          </div>

          <div>
            <label style={S.label}>Comment <span style={{ color:'rgba(241,245,249,0.25)', textTransform:'none', fontWeight:400 }}>(optional)</span></label>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for the employee…"
              style={{ ...S.input, resize:'none', lineHeight:1.6 }}
              onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }} />
          </div>

          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={() => review.mutate({ action:'approved' })} disabled={review.isPending} style={{
              flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'7px',
              padding:'12px', fontSize:'13px', fontWeight:700,
              background:'linear-gradient(135deg,#10B981,#34D399)', color:'white', border:'none', borderRadius:'10px',
              cursor: review.isPending ? 'not-allowed' : 'pointer',
              boxShadow:'0 4px 16px rgba(52,211,153,0.3)', opacity: review.isPending ? 0.7 : 1,
              transition:'all 0.2s',
            }}
              onMouseEnter={e => { if (!review.isPending) e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform='none'}>
              <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => review.mutate({ action:'rejected' })} disabled={review.isPending} style={{
              flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'7px',
              padding:'12px', fontSize:'13px', fontWeight:700,
              background:'linear-gradient(135deg,#EF4444,#F87171)', color:'white', border:'none', borderRadius:'10px',
              cursor: review.isPending ? 'not-allowed' : 'pointer',
              boxShadow:'0 4px 16px rgba(239,68,68,0.3)', opacity: review.isPending ? 0.7 : 1,
              transition:'all 0.2s',
            }}
              onMouseEnter={e => { if (!review.isPending) e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform='none'}>
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaveManagementPage() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-leaves', filter],
    queryFn: () => leaveApi.pending({ status:filter, limit:50 }),
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            Leave Management
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>
            Review and approve employee leave requests
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(244,114,182,0.1)', border:'1px solid rgba(244,114,182,0.25)', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:600, color:'#F472B6' }}>
          <div style={{ width:'6px', height:'6px', background:'#F472B6', borderRadius:'50%', animation:'pulse-glow 2s infinite' }} />
          {filter} requests
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px', width:'fit-content' }}>
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:'7px 18px', fontSize:'12px', fontWeight:600,
            borderRadius:'9px', border:'none', cursor:'pointer',
            textTransform:'capitalize', transition:'all 0.15s',
            background: filter === s ? 'rgba(244,114,182,0.15)' : 'transparent',
            color: filter === s ? '#F472B6' : 'rgba(241,245,249,0.4)',
            boxShadow: filter === s ? '0 0 0 1px rgba(244,114,182,0.3)' : 'none',
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Employee','Type','Period','Days','Reason','Applied','Reviewed By','Status',''].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
              {!isLoading && !data?.data?.length && <tr><td colSpan={9} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No {filter} leave requests</td></tr>}
              {data?.data?.map((leave) => (
                <tr key={leave.id}
                  style={{ transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#F472B6,#EC4899)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:700, flexShrink:0, boxShadow:'0 0 10px rgba(244,114,182,0.3)' }}>
                        {leave.user?.first_name?.[0]}{leave.user?.last_name?.[0]}
                      </div>
                      <div>
                        <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{leave.user?.first_name} {leave.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'1px' }}>{leave.user?.department}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...S.td, textTransform:'capitalize' }}>{leave.type}</td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap' }}>
                    {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                  </td>
                  <td style={{ ...S.td, fontWeight:700, color:'#F1F5F9' }}>{leave.duration_days}</td>
                  <td style={{ ...S.td, maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {leave.reason}
                  </td>
                  <td style={{ ...S.td, fontSize:'12px', color:'rgba(241,245,249,0.35)', whiteSpace:'nowrap' }}>
                    {formatDate(leave.created_at)}
                  </td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap' }}>
                    {leave.reviewer ? (
                      <div>
                        <p style={{ fontWeight:600, color:'#F1F5F9' }}>{leave.reviewer.first_name} {leave.reviewer.last_name}</p>
                        {leave.reviewed_at && <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'1px' }}>{formatDate(leave.reviewed_at)}</p>}
                      </div>
                    ) : <span style={{ color:'rgba(241,245,249,0.2)' }}>—</span>}
                  </td>
                  <td style={S.td}><Badge status={leave.status} /></td>
                  <td style={S.td}>
                    {leave.status === 'pending' && (
                      <button onClick={() => setSelected(leave)} style={{
                        fontSize:'12px', fontWeight:700, color:'#818CF8',
                        background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.25)',
                        cursor:'pointer', padding:'6px 12px', borderRadius:'8px', transition:'all 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(129,140,248,0.2)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(129,140,248,0.1)'; e.currentTarget.style.transform='none'; }}>
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ReviewModal leave={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
