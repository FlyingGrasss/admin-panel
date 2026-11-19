"use client";

import { useId, useRef } from "react";
import {
  FIELD_TYPES,
  type CollectionField,
  type FieldType,
} from "@shared/types";
import { fieldKeyFromLabel } from "@/lib/slug";
import { PlusIcon, TrashIcon } from "./icons";

export interface EditableField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
  keyTouched: boolean;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Metin",
  textarea: "Uzun metin",
  number: "Sayı",
  boolean: "Onay kutusu",
  date: "Tarih",
  url: "Bağlantı",
  select: "Seçim",
};

type FieldErrors = Record<string, string>;

export function createEmptyField(id: string): EditableField {
  return {
    id,
    key: "",
    label: "",
    type: "text",
    required: false,
    optionsText: "",
    keyTouched: false,
  };
}

export function collectionFieldsToEditable(
  fields: CollectionField[],
  idPrefix: string,
): EditableField[] {
  return fields.map((field, index) => ({
    id: `${idPrefix}-${index}`,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    optionsText: field.options?.join(", ") ?? "",
    keyTouched: true,
  }));
}

export function editableFieldsToPayload(
  rows: EditableField[],
): CollectionField[] {
  return rows.map((row) => {
    const options = row.optionsText
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);

    return {
      key: row.key.trim(),
      label: row.label.trim(),
      type: row.type,
      required: row.required,
      ...(row.type === "select" ? { options } : {}),
    };
  });
}

function findError(
  errors: FieldErrors,
  fieldIndex: number,
  property: string,
): string | undefined {
  const path = `fields.${fieldIndex}.${property}`;
  if (errors[path]) return errors[path];

  const prefix = `${path}.`;
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith(prefix)) return message;
  }
  return undefined;
}

interface FieldEditorProps {
  rows: EditableField[];
  onChange: (rows: EditableField[]) => void;
  errors: FieldErrors;
  onClearError: (rowIndex: number, property: string) => void;
  onClearAllErrors: () => void;
}

