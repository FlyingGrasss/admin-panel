"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CollectionDto,
  EntryDto,
  EntryStatus,
} from "@shared/types";
import { apiFetch, ApiError } from "@/lib/api";
import { entryTitle } from "@/lib/entries";
import { EntryDeleteDialog } from "./entry-delete-dialog";
import { EntryFormDialog } from "./entry-form-dialog";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";
import { useToast } from "./toast";

export interface EntryRowView extends EntryDto {
  updatedLabel: string;
}

interface EntriesSectionProps {
  collection: CollectionDto;
  entries: EntryRowView[];
  total: number;
  offset: number;
  limit: number;
  status?: EntryStatus;
}

const FILTERS: Array<{ label: string; value?: EntryStatus }> = [
  { label: "Tümü" },
  { label: "Taslak", value: "draft" },
  { label: "Yayında", value: "published" },
];

export function EntriesSection({
  collection,
  entries,
  total,
  offset,
  limit,
  status,
}: EntriesSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const basePath = `/koleksiyonlar/${encodeURIComponent(collection.id)}`;

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryDto | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntryDto | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  function filterHref(nextStatus?: EntryStatus): string {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  function pageHref(nextOffset: number): string {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  function openCreate() {
    setEditingEntry(null);
    setFormOpen(true);
  }

  function openEdit(entry: EntryDto) {
    setEditingEntry(entry);
    setFormOpen(true);
  }

  function openDelete(entry: EntryDto) {
    setDeleteTarget(entry);
    setDeleteOpen(true);
  }

  async function toggleStatus(entry: EntryDto) {
    if (pendingToggleId) return;

    const nextStatus: EntryStatus =
      entry.status === "published" ? "draft" : "published";
    setPendingToggleId(entry.id);

    try {
      await apiFetch(`/api/admin/entries/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      showToast(
        nextStatus === "published"
          ? "Giriş yayınlandı."
          : "Giriş yayından kaldırıldı.",
      );
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Durum güncellenemedi.",
        "error",
      );
    } finally {
      setPendingToggleId(null);
    }
  }

  function handleDeleted() {
    if (entries.length === 1 && offset > 0) {
      router.push(pageHref(Math.max(0, offset - limit)));
    } else {
      router.refresh();
    }
  }

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + entries.length, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <section className="card entries-card" aria-labelledby="entries-heading">
      <div className="section-header">
        <div>
          <h2 id="entries-heading" className="section-title">
            Girişler
          </h2>
          <p className="section-subtitle">
            {total} giriş
            {status === "draft"
              ? " · Taslak"
              : status === "published"
                ? " · Yayında"
                : ""}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <PlusIcon width={15} height={15} />
          Yeni giriş
        </button>
      </div>

      <div className="entries-toolbar">
        <nav className="filter-tabs" aria-label="Giriş durumu">
          {FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <Link
                key={filter.label}
                href={filterHref(filter.value)}
                className="filter-tab"
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>
            {status
              ? "Bu durumda giriş yok."
              : "Bu koleksiyonda giriş yok."}
          </p>
          {status ? (
            <Link href={filterHref()} className="btn btn-secondary btn-sm">
              Tüm girişleri göster
            </Link>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              <PlusIcon width={14} height={14} />
              Yeni giriş
            </button>
          )}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table entries-table">
            <thead>
              <tr>
                <th scope="col">Başlık</th>
                <th scope="col">Durum</th>
                <th scope="col">Güncellendi</th>
                <th scope="col">
                  <span className="sr-only">İşlemler</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const title = entryTitle(entry, collection.fields);
                const pending = pendingToggleId === entry.id;

                return (
                  <tr key={entry.id} aria-busy={pending || undefined}>
                    <td>
                      <button
                        type="button"
                        className="entry-title-button"
                        onClick={() => openEdit(entry)}
                        title={title}
                      >
                        {title}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          entry.status === "published"
                            ? "badge-published"
                            : "badge-draft"
                        }`}
                      >
                        <span className="badge-dot" aria-hidden="true" />
                        {entry.status === "published" ? "Yayında" : "Taslak"}
                      </span>
                    </td>
                    <td className="cell-muted">
                      <time dateTime={new Date(entry.updatedAt).toISOString()}>
                        {entry.updatedLabel}
                      </time>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEdit(entry)}
                        >
                          <PencilIcon width={13} height={13} />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => void toggleStatus(entry)}
                          disabled={pending}
                          aria-busy={pending || undefined}
                        >
                          <CheckIcon width={13} height={13} />
                          {entry.status === "published" ? "Kaldır" : "Yayınla"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-xs"
                          onClick={() => openDelete(entry)}
                          disabled={pending}
                        >
                          <TrashIcon width={13} height={13} />
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="pagination">
          <span className="pagination-summary">
            {rangeStart}–{rangeEnd} / {total}
          </span>
          <div className="pagination-controls">
            {hasPrevious ? (
              <Link
                href={pageHref(Math.max(0, offset - limit))}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeftIcon width={14} height={14} />
                Önceki
              </Link>
            ) : (
              <span
                className="btn btn-secondary btn-sm is-disabled"
                aria-disabled="true"
              >
                <ChevronLeftIcon width={14} height={14} />
                Önceki
              </span>
            )}
            {hasNext ? (
              <Link
                href={pageHref(offset + limit)}
                className="btn btn-secondary btn-sm"
              >
                Sonraki
                <ChevronRightIcon width={14} height={14} />
              </Link>
            ) : (
              <span
                className="btn btn-secondary btn-sm is-disabled"
                aria-disabled="true"
              >
                Sonraki
                <ChevronRightIcon width={14} height={14} />
              </span>
            )}
          </div>
        </div>
      ) : null}

      <EntryFormDialog
        open={formOpen}
        collection={collection}
        entry={editingEntry}
        onClose={() => setFormOpen(false)}
        onRequestDelete={(entry) => {
          setFormOpen(false);
          setDeleteTarget(entry);
          setDeleteOpen(true);
        }}
      />

      <EntryDeleteDialog
        open={deleteOpen}
        entry={deleteTarget}
        fields={collection.fields}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
