import { formatRub, formatUsd } from '../../shared/calculations.js';

export default function SummaryCard({ title, rub, usd, tone }) {
  return (
    <div className={`summary-card ${tone || ''}`}>
      <span>{title}</span>
      <strong>{formatRub(rub)}</strong>
      <small>{formatUsd(usd)}</small>
    </div>
  );
}
