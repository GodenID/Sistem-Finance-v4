import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { PM_API_PROJECTS, PM_PROJECT_URL, QL_REGEX, PM_STAGE_LABELS } from '../constants/pmConstants';

/**
 * QLInfo — indikator live di bawah input Nomor QL.
 * Mengecek nomor QL ke sistem Project Management (debounce 600ms):
 *  - kosong        -> tidak tampil apa-apa
 *  - format salah  -> peringatan format (merah)
 *  - memeriksa     -> spinner "Memeriksa ke sistem Project Management..."
 *  - ditemukan     -> kotak hijau: nama project, perusahaan, tahap, lokasi
 *  - tidak ada     -> "Nomor QL ... tidak ditemukan di sistem Project Management"
 *  - gagal konek   -> "Gagal terhubung ke sistem Project Management. Coba lagi nanti."
 */
const QLInfo = ({ value }) => {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const timerRef = useRef(null);
  const reqIdRef = useRef(0);

  const ql = (value || '').trim().toUpperCase();

  useEffect(() => {
    clearTimeout(timerRef.current);
    const reqId = ++reqIdRef.current;

    if (!ql) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }

    if (!QL_REGEX.test(ql)) {
      setState({ status: 'invalid', data: null, error: 'Format nomor QL tidak lengkap. Contoh: PSQL-0080' });
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading' }));

    timerRef.current = setTimeout(async () => {
      try {
        // Endpoint projects mengembalikan data keyed by QL + id Supabase
        // untuk deep-link: { success: true, data: { "PSQL-0080": { id, name, ... } } }
        // QL tidak dikenal: { success: true, data: {} }
        const res = await fetch(`${PM_API_PROJECTS}?ql=${encodeURIComponent(ql)}`, { method: 'GET' });
        if (reqIdRef.current !== reqId) return; // respons basi, abaikan

        if (res.ok) {
          const json = await res.json();
          const project = json?.data?.[ql] || Object.values(json?.data || {})[0] || null;
          if (project) {
            setState({ status: 'found', data: project, error: null });
          } else {
            setState({ status: 'not-found', data: null, error: `Nomor QL ${ql} tidak ditemukan di sistem Project Management` });
          }
        } else {
          setState({ status: 'error', data: null, error: 'Gagal terhubung ke sistem Project Management. Coba lagi nanti.' });
        }
      } catch {
        if (reqIdRef.current !== reqId) return;
        setState({ status: 'error', data: null, error: 'Gagal terhubung ke sistem Project Management. Coba lagi nanti.' });
      }
    }, 600);

    return () => clearTimeout(timerRef.current);
  }, [ql]);

  if (state.status === 'loading') {
    return (
      <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memeriksa ke sistem Project Management...
      </p>
    );
  }

  if (state.status === 'found' && state.data) {
    const d = state.data;
    const projectHref = d.id ? `${PM_PROJECT_URL}/${d.id}` : null;
    return (
      <div className="mt-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
        <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung ke Project Management
        </p>
        {projectHref ? (
          <a
            href={projectHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka project di sistem Project Management"
            className="text-sm font-medium text-emerald-900 hover:text-emerald-600 hover:underline inline-flex items-center gap-1"
          >
            {d.name || '-'}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <p className="text-sm font-medium text-emerald-900">{d.name || '-'}</p>
        )}
        <p className="text-xs text-emerald-700">
          {d.company_name || '-'} · {PM_STAGE_LABELS[d.status] || d.status_label || d.status || '-'}{d.lokasi ? ` · ${d.lokasi}` : ''}
        </p>
      </div>
    );
  }

  if (state.status === 'not-found' || state.status === 'invalid') {
    return (
      <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
        <XCircle className="w-3.5 h-3.5" /> {state.error}
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> {state.error}
      </p>
    );
  }

  return null;
};

export default QLInfo;
