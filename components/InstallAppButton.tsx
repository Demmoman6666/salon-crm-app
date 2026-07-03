"use client";

import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    // Detect if already running as an installed app
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    const ua = window.navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    if (isIOS) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");

    // Chrome/Android install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferredPrompt) {
      // Android / desktop Chrome — trigger the native install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else if (platform === "ios") {
      // iOS can't auto-install — show instructions
      setShowIosHelp((v) => !v);
    } else {
      setShowIosHelp((v) => !v);
    }
  }

  // Only show if we can actually offer something useful
  const canOffer = deferredPrompt || platform === "ios";
  if (!canOffer) return null;

  return (
    <section className="card">
      <h2 style={{ marginBottom: 4 }}>Install FieldCRM</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Add FieldCRM to your home screen for quick, full-screen access — like a native app.
      </p>
      <button className="primary" onClick={handleClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Add to Home Screen
      </button>

      {showIosHelp && platform === "ios" && (
        <div className="small" style={{ marginTop: 14, padding: 14, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", lineHeight: 1.7 }}>
          <strong>On iPhone / iPad:</strong>
          <ol style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
            <li>Tap the <strong>Share</strong> button (the square with an arrow) at the bottom of Safari.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong> in the top corner.</li>
          </ol>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Note: this only works in Safari, not other browsers on iOS.
          </p>
        </div>
      )}
    </section>
  );
}
