import { createGoogleSheetsStore } from './googleSheetsStore.js';
import { createLocalStore } from './localStore.js';

export async function createStore() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'PC Builds';
  const hasGoogleCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);

  if (spreadsheetId && hasGoogleCredentials) {
    return createGoogleSheetsStore({ spreadsheetId, sheetName });
  }

  return createLocalStore();
}
