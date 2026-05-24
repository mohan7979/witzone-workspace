import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap } from 'lucide-react';
import { authApi } from '@/api';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const [form, setForm]   = useState({ old_password:'', new_password:'', confirm:'' });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return toast.error('Passwords do not match');
    if (form.new_password.length < 8) return toast.error('Minimum 8 characters required');
    setLoading(true);
    try {
      await authApi.changePassword({ old_password:form.old_password, new_password:form.new_password });
      toast.success('Password updated successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width:'100%', padding:'12px 16px', fontSize:'14px',
    background: focused === field ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
    border:`1.5px solid ${focused === field ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box',
    transition:'all 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  });

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Inter',system-ui,sans-serif", padding:'16px',
      background:`
        radial-gradient(ellipse 90% 70% at 15% 5%,  rgba(99,102,241,0.2) 0%, transparent 55%),
        radial-gradient(ellipse 60% 80% at 85% 85%, rgba(139,92,246,0.16) 0%, transparent 55%),
        #070B14
      `,
    }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px', justifyContent:'center' }}>
          <div style={{ width:'40px', height:'40px', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 1px rgba(99,102,241,0.4), 0 8px 24px rgba(99,102,241,0.4)' }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <span style={{ color:'#F1F5F9', fontWeight:800, fontSize:'17px', letterSpacing:'-0.4px' }}>Witzone</span>
            <p style={{ color:'#818CF8', fontSize:'10px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', marginTop:'1px' }}>Workspace</p>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:'rgba(255,255,255,0.05)',
          backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'20px',
          boxShadow:'0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding:'36px', position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)' }} />

          {/* Icon */}
          <div style={{ width:'48px', height:'48px', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'20px', boxShadow:'0 8px 20px rgba(99,102,241,0.4)' }}>
            <ShieldCheck size={22} color="white" />
          </div>

          <h2 style={{ fontSize:'22px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.5px', marginBottom:'6px' }}>
            Set a new password
          </h2>
          <p style={{ fontSize:'13px', color:'rgba(241,245,249,0.4)', marginBottom:'28px', lineHeight:1.6 }}>
            Your account requires a password change before continuing.
          </p>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
            {[
              { key:'old_password', label:'Current / Temporary Password' },
              { key:'new_password', label:'New Password' },
              { key:'confirm',      label:'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'8px' }}>
                  {label}
                </label>
                <input type="password" required value={form[key]} onChange={f(key)}
                  style={inputStyle(key)}
                  onFocus={() => setFocused(key)}
                  onBlur={() => setFocused(null)} />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:'13px', marginTop:'6px',
              background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              color:'white', fontSize:'14px', fontWeight:700,
              borderRadius:'10px', border:'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              transition:'all 0.2s',
            }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; }}>
              {loading && <span style={{ width:'15px', height:'15px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
