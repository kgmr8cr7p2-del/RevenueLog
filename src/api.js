import { getTelegramInitData } from './telegram.js';

function getAppsScriptUrl() {
  const runtimeConfig = window.APP_CONFIG || {};
  const url = runtimeConfig.APPS_SCRIPT_URL || import.meta.env.VITE_APPS_SCRIPT_URL || '';
  return String(url).trim();
}

function shouldUseAppsScript() {
  return getAppsScriptUrl().startsWith('https://script.google.com/');
}

function compactBuildPayload(build) {
  if (!build) return build;
  const {
    totals,
    createdAt,
    updatedAt,
    lastChangedAt,
    ...rest
  } = build;

  return {
    ...rest,
    components: (build.components || []).map((component) => ({
      key: component.key,
      value: component.value || '',
      priceRub: component.priceRub ?? ''
    }))
  };
}

function appsScriptRequest(action, payload = null) {
  const callbackName = `__pcBuilds${Date.now()}${Math.random().toString(36).slice(2)}`;
  const url = new URL(getAppsScriptUrl());
  url.searchParams.set('action', action);
  url.searchParams.set('callback', callbackName);

  const initData = getTelegramInitData();
  if (initData) url.searchParams.set('initData', initData);
  if (payload !== null) url.searchParams.set('payload', JSON.stringify(payload));

  if (url.toString().length > 7000) {
    return Promise.reject(
      new Error('Слишком много текста для сохранения через Apps Script. Сократите заметку или названия комплектующих.')
    );
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Apps Script не ответил'));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      if (!data?.ok) {
        reject(new Error(data?.error || 'Ошибка Apps Script'));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Не удалось подключиться к Apps Script'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getTelegramInitData(),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function roundRate(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 8000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchBybitP2PRate() {
  const data = await fetchJson('https://api2.bybit.com/fiat/otc/item/online', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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
    }),
    timeoutMs: 6000
  });

  if (data.ret_code !== 0 && data.retCode !== 0) {
    throw new Error(data.ret_msg || data.retMsg || 'Bybit returned an error');
  }

  const prices = (data.result?.items || [])
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .slice(0, 5);
  if (!prices.length) throw new Error('Bybit rate is empty');

  const value = roundRate(prices.reduce((sum, price) => sum + price, 0) / prices.length);
  return {
    value,
    source: 'Bybit P2P USDT/RUB',
    side: 'sell',
    fetchedAt: new Date().toISOString(),
    prices: prices.map(roundRate),
    values: prices.map((price, index) => ({
      label: `Bybit продажа #${index + 1}`,
      value: roundRate(price)
    }))
  };
}

async function fetchOpenMarketRate() {
  const results = await Promise.allSettled([
    fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub', {
      timeoutMs: 6000
    }).then((data) => ({
      label: 'CoinGecko USDT/RUB',
      value: Number(data.tether?.rub)
    })),
    fetchJson('https://www.cbr-xml-daily.ru/daily_json.js', {
      timeoutMs: 6000
    }).then((data) => ({
      label: 'ЦБ USD/RUB',
      value: Number(data.Valute?.USD?.Value)
    }))
  ]);

  const values = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .map((item) => ({ ...item, value: roundRate(item.value) }));

  if (!values.length) {
    throw new Error('Не удалось получить курс из браузера');
  }

  const value = roundRate(values.reduce((sum, item) => sum + item.value, 0) / values.length);
  return {
    value,
    source: 'Среднее из браузерных источников',
    side: 'sell',
    fetchedAt: new Date().toISOString(),
    prices: values.map((item) => item.value),
    values
  };
}

async function fetchBrowserExchangeRate() {
  try {
    return await fetchBybitP2PRate();
  } catch (error) {
    const fallbackRate = await fetchOpenMarketRate();
    return {
      ...fallbackRate,
      fallbackReason: 'Bybit P2P не отдал данные напрямую в браузер'
    };
  }
}

export async function fetchBuilds() {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('list');
    return {
      items: data.items || [],
      summary: data.summary || {},
      storage: data.storage || 'google-sheets',
      schemaVersion: data.schemaVersion || 0
    };
  }

  return request('/api/builds');
}

export async function fetchExchangeRate() {
  return fetchBrowserExchangeRate();
}

export async function createBuild(payload) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('create', compactBuildPayload(payload));
    return data.item;
  }

  return request('/api/builds', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateBuild(id, payload) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('update', { id, build: compactBuildPayload(payload) });
    return data.item;
  }

  return request(`/api/builds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function updateBuildStatus(id, status) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('status', { id, status });
    return data.item;
  }

  return request(`/api/builds/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function updateBuildArchive(id, archived) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('archive', { id, archived });
    return data.item;
  }

  return request(`/api/builds/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived })
  });
}

export async function deleteBuild(id) {
  if (shouldUseAppsScript()) {
    await appsScriptRequest('delete', { id });
    return null;
  }

  return request(`/api/builds/${id}`, {
    method: 'DELETE'
  });
}
