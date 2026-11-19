import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/server-api";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireSession();

  return (
    <>
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main" id="main-content">
          <div className="app-main-inner">{children}</div>
        </main>
      </div>
    </>
  );
}
