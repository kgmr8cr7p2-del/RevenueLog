import { formatRub, toNumber } from '../../shared/calculations.js';
import { getTelegramLink } from '../telegram.js';

export default function BuildCard({ build, onEdit, onDragStart }) {
  const telegramLink = getTelegramLink(build.telegramId);

  return (
    <article
      className="build-card"
      draggable
      onDragStart={(event) => onDragStart(event, build.id)}
      onClick={() => onEdit(build)}
    >
      <div className="build-card__header">
        <strong>ПК {build.pcNumber || 'без номера'}</strong>
        <span>{build.contractNumber || 'договор не указан'}</span>
      </div>
      <div className="build-card__meta">
        <span>Расходы: {formatRub(build.totals?.expensesRub)}</span>
        <span className={toNumber(build.totals?.profitRub) >= 0 ? 'profit' : 'loss'}>
          Прибыль: {formatRub(build.totals?.profitRub)}
        </span>
      </div>
      {telegramLink ? (
        <a
          className="telegram-link"
          href={telegramLink}
          onClick={(event) => event.stopPropagation()}
        >
          Telegram
        </a>
      ) : null}
      {build.note ? <p>{build.note}</p> : null}
    </article>
  );
}
