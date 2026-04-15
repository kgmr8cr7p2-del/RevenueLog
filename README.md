# Telegram Mini App для учета сборок ПК

Проект состоит из двух рабочих вариантов:

- GitHub Pages + Google Apps Script: основной вариант для Telegram Mini App без отдельного сервера.
- Express + Google Sheets/local JSON: локальная разработка и запасной серверный вариант.

## Что уже настроено

- Вкладки: `Сборки ПК`, `Расчеты`, `Настройки`.
- Колонки: `Сборка`, `Оплачен`, `Едет к покупателю`, `Покупатель получил`.
- Перетаскивание карточек между колонками.
- Форма ПК с комплектующими, ценами, аккаунтами, FSM, оплатой, доставкой, Telegram ID и заметкой.
- Расчет расходов и прибыли в рублях и долларах.
- Google Apps Script для таблицы:
  `https://docs.google.com/spreadsheets/d/1nTQV1MGkjdDLkrwq_FjFCYLj6olrtkpwFwB2ord0fjs/edit`

## Google Apps Script

1. Откройте Google Таблицу.
2. Нажмите `Расширения -> Apps Script`.
3. Удалите старый код в `Code.gs`.
4. Вставьте код из файла `google-apps-script/Code.gs`.
5. Откройте `Project Settings -> Script Properties`.
6. Добавьте свойства:

```text
BOT_TOKEN=токен_бота
REQUIRE_TELEGRAM_AUTH=false
```

На первом запуске оставьте `REQUIRE_TELEGRAM_AUTH=false`, чтобы проверить сайт в браузере. После настройки Telegram можно поменять на `true`.

7. Нажмите `Deploy -> New deployment`.
8. Тип: `Web app`.
9. `Execute as`: `Me`.
10. `Who has access`: `Anyone`.
11. Нажмите `Deploy` и скопируйте Web app URL, который заканчивается на `/exec`.

При первом запросе скрипт создаст лист `PC Builds` и заполнит заголовки.

## Подключение Apps Script к сайту

Откройте `public/config.js` и вставьте URL из Apps Script:

```js
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/ВАШ_ID/exec'
};
```

Секреты в этот файл не добавлять. Он попадет на GitHub Pages.

## GitHub Pages

В проект добавлен workflow `.github/workflows/pages.yml`.

1. Создайте новый публичный репозиторий на GitHub.
2. Загрузите туда файлы проекта.
3. В репозитории откройте `Settings -> Pages`.
4. В `Source` выберите `GitHub Actions`.
5. Сделайте push в ветку `main`.
6. После выполнения Actions сайт будет доступен по адресу:

```text
https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПОЗИТОРИЯ/
```

## Настройка кнопки Telegram

После появления HTTPS-ссылки GitHub Pages выполните в PowerShell:

```powershell
$env:BOT_TOKEN="ваш_токен_бота"
$env:WEB_APP_URL="https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПОЗИТОРИЯ/"
npm.cmd run telegram:menu
```

Скрипт настроит кнопку меню бота на открытие mini app.

Можно проще: запустите файл `setup-telegram-menu.bat`, вставьте токен бота и HTTPS-ссылку GitHub Pages. Батник настроит кнопку меню, а потом запустит локального Telegram-бота. Окно нужно держать открытым, пока бот должен отвечать на `/start`.

После проверки в Telegram вернитесь в Apps Script и поменяйте:

```text
REQUIRE_TELEGRAM_AUTH=true
```

Затем нажмите `Deploy -> Manage deployments -> Edit -> New version -> Deploy`.

## Локальный запуск

```bash
npm install
npm run dev
```

Фронтенд: `http://localhost:5173`.
Backend API: `http://localhost:3001`.

Если Google Sheets не настроен для Express-варианта, данные сохраняются в `server/data/builds.json`.

## Production build

```bash
npm install
npm run build
```

## Расчеты

Цены комплектующих вводятся в рублях.

Стоимость аккаунтов:

- автоматическая прокачка: `15.1 $`
- ручная прокачка: `15.5 $`

Если оплата или доставка указаны в долларах, используется введенный курс.

```text
прибыль = сколько заплатил покупатель - все расходы
```
