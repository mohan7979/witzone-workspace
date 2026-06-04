import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, Save, IdCard } from 'lucide-react';
import { userApi } from '@/api';
import MasterDataFields from './MasterDataFields';
import toast from 'react-hot-toast';

const S = {
  input: { width:'100%', padding:'10px 14px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'inherit' },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'7px' },
  sectionTitle: { fontSize:'12px', fontWeight:700, color:'#A78BFA', textTransform:'uppercase', letterSpacing:'1px', margin:'4px 0 2px' },
  readVal: { fontSize:'13px', color:'#F1F5F9', padding:'8px 0', minHeight:'18px' },
};
const focusStyle = (e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; };
const blurStyle  = (e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

// Editable profile fields (the rest of the master data comes from MasterDataFields).
const PROFILE_FIELDS = ['first_name','last_name','phone','dob','doj'];
const MASTER_FIELDS = [
  'blood_group','qualification','marital_status','spouse_name','mobile_2','personal_email',
  'present_address','permanent_address','aadhaar_address',
  'father_name','father_mobile','mother_name','mother_mobile','sibling_details',
  'emergency_contact_1_name','emergency_contact_1_relationship','emergency_contact_1_number',
  'emergency_contact_2_name','emergency_contact_2_relationship','emergency_contact_2_number',
  'aadhaar_name','aadhaar_number','pan_number','bank_account_number','bank_ifsc',
];

export default function EmployeeDetailsModal({ userId, startInEdit = false, onClose }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(startInEdit);
  const [form, setForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => userApi.get(userId),
    enabled: !!userId,
  });
  const user = data?.user;

  useEffect(() => {
    if (user) {
      const seed = {};
      [...PROFILE_FIELDS, ...MASTER_FIELDS].forEach((k) => { seed[k] = user[k] ?? ''; });
      setForm(seed);
    }
  }, [user]);

  const onField = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {};
      [...PROFILE_FIELDS, ...MASTER_FIELDS].forEach((k) => { payload[k] = form[k] === '' ? null : form[k]; });
      return userApi.update(userId, payload);
    },
    onSuccess: () => {
      toast.success('Employee details saved');
      qc.invalidateQueries(['user-detail', userId]);
      qc.invalidateQueries(['users']);
      setEdit(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const ROLE_LABEL = { hr:'HR Admin', lead:'Team Lead', employee:'Employee', superuser:'Superuser' };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(4,7,18,0.8)', backdropFilter:'blur(8px)' }}>
      <div style={{ background:'rgba(13,17,30,0.98)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', width:'100%', maxWidth:'640px', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ height:'1px', background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)' }} />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'sticky', top:0, background:'rgba(13,17,30,0.98)', borderRadius:'20px 20px 0 0', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#A78BFA,#8B5CF6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <IdCard size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#F1F5F9' }}>{user ? `${user.first_name} ${user.last_name}` : 'Employee Details'}</p>
              <p style={{ fontSize:'11px', color:'rgba(241,245,249,0.35)' }}>{user ? `${user.employee_id} · ${ROLE_LABEL[user.role] || user.role}` : 'Master Data'}</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            {!edit && user && (
              <button onClick={() => setEdit(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:700, color:'#A78BFA', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)', cursor:'pointer', padding:'7px 14px', borderRadius:'9px' }}>
                <Pencil size={12} /> Edit
              </button>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', cursor:'pointer', color:'rgba(241,245,249,0.5)', padding:'6px', display:'flex' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'20px' }}>
          {isLoading && <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.3)', textAlign:'center', padding:'24px' }}>Loading…</p>}

          {user && (
            <>
              {/* Account (read-only) */}
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <p style={S.sectionTitle}>Account</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div><label style={S.label}>Employee ID</label><div style={S.readVal}>{user.employee_id}</div></div>
                  <div><label style={S.label}>Login Email</label><div style={S.readVal}>{user.email}</div></div>
                  <div><label style={S.label}>Department</label><div style={S.readVal}>{user.department || '—'}</div></div>
                  <div><label style={S.label}>Designation</label><div style={S.readVal}>{user.designation || '—'}</div></div>
                  <div><label style={S.label}>Work Mode</label><div style={S.readVal}>{user.work_mode === 'wfh' ? 'Work From Home (WFH)' : 'Work From Office (WFO)'}</div></div>
                  <div><label style={S.label}>Manager</label><div style={S.readVal}>{user.manager ? `${user.manager.first_name} ${user.manager.last_name}` : '—'}</div></div>
                </div>
              </div>

              {/* Profile (editable basics) */}
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <p style={S.sectionTitle}>Profile</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  {[
                    ['First Name','first_name','text'], ['Last Name','last_name','text'],
                    ['Personal Mobile 1','phone','text'], ['Date of Birth','dob','date'], ['Date of Joining','doj','date'],
                  ].map(([label,k,type]) => (
                    <div key={k}>
                      <label style={S.label}>{label}</label>
                      {edit
                        ? <input type={type} value={form[k] ?? ''} onChange={onField(k)} style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
                        : <div style={S.readVal}>{form[k] ? String(form[k]) : <span style={{ color:'rgba(241,245,249,0.25)' }}>—</span>}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Master data */}
              <MasterDataFields form={form} onField={onField} readOnly={!edit} />

              {/* Actions */}
              {edit && (
                <div style={{ display:'flex', gap:'12px', paddingTop:'4px' }}>
                  <button type="button" onClick={() => { setEdit(false); const seed={}; [...PROFILE_FIELDS,...MASTER_FIELDS].forEach(k=>{seed[k]=user[k]??'';}); setForm(seed); }} style={{ flex:1, padding:'12px', fontSize:'13px', fontWeight:600, color:'rgba(241,245,249,0.6)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => save.mutate()} disabled={save.isPending} style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'12px', fontSize:'13px', fontWeight:700, color:'white', background: save.isPending ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg,#A78BFA,#8B5CF6)', border:'none', borderRadius:'10px', cursor: save.isPending ? 'not-allowed' : 'pointer', boxShadow: save.isPending ? 'none' : '0 4px 16px rgba(139,92,246,0.4)' }}>
                    <Save size={14} /> {save.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
