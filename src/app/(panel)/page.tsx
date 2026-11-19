import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import type {
  AdminStats,
  CollectionListResponse,
} from "@shared/types";
import { requireSession, serverApiGet } from "@/lib/server-api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { NewCollectionDialog } from "@/components/collection-create-dialog";
import { PublicApiCard } from "@/components/public-api-card";
import { ArrowRightIcon, LayersIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Koleksiyonlar",
};

export default async function DashboardPage() {
  await requireSession();

  const [stats, collectionList] = await Promise.all([
    serverApiGet<AdminStats>("/api/admin/stats"),
    serverApiGet<CollectionListResponse>("/api/admin/collections"),
  ]);

  if (!stats || !collectionList) {
    redirect("/login");
  }

  const statsByCollection = new Map(
    stats.collections.map((collection) => [collection.id, collection]),
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel</p>
          <h1 className="page-title">Koleksiyonlar</h1>
          <p className="page-subtitle">
            İçerik modellerini ve kayıtları tek yerden yönet.
          </p>
        </div>
        <div className="page-actions">
          <NewCollectionDialog />
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
          <span className="stat-note">Tüm koleksiyonlarda</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Son 24 saat istek</span>
          <strong className="stat-value">{formatNumber(stats.requestsLast24h)}</strong>
          <span className="stat-note">API olay kayıtları</span>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="collections-heading">
          <div className="section-header">
            <div>
              <h2 id="collections-heading" className="section-title">
                Tüm koleksiyonlar
              </h2>
              <p className="section-subtitle">
                {collectionList.collections.length} koleksiyon
              </p>
            </div>
          </div>

          {collectionList.collections.length === 0 ? (
            <div className="empty-state">
              <LayersIcon width={22} height={22} className="empty-icon" />
              <p>Henüz koleksiyon yok. İlk koleksiyonu oluştur.</p>
              <NewCollectionDialog
                label="Koleksiyon oluştur"
                variant="secondary"
              />
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Koleksiyon</th>
                    <th scope="col" className="numeric">
                      Alan
                    </th>
                    <th scope="col" className="numeric">
                      Giriş
                    </th>
                    <th scope="col">Güncellendi</th>
                    <th scope="col">
                      <span className="sr-only">Aç</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {collectionList.collections.map((collection) => {
                    const collectionStats = statsByCollection.get(collection.id);
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
                        <td className="numeric cell-muted">{collection.fields.length}</td>
                        <td className="numeric cell-muted">
                          {formatNumber(collectionStats?.total ?? 0)}
                        </td>
                        <td className="cell-muted">
                          <time dateTime={new Date(collection.updatedAt).toISOString()}>
                            {formatDateTime(collection.updatedAt)}
                          </time>
                        </td>
                        <td className="cell-action">
                          <Link
                            href={`/koleksiyonlar/${encodeURIComponent(collection.id)}`}
                            className="icon-button icon-button-small"
                            aria-label={`${collection.name} koleksiyonunu aç`}
                          >
                            <ArrowRightIcon width={15} height={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <PublicApiCard
          collections={collectionList.collections.map((collection) => ({
            name: collection.name,
            slug: collection.slug,
          }))}
        />
      </div>
    </div>
  );
}
