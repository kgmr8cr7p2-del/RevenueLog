const botToken = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;
const buttonText = process.env.WEB_APP_BUTTON_TEXT || 'Открыть сборки ПК';
const trustedUserIds = parseTrustedUserIds(process.env.TRUSTED_TELEGRAM_USER_IDS);

if (!botToken) {
  throw new Error('Set BOT_TOKEN environment variable');
}

if (!webAppUrl || !webAppUrl.startsWith('https://')) {
  throw new Error('Set WEB_APP_URL environment variable to an HTTPS URL');
}

let isRunning = true;
let offset = 0;

process.on('SIGINT', () => {
  isRunning = false;
  console.log('\nStopping bot...');
});

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }

  return data.result;
}

async function sendStartMessage(chatId) {
  await telegram('sendMessage', {
    chat_id: chatId,
    text: 'Открой учет сборок ПК.',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: {
              url: webAppUrl
            }
          }
        ]
      ]
    }
  });
}

async function sendAccessDenied(chatId, userId) {
  await telegram('sendMessage', {
    chat_id: chatId,
    text: `Доступ закрыт. Ваш Telegram ID: ${userId || 'неизвестен'}`
  });
}

function parseTrustedUserIds(value) {
  return new Set(
    String(value || '')
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function isTrustedUser(userId) {
  return trustedUserIds.size === 0 || trustedUserIds.has(String(userId));
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message?.chat?.id) return;
  if (!isTrustedUser(message.from?.id)) {
    await sendAccessDenied(message.chat.id, message.from?.id);
    return;
  }

  const text = String(message.text || '').trim();
  if (text === '/start' || text.startsWith('/start ')) {
    await sendStartMessage(message.chat.id);
    return;
  }

  await sendStartMessage(message.chat.id);
}

console.log('Bot is running.');
console.log('Send /start to the bot in Telegram.');
console.log('Keep this window open while you want the local bot to answer messages.');
if (trustedUserIds.size > 0) {
  console.log(`Trusted Telegram users: ${Array.from(trustedUserIds).join(', ')}`);
}

while (isRunning) {
  try {
    const updates = await telegram('getUpdates', {
      offset,
      timeout: 45,
      allowed_updates: ['message']
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      await handleUpdate(update);
    }
  } catch (error) {
    console.error(error.message);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
