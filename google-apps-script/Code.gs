const SPREADSHEET_ID = '1nTQV1MGkjdDLkrwq_FjFCYLj6olrtkpwFwB2ord0fjs';
const SHEET_NAME = 'PC Builds';
const SCHEMA_VERSION = 4;

const STATUSES = ['assembly', 'paid', 'shipping', 'received'];
const STATUS_TITLES = {
  assembly: 'Сборка',
  paid: 'Оплачен',
  shipping: 'Едет к покупателю',
  received: 'Покупатель получил'
};
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
  'json',
  'paymentDate',
  'shippingDate',
  'receivedDate',
  'buildDeadline',
  'lastChangedAt',
  'trackingNumber',
  'assemblyTermDays',
  'assemblyStartDate',
  'archived',
  'notificationHalfSentAt',
  'notificationTwoDaysSentAt'
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
      storage: 'google-sheets',
      schemaVersion: SCHEMA_VERSION
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

  if (action === 'archive') {
    return { item: updateArchive_(payload.id, payload.archived) };
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
  const input = payload || {};
  const item = normalizeBuild_(
    Object.assign({}, input, {
      pcNumber: input.pcNumber || getNextPcNumber_(listBuilds_())
    }),
    null
  );
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
  sendStatusNotificationIfNeeded_(item, existing && existing.status);
  return item;
}

function updateStatus_(id, status) {
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('Build not found');

  const existing = fromRow_(sheet.getRange(rowNumber, 1, 1, HEADER.length).getValues()[0]);
  const item = normalizeBuild_(Object.assign({}, existing, { status }), existing);
  sheet.getRange(rowNumber, 1, 1, HEADER.length).setValues([toRow_(item)]);
  sendStatusNotificationIfNeeded_(item, existing && existing.status);
  return item;
}

function updateArchive_(id, archived) {
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('Build not found');

  const existing = fromRow_(sheet.getRange(rowNumber, 1, 1, HEADER.length).getValues()[0]);
  const item = normalizeBuild_(
    Object.assign({}, existing, { archived: archived === true || archived === 'true' }),
    existing
  );
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
    const item = JSON.parse(json);
    HEADER.forEach((key, index) => {
      const value = row[index];
      if (value === '' || value === undefined || item[key] !== undefined) return;
      item[key] = key === 'archived' ? value === true || value === 'TRUE' || value === 'true' : value;
    });
    if (item.archived === undefined) item.archived = false;
    return item;
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
    JSON.stringify(item),
    item.paymentDate,
    item.shippingDate,
    item.receivedDate,
    item.buildDeadline,
    item.lastChangedAt,
    item.trackingNumber || '',
    item.assemblyTermDays || '',
    item.assemblyStartDate || '',
    item.archived === true,
    item.notificationHalfSentAt || '',
    item.notificationTwoDaysSentAt || ''
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
    trackingNumber: String(input.trackingNumber || ''),
    paymentDate: normalizeDate_(input.paymentDate),
    shippingDate: normalizeDate_(input.shippingDate),
    receivedDate: normalizeDate_(input.receivedDate),
    buildDeadline: normalizeDate_(input.buildDeadline),
    assemblyTermDays: normalizePositiveInteger_(input.assemblyTermDays),
    assemblyStartDate: normalizeDate_(input.assemblyStartDate),
    lastChangedAt: now,
    telegramId: String(input.telegramId || ''),
    archived:
      input.archived === undefined && existing
        ? existing.archived === true || existing.archived === 'true'
        : input.archived === true || input.archived === 'true',
    notificationHalfSentAt:
      input.notificationHalfSentAt || (existing && existing.notificationHalfSentAt) || '',
    notificationTwoDaysSentAt:
      input.notificationTwoDaysSentAt || (existing && existing.notificationTwoDaysSentAt) || '',
    note: String(input.note || '')
  };

  const today = now.slice(0, 10);
  if (normalized.status === 'paid' && !normalized.paymentDate) normalized.paymentDate = today;
  if (normalized.status === 'shipping' && !normalized.shippingDate) normalized.shippingDate = today;
  if (normalized.status === 'received' && !normalized.receivedDate) normalized.receivedDate = today;
  if (normalized.assemblyTermDays && !normalized.assemblyStartDate) {
    normalized.assemblyStartDate = normalized.paymentDate || normalized.createdAt.slice(0, 10);
  }
  if (normalized.assemblyTermDays && !normalized.buildDeadline) {
    normalized.buildDeadline = formatDateOnly_(
      addDaysToDate_(parseDateOnly_(normalized.assemblyStartDate || normalized.createdAt), normalized.assemblyTermDays)
    );
  }

  normalized.totals = calculateTotals_(normalized);
  return normalized;
}

