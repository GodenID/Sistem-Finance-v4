import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import TurnstileWidget from './TurnstileWidget';
import { isGateVerified, markGateVerified, verifyViaWorker, isTurnstileConfigured, GATE_TTL_DAYS } from '../lib/turnstile';

/**
 * SiteGate — Gerbang kunjungan Turnstile (sekali saja, bukan per-form).
 *
 * - Saat pertama mengunjungi situs: tampilkan Turnstile full-screen.
 * - Setelah sukses (diverifikasi via Worker siteverify): simpan timestamp di
 *   localStorage selama GATE_TTL_DAYS hari — kunjungan berikutnya langsung lolos
 *   ("ga setiap ngunjungi").
 * - Login form dkk bersih tanpa captcha.
 */
const SiteGate = ({ children }) => {
  const [passed, setPassed] = useState(() => isGateVerified());
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // Belum dikonfigurasi (sitekey kosong) → fail-open agar tidak lockout
  // saat tahap setup widget/worker. Setelah env diisi, gate jadi ketat.
  if (!isTurnstileConfigured()) {
    return <>{children}</>;
  }

  if (passed) return <>{children}</>;

  const handleSuccess = async (token) => {
    setVerifying(true);
    setError('');
    const res = await verifyViaWorker(token);
    setVerifying(false);
    if (res.success) {
      markGateVerified();
      setPassed(true);
    } else {
      setError(res.error || 'Verifikasi gagal. Coba lagi.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Verifikasi Keamanan</h1>
            <p className="text-primary-100 text-xs sm:text-sm">
              Satu kali verifikasi untuk {GATE_TTL_DAYS} hari ke depan
            </p>
          </div>

          <div className="px-8 py-8 space-y-5">
            <p className="text-gray-600 text-sm text-center">
              Selesaikan verifikasi di bawah untuk melanjutkan ke aplikasi Finance Prasasti Group.
            </p>

            {error && (
              <div className="flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex justify-center">
              {verifying ? (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Memverifikasi...</span>
                </div>
              ) : (
                <TurnstileWidget onSuccess={handleSuccess} onFail={() => setError('Verifikasi gagal. Coba lagi.')} theme="light" />
              )}
            </div>

            <p className="text-xs text-gray-400 text-center">
              Protected by Cloudflare Turnstile
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 text-center mt-6">© 2025 Prasasti Group</p>
      </div>
    </div>
  );
};

export default SiteGate;
