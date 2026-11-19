import Link from "next/link";

export default function PanelNotFound() {
  return (
    <div className="page">
      <div className="card state-card">
        <p className="eyebrow">404</p>
        <h1 className="state-title">Koleksiyon bulunamadı</h1>
        <p className="state-text">
          Bu koleksiyon silinmiş veya adresi değişmiş olabilir.
        </p>
        <div className="state-actions">
          <Link href="/" className="btn btn-primary">
            Koleksiyonlara dön
          </Link>
        </div>
      </div>
    </div>
  );
}
