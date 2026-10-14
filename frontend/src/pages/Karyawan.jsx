import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, X, Eye, EyeOff, Edit2, ShieldCheck, RotateCcw } from 'lucide-react';
import { getAllRecords, createRecord, updateRecord, deleteRecord } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_GROUPS, getEffectivePermissions, hasCustomPermissions } from '../lib/permissions';

const Karyawan = () => {
  const { userId: currentUserId, login, logout } = useAuth();
  const [karyawan, setKaryawan] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKaryawan, setEditingKaryawan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    role: 'staff',
    email_notifications_enabled: true,
    status: 'active'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    role: 'staff',
    email_notifications_enabled: true,
    status: 'active'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State kelola permission per-user (Administrator)
  const [showPermModal, setShowPermModal] = useState(false);
  const [permUser, setPermUser] = useState(null);
  const [permForm, setPermForm] = useState({});
  const [permSaving, setPermSaving] = useState(false);

  // Fetch karyawan dari Supabase
  const fetchKaryawan = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords('users');
      setKaryawan(data);
    } catch (err) {
      console.error('Error fetching karyawan:', err);
      setError('Gagal memuat data karyawan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKaryawan();
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const resetCreateForm = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      email: '',
      role: 'staff',
      email_notifications_enabled: true,
      status: 'active'
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      name: '',
      username: '',
      password: '',
      email: '',
      role: 'staff',
      email_notifications_enabled: true,
      status: 'active'
    });
  };

  const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // Handle edit karyawan
  const handleEdit = (karyawan) => {
    setEditingKaryawan(karyawan);
    setEditFormData({
      name: karyawan.name,
      username: karyawan.username,
      password: '', // Kosongkan password, user bisa mengisi jika ingin mengubah
      email: karyawan.email || '',
      role: karyawan.role,
      email_notifications_enabled: karyawan.email_notifications_enabled !== false,
      status: karyawan.status || 'active'
    });
    setShowEditModal(true);
    setError('');
  };

  // Handle submit edit form
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validasi
    if (!editFormData.name.trim() || !editFormData.username.trim()) {
      setError('Nama dan username harus diisi');
      return;
    }

    // Check username sudah ada (kecuali untuk user yang sedang diedit)
    const existingUser = karyawan.find(k =>
      k.username.toLowerCase() === editFormData.username.toLowerCase() &&
      k.id !== editingKaryawan.id
    );
    if (existingUser) {
      setError('Username sudah digunakan');
      return;
    }

    // Jika password diisi, validasi panjang
    if (editFormData.password && editFormData.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    const editEmail = editFormData.email.trim().toLowerCase();
    if (!isValidEmail(editEmail)) {
      setError('Format email tidak valid');
      return;
    }

    try {
      const updateData = {
        name: editFormData.name.trim(),
        username: editFormData.username.trim().toLowerCase(),
        email: editEmail || null,
        role: editFormData.role,
        email_notifications_enabled: editFormData.email_notifications_enabled,
        status: editFormData.status
      };

      // Hanya update password jika diisi
      if (editFormData.password.trim()) {
        updateData.password = editFormData.password;
      }

      await updateRecord('users', editingKaryawan.id, updateData);

      if (editingKaryawan.id === currentUserId) {
        if (updateData.status === 'suspended') {
          await logout();
          return;
        }

        login({
          id: editingKaryawan.id,
          name: updateData.name,
          role: updateData.role,
          email: updateData.email || '',
          status: updateData.status,
          email_notifications_enabled: updateData.email_notifications_enabled
        });
      }

      setSuccess('Karyawan berhasil diperbarui');
      setShowEditModal(false);
      setEditingKaryawan(null);
      resetEditForm();
      fetchKaryawan(); // Refresh list

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err.message || 'Gagal memperbarui karyawan');
    }
  };

  // Handle submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validasi
    if (!formData.name.trim() || !formData.username.trim() || !formData.password.trim()) {
      setError('Semua field harus diisi');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    const email = formData.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setError('Format email tidak valid');
      return;
    }

    // Check username sudah ada
    const existingUser = karyawan.find(k => k.username.toLowerCase() === formData.username.toLowerCase());
    if (existingUser) {
      setError('Username sudah digunakan');
      return;
    }

    try {
      // Simpan password langsung ke database
      // Catatan: Untuk keamanan lebih baik, pertimbangkan menggunakan Supabase Auth
      // atau hash password menggunakan bcrypt sebelum disimpan
      const newUser = {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        email: email || null,
        role: formData.role,
        email_notifications_enabled: formData.email_notifications_enabled,
        status: formData.status
      };

      await createRecord('users', newUser);

      setSuccess('Karyawan berhasil ditambahkan');
      resetCreateForm();
      setShowModal(false);
      fetchKaryawan(); // Refresh list

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.message || 'Gagal menambahkan karyawan');
    }
  };

  // Handle delete karyawan
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus karyawan "${name}"?`)) {
      return;
    }

    try {
      await deleteRecord('users', id);
      setSuccess('Karyawan berhasil dihapus');
      fetchKaryawan(); // Refresh list

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Gagal menghapus karyawan');
    }
  };

  // Buka modal kelola permission per-user
  const handleOpenPermissions = (user) => {
    setPermUser(user);
    setPermForm({ ...getEffectivePermissions(user) });
    setShowPermModal(true);
    setError('');
  };

  const handleTogglePermission = (key) => {
    setPermForm(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Simpan permission custom per-user (override dari default role)
  const handleSavePermissions = async () => {
    if (!permUser) return;
    setPermSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateRecord('users', permUser.id, { permissions: permForm });
      setSuccess(`Permission "${permUser.name}" berhasil diperbarui`);
      setShowPermModal(false);
      setPermUser(null);
      fetchKaryawan();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating permissions:', err);
      const msg = err.message || 'Gagal memperbarui permission';
      setError(
        /permissions/i.test(msg)
          ? `${msg}. Jika kolom belum ada, jalankan migrasi: supabase/migrations/add_user_permissions.sql`
          : msg
      );
    } finally {
      setPermSaving(false);
    }
  };

  // Kembalikan ke default role (hapus override per-user)
  const handleResetPermissions = async () => {
    if (!permUser) return;
    if (!window.confirm(`Kembalikan permission "${permUser.name}" ke default role "${permUser.role}"?`)) {
      return;
    }
    setPermSaving(true);
    setError('');
    try {
      await updateRecord('users', permUser.id, { permissions: null });
      setSuccess(`Permission "${permUser.name}" dikembalikan ke default role`);
      setShowPermModal(false);
      setPermUser(null);
      fetchKaryawan();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error resetting permissions:', err);
      setError(err.message || 'Gagal mereset permission');
    } finally {
      setPermSaving(false);
    }
  };

  // Filter karyawan berdasarkan search term
  const filteredKaryawan = karyawan.filter(k => {
    const search = searchTerm.toLowerCase();
    return (
      k.name.toLowerCase().includes(search) ||
      k.username.toLowerCase().includes(search) ||
      k.email?.toLowerCase().includes(search) ||
      k.role.toLowerCase().includes(search) ||
      (k.status || 'active').toLowerCase().includes(search)
    );
  });

  // Get role badge color
  const getRoleBadge = (role) => {
    const badges = {
      'administrator': 'bg-red-100 text-red-700',
      'team_finance': 'bg-blue-100 text-blue-700',
      'head_finance': 'bg-indigo-100 text-indigo-700',
      'bod': 'bg-purple-100 text-purple-700',
      'hrd': 'bg-pink-100 text-pink-700',
      'manager': 'bg-green-100 text-green-700',
      'staff': 'bg-gray-100 text-gray-700',
      'guest': 'bg-yellow-100 text-yellow-700'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[role] || badges.staff}`}>
        {role === 'team_finance' ? 'Team Finance' :
          role === 'head_finance' ? 'Head Finance' :
          role === 'bod' ? 'BOD' :
            role === 'hrd' ? 'HRD' :
              role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const getEmailBadge = (enabled) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${enabled === false ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
      {enabled === false ? 'Nonaktif' : 'Aktif'}
    </span>
  );

  const getStatusBadge = (status) => {
    const isSuspended = status === 'suspended';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSuspended ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
        {isSuspended ? 'Suspended' : 'Active'}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-7 h-7 text-primary-600" />
              Manajemen Karyawan
            </h1>
            <p className="text-gray-600 mt-1">Kelola data karyawan dan user sistem</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Tambah Karyawan
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari karyawan berdasarkan nama, username, email, role, atau status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Memuat data karyawan...
          </div>
        ) : filteredKaryawan.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'Tidak ada karyawan yang sesuai dengan pencarian' : 'Belum ada data karyawan'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Notif</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredKaryawan.map((k, index) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{k.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{k.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{k.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getEmailBadge(k.email_notifications_enabled)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getRoleBadge(k.role)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {hasCustomPermissions(k) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                          Custom User
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Default Role
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(k.status || 'active')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(k.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(k)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenPermissions(k)}
                          className="text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                          title="Atur permission edit/hapus/akses khusus untuk user ini"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Permission
                        </button>
                        <button
                          onClick={() => handleDelete(k.id, k.name)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Karyawan */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Tambah Karyawan Baru</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetCreateForm();
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Masukkan nama lengkap"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Masukkan username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="nama@perusahaan.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="hrd">HRD</option>
                  <option value="team_finance">Team Finance</option>
                  <option value="head_finance">Head Finance</option>
                  <option value="bod">BOD</option>
                  <option value="administrator">Administrator</option>
                  <option value="guest">Guest</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status User <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Suspended hanya bisa melihat data dan tidak bisa menyimpan perubahan.</p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  name="email_notifications_enabled"
                  checked={formData.email_notifications_enabled}
                  onChange={handleInputChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">Terima email notifikasi</span>
                  <span className="block text-xs text-gray-500">Matikan agar user tidak mendapatkan email dari sistem.</span>
                </span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetCreateForm();
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Karyawan */}
      {showEditModal && editingKaryawan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Edit Karyawan</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingKaryawan(null);
                  resetEditForm();
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Masukkan nama lengkap"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={editFormData.username}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Masukkan username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Baru (kosongkan jika tidak ingin mengubah)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    name="password"
                    value={editFormData.password}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Kosongkan jika tidak ingin mengubah"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimal 6 karakter jika ingin mengubah password</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="nama@perusahaan.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={editFormData.role}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="hrd">HRD</option>
                  <option value="team_finance">Team Finance</option>
                  <option value="head_finance">Head Finance</option>
                  <option value="bod">BOD</option>
                  <option value="administrator">Administrator</option>
                  <option value="guest">Guest</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status User <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Suspended hanya bisa melihat data dan tidak bisa menyimpan perubahan.</p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  name="email_notifications_enabled"
                  checked={editFormData.email_notifications_enabled}
                  onChange={handleEditInputChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">Terima email notifikasi</span>
                  <span className="block text-xs text-gray-500">Matikan agar user tidak mendapatkan email dari sistem.</span>
                </span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingKaryawan(null);
                    resetEditForm();
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Permission per-User */}
      {showPermModal && permUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-violet-600" />
                  Permission: {permUser.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  @{permUser.username} • Role: {permUser.role} •{' '}
                  {hasCustomPermissions(permUser) ? 'Custom per-user' : 'Mengikuti default role'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPermModal(false);
                  setPermUser(null);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <p className="text-sm text-gray-600">
                Centang untuk memberi akses, hapus centang untuk mencabut — di luar default role user ini.
                Perubahan langsung berlaku saat user tersebut login ulang / refresh sesi.
              </p>

              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                    {group.label}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.permissions.map((perm) => {
                      const roleDefault = !!getEffectivePermissions({ role: permUser.role, permissions: null })[perm.key];
                      const checked = !!permForm[perm.key];
                      return (
                        <label key={perm.key} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleTogglePermission(perm.key)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="flex-1">
                            <span className="block text-sm font-medium text-gray-800">
                              {perm.label}
                              {checked !== roleDefault && (
                                <span className="ml-2 text-xs font-semibold text-violet-600">
                                  (diubah dari default role)
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-gray-500">{perm.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetPermissions}
                  disabled={permSaving}
                  className="flex items-center justify-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Hapus override dan kembalikan ke default role"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPermModal(false);
                    setPermUser(null);
                    setError('');
                  }}
                  disabled={permSaving}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={permSaving}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {permSaving ? 'Menyimpan...' : 'Simpan Permission'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Karyawan;

