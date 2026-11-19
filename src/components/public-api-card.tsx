"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";
import { useToast } from "./toast";

interface PublicApiCardProps {
  collections: Array<{ slug: string; name: string }>;
}

export function PublicApiCard({ collections }: PublicApiCardProps) {
  const { showToast } = useToast();
  const [selectedSlug, setSelectedSlug] = useState(collections[0]?.slug ?? "");
  const [copying, setCopying] = useState(false);

  const activeSlug = collections.some((collection) => collection.slug === selectedSlug)
    ? selectedSlug
    : (collections[0]?.slug ?? "");
  const path = activeSlug ? `/api/content/${activeSlug}` : "/api/content/<slug>";

  async function copyEndpoint() {
    if (!activeSlug || copying) return;
    setCopying(true);

    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      showToast("API adresi kopyalandı.");
    } catch {
      showToast("Adres kopyalanamadı.", "error");
    } finally {
      setCopying(false);
    }
  }

  return (
    <section className="card api-card" aria-labelledby="api-card-heading">
      <div className="card-header">
        <div>
          <h2 id="api-card-heading" className="section-title">
            Genel API
          </h2>
          <p className="section-subtitle">Yayınlanan içerikleri dışarıya aç.</p>
        </div>
      </div>

      <div className="card-body">
        {collections.length > 0 ? (
          <div className="form-field api-collection-field">
            <label htmlFor="api-collection">Koleksiyon</label>
            <select
              id="api-collection"
              className="select"
              value={activeSlug}
              onChange={(event) => setSelectedSlug(event.target.value)}
            >
              {collections.map((collection) => (
                <option key={collection.slug} value={collection.slug}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="endpoint-row">
          <code className="endpoint">
            <span className="method">GET</span>
            <span className="endpoint-path">{path}</span>
          </code>
          <button
            type="button"
            className="icon-button"
            onClick={() => void copyEndpoint()}
            disabled={collections.length === 0 || copying}
            aria-label="API adresini kopyala"
            title="Kopyala"
          >
            <CopyIcon width={15} height={15} />
          </button>
        </div>

        <p className="help-text">
          {collections.length > 0
            ? "Yalnızca yayında olan girişler döner."
            : "Önce bir koleksiyon oluştur."}
        </p>
      </div>
    </section>
  );
}
