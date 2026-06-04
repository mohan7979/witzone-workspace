import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

// ── Role helpers ────────────────────────────────────────────────────────────
// Roles that see the administration workspace (HR dashboards, approvals, etc.).
export const ADMIN_ROLES = ['hr', 'lead', 'superuser'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
// HR-level authority (HR + Superuser) — full org visibility & approval rights.
export const isHRLevel = (role) => role === 'hr' || role === 'superuser';

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatTime = (date) =>
  date ? new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const formatDuration = (hours) => {
  if (!hours) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

export const formatIdleTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// HH:MM:SS — zero-padded. Used for idle time and break duration per customer spec
// (e.g. "Idle Time: 01:12:45", "Break Time: 00:45:30").
export const formatHMS = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

// Human-readable leave-type labels (kept in sync with backend ENUM).
export const LEAVE_TYPE_LABELS = {
  casual: 'Casual Leave', sick: 'Sick Leave', comp_off: 'Comp Off',
  permission: 'Permission', unpaid: 'Unpaid Leave',
  marriage: 'Marriage Leave', maternity: 'Maternity Leave',
};

export const leaveTypeLabel = (type) =>
  LEAVE_TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : '—');

// Single source of truth for a leave/permission request's current stage. The two
// approval levels (TL → HR) plus the no-TL bypass collapse into one clear label,
// so the UI NEVER shows "TL Approved" before a TL has actually approved.
export const leaveStage = (leave) => {
  if (!leave) return { label: '—', kind: 'pending' };
  if (leave.status === 'approved')  return { label: 'Approved',  kind: 'approved' };
  if (leave.status === 'cancelled') return { label: 'Cancelled', kind: 'cancelled' };
  if (leave.status === 'rejected')
    return leave.tl_status === 'rejected'
      ? { label: 'Rejected by TL', kind: 'rejected' }
      : { label: 'Rejected by HR', kind: 'rejected' };
  // pending
  if (leave.tl_status === 'approved' || leave.tl_skipped)
    return { label: 'Pending HR Approval', kind: 'pending' };
  return { label: 'Pending TL Approval', kind: 'pending' };
};

export const getStatusColor = (status) => {
  const map = {
    present: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-red-100 text-red-700',
    half_day: 'bg-yellow-100 text-yellow-700',
    on_leave: 'bg-blue-100 text-blue-700',
    holiday: 'bg-purple-100 text-purple-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};
