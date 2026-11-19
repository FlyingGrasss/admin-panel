import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type {
  CollectionListResponse,
  EntryListResponse,
  EntryStatus,
} from "@shared/types";
import { requireSession, serverApiGet } from "@/lib/server-api";
import { formatDateTime } from "@/lib/format";
import { CollectionDeleteDialog } from "@/components/collection-delete-dialog";
import { CollectionFieldsDialog } from "@/components/collection-fields-dialog";
import { EntriesSection } from "@/components/entries-section";
import { ArrowLeftIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Koleksiyon",
};

const PAGE_SIZE = 50;

interface CollectionPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): EntryStatus | undefined {
  return value === "draft" || value === "published" ? value : undefined;
}

function parseOffset(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  await requireSession();

  const { id } = await params;
  const query = await searchParams;
  const status = parseStatus(firstValue(query.status));
  const offset = parseOffset(firstValue(query.offset));

  const collectionList =
    await serverApiGet<CollectionListResponse>("/api/admin/collections");
  if (!collectionList) redirect("/login");

  const collection = collectionList.collections.find((item) => item.id === id);
  if (!collection) notFound();

  const entryParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (status) entryParams.set("status", status);

  const entryPage = await serverApiGet<EntryListResponse>(
    `/api/admin/entries/${encodeURIComponent(id)}?${entryParams.toString()}`,
  );
  if (!entryPage) redirect("/login");

  const entries = entryPage.entries.map((entry) => ({
    ...entry,
    updatedLabel: formatDateTime(entry.updatedAt),
  }));

  return (
    <div className="page">
      <Link href="/" className="back-link">
        <ArrowLeftIcon width={14} height={14} />
        Koleksiyonlar
      </Link>

      <header className="page-header detail-header">
        <div>
          <p className="eyebrow">Koleksiyon</p>
          <h1 className="page-title">{collection.name}</h1>
          <p className="detail-meta">
            <code className="collection-slug">/{collection.slug}</code>
            <span aria-hidden="true">·</span>
            <span>{collection.fields.length} alan</span>
            <span aria-hidden="true">·</span>
            <span>Güncellendi {formatDateTime(collection.updatedAt)}</span>
          </p>
        </div>
        <div className="page-actions">
          <CollectionFieldsDialog collection={collection} />
          <CollectionDeleteDialog collection={collection} />
        </div>
      </header>

      <EntriesSection
        collection={collection}
        entries={entries}
        total={entryPage.total}
        offset={offset}
        limit={PAGE_SIZE}
        status={status}
      />
    </div>
  );
}
