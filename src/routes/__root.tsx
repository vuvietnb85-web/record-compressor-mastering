import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "THU VÀNG";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "google", content: "notranslate" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Phòng thu THU VÀNG: ghi sạch, phóng thanh, quảng cáo, tách âm và trộn lời với nhạc.",
      },
      { name: "theme-color", content: "#030c18" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="vi" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <BrowserLock />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function BrowserLock() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("translate", "no");
    root.classList.add("notranslate");
    const editable = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("input, textarea"));
    const blockSelect = (event: Event) => {
      if (editable(event.target)) return;
      event.preventDefault();
    };
    const blockGesture = (event: Event) => event.preventDefault();
    const blockPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const blockWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    const blockKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
    };
    document.addEventListener("selectstart", blockSelect);
    document.addEventListener("dragstart", blockSelect);
    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    document.addEventListener("touchmove", blockPinch, { passive: false });
    document.addEventListener("wheel", blockWheel, { passive: false });
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("selectstart", blockSelect);
      document.removeEventListener("dragstart", blockSelect);
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("touchmove", blockPinch);
      document.removeEventListener("wheel", blockWheel);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);
  return null;
}
