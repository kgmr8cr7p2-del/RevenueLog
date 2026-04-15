const SPREADSHEET_ID = '1nTQV1MGkjdDLkrwq_FjFCYLj6olrtkpwFwB2ord0fjs';
const SHEET_NAME = 'PC Builds';

const STATUSES = ['assembly', 'paid', 'shipping', 'received'];
const COMPONENTS = [
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

const ACCOUNT_PRICES_USD = {
  auto: 15.1,
  manual: 15.5
};

const HEADER = [
  'id',
  'status',
  'pcNumber',
  'contractNumber',
  'componentsTotalRub',
  'accountsManual',
  'accountsAuto',
  'accountsCostUsd',
  'fsmSubscriptionUsd',
  'paidAmount',
  'paidCurrency',
  'exchangeRate',
  'deliveryAmount',
  'deliveryCurrency',
  'expensesRub',
  'expensesUsd',
  'profitRub',
  'profitUsd',
  'telegramId',
  'note',
  'createdAt',
  'updatedAt',
  'json'
];

function doGet(e) {
  const callback = sanitizeCallback_(e.parameter.callback || '');

  try {
    assertTelegramAuth_(e.parameter.initData || '');
    const action = e.parameter.action || 'list';
    const payload = parsePayload_(e.parameter.payload || '{}');
    const result = route_(action, payload);
    return jsonp_(callback, Object.assign({ ok: true }, result));
  } catch (error) {
    return jsonp_(callback, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function route_(action, payload) {
  if (action === 'list') {
    const items = listBuilds_();
    return {
      items,
      summary: buildSummary_(items),
      storage: 'google-sheets'
    };
  }

  if (action === 'create') {
    return { item: createBuild_(payload) };
  }

  if (action === 'update') {
    return { item: updateBuild_(payload.id, payload.build) };
  }

  if (action === 'status') {
    return { item: updateStatus_(payload.id, payload.status) };
  }

  if (action === 'delete') {
    deleteBuild_(payload.id);
    return { deleted: true };
  }

  throw new Error('Unknown action');
}

function jsonp_(callback, data) {
  const body = callback ? `${callback}(${JSON.stringify(data)});` : JSON.stringify(data);
  return ContentService.createTextOutput(body).setMimeType(
    callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON
  );
}

function sanitizeCallback_(callback) {
  if (!callback) return '';
  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) return callback;
  throw new Error('Invalid callback');
}

function parsePayload_(value) {
  try {
    return JSON.parse(value || '{}');
  } catch (error) {
    throw new Error('Invalid payload JSON');
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
  const hasDifferentHeader = HEADER.some((value, index) => current[index] !== value);

  if (hasDifferentHeader) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  }
}

function listBuilds_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, HEADER.length)
    .getValues()
    .map(fromRow_)
    .filter(Boolean);
}

function createBuild_(payload) {
  const sheet = getSheet_();
  const item = normalizeBuild_(payload || {}, null);
  sheet.appendRow(toRow_(item));
  return item;
}

function updateBuild_(id, payload) {
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('Build not found');

  const existing = fromRow_(sheet.getRange(rowNumber, 1, 1, HEADER.length).getValues()[0]);
  const item = normalizeBuild_(Object.assign({}, payload || {}, { id }), existing);
  sheet.getRange(rowNumber, 1, 1, HEADER.length).setValues([toRow_(item)]);
  return item;
}

function updateStatus_(id, status) {
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('Build not found');

  const existing = fromRow_(sheet.getRange(rowNumber, 1, 1, HEADER.length).getValues()[0]);
  const item = normalizeBuild_(Object.assign({}, existing, { status }), existing);
  sheet.getRange(rowNumber, 1, 1, HEADER.length).setValues([toRow_(item)]);
  return item;
}

function deleteBuild_(id) {
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('Build not found');
  sheet.deleteRow(rowNumber);
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) return index + 2;
  }
  return 0;
}

