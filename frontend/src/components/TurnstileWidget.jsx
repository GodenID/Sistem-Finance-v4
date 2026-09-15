import React, { useEffect, useRef } from 'react';
import { SITEKEY } from '../lib/turnstile';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * TurnstileWidget — pembungkus React untuk widget Cloudflare Turnstile.
 * Wajib menyertakan data-action="turnstile-spin-v1" (telemetri Spin).
 *
 * @param {(token: string) => void} onSuccess
 * @param {() => void} [onFail]
 * @param {'light'|'dark'|'auto'} [theme='light']
 */
const TurnstileWidget = ({ onSuccess, onFail, theme = 'light' }) => {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!SITEKEY) return undefined;

    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        // Render eksplisit agar bisa di-reset
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITEKEY,
          action: 'turnstile-spin-v1',
          theme,
          callback: (token) => onSuccess && onSuccess(token),
          'error-callback': () => onFail && onFail(),
          'expired-callback': () => onFail && onFail(),
        });
      })
      .catch(() => onFail && onFail());

    return () => {
      cancelled = true;
      try {
        if (widgetId.current !== null && window.turnstile) {
          window.turnstile.remove(widgetId.current);
          widgetId.current = null;
        }
      } catch {
        /* abaikan */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SITEKEY]);

  if (!SITEKEY) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        VITE_TURNSTILE_SITEKEY belum diset. Isi sitekey dari Cloudflare dashboard untuk mengaktifkan verifikasi.
      </div>
    );
  }

  return (
    <div>
      <div ref={ref} className="cf-turnstile" data-sitekey={SITEKEY} data-action="turnstile-spin-v1" data-theme={theme} />
    </div>
  );
};

export default TurnstileWidget;
