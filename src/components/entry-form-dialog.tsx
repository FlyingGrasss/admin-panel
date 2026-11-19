"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  CollectionDto,
  CollectionField,
  EntryData,
  EntryDto,
  EntryResponse,
  EntryStatus,
} from "@shared/types";
import {
  TEXTAREA_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  validateEntryData,
} from "@shared/validation";
import { apiFetch, ApiError } from "@/lib/api";
import { Modal } from "./modal";
import { TrashIcon } from "./icons";
import { useToast } from "./toast";

type FieldValue = string | boolean;
type FieldValues = Record<string, FieldValue>;

interface EntryFormDialogProps {
  open: boolean;
  collection: CollectionDto;
  entry: EntryDto | null;
  onClose: () => void;
  onRequestDelete?: (entry: EntryDto) => void;
}

function initialValues(fields: CollectionField[], entry: EntryDto | null): FieldValues {
  const values: FieldValues = {};

  for (const field of fields) {
    const raw = entry?.data[field.key];

    if (field.type === "boolean") {
      values[field.key] = raw === true;
    } else if (field.type === "number") {
      values[field.key] =
        typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
    } else {
      values[field.key] = typeof raw === "string" ? raw : "";
    }
  }

  return values;
}

function buildEntryData(
  fields: CollectionField[],
  values: FieldValues,
): { data: EntryData; errors: Record<string, string> } {
  const data: EntryData = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.key];

    if (field.type === "boolean") {
      data[field.key] = value === true;
      continue;
    }

    const text = typeof value === "string" ? value : "";

    if (field.type === "number") {
      const trimmed = text.trim();
      if (trimmed === "") {
        data[field.key] = null;
      } else {
        const parsed = Number(trimmed);
        data[field.key] = Number.isFinite(parsed) ? parsed : Number.NaN;
      }
      continue;
    }

    const normalized = field.type === "url" ? text.trim() : text;
    data[field.key] = normalized.trim() === "" ? null : normalized;
  }

  const result = validateEntryData(fields, data);
  if (!result.ok) {
    const path = result.error.field;
    if (path.startsWith("data.")) {
      errors[path.slice(5)] = result.error.message;
    } else {
      errors.form = result.error.message;
    }
  }

  return { data: result.ok ? result.value : data, errors };
}

export function EntryFormDialog({
  open,
  collection,
  entry,
  onClose,
  onRequestDelete,
}: EntryFormDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const formId = `${rawId}-form`;

  const [values, setValues] = useState<FieldValues>(() =>
    initialValues(collection.fields, entry),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues(collection.fields, entry));
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  }, [open, entry, collection.fields]);

  function closeDialog() {
    if (submitting) return;
    onClose();
  }

  function setValue(key: string, value: FieldValue) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function submit(status: EntryStatus) {
    if (submitting) return;

    const result = buildEntryData(collection.fields, values);
    setErrors(result.errors);
    setFormError(null);

    if (Object.keys(result.errors).length > 0) return;

    setSubmitting(true);
    try {
      if (entry) {
        await apiFetch<EntryResponse>(
          `/api/admin/entries/${encodeURIComponent(entry.id)}`,
          {
            method: "PATCH",
            body: { data: result.data, status },
          },
        );
      } else {
        await apiFetch<EntryResponse>(
          `/api/admin/entries/${encodeURIComponent(collection.id)}`,
          {
            method: "POST",
            body: { data: result.data, status },
          },
        );
      }

      onClose();
      showToast(
        status === "published"
          ? "Giriş yayınlandı."
          : "Giriş taslak olarak kaydedildi.",
      );
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.field && error.field.startsWith("data.")) {
          setErrors((current) => ({
            ...current,
            [error.field!.slice(5)]: error.message,
          }));
        } else if (error.field === "status") {
          setFormError(error.message);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Giriş kaydedilemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(entry?.status ?? "draft");
  }

  function renderControl(field: CollectionField, index: number): ReactNode {
    const id = `${rawId}-field-${field.key}`;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const error = errors[field.key];
    const describedBy = [field.type === "url" ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");
    const autoFocus = index === 0 ? "" : undefined;
    const value = values[field.key];
    const shared = {
      id,
      "aria-invalid": error ? true : undefined,
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
      ...(autoFocus !== undefined ? { "data-autofocus": autoFocus } : {}),
    };

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            {...shared}
            className="textarea"
            rows={5}
            maxLength={TEXTAREA_MAX_LENGTH}
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        );

      case "number":
        return (
          <input
            {...shared}
            className="input"
            type="number"
            step="any"
            inputMode="decimal"
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        );

      case "boolean":
        return (
          <div className="checkbox-control">
            <input
              id={id}
              type="checkbox"
              className="checkbox"
              checked={value === true}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              data-autofocus={autoFocus}
              onChange={(event) => setValue(field.key, event.target.checked)}
            />
            <label htmlFor={id} className="checkbox-label">
              {field.label}
              {field.required ? (
                <>
                  <span className="required-mark" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only"> (zorunlu)</span>
                </>
              ) : null}
            </label>
          </div>
        );

      case "date":
        return (
          <input
            {...shared}
            className="input"
            type="date"
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        );

      case "url":
        return (
          <>
            <input
              {...shared}
              className="input"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://"
              required={field.required}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            <p id={hintId} className="help-text">
              http veya https ile başlayan tam adres.
            </p>
          </>
        );

      case "select":
        return (
          <select
            {...shared}
            className="select"
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(field.key, event.target.value)}
          >
            <option value="">Seçin…</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case "text":
      default:
        return (
          <input
            {...shared}
            className="input"
            type="text"
            maxLength={TEXT_MAX_LENGTH}
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        );
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      title={entry ? "Girişi düzenle" : "Yeni giriş"}
      description={`${collection.name} koleksiyonu`}
      pending={submitting}
      size="entry"
      footer={
        <>
          {entry && onRequestDelete ? (
            <button
              type="button"
              className="btn btn-danger-ghost footer-start"
              onClick={() => onRequestDelete(entry)}
              disabled={submitting}
            >
              <TrashIcon width={14} height={14} />
              Girişi sil
            </button>
          ) : null}
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
            className="btn btn-secondary"
            onClick={() => void submit("draft")}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Kaydediliyor…" : "Taslak olarak kaydet"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit("published")}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Kaydediliyor…" : "Yayınla"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        {formError ? (
          <p className="form-error-banner" role="alert">
            {formError}
          </p>
        ) : null}

        {collection.fields.length === 0 ? (
          <p className="empty-note">Bu koleksiyonda tanımlı alan yok.</p>
        ) : null}

        <div className="entry-form-fields">
          {collection.fields.map((field, index) => {
            const id = `${rawId}-field-${field.key}`;
            const error = errors[field.key];
            const errorId = `${id}-error`;

            if (field.type === "boolean") {
              return (
                <div key={field.key} className="form-field">
                  {renderControl(field, index)}
                  {error ? (
                    <p id={errorId} className="field-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={field.key} className="form-field">
                <label htmlFor={id}>
                  {field.label}
                  {field.required ? (
                    <>
                      <span className="required-mark" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only"> (zorunlu)</span>
                    </>
                  ) : null}
                </label>
                {renderControl(field, index)}
                {error ? (
                  <p id={errorId} className="field-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
