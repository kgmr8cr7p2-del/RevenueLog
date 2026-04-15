import { useMemo, useState } from 'react';
import { STATUSES, isBuildOverdue } from '../../shared/calculations.js';
import BuildCard from './BuildCard.jsx';

const BOARD_COLUMNS = [
  ...STATUSES,
  { id: 'overdue', title: 'Просрочено', auto: true }
];

const EMPTY_FILTERS = {
  pcNumber: '',
  contractNumber: '',
  telegramId: '',
  status: ''
};

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesFilters(build, filters) {
  const pcNumber = normalizeSearch(filters.pcNumber);
  const contractNumber = normalizeSearch(filters.contractNumber);
  const telegramId = normalizeSearch(filters.telegramId);

  if (pcNumber && !normalizeSearch(build.pcNumber).includes(pcNumber)) return false;
  if (contractNumber && !normalizeSearch(build.contractNumber).includes(contractNumber)) return false;
  if (telegramId && !normalizeSearch(build.telegramId).includes(telegramId)) return false;
  if (filters.status === 'overdue') return isBuildOverdue(build);
  if (filters.status && build.status !== filters.status) return false;

  return true;
}

export default function BuildsBoard({
  builds,
  onEdit,
  onCopy,
  onArchive,
  onAdd,
  onStatusChange,
  onRemindDeadlines,
  reminding
}) {
  const [draggedId, setDraggedId] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filteredBuilds = useMemo(
    () => builds.filter((build) => matchesFilters(build, filters)),
    [builds, filters]
  );

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function handleDrop(event, status) {
    event.preventDefault();
    if (!draggedId) return;
    onStatusChange(draggedId, status);
    setDraggedId('');
  }

  return (
    <section className="board-section">
      <div className="section-heading">
        <div>
          <h1>Сборки ПК</h1>
          <p>Перетаскивайте карточку в нужную колонку.</p>
        </div>
        <div className="section-actions">
          <button className="ghost-button" onClick={onRemindDeadlines} disabled={reminding}>
            {reminding ? 'Отправка...' : 'Напомнить о сроках'}
          </button>
          <button className="primary-button" onClick={onAdd}>
            Добавить новый ПК
          </button>
        </div>
      </div>

      <section className="filters-panel">
        <label>
          Номер ПК
          <input
            value={filters.pcNumber}
            onChange={(event) => updateFilter('pcNumber', event.target.value)}
            placeholder="Поиск по номеру"
          />
        </label>
        <label>
          Номер договора
          <input
            value={filters.contractNumber}
            onChange={(event) => updateFilter('contractNumber', event.target.value)}
            placeholder="Поиск по договору"
          />
        </label>
        <label>
          Telegram ID покупателя
          <input
            value={filters.telegramId}
            onChange={(event) => updateFilter('telegramId', event.target.value)}
            placeholder="@username или ID"
          />
        </label>
        <label>
          Статус
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Все статусы</option>
            {STATUSES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.title}
              </option>
            ))}
            <option value="overdue">Просрочено</option>
          </select>
        </label>
        <button className="ghost-button" onClick={() => setFilters(EMPTY_FILTERS)}>
          Сбросить
        </button>
      </section>

      <div className="kanban">
        {BOARD_COLUMNS.map((status) => {
          const items = status.auto
            ? filteredBuilds.filter((build) => isBuildOverdue(build))
            : filteredBuilds.filter(
                (build) => build.status === status.id && !isBuildOverdue(build)
              );

          return (
            <section
              className={status.auto ? 'kanban-column kanban-column--overdue' : 'kanban-column'}
              key={status.id}
              onDragOver={status.auto ? undefined : (event) => event.preventDefault()}
              onDrop={status.auto ? undefined : (event) => handleDrop(event, status.id)}
            >
              <header>
                <h2>{status.title}</h2>
                <span>{items.length}</span>
              </header>
              <div className="kanban-column__body">
                {items.map((build) => (
                  <BuildCard
                    key={build.id}
                    build={build}
                    onEdit={onEdit}
                    onCopy={onCopy}
                    onArchive={onArchive}
                    onDragStart={(event, id) => {
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggedId(id);
                    }}
                  />
                ))}
                {items.length === 0 ? (
                  <div className="empty-column">
                    {status.auto ? 'Просроченных нет' : 'Пусто'}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
