import React, { useState, useEffect } from 'react';
import { PM_API_PROJECTS, PM_PROJECT_URL, QL_REGEX } from '../constants/pmConstants';

/**
 * Cache sesi: QL (uppercase) -> project id Supabase | null (tidak dikenal).
 * Mencegah request berulang untuk QL yang sama di tabel/detail.
 */
const qlIdCache = new Map();
const inflight = new Map();

const normalizeQL = (ql) => (ql || '').trim().toUpperCase();

/**
 * Resolve nomor QL menjadi Supabase project id (untuk deep-link).
 * @returns {Promise<string|null>} id project atau null bila tak dikenal/gagal
 */
export const resolveProjectId = (ql) => {
  const key = normalizeQL(ql);
  if (!key || !QL_REGEX.test(key)) return Promise.resolve(null);
  if (qlIdCache.has(key)) return Promise.resolve(qlIdCache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const res = await fetch(`${PM_API_PROJECTS}?ql=${encodeURIComponent(key)}`, { method: 'GET' });
      if (!res.ok) return null;
      const json = await res.json();
      const project = json?.data?.[key] || Object.values(json?.data || {})[0] || null;
      return project?.id || null;
    } catch {
      return null;
    }
  })().then((id) => {
    qlIdCache.set(key, id);
    inflight.delete(key);
    return id;
  });

  inflight.set(key, p);
  return p;
};

/**
 * QLLink — teks Nomor QL yang otomatis menjadi link ke project di sistem
 * Project Management bila QL dikenal (target tab baru).
 * Bila kosong / format salah / tak dikenal / gagal: tampil teks biasa.
 *
 * @param {string} ql - nomor QL (mis. PSQL-0080)
 * @param {string} className - class untuk teks/link
 * @param {string} linkClassName - class tambahan khusus saat jadi link
 * @param {boolean} hidden - bila true (data confidential) tampil samaran, tanpa link
 */
const QLLink = ({ ql, className = '', linkClassName = '', hidden = false }) => {
  const key = normalizeQL(ql);
  const [projectId, setProjectId] = useState(() => (qlIdCache.has(key) ? qlIdCache.get(key) : undefined));

  useEffect(() => {
    let cancelled = false;
    if (!key || hidden) return;
    if (qlIdCache.has(key)) {
      setProjectId(qlIdCache.get(key));
      return;
    }
    resolveProjectId(key).then((id) => {
      if (!cancelled) setProjectId(id);
    });
    return () => { cancelled = true; };
  }, [key, hidden]);

  if (!ql) return <span className={className}>-</span>;
  if (hidden) return <span className={className}>***</span>;

  if (projectId) {
    return (
      <a
        href={`${PM_PROJECT_URL}/${projectId}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Buka project di sistem Project Management"
        className={`${className} hover:underline cursor-pointer ${linkClassName}`.trim()}
      >
        {ql}
      </a>
    );
  }

  return <span className={className}>{ql}</span>;
};

export default QLLink;
