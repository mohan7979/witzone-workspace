// Circular user avatar — shows the profile photo (thumbnail) when the user has
// one, otherwise falls back to their initials on a gradient. Drop-in replacement
// for the old hand-rolled "initials in a circle" divs.
export default function Avatar({
  user,
  size = 32,
  gradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)',
  glow,
  fontSize,
  style = {},
}) {
  const photo = user?.photo_thumb || user?.photo || null;
  const fn = (user?.first_name || '').trim();
  const ln = (user?.last_name || '').trim();
  const initials = `${fn[0] || ''}${ln[0] || ''}`.toUpperCase() || '?';
  const fs = fontSize || Math.max(9, Math.round(size * 0.4));

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: photo ? 'rgba(255,255,255,0.06)' : gradient,
        color: 'white',
        fontSize: fs,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: glow ? `0 0 12px ${glow}` : undefined,
        ...style,
      }}
    >
      {photo
        ? <img src={photo} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}
