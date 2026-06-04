/**
 * Grouped Employee Master Data inputs (the customer's "Personal Details" form).
 * Shared by the Create and Edit employee modals.
 *
 * Props:
 *   form      — object holding the field values
 *   onField   — (key) => (event) => void  updater
 *   readOnly  — when true, renders values as read-only text (View mode)
 */
const S = {
  input: {
    width:'100%', padding:'10px 14px', fontSize:'13px',
    background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)',
    borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box',
    transition:'all 0.2s', fontFamily:'inherit',
  },
  label: { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'7px' },
  sectionTitle: { fontSize:'12px', fontWeight:700, color:'#A78BFA', textTransform:'uppercase', letterSpacing:'1px', margin:'4px 0 2px' },
  readVal: { fontSize:'13px', color:'#F1F5F9', padding:'8px 0', minHeight:'18px' },
};
const focusStyle = (e) => { e.target.style.borderColor='rgba(129,140,248,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; };
const blurStyle  = (e) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

function Field({ label, k, form, onField, readOnly, type = 'text', textarea = false, options }) {
  const val = form[k] ?? '';
  return (
    <div>
      <label style={S.label}>{label}</label>
      {readOnly ? (
        <div style={S.readVal}>{val !== '' && val != null ? String(val) : <span style={{ color:'rgba(241,245,249,0.25)' }}>—</span>}</div>
      ) : options ? (
        <select value={val} onChange={onField(k)} style={S.input} onFocus={focusStyle} onBlur={blurStyle}>
          {options.map((o) => <option key={o.value} value={o.value} style={{ background:'#0D1117' }}>{o.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea rows={2} value={val} onChange={onField(k)} style={{ ...S.input, resize:'vertical', lineHeight:1.5 }} onFocus={focusStyle} onBlur={blurStyle} />
      ) : (
        <input type={type} value={val} onChange={onField(k)} style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
      )}
    </div>
  );
}

const Section = ({ title, children, cols = 2 }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
    <p style={S.sectionTitle}>{title}</p>
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:'12px' }}>{children}</div>
  </div>
);

export default function MasterDataFields({ form, onField, readOnly = false }) {
  const f = (label, k, opts = {}) => <Field label={label} k={k} form={form} onField={onField} readOnly={readOnly} {...opts} />;
  const isMarried = form.marital_status === 'married';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <Section title="Personal Information">
        {f('Blood Group', 'blood_group')}
        {f('Qualification', 'qualification')}
        {f('Marital Status', 'marital_status', { options: [
          { value:'', label:'— Select —' }, { value:'single', label:'Single' }, { value:'married', label:'Married' },
        ] })}
        {isMarried && f('Spouse Name', 'spouse_name')}
        {isMarried && f('Spouse Contact Number', 'spouse_mobile')}
      </Section>

      <Section title="Contact Information">
        {f('Personal Mobile 2', 'mobile_2')}
        {f('Personal Email (Mail ID)', 'personal_email', { type:'email' })}
      </Section>

      <Section title="Address Information" cols={1}>
        {f('Present Address', 'present_address', { textarea:true })}
        {f('Permanent Address', 'permanent_address', { textarea:true })}
        {f('Aadhaar Address', 'aadhaar_address', { textarea:true })}
      </Section>

      <Section title="Family">
        {f('Father Name', 'father_name')}
        {f('Father Mobile', 'father_mobile')}
        {f('Mother Name', 'mother_name')}
        {f('Mother Mobile', 'mother_mobile')}
      </Section>
      <Section title="Siblings" cols={1}>
        {f('Sibling Names & Contact Numbers', 'sibling_details', { textarea:true })}
      </Section>

      <Section title="Emergency Contact 1" cols={3}>
        {f('Name', 'emergency_contact_1_name')}
        {f('Relationship', 'emergency_contact_1_relationship')}
        {f('Number', 'emergency_contact_1_number')}
      </Section>
      <Section title="Emergency Contact 2" cols={3}>
        {f('Name', 'emergency_contact_2_name')}
        {f('Relationship', 'emergency_contact_2_relationship')}
        {f('Number', 'emergency_contact_2_number')}
      </Section>

      <Section title="Government IDs">
        {f('Aadhaar Card Name', 'aadhaar_name')}
        {f('Aadhaar Number', 'aadhaar_number')}
        {f('PAN Number', 'pan_number')}
      </Section>

      <Section title="Banking Details">
        {f('Bank Account Number', 'bank_account_number')}
        {f('Bank IFSC', 'bank_ifsc')}
      </Section>
    </div>
  );
}
