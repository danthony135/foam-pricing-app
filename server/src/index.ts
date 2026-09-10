import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import foamRoutes from './routes/foams';
import dacronRoutes from './routes/dacrons';
import inventoryRoutes from './routes/inventory';
import skuRoutes from './routes/skus';
import odooRoutes from './routes/odoo';
import foamOrderRoutes from './routes/foamOrders';
import scrapRoutes from './routes/scrap';
import remnantRoutes from './routes/remnants';
import stationRoutes from './routes/station';
import { startOdooSyncLoop } from './services/odooSync';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/foams', foamRoutes);
app.use('/api/dacrons', dacronRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/skus', skuRoutes);
app.use('/api/odoo', odooRoutes);
app.use('/api/foam-orders', foamOrderRoutes);
app.use('/api/scrap', scrapRoutes);
app.use('/api/remnants', remnantRoutes);
app.use('/api/station', stationRoutes);

// Serve the client build in production
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
  console.log(`Foam app server running on port ${PORT}`);
});
