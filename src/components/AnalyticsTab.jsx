import {
  formatRub,
  formatUsd,
  getBuildReportDate,
  isBuildOverdue,
  isCurrentMonth,
  toDate,
  toNumber
} from '../../shared/calculations.js';
import SummaryCard from './SummaryCard.jsx';

function calculateSummary(builds) {
  return builds.reduce(
    (acc, build) => {
      acc.paidRub += toNumber(build.totals?.paidRub);
      acc.expensesRub += toNumber(build.totals?.expensesRub);
      acc.profitRub += toNumber(build.totals?.profitRub);
      acc.profitUsd += toNumber(build.totals?.profitUsd);
      return acc;
    },
    { paidRub: 0, expensesRub: 0, profitRub: 0, profitUsd: 0 }
  );
}

function getDaysBetween(startValue, endValue) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function getAverageBuildDays(builds) {
  const completedWithDates = builds
    .filter((build) => build.status === 'received')
    .map((build) =>
      getDaysBetween(build.paymentDate || build.assemblyStartDate || build.createdAt, build.receivedDate)
    )
    .filter((days) => days > 0);

  if (!completedWithDates.length) return 0;
  return Math.round(
    completedWithDates.reduce((sum, days) => sum + days, 0) / completedWithDates.length
  );
}

export default function AnalyticsTab({ builds }) {
  const monthBuilds = builds.filter((build) => isCurrentMonth(getBuildReportDate(build)));
  const summary = calculateSummary(builds);
  const monthSummary = calculateSummary(monthBuilds);
  const completedBuilds = builds.filter((build) => build.status === 'received');
  const activeBuilds = builds.filter((build) => build.status !== 'received');
  const overdueBuilds = builds.filter((build) => isBuildOverdue(build));
  const averageProfitRub = completedBuilds.length
    ? completedBuilds.reduce((sum, build) => sum + toNumber(build.totals?.profitRub), 0) /
      completedBuilds.length
    : 0;
  const averageBuildDays = getAverageBuildDays(builds);
  const bestBuild = [...builds].sort(
    (left, right) => toNumber(right.totals?.profitRub) - toNumber(left.totals?.profitRub)
  )[0];

  return (
    <section className="analytics-section">
      <div className="section-heading">
        <div>
          <h1>Мини-аналитика</h1>
          <p>Короткая сводка по активным и завершенным сборкам.</p>
        </div>
      </div>

      <div className="summary-grid">
        <SummaryCard title="Прибыль всего" rub={summary.profitRub} usd={summary.profitUsd} />
        <SummaryCard title="Прибыль за месяц" rub={monthSummary.profitRub} usd={monthSummary.profitUsd} />
        <SummaryCard title="Средняя прибыль завершенных" rub={averageProfitRub} usd={0} />
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span>Активных заказов</span>
          <strong>{activeBuilds.length}</strong>
          <small>В работе, оплачены или едут</small>
        </div>
        <div className="summary-card">
          <span>Просрочено</span>
          <strong>{overdueBuilds.length}</strong>
          <small>Дедлайн прошел, заказ не получен</small>
        </div>
        <div className="summary-card">
          <span>Средний срок до получения</span>
          <strong>{averageBuildDays ? `${averageBuildDays} дн.` : '-'}</strong>
          <small>По завершенным сборкам с датами</small>
        </div>
      </div>

      <div className="finance-table">
        <div className="finance-row finance-row--head finance-row--wide">
          <span>Показатель</span>
          <span>Значение</span>
          <span>ПК</span>
          <span>Договор</span>
          <span>Деталь</span>
        </div>
        <div className="finance-row finance-row--wide">
          <span>Лучший заказ</span>
          <span>{bestBuild ? formatRub(bestBuild.totals?.profitRub) : '-'}</span>
          <span>{bestBuild?.pcNumber || '-'}</span>
          <span>{bestBuild?.contractNumber || '-'}</span>
          <span>{bestBuild ? formatUsd(bestBuild.totals?.profitUsd) : '-'}</span>
        </div>
        <div className="finance-row finance-row--wide">
          <span>Оборот всего</span>
          <span>{formatRub(summary.paidRub)}</span>
          <span>-</span>
          <span>-</span>
          <span>Расходы: {formatRub(summary.expensesRub)}</span>
        </div>
        <div className="finance-row finance-row--wide">
          <span>Заказов за месяц</span>
          <span>{monthBuilds.length}</span>
          <span>-</span>
          <span>-</span>
          <span>Завершено всего: {completedBuilds.length}</span>
        </div>
      </div>
    </section>
  );
}