export function FieldEditor({
  rows,
  onChange,
  errors,
  onClearError,
  onClearAllErrors,
}: FieldEditorProps) {
  const editorId = useId();
  const nextId = useRef(0);

  function newRowId(): string {
    const id = `${editorId}-new-${nextId.current}`;
    nextId.current += 1;
    return id;
  }

  function updateRow(index: number, patch: Partial<EditableField>) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addRow() {
    onChange([...rows, createEmptyField(newRowId())]);
    onClearAllErrors();
  }

  function removeRow(index: number) {
    onChange(rows.filter((_row, rowIndex) => rowIndex !== index));
    onClearAllErrors();
  }

  const listError = errors.fields;

  return (
    <div className="field-editor">
      <div className="field-editor-heading">
        <div>
          <h3 className="subsection-title">Alanlar</h3>
          <p className="help-text">
            İçerik girişlerinde görünecek alanları ve tiplerini tanımla.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          <PlusIcon width={14} height={14} />
          Alan ekle
        </button>
      </div>

      {listError ? (
        <p className="form-error-banner" role="alert">
          {listError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="field-editor-empty">
          <p>Henüz alan tanımlanmadı. En az bir alan eklemelisin.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
            <PlusIcon width={14} height={14} />
            Alan ekle
          </button>
        </div>
      ) : null}

      <div className="field-rows">
        {rows.map((row, index) => {
          const keyError = findError(errors, index, "key");
          const labelError = findError(errors, index, "label");
          const typeError = findError(errors, index, "type");
          const requiredError = findError(errors, index, "required");
          const optionsError = findError(errors, index, "options");
          const rowError = errors[`fields.${index}`];
          const keyId = `${row.id}-key`;
          const labelId = `${row.id}-label`;
          const typeId = `${row.id}-type`;
          const requiredId = `${row.id}-required`;
          const optionsId = `${row.id}-options`;
          const keyErrorId = `${row.id}-key-error`;
          const labelErrorId = `${row.id}-label-error`;
          const typeErrorId = `${row.id}-type-error`;
          const requiredErrorId = `${row.id}-required-error`;
          const optionsErrorId = `${row.id}-options-error`;

          return (
            <fieldset key={row.id} className="field-editor-row">
              <legend className="sr-only">Alan {index + 1}</legend>

              <div className="field-editor-row-head">
                <span className="field-index">Alan {index + 1}</span>
                <button
                  type="button"
                  className="icon-button icon-button-small"
                  onClick={() => removeRow(index)}
                  aria-label={`${row.label.trim() || `Alan ${index + 1}`} alanını kaldır`}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>

              {rowError ? (
                <p className="field-error" role="alert">
                  {rowError}
                </p>
              ) : null}

              <div className="field-editor-grid">
                <div className="form-field">
                  <label htmlFor={labelId}>
                    Etiket
                    <span className="required-mark" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id={labelId}
                    className="input"
                    value={row.label}
                    maxLength={120}
                    placeholder="Başlık"
                    required
                    aria-invalid={labelError ? true : undefined}
                    aria-describedby={labelError ? labelErrorId : undefined}
                    onChange={(event) => {
                      const label = event.target.value;
                      updateRow(index, {
                        label,
                        ...(row.keyTouched
                          ? {}
                          : { key: fieldKeyFromLabel(label) }),
                      });
                      onClearError(index, "label");
                      if (!row.keyTouched) onClearError(index, "key");
                    }}
                  />
                  {labelError ? (
                    <p id={labelErrorId} className="field-error" role="alert">
                      {labelError}
                    </p>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor={keyId}>
                    Anahtar
                    <span className="required-mark" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id={keyId}
                    className="input mono"
                    value={row.key}
                    maxLength={40}
                    placeholder="baslik"
                    required
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={keyError ? true : undefined}
                    aria-describedby={
                      keyError ? `${keyId}-hint ${keyErrorId}` : `${keyId}-hint`
                    }
                    onChange={(event) => {
                      updateRow(index, {
                        key: event.target.value,
                        keyTouched: true,
                      });
                      onClearError(index, "key");
                    }}
                  />
                  <p id={`${keyId}-hint`} className="help-text">
                    Küçük harf, rakam ve alt çizgi.
                  </p>
                  {keyError ? (
                    <p id={keyErrorId} className="field-error" role="alert">
                      {keyError}
                    </p>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor={typeId}>Tip</label>
                  <select
                    id={typeId}
                    className="select"
                    value={row.type}
                    aria-invalid={typeError ? true : undefined}
                    aria-describedby={typeError ? typeErrorId : undefined}
                    onChange={(event) => {
                      updateRow(index, { type: event.target.value as FieldType });
                      onClearError(index, "type");
                      onClearError(index, "options");
                    }}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FIELD_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  {typeError ? (
                    <p id={typeErrorId} className="field-error" role="alert">
                      {typeError}
                    </p>
                  ) : null}
                </div>

                <div className="form-field checkbox-field">
                  <input
                    id={requiredId}
                    type="checkbox"
                    className="checkbox"
                    checked={row.required}
                    aria-invalid={requiredError ? true : undefined}
                    aria-describedby={requiredError ? requiredErrorId : undefined}
                    onChange={(event) => {
                      updateRow(index, { required: event.target.checked });
                      onClearError(index, "required");
                    }}
                  />
                  <label htmlFor={requiredId}>Zorunlu alan</label>
                  {requiredError ? (
                    <p id={requiredErrorId} className="field-error" role="alert">
                      {requiredError}
                    </p>
                  ) : null}
                </div>
              </div>

              {row.type === "select" ? (
                <div className="form-field field-row-options">
                  <label htmlFor={optionsId}>
                    Seçenekler
                    <span className="required-mark" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id={optionsId}
                    className="input"
                    value={row.optionsText}
                    placeholder="Küçük, Orta, Büyük"
                    required
                    aria-invalid={optionsError ? true : undefined}
                    aria-describedby={
                      optionsError
                        ? `${optionsId}-hint ${optionsErrorId}`
                        : `${optionsId}-hint`
                    }
                    onChange={(event) => {
                      updateRow(index, { optionsText: event.target.value });
                      onClearError(index, "options");
                    }}
                  />
                  <p id={`${optionsId}-hint`} className="help-text">
                    Seçenekleri virgülle ayır.
                  </p>
                  {optionsError ? (
                    <p id={optionsErrorId} className="field-error" role="alert">
                      {optionsError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
