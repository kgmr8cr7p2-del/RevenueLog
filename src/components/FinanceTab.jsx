import { formatRub, toNumber } from '../../shared/calculations.js';
import SummaryCard from './SummaryCard.jsx';

export default function FinanceTab({ builds }) {
  const summary = builds.reduce(
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

  return (
    <section className="finance-section">
      <div className="section-heading">
        <div>
          <h1>Расчеты</h1>
          <p>Сводка по всем сохраненным сборкам.</p>
        </div>
      </div>
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
        <div className="finance-row finance-row--head">
          <span>ПК</span>
          <span>Договор</span>
          <span>Расходы</span>
          <span>Прибыль</span>
        </div>
        {builds.map((build) => (
          <div className="finance-row" key={build.id}>
            <span>{build.pcNumber || '-'}</span>
            <span>{build.contractNumber || '-'}</span>
            <span>{formatRub(build.totals?.expensesRub)}</span>
            <span className={toNumber(build.totals?.profitRub) >= 0 ? 'profit' : 'loss'}>
              {formatRub(build.totals?.profitRub)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
