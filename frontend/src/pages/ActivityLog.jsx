import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  History, 
  Search, 
  Filter, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Wallet,
  FileText,
  CheckCircle,
  Calendar,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllActivityLogs, getActionLabel, getActionBadgeColor, getTableLabel } from '../lib/auditLog';

const ActivityLog = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage] = useState(10);
  
  // Filter states
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Check role access - semua role bisa akses
  const canAccessLogs = true;

  // Fetch logs
  const fetchLogs = async () => {
    if (!canAccessLogs) return;
    
    try {
      setIsLoading(true);
      const { data, count } = await getAllActivityLogs({
        page: currentPage,
        limit: itemsPerPage,
        tableName: filterTable !== 'all' ? filterTable : null,
        action: filterAction !== 'all' ? filterAction : null,
        startDate: startDate || null,
        endDate: endDate || null
      });

      // Apply search filter on client side
      let filteredData = data;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filteredData = data.filter(log => 
          (log.record_number || '').toLowerCase().includes(term) ||
          (log.changed_by_name || '').toLowerCase().includes(term)
        );
      }

      setLogs(filteredData);
      setTotalCount(count);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, filterTable, filterAction, startDate, endDate]);

  // Reset filters
  const handleResetFilters = () => {
    setFilterTable('all');
    setFilterAction('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Get icon for table
  const getTableIcon = (tableName) => {
    switch (tableName) {
      case 'payment_requests':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'kasbon':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
      case 'klaim':
        return <FileText className="w-4 h-4 text-violet-600" />;
      case 'penyelesaian':
        return <CheckCircle className="w-4 h-4 text-amber-600" />;
      default:
        return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Activity Log</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Riwayat perubahan data di sistem</p>
          </div>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm sm:text-base w-full sm:w-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="font-medium">Refresh</span>
        </button>
      </div>

      {/* Filter Section */}
      <div className="card">
        <div className="p-4 sm:p-6">
          <div className="flex items-center space-x-2 pb-3 border-b border-gray-200 mb-4">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Filter</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cari</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                  placeholder="Nomor dokumen atau user..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            {/* Filter by Table */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Modul</label>
              <select
                value={filterTable}
                onChange={(e) => {
                  setFilterTable(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 bg-white"
              >
                <option value="all">Semua Modul</option>
                <option value="payment_requests">Payment Request</option>
                <option value="kasbon">Kasbon</option>
                <option value="klaim">Klaim</option>
                <option value="penyelesaian">Penyelesaian</option>
              </select>
            </div>

            {/* Filter by Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aksi</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 bg-white"
              >
                <option value="all">Semua Aksi</option>
                <option value="create">Dibuat</option>
                <option value="update">Diperbarui</option>
                <option value="approve">Disetujui</option>
                <option value="reject">Ditolak</option>
                <option value="transfer">Transfer</option>
                <option value="delete">Dihapus</option>
              </select>
            </div>
          </div>

          {/* Date Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Dari Tanggal
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              {(filterTable !== 'all' || filterAction !== 'all' || searchTerm || startDate || endDate) && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="card">
        <div className="p-4 sm:p-6">
          <div className="flex items-center space-x-2 pb-3 border-b border-gray-200 mb-4">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Riwayat Aktivitas</h2>
            <span className="text-sm text-gray-500">({totalCount} total)</span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Waktu</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Modul</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nomor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Detail</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-gray-600">Memuat data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center">
                        <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Belum ada aktivitas tercatat</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">
                            {new Date(log.changed_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.changed_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {getTableIcon(log.table_name)}
                            <span className="text-sm font-medium text-gray-700">
                              {getTableLabel(log.table_name)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-primary-600">
                            {log.record_number || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {log.field_changed ? (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">{log.field_changed}:</span>
                              {log.old_value && (
                                <span className="text-rose-600 line-through ml-1">{log.old_value}</span>
                              )}
                              {log.new_value && (
                                <span className="text-emerald-600 ml-1">{log.new_value}</span>
                              )}
                            </div>
                          ) : log.new_value ? (
                            <span className="text-xs text-gray-600">{log.new_value}</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-700">
                            {log.changed_by_name || '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 gap-3">
              <p className="text-sm text-gray-600">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} data
              </p>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center space-x-1 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <span className="px-3 py-2 text-sm font-medium text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center space-x-1 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
