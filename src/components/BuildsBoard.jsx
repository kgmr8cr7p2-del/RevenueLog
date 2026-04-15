import { useState } from 'react';
import { STATUSES } from '../../shared/calculations.js';
import BuildCard from './BuildCard.jsx';

export default function BuildsBoard({ builds, onEdit, onAdd, onStatusChange }) {
  const [draggedId, setDraggedId] = useState('');

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

      <div className="kanban">
        {STATUSES.map((status) => {
          const items = builds.filter((build) => build.status === status.id);
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
