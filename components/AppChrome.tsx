"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BackButton from "@/components/BackButton";
import SettingsMenu from "@/components/SettingsMenu";
import ThemeToggle from "@/components/ThemeToggle";

// Routes that render full-bleed with NO app header/footer (public marketing/auth pages).
const BARE_ROUTES = ["/", "/install", "/login", "/forgot-password", "/reset-password", "/accept-invite"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const bare = BARE_ROUTES.includes(pathname);

  if (bare) {
    // Landing / auth pages: no chrome, full width.
    return <>{children}</>;
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          className="container header-wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            padding: "12px 16px",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div style={{ justifySelf: "start" }}>
            <BackButton className="btn" label="Back" fallback="/customers" />
          </div>
          <Link
            href="/home"
            className="header-logo"
            style={{ justifySelf: "center", display: "inline-flex", alignItems: "center" }}
          >
            <span
              className="brand-wordmark"
              style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}
            >
              Field<span style={{ color: "var(--pink, #e6007e)" }}>CRM</span>
            </span>
          </Link>
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid #eee", padding: "16px 0" }}>
        <div className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
          <small>© FieldCRM</small>
        </div>
      </footer>
    </>
  );
}
