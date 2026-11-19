export default function PanelLoading() {
  return (
    <div className="page" aria-busy="true">
      <span className="sr-only">Yükleniyor…</span>
      <header className="page-header" aria-hidden="true">
        <div>
          <div className="skeleton skeleton-line skeleton-eyebrow" />
          <div className="skeleton skeleton-line skeleton-heading" />
          <div className="skeleton skeleton-line skeleton-subtitle" />
        </div>
        <div className="skeleton skeleton-button" />
      </header>

      <div className="stats-grid" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="card stat-card">
            <div className="skeleton skeleton-line skeleton-label" />
            <div className="skeleton skeleton-line skeleton-number" />
            <div className="skeleton skeleton-line skeleton-note" />
          </div>
        ))}
      </div>

      <div className="card" aria-hidden="true">
        <div className="section-header">
          <div>
            <div className="skeleton skeleton-line skeleton-section-title" />
            <div className="skeleton skeleton-line skeleton-note" />
          </div>
        </div>
        <div className="skeleton-table">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="skeleton-table-row">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
