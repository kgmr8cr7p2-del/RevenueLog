import crypto from 'node:crypto';
import { calculateTotals, COMPONENTS, STATUSES, toNumber } from '../shared/calculations.js';

const ALLOWED_STATUSES = new Set(STATUSES.map((status) => status.id));

function normalizeCurrency(value, fallback = 'RUB') {
  return value === 'USD' ? 'USD' : fallback;
}

function normalizeComponents(inputComponents) {
  const inputByKey = new Map(
    (Array.isArray(inputComponents) ? inputComponents : []).map((component) => [
      component.key,
      component
    ])
  );

  return COMPONENTS.map((component) => {
    const input = inputByKey.get(component.key) || {};
    return {
      key: component.key,
      label: component.label,
      value: String(input.value || ''),
      priceRub: toNumber(input.priceRub)
    };
  });
}

export function normalizeBuild(input = {}, existing = {}) {
  const now = new Date().toISOString();
  const normalized = {
    id: existing.id || input.id || crypto.randomUUID(),
    status: ALLOWED_STATUSES.has(input.status) ? input.status : existing.status || 'assembly',
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
    pcNumber: String(input.pcNumber || ''),
    contractNumber: String(input.contractNumber || ''),
    components: normalizeComponents(input.components),
    accounts: {
      manual: toNumber(input.accounts?.manual),
      auto: toNumber(input.accounts?.auto)
    },
    fsmSubscriptionUsd: toNumber(input.fsmSubscriptionUsd),
    paid: {
      amount: toNumber(input.paid?.amount),
      currency: normalizeCurrency(input.paid?.currency, 'RUB'),
      exchangeRate: toNumber(input.paid?.exchangeRate)
    },
    delivery: {
      amount: toNumber(input.delivery?.amount),
      currency: normalizeCurrency(input.delivery?.currency, 'RUB')
    },
    telegramId: String(input.telegramId || ''),
    note: String(input.note || '')
  };

  return {
    ...normalized,
    totals: calculateTotals(normalized)
  };
}

export function buildSummary(items) {
  return items.reduce(
    (summary, item) => {
      summary.count += 1;
      summary.expensesRub += toNumber(item.totals?.expensesRub);
      summary.expensesUsd += toNumber(item.totals?.expensesUsd);
      summary.profitRub += toNumber(item.totals?.profitRub);
      summary.profitUsd += toNumber(item.totals?.profitUsd);
      summary.paidRub += toNumber(item.totals?.paidRub);
      summary.paidUsd += toNumber(item.totals?.paidUsd);
      return summary;
    },
    {
      count: 0,
      expensesRub: 0,
      expensesUsd: 0,
      profitRub: 0,
      profitUsd: 0,
      paidRub: 0,
      paidUsd: 0
    }
  );
}
