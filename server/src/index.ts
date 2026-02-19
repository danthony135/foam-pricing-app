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

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
