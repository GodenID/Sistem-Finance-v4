import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Shield, AlertTriangle, CheckCircle, Loader2, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMaintenanceMode, setMaintenanceMode } from '../lib/api';

const Maintenance = () => {
  const navigate = useNavigate();
  const { userName, userRole, userId } = useAuth();
  const { showToast } = useToast();
  const [isMaintenanceOn, setIsMaintenanceOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const isAdmin = userRole?.toLowerCase() === 'administrator';

  useEffect(() => {
    fetchMaintenanceStatus();
  }, []);

  const fetchMaintenanceStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getMaintenanceMode();
      setIsMaintenanceOn(status);
    } catch (error) {
      console.error('Error fetching maintenance status:', error);
      showToast('Gagal memuat status maintenance', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleClick = () => {
    const newState = !isMaintenanceOn;
    setPendingAction(newState);
    setShowConfirm(true);
  };

  const handleConfirmToggle = async () => {
    if (pendingAction === null) return;

    try {
      setIsToggling(true);
      await setMaintenanceMode(pendingAction, userId);
      setIsMaintenanceOn(pendingAction);
      showToast(
        pendingAction
          ? 'Maintenance mode diaktifkan. Semua user non-admin tidak dapat mengakses sistem.'
          : 'Maintenance mode dinonaktifkan. Sistem kembali normal.',
        'success'
      );
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      showToast('Gagal mengubah status maintenance', 'error');
    } finally {
      setIsToggling(false);
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Mode</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola mode pemeliharaan sistem</p>
        </div>
      </div>

      {/* Status Card */}
      <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-500 ${
        isMaintenanceOn
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
          : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
      }`}>
        {/* Background decoration */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 transition-all duration-500 ${
          isMaintenanceOn ? 'bg-amber-400' : 'bg-emerald-400'
        }`} />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
              isMaintenanceOn
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/25'
            }`}>
              {isMaintenanceOn ? (
                <Wrench className="w-8 h-8 text-white" />
              ) : (
                <CheckCircle className="w-8 h-8 text-white" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {isMaintenanceOn ? 'Maintenance Mode Aktif' : 'Sistem Berjalan Normal'}
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isMaintenanceOn
                    ? 'bg-amber-200 text-amber-800'
                    : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {isMaintenanceOn ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                {isMaintenanceOn
                  ? 'Sistem sedang dalam mode maintenance. Semua user selain administrator tidak dapat mengakses sistem.'
                  : 'Sistem berjalan normal. Semua user dapat mengakses sistem dengan biasa.'
                }
              </p>
            </div>

            {/* Toggle Button */}
            <button
              onClick={handleToggleClick}
              disabled={isToggling}
              className={`relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 ${
                isMaintenanceOn
                  ? 'bg-amber-500 focus:ring-amber-300'
                  : 'bg-gray-300 focus:ring-gray-200'
              } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                isMaintenanceOn ? 'left-9' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Warning Card */}
      {isMaintenanceOn && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Perhatian</p>
              <p className="text-sm text-amber-700 mt-1">
                Mode maintenance sedang aktif. Semua user selain <strong>administrator</strong> akan melihat halaman maintenance dan tidak dapat mengakses sistem. Pastikan untuk menonaktifkan mode ini setelah pemeliharaan selesai.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Siapa yang bisa akses?</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Administrator (selalu bisa akses)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 ${isMaintenanceOn ? 'border-red-400 bg-red-50' : 'border-emerald-400 bg-emerald-50'}`} />
              <span>Semua role lain {isMaintenanceOn ? '(diblokir)' : '(bisa akses)'}</span>
            </li>
          </ul>
        </div>

        <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Power className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Kapan digunakan?</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">-</span>
              <span>Ketika melakukan update sistem</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">-</span>
              <span>Ketika ada perbaikan bug kritis</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">-</span>
              <span>Ketika migrasi database</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                pendingAction
                  ? 'bg-amber-100'
                  : 'bg-emerald-100'
              }`}>
                {pendingAction ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {pendingAction ? 'Aktifkan Maintenance?' : 'Nonaktifkan Maintenance?'}
                </h3>
                <p className="text-sm text-gray-500">
                  {pendingAction
                    ? 'Semua user non-admin akan diblokir'
                    : 'Sistem akan kembali normal'}
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-lg mb-6 text-sm ${
              pendingAction
                ? 'bg-amber-50 text-amber-800'
                : 'bg-emerald-50 text-emerald-800'
            }`}>
              {pendingAction
                ? 'User dengan role team_finance, bod, hrd, staff, manager, dan guest tidak akan bisa mengakses sistem.'
                : 'Semua user akan bisa mengakses sistem kembali seperti biasa.'}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPendingAction(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmToggle}
                disabled={isToggling}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                  pendingAction
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isToggling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  pendingAction ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default Maintenance;
