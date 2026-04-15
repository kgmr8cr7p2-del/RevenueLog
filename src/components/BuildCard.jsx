import { formatRub, isBuildOverdue, toNumber } from '../../shared/calculations.js';
import { getTelegramLink } from '../telegram.js';

export default function BuildCard({ build, onEdit, onCopy, onArchive, onDragStart }) {
  const telegramLink = getTelegramLink(build.telegramId);
  const overdue = isBuildOverdue(build);

  return (
    <article
      className="build-card"
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => onDragStart?.(event, build.id)}
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
      {build.buildDeadline ? (
        <span className={overdue ? 'deadline-bad' : 'deadline'}>
          Дедлайн: {build.buildDeadline}
        </span>
      ) : null}
      {build.assemblyTermDays ? (
        <span className="deadline">Срок на все: {build.assemblyTermDays} дн.</span>
      ) : null}
      {build.trackingNumber ? (
        <span className="deadline">Трек-номер: {build.trackingNumber}</span>
      ) : null}
      {build.lastChangedAt || build.updatedAt ? (
        <span className="deadline">
          Изменено: {new Date(build.lastChangedAt || build.updatedAt).toLocaleString('ru-RU')}
        </span>
      ) : null}
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
      <div className="build-card__actions">
        {onCopy ? (
          <button
            type="button"
            className="copy-button"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(build);
            }}
          >
            Копировать
          </button>
        ) : null}
        {onArchive ? (
          <button
            type="button"
            className="copy-button"
            onClick={(event) => {
              event.stopPropagation();
              onArchive(build, !build.archived);
            }}
          >
            {build.archived ? 'Вернуть' : 'В архив'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