function getNextPcNumber_(items) {
  const maxNumber = (Array.isArray(items) ? items : []).reduce((max, item) => {
    const parsed = parseInt(String((item && item.pcNumber) || '').replace(/\D+/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return String(maxNumber + 1);
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

function normalizeDate_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}

function normalizePositiveInteger_(value) {
  const number = Math.floor(toNumber_(value));
  return number > 0 ? number : '';
}

function parseDateOnly_(value) {
  const normalized = normalizeDate_(String(value || '').slice(0, 10));
  if (!normalized) return null;
  const parts = normalized.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDaysToDate_(date, days) {
  if (!date) return null;
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + Math.floor(toNumber_(days)));
  return next;
}

function formatDateOnly_(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function checkAssemblyNotifications() {
  const properties = PropertiesService.getScriptProperties();
  const botToken = properties.getProperty('BOT_TOKEN');
  const trustedUserIds = getTrustedTelegramUserIds_(properties);
  if (!botToken || !trustedUserIds.length) {
    return { checked: 0, updated: 0, messages: 0 };
  }

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { checked: 0, updated: 0, messages: 0 };

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADER.length).getValues();
  const now = new Date();
  const nowIso = now.toISOString();
  let checked = 0;
  let updated = 0;
  let messages = 0;

  rows.forEach((row, index) => {
    const item = fromRow_(row);
    if (!item || item.archived || item.status === 'received') return;

    const termDays = toNumber_(item.assemblyTermDays);
    if (termDays <= 0) return;

    const startDate = parseDateOnly_(
      item.assemblyStartDate || item.paymentDate || String(item.createdAt || '').slice(0, 10)
    );
    if (!startDate) return;

    const deadline =
      parseDateOnly_(item.buildDeadline) || addDaysToDate_(startDate, termDays);
    if (!deadline) return;

    checked += 1;
    let changed = false;
    const halfDate = addDaysToDate_(startDate, Math.ceil(termDays / 2));
    const twoDaysBeforeDeadline = addDaysToDate_(deadline, -2);

    if (halfDate && now.getTime() >= halfDate.getTime() && !item.notificationHalfSentAt) {
      messages += sendTelegramMessageToTrusted_(
        buildAssemblyNotificationText_(item, 'half', deadline),
        properties
      );
      item.notificationHalfSentAt = nowIso;
      changed = true;
    }

    if (
      twoDaysBeforeDeadline &&
      now.getTime() >= twoDaysBeforeDeadline.getTime() &&
      !item.notificationTwoDaysSentAt
    ) {
      messages += sendTelegramMessageToTrusted_(
        buildAssemblyNotificationText_(item, 'twoDays', deadline),
        properties
      );
      item.notificationTwoDaysSentAt = nowIso;
      changed = true;
    }

    if (changed) {
      item.updatedAt = nowIso;
      item.lastChangedAt = nowIso;
      item.buildDeadline = item.buildDeadline || formatDateOnly_(deadline);
      item.totals = calculateTotals_(item);
      sheet.getRange(index + 2, 1, 1, HEADER.length).setValues([toRow_(item)]);
      updated += 1;
    }
  });

  return { checked, updated, messages };
}

function sendStatusNotificationIfNeeded_(item, previousStatus) {
  if (!previousStatus || previousStatus === item.status) return 0;

  const properties = PropertiesService.getScriptProperties();
  const botToken = properties.getProperty('BOT_TOKEN');
  const trustedUserIds = getTrustedTelegramUserIds_(properties);
  if (!botToken || !trustedUserIds.length) return 0;

  return sendTelegramMessageToTrusted_(
    buildStatusNotificationText_(item, previousStatus),
    properties
  );
}

function buildStatusNotificationText_(item, previousStatus) {
  const lines = [
    'Статус сборки изменен',
    `ПК: ${item.pcNumber || 'без номера'}`,
    `Договор: ${item.contractNumber || '-'}`,
    `Было: ${getStatusTitle_(previousStatus)}`,
    `Стало: ${getStatusTitle_(item.status)}`
  ];

  if (item.telegramId) lines.push(`Покупатель: ${item.telegramId}`);
  if (item.trackingNumber) lines.push(`Трек-номер: ${item.trackingNumber}`);
  if (item.buildDeadline) lines.push(`Дедлайн: ${item.buildDeadline}`);
  return lines.join('\n');
}

function getStatusTitle_(status) {
  return STATUS_TITLES[status] || status || '-';
}

function setupAssemblyNotificationTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'checkAssemblyNotifications') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('checkAssemblyNotifications').timeBased().everyDays(1).atHour(10).create();
  return 'Assembly notification trigger installed';
}

function buildAssemblyNotificationText_(item, type, deadline) {
  const title =
    type === 'half'
      ? 'Прошла половина срока сборки'
      : 'До дедлайна сборки осталось 2 дня';
  const lines = [
    title,
    `ПК: ${item.pcNumber || 'без номера'}`,
    `Договор: ${item.contractNumber || '-'}`,
    `Дедлайн: ${formatDateOnly_(deadline) || '-'}`,
    `Статус: ${item.status || '-'}`
  ];

  if (item.telegramId) lines.push(`Покупатель: ${item.telegramId}`);
  if (item.trackingNumber) lines.push(`Трек-номер: ${item.trackingNumber}`);
  return lines.join('\n');
}

function sendTelegramMessageToTrusted_(text, properties) {
  const botToken = properties.getProperty('BOT_TOKEN');
  const trustedUserIds = getTrustedTelegramUserIds_(properties);
  let sent = 0;

  trustedUserIds.forEach((chatId) => {
    UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        chat_id: chatId,
        text
      })
    });
    sent += 1;
  });

  return sent;
}

