const botToken = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;
const buttonText = process.env.WEB_APP_BUTTON_TEXT || 'Сборки ПК';

if (!botToken) {
  throw new Error('Set BOT_TOKEN environment variable');
}

if (!webAppUrl || !webAppUrl.startsWith('https://')) {
  throw new Error('Set WEB_APP_URL environment variable to an HTTPS URL');
}

async function telegram(method, payload) {
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

await telegram('setChatMenuButton', {
  menu_button: {
    type: 'web_app',
    text: buttonText,
    web_app: {
      url: webAppUrl
    }
  }
});

await telegram('setMyCommands', {
  commands: [
    {
      command: 'start',
      description: 'Открыть учет сборок ПК'
    }
  ]
});

console.log(`Telegram menu button is set to ${webAppUrl}`);
