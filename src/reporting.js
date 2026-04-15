import {
  getBuildReportDate,
  getStatusTitle,
  isCurrentMonth,
  toNumber
} from '../shared/calculations.js';

const REPORT_COLUMNS = [
  ['pcNumber', 'Номер ПК'],
  ['contractNumber', 'Номер договора'],
  ['status', 'Статус'],
  ['telegramId', 'Telegram ID'],
  ['paymentDate', 'Дата оплаты'],
  ['shippingDate', 'Дата отправки'],
  ['receivedDate', 'Дата получения'],
  ['buildDeadline', 'Дедлайн сборки'],
  ['paidRub', 'Оплата, руб'],
  ['expensesRub', 'Расходы, руб'],
  ['profitRub', 'Прибыль, руб'],
  ['paidUsd', 'Оплата, $'],
  ['expensesUsd', 'Расходы, $'],
  ['profitUsd', 'Прибыль, $'],
  ['components', 'Комплектующие'],
  ['note', 'Заметка']
];

function getComponentSummary(build) {
  return (build.components || [])
    .filter((component) => component.value || toNumber(component.priceRub) > 0)
    .map((component) => `${component.label}: ${component.value || '-'} (${component.priceRub || 0} руб.)`)
    .join('\n');
}

function getReportRows(builds) {
  return builds.map((build) => ({
    pcNumber: build.pcNumber || '',
    contractNumber: build.contractNumber || '',
    status: getStatusTitle(build.status),
    telegramId: build.telegramId || '',
    paymentDate: build.paymentDate || '',
    shippingDate: build.shippingDate || '',
    receivedDate: build.receivedDate || '',
    buildDeadline: build.buildDeadline || '',
    paidRub: build.totals?.paidRub || 0,
    expensesRub: build.totals?.expensesRub || 0,
    profitRub: build.totals?.profitRub || 0,
    paidUsd: build.totals?.paidUsd || 0,
    expensesUsd: build.totals?.expensesUsd || 0,
    profitUsd: build.totals?.profitUsd || 0,
    components: getComponentSummary(build),
    note: build.note || ''
  }));
}

function escapeCsvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getScopedBuilds(builds, scope) {
  if (scope === 'month') {
    return builds.filter((build) => isCurrentMonth(getBuildReportDate(build)));
  }

  if (scope === 'completed') {
    return builds.filter((build) => build.status === 'received');
  }

  return builds;
}

function getScopeName(scope) {
  if (scope === 'month') return 'month';
  if (scope === 'completed') return 'completed';
  return 'all';
}

export function exportBuildsCsv(builds, scope = 'all') {
  const scopedBuilds = getScopedBuilds(builds, scope);
  const rows = getReportRows(scopedBuilds);
  const header = REPORT_COLUMNS.map(([, label]) => escapeCsvCell(label)).join(';');
  const body = rows
    .map((row) => REPORT_COLUMNS.map(([key]) => escapeCsvCell(row[key])).join(';'))
    .join('\n');
  const filename = `pc-builds-${getScopeName(scope)}.csv`;
  downloadBlob(`\ufeff${header}\n${body}`, filename, 'text/csv;charset=utf-8');
}

export function exportBuildsExcel(builds, scope = 'all') {
  const scopedBuilds = getScopedBuilds(builds, scope);
  const rows = getReportRows(scopedBuilds);
  const header = REPORT_COLUMNS.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = rows
    .map((row) => {
      return `<tr>${REPORT_COLUMNS.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const filename = `pc-builds-${getScopeName(scope)}.xls`;
  downloadBlob(html, filename, 'application/vnd.ms-excel;charset=utf-8');
}
