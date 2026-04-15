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
const schemaVersion = 4;

async function fetchBybitSellRate() {
  const response = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      userId: '',
      tokenId: 'USDT',
      currencyId: 'RUB',
      payment: [],
      side: '0',
      size: '10',
      page: '1',
      amount: '',
      authMaker: false,
      canTrade: false
    })
  });

  if (!response.ok) throw new Error(`Bybit returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.ret_code !== 0 && data.retCode !== 0) {
    throw new Error(data.ret_msg || data.retMsg || 'Bybit returned an error');
  }

  const prices = (data.result?.items || [])
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) throw new Error('Bybit rate is empty');

  return {
    value: Math.round((prices[0] + Number.EPSILON) * 100) / 100,
    source: 'Bybit P2P USDT/RUB',
    side: 'sell',
    fetchedAt: new Date().toISOString(),
    prices: prices.slice(0, 5).map((price) => Math.round((price + Number.EPSILON) * 100) / 100)
  };
}

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

app.get('/api/exchange-rate', async (req, res, next) => {
  try {
    res.json(await fetchBybitSellRate());
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

app.patch('/api/builds/:id/archive', async (req, res, next) => {
  try {
    const items = await store.list();
    const existing = items.find((item) => item.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const item = normalizeBuild(
      { ...existing, archived: req.body.archived === true },
      existing
    );
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
