import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, KeyRound, UserX, UserCheck, Users } from 'lucide-react';
import { userApi, authApi, masterApi } from '@/api';
import Badge from '@/components/ui/Badge';
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

function CreateUserModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', role:'employee', department:'', designation:'', phone:'', shift_start:'09:00', shift_end:'18:00' });
  const fv = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const { data: deptData } = useQuery({ queryKey:['master-departments'], queryFn:masterApi.listDepartments, staleTime:5*60*1000 });
  const departments = (deptData?.data || []).filter(d => d.is_active).map(d => d.name);

  const create = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => { toast.success('Employee created. Credentials sent via email.'); qc.invalidateQueries(['users']); qc.invalidateQueries(['dashboard-stats']); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const focusStyle = (e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; };
  const blurStyle  = (e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

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
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(241,245,249,0.5)'; }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div><label style={S.label}>First Name</label><input required value={form.first_name} onChange={fv('first_name')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
            <div><label style={S.label}>Last Name</label><input required value={form.last_name} onChange={fv('last_name')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
          </div>
          <div><label style={S.label}>Work Email</label><input type="email" required value={form.email} onChange={fv('email')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
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
              <label style={S.label}>Department</label>
              <select value={form.department} onChange={fv('department')} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="" style={{ background:'#0D1117' }}>Select department</option>
                {departments.map((d) => <option key={d} style={{ background:'#0D1117' }}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div><label style={S.label}>Designation</label><input value={form.designation} onChange={fv('designation')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
            <div><label style={S.label}>Phone</label><input value={form.phone} onChange={fv('phone')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div><label style={S.label}>Shift Start</label><input type="time" value={form.shift_start} onChange={fv('shift_start')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
            <div><label style={S.label}>Shift End</label><input type="time" value={form.shift_end} onChange={fv('shift_end')} style={S.input} onFocus={focusStyle} onBlur={blurStyle} /></div>
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

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebounce(search, 400);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', debouncedSearch, showInactive],
    queryFn: () => userApi.list({ search:debouncedSearch, status: showInactive ? 'inactive' : 'active', limit:100 }),
  });

  const resetPassword = useMutation({ mutationFn:authApi.resetPassword, onSuccess:() => toast.success('Password reset. New credentials sent via email.'), onError:(e) => toast.error(e.message) });
  const terminate     = useMutation({ mutationFn:userApi.terminate,     onSuccess:() => { toast.success('Employee terminated.');  qc.invalidateQueries(['users']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });
  const reactivate    = useMutation({ mutationFn:userApi.reactivate,    onSuccess:() => { toast.success('Employee reactivated.'); qc.invalidateQueries(['users']); qc.invalidateQueries(['dashboard-stats']); }, onError:(e) => toast.error(e.message) });

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
          style={{
            width:'100%', padding:'10px 14px 10px 36px', fontSize:'13px',
            background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)',
            borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
          onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
        />
      </div>

      {/* Table */}
      <div style={glass}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'900px', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Employee','ID','Department','Role','Shift','Status','Actions'].map((h) => (
                  <th key={h} style={{ padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>Loading…</td></tr>}
              {!isLoading && !data?.data?.length && <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No employees found</td></tr>}
              {data?.data?.map((user) => (
                <tr key={user.id}
                  style={{ transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <td style={{ padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
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
                  <td style={{ padding:'13px 20px', fontFamily:'monospace', fontSize:'12px', color:'rgba(241,245,249,0.5)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{user.employee_id}</td>
                  <td style={{ padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{user.department || '—'}</td>
                  <td style={{ padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{ROLE_LABEL[user.role] || user.role}</td>
                  <td style={{ padding:'13px 20px', fontSize:'12px', color:'rgba(241,245,249,0.45)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    {user.shift_start?.slice(0,5)} – {user.shift_end?.slice(0,5)}
                  </td>
                  <td style={{ padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}><Badge status={user.status} /></td>
                  <td style={{ padding:'13px 20px', whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display:'flex', gap:'4px' }}>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
