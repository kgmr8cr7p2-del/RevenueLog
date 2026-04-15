import BuildCard from './BuildCard.jsx';

export default function ArchiveTab({ builds, onEdit, onCopy, onArchive }) {
  return (
    <section className="archive-section">
      <div className="section-heading">
        <div>
          <h1>Архив</h1>
          <p>Здесь лежат сборки, которые скрыты с основной доски.</p>
        </div>
      </div>

      {builds.length > 0 ? (
        <div className="archive-grid">
          {builds.map((build) => (
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
        <div className="empty-column">Архив пуст</div>
      )}
    </section>
  );
}
