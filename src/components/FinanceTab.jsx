import {
  formatRub,
  formatUsd,
  getBuildReportDate,
  isBuildOverdue,
  isCurrentMonth,
  toNumber
} from '../../shared/calculations.js';
import { exportBuildsCsv, exportBuildsExcel } from '../reporting.js';
import SummaryCard from './SummaryCard.jsx';

function CountCard({ title, value, detail }) {
  return (
    <div className="summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function calculateSummary(builds) {
  return builds.reduce(
    (acc, build) => {
      acc.paidRub += toNumber(build.totals?.paidRub);
      acc.paidUsd += toNumber(build.totals?.paidUsd);
      acc.expensesRub += toNumber(build.totals?.expensesRub);
      acc.expensesUsd += toNumber(build.totals?.expensesUsd);
      acc.profitRub += toNumber(build.totals?.profitRub);
      acc.profitUsd += toNumber(build.totals?.profitUsd);
      return acc;
    },
    { paidRub: 0, paidUsd: 0, expensesRub: 0, expensesUsd: 0, profitRub: 0, profitUsd: 0 }
  );
}

export default function FinanceTab({ builds }) {
  const summary = calculateSummary(builds);
  const monthBuilds = builds.filter((build) => isCurrentMonth(getBuildReportDate(build)));
  const completedBuilds = builds.filter((build) => build.status === 'received');
  const overdueBuilds = builds.filter((build) => isBuildOverdue(build));
  const monthSummary = calculateSummary(monthBuilds);
  const averageProfitRub = builds.length > 0 ? summary.profitRub / builds.length : 0;
  const averageProfitUsd = builds.length > 0 ? summary.profitUsd / builds.length : 0;
  const overdueAmountRub = overdueBuilds.reduce(
    (sum, build) => sum + toNumber(build.totals?.paidRub),
    0
  );
  const overdueAmountUsd = overdueBuilds.reduce(
    (sum, build) => sum + toNumber(build.totals?.paidUsd),
    0
  );

  return (
    <section className="finance-section">
      <div className="section-heading">
        <div>
          <h1>Расчеты</h1>
          <p>Сводка по всем сохраненным сборкам.</p>
        </div>
      </div>

      <div className="summary-grid">
        <CountCard title="Сейчас в сборке" value={builds.filter((build) => build.status === 'assembly').length} />
        <CountCard title="Едет к покупателю" value={builds.filter((build) => build.status === 'shipping').length} />
        <CountCard title="Покупатель получил" value={completedBuilds.length} />
        <SummaryCard title="Прибыль за месяц" rub={monthSummary.profitRub} usd={monthSummary.profitUsd} />
        <SummaryCard title="Средняя прибыль с ПК" rub={averageProfitRub} usd={averageProfitUsd} />
        <SummaryCard
          title="Сумма зависших заказов"
          rub={overdueAmountRub}
          usd={overdueAmountUsd}
          tone={overdueAmountRub > 0 ? 'bad' : ''}
        />
      </div>

      <section className="export-panel">
        <div>
          <h2>Экспорт отчета</h2>
          <p>CSV открывается в Google Таблицах, Excel скачивается как XLS.</p>
        </div>
        <div className="export-actions">
          <button className="ghost-button" onClick={() => exportBuildsCsv(builds, 'all')}>
            CSV все
          </button>
          <button className="ghost-button" onClick={() => exportBuildsExcel(builds, 'all')}>
            Excel все
          </button>
          <button className="ghost-button" onClick={() => exportBuildsCsv(builds, 'month')}>
            CSV за месяц
          </button>
          <button className="ghost-button" onClick={() => exportBuildsExcel(builds, 'month')}>
            Excel за месяц
          </button>
          <button className="ghost-button" onClick={() => exportBuildsCsv(builds, 'completed')}>
            CSV завершенные
          </button>
          <button className="ghost-button" onClick={() => exportBuildsExcel(builds, 'completed')}>
            Excel завершенные
          </button>
        </div>
      </section>

      <div className="summary-grid">
        <SummaryCard title="Получено" rub={summary.paidRub} usd={summary.paidUsd} />
        <SummaryCard title="Потрачено" rub={summary.expensesRub} usd={summary.expensesUsd} />
        <SummaryCard
          title="Заработано"
          rub={summary.profitRub}
          usd={summary.profitUsd}
          tone={summary.profitRub >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="finance-table">
        <div className="finance-row finance-row--head finance-row--wide">
          <span>ПК</span>
          <span>Договор</span>
          <span>Дедлайн</span>
          <span>Расходы</span>
          <span>Прибыль</span>
        </div>
        {builds.map((build) => (
          <div className="finance-row finance-row--wide" key={build.id}>
            <span>{build.pcNumber || '-'}</span>
            <span>{build.contractNumber || '-'}</span>
            <span className={isBuildOverdue(build) ? 'loss' : ''}>{build.buildDeadline || '-'}</span>
            <span>{formatRub(build.totals?.expensesRub)}</span>
            <span className={toNumber(build.totals?.profitRub) >= 0 ? 'profit' : 'loss'}>
              {formatRub(build.totals?.profitRub)} / {formatUsd(build.totals?.profitUsd)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
