import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, User, Send, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { forgotPassword, isBackendAuthEnabled } from '../lib/api';

/**
 * No.8: Minta tautan reset password.
 * Respons selalu generik (anti-enumerasi akun) — lihat backend forgotPassword.
 */
const ForgotPassword = () => {
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isBackendAuthEnabled()) {
      const msg = 'Fitur reset password membutuhkan backend. Hubungi administrator.';
      setError(msg);
      return;
    }
    if (!identifier.trim()) {
      setError('Isi username atau email Anda.');
      return;
    }

    setIsLoading(true);
    try {
      // Proteksi bot via SiteGate Turnstile (tanpa captcha per-form)
      const res = await forgotPassword(identifier.trim());
      setSent(true);
      showToast(res.message || 'Permintaan terkirim', 'success');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Gagal memproses permintaan.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <Wallet className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Lupa Password</h1>
            <p className="text-primary-100 text-xs sm:text-sm">Kami kirim tautan reset ke email Anda</p>
          </div>

          <div className="px-8 py-8">
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-gray-700 text-sm">
                  Jika akun terdaftar, tautan reset telah dikirim ke email.
                  Tautan berlaku 1 jam dan hanya bisa dipakai sekali.
                </p>
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700">
                  <ArrowLeft className="w-4 h-4" /> Kembali ke login
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-6 flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Username atau Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                        placeholder="Masukkan username atau email"
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit" disabled={isLoading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-lg font-semibold hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Mengirim...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Send className="w-5 h-5" />
                        <span>Kirim Tautan Reset</span>
                      </div>
                    )}
                  </button>

                  <div className="text-center">
                    <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700">
                      <ArrowLeft className="w-4 h-4" /> Kembali ke login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 text-center mt-6">© 2025 Prasasti Group</p>
      </div>
    </div>
  );
};

export default ForgotPassword;
