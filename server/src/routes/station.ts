/**
 * Cutting-table station: the projector display and the overhead camera.
 *
 * Everything is tiny shared state in AppSetting so the operator's tablet, the
 * cut-station TV and the projector PC agree:
 *   station.state        what the projector should show right now
 *                        { mode: idle|slab|grid|calibrate, orderId, slabKey,
 *                          calibrate: { planeIdx, corners } }
 *   station.calibration  { refLengthIn, refWidthIn,
 *                          projector: { screenW, screenH, planes: [{thicknessIn, corners[4]}] },
 *                          camera:    { imgW, imgH,       planes: [{thicknessIn, corners[4]}] } }
 *                        corners are TL, TR, BR, BL of the reference rectangle
 *                        (0,0)-(L,W) in projector px / camera image px, per height.
 *   station.prefs        line width, colour, labels for the projected picture
 *
 * Camera relay: the tablet asks for a snapshot, the projector PC (which has the
 * USB camera) polls, snaps and uploads a JPEG, the tablet picks it up. The last
 * snapshot is kept in memory only.
 */
import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}
async function putSetting(key: string, value: unknown) {
  await prisma.appSetting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } });
}

export const DEFAULT_STATE = { mode: 'idle', orderId: null as number | null, slabKey: null as string | null, calibrate: null as null | { planeIdx: number; corners: [number, number][]; active?: number }, updatedAt: '' };
export const DEFAULT_PREFS = { lineWidth: 3, color: '#00ff66', colorMode: 'mo', showLabels: true, labelSize: 22, showOutline: true, showGrid: false };

router.get('/state', async (_req, res, next) => {
  try {
    const [state, calibration, prefs] = await Promise.all([getSetting('station.state', DEFAULT_STATE), getSetting('station.calibration', null), getSetting('station.prefs', DEFAULT_PREFS)]);
    res.json({ state, calibration, prefs: { ...DEFAULT_PREFS, ...(prefs as object) } });
  } catch (err) { next(err); }
});

/** Partial update of what the projector shows. */
router.put('/state', async (req, res, next) => {
  try {
    const cur = await getSetting('station.state', DEFAULT_STATE);
    const b = req.body ?? {};
    const next_ = { ...cur, ...b, updatedAt: new Date().toISOString() };
    await putSetting('station.state', next_);
    res.json(next_);
  } catch (err) { next(err); }
});

router.get('/calibration', async (_req, res, next) => {
  try { res.json(await getSetting('station.calibration', null)); } catch (err) { next(err); }
});

/** Replace the whole calibration object (the client edits it as a document). */
router.put('/calibration', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const cal = {
      refLengthIn: Number(b.refLengthIn) || 82,
      refWidthIn: Number(b.refWidthIn) || 36,
      projector: b.projector ?? null,
      camera: b.camera ?? null,
      updatedAt: new Date().toISOString(),
    };
    await putSetting('station.calibration', cal);
    res.json(cal);
  } catch (err) { next(err); }
});

router.put('/prefs', async (req, res, next) => {
  try {
    const cur = await getSetting('station.prefs', DEFAULT_PREFS);
    const next_ = { ...DEFAULT_PREFS, ...(cur as object), ...(req.body ?? {}) };
    await putSetting('station.prefs', next_);
    res.json(next_);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Camera relay (in memory)
// ---------------------------------------------------------------------------
let pending: { id: number; at: number } | null = null;
let snapshot: { id: number; at: number; jpeg: string; w: number; h: number } | null = null;
let seq = 1;

/** Tablet: please take a picture. */
router.post('/camera/request', (_req, res) => {
  pending = { id: seq++, at: Date.now() };
  res.json(pending);
});
/** Projector PC: anything to shoot? (requests older than 30 s are dropped) */
router.get('/camera/request', (_req, res) => {
  if (pending && Date.now() - pending.at > 30_000) pending = null;
  res.json(pending);
});
/** Projector PC: here is the picture. Body { id, jpeg: dataURL or base64, w, h } */
router.post('/camera/snapshot', (req, res) => {
  const b = req.body ?? {};
  if (!b.jpeg) return res.status(400).json({ error: 'jpeg required' });
  snapshot = { id: Number(b.id) || seq++, at: Date.now(), jpeg: String(b.jpeg), w: Number(b.w) || 0, h: Number(b.h) || 0 };
  if (pending && pending.id === snapshot.id) pending = null;
  res.json({ id: snapshot.id, at: snapshot.at });
});
/** Tablet: latest picture (optionally only if newer than ?after=<id>). */
router.get('/camera/snapshot', (req, res) => {
  const after = Number(req.query.after) || 0;
  if (!snapshot || snapshot.id <= after) return res.json(null);
  res.json(snapshot);
});
/** Is a station camera agent alive? The agent pings while it polls. */
let agentSeen = 0;
router.post('/camera/ping', (_req, res) => { agentSeen = Date.now(); res.json({ ok: true }); });
router.get('/camera/agent', (_req, res) => res.json({ online: Date.now() - agentSeen < 8000, lastSeen: agentSeen || null }));

export default router;
