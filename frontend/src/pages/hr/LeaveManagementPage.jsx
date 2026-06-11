import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, X, GitBranch, Paperclip } from 'lucide-react';
import { leaveApi } from '@/api';
import useAuthStore from '@/store/authStore';
import { formatDate, leaveStage, leaveDurationLabel } from '@/lib/utils';
import LeaveWorkflowModal, { openLeaveDocument } from '@/components/LeaveWorkflowModal';
import { useTableControls, TableToolbar, SortTh, Pagination } from '@/components/ui/TableControls';
import toast from 'react-hot-toast';

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th:    { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td:    { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  input: { width:'100%', padding:'10px 14px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'inherit' },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'7px' },
};

const TYPE_LABELS = {
  casual:'Claimed Leave', sick:'Sick', comp_off:'Comp Off', permission:'Permission',
  unpaid:'Unpaid', marriage:'Marriage', maternity:'Maternity', long_leave:'Long Leave',
};

function TlStatusBadge({ status, skipped }) {
  // No TL assigned — request bypasses Level 1 and goes straight to HR. We must NOT
  // render this as "TL approved": no TL ever reviewed it.
  if (skipped && !status)
    return <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 8px', borderRadius:'6px', background:'rgba(148,163,184,0.12)', color:'rgba(203,213,225,0.8)', border:'1px solid rgba(148,163,184,0.25)' }}>No TL · Direct to HR</span>;
  if (!status) return <span style={{ color:'rgba(251,191,36,0.85)', fontSize:'11px', fontWeight:600 }}>Pending TL Approval</span>;
  const styles = {
    approved: { bg:'rgba(16,185,129,0.12)', color:'#34D399', border:'rgba(16,185,129,0.3)' },
    rejected: { bg:'rgba(239,68,68,0.12)',  color:'#F87171', border:'rgba(239,68,68,0.3)' },
  };
  const s = styles[status] || {};
  return (
    <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 8px', borderRadius:'6px', background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      TL {status}
    </span>
  );
}

function StageBadge({ leave }) {
  const { label, kind } = leaveStage(leave);
  const styles = {
    approved:  { bg:'rgba(16,185,129,0.12)', color:'#34D399', border:'rgba(16,185,129,0.3)' },
    rejected:  { bg:'rgba(239,68,68,0.12)',  color:'#F87171', border:'rgba(239,68,68,0.3)' },
    cancelled: { bg:'rgba(148,163,184,0.12)',color:'rgba(203,213,225,0.7)', border:'rgba(148,163,184,0.25)' },
    pending:   { bg:'rgba(251,191,36,0.12)', color:'#FBBF24', border:'rgba(251,191,36,0.3)' },
  };
  const s = styles[kind] || styles.pending;
  return (
    <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'6px', background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}

function ReviewModal({ leave, role, onClose }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const isTL = role === 'lead';
  const isSuper = role === 'superuser';

  const reviewFn = isTL
    ? ({ action }) => leaveApi.tlReview(leave.id, { action, comment })
    : ({ action }) => leaveApi.hrReview(leave.id, { action, comment });

  const review = useMutation({
    mutationFn: reviewFn,
    onSuccess: (_, { action }) => {
      toast.success(isTL
        ? (action === 'approved' ? 'Forwarded to HR for final approval' : 'Leave rejected')
        : `Leave ${action}`
      );
      qc.invalidateQueries(['pending-leaves']);
      qc.invalidateQueries(['dashboard-stats']);
      qc.invalidateQueries(['team-attendance-today']);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = [
    ['Employee',   `${leave.user?.first_name} ${leave.user?.last_name} (${leave.user?.department ?? ''})`],
    ['Leave Type', TYPE_LABELS[leave.type] || leave.type],
    ['Period',     `${formatDate(leave.start_date)} — ${formatDate(leave.end_date)} (${leave.duration_days}d)`],
    ['Reason',     leave.reason],
    ...(leave.document_note ? [['Document Note', leave.document_note]] : []),
    ...(!isTL && leave.tlReviewer ? [['TL Reviewer', `${leave.tlReviewer.first_name} ${leave.tlReviewer.last_name}`]] : []),
    ...(!isTL && leave.tl_comment ? [['TL Comment',  leave.tl_comment]] : []),
  ];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'500px', overflow:'hidden' }}>
        <div style={{ height:'1px', background:`linear-gradient(90deg,transparent,${isTL ? 'rgba(251,191,36,0.6)' : 'rgba(129,140,248,0.5)'},transparent)` }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:`linear-gradient(135deg,${isTL ? '#FBBF24,#F59E0B' : '#818CF8,#6366F1'})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <GitBranch size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>
                {isTL ? 'Team Lead Review' : isSuper ? 'Superuser Review' : 'HR Final Review'}
              </p>
              <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>
                {isTL ? 'Level 1 — Approve to forward to HR' : isSuper ? 'Final authority — TL & HR requests' : 'Level 2 — Final decision'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', padding:'16px', border:'1px solid rgba(255,255,255,0.06)' }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display:'flex', gap:'14px', marginBottom:'10px' }}>
                <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.3)', width:'100px', flexShrink:0, marginTop:'1px' }}>{k}</span>
                <span style={{ fontSize:'12px', color:'#F1F5F9', fontWeight:600 }}>{v}</span>
              </div>
            ))}
            {leave.document_file && (
              <div style={{ display:'flex', gap:'14px', marginTop:'4px' }}>
                <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.3)', width:'100px', flexShrink:0, marginTop:'5px' }}>Document</span>
                <button onClick={() => openLeaveDocument(leave.id)} style={{
                  display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:700,
                  color:'#34D399', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)',
                  cursor:'pointer', padding:'6px 12px', borderRadius:'8px',
                }}>
                  <Paperclip size={12} /> View certificate
                </button>
              </div>
            )}
          </div>

          {/* Approval chain visual — TL and HR are independent (parallel) */}
          {(() => {
            const tlState = leave.tl_skipped ? { c:'rgba(203,213,225,0.7)', d:'rgba(148,163,184,0.6)', t:'— no TL' }
              : leave.tl_status === 'approved' ? { c:'rgba(16,185,129,0.9)', d:'#10B981', t:'✓ Approved' }
              : leave.tl_status === 'rejected' ? { c:'#F87171', d:'#F87171', t:'✗ Rejected' }
              : isTL ? { c:'#FBBF24', d:'#FBBF24', t:'← You are here' }
              : { c:'rgba(241,245,249,0.3)', d:'rgba(255,255,255,0.15)', t:'Pending' };
            const hrState = leave.hr_status === 'approved' ? { c:'rgba(16,185,129,0.9)', d:'#10B981', t:'✓ Approved' }
              : leave.hr_status === 'rejected' ? { c:'#F87171', d:'#F87171', t:'✗ Rejected' }
              : !isTL ? { c:'#818CF8', d:'#818CF8', t:'← You are here' }
              : { c:'rgba(241,245,249,0.3)', d:'rgba(255,255,255,0.15)', t:'Pending' };
            const hrLabel = isSuper ? 'Superuser' : 'HR';
            return (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:tlState.c }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:tlState.d }} />
                  TL {tlState.t}
                </div>
                <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.08)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:hrState.c }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:hrState.d }} />
                  {hrLabel} {hrState.t}
                </div>
              </div>
            );
          })()}

          <div>
            <label style={S.label}>Remarks <span style={{ color:'rgba(241,245,249,0.25)', textTransform:'none', fontWeight:400 }}>(optional)</span></label>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Add remarks for the employee…"
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
              boxShadow:'0 4px 16px rgba(52,211,153,0.3)', opacity: review.isPending ? 0.7 : 1, transition:'all 0.2s',
            }}
              onMouseEnter={e => { if (!review.isPending) e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform='none'}>
              <CheckCircle size={15} />
              {isTL ? 'Approve & Forward to HR' : 'Final Approve'}
            </button>
            <button onClick={() => review.mutate({ action:'rejected' })} disabled={review.isPending} style={{
              flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'7px',
              padding:'12px', fontSize:'13px', fontWeight:700,
              background:'linear-gradient(135deg,#EF4444,#F87171)', color:'white', border:'none', borderRadius:'10px',
              cursor: review.isPending ? 'not-allowed' : 'pointer',
              boxShadow:'0 4px 16px rgba(239,68,68,0.3)', opacity: review.isPending ? 0.7 : 1, transition:'all 0.2s',
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
  const { user } = useAuthStore();
  const isHR    = user?.role === 'hr';
  const isLead  = user?.role === 'lead';
  const isSuper = user?.role === 'superuser';
  const isHRLevel = isHR || isSuper;   // Level-2 final reviewers

  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [filter,   setFilter]   = useState('pending');

  const FILTERS = isLead
    ? ['pending', 'approved', 'rejected']
    : ['pending', 'approved', 'rejected', 'all'];

  const { data, isLoading } = useQuery({
    queryKey: ['pending-leaves', filter],
    queryFn:  () => leaveApi.pending({ status: filter, limit: 100 }),
  });

  const tc = useTableControls(data?.data || [], {
    searchKeys: ['user.first_name', 'user.last_name', 'user.department', 'type', 'reason', (r) => TYPE_LABELS[r.type]],
    initialSort: { key: 'createdAt', dir: 'desc' },
    pageSize: 12,
  });

  const pageTitle = isLead ? 'Team Leave Requests' : isSuper ? 'Leave Approvals — TL & HR' : 'Leave Management';
  const pageDesc  = isLead
    ? 'Review and approve leave requests from your team'
    : isSuper
      ? 'Approve or reject leave & permission requests submitted by Team Leads and HR'
      : 'Final approval for TL-reviewed employee leave requests';

  // Parallel review: TL acts while tl_status is null; HR/Superuser act while
  // hr_status is null — neither waits for the other.
  const canReview = (leave) => {
    if (leave.status !== 'pending') return false;
    if (isLead)    return leave.tl_status === null && !leave.tl_skipped;
    if (isHRLevel) {
      if (leave.hr_status != null) return false;
      if (!isSuper && leave.user?.role && leave.user.role !== 'employee') return false; // HR → employees only
      return true;
    }
    return false;
  };

  // Deep link from a notification email (…/leaves?review=<id>): land on that request —
  // open the review dialog if the user can act, otherwise the read-only workflow.
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewId = searchParams.get('review');
  useEffect(() => {
    if (!reviewId || !data?.data) return;
    const lv = data.data.find((l) => String(l.id) === String(reviewId));
    if (lv) { canReview(lv) ? setSelected(lv) : setDetail(lv); }
    setSearchParams({}, { replace: true });   // consume the param so it doesn't re-fire
  }, [reviewId, data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>
            {pageTitle}
          </h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>{pageDesc}</p>
        </div>
        {/* Approval level indicator */}
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', background: isLead ? 'rgba(251,191,36,0.12)' : isSuper ? 'rgba(244,114,182,0.12)' : 'rgba(129,140,248,0.08)', border:`1px solid ${isLead ? 'rgba(251,191,36,0.3)' : isSuper ? 'rgba(244,114,182,0.3)' : 'rgba(129,140,248,0.2)'}`, borderRadius:'20px', padding:'6px 14px', fontSize:'12px', fontWeight:600, color: isLead ? '#FBBF24' : isSuper ? '#F472B6' : '#818CF8' }}>
            <div style={{ width:'6px', height:'6px', background: isLead ? '#FBBF24' : isSuper ? '#F472B6' : '#818CF8', borderRadius:'50%' }} />
            {isLead ? 'Level 1 — TL Review' : isSuper ? 'Superuser — Final Authority' : 'Level 2 — HR Final'}
          </div>
        </div>
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
        <TableToolbar search={tc.search} setSearch={tc.setSearch} total={tc.total} placeholder="Search employee, type or reason…" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <SortTh label="Employee" sortKey="user.first_name" sort={tc.sort} toggleSort={tc.toggleSort} />
                <SortTh label="Type"     sortKey="type"           sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>Period</th>
                <th style={S.th}>Duration</th>
                <th style={S.th}>Reason</th>
                <SortTh label="Applied"  sortKey="createdAt"      sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>TL Status</th>
                {isHRLevel && <th style={S.th}>TL Reviewer</th>}
                <SortTh label="Current Status" sortKey="status"   sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>
              )}
              {!isLoading && !tc.total && (
                <tr><td colSpan={10} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>
                  No {filter === 'pending' && isLead ? 'pending TL review' : filter} leave requests
                </td></tr>
              )}
              {tc.view.map((leave) => (
                <tr key={leave.id}
                  onClick={() => setDetail(leave)}
                  style={{ transition:'background 0.12s', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <Avatar user={leave.user} size={32} gradient="linear-gradient(135deg,#F472B6,#EC4899)" fontSize="11px" />
                      <div>
                        <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{leave.user?.first_name} {leave.user?.last_name}</p>
                        <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'1px' }}>{leave.user?.department}</p>
                      </div>
                    </div>
                  </td>

                  <td style={{ ...S.td, textTransform:'capitalize' }}>{TYPE_LABELS[leave.type] || leave.type}</td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap' }}>
                    {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                  </td>
                  <td style={{ ...S.td, fontWeight:700, color:'#F1F5F9', whiteSpace:'nowrap' }}>{leaveDurationLabel(leave)}</td>
                  <td style={{ ...S.td, maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {leave.reason}
                  </td>
                  <td style={{ ...S.td, fontSize:'12px', color:'rgba(241,245,249,0.35)', whiteSpace:'nowrap' }}>
                    {formatDate(leave.createdAt || leave.created_at)}
                  </td>

                  {/* TL Status */}
                  <td style={S.td}><TlStatusBadge status={leave.tl_status} skipped={leave.tl_skipped} /></td>

                  {/* TL Reviewer name (HR / Superuser view) */}
                  {isHRLevel && (
                    <td style={{ ...S.td, fontSize:'12px' }}>
                      {leave.tlReviewer
                        ? <span style={{ color:'#F1F5F9', fontWeight:600 }}>{leave.tlReviewer.first_name} {leave.tlReviewer.last_name}</span>
                        : <span style={{ color:'rgba(241,245,249,0.2)' }}>—</span>}
                    </td>
                  )}

                  {/* Current stage — never shows TL approval before it happened */}
                  <td style={S.td}><StageBadge leave={leave} /></td>

                  <td style={S.td}>
                    {canReview(leave) && (
                      <button onClick={(e) => { e.stopPropagation(); setSelected(leave); }} style={{
                        fontSize:'12px', fontWeight:700,
                        color: isLead ? '#FBBF24' : '#818CF8',
                        background: isLead ? 'rgba(251,191,36,0.1)' : 'rgba(129,140,248,0.1)',
                        border: `1px solid ${isLead ? 'rgba(251,191,36,0.25)' : 'rgba(129,140,248,0.25)'}`,
                        cursor:'pointer', padding:'6px 12px', borderRadius:'8px', transition:'all 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.opacity='0.85'; e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='none'; }}>
                        {isLead ? 'TL Review' : isSuper ? 'Review' : 'HR Review'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={tc.page} pageCount={tc.pageCount} setPage={tc.setPage} total={tc.total} pageSize={tc.pageSize} />
      </div>

      {selected && (
        <ReviewModal leave={selected} role={user?.role} onClose={() => setSelected(null)} />
      )}
      {detail && <LeaveWorkflowModal leave={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
