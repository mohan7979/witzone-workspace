import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CalendarDays, FileText, Upload, CheckCircle } from 'lucide-react';
import { leaveApi, authApi } from '@/api';
import Badge from '@/components/ui/Badge';
import { formatDate, leaveDurationLabel } from '@/lib/utils';
import useAuthStore from '@/store/authStore';
import LeaveWorkflowModal from '@/components/LeaveWorkflowModal';
import { useTableControls, TableToolbar, SortTh, Pagination } from '@/components/ui/TableControls';
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

// WFH employees get 8 days personal leave (carry-forward), WFO employees get 12 days (resets)
// The balance shown to the employee reflects their work mode — only one "Personal Leave" type exists
const LEAVE_TYPES = [
  { value:'casual',     label:'Claimed Leave',       policy:'WFH: 8 days/yr (carry forward) · WFO: 12 days/yr' },
  { value:'sick',       label:'Sick Leave',          policy:'12 days / year · medical document / doctor note is mandatory' },
  { value:'marriage',   label:'Marriage Leave',      policy:'One-time entitlement of 5 days' },
  { value:'maternity',  label:'Maternity Leave',     policy:'One-time entitlement of up to 90 days (3 months)' },
  { value:'comp_off',   label:'Comp Off',            policy:'Earned by working on holidays / weekends · granted by HR' },
  { value:'long_leave', label:'Long Leave',          policy:'Emergency leave · no count restriction — apply any time' },
  { value:'permission', label:'Permission (Hourly)', policy:'Short hourly permission · entered and shown in hours' },
  { value:'unpaid',     label:'Unpaid Leave',        policy:'Leave without pay · no balance required' },
];

// Leave types that can be applied as a half day (with a time window).
const HALF_DAY_TYPES = ['casual', 'sick'];

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

// Maps leave type to the user balance field name.
// long_leave is intentionally absent — it's emergency leave with no balance gate.
const BALANCE_KEYS = {
  casual:     'casual_leave_balance',
  sick:       'sick_leave_balance',
  comp_off:   'comp_off_balance',
  marriage:   'marriage_leave_balance',
  maternity:  'maternity_leave_balance',
};

// Human-friendly balance labels
const BALANCE_LABELS = {
  casual:     'Claimed Leave',
  sick:       'Sick Leave',
  comp_off:   'Comp Off',
  marriage:   'Marriage Leave',
  maternity:  'Maternity Leave',
  long_leave: 'Long Leave',
};

function BalancePill({ type, user }) {
  const key = BALANCE_KEYS[type];
  if (!key || !user) return null;
  const balance = parseFloat(user[key] ?? 0);
  const low  = balance <= 2;
  const zero = balance <= 0;
  const color = zero ? '#F87171' : low ? '#FBBF24' : '#34D399';
  const bg    = zero ? 'rgba(248,113,113,0.1)' : low ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)';
  const bd    = zero ? 'rgba(248,113,113,0.3)' : low ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'7px', padding:'5px 12px', borderRadius:'20px', background:bg, border:`1px solid ${bd}` }}>
      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:color }} />
      <span style={{ fontSize:'12px', fontWeight:700, color }}>
        {balance} day{balance !== 1 ? 's' : ''} available
      </span>
      <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>· {BALANCE_LABELS[type]}</span>
    </div>
  );
}

