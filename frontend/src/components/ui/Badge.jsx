const statusMap = {
  present:   { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: '#34D399', dot: '#34D399'  },
  absent:    { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#F87171', dot: '#F87171'  },
  half_day:  { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#FBBF24', dot: '#FBBF24'  },
  on_leave:  { bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.35)',  color: '#60A5FA', dot: '#60A5FA'  },
  holiday:   { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.35)', color: '#A78BFA', dot: '#A78BFA'  },
  pending:   { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#FBBF24', dot: '#FBBF24'  },
  approved:  { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: '#34D399', dot: '#34D399'  },
  rejected:  { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#F87171', dot: '#F87171'  },
  cancelled: { bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)', color: '#94A3B8', dot: '#94A3B8'  },
  active:    { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: '#34D399', dot: '#34D399'  },
  inactive:  { bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)', color: '#94A3B8', dot: '#94A3B8'  },
  suspended: { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#F87171', dot: '#F87171'  },
  late:      { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#FBBF24', dot: '#FBBF24'  },
  early_out: { bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.35)',  color: '#FB923C', dot: '#FB923C'  },
};

const fallback = { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', color: '#94A3B8', dot: '#94A3B8' };

export default function Badge({ status, label, className }) {
  const s = statusMap[status] ?? fallback;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '6px',
      fontSize: '11px', fontWeight: 600,
      color: s.color,
      textTransform: 'capitalize',
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap',
    }} className={className}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {label ?? status?.replace(/_/g, ' ')}
    </span>
  );
}
