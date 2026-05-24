import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import {
  LayoutDashboard, Clock, CalendarDays, Users,
  BarChart3, Monitor, LogOut, Zap, CalendarRange, ChevronRight,
  Database, TrendingUp, Megaphone,
} from 'lucide-react';

const employeeLinks = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard',           color: '#818CF8', glow: 'rgba(129,140,248,0.35)' },
  { to: '/attendance',      icon: Clock,            label: 'Attendance',          color: '#34D399', glow: 'rgba(52,211,153,0.35)'  },
  { to: '/leaves',          icon: CalendarDays,     label: 'Leaves & Permission', color: '#F472B6', glow: 'rgba(244,114,182,0.35)' },
  { to: '/leave-balance',   icon: TrendingUp,       label: 'Leave Balance',       color: '#34D399', glow: 'rgba(52,211,153,0.35)'  },
  { to: '/announcements',   icon: Megaphone,        label: 'Announcements',       color: '#F472B6', glow: 'rgba(244,114,182,0.35)' },
  { to: '/calendar',        icon: CalendarRange,    label: 'My Calendar',         color: '#2DD4BF', glow: 'rgba(45,212,191,0.35)'  },
];

const adminLinks = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard',        color: '#818CF8', glow: 'rgba(129,140,248,0.35)' },
  { to: '/attendance',      icon: Clock,            label: 'Attendance',       color: '#34D399', glow: 'rgba(52,211,153,0.35)'  },
  { to: '/leaves',          icon: CalendarDays,     label: 'Leave Management', color: '#F472B6', glow: 'rgba(244,114,182,0.35)' },
  { to: '/employees',       icon: Users,            label: 'Employees',        color: '#60A5FA', glow: 'rgba(96,165,250,0.35)'  },
  { to: '/idle',            icon: Monitor,          label: 'Idle Monitor',     color: '#A78BFA', glow: 'rgba(167,139,250,0.35)' },
  { to: '/reports',         icon: BarChart3,        label: 'Reports',          color: '#FBBF24', glow: 'rgba(251,191,36,0.35)'  },
  { to: '/leave-balance',   icon: TrendingUp,       label: 'Leave Balance',    color: '#34D399', glow: 'rgba(52,211,153,0.35)'  },
  { to: '/announcements',   icon: Megaphone,        label: 'Announcements',    color: '#F472B6', glow: 'rgba(244,114,182,0.35)' },
  { to: '/master-data',     icon: Database,         label: 'Master Data',      color: '#2DD4BF', glow: 'rgba(45,212,191,0.35)'  },
  { to: '/calendar',        icon: CalendarRange,    label: 'My Calendar',      color: '#2DD4BF', glow: 'rgba(45,212,191,0.35)'  },
];

const leadLinks = adminLinks.filter(l => l.to !== '/master-data');

const ROLE_CONFIG = {
  hr:       { label: 'HR Manager',  color: '#818CF8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.3)' },
  lead:     { label: 'Team Lead',   color: '#34D399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.3)'  },
  employee: { label: 'Employee',    color: '#94A3B8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)' },
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'hr' || user?.role === 'lead';
  const links = user?.role === 'hr' ? adminLinks : user?.role === 'lead' ? leadLinks : employeeLinks;
  const role = ROLE_CONFIG[user?.role] ?? ROLE_CONFIG.employee;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={{
      width: '252px', minWidth: '252px',
      background: 'rgba(7,11,20,0.85)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '-100px', left: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-60px', right: '-80px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* ── Logo ─────────────────────── */}
      <div style={{
        height: '72px', display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 20px rgba(99,102,241,0.4)',
        }}>
          <Zap size={18} color="white" fill="white" />
        </div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
            Witzone
          </p>
          <p style={{ fontSize: '10px', fontWeight: 600, color: '#818CF8', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1px' }}>
            Workspace
          </p>
        </div>

        {/* Live indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', animation: 'pulse-glow 2s infinite' }} />
          <span style={{ fontSize: '9px', color: 'rgba(52,211,153,0.7)', fontWeight: 600, letterSpacing: '0.5px' }}>LIVE</span>
        </div>
      </div>

      {/* ── Section Label ─────────────── */}
      <div style={{ padding: '20px 20px 8px', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(241,245,249,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {isAdmin ? 'Administration' : 'My Workspace'}
        </p>
      </div>

      {/* ── Nav Links ─────────────────── */}
      <nav style={{ flex: 1, padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        {links.map(({ to, icon: Icon, label, color, glow }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '11px',
                padding: '9px 12px', borderRadius: '12px',
                background: isActive ? `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)` : 'transparent',
                border: isActive ? `1px solid ${color}30` : '1px solid transparent',
                boxShadow: isActive ? `0 4px 16px ${glow.replace('0.35', '0.2')}` : 'none',
                cursor: 'pointer', transition: 'all 0.2s ease',
                position: 'relative', overflow: 'hidden',
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }}}
              >
                {/* Accent bar */}
                {isActive && (
                  <div style={{
                    position: 'absolute', left: 0, top: '18%', bottom: '18%',
                    width: '3px', borderRadius: '0 3px 3px 0',
                    background: color, boxShadow: `0 0 8px ${color}`,
                  }} />
                )}

                {/* Icon */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? `${color}20` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? color + '35' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: isActive ? `0 0 12px ${color}30` : 'none',
                  transition: 'all 0.2s',
                }}>
                  <Icon size={14} color={isActive ? color : 'rgba(241,245,249,0.35)'} />
                </div>

                {/* Label */}
                <span style={{
                  fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  color: isActive ? color : 'rgba(241,245,249,0.5)',
                  letterSpacing: '-0.1px', transition: 'color 0.2s', flex: 1,
                }}>
                  {label}
                </span>

                {isActive && <ChevronRight size={12} color={`${color}80`} />}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User Footer ───────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 10px 14px', flexShrink: 0, position: 'relative', zIndex: 1 }}>

        {/* User card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '6px',
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '11px', fontWeight: 800,
              boxShadow: '0 0 0 2px rgba(99,102,241,0.35), 0 4px 12px rgba(99,102,241,0.3)',
            }}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '9px', height: '9px', borderRadius: '50%',
              background: '#34D399', border: '1.5px solid #070B14',
            }} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: '#F1F5F9', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.1px' }}>
              {user?.first_name} {user?.last_name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              <span style={{
                fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                padding: '2px 6px', borderRadius: '5px',
                background: role.bg, color: role.color, border: `1px solid ${role.border}`,
              }}>
                {role.label}
              </span>
              <span style={{ color: 'rgba(241,245,249,0.3)', fontSize: '10px' }}>·</span>
              <span style={{ color: 'rgba(241,245,249,0.4)', fontSize: '10.5px' }}>{user?.employee_id}</span>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 12px', borderRadius: '10px',
          background: 'none', border: '1px solid transparent',
          cursor: 'pointer', color: 'rgba(241,245,249,0.35)', fontSize: '12.5px', fontWeight: 500,
          transition: 'all 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.border = '1px solid rgba(239,68,68,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(241,245,249,0.35)'; e.currentTarget.style.border = '1px solid transparent'; }}
        >
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
            <LogOut size={13} />
          </div>
          Sign out
        </button>
      </div>
    </aside>
  );
}
