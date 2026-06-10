/**
 * Live screen viewing — superuser-only, covert, on-demand.
 *
 * The desktop agent has no inbound connection, so viewing works pull-style over
 * a fast poll loop:
 *   1. Superuser opens an employee's live screen  → requestScreen() marks that
 *      user "wanted" for a short TTL (the open viewer re-pings to keep it alive).
 *   2. The agent (authenticated AS that employee) calls pollScreen() every few
 *      seconds; while "wanted" it captures the screen and POSTs uploadScreen().
 *   3. The superuser's modal polls getScreen() and renders the latest frame.
 *
 * State is intentionally in-memory and ephemeral (single pm2 fork process):
 * live frames are transient and never persisted to disk/DB.
 */
const asyncHandler = require('../utils/asyncHandler');

const REQUEST_TTL_MS = 20000;       // a view request stays "hot" 20s; the viewer re-pings
const FRAME_TTL_MS    = 60000;      // a stored frame older than this is considered stale
const MAX_FRAME_CHARS = 8000000;    // ~8MB base64 guard

const requests = new Map();   // userId -> requestedUntil (ms epoch)
const frames   = new Map();   // userId -> { image (base64 JPEG), capturedAt }

// Drop expired requests / stale frames so the maps never grow unbounded.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requests) if (v < now) requests.delete(k);
  for (const [k, v] of frames)   if (now - v.capturedAt > FRAME_TTL_MS) frames.delete(k);
}, 30000);
if (cleanup.unref) cleanup.unref();

const isWanted = (userId) => {
  const until = requests.get(String(userId));
  return !!(until && until > Date.now());
};

// Superuser: begin / keep-alive viewing an employee's screen.
exports.requestScreen = asyncHandler(async (req, res) => {
  const userId = String(req.params.userId);
  requests.set(userId, Date.now() + REQUEST_TTL_MS);
  const f = frames.get(userId);
  res.json({ ok: true, has_frame: !!f, captured_at: f?.capturedAt || null });
});

// Agent (token = the employee): should I capture right now?
exports.pollScreen = asyncHandler(async (req, res) => {
  res.json({ capture: isWanted(req.user.id), interval: 3 });
});

// Agent: upload a captured frame — only accepted while someone is viewing.
exports.uploadScreen = asyncHandler(async (req, res) => {
  if (!isWanted(req.user.id)) return res.json({ ok: false, drop: true });
  const { image } = req.body || {};
  if (!image || typeof image !== 'string' || image.length > MAX_FRAME_CHARS) {
    return res.status(400).json({ message: 'Invalid frame' });
  }
  frames.set(String(req.user.id), { image, capturedAt: Date.now() });
  res.json({ ok: true });
});

// Superuser: fetch the latest frame for an employee (also keeps the request alive).
exports.getScreen = asyncHandler(async (req, res) => {
  const userId = String(req.params.userId);
  requests.set(userId, Date.now() + REQUEST_TTL_MS);   // keep-alive on each fetch
  const f = frames.get(userId);
  const stale = f ? (Date.now() - f.capturedAt > FRAME_TTL_MS) : true;
  res.json({
    image:       f && !stale ? f.image : null,
    captured_at: f?.capturedAt || null,
    waiting:     !f || stale,        // true until the agent delivers a fresh frame
  });
});
