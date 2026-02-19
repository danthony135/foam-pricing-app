import { Router } from 'express';
import { prisma } from '../index';
import { parseExcelBuffer } from '../services/excelImporter';

const router = Router();

// Preview import (doesn't save)
router.post('/foams/preview', async (req, res, next) => {
  try {
    const { data, mapping } = req.body; // data is base64-encoded file
    const buffer = Buffer.from(data, 'base64');
    const rows = parseExcelBuffer(buffer, mapping);
    res.json({ rows, count: rows.length });
  } catch (err) { next(err); }
});

// Execute import
router.post('/foams', async (req, res, next) => {
  try {
    const { data, mapping } = req.body;
    const buffer = Buffer.from(data, 'base64');
    const rows = parseExcelBuffer(buffer, mapping);

    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const row of rows) {
      try {
        await prisma.foam.upsert({
          where: { grade: row.grade },
          update: {
            density: row.density,
            ild: row.ild,
            costPerBoardFoot: row.costPerBoardFoot,
            supplier: row.supplier,
            description: row.description,
          },
          create: row,
        });
        const exists = await prisma.foam.findUnique({ where: { grade: row.grade } });
        if (exists) updated++; else created++;
      } catch (e: any) {
        errors.push(`${row.grade}: ${e.message}`);
      }
    }

    // Recount properly
    res.json({ imported: rows.length, errors });
  } catch (err) { next(err); }
});

export default router;
