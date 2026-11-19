"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthSessionInfo } from "@shared/types";
import { apiFetch, ApiError } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const passwordRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (password.length === 0) {
      setError("Yönetici şifresi gerekli.");
      passwordRef.current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await apiFetch<AuthSessionInfo>("/api/auth/login", {
        method: "POST",
        body: { password },
        redirectOnUnauthorized: false,
      });
      router.replace("/");
      router.refresh();
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.code === "INVALID_CREDENTIALS") {
        setError("Şifre hatalı.");
      } else if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Giriş yapılamadı.");
      }
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-brand">
        <span className="brand-mark brand-mark-large" aria-hidden="true">
          K
        </span>
        <span className="brand-name">Kavram</span>
      </div>

      <h1 className="login-title">Kavram Paneli</h1>
      <p className="login-subtitle">
        Devam etmek için yönetici şifreni gir.
      </p>

      <form className="login-form" onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor={`${rawId}-password`}>Yönetici şifresi</label>
          <input
            ref={passwordRef}
            id={`${rawId}-password`}
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${rawId}-password-error` : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id={`${rawId}-password-error`} className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>

      <p className="login-footnote">
        Bu panel yalnızca yetkili yöneticiler içindir.
      </p>
    </div>
  );
}
