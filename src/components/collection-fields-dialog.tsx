"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CollectionDto, CollectionResponse } from "@shared/types";
import { validateFields } from "@shared/validation";
import { apiFetch, ApiError } from "@/lib/api";
import {
  FieldEditor,
  collectionFieldsToEditable,
  editableFieldsToPayload,
  type EditableField,
} from "./field-editor";
import { Modal } from "./modal";
import { PencilIcon } from "./icons";
import { useToast } from "./toast";

interface CollectionFieldsDialogProps {
  collection: CollectionDto;
}

export function CollectionFieldsDialog({
  collection,
}: CollectionFieldsDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const formId = `${rawId}-form`;
  const resetCount = useRef(0);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EditableField[]>(() =>
    collectionFieldsToEditable(collection.fields, `${rawId}-initial`),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(path: string) {
    setErrors((current) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (key !== path && !key.startsWith(`${path}.`)) next[key] = value;
      }
      return next;
    });
  }

  function clearFieldError(rowIndex: number, property: string) {
    clearError(`fields.${rowIndex}.${property}`);
  }

  function openDialog() {
    resetCount.current += 1;
    setRows(
      collectionFieldsToEditable(
        collection.fields,
        `${rawId}-reopen-${resetCount.current}`,
      ),
    );
    setErrors({});
    setFormError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const result = validateFields(editableFieldsToPayload(rows));
    if (!result.ok) next[result.error.field] = result.error.message;
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const clientErrors = validate();
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await apiFetch<CollectionResponse>(
        `/api/admin/collections/${encodeURIComponent(collection.id)}`,
        {
          method: "PATCH",
          body: { fields: editableFieldsToPayload(rows) },
        },
      );
      setOpen(false);
      showToast("Alanlar güncellendi.");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.field) {
          setErrors((current) => ({ ...current, [error.field as string]: error.message }));
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Alanlar güncellenemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={openDialog}>
        <PencilIcon width={14} height={14} />
        Alanları düzenle
      </button>

      <Modal
        open={open}
        onClose={closeDialog}
        title="Alanları düzenle"
        description={`${collection.name} girişlerinin şeması. Slug sabittir: ${collection.slug}`}
        pending={submitting}
        size="wide"
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
              className="btn btn-primary"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Kaydediliyor…" : "Alanları kaydet"}
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

          <FieldEditor
            rows={rows}
            onChange={setRows}
            errors={errors}
            onClearError={clearFieldError}
            onClearAllErrors={() => clearError("fields")}
          />
        </form>
      </Modal>
    </>
  );
}
