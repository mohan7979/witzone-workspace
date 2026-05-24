import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api';
import useAuthStore from '@/store/authStore';
import {
  User, Mail, Phone, Briefcase, Building2, Clock, Shield,
  IdCard, Edit3, Check, X, KeyRound, Eye, EyeOff, Lock,
} from 'lucide-react';

const ACCENT = '#818CF8'; // indigo

/* ─── tiny helpers ─── */
const glass = (extra = {}) => ({
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  ...extra,
});

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(129,140,248,0.3)',
  borderRadius: 8,
  color: '#E2E8F0',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = { color: '#94A3B8', fontSize: 12, marginBottom: 4 };

const roleBadge = (role) => {
  const map = {
    hr:       { bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.35)', color: '#818CF8', label: 'HR Admin' },
    lead:     { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#FBBF24', label: 'Team Lead' },
    employee: { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: '#34D399', label: 'Employee' },
  };
  const s = map[role] || map.employee;
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>{s.label}</span>
  );
};

/* ─── Info Row ─── */
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={ACCENT} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={labelStyle}>{label}</div>
        <div style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>{value || '—'}</div>
      </div>
    </div>
  );
}

/* ─── Edit Profile Modal ─── */
function EditProfileModal({ user, onClose }) {
  const queryClient = useQueryClient();
  const setUser = useAuthStore(s => s.updateUser);
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, phone: user.phone || '' });

  const mut = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['me']);
      setUser(data.user);
      onClose();
    },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...glass(), width: '100%', maxWidth: 440, padding: 28, position: 'relative' }}>
        {/* shimmer top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0', background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Profile</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>First Name</div>
              <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <div style={labelStyle}>Last Name</div>
              <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Phone</div>
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
        </div>
        {mut.error && <div style={{ color: '#F87171', fontSize: 13, marginTop: 12 }}>{mut.error.response?.data?.message || 'Update failed'}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button
            onClick={() => mut.mutate(form)}
            disabled={mut.isPending}
            style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, #6366F1)`, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: mut.isPending ? 0.7 : 1 }}
          >{mut.isPending ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Change Password Modal ─── */
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [show, setShow] = useState({ cur: false, new: false, con: false });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  const mut = useMutation({
    mutationFn: (data) => authApi.changePassword(data),
    onSuccess: () => setSuccess(true),
    onError: (e) => setErr(e.message || 'Failed to change password'),
  });

  const handleSubmit = () => {
    setErr('');
    if (!form.old_password || !form.new_password) return setErr('All fields are required');
    if (form.new_password.length < 8) return setErr('New password must be at least 8 characters');
    if (form.new_password !== form.confirm) return setErr('Passwords do not match');
    mut.mutate({ old_password: form.old_password, new_password: form.new_password });
  };

  // eslint-disable-next-line no-unused-vars
  const pwField = (key, showKey, label) => (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={show[showKey] ? 'text' : 'password'}
          style={{ ...inputStyle, paddingRight: 36 }}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
        <button onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
          {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...glass(), width: '100%', maxWidth: 420, padding: 28, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0', background: 'linear-gradient(90deg, transparent, #F472B6, transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 700, margin: 0 }}>Change Password</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><X size={20} /></button>
        </div>
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', border: '2px solid rgba(52,211,153,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color="#34D399" />
            </div>
            <div style={{ color: '#34D399', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Password Changed!</div>
            <div style={{ color: '#64748B', fontSize: 13 }}>Your password has been updated successfully.</div>
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 28px', borderRadius: 8, background: 'linear-gradient(135deg, #34D399, #059669)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pwField('old_password', 'cur', 'Current Password')}
              {pwField('new_password', 'new', 'New Password')}
              {pwField('confirm', 'con', 'Confirm New Password')}
            </div>
            {err && <div style={{ color: '#F87171', fontSize: 13, marginTop: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={mut.isPending}
                style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: 'linear-gradient(135deg, #F472B6, #EC4899)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: mut.isPending ? 0.7 : 1 }}>
                {mut.isPending ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ProfilePage() {
  const { user: storeUser } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.user),
    initialData: storeUser,
  });

  const user = data || storeUser;

  /* Avatar initials */
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : '?';
  const avatarGrad = 'linear-gradient(135deg, #818CF8, #6366F1)';

  if (isLoading && !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(129,140,248,0.3)', borderTop: `3px solid ${ACCENT}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '8px 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#E2E8F0', fontSize: 26, fontWeight: 700, margin: 0 }}>My Profile</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>Manage your personal information and account settings</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column — avatar card */}
        <div style={{ ...glass(), padding: 28, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* ambient glow */}
          <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 160, height: 160, background: 'rgba(129,140,248,0.12)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

          {/* Avatar */}
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: avatarGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30, fontWeight: 700, color: '#fff', boxShadow: '0 0 0 4px rgba(129,140,248,0.2)' }}>
            {initials}
          </div>

          <div style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 700 }}>{user?.first_name} {user?.last_name}</div>
          <div style={{ color: '#64748B', fontSize: 13, marginTop: 4, marginBottom: 12 }}>{user?.email}</div>
          {roleBadge(user?.role)}

          <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748B', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Employee ID</div>
            <div style={{ color: ACCENT, fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{user?.employee_id || '—'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
            <button onClick={() => setEditOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 0', borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, #6366F1)`, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Edit3 size={15} /> Edit Profile
            </button>
            <button onClick={() => setPwOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 0', borderRadius: 8, background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', color: '#F472B6', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <KeyRound size={15} /> Change Password
            </button>
          </div>
        </div>

        {/* Right column — details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Personal Info */}
          <div style={{ ...glass(), padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <User size={16} color={ACCENT} />
              <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>Personal Information</span>
            </div>
            <InfoRow icon={User}      label="Full Name"    value={`${user?.first_name} ${user?.last_name}`} />
            <InfoRow icon={Mail}      label="Email"        value={user?.email} />
            <InfoRow icon={Phone}     label="Phone"        value={user?.phone} />
            <InfoRow icon={IdCard}    label="Employee ID"  value={user?.employee_id} />
          </div>

          {/* Work Info */}
          <div style={{ ...glass(), padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Briefcase size={16} color='#FBBF24' />
              <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>Work Information</span>
            </div>
            <InfoRow icon={Building2} label="Department"   value={user?.department} />
            <InfoRow icon={Briefcase} label="Designation"  value={user?.designation} />
            <InfoRow icon={Shield}    label="Role"         value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'} />
            <InfoRow icon={User}      label="Manager"      value={user?.manager ? `${user.manager.first_name} ${user.manager.last_name}` : '—'} />
          </div>

          {/* Shift Info */}
          <div style={{ ...glass(), padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Clock size={16} color='#34D399' />
              <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>Shift & Leave Balances</span>
            </div>
            <InfoRow icon={Clock} label="Shift Start" value={user?.shift_start ? user.shift_start.slice(0, 5) : '—'} />
            <InfoRow icon={Clock} label="Shift End"   value={user?.shift_end   ? user.shift_end.slice(0, 5)   : '—'} />

            {/* Leave balance pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
              {[
                { label: 'Casual',   val: user?.casual_leave_balance,   color: '#818CF8' },
                { label: 'Sick',     val: user?.sick_leave_balance,     color: '#F472B6' },
                { label: 'Comp Off', val: user?.comp_off_balance,       color: '#34D399' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: `rgba(${color === '#818CF8' ? '129,140,248' : color === '#F472B6' ? '244,114,182' : '52,211,153'},0.08)`, border: `1px solid rgba(${color === '#818CF8' ? '129,140,248' : color === '#F472B6' ? '244,114,182' : '52,211,153'},0.2)`, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ color, fontSize: 24, fontWeight: 700 }}>{val ?? '—'}</div>
                  <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div style={{ ...glass({ background: 'rgba(244,114,182,0.04)' }), padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Lock size={16} color='#F472B6' />
              <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>Security</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#CBD5E1', fontSize: 14, fontWeight: 500 }}>Password</div>
                <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>Last changed: recently</div>
              </div>
              <button onClick={() => setPwOpen(true)}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', color: '#F472B6', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      {editOpen && <EditProfileModal user={user} onClose={() => setEditOpen(false)} />}
      {pwOpen   && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}