function ApplyLeaveModal({ onClose }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const { user } = useAuthStore();
  // Lead / HR / Superuser requests bypass the TL and are decided by a Superuser.
  const isElevated = ['lead', 'hr', 'superuser'].includes(user?.role);
  const [form, setForm]     = useState({ type:'casual', start_date:'', end_date:'', start_time:'', end_time:'', reason:'', is_half_day:false });
  const [sickFile, setSickFile] = useState(null);
  const isPermission   = form.type === 'permission';
  const isSick         = form.type === 'sick';
  const canHalfDay     = HALF_DAY_TYPES.includes(form.type);
  const isHalfDay      = canHalfDay && form.is_half_day;
  const needsTimeWindow = isPermission || isHalfDay;
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const selectedType = LEAVE_TYPES.find(t => t.value === form.type);

  // Fetch current user data for balance display
  const { data: meData } = useQuery({
    queryKey: ['auth-me-modal'],
    queryFn: authApi.me,
    staleTime: 30000,
  });
  const me = meData?.user ?? meData;

  const apply = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      toast.success(isElevated
        ? 'Request submitted — Superuser will be notified'
        : 'Leave request submitted — your TL will be notified');
      qc.invalidateQueries(['my-leaves']);
      qc.invalidateQueries(['dashboard-stats']);
      qc.invalidateQueries(['auth-me-modal']);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSick && !sickFile) {
      toast.error('Please upload a medical certificate for sick leave');
      return;
    }
    if (needsTimeWindow && (!form.start_time || !form.end_time)) {
      toast.error(isHalfDay ? 'Please enter the half-day time window' : 'Please enter the permission time window');
      return;
    }
    // For a half-day, the leave is a single date.
    const payload = { ...form, is_half_day: isHalfDay, end_date: (needsTimeWindow ? form.start_date : form.end_date) };
    if (isSick && sickFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
      fd.append('medical_cert', sickFile);
      apply.mutate(fd);
    } else {
      apply.mutate(payload);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSickFile(file);
  };

  const clearFile = () => {
    setSickFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // When switching type: clear the sick-cert file if leaving sick, and reset the
  // half-day toggle if the new type can't be a half day.
  const handleTypeChange = (e) => {
    const next = e.target.value;
    setForm({ ...form, type: next, is_half_day: HALF_DAY_TYPES.includes(next) ? form.is_half_day : false });
    if (next !== 'sick') {
      setSickFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fmt = (bytes) => bytes < 1024*1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`;

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

        <form onSubmit={handleSubmit} style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>

          {/* Leave type */}
          <div>
            <label style={S.label}>Leave Type</label>
            <select value={form.type} onChange={handleTypeChange} style={S.input} onFocus={onFocus} onBlur={onBlur}>
              {LEAVE_TYPES.map(({ value, label }) => (
                <option key={value} value={value} style={{ background:'#0D1117' }}>{label}</option>
              ))}
            </select>
            {/* Balance pill for types that have a balance */}
            <BalancePill type={form.type} user={me} />
            {/* Policy note */}
            {selectedType?.policy && (
              <p style={{ fontSize:'11px', color:'rgba(244,114,182,0.6)', marginTop:'5px' }}>
                📋 {selectedType.policy}
              </p>
            )}
          </div>

          {/* Full day / Half day (Claimed & Sick) */}
          {canHalfDay && (
            <div>
              <label style={S.label}>Duration</label>
              <div style={{ display:'flex', gap:'8px' }}>
                {[{ v:false, l:'Full Day' }, { v:true, l:'Half Day' }].map(({ v, l }) => {
                  const active = form.is_half_day === v;
                  return (
                    <button key={l} type="button" onClick={() => setForm({ ...form, is_half_day: v })} style={{
                      flex:1, padding:'10px', fontSize:'12px', fontWeight:700, borderRadius:'10px', cursor:'pointer', transition:'all 0.15s',
                      background: active ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.05)',
                      color: active ? '#F472B6' : 'rgba(241,245,249,0.6)',
                      border: `1.5px solid ${active ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    }}>{l}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dates — single date for permission & half-day, range otherwise */}
          <div style={{ display:'grid', gridTemplateColumns: needsTimeWindow ? '1fr' : '1fr 1fr', gap:'12px' }}>
            <div>
              <label style={S.label}>{needsTimeWindow ? 'Date' : 'From Date'}</label>
              <input type="date" required value={form.start_date} onChange={f('start_date')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
            </div>
            {!needsTimeWindow && (
              <div>
                <label style={S.label}>To Date</label>
                <input type="date" required value={form.end_date} onChange={f('end_date')} style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
            )}
          </div>

          {/* Time window — permission OR half-day */}
          {needsTimeWindow && (
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

          {/* Medical certificate upload — sick leave only */}
          {isSick && (
            <div style={{ background:'rgba(251,191,36,0.06)', border:`1px solid ${sickFile ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.25)'}`, borderRadius:'12px', padding:'14px', transition:'border-color 0.2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'12px' }}>
                <FileText size={14} color={sickFile ? '#34D399' : '#FBBF24'} />
                <span style={{ fontSize:'12px', fontWeight:700, color: sickFile ? '#34D399' : '#FBBF24' }}>
                  Medical Certificate Required
                </span>
                <span style={{ fontSize:'10px', color:'rgba(241,245,249,0.3)', marginLeft:'auto' }}>PDF, JPG or PNG · max 5 MB</span>
              </div>

              {!sickFile ? (
                /* Drop zone / file picker */
                <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', padding:'20px', borderRadius:'10px', border:'1.5px dashed rgba(251,191,36,0.35)', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(251,191,36,0.05)'; e.currentTarget.style.borderColor='rgba(251,191,36,0.6)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(251,191,36,0.35)'; }}>
                  <Upload size={20} color="rgba(251,191,36,0.7)" />
                  <span style={{ fontSize:'12px', color:'rgba(251,191,36,0.8)', fontWeight:600 }}>Click to upload medical certificate</span>
                  <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)' }}>or drag and drop</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    style={{ display:'none' }}
                  />
                </label>
              ) : (
                /* File preview */
                <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderRadius:'10px', background:'rgba(52,211,153,0.07)', border:'1px solid rgba(52,211,153,0.2)' }}>
                  <CheckCircle size={16} color="#34D399" />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'12px', fontWeight:600, color:'#F1F5F9', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sickFile.name}</p>
                    <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)', marginTop:'2px' }}>{fmt(sickFile.size)}</p>
                  </div>
                  <button type="button" onClick={clearFile} style={{ background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:'6px', cursor:'pointer', color:'#F87171', padding:'4px 8px', fontSize:'11px', fontWeight:600 }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Approval flow info — elevated roles (Lead/HR/Superuser) route to Superuser */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#A78BFA', flexShrink:0 }} />
            {isElevated ? (
              <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.55)' }}>
                Your request goes to <strong style={{ color:'#A78BFA' }}>Superuser and HR</strong> for approval
              </span>
            ) : (
              <>
                <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>Your request goes to</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#FBBF24' }}>Team Lead</span>
                <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>→ then</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#818CF8' }}>HR</span>
                <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)' }}>for final approval</span>
              </>
            )}
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
  const [detail, setDetail]       = useState(null);
  const [filter, setFilter]       = useState('all');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-leaves', filter],
    queryFn:  () => leaveApi.myLeaves({ limit:50, status: filter === 'all' ? undefined : filter }),
  });

  const tc = useTableControls(data?.data || [], {
    searchKeys: ['type', 'reason', 'status', (r) => TYPE_LABELS[r.type]],
    initialSort: { key: 'createdAt', dir: 'desc' },
    pageSize: 10,
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
        <TableToolbar search={tc.search} setSearch={tc.setSearch} total={tc.total} placeholder="Search type or reason…" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <SortTh label="Type" sortKey="type" sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>Period</th>
                <th style={S.th}>Duration</th>
                <SortTh label="Requested" sortKey="createdAt" sort={tc.sort} toggleSort={tc.toggleSort} />
                <SortTh label="TL / HR Status" sortKey="status" sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>Reason / Remarks</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>
              )}
              {!isLoading && !tc.total && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No records found</td></tr>
              )}
              {tc.view.map((leave) => (
                <tr key={leave.id}
                  onClick={() => setDetail(leave)}
                  style={{ transition:'background 0.12s', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>
                    {TYPE_LABELS[leave.type] || leave.type}
                  </td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap' }}>
                    {formatDate(leave.start_date)}{leave.start_date !== leave.end_date ? ` — ${formatDate(leave.end_date)}` : ''}
                  </td>
                  <td style={{ ...S.td, fontWeight:700, color:'#F1F5F9', whiteSpace:'nowrap' }}>{leaveDurationLabel(leave)}</td>
                  <td style={{ ...S.td, fontSize:'12px', whiteSpace:'nowrap', color:'rgba(241,245,249,0.45)' }}>{formatDate(leave.createdAt || leave.created_at)}</td>
                  <td style={S.td}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      <Badge status={leave.status} />
                      <TlStatusPill leave={leave} />
                    </div>
                  </td>
                  <td style={{ ...S.td, maxWidth:'220px' }}>
                    <div style={{ color:'rgba(241,245,249,0.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {leave.reason || '—'}
                    </div>
                    {(leave.reviewer_comment || leave.tl_comment) && (
                      <div style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)', marginTop:'3px', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        ↳ {leave.reviewer_comment || leave.tl_comment}
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    {leave.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); cancel.mutate(leave.id); }} style={{
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
        <Pagination page={tc.page} pageCount={tc.pageCount} setPage={tc.setPage} total={tc.total} pageSize={tc.pageSize} />
      </div>

      {showModal && <ApplyLeaveModal onClose={() => setShowModal(false)} />}
      {detail && <LeaveWorkflowModal leave={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
