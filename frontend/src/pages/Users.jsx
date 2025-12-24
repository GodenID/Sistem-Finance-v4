import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  Search,
  User,
  Shield,
  Eye,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAllRecords } from '../lib/api';

const Users = () => {
  const navigate = useNavigate();
  const { userId: currentUserId } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords('users');
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Gagal memuat daftar user', 'error');
    } finally {
      setIsLoading(false);
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

  const handleViewProfile = (user) => {
    // BOD profiles are private - cannot be viewed by others
    if (user.role === 'bod' && user.id !== currentUserId) {
      showToast('Profil BOD tidak dapat dilihat', 'warning');
      return;
    }
    navigate(`/profile/${user.id}`);
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search)
    );
  });

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-primary-600" />
            Daftar Pengguna
          </h1>
          <p className="text-sm text-gray-600 mt-1">Lihat profil pengguna lain</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, username, atau role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredUsers.map((user) => {
          const roleBadge = getRoleBadge(user.role);
          const isBOD = user.role === 'bod';
          const isCurrentUser = user.id === currentUserId;
          const canView = !isBOD || isCurrentUser;

          return (
            <div
              key={user.id}
              className={`card hover:shadow-lg transition-all duration-200 ${isCurrentUser ? 'ring-2 ring-primary-500' : ''
                } ${!canView ? 'opacity-75' : ''}`}
            >
              <div className="text-center">
                {/* Avatar */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isBOD && !isCurrentUser
                    ? 'bg-gray-200'
                    : 'bg-gradient-to-br from-primary-500 to-primary-600'
                  }`}>
                  {isBOD && !isCurrentUser ? (
                    <Lock className="w-6 h-6 text-gray-400" />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-semibold text-gray-800">
                  {isBOD && !isCurrentUser ? '••••••••' : user.name}
                  {isCurrentUser && (
                    <span className="text-xs text-primary-600 ml-1">(Anda)</span>
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  @{isBOD && !isCurrentUser ? '••••••' : user.username}
                </p>

                {/* Role Badge */}
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleBadge.bg} ${roleBadge.text}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {roleBadge.label}
                  </span>
                </div>

                {/* View Button */}
                <button
                  onClick={() => handleViewProfile(user)}
                  disabled={!canView}
                  className={`mt-4 w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${canView
                      ? 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {canView ? (
                    <>
                      <Eye className="w-4 h-4" />
                      Lihat Profil
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Profil Privat
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="card py-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Tidak ada pengguna ditemukan</p>
        </div>
      )}
    </div>
  );
};

export default Users;
