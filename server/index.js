import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNextPcNumber } from '../shared/calculations.js';
import { buildSummary, normalizeBuild } from './buildModel.js';
import { createStore } from './storage/index.js';
import { telegramAuthMiddleware } from './telegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3001);
const store = await createStore();
const schemaVersion = 2;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api',
  telegramAuthMiddleware({
    botToken: process.env.BOT_TOKEN,
    required: process.env.REQUIRE_TELEGRAM_AUTH === 'true'
  })
);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    storage: store.type,
    telegramUser: req.telegramUser || null
  });
});

app.get('/api/builds', async (req, res, next) => {
  try {
    const items = await store.list();
    res.json({ items, summary: buildSummary(items), storage: store.type, schemaVersion });
  } catch (error) {
    next(error);
  }
});

app.post('/api/builds', async (req, res, next) => {
  try {
    const items = await store.list();
    const item = normalizeBuild({
      ...req.body,
      pcNumber: req.body.pcNumber || getNextPcNumber(items)
    });
    const created = await store.create(item);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/api/builds/:id', async (req, res, next) => {
  try {
    const items = await store.list();
    const existing = items.find((item) => item.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const item = normalizeBuild({ ...req.body, id: req.params.id }, existing);
    const updated = await store.update(req.params.id, item);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/builds/:id/status', async (req, res, next) => {
  try {
    const items = await store.list();
    const existing = items.find((item) => item.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const item = normalizeBuild({ ...existing, status: req.body.status }, existing);
    const updated = await store.update(req.params.id, item);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/builds/:id', async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Storage: ${store.type}`);
});
