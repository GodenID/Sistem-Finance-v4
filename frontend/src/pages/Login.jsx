import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Eye, EyeOff, Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAppVersion } from '../lib/version';
import { getMaintenanceMode } from '../lib/api';
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  formatRetry,
} from '../lib/guard';

const Login = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const { showToast } = useToast();
  const appVersion = useAppVersion();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Rate-limit client-side (anti-bruteforce) — proteksi bot utama kini via
  // Turnstile gate kunjungan (SiteGate), bukan captcha di form.
  const [lockInfo, setLockInfo] = useState({ allowed: true, retryAfterSec: 0, remaining: 5 });

  // Countdown timer saat akun terkunci (rate-limit)
  useEffect(() => {
    if (lockInfo.allowed) return;
    const t = setInterval(() => {
      setLockInfo(checkLoginAllowed(formData.username));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockInfo.allowed, formData.username]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error saat user mulai mengetik
    if (name === 'username') {
      setLockInfo(checkLoginAllowed(value));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Rate-limit client-side: tolak percobaan saat terkunci
    const allowed = checkLoginAllowed(formData.username);
    setLockInfo(allowed);
    if (!allowed.allowed) {
      const msg = `Terlalu banyak percobaan gagal. Coba lagi dalam ${formatRetry(allowed.retryAfterSec)}.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Login menggunakan API backend (proteksi bot via SiteGate Turnstile)
      const result = await login({
        username: formData.username,
        password: formData.password,
      });
      recordLoginSuccess(formData.username);

      // Cek maintenance mode setelah login
      const isMaintenance = await getMaintenanceMode();
      const userRole = result.user?.role || localStorage.getItem('userRole');

      if (isMaintenance && userRole?.toLowerCase() !== 'administrator') {
        // Logout user non-admin saat maintenance
        await logout();
        setError('Sistem sedang dalam mode maintenance. Silakan coba lagi nanti.');
        showToast('Sistem sedang maintenance', 'error');
        return;
      }

      showToast('Login berhasil', 'success');
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      const afterFail = recordLoginFailure(formData.username);
      setLockInfo(afterFail);
      const errorMessage = err.response?.data?.error || err.error || err.message || 'Terjadi kesalahan saat login. Silakan coba lagi.';
      const suffix = !afterFail.allowed
        ? ` Coba lagi dalam ${formatRetry(afterFail.retryAfterSec)}.`
        : afterFail.remaining <= 2
          ? ` Sisa percobaan: ${afterFail.remaining}x sebelum terkunci sementara.`
          : '';
      setError(errorMessage + suffix);
      showToast(errorMessage + suffix, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-300 rounded-full opacity-20 blur-3xl"></div>
      </div>

      {/* Login Container */}
      <div className="relative w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                <Wallet className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Finance
            </h1>
            <p className="text-lg sm:text-xl font-semibold text-primary-100 mb-3">
              Prasasti Group
            </p>
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="px-3 py-1.5 text-xs font-bold bg-white text-primary-600 rounded-lg shadow-sm">
                v{appVersion}
              </span>
            </div>
            <p className="text-primary-100 text-xs sm:text-sm">Sistem Manajemen Keuangan Terintegrasi</p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Selamat Datang Kembali!</h2>
              <p className="text-gray-600 text-sm">Silakan login untuk melanjutkan</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 flex items-center space-x-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Lockout Alert (rate-limit anti-bruteforce) */}
            {!lockInfo.allowed && (
              <div className="mb-6 flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <Lock className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  Terlalu banyak percobaan gagal. Coba lagi dalam {formatRetry(lockInfo.retryAfterSec)}.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Masukkan username Anda"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-11 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Ingat saya</span>
                </label>
                <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                  Lupa password?
                </Link>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading || !lockInfo.allowed}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-lg font-semibold hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <LogIn className="w-5 h-5" />
                    <span>Login Sekarang</span>
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6">
          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              © 2025 Prasasti Group
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
