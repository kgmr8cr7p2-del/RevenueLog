# Telegram Mini App для учета сборок ПК

Проект состоит из двух рабочих вариантов:

- GitHub Pages + Google Apps Script: основной вариант для Telegram Mini App без отдельного сервера.
- Express + Google Sheets/local JSON: локальная разработка и запасной серверный вариант.

## Что уже настроено

- Вкладки: `Сборки ПК`, `Расчеты`, `Архив`, `Настройки`.
- Колонки: `Сборка`, `Оплачен`, `Едет к покупателю`, `Покупатель получил`.
- Перетаскивание карточек между колонками.
- Форма ПК с комплектующими, ценами, аккаунтами, FSM, оплатой, доставкой, Telegram ID и заметкой.
- Расчет расходов и прибыли в рублях и долларах.
- Фильтры по номеру ПК, договору, Telegram ID и статусу.
- Экспорт CSV/XLS: все сборки, текущий месяц, завершенные сборки.
- Дашборд: статусы, прибыль за месяц, средняя прибыль и зависшие заказы.
- Даты: вручную вводятся дата оплаты и срок на все, дедлайн считается автоматически; отправка и получение проставляются по статусам.
- Копирование сборки в новую карточку.
- Автонумерация ПК при создании новой карточки.
- Трек-номер доставки.
- Архив сборок, чтобы скрывать старые карточки с основной доски.
- Telegram-уведомления доверенным пользователям: когда прошла половина срока и за 2 дня до дедлайна.
- Telegram-уведомления доверенным пользователям при смене статуса сборки.
- Ручная кнопка `Напомнить о сроках`: отправляет доверенным пользователям сообщение по каждому ПК в статусе `Сборка`.
- Файл договора PDF/DOC/DOCX можно прикрепить к ПК; файл сохраняется на Google Drive, ссылка сохраняется в таблице.
- Автоматическая колонка `Просрочено` на главной доске для заказов с прошедшим дедлайном.
- Вкладка `Мини-аналитика` с оборотом, прибылью, активными и просроченными заказами.
- Автоматическая подстановка ориентира USDT/RUB из браузера без Bybit API: среднее по CoinGecko USDT/RUB и ЦБ USD/RUB. Ручной курс остается доступным.
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
TRUSTED_TELEGRAM_USER_IDS=123456789,987654321
```

Зависший заказ считается так: у сборки указан `buildDeadline`, этот дедлайн уже прошел, а статус еще не `Покупатель получил`.

`TRUSTED_TELEGRAM_USER_IDS` — это список Telegram user ID, которым разрешен доступ. Можно указать один ID или несколько через запятую, пробел или с новой строки.

На первом запуске можно оставить `REQUIRE_TELEGRAM_AUTH=false`, чтобы проверить сайт в браузере. Если заполнен `TRUSTED_TELEGRAM_USER_IDS`, Apps Script все равно потребует Telegram-авторизацию и пустит только указанные ID.

7. Нажмите `Deploy -> New deployment`.
8. Тип: `Web app`.
9. `Execute as`: `Me`.
10. `Who has access`: `Anyone`.
11. Нажмите `Deploy` и скопируйте Web app URL, который заканчивается на `/exec`.

При первом запросе скрипт создаст лист `PC Builds` и заполнит заголовки.

Для уведомлений после вставки нового `Code.gs` один раз запустите в Apps Script функцию:

```text
setupAssemblyNotificationTrigger
```

Она поставит ежедневную проверку на 10:00. Проверка отправляет сообщения всем ID из `TRUSTED_TELEGRAM_USER_IDS`. Для теста можно вручную запустить функцию `checkAssemblyNotifications`.

Если архив, уведомления, напоминания или файлы договоров не работают, значит сайт уже обновлен, а Web App в Apps Script все еще работает на старой версии. После вставки нового `Code.gs` обязательно сделайте `Deploy -> Manage deployments -> Edit -> New version -> Deploy`.

Для загрузки файлов договора Apps Script запросит доступ к Google Drive. Файлы складываются в папку `RevenueLog Contracts`. Если нужно использовать свою папку, добавьте в `Script Properties`:

```text
CONTRACT_FILES_FOLDER_ID=id_папки_на_google_drive
```

Автокурс теперь работает на стороне браузера и не требует разрешения Apps Script на запросы к Bybit.

Лист должен называться `PC Builds`. Столбцы создаются автоматически. Если создаете вручную, порядок такой:

```text
id
status
pcNumber
contractNumber
componentsTotalRub
accountsManual
accountsAuto
accountsCostUsd
fsmSubscriptionUsd
paidAmount
paidCurrency
exchangeRate
deliveryAmount
deliveryCurrency
expensesRub
expensesUsd
profitRub
profitUsd
telegramId
note
createdAt
updatedAt
json
paymentDate
shippingDate
receivedDate
buildDeadline
lastChangedAt
trackingNumber
assemblyTermDays
assemblyStartDate
archived
notificationHalfSentAt
notificationTwoDaysSentAt
contractFileName
contractFileUrl
contractFileId
```

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

Батник также спросит `Trusted user IDs`. Укажите Telegram user ID людей, которым бот должен отвечать. Пример:

```text
123456789,987654321
```

После первого запуска батник сохранит эти значения в локальный файл `telegram-menu.config.local.bat`. Этот файл добавлен в `.gitignore` и не должен попадать на GitHub. При следующем запуске батник спросит, использовать ли сохраненные настройки.

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
