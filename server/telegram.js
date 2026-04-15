import crypto from 'node:crypto';

export function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const received = Buffer.from(receivedHash, 'hex');
  const calculated = Buffer.from(calculatedHash, 'hex');
  if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) {
    return null;
  }

  const user = params.get('user');
  return user ? JSON.parse(user) : {};
}

export function telegramAuthMiddleware({ botToken, required }) {
  return (req, res, next) => {
    const initData = req.header('x-telegram-init-data');
    const telegramUser = verifyTelegramInitData(initData, botToken);

    if (required && !telegramUser) {
      res.status(401).json({ error: 'Telegram authorization is required' });
      return;
    }

    req.telegramUser = telegramUser;
    next();
  };
}
