import { getTelegramInitData } from './telegram.js';

function getAppsScriptUrl() {
  const runtimeConfig = window.APP_CONFIG || {};
  const url = runtimeConfig.APPS_SCRIPT_URL || import.meta.env.VITE_APPS_SCRIPT_URL || '';
  return String(url).trim();
}

function shouldUseAppsScript() {
  return getAppsScriptUrl().startsWith('https://script.google.com/');
}

function appsScriptRequest(action, payload = null) {
  const callbackName = `__pcBuilds${Date.now()}${Math.random().toString(36).slice(2)}`;
  const url = new URL(getAppsScriptUrl());
  url.searchParams.set('action', action);
  url.searchParams.set('callback', callbackName);

  const initData = getTelegramInitData();
  if (initData) url.searchParams.set('initData', initData);
  if (payload !== null) url.searchParams.set('payload', JSON.stringify(payload));

  if (url.toString().length > 60000) {
    return Promise.reject(new Error('Слишком много текста для сохранения через Apps Script'));
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

export async function fetchBuilds() {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('list');
    return {
      items: data.items || [],
      summary: data.summary || {},
      storage: data.storage || 'google-sheets'
    };
  }

  return request('/api/builds');
}

export async function createBuild(payload) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('create', payload);
    return data.item;
  }

  return request('/api/builds', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateBuild(id, payload) {
  if (shouldUseAppsScript()) {
    const data = await appsScriptRequest('update', { id, build: payload });
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

export async function deleteBuild(id) {
  if (shouldUseAppsScript()) {
    await appsScriptRequest('delete', { id });
    return null;
  }

  return request(`/api/builds/${id}`, {
    method: 'DELETE'
  });
}
