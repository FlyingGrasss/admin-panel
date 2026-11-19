"use client";

import Link from "next/link";

interface PanelErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PanelError({ reset }: PanelErrorProps) {
  return (
    <div className="page">
      <div className="card state-card">
        <h1 className="state-title">Veriler yüklenemedi</h1>
        <p className="state-text">
          API’ye ulaşılamıyor olabilir. Sunucunun çalıştığını kontrol edip tekrar
          dene.
        </p>
        <div className="state-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Tekrar dene
          </button>
          <Link href="/" className="btn btn-secondary">
            Panele dön
          </Link>
        </div>
      </div>
    </div>
  );
}
