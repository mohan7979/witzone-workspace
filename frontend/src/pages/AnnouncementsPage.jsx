import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementApi } from '@/api';
import useAuthStore from '@/store/authStore';
import {
  Megaphone, Pin, PinOff, Plus, Trash2, Edit3, X, Check,
  Clock, User, ChevronDown, ChevronUp,
} from 'lucide-react';

const ACCENT = '#F472B6'; // pink

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
  border: '1px solid rgba(244,114,182,0.3)',
  borderRadius: 8,
  color: '#E2E8F0',
  padding: '9px 12px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = { color: '#94A3B8', fontSize: 12, marginBottom: 5 };

/* ─── Format relative time ─── */
function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ─── Announcement Card ─── */
function AnnouncementCard({ item, canManage, onEdit, onDelete, onTogglePin }) {
  const [expanded, setExpanded] = useState(false);
  const preview = item.body?.length > 200 ? item.body.slice(0, 200) + '…' : item.body;
  const needsExpand = item.body?.length > 200;

  return (
    <div style={{
      ...glass(item.is_pinned ? { border: '1px solid rgba(244,114,182,0.25)', background: 'rgba(244,114,182,0.04)' } : {}),
      padding: 22, position: 'relative', overflow: 'hidden', transition: 'transform 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Pinned indicator line */}
      {item.is_pinned && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #F472B6, transparent)', borderRadius: '16px 16px 0 0' }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {item.is_pinned && (
            <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'rgba(244,114,182,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pin size={14} color={ACCENT} />
            </div>
          )}
          <h3 style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{item.title}</h3>
        </div>

        {/* Actions */}
        {canManage && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <ActionBtn icon={item.is_pinned ? PinOff : Pin} color="#F472B6" title={item.is_pinned ? 'Unpin' : 'Pin'} onClick={() => onTogglePin(item)} />
            <ActionBtn icon={Edit3} color="#818CF8" title="Edit" onClick={() => onEdit(item)} />
            <ActionBtn icon={Trash2} color="#F87171" title="Delete" onClick={() => onDelete(item.id)} />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {expanded || !needsExpand ? item.body : preview}
      </div>
      {needsExpand && (
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 13, padding: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          {expanded ? <><ChevronUp size={14} />Show less</> : <><ChevronDown size={14} />Read more</>}
        </button>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {item.author && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12 }}>
            <User size={12} />
            {item.author.first_name} {item.author.last_name}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: 12 }}>
          <Clock size={12} />
          {relTime(item.createdAt)}
        </div>
        {item.is_pinned && <span style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.2)', color: ACCENT, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Pinned</span>}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, color, title, onClick }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 30, height: 30, borderRadius: 7, background: `rgba(${color === '#F472B6' ? '244,114,182' : color === '#818CF8' ? '129,140,248' : '248,113,113'},0.1)`, border: `1px solid rgba(${color === '#F472B6' ? '244,114,182' : color === '#818CF8' ? '129,140,248' : '248,113,113'},0.2)`, color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
      <Icon size={14} />
    </button>
  );
}

/* ─── Create / Edit Modal ─── */
function AnnouncementModal({ item, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: item?.title || '', body: item?.body || '', is_pinned: item?.is_pinned || false });

  const mut = useMutation({
    mutationFn: (data) => item
      ? announcementApi.update(item.id, data).then(r => r.data)
      : announcementApi.create(data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      onClose();
    },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ ...glass(), width: '100%', maxWidth: 520, padding: 28, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0', background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,114,182,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={16} color={ACCENT} />
            </div>
            <h3 style={{ color: '#E2E8F0', fontSize: 17, fontWeight: 700, margin: 0 }}>{item ? 'Edit Announcement' : 'New Announcement'}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={labelStyle}>Title</div>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title…" maxLength={200} />
          </div>
          <div>
            <div style={labelStyle}>Message</div>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your announcement here…"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div
              onClick={() => setForm(f => ({ ...f, is_pinned: !f.is_pinned }))}
              style={{ width: 38, height: 20, borderRadius: 10, background: form.is_pinned ? ACCENT : 'rgba(255,255,255,0.1)', border: form.is_pinned ? 'none' : '1px solid rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.is_pinned ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
            <span style={{ color: '#CBD5E1', fontSize: 14 }}>Pin this announcement</span>
            <Pin size={14} color={ACCENT} style={{ opacity: form.is_pinned ? 1 : 0.3 }} />
          </label>
        </div>

        {mut.error && <div style={{ color: '#F87171', fontSize: 13, marginTop: 10 }}>{mut.error.response?.data?.message || 'Failed to save'}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.title.trim()}
            style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, #EC4899)`, border: 'none', color: '#fff', cursor: mut.isPending || !form.title.trim() ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: mut.isPending || !form.title.trim() ? 0.6 : 1 }}>
            {mut.isPending ? 'Saving…' : item ? 'Save Changes' : 'Post Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete confirm ─── */
function useDeleteConfirm() {
  const [target, setTarget] = useState(null);
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: (id) => announcementApi.remove(id).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries(['announcements']); setTarget(null); },
  });

  const dialog = target && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ ...glass(), padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(248,113,113,0.1)', border: '2px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#F87171" />
        </div>
        <h3 style={{ color: '#E2E8F0', margin: '0 0 8px' }}>Delete Announcement</h3>
        <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px' }}>This will permanently remove the announcement. This cannot be undone.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => mut.mutate(target)} disabled={mut.isPending}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'linear-gradient(135deg, #F87171, #EF4444)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: mut.isPending ? 0.7 : 1 }}>
            {mut.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  return { setTarget, dialog };
}

/* ─── Main Export ─── */
export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'hr' || user?.role === 'lead';

  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | { ...item }
  const { setTarget: setDeleteTarget, dialog: deleteDialog } = useDeleteConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementApi.list().then(r => r.data),
  });

  const togglePin = useMutation({
    mutationFn: ({ id, is_pinned }) => announcementApi.update(id, { is_pinned: !is_pinned }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries(['announcements']),
  });

  const pinned   = (data || []).filter(a => a.is_pinned);
  const unpinned = (data || []).filter(a => !a.is_pinned);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 12 }}>
        <div>
          <h1 style={{ color: '#E2E8F0', fontSize: 26, fontWeight: 700, margin: 0 }}>Announcements</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>Company news and notices for the team</p>
        </div>
        {canManage && (
          <button onClick={() => setModal('create')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #EC4899)`, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: '0 4px 20px rgba(244,114,182,0.3)' }}>
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(244,114,182,0.2)', borderTop: `3px solid ${ACCENT}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (data || []).length === 0 ? (
        <div style={{ ...glass(), padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Megaphone size={28} color={ACCENT} />
          </div>
          <div style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No announcements yet</div>
          <div style={{ color: '#475569', fontSize: 14 }}>
            {canManage ? 'Create your first announcement using the button above.' : 'Check back later for company news and updates.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pinned section */}
          {pinned.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pin size={13} color={ACCENT} />
                <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Pinned</span>
              </div>
              {pinned.map(a => (
                <AnnouncementCard key={a.id} item={a} canManage={canManage}
                  onEdit={setModal}
                  onDelete={setDeleteTarget}
                  onTogglePin={(it) => togglePin.mutate(it)} />
              ))}
              {unpinned.length > 0 && <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />}
            </>
          )}

          {/* Regular */}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Latest</span>
                </div>
              )}
              {unpinned.map(a => (
                <AnnouncementCard key={a.id} item={a} canManage={canManage}
                  onEdit={setModal}
                  onDelete={setDeleteTarget}
                  onTogglePin={(it) => togglePin.mutate(it)} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {modal === 'create' && <AnnouncementModal onClose={() => setModal(null)} />}
      {modal && modal !== 'create' && <AnnouncementModal item={modal} onClose={() => setModal(null)} />}
      {deleteDialog}
    </div>
  );
}
