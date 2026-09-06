import { Router } from 'express';
import { logScrapForOrder, scrapSummary } from '../services/scrap';

const router = Router();

router.get('/', async (req, res, next) => {
  try { res.json(await scrapSummary(Math.max(1, Number(req.query.days) || 90))); } catch (err) { next(err); }
});

/** Manual (re)log for an order — normally happens automatically when the list is finished. */
router.post('/log/:orderId', async (req, res, next) => {
  try { res.json({ logged: await logScrapForOrder(+req.params.orderId) }); } catch (err) { next(err); }
});

export default router;
