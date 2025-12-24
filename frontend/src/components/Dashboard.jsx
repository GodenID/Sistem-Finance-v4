import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Wallet,
  FileText,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Building2,
  Info,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import CompanyInfoModal from './CompanyInfoModal';
import { getAllRecords } from '../lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [stats, setStats] = useState({
    paymentRequest: { pending: 0, total: 0, approved: 0, rejected: 0 },
    kasbon: { pending: 0, total: 0, approved: 0, rejected: 0 },
    klaim: { pending: 0, total: 0, approved: 0, rejected: 0 },
    penyelesaian: { pending: 0, total: 0, approved: 0, rejected: 0 }
  });
  const [rawData, setRawData] = useState({
    paymentRequests: [],
    kasbon: [],
    klaim: [],
    penyelesaian: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data dari Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch semua data secara paralel
        const [paymentRequestsData, kasbonData, klaimData, penyelesaianData] = await Promise.all([
          getAllRecords('payment_requests'),
          getAllRecords('kasbon'),
          getAllRecords('klaim'),
          getAllRecords('penyelesaian')
        ]);

        // Store raw data for charts
        setRawData({
          paymentRequests: paymentRequestsData || [],
          kasbon: kasbonData || [],
          klaim: klaimData || [],
          penyelesaian: penyelesaianData || []
        });

        // Hitung statistik untuk Payment Request
        const prPending = paymentRequestsData.filter(pr => pr.status_approval === 'Pending').length;
        const prApproved = paymentRequestsData.filter(pr => pr.status_approval === 'Approved').length;
        const prRejected = paymentRequestsData.filter(pr => pr.status_approval === 'Rejected').length;
        const prTotal = paymentRequestsData.length;

        // Hitung statistik untuk Kasbon
        const kasbonPending = kasbonData.filter(kb => kb.status_approval === 'Pending').length;
        const kasbonApproved = kasbonData.filter(kb => kb.status_approval === 'Approved').length;
        const kasbonRejected = kasbonData.filter(kb => kb.status_approval === 'Rejected').length;
        const kasbonTotal = kasbonData.length;

        // Hitung statistik untuk Klaim
        const klaimPending = klaimData.filter(kl => kl.status_approval === 'Pending').length;
        const klaimApproved = klaimData.filter(kl => kl.status_approval === 'Approved').length;
        const klaimRejected = klaimData.filter(kl => kl.status_approval === 'Rejected').length;
        const klaimTotal = klaimData.length;

        // Hitung statistik untuk Penyelesaian
        const penyelesaianPending = penyelesaianData.filter(p => p.status_approval === 'Pending').length;
        const penyelesaianApproved = penyelesaianData.filter(p => p.status_approval === 'Approved').length;
        const penyelesaianRejected = penyelesaianData.filter(p => p.status_approval === 'Rejected').length;
        const penyelesaianTotal = penyelesaianData.length;

        setStats({
          paymentRequest: { pending: prPending, total: prTotal, approved: prApproved, rejected: prRejected },
          kasbon: { pending: kasbonPending, total: kasbonTotal, approved: kasbonApproved, rejected: kasbonRejected },
          klaim: { pending: klaimPending, total: klaimTotal, approved: klaimApproved, rejected: klaimRejected },
          penyelesaian: { pending: penyelesaianPending, total: penyelesaianTotal, approved: penyelesaianApproved, rejected: penyelesaianRejected }
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const menuCards = [
    {
      id: 1,
      title: 'Payment Request',
      description: 'Ajukan permintaan pembayaran untuk vendor, supplier, atau keperluan operasional',
      icon: CreditCard,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      route: '/payment-request',
      stats: stats.paymentRequest
    },
    {
      id: 2,
      title: 'Kasbon',
      description: 'Pengajuan kasbon karyawan untuk kebutuhan operasional dan keperluan mendesak',
      icon: Wallet,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      route: '/kasbon',
      stats: stats.kasbon
    },
    {
      id: 3,
      title: 'Klaim',
      description: 'Pengajuan klaim reimbursement untuk biaya perjalanan dinas, transport, dan lainnya',
      icon: FileText,
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-600',
      route: '/klaim',
      stats: stats.klaim
    },
    {
      id: 4,
      title: 'Penyelesaian',
      description: 'Proses penyelesaian dan pertanggungjawaban kasbon serta payment request',
      icon: CheckCircle,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      route: '/penyelesaian',
      stats: stats.penyelesaian
    },
  ];

  const handleCardClick = (route) => {
    navigate(route);
  };

  // Chart data - Trend 7 hari terakhir
  const trendChartData = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });

      const prCount = rawData.paymentRequests.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dayStart && itemDate <= dayEnd;
      }).length;

      const kasbonCount = rawData.kasbon.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dayStart && itemDate <= dayEnd;
      }).length;

      const klaimCount = rawData.klaim.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dayStart && itemDate <= dayEnd;
      }).length;

      days.push({
        name: dayName,
        'Payment Request': prCount,
        'Kasbon': kasbonCount,
        'Klaim': klaimCount
      });
    }

    return days;
  }, [rawData]);

  // Pie chart data - Status distribution
  const statusChartData = useMemo(() => {
    const totalPending = stats.paymentRequest.pending + stats.kasbon.pending + stats.klaim.pending + stats.penyelesaian.pending;
    const totalApproved = stats.paymentRequest.approved + stats.kasbon.approved + stats.klaim.approved + stats.penyelesaian.approved;
    const totalRejected = stats.paymentRequest.rejected + stats.kasbon.rejected + stats.klaim.rejected + stats.penyelesaian.rejected;

    return [
      { name: 'Approved', value: totalApproved, color: '#10B981' },
      { name: 'Pending', value: totalPending, color: '#F59E0B' },
      { name: 'Rejected', value: totalRejected, color: '#EF4444' }
    ].filter(item => item.value > 0);
  }, [stats]);

  // Bar chart data - Perbandingan modul
  const moduleChartData = useMemo(() => {
    return [
      { name: 'PR', total: stats.paymentRequest.total, pending: stats.paymentRequest.pending },
      { name: 'Kasbon', total: stats.kasbon.total, pending: stats.kasbon.pending },
      { name: 'Klaim', total: stats.klaim.total, pending: stats.klaim.pending },
      { name: 'Penyelesaian', total: stats.penyelesaian.total, pending: stats.penyelesaian.pending }
    ];
  }, [stats]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      {/* Page Title */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
            Dashboard Finance Prasasti Group
          </h1>
          <button
            onClick={() => setShowCompanyInfo(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md w-fit"
          >
            <Building2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Info Perusahaan</span>
            <Info className="w-4 h-4" />
          </button>
        </div>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
          Selamat datang kembali! Pilih menu untuk mengelola transaksi keuangan perusahaan.
        </p>
      </div>

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {menuCards.map((card) => (
          <div
            key={card.id}
            onClick={() => handleCardClick(card.route)}
            className="group relative bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 cursor-pointer transform transition-all duration-300 hover:shadow-xl hover:scale-105 hover:-translate-y-1"
          >
            {/* Background Gradient Effect */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>

            {/* Card Content */}
            <div className="relative z-10">
              {/* Icon */}
              <div className={`${card.bgColor} w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className={`w-8 h-8 ${card.iconColor}`} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gray-900">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                {card.description}
              </p>

              {/* Stats */}
              <div className="flex items-center justify-between mb-4 py-3 px-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {isLoading ? '...' : card.stats.pending}
                  </p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
                <div className="w-px h-10 bg-gray-200"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {isLoading ? '...' : card.stats.total}
                  </p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className={`${card.iconColor} group-hover:underline`}>
                  Buka Menu
                </span>
                <ArrowRight className={`w-5 h-5 ${card.iconColor} transform group-hover:translate-x-1 transition-transform duration-300`} />
              </div>
            </div>

            {/* Corner Accent */}
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.color} opacity-10 rounded-2xl transform rotate-45 translate-x-10 -translate-y-10`}></div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Chart 1 - Trend 7 Hari */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Trend Transaksi</h3>
              <p className="text-xs text-gray-500">7 hari terakhir</p>
            </div>
          </div>
          <div className="h-48 sm:h-56">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorKasbon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorKlaim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="Payment Request" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPR)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Kasbon" stroke="#10B981" fillOpacity={1} fill="url(#colorKasbon)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Klaim" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorKlaim)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2 - Pie Chart Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Status Approval</h3>
              <p className="text-xs text-gray-500">Semua modul</p>
            </div>
          </div>
          <div className="h-48 sm:h-56">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Belum ada data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart 3 - Bar Chart Perbandingan Modul */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Perbandingan Modul</h3>
            <p className="text-xs text-gray-500">Total vs Pending per modul</p>
          </div>
        </div>
        <div className="h-48 sm:h-56">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl sm:rounded-2xl p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="bg-white/20 p-2.5 sm:p-3 rounded-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold">Status Pengajuan Hari Ini</h3>
              <p className="text-xs sm:text-sm text-white/80 hidden sm:block">Update terakhir: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-xs text-white/80 sm:hidden">Update: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-6 w-full sm:w-auto justify-around sm:justify-end">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold">
                {isLoading ? '...' : stats.paymentRequest.pending + stats.kasbon.pending + stats.klaim.pending + stats.penyelesaian.pending}
              </p>
              <p className="text-xs sm:text-sm text-white/80">Total Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold">
                {isLoading ? '...' : stats.paymentRequest.total + stats.kasbon.total + stats.klaim.total + stats.penyelesaian.total}
              </p>
              <p className="text-xs sm:text-sm text-white/80">Total Pengajuan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Info Modal */}
      <CompanyInfoModal
        isOpen={showCompanyInfo}
        onClose={() => setShowCompanyInfo(false)}
      />
    </div>
  );
};

export default Dashboard;

