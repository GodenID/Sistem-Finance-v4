import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Menu, LogOut, ChevronDown, Bell, CreditCard, Wallet, FileText, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';

const Header = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const { userName, userRole, logout } = useAuth();
  const { showToast } = useToast();
  const { notifications, notificationCount, isLoading, refreshNotifications, dismissNotification, isDismissable } = useNotification();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Format role untuk ditampilkan
  const getRoleDisplay = (role) => {
    const roleMap = {
      'administrator': 'Administrator',
      'team_finance': 'Team Finance',
      'bod': 'BOD',
      'manager': 'Manager',
      'staff': 'Staff',
      'guest': 'Guest'
    };
    return roleMap[role] || role;
  };

  const handleLogout = () => {
    logout();
    showToast('Berhasil logout', 'success');
    navigate('/login');
  };

  // Format rupiah
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  // Get icon berdasarkan tipe notifikasi
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_request':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'kasbon':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
      case 'klaim':
        return <FileText className="w-4 h-4 text-violet-600" />;
      case 'payment_request_transferred':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'kasbon_transferred':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'klaim_transferred':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  // Handle klik notifikasi
  const handleNotificationClick = (notification) => {
    setShowNotifications(false);
    // Dismiss transfer notifications when clicked
    if (isDismissable(notification)) {
      dismissNotification(notification);
    }
    navigate(notification.link);
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowDropdown(false);
              }}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNotifications(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-[480px] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Notifikasi</h3>
                      <p className="text-xs text-gray-500">
                        {userRole === 'team_finance'
                          ? 'Transaksi menunggu transfer'
                          : userRole === 'administrator' || userRole === 'bod' || userRole === 'manager'
                            ? 'Approval & Transfer terbaru'
                            : 'Transfer terbaru'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshNotifications();
                      }}
                      className={`p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${isLoading ? 'animate-spin' : ''}`}
                      disabled={isLoading}
                    >
                      <RefreshCw className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Tidak ada notifikasi</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={`${notif.type}-${notif.id}`}
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left flex items-start space-x-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{notif.title}</p>
                            <p className="text-xs text-gray-600 truncate">{notif.message}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-semibold text-primary-600">
                                Rp {formatRupiah(notif.nominal)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notificationCount > 20 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <p className="text-xs text-gray-500 text-center">
                        Menampilkan 20 dari {notificationCount} notifikasi
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-3 hover:bg-gray-100 rounded-lg p-2 transition-colors"
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-gray-700">{userName || 'Admin Prasasti'}</p>
                <p className="text-xs text-gray-500">{getRoleDisplay(userRole)}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{userName || 'Admin Prasasti'}</p>
                    <p className="text-xs text-gray-500">{getRoleDisplay(userRole)}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-rose-50 transition-colors text-left group mt-1"
                  >
                    <LogOut className="w-4 h-4 text-gray-600 group-hover:text-rose-600" />
                    <span className="text-sm text-gray-700 group-hover:text-rose-600 font-medium">Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

