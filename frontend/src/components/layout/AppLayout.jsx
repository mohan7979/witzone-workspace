import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import useAuthStore from '@/store/authStore';
import { Bell, Search } from 'lucide-react';

/* ─── Global Midnight-Glass CSS ─────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #070B14;
    color: #F1F5F9;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

  @keyframes pulse-glow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function GlobalStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />;
}

export default function AppLayout() {
  const { user, token, _hasHydrated } = useAuthStore();
  const navigate = useNavigate();

  if (!_hasHydrated) return null;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.password_reset_required) return <Navigate to="/change-password" replace />;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <GlobalStyles />
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        background: `
          radial-gradient(ellipse 90% 70% at 15% 5%,  rgba(99,102,241,0.18) 0%, transparent 55%),
          radial-gradient(ellipse 60% 80% at 85% 85%, rgba(139,92,246,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 70% 50% at 55% 45%, rgba(59,130,246,0.07) 0%, transparent 55%),
          #070B14
        `,
      }}>
        <Sidebar />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* ── Top Bar ──────────────────────────────────── */}
          <header style={{
            height: '64px', flexShrink: 0,
            background: 'rgba(7,11,20,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', padding: '0 28px', gap: '14px',
          }}>

            {/* Date */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.4)', fontWeight: 500, letterSpacing: '0.2px' }}>
                {today}
              </p>
            </div>

            {/* Search pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '7px 14px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <Search size={13} color="rgba(241,245,249,0.35)" />
              <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)', fontWeight: 400 }}>Quick search…</span>
              <span style={{
                fontSize: '10px', color: 'rgba(241,245,249,0.25)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', padding: '1px 5px', marginLeft: '8px',
              }}>⌘K</span>
            </div>

            {/* Notification bell */}
            <button style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(241,245,249,0.5)',
              transition: 'all 0.2s', position: 'relative',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.12)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)'; e.currentTarget.style.color = '#818CF8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(241,245,249,0.5)'; }}
            >
              <Bell size={14} />
              <div style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#F472B6',
                border: '1.5px solid #070B14',
                animation: 'pulse-glow 2s infinite',
              }} />
            </button>

            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.07)' }} />

            {/* User chip */}
            <div onClick={() => navigate('/profile')} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '5px 10px 5px 5px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '40px', cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.1)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '10px', fontWeight: 800,
                boxShadow: '0 0 0 2px rgba(99,102,241,0.35)',
                flexShrink: 0,
              }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#F1F5F9', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                  {user?.first_name} {user?.last_name}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(241,245,249,0.4)', textTransform: 'capitalize' }}>
                  {user?.department ?? user?.role}
                </p>
              </div>
            </div>

          </header>

          {/* ── Page Content ─────────────────────────────── */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
