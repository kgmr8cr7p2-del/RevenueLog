export default function SettingsTab({ storage, user }) {
  const userName = user
    ? `${user.first_name || ''} ${user.username ? `@${user.username}` : ''}`.trim()
    : 'не открыт в Telegram';

  return (
    <section className="settings-section">
      <div className="section-heading">
        <div>
          <h1>Настройки</h1>
          <p>Состояние mini app и хранилища.</p>
        </div>
      </div>
      <div className="settings-list">
        <div>
          <span>Хранилище</span>
          <strong>{storage === 'google-sheets' ? 'Google Таблицы' : 'Локальный JSON'}</strong>
        </div>
        <div>
          <span>Telegram пользователь</span>
          <strong>{userName}</strong>
        </div>
        <div>
          <span>Публичный доступ</span>
          <strong>Нужен HTTPS URL в BotFather</strong>
        </div>
      </div>
    </section>
  );
}
