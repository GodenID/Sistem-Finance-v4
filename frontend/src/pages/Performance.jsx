import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Server,
  Cpu,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import {
  getPerformanceSummary,
  getTrendData,
  getRecentErrors,
  getMemoryUsage,
  getCurrentPageMetrics,
  clearAllMetrics
} from '../lib/performanceMonitor';

const Performance = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [summary, setSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [pageMetrics, setPageMetrics] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = userRole === 'administrator';

  const loadData = () => {
    setSummary(getPerformanceSummary());
    setTrendData(getTrendData());
    setRecentErrors(getRecentErrors(10));
    setMemoryUsage(getMemoryUsage());
    setPageMetrics(getCurrentPageMetrics());
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
      const interval = setInterval(loadData, 2000); // Refresh every 2s for realtime
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClearMetrics = () => {
    if (window.confirm('Hapus semua data metrics? Aksi ini tidak dapat dibatalkan.')) {
      clearAllMetrics();
      loadData();
    }
  };

  const getStatusColor = (value, thresholds) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warn) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusBg = (value, thresholds) => {
    if (value <= thresholds.good) return 'bg-green-100';
    if (value <= thresholds.warn) return 'bg-amber-100';
    return 'bg-red-100';
  };

  const getTrendIcon = (current, previous) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-4">
            Hanya Administrator yang dapat mengakses Performance Dashboard.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value} {entry.name.includes('ms') || entry.name.includes('Load') || entry.name.includes('API') ? 'ms' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Performance Dashboard</h1>
                <p className="text-sm text-gray-500">Monitor kecepatan dan error aplikasi</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleClearMetrics}
                className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Avg Page Load */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusBg(summary.today.avgPageLoad, { good: 1000, warn: 2000 })}`}>
                  <Clock className={`w-5 h-5 ${getStatusColor(summary.today.avgPageLoad, { good: 1000, warn: 2000 })}`} />
                </div>
                {getTrendIcon(summary.today.avgPageLoad, 1000)}
              </div>
              <p className={`text-2xl font-bold ${getStatusColor(summary.today.avgPageLoad, { good: 1000, warn: 2000 })}`}>
                {summary.today.avgPageLoad || 0} ms
              </p>
              <p className="text-sm text-gray-500">Avg Page Load</p>
              <p className="text-xs text-gray-400 mt-1">{summary.today.pageLoads} loads hari ini</p>
            </div>

            {/* Avg API Response */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusBg(summary.today.avgApiResponse, { good: 500, warn: 1000 })}`}>
                  <Zap className={`w-5 h-5 ${getStatusColor(summary.today.avgApiResponse, { good: 500, warn: 1000 })}`} />
                </div>
                {getTrendIcon(summary.today.avgApiResponse, 500)}
              </div>
              <p className={`text-2xl font-bold ${getStatusColor(summary.today.avgApiResponse, { good: 500, warn: 1000 })}`}>
                {summary.today.avgApiResponse || 0} ms
              </p>
              <p className="text-sm text-gray-500">Avg API Response</p>
              <p className="text-xs text-gray-400 mt-1">{summary.today.apiCalls} calls hari ini</p>
            </div>

            {/* Error Rate */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusBg(parseFloat(summary.today.errorRate), { good: 1, warn: 5 })}`}>
                  <AlertTriangle className={`w-5 h-5 ${getStatusColor(parseFloat(summary.today.errorRate), { good: 1, warn: 5 })}`} />
                </div>
                {getTrendIcon(parseFloat(summary.today.errorRate), 1)}
              </div>
              <p className={`text-2xl font-bold ${getStatusColor(parseFloat(summary.today.errorRate), { good: 1, warn: 5 })}`}>
                {summary.today.errorRate}%
              </p>
              <p className="text-sm text-gray-500">Error Rate</p>
              <p className="text-xs text-gray-400 mt-1">{summary.today.errors} errors hari ini</p>
            </div>

            {/* Memory Usage */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100">
                  <Cpu className="w-5 h-5 text-purple-600" />
                </div>
                <Server className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {memoryUsage ? `${memoryUsage.usedJSHeapSize} MB` : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Memory Usage</p>
              {memoryUsage && (
                <p className="text-xs text-gray-400 mt-1">
                  of {memoryUsage.totalJSHeapSize} MB allocated
                </p>
              )}
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Response Time Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-primary-600" />
              <span>Response Time Trend (7 Hari)</span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="avgPageLoad" 
                    name="Page Load (ms)"
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgApiResponse" 
                    name="API Response (ms)"
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity & Errors */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-primary-600" />
              <span>Activity & Errors (7 Hari)</span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="pageLoads" name="Page Loads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="apiCalls" name="API Calls" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" name="Errors" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Current Page Metrics */}
        {pageMetrics && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Current Page Load Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{pageMetrics.dns} ms</p>
                <p className="text-xs text-gray-500">DNS Lookup</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{pageMetrics.tcp} ms</p>
                <p className="text-xs text-gray-500">TCP Connect</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{pageMetrics.ttfb} ms</p>
                <p className="text-xs text-gray-500">TTFB</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{pageMetrics.download} ms</p>
                <p className="text-xs text-gray-500">Download</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{pageMetrics.domReady} ms</p>
                <p className="text-xs text-gray-500">DOM Ready</p>
              </div>
              <div className="text-center p-3 bg-primary-50 rounded-lg">
                <p className="text-lg font-bold text-primary-600">{pageMetrics.load} ms</p>
                <p className="text-xs text-gray-500">Total Load</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Errors */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>Recent Errors</span>
          </h3>
          {recentErrors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Waktu</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Error Message</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Context</th>
                  </tr>
                </thead>
                <tbody>
                  {recentErrors.map((error, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(error.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 px-3 text-sm text-red-600 font-mono">
                        {error.message.substring(0, 100)}
                        {error.message.length > 100 && '...'}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500">
                        {error.context || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Tidak ada error tercatat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Performance;
