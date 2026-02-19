import { Router } from 'express';
import { prisma } from '../index';
import { parseQuoteExcel } from '../services/quoteExcelImporter';
import { parseTextWithAi } from '../services/quoteAiParser';
import { extractFromPdf } from '../services/pdfExtractor';
import { resolveItems } from '../services/quoteImportResolver';
import { priceItems } from '../services/quoteImportPricer';
import type { PricedQuoteLineItem } from '../services/quoteImportTypes';

const router = Router();

// Parse Excel/CSV file (base64)
router.post('/parse/excel', async (req, res, next) => {
  try {
    const { data, mapping } = req.body;
    if (!data) return res.status(400).json({ error: 'No file data provided' });
    const buffer = Buffer.from(data, 'base64');
    const items = parseQuoteExcel(buffer, mapping);
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

// Parse email text via Claude AI
router.post('/parse/email', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No email text provided' });
    const items = await parseTextWithAi(text);
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

// Parse PDF via text extraction + Claude vision
router.post('/parse/pdf', async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'No PDF data provided' });
    const buffer = Buffer.from(data, 'base64');
    const items = await extractFromPdf(buffer);
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

// Match raw items to DB records
router.post('/resolve', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });
    const resolved = await resolveItems(items);
    const hasErrors = resolved.some(r => r.errors.length > 0);
    res.json({ items: resolved, hasErrors });
  } catch (err) { next(err); }
});

// Run resolved items through pricing engine
router.post('/price', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });
    const priced = await priceItems(items);
    res.json({ items: priced });
  } catch (err) { next(err); }
});

// Create draft CushionQuote records
router.post('/save', async (req, res, next) => {
  try {
    const { items } = req.body as { items: PricedQuoteLineItem[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });

    const validItems = items.filter(i => i.errors.length === 0 && i.customerId && i.foamId);
    if (validItems.length === 0) return res.status(400).json({ error: 'No valid items to save' });

    const quotes = [];
    for (const item of validItems) {
      const quote = await prisma.cushionQuote.create({
        data: {
          customerId: item.customerId!,
          foamId: item.foamId!,
          dacronId: item.dacronId,
          lengthIn: item.lengthIn,
          widthIn: item.widthIn,
          heightIn: item.heightIn,
          quantity: item.quantity,
          makeTimeMin: item.makeTimeMin,
          boardFeet: item.boardFeet,
          dacronSqFt: item.dacronSqFt,
          materialCost: item.materialCost,
          laborCost: item.laborCost,
          overheadAmount: item.overheadAmount,
          indirectLaborAmount: item.indirectLaborAmount,
          subtotal: item.subtotal,
          markupAmount: item.markupAmount,
          shippingCost: item.shippingCost,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          partNumber: item.partNumber,
          status: 'draft',
          notes: item.notes || null,
        },
        include: { customer: true, foam: true, dacron: true },
      });
      quotes.push(quote);
    }

    res.status(201).json({ quotes, count: quotes.length });
  } catch (err) { next(err); }
});

export default router;
