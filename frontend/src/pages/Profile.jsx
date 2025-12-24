import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Lock,
  Save,
  Eye,
  EyeOff,
  Shield,
  Activity,
  FileText,
  Wallet,
  CreditCard,
  CheckCircle,
  AlertCircle,
  UserX
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRecordById, updateRecord, getAllRecords } from '../lib/api';

const Profile = () => {
  const navigate = useNavigate();
  const { id: profileId } = useParams(); // Get user ID from URL if viewing other's profile
  const { userName, userRole, userId, login } = useAuth();
  const { showToast } = useToast();

  // Determine if viewing own profile or someone else's
  const targetUserId = profileId || userId;
  const isOwnProfile = !profileId || profileId === userId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [accessDenied, setAccessDenied] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    username: ''
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    paymentRequests: 0,
    kasbon: 0,
    klaim: 0,
    penyelesaian: 0,
    totalActivities: 0
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!targetUserId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setAccessDenied(false);

        // Fetch target user data
        const user = await getRecordById('users', targetUserId);

        if (!user) {
          showToast('User tidak ditemukan', 'error');
          navigate('/users');
          return;
        }

        // Check if trying to view BOD profile (only BOD can view their own profile)
        if (user.role === 'bod' && !isOwnProfile) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }

        setUserData(user);

        // Only populate form if viewing own profile
        if (isOwnProfile) {
          setFormData({
            name: user.name || '',
            username: user.username || ''
          });
        }

        // Fetch statistics using specialized endpoint
        const { api } = await import('../lib/api');
        const statsResponse = await api.get(`/users/${targetUserId}/stats`);

        setStats({
          paymentRequests: statsResponse.data.paymentRequests || 0,
          kasbon: statsResponse.data.kasbon || 0,
          klaim: statsResponse.data.klaim || 0,
          penyelesaian: statsResponse.data.penyelesaian || 0,
          totalActivities: statsResponse.data.totalActivities || 0
        });

      } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('Gagal memuat data profil', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [targetUserId, isOwnProfile, showToast, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Nama tidak boleh kosong', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateRecord('users', userId, {
        name: formData.name.trim()
      });

      // Update auth context
      login({
        id: userId,
        name: formData.name.trim(),
        role: userRole
      });

      showToast('Profil berhasil diperbarui', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Gagal memperbarui profil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validations
    if (!passwordForm.currentPassword) {
      showToast('Password lama harus diisi', 'error');
      return;
    }

    if (!passwordForm.newPassword) {
      showToast('Password baru harus diisi', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Konfirmasi password tidak cocok', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Verify current password via API
      const user = await getRecordById('users', userId);

      if (user?.password !== passwordForm.currentPassword) {
        showToast('Password lama tidak benar', 'error');
        setIsSaving(false);
        return;
      }

      // Update password
      await updateRecord('users', userId, {
        password: passwordForm.newPassword
      });

      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      showToast('Password berhasil diubah', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      showToast('Gagal mengubah password', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      administrator: { bg: 'bg-red-100', text: 'text-red-700', label: 'Administrator' },
      team_finance: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Team Finance' },
      bod: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'BOD' },
      manager: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Manager' },
      staff: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Staff' },
      guest: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Guest' }
    };
    return badges[role] || badges.staff;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-gray-600">Memuat data...</span>
        </div>
      </div>
    );
  }

  // Access denied for BOD profiles
  if (accessDenied) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Akses Ditolak</h1>
        </div>

        <div className="card max-w-md mx-auto text-center py-12">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Profil Tidak Dapat Diakses</h2>
          <p className="text-gray-600 mb-6">
            Profil BOD (Board of Directors) bersifat privat dan tidak dapat dilihat oleh pengguna lain.
          </p>
          <button
            onClick={() => navigate('/users')}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Kembali ke Daftar User
          </button>
        </div>
      </div>
    );
  }

  const roleBadge = getRoleBadge(userData?.role || userRole);
  const displayName = isOwnProfile ? userName : userData?.name;
  const displayUsername = userData?.username;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(isOwnProfile ? -1 : '/users')}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isOwnProfile ? 'Profil Saya' : `Profil ${displayName}`}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isOwnProfile ? 'Kelola informasi akun Anda' : 'Lihat informasi profil pengguna'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card">
          <div className="text-center">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold text-white">
                {displayName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>

            {/* Name */}
            <h2 className="text-xl font-bold text-gray-800">
              {displayName || 'User'}
              {isOwnProfile && <span className="text-xs text-primary-600 ml-1">(Anda)</span>}
            </h2>
            <p className="text-sm text-gray-500 mt-1">@{displayUsername || 'username'}</p>

            {/* Role Badge */}
            <div className="mt-3">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${roleBadge.bg} ${roleBadge.text}`}>
                <Shield className="w-4 h-4 mr-1" />
                {roleBadge.label}
              </span>
            </div>

            {/* Join Date */}
            <p className="text-xs text-gray-400 mt-4">
              Bergabung sejak {userData?.created_at
                ? new Date(userData.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
                : '-'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'info'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Informasi
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('password')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'password'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Lock className="w-4 h-4 inline mr-2" />
                Ubah Password
              </button>
            )}
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'stats'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Statistik
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'info' && (
            <div className="card">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                {isOwnProfile ? 'Edit Informasi' : 'Informasi Pengguna'}
              </h3>
              {isOwnProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Username tidak dapat diubah</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={roleBadge.label}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Role diatur oleh Administrator</p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Simpan Perubahan</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Lengkap
                    </label>
                    <p className="text-gray-800">{displayName || '-'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username
                    </label>
                    <p className="text-gray-800">@{displayUsername || '-'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role
                    </label>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${roleBadge.bg} ${roleBadge.text}`}>
                      <Shield className="w-4 h-4 mr-1" />
                      {roleBadge.label}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bergabung Sejak
                    </label>
                    <p className="text-gray-800">
                      {userData?.created_at
                        ? new Date(userData.created_at).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                        : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'password' && (
            <div className="card">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Ubah Password</h3>

              {/* Warning */}
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 font-medium">Perhatian</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Pastikan password baru Anda mudah diingat namun sulit ditebak. Gunakan minimal 6 karakter.
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password Lama
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Masukkan password lama"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Masukkan password baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ulangi password baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Ubah Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Statistik Aktivitas</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <CreditCard className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-700">{stats.paymentRequests}</p>
                    <p className="text-xs text-blue-600">Payment Request</p>
                  </div>

                  <div className="bg-emerald-50 rounded-lg p-4 text-center">
                    <Wallet className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-700">{stats.kasbon}</p>
                    <p className="text-xs text-emerald-600">Kasbon</p>
                  </div>

                  <div className="bg-violet-50 rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-violet-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-violet-700">{stats.klaim}</p>
                    <p className="text-xs text-violet-600">Klaim</p>
                  </div>

                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-700">{stats.penyelesaian}</p>
                    <p className="text-xs text-amber-600">Penyelesaian</p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-600 font-medium">Total Aktivitas</p>
                    <p className="text-3xl font-bold text-primary-700">{stats.totalActivities}</p>
                  </div>
                  <Activity className="w-12 h-12 text-primary-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
