import { useMemo, useState } from 'react';
import { STATUSES } from '../../shared/calculations.js';
import BuildCard from './BuildCard.jsx';

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
  if (filters.status && build.status !== filters.status) return false;

  return true;
}

export default function BuildsBoard({ builds, onEdit, onCopy, onAdd, onStatusChange }) {
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
        <button className="primary-button" onClick={onAdd}>
          Добавить новый ПК
        </button>
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
          </select>
        </label>
        <button className="ghost-button" onClick={() => setFilters(EMPTY_FILTERS)}>
          Сбросить
        </button>
      </section>

      <div className="kanban">
        {STATUSES.map((status) => {
          const items = filteredBuilds.filter((build) => build.status === status.id);
          return (
            <section
              className="kanban-column"
              key={status.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, status.id)}
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
                    onDragStart={(event, id) => {
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggedId(id);
                    }}
                  />
                ))}
                {items.length === 0 ? <div className="empty-column">Пусто</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
