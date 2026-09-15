import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { resetPassword, isBackendAuthEnabled } from '../lib/api';

/** No.8: Eksekusi reset password dengan token sekali pakai dari email. */
const ResetPassword = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Tautan reset tidak valid. Minta tautan baru lewat halaman lupa password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(token, newPassword);
      setDone(true);
      showToast(res.message || 'Password berhasil direset', 'success');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Gagal mereset password.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = 'w-full pl-11 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200';

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
            <h1 className="text-2xl font-bold text-white mb-1">Buat Password Baru</h1>
            <p className="text-primary-100 text-xs sm:text-sm">Tautan hanya berlaku 1 jam & sekali pakai</p>
          </div>

          <div className="px-8 py-8">
            {done ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-gray-700 text-sm">Password berhasil direset. Mengalihkan ke login...</p>
              </div>
            ) : (
              <>
                {!isBackendAuthEnabled() && (
                  <div className="mb-6 flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">Fitur ini membutuhkan backend. Hubungi administrator.</span>
                  </div>
                )}
                {error && (
                  <div className="mb-6 flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {[
                    { label: 'Password Baru', value: newPassword, set: setNewPassword, ph: 'Minimal 8 karakter' },
                    { label: 'Konfirmasi Password Baru', value: confirmPassword, set: setConfirmPassword, ph: 'Ulangi password baru' },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{f.label}</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          {f.label === 'Password Baru'
                            ? <Lock className="h-5 w-5 text-gray-400" />
                            : <KeyRound className="h-5 w-5 text-gray-400" />}
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={f.value} onChange={(e) => { f.set(e.target.value); setError(''); }}
                          placeholder={f.ph} className={inputCls} required
                        />
                        <button
                          type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit" disabled={isLoading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-lg font-semibold hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                      </div>
                    ) : (
                      <span>Simpan Password Baru</span>
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

export default ResetPassword;
