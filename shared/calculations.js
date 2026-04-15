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
