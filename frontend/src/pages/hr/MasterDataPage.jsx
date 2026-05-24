import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check, Building2, Briefcase, CalendarDays, Clock3 } from 'lucide-react';
import { masterApi } from '@/api';
import toast from 'react-hot-toast';

const glass   = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' };

const S = {
  th: { padding:'11px 20px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'rgba(241,245,249,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)' },
  td: { padding:'13px 20px', fontSize:'13px', color:'rgba(241,245,249,0.65)', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  input: { width:'100%', padding:'9px 12px', fontSize:'13px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'inherit' },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'6px' },
};

const focusStyle = (e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; };
const blurStyle  = (e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

const TABS = [
  { key:'departments',  label:'Departments',     icon:Building2,  color:'#818CF8', glow:'rgba(129,140,248,0.25)', gradient:'linear-gradient(135deg,#6366F1,#8B5CF6)' },
  { key:'designations', label:'Designations',    icon:Briefcase,  color:'#60A5FA', glow:'rgba(96,165,250,0.25)',  gradient:'linear-gradient(135deg,#3B82F6,#60A5FA)' },
  { key:'holidays',     label:'Public Holidays', icon:CalendarDays, color:'#F472B6', glow:'rgba(244,114,182,0.25)', gradient:'linear-gradient(135deg,#EC4899,#F472B6)' },
  { key:'shifts',       label:'Shift Templates', icon:Clock3,     color:'#34D399', glow:'rgba(52,211,153,0.25)',  gradient:'linear-gradient(135deg,#10B981,#34D399)' },
];

const HOLIDAY_TYPES = ['national','company','optional'];

/* ─── Inline edit row ─────────────────────────────────────── */
function EditableRow({ fields, onSave, onCancel }) {
  const [vals, setVals] = useState(fields.reduce((a, f) => ({ ...a, [f.key]: f.value || '' }), {}));
  return (
    <tr>
      {fields.map(f => (
        <td key={f.key} style={S.td}>
          {f.type === 'select' ? (
            <select value={vals[f.key]} onChange={e => setVals({ ...vals, [f.key]: e.target.value })} style={{ ...S.input, padding:'8px 12px' }}
              onFocus={focusStyle} onBlur={blurStyle}>
              {(f.options || []).map(o => {
                const val   = typeof o === 'object' ? o.value : o;
                const label = typeof o === 'object' ? o.label : o;
                return <option key={val} value={val} style={{ background:'#0D1117' }}>{label}</option>;
              })}
            </select>
          ) : (
            <input type={f.type || 'text'} value={vals[f.key]} onChange={e => setVals({ ...vals, [f.key]: e.target.value })}
              placeholder={f.placeholder} style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
          )}
        </td>
      ))}
      <td style={{ ...S.td, whiteSpace:'nowrap' }}>
        <div style={{ display:'flex', gap:'6px' }}>
          <button onClick={() => onSave(vals)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 12px', fontSize:'12px', fontWeight:700, color:'#34D399', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(52,211,153,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(52,211,153,0.1)'}>
            <Check size={13} /> Save
          </button>
          <button onClick={onCancel} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'rgba(241,245,249,0.4)', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Delete confirm ──────────────────────────────────────── */
function DeleteBtn({ onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) return (
    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
      <span style={{ fontSize:'11px', color:'#F87171' }}>Delete?</span>
      <button onClick={onConfirm} style={{ padding:'4px 8px', fontSize:'11px', fontWeight:700, color:'white', background:'#EF4444', border:'none', borderRadius:'6px', cursor:'pointer' }}>Yes</button>
      <button onClick={() => setConfirm(false)} style={{ padding:'4px 8px', fontSize:'11px', color:'rgba(241,245,249,0.4)', background:'rgba(255,255,255,0.06)', border:'none', borderRadius:'6px', cursor:'pointer' }}>No</button>
    </div>
  );
  return (
    <button onClick={() => setConfirm(true)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'#F87171', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.2)'}
      onMouseLeave={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
      <Trash2 size={12} /> Delete
    </button>
  );
}

/* ─── Section panels ──────────────────────────────────────── */
function DepartmentsPanel({ tab }) {
  const qc = useQueryClient();
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);
  const { data } = useQuery({ queryKey:['master-departments'], queryFn: masterApi.listDepartments });

  const create = useMutation({ mutationFn: masterApi.createDepartment, onSuccess:() => { toast.success('Department added'); qc.invalidateQueries(['master-departments']); qc.invalidateQueries(['departments']); setAdding(false); }, onError:(e) => toast.error(e.message) });
  const update = useMutation({ mutationFn:({ id, data }) => masterApi.updateDepartment(id, data), onSuccess:() => { toast.success('Updated'); qc.invalidateQueries(['master-departments']); qc.invalidateQueries(['departments']); setEditing(null); }, onError:(e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: masterApi.deleteDepartment, onSuccess:() => { toast.success('Deleted'); qc.invalidateQueries(['master-departments']); qc.invalidateQueries(['departments']); }, onError:(e) => toast.error(e.message) });

  const rows = data?.data || [];
  return (
    <div style={glass}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9' }}>{rows.length} department{rows.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setAdding(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', fontWeight:700, color:'white', background:tab.gradient, border:'none', borderRadius:'9px', cursor:'pointer', boxShadow:`0 4px 14px ${tab.glow}`, transition:'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}>
          <Plus size={13} /> Add Department
        </button>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr><th style={S.th}>Name</th><th style={S.th}>Status</th><th style={S.th}>Actions</th></tr></thead>
        <tbody>
          {adding && (
            <EditableRow
              fields={[{ key:'name', placeholder:'Department name' }, { key:'is_active', type:'select', value:'true', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] }]}
              onSave={(v) => create.mutate({ name:v.name, is_active: v.is_active !== 'false' })}
              onCancel={() => setAdding(false)} />
          )}
          {rows.map(r => (
            editing === r.id ? (
              <EditableRow key={r.id}
                fields={[{ key:'name', value:r.name, placeholder:'Department name' }, { key:'is_active', type:'select', value:String(r.is_active), options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] }]}
                onSave={(v) => update.mutate({ id:r.id, data:{ name:v.name, is_active: v.is_active !== 'false' } })}
                onCancel={() => setEditing(null)} />
            ) : (
              <tr key={r.id} style={{ transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{r.name}</td>
                <td style={S.td}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 9px', borderRadius:'6px', fontSize:'11px', fontWeight:700, background: r.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: r.is_active ? '#34D399' : '#F87171', border:`1px solid ${r.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', background: r.is_active ? '#34D399' : '#F87171' }} />
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setEditing(r.id)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'#818CF8', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.25)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(129,140,248,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(129,140,248,0.1)'}>
                      <Pencil size={12} /> Edit
                    </button>
                    <DeleteBtn onConfirm={() => remove.mutate(r.id)} />
                  </div>
                </td>
              </tr>
            )
          ))}
          {!rows.length && !adding && <tr><td colSpan={3} style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No departments yet. Add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DesignationsPanel({ tab }) {
  const qc = useQueryClient();
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);
  const { data } = useQuery({ queryKey:['master-designations'], queryFn: masterApi.listDesignations });
  const { data:deptData } = useQuery({ queryKey:['master-departments'], queryFn: masterApi.listDepartments });
  const departments = (deptData?.data || []).map(d => d.name);

  const create = useMutation({ mutationFn: masterApi.createDesignation, onSuccess:() => { toast.success('Designation added'); qc.invalidateQueries(['master-designations']); setAdding(false); }, onError:(e) => toast.error(e.message) });
  const update = useMutation({ mutationFn:({ id, data }) => masterApi.updateDesignation(id, data), onSuccess:() => { toast.success('Updated'); qc.invalidateQueries(['master-designations']); setEditing(null); }, onError:(e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: masterApi.deleteDesignation, onSuccess:() => { toast.success('Deleted'); qc.invalidateQueries(['master-designations']); }, onError:(e) => toast.error(e.message) });

  const rows = data?.data || [];
  const deptOptions = [{ value:'', label:'— No Department —' }, ...departments.map(d => ({ value:d, label:d }))];
  return (
    <div style={glass}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9' }}>{rows.length} designation{rows.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setAdding(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', fontWeight:700, color:'white', background:tab.gradient, border:'none', borderRadius:'9px', cursor:'pointer', boxShadow:`0 4px 14px ${tab.glow}`, transition:'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}>
          <Plus size={13} /> Add Designation
        </button>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr><th style={S.th}>Name</th><th style={S.th}>Department</th><th style={S.th}>Status</th><th style={S.th}>Actions</th></tr></thead>
        <tbody>
          {adding && (
            <EditableRow
              fields={[
                { key:'name', placeholder:'Designation name' },
                { key:'department', type:'select', value:'', options:deptOptions },
                { key:'is_active', type:'select', value:'true', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
              ]}
              onSave={(v) => create.mutate({ name:v.name, department:v.department || null, is_active: v.is_active !== 'false' })}
              onCancel={() => setAdding(false)} />
          )}
          {rows.map(r => (
            editing === r.id ? (
              <EditableRow key={r.id}
                fields={[
                  { key:'name', value:r.name, placeholder:'Designation name' },
                  { key:'department', type:'select', value:r.department||'', options:deptOptions },
                  { key:'is_active', type:'select', value:String(r.is_active), options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
                ]}
                onSave={(v) => update.mutate({ id:r.id, data:{ name:v.name, department:v.department||null, is_active: v.is_active !== 'false' } })}
                onCancel={() => setEditing(null)} />
            ) : (
              <tr key={r.id} style={{ transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{r.name}</td>
                <td style={S.td}>{r.department ? <span style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'3px 8px', fontSize:'12px' }}>{r.department}</span> : <span style={{ color:'rgba(241,245,249,0.25)' }}>—</span>}</td>
                <td style={S.td}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 9px', borderRadius:'6px', fontSize:'11px', fontWeight:700, background: r.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: r.is_active ? '#34D399' : '#F87171', border:`1px solid ${r.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', background: r.is_active ? '#34D399' : '#F87171' }} />
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setEditing(r.id)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'#60A5FA', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(96,165,250,0.1)'}>
                      <Pencil size={12} /> Edit
                    </button>
                    <DeleteBtn onConfirm={() => remove.mutate(r.id)} />
                  </div>
                </td>
              </tr>
            )
          ))}
          {!rows.length && !adding && <tr><td colSpan={4} style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No designations yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function HolidaysPanel({ tab }) {
  const qc = useQueryClient();
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);
  const year = new Date().getFullYear();
  const { data } = useQuery({ queryKey:['master-holidays', year], queryFn:() => masterApi.listHolidays({ year }) });

  const create = useMutation({ mutationFn: masterApi.createHoliday, onSuccess:() => { toast.success('Holiday added'); qc.invalidateQueries(['master-holidays']); setAdding(false); }, onError:(e) => toast.error(e.message) });
  const update = useMutation({ mutationFn:({ id, data }) => masterApi.updateHoliday(id, data), onSuccess:() => { toast.success('Updated'); qc.invalidateQueries(['master-holidays']); setEditing(null); }, onError:(e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: masterApi.deleteHoliday, onSuccess:() => { toast.success('Deleted'); qc.invalidateQueries(['master-holidays']); }, onError:(e) => toast.error(e.message) });

  const rows = data?.data || [];
  const typeLabels = { national:'🇮🇳 National', company:'🏢 Company', optional:'📅 Optional' };
  return (
    <div style={glass}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9' }}>{rows.length} holiday{rows.length !== 1 ? 's' : ''} in {year}</p>
        <button onClick={() => setAdding(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', fontWeight:700, color:'white', background:tab.gradient, border:'none', borderRadius:'9px', cursor:'pointer', boxShadow:`0 4px 14px ${tab.glow}`, transition:'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}>
          <Plus size={13} /> Add Holiday
        </button>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr><th style={S.th}>Holiday Name</th><th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Actions</th></tr></thead>
        <tbody>
          {adding && (
            <EditableRow
              fields={[
                { key:'name', placeholder:'e.g. Republic Day' },
                { key:'date', type:'date' },
                { key:'type', type:'select', value:'national', options:HOLIDAY_TYPES },
              ]}
              onSave={(v) => create.mutate({ name:v.name, date:v.date, type:v.type })}
              onCancel={() => setAdding(false)} />
          )}
          {rows.map(r => (
            editing === r.id ? (
              <EditableRow key={r.id}
                fields={[
                  { key:'name', value:r.name, placeholder:'Holiday name' },
                  { key:'date', value:r.date, type:'date' },
                  { key:'type', type:'select', value:r.type, options:HOLIDAY_TYPES },
                ]}
                onSave={(v) => update.mutate({ id:r.id, data:v })}
                onCancel={() => setEditing(null)} />
            ) : (
              <tr key={r.id} style={{ transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{r.name}</td>
                <td style={S.td}>{new Date(r.date+'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</td>
                <td style={S.td}>
                  <span style={{ background:'rgba(244,114,182,0.12)', border:'1px solid rgba(244,114,182,0.25)', borderRadius:'6px', padding:'3px 9px', fontSize:'11px', fontWeight:600, color:'#F472B6' }}>
                    {typeLabels[r.type] || r.type}
                  </span>
                </td>
                <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setEditing(r.id)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'#F472B6', background:'rgba(244,114,182,0.1)', border:'1px solid rgba(244,114,182,0.25)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(244,114,182,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(244,114,182,0.1)'}>
                      <Pencil size={12} /> Edit
                    </button>
                    <DeleteBtn onConfirm={() => remove.mutate(r.id)} />
                  </div>
                </td>
              </tr>
            )
          ))}
          {!rows.length && !adding && <tr><td colSpan={4} style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No holidays added for {year}.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ShiftsPanel({ tab }) {
  const qc = useQueryClient();
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);
  const { data } = useQuery({ queryKey:['master-shifts'], queryFn: masterApi.listShifts });

  const create = useMutation({ mutationFn: masterApi.createShift, onSuccess:() => { toast.success('Shift added'); qc.invalidateQueries(['master-shifts']); setAdding(false); }, onError:(e) => toast.error(e.message) });
  const update = useMutation({ mutationFn:({ id, data }) => masterApi.updateShift(id, data), onSuccess:() => { toast.success('Updated'); qc.invalidateQueries(['master-shifts']); setEditing(null); }, onError:(e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: masterApi.deleteShift, onSuccess:() => { toast.success('Deleted'); qc.invalidateQueries(['master-shifts']); }, onError:(e) => toast.error(e.message) });

  const rows = data?.data || [];
  return (
    <div style={glass}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:'13px', fontWeight:700, color:'#F1F5F9' }}>{rows.length} shift template{rows.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setAdding(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', fontWeight:700, color:'white', background:tab.gradient, border:'none', borderRadius:'9px', cursor:'pointer', boxShadow:`0 4px 14px ${tab.glow}`, transition:'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}>
          <Plus size={13} /> Add Shift
        </button>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr><th style={S.th}>Shift Name</th><th style={S.th}>Start Time</th><th style={S.th}>End Time</th><th style={S.th}>Duration</th><th style={S.th}>Status</th><th style={S.th}>Actions</th></tr></thead>
        <tbody>
          {adding && (
            <EditableRow
              fields={[
                { key:'name', placeholder:'e.g. Morning Shift' },
                { key:'start_time', type:'time' },
                { key:'end_time', type:'time' },
                { key:'is_active', type:'select', value:'true', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
              ]}
              onSave={(v) => create.mutate({ name:v.name, start_time:v.start_time, end_time:v.end_time, is_active: v.is_active !== 'false' })}
              onCancel={() => setAdding(false)} />
          )}
          {rows.map(r => {
            const [sh, sm] = r.start_time.split(':').map(Number);
            const [eh, em] = r.end_time.split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins < 0) mins += 24 * 60;
            const dur = `${Math.floor(mins/60)}h ${mins%60>0?`${mins%60}m`:''}`;
            return editing === r.id ? (
              <EditableRow key={r.id}
                fields={[
                  { key:'name', value:r.name, placeholder:'Shift name' },
                  { key:'start_time', value:r.start_time?.slice(0,5), type:'time' },
                  { key:'end_time', value:r.end_time?.slice(0,5), type:'time' },
                  { key:'is_active', type:'select', value:String(r.is_active), options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
                ]}
                onSave={(v) => update.mutate({ id:r.id, data:{ name:v.name, start_time:v.start_time, end_time:v.end_time, is_active: v.is_active !== 'false' } })}
                onCancel={() => setEditing(null)} />
            ) : (
              <tr key={r.id} style={{ transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, fontWeight:600, color:'#F1F5F9' }}>{r.name}</td>
                <td style={{ ...S.td, fontWeight:600, color:'#34D399' }}>{r.start_time?.slice(0,5)}</td>
                <td style={{ ...S.td, color:'rgba(241,245,249,0.5)' }}>{r.end_time?.slice(0,5)}</td>
                <td style={{ ...S.td, color:'#FBBF24', fontWeight:600 }}>{dur}</td>
                <td style={S.td}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 9px', borderRadius:'6px', fontSize:'11px', fontWeight:700, background: r.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: r.is_active ? '#34D399' : '#F87171', border:`1px solid ${r.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', background: r.is_active ? '#34D399' : '#F87171' }} />
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setEditing(r.id)} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'5px 10px', fontSize:'12px', fontWeight:600, color:'#34D399', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(52,211,153,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(52,211,153,0.1)'}>
                      <Pencil size={12} /> Edit
                    </button>
                    <DeleteBtn onConfirm={() => remove.mutate(r.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          {!rows.length && !adding && <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'rgba(241,245,249,0.2)' }}>No shift templates yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────── */
export default function MasterDataPage() {
  const [active, setActive] = useState('departments');
  const tab = TABS.find(t => t.key === active);

  const panels = { departments:<DepartmentsPanel tab={tab} />, designations:<DesignationsPanel tab={tab} />, holidays:<HolidaysPanel tab={tab} />, shifts:<ShiftsPanel tab={tab} /> };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px', animation:'slide-up 0.4s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.8px', lineHeight:1.2 }}>Master Data</h1>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginTop:'5px' }}>Manage departments, designations, holidays and shift templates</p>
        </div>
      </div>

      {/* Tab cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button key={t.key} onClick={() => setActive(t.key)} style={{
              padding:'18px 20px', borderRadius:'14px', cursor:'pointer', border:'none', textAlign:'left', transition:'all 0.2s',
              background: isActive ? `linear-gradient(135deg,${t.color}22,${t.color}10)` : 'rgba(255,255,255,0.04)',
              boxShadow: isActive ? `0 0 0 1.5px ${t.color}50, 0 8px 24px ${t.glow}` : '0 0 0 1px rgba(255,255,255,0.07)',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background='rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'10px', background: isActive ? t.gradient : 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px', boxShadow: isActive ? `0 4px 12px ${t.glow}` : 'none', transition:'all 0.2s' }}>
                <Icon size={16} color={ isActive ? 'white' : 'rgba(241,245,249,0.35)' } />
              </div>
              <p style={{ fontSize:'13px', fontWeight: isActive ? 700 : 500, color: isActive ? t.color : 'rgba(241,245,249,0.55)', letterSpacing:'-0.1px' }}>{t.label}</p>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      {panels[active]}
    </div>
  );
}
