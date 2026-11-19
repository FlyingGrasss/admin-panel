import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { AdminStats } from "@shared/types";
import { requireSession, serverApiGet } from "@/lib/server-api";
import { formatNumber } from "@/lib/format";
import { ChartIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İstatistikler",
};

export default async function StatsPage() {
  await requireSession();

  const stats = await serverApiGet<AdminStats>("/api/admin/stats");
  if (!stats) redirect("/login");

  const totalPublished = stats.collections.reduce(
    (sum, collection) => sum + collection.published,
    0,
  );
  const totalDraft = stats.collections.reduce(
    (sum, collection) => sum + collection.draft,
    0,
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel</p>
          <h1 className="page-title">İstatistikler</h1>
          <p className="page-subtitle">
            Koleksiyon dağılımı ve son 24 saatteki API trafiği.
          </p>
        </div>
      </header>

      <section className="stats-grid" aria-label="Özet">
        <div className="card stat-card">
          <span className="stat-label">Koleksiyon sayısı</span>
          <strong className="stat-value">{formatNumber(stats.totalCollections)}</strong>
          <span className="stat-note">Tanımlı içerik modeli</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Giriş sayısı</span>
          <strong className="stat-value">{formatNumber(stats.totalEntries)}</strong>
          <span className="stat-note">
            {formatNumber(totalPublished)} yayında · {formatNumber(totalDraft)} taslak
          </span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Son 24 saat istek</span>
          <strong className="stat-value">{formatNumber(stats.requestsLast24h)}</strong>
          <span className="stat-note">API olay kayıtlarından</span>
        </div>
      </section>

      <section className="card" aria-labelledby="stats-table-heading">
        <div className="section-header">
          <div>
            <h2 id="stats-table-heading" className="section-title">
              Koleksiyon dağılımı
            </h2>
            <p className="section-subtitle">
              Girişlerin koleksiyonlara ve durumlara göre dağılımı.
            </p>
          </div>
          <ChartIcon width={18} height={18} className="section-icon" />
        </div>

        {stats.collections.length === 0 ? (
          <div className="empty-state">
            <p>Henüz koleksiyon yok.</p>
            <Link href="/" className="btn btn-secondary btn-sm">
              Koleksiyonlara dön
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table stats-table">
              <thead>
                <tr>
                  <th scope="col">Koleksiyon</th>
                  <th scope="col" className="numeric">
                    Toplam
                  </th>
                  <th scope="col" className="numeric">
                    Taslak
                  </th>
                  <th scope="col" className="numeric">
                    Yayında
                  </th>
                  <th scope="col">Dağılım</th>
                </tr>
              </thead>
              <tbody>
                {stats.collections.map((collection) => {
                  const publishedShare =
                    collection.total > 0
                      ? (collection.published / collection.total) * 100
                      : 0;
                  const draftShare =
                    collection.total > 0
                      ? (collection.draft / collection.total) * 100
                      : 0;

                  return (
                    <tr key={collection.id}>
                      <td>
                        <Link
                          href={`/koleksiyonlar/${encodeURIComponent(collection.id)}`}
                          className="collection-link"
                        >
                          <span className="collection-name">{collection.name}</span>
                          <code className="collection-slug">/{collection.slug}</code>
                        </Link>
                      </td>
                      <td className="numeric">{formatNumber(collection.total)}</td>
                      <td className="numeric cell-muted">
                        {formatNumber(collection.draft)}
                      </td>
                      <td className="numeric cell-muted">
                        {formatNumber(collection.published)}
                      </td>
                      <td>
                        <div
                          className="distribution-bar"
                          role="img"
                          aria-label={`${collection.name}: ${collection.published} yayında, ${collection.draft} taslak`}
                        >
                          <span
                            className="distribution-published"
                            style={{ width: `${publishedShare}%` }}
                            aria-hidden="true"
                          />
                          <span
                            className="distribution-draft"
                            style={{ width: `${draftShare}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
