import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Zap,
  Bug,
  Trash2,
  Calendar,
  Tag,
  Plus,
  X,
  Save
} from 'lucide-react';
import { getAllRecords, createRecord } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { changelog as fallbackChangelog, getChangeTypeConfig } from '../data/changelog';

const Changelog = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = userRole === 'administrator';

  const [changelog, setChangelog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    version: '',
    change_type: 'new',
    description: ''
  });

  // Fetch changelog from database
  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords('changelog');

      if (data && data.length > 0) {
        // Group by version
        const grouped = data.reduce((acc, item) => {
          const version = item.version;
          if (!acc[version]) {
            acc[version] = {
              version,
              date: item.date,
              changes: [],
              isNew: false
            };
          }
          acc[version].changes.push({
            type: item.change_type,
            text: item.description
          });
          return acc;
        }, {});

        // Convert to array and sort by version descending
        const sortedChangelog = Object.values(grouped).sort((a, b) => {
          const vA = a.version.split('.').map(Number);
          const vB = b.version.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if (vA[i] !== vB[i]) return vB[i] - vA[i];
          }
          return 0;
        });

        // Mark first one as new
        if (sortedChangelog.length > 0) {
          sortedChangelog[0].isNew = true;
        }

        setChangelog(sortedChangelog);
      } else {
        // Use fallback data if database is empty
        setChangelog(fallbackChangelog);
      }
    } catch (error) {
      console.error('Error fetching changelog:', error);
      // Use fallback data on error
      setChangelog(fallbackChangelog);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChange = async (e) => {
    e.preventDefault();
    if (!formData.version || !formData.description) {
      showToast('Mohon lengkapi semua field', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await createRecord('changelog', {
        version: formData.version,
        change_type: formData.change_type,
        description: formData.description,
        date: new Date().toISOString().split('T')[0]
      });

      showToast('Changelog berhasil ditambahkan', 'success');
      setShowAddModal(false);
      setFormData({ version: '', change_type: 'new', description: '' });
      fetchChangelog();
    } catch (error) {
      console.error('Error adding changelog:', error);
      showToast('Gagal menambahkan changelog', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'new':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'improved':
        return <Zap className="w-3.5 h-3.5" />;
      case 'fix':
        return <Bug className="w-3.5 h-3.5" />;
      case 'removed':
        return <Trash2 className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const currentVersion = changelog.length > 0 ? changelog[0].version : '1.0.0';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Changelog</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Riwayat update aplikasi</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm font-medium"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Tambah</span>
                </button>
              )}
              <div className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary-100 text-primary-700 rounded-full">
                <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm font-semibold">v{currentVersion}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="space-y-4 sm:space-y-6">
              {changelog.map((release, index) => (
                <div key={release.version} className="relative">
                  {/* Timeline line - hidden on mobile */}
                  {index < changelog.length - 1 && (
                    <div className="hidden sm:block absolute left-6 top-14 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  {/* Version card */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Version header */}
                    <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${release.isNew ? 'bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${release.isNew ? 'bg-primary-500' : 'bg-gray-400'}`}>
                            <span className="text-white font-bold text-xs sm:text-sm">
                              {release.version.split('.')[0]}.{release.version.split('.')[1]}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                                v{release.version}
                              </h2>
                              {release.isNew && (
                                <span className="px-1.5 sm:px-2 py-0.5 bg-primary-500 text-white text-[10px] sm:text-xs font-bold rounded-full animate-pulse">
                                  NEW
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-xs sm:text-sm text-gray-500">
                              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>{formatDate(release.date)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <span className="text-sm text-gray-500">
                            {release.changes.length} perubahan
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Changes list */}
                    <div className="p-4 sm:p-6">
                      <ul className="space-y-2 sm:space-y-3">
                        {release.changes.map((change, changeIndex) => {
                          const config = getChangeTypeConfig(change.type);
                          return (
                            <li key={changeIndex} className="flex items-start space-x-2 sm:space-x-3">
                              <span className={`inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold ${config.bgColor} ${config.textColor} flex-shrink-0`}>
                                {getIcon(change.type)}
                                <span className="hidden sm:inline">{config.label}</span>
                              </span>
                              <span className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                                {change.text}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-xs sm:text-sm text-gray-500">
                Finance Prasasti Group &copy; {new Date().getFullYear()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Tambah Changelog</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddChange} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="Contoh: 1.6.0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipe Perubahan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.change_type}
                  onChange={(e) => setFormData({ ...formData, change_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="new">NEW - Fitur Baru</option>
                  <option value="improved">IMPROVED - Peningkatan</option>
                  <option value="fix">FIX - Perbaikan Bug</option>
                  <option value="removed">REMOVED - Dihapus</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Jelaskan perubahan yang dilakukan..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Changelog;
