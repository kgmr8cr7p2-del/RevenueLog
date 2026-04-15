import { isBuildOverdue } from '../../shared/calculations.js';
import BuildCard from './BuildCard.jsx';

export default function OverdueTab({ builds, onEdit, onCopy, onArchive }) {
  const overdueBuilds = builds.filter((build) => isBuildOverdue(build));

  return (
    <section className="overdue-section">
      <div className="section-heading">
        <div>
          <h1>Просрочено</h1>
          <p>Сборки с прошедшим дедлайном, которые еще не получены покупателем.</p>
        </div>
      </div>

      {overdueBuilds.length > 0 ? (
        <div className="archive-grid">
          {overdueBuilds.map((build) => (
            <BuildCard
              key={build.id}
              build={build}
              onEdit={onEdit}
              onCopy={onCopy}
              onArchive={onArchive}
            />
          ))}
        </div>
      ) : (
        <div className="empty-column">Просроченных сборок нет</div>
      )}
    </section>
  );
}
