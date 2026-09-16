import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  CheckCircle,
  Settings,
  Wallet,
  BarChart3,
  Users,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  History,
  HardDrive,
  Activity,
  BookOpen,
  Repeat,
  Wrench,
  ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppVersion } from '../lib/version';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, hasPermission } = useAuth();
  const appVersion = useAppVersion();
  const [toolsOpen, setToolsOpen] = useState(false);

  // Tools submenu items
  const toolsItems = [
    { icon: ImageIcon, label: 'Image to PDF', path: '/tools/image-to-pdf' },
  ];

  // Permission per-user (default mengikuti role, bisa dioverride Administrator)
  const can = (key, fallbackRoles) =>
    hasPermission ? hasPermission(key) : fallbackRoles.includes(userRole);

  // Roles yang bisa akses laporan: administrator, team_finance, bod
  const canAccessLaporan = can('view_laporan', ['administrator', 'team_finance', 'bod']);

  // Hanya administrator yang bisa akses halaman Karyawan
  const canAccessKaryawan = userRole === 'administrator';

  // Semua role bisa akses Activity Log
  const canAccessActivityLog = true;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CreditCard, label: 'Payment Request', path: '/payment-request' },
    { icon: Wallet, label: 'Kasbon', path: '/kasbon' },
    { icon: FileText, label: 'Klaim', path: '/klaim' },
    { icon: CheckCircle, label: 'Penyelesaian', path: '/penyelesaian' },
    { icon: Settings, label: 'Vendor', path: '/vendor' },
  ];

  // Tambahkan menu Laporan hanya untuk role tertentu
  if (canAccessLaporan) {
    menuItems.push({ icon: BarChart3, label: 'Laporan', path: '/laporan' });
  }

  // Tambahkan menu Activity Log untuk admin dan team_finance
  if (canAccessActivityLog) {
    menuItems.push({ icon: History, label: 'Activity Log', path: '/activity-log' });
  }

  // Tambahkan menu Karyawan hanya untuk administrator
  if (canAccessKaryawan) {
    menuItems.push({ icon: Users, label: 'Karyawan', path: '/karyawan' });
  }

  // Tambahkan menu Backup hanya untuk administrator
  if (canAccessKaryawan) {
    menuItems.push({ icon: HardDrive, label: 'Backup', path: '/backup' });
  }

  // Tambahkan menu Maintenance hanya untuk administrator
  if (canAccessKaryawan) {
    menuItems.push({ icon: Wrench, label: 'Maintenance', path: '/maintenance' });
  }

  // Tambahkan menu Performance hanya untuk administrator
  if (canAccessKaryawan) {
    menuItems.push({ icon: Activity, label: 'Performance', path: '/performance' });
  }

  // Tambahkan menu Transaksi Berulang untuk admin dan finance (atau yg diberi permission)
  if (can('manage_recurring', ['administrator', 'team_finance'])) {
    menuItems.push({ icon: Repeat, label: 'Transaksi Berulang', path: '/recurring' });
  }

  // Tambahkan menu Changelog untuk semua user
  menuItems.push({ icon: BookOpen, label: 'Changelog', path: '/changelog' });

  const handleNavigate = (path) => {
    navigate(path);
    // Auto close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-30
          bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out
          flex flex-col h-full
          ${isOpen
            ? 'w-64 translate-x-0'
            : '-translate-x-full lg:translate-x-0 w-64 lg:w-16'
          }
        `}
      >
        {/* Logo Section */}
        <div className={`flex items-center h-20 border-b border-gray-200 transition-all duration-300 ${isOpen ? 'justify-between px-6' : 'lg:justify-center px-6 lg:px-2'}`}>
          <div className={`flex items-center space-x-3 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'lg:opacity-100'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap">Finance</h1>
                <p className="text-xs text-primary-600 font-semibold whitespace-nowrap">Prasasti Group</p>
              </div>
            )}
          </div>

          {/* Toggle Button - Desktop Only */}
          {isOpen && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
              title="Tutup Sidebar"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {/* Toggle Button for Collapsed State - Desktop Only */}
          {!isOpen && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors absolute left-1/2 -translate-x-1/2 top-6"
              title="Buka Sidebar"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 lg:px-2">
          <ul className="space-y-1">
            {menuItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={index}>
                  <button
                    onClick={() => handleNavigate(item.path)}
                    className={`
                      w-full flex items-center rounded-lg
                      transition-all duration-200
                      ${isOpen ? 'px-4 py-3 space-x-3' : 'lg:px-0 lg:py-3 lg:justify-center px-4 py-3 space-x-3'}
                      ${isActive
                        ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    title={!isOpen ? item.label : ''}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-600' : ''}`} />
                    <span className={`whitespace-nowrap overflow-hidden text-ellipsis ${isOpen ? 'block' : 'lg:hidden'}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}

            {/* Tools Dropdown */}
            <li>
              <button
                onClick={() => isOpen && setToolsOpen(!toolsOpen)}
                className={`
                  w-full flex items-center rounded-lg
                  transition-all duration-200
                  ${isOpen ? 'px-4 py-3 space-x-3' : 'lg:px-0 lg:py-3 lg:justify-center px-4 py-3 space-x-3'}
                  ${location.pathname.startsWith('/tools')
                    ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={!isOpen ? 'Tools' : ''}
              >
                <Wrench className={`w-5 h-5 flex-shrink-0 ${location.pathname.startsWith('/tools') ? 'text-primary-600' : ''}`} />
                <span className={`whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left ${isOpen ? 'block' : 'lg:hidden'}`}>
                  Tools
                </span>
                {isOpen && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Tools Submenu */}
              {isOpen && toolsOpen && (
                <ul className="mt-1 ml-4 space-y-1 border-l-2 border-gray-200 pl-4">
                  {toolsItems.map((subItem, subIndex) => {
                    const isSubActive = location.pathname === subItem.path;
                    return (
                      <li key={subIndex}>
                        <button
                          onClick={() => handleNavigate(subItem.path)}
                          className={`
                            w-full flex items-center rounded-lg px-3 py-2 space-x-2
                            transition-all duration-200 text-sm
                            ${isSubActive
                              ? 'bg-violet-50 text-violet-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `}
                        >
                          <subItem.icon className={`w-4 h-4 flex-shrink-0 ${isSubActive ? 'text-violet-600' : ''}`} />
                          <span className="whitespace-nowrap">{subItem.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          </ul>
        </nav>

        {/* Footer Info - Only show when open */}
        {isOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 leading-tight">Finance</p>
                  <p className="text-xs font-semibold text-primary-600">Prasasti Group</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 text-xs font-bold bg-primary-600 text-white rounded-md">
                  v{appVersion}
                </span>
                <p className="text-xs text-gray-500">
                  © 2025
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
