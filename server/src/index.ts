import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import foamRoutes from './routes/foams';
import dacronRoutes from './routes/dacrons';
import customerRoutes from './routes/customers';
import settingsRoutes from './routes/settings';
import pricingRoutes from './routes/pricing';
import quoteRoutes from './routes/quotes';
import inventoryRoutes from './routes/inventory';
import rulesRoutes from './routes/rules';
import aiRoutes from './routes/ai';
import importRoutes from './routes/import';
import quoteImportRoutes from './routes/quoteImport';
import skuRoutes from './routes/skus';
import odooRoutes from './routes/odoo';
import foamOrderRoutes from './routes/foamOrders';
import { startOdooSyncLoop } from './services/odooSync';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/foams', foamRoutes);
app.use('/api/dacrons', dacronRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);
app.use('/api/quote-import', quoteImportRoutes);
app.use('/api/skus', skuRoutes);
app.use('/api/odoo', odooRoutes);
app.use('/api/foam-orders', foamOrderRoutes);

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

startOdooSyncLoop();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
