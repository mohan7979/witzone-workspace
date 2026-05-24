import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';
import { authApi } from '@/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: '⚡', title: 'Smart Clock-in',      sub: 'Accurate attendance tracking with idle detection' },
  { icon: '🌿', title: 'Leave Management',    sub: 'Apply, approve & track in real time'             },
  { icon: '📊', title: 'Live Analytics',      sub: 'Workforce insights at your fingertips'           },
  { icon: '🔒', title: 'Secure & Private',    sub: 'Enterprise-grade data protection'                },
];

export default function LoginPage() {
  const [form, setForm]         = useState({ email:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const { setAuth } = useAuthStore();
  const navigate    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await authApi.login(form);
      setAuth(user, token);
      navigate(user.password_reset_required ? '/change-password' : '/dashboard');
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width:'100%', padding:'12px 16px', fontSize:'14px',
    background: focused === field ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
    border: `1.5px solid ${focused === field ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius:'10px', color:'#F1F5F9', outline:'none', boxSizing:'border-box',
    transition:'all 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  });

  return (
    <div style={{
      display:'flex', minHeight:'100vh',
      fontFamily:"'Inter',system-ui,sans-serif",
      background:`
        radial-gradient(ellipse 90% 70% at 15% 5%,  rgba(99,102,241,0.2) 0%, transparent 55%),
        radial-gradient(ellipse 60% 80% at 85% 85%, rgba(139,92,246,0.16) 0%, transparent 55%),
        radial-gradient(ellipse 50% 50% at 55% 45%, rgba(59,130,246,0.08) 0%, transparent 55%),
        #070B14
      `,
    }}>

      {/* ── Left Panel ─────────────────────────────── */}
      <div style={{ width:'48%', display:'flex', flexDirection:'column', padding:'48px', position:'relative', overflow:'hidden' }} className="hidden lg:flex">

        {/* Mesh decoration circles */}
        <div style={{ position:'absolute', top:'-100px', right:'-100px', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-80px', left:'-80px', width:'350px', height:'350px', borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />

        {/* Floating glass card decoration */}
        <div style={{ position:'absolute', top:'30%', right:'8%', width:'120px', height:'120px', borderRadius:'24px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(12px)', transform:'rotate(12deg)', animation:'float 6s ease-in-out infinite', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'55%', right:'18%', width:'70px', height:'70px', borderRadius:'16px', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', backdropFilter:'blur(10px)', transform:'rotate(-8deg)', animation:'float 8s ease-in-out infinite reverse', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', height:'100%' }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'42px', height:'42px', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 1px rgba(99,102,241,0.4), 0 8px 24px rgba(99,102,241,0.4)' }}>
              <Zap size={20} color="white" fill="white" />
            </div>
            <div>
              <span style={{ color:'#F1F5F9', fontWeight:800, fontSize:'18px', letterSpacing:'-0.4px' }}>Witzone</span>
              <p style={{ color:'#818CF8', fontSize:'10px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', marginTop:'1px' }}>Workspace</p>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:'440px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:'100px', padding:'6px 14px', marginBottom:'28px', width:'fit-content' }}>
              <div style={{ width:'6px', height:'6px', background:'#818CF8', borderRadius:'50%', animation:'pulse-glow 2s infinite' }} />
              <span style={{ color:'#818CF8', fontSize:'12px', fontWeight:600, letterSpacing:'0.3px' }}>HR Management Platform</span>
            </div>

            <h1 style={{ color:'#F1F5F9', fontSize:'46px', fontWeight:900, lineHeight:1.1, letterSpacing:'-2px', marginBottom:'18px' }}>
              Your workforce,<br />
              <span style={{ background:'linear-gradient(135deg,#818CF8,#A78BFA,#F472B6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                beautifully managed.
              </span>
            </h1>

            <p style={{ color:'rgba(241,245,249,0.5)', fontSize:'15px', lineHeight:1.7, marginBottom:'40px' }}>
              Streamline attendance, manage leaves, and monitor productivity — all from one intelligent dashboard.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {FEATURES.map(({ icon, title, sub }) => (
                <div key={title} style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ width:'38px', height:'38px', flexShrink:0, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>
                    {icon}
                  </div>
                  <div>
                    <p style={{ color:'#F1F5F9', fontSize:'13px', fontWeight:600 }}>{title}</p>
                    <p style={{ color:'rgba(241,245,249,0.4)', fontSize:'12px', marginTop:'1px' }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p style={{ color:'rgba(241,245,249,0.2)', fontSize:'12px' }}>© 2025 Witzone Workspace. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Form Panel ───────────────────────── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px' }}>
        <div style={{ width:'100%', maxWidth:'400px' }}>

          {/* Mobile logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px' }} className="lg:hidden">
            <div style={{ width:'36px', height:'36px', background:'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(99,102,241,0.4)' }}>
              <Zap size={16} color="white" fill="white" />
            </div>
            <span style={{ fontWeight:800, color:'#F1F5F9', fontSize:'16px' }}>Witzone Workspace</span>
          </div>

          {/* Form card */}
          <div style={{
            background:'rgba(255,255,255,0.05)',
            backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'20px',
            boxShadow:'0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            padding:'36px',
            position:'relative', overflow:'hidden',
          }}>
            {/* Top shimmer */}
            <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.5),transparent)' }} />

            <div style={{ marginBottom:'28px' }}>
              <h2 style={{ fontSize:'24px', fontWeight:800, color:'#F1F5F9', letterSpacing:'-0.5px', marginBottom:'6px' }}>
                Welcome back 👋
              </h2>
              <p style={{ fontSize:'14px', color:'rgba(241,245,249,0.4)' }}>Sign in to your HR portal account</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'8px' }}>
                  Email Address
                </label>
                <input
                  type="email" required
                  placeholder="yourname@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email:e.target.value })}
                  style={inputStyle('email')}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </div>

              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:600, color:'rgba(241,245,249,0.5)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'8px' }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} required
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password:e.target.value })}
                    style={{ ...inputStyle('password'), paddingRight:'44px' }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(241,245,249,0.3)', display:'flex', alignItems:'center', padding:'2px' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width:'100%', padding:'13px', marginTop:'6px',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                color:'white', fontSize:'14px', fontWeight:700,
                borderRadius:'10px', border:'none',
                cursor:loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                transition:'all 0.2s',
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'; }}}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; }}
              >
                {loading
                  ? <><span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Signing in…</>
                  : <><span>Sign In</span><ArrowRight size={15} /></>
                }
              </button>
            </form>
          </div>

          <p style={{ textAlign:'center', marginTop:'22px', fontSize:'12px', color:'rgba(241,245,249,0.25)' }}>
            Need access? Contact your HR administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
