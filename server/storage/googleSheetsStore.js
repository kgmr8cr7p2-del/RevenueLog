import { google } from 'googleapis';

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

function quoteSheetName(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}

function privateKeyFromEnv(value) {
  return value ? value.replace(/\\n/g, '\n') : '';
}

function toRow(item) {
  return [
    item.id,
    item.status,
    item.pcNumber,
    item.contractNumber,
    item.totals?.componentsTotalRub,
    item.accounts?.manual,
    item.accounts?.auto,
    item.totals?.accountsCostUsd,
    item.fsmSubscriptionUsd,
    item.paid?.amount,
    item.paid?.currency,
    item.paid?.exchangeRate,
    item.delivery?.amount,
    item.delivery?.currency,
    item.totals?.expensesRub,
    item.totals?.expensesUsd,
    item.totals?.profitRub,
    item.totals?.profitUsd,
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
    item.trackingNumber,
    item.assemblyTermDays,
    item.assemblyStartDate,
    item.archived,
    item.notificationHalfSentAt,
    item.notificationTwoDaysSentAt
  ];
}

function fromRow(row) {
  const json = row[HEADER.indexOf('json')];
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function createAuth() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes
    });
  }

  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKeyFromEnv(process.env.GOOGLE_PRIVATE_KEY),
    scopes
  });
}

export async function createGoogleSheetsStore({ spreadsheetId, sheetName }) {
  const auth = await createAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const escapedSheetName = quoteSheetName(sheetName);

  async function ensureSheet() {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!existingSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
      });
    }

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapedSheetName}!A1:AH1`
    });

    const currentHeader = headerResponse.data.values?.[0] || [];
    if (HEADER.some((value, index) => currentHeader[index] !== value)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${escapedSheetName}!A1:AH1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER] }
      });
    }
  }

  async function getRows() {
    await ensureSheet();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapedSheetName}!A2:AH`
    });

    return response.data.values || [];
  }

  async function findSheetId() {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (candidate) => candidate.properties?.title === sheetName
    );
    return sheet?.properties?.sheetId;
  }

  return {
    type: 'google-sheets',

    async list() {
      const rows = await getRows();
      return rows.map(fromRow).filter(Boolean);
    },

    async create(item) {
      await ensureSheet();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${escapedSheetName}!A:AH`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [toRow(item)] }
      });
      return item;
    },

    async update(id, item) {
      const rows = await getRows();
      const index = rows.findIndex((row) => row[0] === id);
      if (index === -1) return null;

      const rowNumber = index + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${escapedSheetName}!A${rowNumber}:AH${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [toRow(item)] }
      });
      return item;
    },

    async delete(id) {
      const rows = await getRows();
      const index = rows.findIndex((row) => row[0] === id);
      if (index === -1) return false;

      const sheetId = await findSheetId();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: index + 1,
                  endIndex: index + 2
                }
              }
            }
          ]
        }
      });

      return true;
    }
  };
}
