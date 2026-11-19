"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "./toast";
import {
  ChartIcon,
  GridIcon,
  LogOutIcon,
} from "./icons";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Koleksiyonlar",
    icon: GridIcon,
    isActive: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/koleksiyonlar"),
  },
  {
    href: "/istatistikler",
    label: "İstatistikler",
    icon: ChartIcon,
    isActive: (pathname: string) => pathname.startsWith("/istatistikler"),
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Çıkış yapılamadı.",
        "error",
      );
      setSigningOut(false);
    }
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand" aria-label="Kavram panel ana sayfası">
        <span className="brand-mark" aria-hidden="true">
          K
        </span>
        <span className="brand-copy">
          <span className="brand-name">Kavram</span>
          <span className="brand-subtitle">Headless CMS</span>
        </span>
      </Link>

      <nav className="sidebar-nav" aria-label="Ana menü">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-link nav-button"
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          <LogOutIcon />
          <span>{signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}</span>
        </button>
      </div>
    </aside>
  );
}
