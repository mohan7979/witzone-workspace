import { X, FileText, UserCircle2, CheckCircle2, XCircle, Clock3, ArrowRight } from 'lucide-react';
import { formatDate, formatTime, leaveTypeLabel, leaveDurationLabel } from '@/lib/utils';

const dt = (x) => (x ? `${formatDate(x)} · ${formatTime(x)}` : '—');
const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '');

const TONE = {
  done:    { dot:'#34D399', ring:'rgba(52,211,153,0.25)', text:'#34D399' },
  reject:  { dot:'#F87171', ring:'rgba(248,113,113,0.25)', text:'#F87171' },
  pending: { dot:'#FBBF24', ring:'rgba(251,191,36,0.25)', text:'#FBBF24' },
  muted:   { dot:'#64748B', ring:'rgba(148,163,184,0.2)',  text:'rgba(203,213,225,0.7)' },
};

function Stage({ tone, title, who, when, comment, last }) {
  const t = TONE[tone] || TONE.muted;
  return (
    <div style={{ display:'flex', gap:'12px' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'18px', flexShrink:0 }}>
        <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:t.dot, boxShadow:`0 0 0 3px ${t.ring}`, marginTop:'4px' }} />
        {!last && <div style={{ flex:1, width:'2px', background:'rgba(255,255,255,0.08)', minHeight:'14px', marginTop:'4px' }} />}
      </div>
      <div style={{ flex:1, paddingBottom:last ? 0 : '16px' }}>
        <p style={{ fontSize:'13px', fontWeight:700, color:t.text }}>{title}</p>
        {who   && <p style={{ fontSize:'12px', color:'#F1F5F9', marginTop:'2px' }}>{who}</p>}
        {when  && <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)', marginTop:'1px' }}>{when}</p>}
        {comment && (
          <p style={{ fontSize:'12px', color:'rgba(241,245,249,0.7)', marginTop:'6px', padding:'8px 10px', background:'rgba(255,255,255,0.03)', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.06)' }}>
            “{comment}”
          </p>
        )}
      </div>
    </div>
  );
}

export default function LeaveWorkflowModal({ leave, onClose }) {
  if (!leave) return null;
  const stages = [];

  // 1) Applied
  stages.push({
    tone: 'done', title: 'Request Submitted',
    who: `Applied by ${fullName(leave.user) || 'Employee'}`,
    when: dt(leave.createdAt || leave.created_at),
  });

  // 2) Team Lead stage
  if (leave.tl_skipped) {
    stages.push({ tone:'muted', title:'Team Lead — Skipped', who:'No Team Lead assigned — routed directly to the final approver' });
  } else if (leave.tl_status === 'approved') {
    stages.push({ tone:'done', title:'Approved by Team Lead', who: fullName(leave.tlReviewer) ? `By ${fullName(leave.tlReviewer)}` : undefined, when: dt(leave.tl_reviewed_at), comment: leave.tl_comment });
  } else if (leave.tl_status === 'rejected') {
    stages.push({ tone:'reject', title:'Rejected by Team Lead', who: fullName(leave.tlReviewer) ? `By ${fullName(leave.tlReviewer)}` : undefined, when: dt(leave.tl_reviewed_at), comment: leave.tl_comment });
  } else {
    stages.push({ tone:'pending', title:'Pending Team Lead Approval' });
  }

  // 3) Final (HR / Superuser) stage — only if TL didn't end the flow
  if (leave.tl_status !== 'rejected') {
    if (leave.status === 'approved') {
      stages.push({ tone:'done', title:'Final Approval Granted', who: fullName(leave.reviewer) ? `By ${fullName(leave.reviewer)}` : undefined, when: dt(leave.reviewed_at), comment: leave.reviewer_comment });
    } else if (leave.status === 'rejected') {
      stages.push({ tone:'reject', title:'Rejected at Final Approval', who: fullName(leave.reviewer) ? `By ${fullName(leave.reviewer)}` : undefined, when: dt(leave.reviewed_at), comment: leave.reviewer_comment });
    } else if (leave.status === 'cancelled') {
      stages.push({ tone:'muted', title:'Request Cancelled' });
    } else {
      stages.push({ tone:'pending', title: (leave.tl_status === 'approved' || leave.tl_skipped) ? 'Pending HR / Superuser Approval' : 'Final Approval' });
    }
  }

  const rows = [
    ['Employee', fullName(leave.user) || '—'],
    ['Leave Type', leaveTypeLabel(leave.type)],
    ['Period', `${formatDate(leave.start_date)}${leave.start_date !== leave.end_date ? ` — ${formatDate(leave.end_date)}` : ''}`],
    ['Duration', leaveDurationLabel(leave)],
    ...(leave.reason ? [['Reason', leave.reason]] : []),
  ];

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'500px', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)', flexShrink:0 }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#818CF8,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FileText size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Approval Workflow</p>
              <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'2px' }}>Full request history</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 22px' }}>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', padding:'14px 16px', border:'1px solid rgba(255,255,255,0.06)', marginBottom:'20px' }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display:'flex', gap:'14px', marginBottom:'8px' }}>
                <span style={{ fontSize:'12px', color:'rgba(241,245,249,0.3)', width:'90px', flexShrink:0 }}>{k}</span>
                <span style={{ fontSize:'12px', color:'#F1F5F9', fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'14px' }}>Timeline</p>
          {stages.map((s, i) => <Stage key={i} {...s} last={i === stages.length - 1} />)}
        </div>
      </div>
    </div>
  );
}
