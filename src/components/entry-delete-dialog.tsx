"use client";

import { useState } from "react";
import type { CollectionField, EntryDto } from "@shared/types";
import { apiFetch, ApiError } from "@/lib/api";
import { entryTitle } from "@/lib/entries";
import { Modal } from "./modal";
import { TrashIcon } from "./icons";
import { useToast } from "./toast";

interface EntryDeleteDialogProps {
  open: boolean;
  entry: EntryDto | null;
  fields: CollectionField[];
  onClose: () => void;
  onDeleted: (entry: EntryDto) => void;
}

export function EntryDeleteDialog({
  open,
  entry,
  fields,
  onClose,
  onDeleted,
}: EntryDeleteDialogProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeDialog() {
    if (submitting) return;
    setError(null);
    onClose();
  }

  async function remove() {
    if (!entry || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch<void>(`/api/admin/entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      showToast("Giriş silindi.");
      onClose();
      onDeleted(entry);
    } catch (apiError) {
      setError(
        apiError instanceof ApiError ? apiError.message : "Giriş silinemedi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = entry ? entryTitle(entry, fields) : "";

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title="Girişi sil"
      description="Bu işlem geri alınamaz."
      pending={submitting}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeDialog}
            disabled={submitting}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void remove()}
            disabled={submitting || !entry}
            aria-busy={submitting}
          >
            <TrashIcon width={14} height={14} />
            {submitting ? "Siliniyor…" : "Girişi sil"}
          </button>
        </>
      }
    >
      {error ? (
        <p className="form-error-banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="danger-summary">
        <strong>{title}</strong>
        <p>Bu giriş koleksiyondan kalıcı olarak kaldırılacak.</p>
      </div>
    </Modal>
  );
}