function fromRow_(row) {
  const json = row[HEADER.indexOf('json')];
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function toRow_(item) {
  return [
    item.id,
    item.status,
    item.pcNumber,
    item.contractNumber,
    item.totals.componentsTotalRub,
    item.accounts.manual,
    item.accounts.auto,
    item.totals.accountsCostUsd,
    item.fsmSubscriptionUsd,
    item.paid.amount,
    item.paid.currency,
    item.paid.exchangeRate,
    item.delivery.amount,
    item.delivery.currency,
    item.totals.expensesRub,
    item.totals.expensesUsd,
    item.totals.profitRub,
    item.totals.profitUsd,
    item.telegramId,
    item.note,
    item.createdAt,
    item.updatedAt,
    JSON.stringify(item)
  ];
}

function normalizeBuild_(input, existing) {
  const now = new Date().toISOString();
  const normalized = {
    id: existing && existing.id ? existing.id : input.id || Utilities.getUuid(),
    status: STATUSES.indexOf(input.status) >= 0 ? input.status : 'assembly',
    createdAt: existing && existing.createdAt ? existing.createdAt : input.createdAt || now,
    updatedAt: now,
    pcNumber: String(input.pcNumber || ''),
    contractNumber: String(input.contractNumber || ''),
    components: normalizeComponents_(input.components),
    accounts: {
      manual: toNumber_(input.accounts && input.accounts.manual),
      auto: toNumber_(input.accounts && input.accounts.auto)
    },
    fsmSubscriptionUsd: toNumber_(input.fsmSubscriptionUsd),
    paid: {
      amount: toNumber_(input.paid && input.paid.amount),
      currency: normalizeCurrency_(input.paid && input.paid.currency, 'RUB'),
      exchangeRate: toNumber_(input.paid && input.paid.exchangeRate)
    },
    delivery: {
      amount: toNumber_(input.delivery && input.delivery.amount),
      currency: normalizeCurrency_(input.delivery && input.delivery.currency, 'RUB')
    },
    telegramId: String(input.telegramId || ''),
    note: String(input.note || '')
  };

  normalized.totals = calculateTotals_(normalized);
  return normalized;
}

function normalizeComponents_(components) {
  const byKey = {};
  (Array.isArray(components) ? components : []).forEach((component) => {
    byKey[component.key] = component;
  });

  return COMPONENTS.map((component) => {
    const input = byKey[component.key] || {};
    return {
      key: component.key,
      label: component.label,
      value: String(input.value || ''),
      priceRub: toNumber_(input.priceRub)
    };
  });
}

function normalizeCurrency_(value, fallback) {
  return value === 'USD' ? 'USD' : fallback;
}

function calculateTotals_(build) {
  const exchangeRate = toNumber_(build.paid.exchangeRate);
  const componentsTotalRub = build.components.reduce((sum, component) => {
    return sum + toNumber_(component.priceRub);
  }, 0);

  const manualAccounts = toNumber_(build.accounts.manual);
  const autoAccounts = toNumber_(build.accounts.auto);
  const accountsCostUsd =
    manualAccounts * ACCOUNT_PRICES_USD.manual + autoAccounts * ACCOUNT_PRICES_USD.auto;
  const fsmSubscriptionUsd = toNumber_(build.fsmSubscriptionUsd);

  const paidRub = currencyToRub_(build.paid.amount, build.paid.currency, exchangeRate);
  const paidUsd = currencyToUsd_(build.paid.amount, build.paid.currency, exchangeRate);
  const deliveryRub = currencyToRub_(build.delivery.amount, build.delivery.currency, exchangeRate);
  const deliveryUsd = currencyToUsd_(build.delivery.amount, build.delivery.currency, exchangeRate);

  const usdExpenses = accountsCostUsd + fsmSubscriptionUsd + deliveryUsd;
  const expensesRub = componentsTotalRub + usdExpenses * exchangeRate;
  const expensesUsd = exchangeRate > 0 ? expensesRub / exchangeRate : usdExpenses;

  return {
    exchangeRate: roundMoney_(exchangeRate),
    componentsTotalRub: roundMoney_(componentsTotalRub),
    accountsCostUsd: roundMoney_(accountsCostUsd),
    fsmSubscriptionUsd: roundMoney_(fsmSubscriptionUsd),
    deliveryRub: roundMoney_(deliveryRub),
    deliveryUsd: roundMoney_(deliveryUsd),
    paidRub: roundMoney_(paidRub),
    paidUsd: roundMoney_(paidUsd),
    expensesRub: roundMoney_(expensesRub),
    expensesUsd: roundMoney_(expensesUsd),
    profitRub: roundMoney_(paidRub - expensesRub),
    profitUsd: roundMoney_(paidUsd - expensesUsd)
  };
}

function buildSummary_(items) {
  return items.reduce(
    (summary, item) => {
      summary.count += 1;
      summary.expensesRub += toNumber_(item.totals && item.totals.expensesRub);
      summary.expensesUsd += toNumber_(item.totals && item.totals.expensesUsd);
      summary.profitRub += toNumber_(item.totals && item.totals.profitRub);
      summary.profitUsd += toNumber_(item.totals && item.totals.profitUsd);
      summary.paidRub += toNumber_(item.totals && item.totals.paidRub);
      summary.paidUsd += toNumber_(item.totals && item.totals.paidUsd);
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

function currencyToRub_(amount, currency, exchangeRate) {
  return currency === 'USD' ? toNumber_(amount) * toNumber_(exchangeRate) : toNumber_(amount);
}

function currencyToUsd_(amount, currency, exchangeRate) {
  const safeAmount = toNumber_(amount);
  const safeRate = toNumber_(exchangeRate);
  if (currency === 'USD') return safeAmount;
  return safeRate > 0 ? safeAmount / safeRate : 0;
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney_(value) {
  return Math.round((toNumber_(value) + Number.EPSILON) * 100) / 100;
}

function assertTelegramAuth_(initData) {
  const properties = PropertiesService.getScriptProperties();
  const requireAuth = properties.getProperty('REQUIRE_TELEGRAM_AUTH') === 'true';
  if (!requireAuth) return;

  const botToken = properties.getProperty('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN is not configured in Script Properties');
  if (!verifyTelegramInitData_(initData, botToken)) {
    throw new Error('Telegram authorization failed');
  }
}

function verifyTelegramInitData_(initData, botToken) {
  if (!initData || !botToken) return false;

  const params = parseQueryString_(initData);
  const receivedHash = params.hash;
  if (!receivedHash) return false;
  delete params.hash;

  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');

  const secretKey = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  const calculatedHash = bytesToHex_(
    Utilities.computeHmacSha256Signature(dataCheckString, secretKey)
  );

  return calculatedHash === receivedHash;
}

function parseQueryString_(query) {
  return String(query || '')
    .split('&')
    .filter(Boolean)
    .reduce((params, part) => {
      const equalsIndex = part.indexOf('=');
      const rawKey = equalsIndex >= 0 ? part.slice(0, equalsIndex) : part;
      const rawValue = equalsIndex >= 0 ? part.slice(equalsIndex + 1) : '';
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      params[key] = value;
      return params;
    }, {});
}

function bytesToHex_(bytes) {
  return bytes
    .map((byte) => {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, '0');
    })
    .join('');
}
