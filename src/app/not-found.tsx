import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <div className="card state-card">
        <p className="eyebrow">404</p>
        <h1 className="state-title">Sayfa bulunamadı</h1>
        <p className="state-text">Aradığın sayfa taşınmış olabilir.</p>
        <div className="state-actions">
          <Link href="/" className="btn btn-primary">
            Panele dön
          </Link>
        </div>
      </div>
    </main>
  );
}
