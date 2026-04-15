export const STATUSES = [
  { id: 'assembly', title: 'Сборка' },
  { id: 'paid', title: 'Оплачен' },
  { id: 'shipping', title: 'Едет к покупателю' },
  { id: 'received', title: 'Покупатель получил' }
];

export const COMPONENTS = [
  { key: 'cpu', label: 'Процессор' },
  { key: 'motherboard', label: 'Материнская плата' },
  { key: 'ram', label: 'Оперативная память' },
  { key: 'gpu', label: 'Видеокарта' },
  { key: 'storage', label: 'Накопитель' },
  { key: 'psu', label: 'Блок питания' },
  { key: 'cooler', label: 'Кулер' },
  { key: 'case', label: 'Корпус' },
  { key: 'assemblyWork', label: 'Сборка' }
];

export const ACCOUNT_PRICES_USD = {
  auto: 15.1,
  manual: 15.5
};

export function getStatusTitle(statusId) {
  return STATUSES.find((status) => status.id === statusId)?.title || statusId || '';
}

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInputValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

export function isCurrentMonth(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function getBuildReportDate(build) {
  return build?.paymentDate || build?.receivedDate || build?.createdAt || build?.updatedAt || '';
}

export function addDaysToDateString(dateValue, days) {
  const start = toDateInputValue(dateValue);
  const safeDays = Math.floor(toNumber(days));
  if (!start || safeDays <= 0) return '';

  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + safeDays);
  return date.toISOString().slice(0, 10);
}

export function getNextPcNumber(builds) {
  const maxNumber = (Array.isArray(builds) ? builds : []).reduce((max, build) => {
    const parsed = Number.parseInt(String(build?.pcNumber || '').replace(/\D+/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return String(maxNumber + 1);
}

export function isBuildOverdue(build, now = new Date()) {
  if (!build?.buildDeadline || build?.status === 'received') return false;
  const deadline = toDate(build.buildDeadline);
  if (!deadline) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return deadline < today;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function currencyToRub(amount, currency, exchangeRate) {
  const safeAmount = toNumber(amount);
  return currency === 'USD' ? safeAmount * toNumber(exchangeRate) : safeAmount;
}

export function currencyToUsd(amount, currency, exchangeRate) {
  const safeAmount = toNumber(amount);
  const safeRate = toNumber(exchangeRate);
  if (currency === 'USD') return safeAmount;
  return safeRate > 0 ? safeAmount / safeRate : 0;
}

export function calculateTotals(build) {
  const exchangeRate = toNumber(build?.paid?.exchangeRate || build?.exchangeRate);
  const components = Array.isArray(build?.components) ? build.components : [];
  const componentsTotalRub = components.reduce((sum, component) => {
    return sum + toNumber(component.priceRub);
  }, 0);

  const manualAccounts = toNumber(build?.accounts?.manual);
  const autoAccounts = toNumber(build?.accounts?.auto);
  const accountsCostUsd =
    manualAccounts * ACCOUNT_PRICES_USD.manual + autoAccounts * ACCOUNT_PRICES_USD.auto;

  const fsmSubscriptionUsd = toNumber(build?.fsmSubscriptionUsd);
  const paid = build?.paid || {};
  const delivery = build?.delivery || {};

  const paidRub = currencyToRub(paid.amount, paid.currency, exchangeRate);
  const paidUsd = currencyToUsd(paid.amount, paid.currency, exchangeRate);

  const deliveryRub = currencyToRub(delivery.amount, delivery.currency, exchangeRate);
  const deliveryUsd = currencyToUsd(delivery.amount, delivery.currency, exchangeRate);

  const usdExpenses = accountsCostUsd + fsmSubscriptionUsd + deliveryUsd;
  const rubExpenses = componentsTotalRub + usdExpenses * exchangeRate;
  const expensesUsd = exchangeRate > 0 ? rubExpenses / exchangeRate : usdExpenses;

  const profitRub = paidRub - rubExpenses;
  const profitUsd = paidUsd - expensesUsd;

  return {
    exchangeRate: roundMoney(exchangeRate),
    componentsTotalRub: roundMoney(componentsTotalRub),
    accountsCostUsd: roundMoney(accountsCostUsd),
    fsmSubscriptionUsd: roundMoney(fsmSubscriptionUsd),
    deliveryRub: roundMoney(deliveryRub),
    deliveryUsd: roundMoney(deliveryUsd),
    paidRub: roundMoney(paidRub),
    paidUsd: roundMoney(paidUsd),
    expensesRub: roundMoney(rubExpenses),
    expensesUsd: roundMoney(expensesUsd),
    profitRub: roundMoney(profitRub),
    profitUsd: roundMoney(profitUsd)
  };
}

export function formatRub(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2
  }).format(toNumber(value));
}

export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(toNumber(value));
}
