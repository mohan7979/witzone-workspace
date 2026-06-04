import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, KeyRound, UserX, UserCheck, Users, AlertTriangle, Pencil, IdCard } from 'lucide-react';
import { userApi, authApi, masterApi } from '@/api';
import Badge from '@/components/ui/Badge';
import MasterDataFields from '@/components/hr/MasterDataFields';
import EmployeeDetailsModal from '@/components/hr/EmployeeDetailsModal';
import { useTableControls, SortTh, Pagination } from '@/components/ui/TableControls';
import toast from 'react-hot-toast';

const ROLE_LABEL = { hr: 'HR Admin', lead: 'Team Lead', employee: 'Employee' };

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const glass = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

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

const focusStyle = (e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; };
const blurStyle  = (e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

/* ── Shared lead dropdown + no-leads warning ─────────────────── */
function LeadSelector({ value, onChange, leads, role }) {
  const needsLead = role === 'employee';
  if (!needsLead) return null;

  return (
    <div style={{
      background: 'rgba(129,140,248,0.06)',
      border: `1.5px solid ${value ? 'rgba(129,140,248,0.35)' : 'rgba(251,191,36,0.3)'}`,
      borderRadius: '12px', padding: '14px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }}>
        <Users size={14} color={value ? '#818CF8' : '#FBBF24'} />
        <span style={{ fontSize:'12px', fontWeight:700, color: value ? '#818CF8' : '#FBBF24' }}>
          Assign Team Lead
        </span>
        <span style={{ fontSize:'10px', color:'rgba(241,245,249,0.35)', marginLeft:'4px' }}>
          · Leave requests will be routed to this person for approval
        </span>
      </div>

      {leads.length === 0 ? (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px', borderRadius:'8px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)' }}>
          <AlertTriangle size={13} color="#FBBF24" />
          <span style={{ fontSize:'12px', color:'#FBBF24' }}>No Team Leads found. Create a user with role "Team Lead" first.</span>
        </div>
      ) : (
        <>
          <select
            value={value}
            onChange={onChange}
            style={{
              ...S.input,
              borderColor: value ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.1)',
            }}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="" style={{ background:'#0D1117' }}>— Select a Team Lead —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id} style={{ background:'#0D1117' }}>
                {l.first_name} {l.last_name}{l.department ? ` · ${l.department}` : ''}
              </option>
            ))}
          </select>
          {!value && (
            <p style={{ fontSize:'11px', color:'rgba(251,191,36,0.7)', marginTop:'6px' }}>
              ⚠️ Without a Team Lead, leave requests will skip TL review and go directly to HR.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Create Employee Modal ───────────────────────────────────── */
function CreateUserModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_id:'', first_name:'', last_name:'', email:'',
    role:'employee', work_mode:'wfo', department:'', designation:'', phone:'',
    shift_id:'', manager_id:'', dob:'', doj:'',
    // Custom leave allocation (optional — blank uses policy defaults)
    casual_leave_balance:'', sick_leave_balance:'', comp_off_balance:'',
    marriage_leave_balance:'', maternity_leave_balance:'', long_leave_balance:'',
  });
  const [showMaster, setShowMaster] = useState(false);
  const [showLeaves, setShowLeaves] = useState(false);
  const isMarried = form.marital_status === 'married';

  const fv = (k) => (e) => {
    const val = e.target.value;
    if (k === 'department') setForm(f => ({ ...f, department: val, designation: '' }));
    else if (k === 'role')  setForm(f => ({ ...f, role: val, manager_id: '' }));
    else                    setForm(f => ({ ...f, [k]: val }));
  };

  const { data: deptData }  = useQuery({ queryKey:['master-departments'],  queryFn:masterApi.listDepartments,  staleTime:5*60*1000 });
  const { data: desigData } = useQuery({ queryKey:['master-designations'], queryFn:masterApi.listDesignations, staleTime:5*60*1000 });
  const { data: shiftData } = useQuery({ queryKey:['master-shifts'],       queryFn:masterApi.listShifts,       staleTime:5*60*1000 });
  const { data: leadsData } = useQuery({ queryKey:['users-leads'],         queryFn:() => userApi.list({ role:'lead', limit:100, status:'active' }), staleTime:5*60*1000 });

  const departments  = (deptData?.data  || []).filter(d => d.is_active).map(d => d.name);
  const shifts       = (shiftData?.data || []).filter(s => s.is_active);
  const leads        = (leadsData?.data || []);
  const allDesigs    = (desigData?.data || []);
  const designations = form.department
    ? allDesigs.filter(d => !d.department || d.department === form.department)
    : allDesigs;

  const create = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      toast.success('Employee created. Credentials sent via email.');
      qc.invalidateQueries(['users']);
      qc.invalidateQueries(['dashboard-stats']);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'520px', maxHeight:'92vh', overflowY:'auto' }}>

        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(96,165,250,0.5),transparent)' }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'sticky', top:0, background:'rgba(13,17,30,0.98)', borderRadius:'20px 20px 0 0', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#60A5FA,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={16} color="white" />
            </div>
            <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>Add New Employee</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Employee ID */}
          <div>
            <label style={S.label}>Employee ID <span style={{ color:'#F87171', fontSize:'10px' }}>*Manual</span></label>
            <input required placeholder="e.g. EMP0010" value={form.employee_id} onChange={fv('employee_id')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          {/* Name */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div><label style={S.label}>First Name</label><input required value={form.first_name} onChange={fv('first_name')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
            <div><label style={S.label}>Last Name</label><input required value={form.last_name} onChange={fv('last_name')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
          </div>

          {/* Email */}
          <div><label style={S.label}>Work Email</label><input type="email" required value={form.email} onChange={fv('email')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>

          {/* Role + Work Mode */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={S.label}>Role</label>
              <select value={form.role} onChange={fv('role')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="employee" style={{ background:'#0D1117' }}>Employee</option>
                <option value="lead"     style={{ background:'#0D1117' }}>Team Lead</option>
                <option value="hr"       style={{ background:'#0D1117' }}>HR Admin</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Work Mode</label>
              <select value={form.work_mode} onChange={fv('work_mode')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="wfo" style={{ background:'#0D1117' }}>🏢 Work From Office (WFO)</option>
                <option value="wfh" style={{ background:'#0D1117' }}>🏠 Work From Home (WFH)</option>
              </select>
            </div>
          </div>

          {/* ── Team Lead assignment — shown only for employees ── */}
          <LeadSelector
            value={form.manager_id}
            onChange={fv('manager_id')}
            leads={leads}
            role={form.role}
          />

          {/* Department */}
          <div>
            <label style={S.label}>Department</label>
            <select value={form.department} onChange={fv('department')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="" style={{ background:'#0D1117' }}>Select department</option>
              {departments.map((d) => <option key={d} style={{ background:'#0D1117' }}>{d}</option>)}
            </select>
          </div>

          {/* Designation + Phone */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={S.label}>Designation</label>
              <select value={form.designation} onChange={fv('designation')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="" style={{ background:'#0D1117' }}>Select designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.name} style={{ background:'#0D1117' }}>{d.name}</option>
                ))}
              </select>
              {designations.length === 0 && form.department && (
                <p style={{ fontSize:'10px', color:'#F87171', marginTop:'3px' }}>No designations for this dept</p>
              )}
            </div>
            <div><label style={S.label}>Phone</label><input value={form.phone} onChange={fv('phone')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
          </div>

          {/* DOB + DOJ */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div><label style={S.label}>Date of Birth</label><input type="date" value={form.dob} onChange={fv('dob')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
            <div><label style={S.label}>Date of Joining</label><input type="date" value={form.doj} onChange={fv('doj')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
          </div>

          {/* Shift */}
          <div>
            <label style={S.label}>Shift</label>
            <select value={form.shift_id} onChange={fv('shift_id')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="" style={{ background:'#0D1117' }}>Select shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id} style={{ background:'#0D1117' }}>
                  {s.name} ({s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)})
                </option>
              ))}
            </select>
          </div>

          {/* Optional master-data section — can be filled now or later via Details */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:'16px' }}>
            <button type="button" onClick={() => setShowMaster(s => !s)} style={{
              display:'flex', alignItems:'center', gap:'8px', background:'none', border:'none', cursor:'pointer', padding:0,
              fontSize:'12px', fontWeight:700, color:'#A78BFA', textTransform:'uppercase', letterSpacing:'1px',
            }}>
              {showMaster ? '▾' : '▸'} Personal Details (optional)
            </button>
            {showMaster && (
              <div style={{ marginTop:'16px' }}>
                <MasterDataFields form={form} onField={fv} />
              </div>
            )}
          </div>

          {/* Custom leave allocation — for mid-year joiners HR can set exact counts */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:'16px' }}>
            <button type="button" onClick={() => setShowLeaves(s => !s)} style={{
              display:'flex', alignItems:'center', gap:'8px', background:'none', border:'none', cursor:'pointer', padding:0,
              fontSize:'12px', fontWeight:700, color:'#34D399', textTransform:'uppercase', letterSpacing:'1px',
            }}>
              {showLeaves ? '▾' : '▸'} Leave Allocation (optional)
            </button>
            {showLeaves && (
              <div style={{ marginTop:'14px' }}>
                <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.4)', marginBottom:'12px' }}>
                  Leave blank to use the standard policy. Set custom counts for mid-year joiners who can't avail the full-year quota.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  {[
                    ['casual_leave_balance', `Claimed Leave (default ${form.work_mode === 'wfh' ? 8 : 12})`],
                    ['sick_leave_balance',   'Sick Leave (default 12)'],
                    ['comp_off_balance',     'Comp Off (default 0)'],
                    ['marriage_leave_balance','Marriage Leave (default 5)'],
                    ...(isMarried ? [['maternity_leave_balance', 'Maternity Leave (default 90)']] : []),
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label style={S.label}>{label}</label>
                      <input type="number" min="0" step="0.5" placeholder="default" value={form[k]} onChange={fv(k)} style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
                    </div>
                  ))}
                </div>
                {!isMarried && (
                  <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'10px' }}>
                    Maternity leave applies to married employees only — set Marital Status to “Married” in Personal Details to allocate it.
                  </p>
                )}
              </div>
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
            <button type="submit" disabled={create.isPending} style={{
              flex:1, padding:'12px', fontSize:'13px', fontWeight:700,
              color:'white', background: create.isPending ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              border:'none', borderRadius:'10px', cursor: create.isPending ? 'not-allowed' : 'pointer',
              boxShadow: create.isPending ? 'none' : '0 4px 16px rgba(99,102,241,0.4)', transition:'all 0.2s',
            }}>
              {create.isPending ? 'Creating…' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Lead Modal (reassign TL for existing employee) ─────── */
function EditLeadModal({ user, onClose }) {
  const qc = useQueryClient();
  const [managerId, setManagerId] = useState(user.manager_id || '');

  const { data: leadsData } = useQuery({
    queryKey: ['users-leads'],
    queryFn: () => userApi.list({ role:'lead', limit:100, status:'active' }),
    staleTime: 5*60*1000,
  });
  const leads = leadsData?.data || [];

  const save = useMutation({
    mutationFn: () => userApi.update(user.id, { manager_id: managerId || null }),
    onSuccess: () => {
      toast.success(`Team Lead updated for ${user.first_name}`);
      qc.invalidateQueries(['users']);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'400px' }}>
        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)' }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#818CF8,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize:'14px', fontWeight:700, color:'#F1F5F9' }}>Assign Team Lead</p>
              <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)' }}>{user.first_name} {user.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>
          <div>
            <label style={S.label}>Team Lead</label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="" style={{ background:'#0D1117' }}>— No TL (leave goes directly to HR) —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id} style={{ background:'#0D1117' }}>
                  {l.first_name} {l.last_name}{l.department ? ` · ${l.department}` : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)', marginTop:'6px' }}>
              Leave requests from {user.first_name} will be sent to this person for first-level approval.
            </p>
          </div>

          <div style={{ display:'flex', gap:'12px' }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'11px', fontSize:'13px', fontWeight:600,
              color:'rgba(241,245,249,0.6)', background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', cursor:'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
              Cancel
            </button>
            <button onClick={() => save.mutate()} disabled={save.isPending} style={{
              flex:1, padding:'11px', fontSize:'13px', fontWeight:700,
              color:'white', background: save.isPending ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#818CF8,#6366F1)',
              border:'none', borderRadius:'10px', cursor: save.isPending ? 'not-allowed' : 'pointer',
              boxShadow: save.isPending ? 'none' : '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editLeadFor, setEditLeadFor] = useState(null); // user object
  const [detailsFor, setDetailsFor]   = useState(null); // { id, edit }
  const [search, setSearch]           = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebounce(search, 400);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', debouncedSearch, showInactive],
    queryFn: () => userApi.list({ search:debouncedSearch, status: showInactive ? 'inactive' : 'active', limit:100 }),
  });

  // Fetch all leads once for the table's "Team Lead" column
  const { data: leadsData } = useQuery({
    queryKey: ['users-leads'],
    queryFn: () => userApi.list({ role:'lead', limit:100, status:'active' }),
    staleTime: 5*60*1000,
  });
  const leadsMap = Object.fromEntries((leadsData?.data || []).map(l => [l.id, `${l.first_name} ${l.last_name}`]));

  // Sorting + pagination (search is handled server-side by the box above).
  const tc = useTableControls(data?.data || [], { initialSort: { key: 'first_name', dir: 'asc' }, pageSize: 12 });

  const resetPassword = useMutation({ mutationFn:authApi.resetPassword, onSuccess:() => toast.success('Password reset. Credentials sent via email.'), onError:(e) => toast.error(e.message) });
  const terminate     = useMutation({ mutationFn:userApi.terminate,     onSuccess:() => { toast.success('Employee terminated.');  qc.invalidateQueries(['users']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });
  const reactivate    = useMutation({ mutationFn:userApi.reactivate,    onSuccess:() => { toast.success('Employee reactivated.'); qc.invalidateQueries(['users']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });
  const changeWorkMode = useMutation({
    mutationFn: ({ id, work_mode }) => userApi.changeWorkMode(id, work_mode),
    onSuccess: (r) => { toast.success(r.message || 'Work mode updated'); qc.invalidateQueries(['users']); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>Employees</h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Manage employee accounts and access</p>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <button onClick={() => setShowInactive(!showInactive)} style={{
            display:'inline-flex', alignItems:'center', gap:'7px',
            padding:'10px 16px', fontSize:'12px', fontWeight:600,
            borderRadius:'10px', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer',
            background: showInactive ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
            color: showInactive ? '#F87171' : 'rgba(241,245,249,0.5)',
            transition:'all 0.15s',
          }}>
            <UserX size={14} />
            {showInactive ? 'Viewing Terminated' : 'Show Terminated'}
          </button>
          <button onClick={() => setShowCreate(true)} style={{
            display:'inline-flex', alignItems:'center', gap:'7px',
            padding:'11px 20px', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', color:'white',
            fontSize:'13px', fontWeight:700, borderRadius:'10px', border:'none',
            cursor:'pointer', boxShadow:'0 4px 16px rgba(99,102,241,0.4)', transition:'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(99,102,241,0.4)'; }}>
            <Plus size={15} /> Add Employee
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', maxWidth:'300px' }}>
        <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'rgba(241,245,249,0.3)', pointerEvents:'none' }} />
        <input
          placeholder="Search name, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width:'100%', padding:'10px 14px 10px 36px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s' }}
          onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
          onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
        />
      </div>

      {/* Table */}
      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'1000px', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <SortTh label="Employee"   sortKey="first_name"  sort={tc.sort} toggleSort={tc.toggleSort} />
                <SortTh label="ID"         sortKey="employee_id" sort={tc.sort} toggleSort={tc.toggleSort} />
                <SortTh label="Department"  sortKey="department"  sort={tc.sort} toggleSort={tc.toggleSort} />
                <SortTh label="Role"        sortKey="role"        sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>Team Lead</th>
                <th style={S.th}>Mode</th>
                <SortTh label="Status"      sortKey="status"      sort={tc.sort} toggleSort={tc.toggleSort} />
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
              {!isLoading && !tc.total && <tr><td colSpan={8} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No employees found</td></tr>}
              {tc.view.map((user) => {
                const leadName = user.manager_id ? (leadsMap[user.manager_id] || '—') : null;
                return (
                  <tr key={user.id}
                    style={{ transition:'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    {/* Name + email */}
                    <td style={S.td}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:700, flexShrink:0, boxShadow:'0 0 10px rgba(99,102,241,0.3)' }}>
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div>
                          <p style={{ fontWeight:600, color:'#F1F5F9', fontSize:'13px' }}>{user.first_name} {user.last_name}</p>
                          <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.3)', marginTop:'1px' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:'12px', color:'rgba(241,245,249,0.5)' }}>{user.employee_id}</td>
                    <td style={S.td}>{user.department || '—'}</td>
                    <td style={S.td}>{ROLE_LABEL[user.role] || user.role}</td>

                    {/* Team Lead column */}
                    <td style={S.td}>
                      {user.role === 'employee' ? (
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          {leadName ? (
                            <span style={{ fontSize:'12px', fontWeight:600, color:'#818CF8' }}>{leadName}</span>
                          ) : (
                            <span style={{ fontSize:'11px', color:'rgba(251,191,36,0.7)', display:'flex', alignItems:'center', gap:'4px' }}>
                              <AlertTriangle size={11} /> Not assigned
                            </span>
                          )}
                          <button
                            onClick={() => setEditLeadFor(user)}
                            title="Change Team Lead"
                            style={{ background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:'5px', cursor:'pointer', color:'#818CF8', padding:'2px 5px', display:'flex', alignItems:'center', transition:'all 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(129,140,248,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(129,140,248,0.1)'}
                          >
                            <Pencil size={10} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize:'11px', color:'rgba(241,245,249,0.2)' }}>—</span>
                      )}
                    </td>

                    {/* Work mode — click to switch WFH ↔ WFO (HR, audited) */}
                    <td style={S.td}>
                      {(() => {
                        const isWFH = user.work_mode === 'wfh';
                        const next  = isWFH ? 'wfo' : 'wfh';
                        const nextLabel = isWFH ? 'Work From Office (WFO)' : 'Work From Home (WFH)';
                        const disabled = user.status !== 'active' || changeWorkMode.isPending;
                        return (
                          <button
                            disabled={disabled}
                            title={disabled ? undefined : `Switch ${user.first_name} to ${nextLabel}`}
                            onClick={() => {
                              if (window.confirm(`Switch ${user.first_name} ${user.last_name} to ${nextLabel}?`))
                                changeWorkMode.mutate({ id: user.id, work_mode: next });
                            }}
                            style={{ fontSize:'10px', fontWeight:700, padding:'3px 9px', borderRadius:5, cursor: disabled ? 'default' : 'pointer',
                              background: isWFH ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)',
                              color: isWFH ? '#38BDF8' : '#A78BFA',
                              border: isWFH ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(167,139,250,0.3)',
                              transition:'all 0.15s', opacity: disabled ? 0.6 : 1,
                            }}
                            onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                          >
                            {isWFH ? '🏠 WFH' : '🏢 WFO'}
                          </button>
                        );
                      })()}
                    </td>

                    <td style={S.td}><Badge status={user.status} /></td>

                    {/* Actions */}
                    <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button onClick={() => setDetailsFor({ id: user.id, edit: false })} style={{
                          display:'inline-flex', alignItems:'center', gap:'5px',
                          fontSize:'11px', fontWeight:700, color:'#A78BFA',
                          background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)',
                          cursor:'pointer', padding:'5px 10px', borderRadius:'7px', transition:'all 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(167,139,250,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background='rgba(167,139,250,0.1)'}>
                          <IdCard size={12} /> Details
                        </button>
                        {user.status === 'active' && (
                          <button onClick={() => { if (window.confirm(`Reset password for ${user.first_name}?`)) resetPassword.mutate(user.id); }} style={{
                            display:'inline-flex', alignItems:'center', gap:'5px',
                            fontSize:'11px', fontWeight:700, color:'#FBBF24',
                            background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)',
                            cursor:'pointer', padding:'5px 10px', borderRadius:'7px', transition:'all 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(251,191,36,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(251,191,36,0.1)'}>
                            <KeyRound size={12} /> Reset
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button onClick={() => { if (window.confirm(`Terminate ${user.first_name} ${user.last_name}? They will lose all access.`)) terminate.mutate(user.id); }} style={{
                            display:'inline-flex', alignItems:'center', gap:'5px',
                            fontSize:'11px', fontWeight:700, color:'#F87171',
                            background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)',
                            cursor:'pointer', padding:'5px 10px', borderRadius:'7px', transition:'all 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
                            <UserX size={12} /> Terminate
                          </button>
                        )}
                        {user.status === 'inactive' && (
                          <button onClick={() => { if (window.confirm(`Reactivate ${user.first_name} ${user.last_name}?`)) reactivate.mutate(user.id); }} style={{
                            display:'inline-flex', alignItems:'center', gap:'5px',
                            fontSize:'11px', fontWeight:700, color:'#34D399',
                            background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)',
                            cursor:'pointer', padding:'5px 10px', borderRadius:'7px', transition:'all 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(52,211,153,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(52,211,153,0.1)'}>
                            <UserCheck size={12} /> Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={tc.page} pageCount={tc.pageCount} setPage={tc.setPage} total={tc.total} pageSize={tc.pageSize} />
      </div>

      {showCreate  && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {editLeadFor && <EditLeadModal user={editLeadFor} onClose={() => setEditLeadFor(null)} />}
      {detailsFor  && <EmployeeDetailsModal userId={detailsFor.id} startInEdit={detailsFor.edit} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}
