"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CollectionResponse } from "@shared/types";
import {
  COLLECTION_SLUG_PATTERN,
  validateCollectionName,
  validateCollectionSlug,
  validateFields,
} from "@shared/validation";
import { apiFetch, ApiError } from "@/lib/api";
import { slugify } from "@/lib/slug";
import {
  FieldEditor,
  createEmptyField,
  editableFieldsToPayload,
  type EditableField,
} from "./field-editor";
import { Modal } from "./modal";
import { PlusIcon } from "./icons";
import { useToast } from "./toast";

interface NewCollectionDialogProps {
  label?: string;
  variant?: "primary" | "secondary";
}

export function NewCollectionDialog({
  label = "Yeni koleksiyon",
  variant = "primary",
}: NewCollectionDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const formId = `${rawId}-form`;
  const resetCount = useRef(0);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [rows, setRows] = useState<EditableField[]>([
    createEmptyField(`${rawId}-initial`),
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    resetCount.current += 1;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setRows([createEmptyField(`${rawId}-reset-${resetCount.current}`)]);
    setErrors({});
    setFormError(null);
  }

  function openDialog() {
    resetForm();
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
  }

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
    const path = `fields.${rowIndex}.${property}`;
    setErrors((current) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (key !== path && !key.startsWith(`${path}.`)) next[key] = value;
      }
      return next;
    });
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    const nameResult = validateCollectionName(name);
    if (!nameResult.ok) next[nameResult.error.field] = nameResult.error.message;

    const slugResult = validateCollectionSlug(slug);
    if (!slugResult.ok) next[slugResult.error.field] = slugResult.error.message;

    const fieldsResult = validateFields(editableFieldsToPayload(rows));
    if (!fieldsResult.ok) next[fieldsResult.error.field] = fieldsResult.error.message;

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
      const response = await apiFetch<CollectionResponse>("/api/admin/collections", {
        method: "POST",
        body: {
          name,
          slug,
          fields: editableFieldsToPayload(rows),
        },
      });

      setOpen(false);
      showToast("Koleksiyon oluşturuldu.");
      router.push(`/koleksiyonlar/${response.collection.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.field) {
          setErrors((current) => ({ ...current, [error.field as string]: error.message }));
        } else if (error.code === "SLUG_TAKEN") {
          setErrors((current) => ({ ...current, slug: error.message }));
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Koleksiyon oluşturulamadı.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn btn-${variant}`} onClick={openDialog}>
        <PlusIcon width={15} height={15} />
        {label}
      </button>

      <Modal
        open={open}
        onClose={closeDialog}
        title="Yeni koleksiyon"
        description="İçerik modelini ve alanlarını tanımla. Slug oluşturulduktan sonra değiştirilemez."
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
              {submitting ? "Oluşturuluyor…" : "Koleksiyon oluştur"}
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

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={`${rawId}-name`}>
                Koleksiyon adı
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={`${rawId}-name`}
                className="input"
                value={name}
                maxLength={80}
                required
                data-autofocus
                placeholder="Blog yazıları"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${rawId}-name-error` : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (!slugTouched) setSlug(slugify(value));
                  clearError("name");
                }}
              />
              {errors.name ? (
                <p id={`${rawId}-name-error`} className="field-error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor={`${rawId}-slug`}>
                Slug
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={`${rawId}-slug`}
                className="input mono"
                value={slug}
                maxLength={48}
                required
                spellCheck={false}
                autoComplete="off"
                placeholder="blog-yazilari"
                pattern={COLLECTION_SLUG_PATTERN.source}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={`${rawId}-slug-hint${
                  errors.slug ? ` ${rawId}-slug-error` : ""
                }`}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugTouched(true);
                  clearError("slug");
                }}
              />
              <p id={`${rawId}-slug-hint`} className="help-text">
                2–48 karakter; küçük harf, rakam ve tire. Ad yazıldıkça otomatik
                oluşur.
              </p>
              {errors.slug ? (
                <p id={`${rawId}-slug-error`} className="field-error" role="alert">
                  {errors.slug}
                </p>
              ) : null}
            </div>
          </div>

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
