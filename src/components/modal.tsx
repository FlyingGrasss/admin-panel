"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { CloseIcon } from "./icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  pending?: boolean;
  size?: "default" | "wide" | "entry";
}

/**
 * Native <dialog> gives us the top layer, a focus trap, and Escape handling.
 * The open state stays controlled so pending mutations can block dismissal.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  pending = false,
  size = "default",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const target =
        dialog.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog.querySelector<HTMLElement>(
          ".modal-body input:not([type='hidden']), .modal-body select, .modal-body textarea",
        ) ??
        dialog.querySelector<HTMLElement>(".modal-footer .btn-secondary") ??
        dialog.querySelector<HTMLElement>(".modal-footer button");
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="modal-description">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={pending}
          aria-label="Kapat"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer ? <div className="modal-footer">{footer}</div> : null}
    </dialog>
  );
}
