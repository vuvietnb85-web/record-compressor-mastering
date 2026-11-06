import { useEffect } from "react";

declare global {
  interface Window {
    __VXO_BINANCE_REF__?: Record<string, unknown>;
    __VXO_BN_LOADED__?: boolean;
  }
}

/** Drop-in Binance Earn Together referral FAB (owner referral link only). */
export function VxoBinanceRef() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__VXO_BN_LOADED__) return;
    window.__VXO_BN_LOADED__ = true;
    window.__VXO_BINANCE_REF__ = {
      mount: "fab",
      theme: "dark",
      locale: "vi",
      utmCampaign: "record-compressor",
      fabPosition: "bottom-left",
      fabLabel: "Earn · Binance",
    };
    if (!document.querySelector('link[data-vxo-bn="1"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/vxo-ref/vxo-binance-ref.css";
      link.setAttribute("data-vxo-bn", "1");
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-vxo-bn="1"]')) {
      const s = document.createElement("script");
      s.src = "/vxo-ref/vxo-binance-ref.js";
      s.defer = true;
      s.setAttribute("data-vxo-bn", "1");
      document.body.appendChild(s);
    }
  }, []);
  return null;
}
