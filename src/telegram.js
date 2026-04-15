export function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

export function initializeTelegram() {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  return webApp;
}

export function getTelegramInitData() {
  return getTelegramWebApp()?.initData || '';
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user || null;
}

export function getTelegramLink(value) {
  const id = String(value || '').trim();
  if (!id) return '';
  if (id.startsWith('@')) return `https://t.me/${id.slice(1)}`;
  if (/^[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(id)) return `https://t.me/${id}`;
  if (/^\d+$/.test(id)) return `tg://user?id=${id}`;
  return '';
}
