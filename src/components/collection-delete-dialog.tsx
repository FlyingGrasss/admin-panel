"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CollectionDto } from "@shared/types";
import { apiFetch, ApiError } from "@/lib/api";
import { Modal } from "./modal";
import { TrashIcon } from "./icons";
import { useToast } from "./toast";

interface CollectionDeleteDialogProps {
  collection: CollectionDto;
}

export function CollectionDeleteDialog({
  collection,
}: CollectionDeleteDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const formId = `${rawId}-form`;

  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openDialog() {
    setConfirmSlug("");
    setError(null);
    setFormError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (confirmSlug !== collection.slug) {
      setError(`Onay için "${collection.slug}" yazmalısın.`);
      return;
    }

    setError(null);
    setFormError(null);
    setSubmitting(true);

    try {
      await apiFetch<void>(
        `/api/admin/collections/${encodeURIComponent(collection.id)}`,
        {
          method: "DELETE",
          body: { confirmSlug },
        },
      );
      setOpen(false);
      showToast("Koleksiyon silindi.");
      router.push("/");
      router.refresh();
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        if (apiError.field === "confirmSlug") {
          setError(apiError.message);
        } else {
          setFormError(apiError.message);
        }
      } else {
        setFormError("Koleksiyon silinemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-danger-ghost" onClick={openDialog}>
        <TrashIcon width={14} height={14} />
        Koleksiyonu sil
      </button>

      <Modal
        open={open}
        onClose={closeDialog}
        title="Koleksiyonu sil"
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
              type="submit"
              form={formId}
              className="btn btn-danger"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Siliniyor…" : "Koleksiyonu sil"}
            </button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate>
          {formError ? (
            <p className="form-error-banner" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="danger-summary">
            <strong>{collection.name}</strong>
            <span className="mono">{collection.slug}</span>
            <p>
              Koleksiyon ve bu koleksiyondaki tüm girişler kalıcı olarak silinir.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor={`${rawId}-confirm`}>
              Onaylamak için koleksiyon slug’ını yaz
            </label>
            <input
              id={`${rawId}-confirm`}
              className="input mono"
              value={confirmSlug}
              data-autofocus
              autoComplete="off"
              spellCheck={false}
              placeholder={collection.slug}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${rawId}-confirm-error` : undefined}
              onChange={(event) => {
                setConfirmSlug(event.target.value);
                if (error) setError(null);
              }}
            />
            {error ? (
              <p id={`${rawId}-confirm-error`} className="field-error" role="alert">
                {error}
              </p>
            ) : (
              <p className="help-text">
                Onay için <code>{collection.slug}</code> yazılmalı.
              </p>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