function assertTelegramAuth_(initData) {
  const properties = PropertiesService.getScriptProperties();
  const trustedUserIds = getTrustedTelegramUserIds_(properties);
  const requireAuth =
    properties.getProperty('REQUIRE_TELEGRAM_AUTH') === 'true' || trustedUserIds.length > 0;
  if (!requireAuth) return;

  const botToken = properties.getProperty('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN is not configured in Script Properties');
  const telegramData = verifyTelegramInitData_(initData, botToken);
  if (!telegramData) {
    throw new Error('Telegram authorization failed');
  }

  assertTrustedTelegramUser_(telegramData, trustedUserIds);
}

function verifyTelegramInitData_(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = parseQueryString_(initData);
  const receivedHash = params.hash;
  if (!receivedHash) return null;
  delete params.hash;

  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');

  const secretKey = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  const calculatedHash = bytesToHex_(
    Utilities.computeHmacSha256Signature(dataCheckString, secretKey)
  );

  return calculatedHash === receivedHash ? params : null;
}

function getTrustedTelegramUserIds_(properties) {
  const raw =
    properties.getProperty('TRUSTED_TELEGRAM_USER_IDS') ||
    properties.getProperty('ALLOWED_TELEGRAM_USER_IDS') ||
    '';

  return String(raw)
    .split(/[\s,;]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function assertTrustedTelegramUser_(telegramData, trustedUserIds) {
  if (!trustedUserIds.length) return;

  let user = {};
  try {
    user = JSON.parse(telegramData.user || '{}');
  } catch (error) {
    throw new Error('Telegram user data is invalid');
  }

  const userId = String(user.id || '');
  if (!userId || trustedUserIds.indexOf(userId) === -1) {
    throw new Error('Telegram user is not allowed');
  }
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
