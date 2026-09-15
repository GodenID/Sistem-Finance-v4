import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  ShieldAlert,
  Wallet,
  ChevronDown,
  ChevronUp,
  Repeat,
  CheckCircle,
  Clock,
  ExternalLink,
  Image,
  Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllRecords, getLightweightRows } from '../lib/api';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS, getTipeOptionsByRole, getIdPerusahaanOptionsByRole } from '../constants/companyTypes';
// NOTE (FIX #5): xlsx dimuat dinamis di handleExportExcel agar tidak masuk bundle awal.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

const Laporan = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState('payment-request');
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState({
    paymentRequests: [],
    kasbon: [],
    klaim: [],
    penyelesaian: [],
    vendors: [],
    recurringTemplates: [],
    recurringInstances: []
  });

  // Filter states
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [searchQL, setSearchQL] = useState('');
  const [filterTipe, setFilterTipe] = useState('all');
  const [filterIdPerusahaan, setFilterIdPerusahaan] = useState('all');

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState({});

  // FIX #4: data ringan (created_at saja, 6 bulan) khusus untuk grafik tren,
  // agar grafik tidak bergantung pada tabel full yang kini dibatasi periode.
  const [trendRows, setTrendRows] = useState({ paymentRequests: [], kasbon: [], klaim: [] });

  // Check role access
  const canAccessLaporan = ['administrator', 'team_finance', 'bod'].includes(userRole);

  // Fetch data dari Supabase
  // FIX #4: filter tanggal dikirim ke SERVER (gte/lte created_at) sehingga yang
  // didownload hanya data periode aktif, bukan seluruh histori. Refetch saat
  // periode/ganti tanggal custom berubah.
  useEffect(() => {
    const fetchReportData = async () => {
      if (!canAccessLaporan) return;

      try {
        setIsLoading(true);

        // Hitung batas tanggal dari periode terpilih (format utk getAllRecords)
        const now = new Date();
        const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let dateFilter = {};
        if (selectedPeriod === 'today') {
          const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          dateFilter = { start_date: s.toISOString(), end_date: toISODate(now) };
        } else if (selectedPeriod === 'week') {
          const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          s.setDate(s.getDate() - 7);
          dateFilter = { start_date: s.toISOString() };
        } else if (selectedPeriod === 'month') {
          const s = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = { start_date: s.toISOString() };
        } else if (selectedPeriod === 'quarter') {
          const q = Math.floor(now.getMonth() / 3);
          const s = new Date(now.getFullYear(), q * 3, 1);
          dateFilter = { start_date: s.toISOString() };
        } else if (selectedPeriod === 'year') {
          const s = new Date(now.getFullYear(), 0, 1);
          dateFilter = { start_date: s.toISOString() };
        } else if (selectedPeriod === 'custom') {
          dateFilter = {
            ...(customDateFrom ? { start_date: customDateFrom } : {}),
            ...(customDateTo ? { end_date: customDateTo } : {}),
          };
        }

        const [prData, kasbonData, klaimData, penyelesaianData, vendorData] = await Promise.all([
          getAllRecords('payment_requests', dateFilter),
          getAllRecords('kasbon', dateFilter),
          getAllRecords('klaim', dateFilter),
          getAllRecords('penyelesaian', dateFilter),
          getAllRecords('vendors')
        ]);


        // Fetch recurring data using API
        let recurringTemplates = [];
        let recurringInstances = [];
        try {
          // Fetch templates
          const templates = await getAllRecords('recurring_transactions');
          // Sort templates by created_at desc (if date strings, standard sort works)
          recurringTemplates = (templates || []).sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
          );

          // Fetch instances
          const instances = await getAllRecords('recurring_instances');

          // FIX #4: join O(n+m) via Map — sebelumnya .find() di dalam .map()
          // sehingga O(n*m) dan melambat seiring data bertambah.
          const templateById = new Map((recurringTemplates || []).map((t) => [t.id, t]));
          recurringInstances = (instances || [])
            .map(instance => {
              const template = templateById.get(instance.recurring_id);
              // Construct the 'recurring' object structure expected by the UI
              return {
                ...instance,
                recurring: template ? {
                  id: template.id,
                  name: template.name,
                  type: template.type,
                  template_data: template.template_data,
                  frequency: template.frequency,
                  day_of_month: template.day_of_month,
                  is_active: template.is_active
                } : null
              };
            })
            // Sort by scheduled_date desc
            .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

        } catch (e) {
          console.log('Error fetching recurring data:', e);
        }

        setReportData({
          paymentRequests: prData || [],
          kasbon: kasbonData || [],
          klaim: klaimData || [],
          penyelesaian: penyelesaianData || [],
          vendors: vendorData || [],
          recurringTemplates,
          recurringInstances
        });
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [canAccessLaporan, selectedPeriod, customDateFrom, customDateTo]);

  // Tren 6 bulan diambil terpisah dengan kolom ringan (id + created_at) sekali
  // saat halaman dibuka — tidak ikut refetch tiap ganti periode.
  useEffect(() => {
    if (!canAccessLaporan) return;
    const fetchTrend = async () => {
      try {
        const sixMoAgo = new Date();
        sixMoAgo.setMonth(sixMoAgo.getMonth() - 6);
        const since = sixMoAgo.toISOString();
        const [pr, kb, kl] = await Promise.all([
          getLightweightRows('payment_requests', { columns: 'id,created_at', since, limit: 5000 }),
          getLightweightRows('kasbon', { columns: 'id,created_at', since, limit: 5000 }),
          getLightweightRows('klaim', { columns: 'id,created_at', since, limit: 5000 }),
        ]);
        setTrendRows({ paymentRequests: pr, kasbon: kb, klaim: kl });
      } catch (e) {
        console.log('Error fetching trend data:', e);
      }
    };
    fetchTrend();
  }, [canAccessLaporan]);

  // Format Rupiah helper
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  // If no access, show access denied page
  if (!canAccessLaporan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="p-6 sm:p-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">Akses Ditolak</h1>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Maaf, Anda tidak memiliki akses ke halaman Laporan. Halaman ini hanya dapat diakses oleh:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                    <span>Administrator</span>
                  </li>
                  <li className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                    <span>Team Finance</span>
                  </li>
                  <li className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                    <span>BOD</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-primary-600 text-white py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats dari data realtime
  const calculateStats = (data, nominalField = 'nominal') => {
    const total = data.length;
    const nominal = data.reduce((sum, item) => sum + (parseFloat(item[nominalField]) || 0), 0);
    const approved = data.filter(item => item.status_approval === 'Approved').length;
    const pending = data.filter(item => item.status_approval === 'Pending').length;
    return { total, nominal, approved, pending };
  };

  const reportStats = {
    'payment-request': {
      ...calculateStats(reportData.paymentRequests),
      color: 'blue',
      bgGradient: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-700'
    },
    'kasbon': {
      ...calculateStats(reportData.kasbon),
      color: 'emerald',
      bgGradient: 'from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-500',
      textColor: 'text-emerald-700'
    },
    'klaim': {
      ...calculateStats(reportData.klaim),
      color: 'amber',
      bgGradient: 'from-amber-50 to-amber-100',
      border: 'border-amber-200',
      iconBg: 'bg-amber-500',
      textColor: 'text-amber-700'
    },
    'penyelesaian': {
      ...calculateStats(reportData.penyelesaian, 'kasbon_nominal'),
      color: 'purple',
      bgGradient: 'from-purple-50 to-purple-100',
      border: 'border-purple-200',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-700'
    },
    'transaksi-berulang': {
      total: reportData.recurringTemplates.length,
      nominal: reportData.recurringInstances.reduce((sum, item) => sum + (parseFloat(item.recurring?.template_data?.nominal) || 0), 0),
      approved: reportData.recurringInstances.filter(item => item.status === 'transferred').length,
      pending: reportData.recurringInstances.filter(item => item.status === 'pending').length,
      color: 'cyan',
      bgGradient: 'from-cyan-50 to-cyan-100',
      border: 'border-cyan-200',
      iconBg: 'bg-cyan-500',
      textColor: 'text-cyan-700'
    }
  };

  const reportTypes = [
    { value: 'payment-request', label: 'Payment Request', icon: FileText },
    { value: 'kasbon', label: 'Kasbon', icon: Wallet },
    { value: 'klaim', label: 'Klaim', icon: TrendingUp },
    { value: 'penyelesaian', label: 'Penyelesaian', icon: BarChart3 },
    { value: 'transaksi-berulang', label: 'Transaksi Berulang', icon: Repeat }
  ];

  const periods = [
    { value: 'today', label: 'Hari Ini' },
    { value: 'week', label: 'Minggu Ini' },
    { value: 'month', label: 'Bulan Ini' },
    { value: 'quarter', label: 'Kuartal Ini' },
    { value: 'year', label: 'Tahun Ini' },
    { value: 'custom', label: 'Custom' }
  ];

  // Filter data berdasarkan periode
  const filterByPeriod = (data) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.filter(item => {
      const itemDate = new Date(item.created_at);

      switch (selectedPeriod) {
        case 'today':
          const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
          return itemDay.getTime() === today.getTime();

        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;

        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return itemDate >= monthStart;

        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
          return itemDate >= quarterStart;

        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return itemDate >= yearStart;

        case 'custom':
          if (!customDateFrom && !customDateTo) return true;
          const from = customDateFrom ? new Date(customDateFrom) : new Date(0);
          const to = customDateTo ? new Date(customDateTo) : new Date();
          to.setHours(23, 59, 59, 999); // Include the entire end date
          return itemDate >= from && itemDate <= to;

        default:
          return true;
      }
    });
  };

  // Filter data berdasarkan search dan filter lainnya
  const applyFilters = (data) => {
    let filtered = filterByPeriod(data);

    // Filter by QL - exact match untuk angka
    if (searchQL.trim()) {
      const searchTerm = searchQL.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const nomorQL = (item.nomor_ql || '').toLowerCase();

        // Jika search term hanya angka, cari exact match untuk angka tersebut
        if (/^\d+$/.test(searchTerm)) {
          // Extract angka dari nomor QL (misal: "QL-31" -> "31")
          const qlNumber = nomorQL.replace(/[^\d]/g, '');
          // Exact match: angka harus sama persis
          return qlNumber === searchTerm;
        }

        // Jika search term mengandung huruf atau karakter lain, gunakan includes
        return nomorQL.includes(searchTerm);
      });
    }

    // Filter by Tipe
    if (filterTipe !== 'all') {
      filtered = filtered.filter(item => item.tipe === filterTipe);
    }

    // Filter by ID Perusahaan
    if (filterIdPerusahaan !== 'all') {
      filtered = filtered.filter(item => item.id_perusahaan === filterIdPerusahaan);
    }

    return filtered;
  };

  // Filter recurring instances by date
  const filterRecurringByPeriod = (data) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.filter(item => {
      const itemDate = new Date(item.scheduled_date || item.created_at);

      switch (selectedPeriod) {
        case 'today':
          const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
          return itemDay.getTime() === today.getTime();
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return itemDate >= monthStart;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
          return itemDate >= quarterStart;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return itemDate >= yearStart;
        case 'custom':
          if (!customDateFrom && !customDateTo) return true;
          const from = customDateFrom ? new Date(customDateFrom) : new Date(0);
          const to = customDateTo ? new Date(customDateTo) : new Date();
          to.setHours(23, 59, 59, 999);
          return itemDate >= from && itemDate <= to;
        default:
          return true;
      }
    });
  };

  // Apply filters to all data
  // FIX: di-memo agar grouping/chart di bawah tidak dihitung ulang tiap render
  // (mis. tiap huruf diketik di pencarian). eslint deps sengaja eksplisit:
  // applyFilters/filterRecurringByPeriod closure dari state di bawah.
  const filteredData = useMemo(() => ({
    paymentRequests: applyFilters(reportData.paymentRequests),
    kasbon: applyFilters(reportData.kasbon),
    klaim: applyFilters(reportData.klaim),
    penyelesaian: applyFilters(reportData.penyelesaian),
    recurringInstances: filterRecurringByPeriod(reportData.recurringInstances)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reportData, selectedPeriod, customDateFrom, customDateTo, searchQL, filterTipe, filterIdPerusahaan]);

  // Recalculate stats with filtered data
  const filteredReportStats = {
    'payment-request': {
      ...calculateStats(filteredData.paymentRequests),
      color: 'blue',
      bgGradient: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-700'
    },
    'kasbon': {
      ...calculateStats(filteredData.kasbon),
      color: 'emerald',
      bgGradient: 'from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-500',
      textColor: 'text-emerald-700'
    },
    'klaim': {
      ...calculateStats(filteredData.klaim),
      color: 'amber',
      bgGradient: 'from-amber-50 to-amber-100',
      border: 'border-amber-200',
      iconBg: 'bg-amber-500',
      textColor: 'text-amber-700'
    },
    'penyelesaian': {
      ...calculateStats(filteredData.penyelesaian, 'kasbon_nominal'),
      color: 'purple',
      bgGradient: 'from-purple-50 to-purple-100',
      border: 'border-purple-200',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-700'
    },
    'transaksi-berulang': {
      total: reportData.recurringTemplates.filter(t => t.is_active).length,
      nominal: filteredData.recurringInstances.reduce((sum, item) => sum + (parseFloat(item.recurring?.template_data?.nominal) || 0), 0),
      approved: filteredData.recurringInstances.filter(item => item.status === 'transferred').length,
      pending: filteredData.recurringInstances.filter(item => item.status === 'pending').length,
      color: 'cyan',
      bgGradient: 'from-cyan-50 to-cyan-100',
      border: 'border-cyan-200',
      iconBg: 'bg-cyan-500',
      textColor: 'text-cyan-700'
    }
  };

  const currentStats = filteredReportStats[selectedReport] || filteredReportStats['payment-request'];

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899'];

  // Prepare chart data - Trend per bulan (last 6 months)
  // FIX #4: dihitung dari trendRows (kolom ringan 6 bulan), bukan dari
  // reportData yang kini dibatasi periode aktif.
  const trendChartData = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('id-ID', { month: 'short' });
      const year = date.getFullYear();
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      // Count transactions per month for each module
      const prCount = trendRows.paymentRequests.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= monthStart && itemDate <= monthEnd;
      }).length;

      const kasbonCount = trendRows.kasbon.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= monthStart && itemDate <= monthEnd;
      }).length;

      const klaimCount = trendRows.klaim.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= monthStart && itemDate <= monthEnd;
      }).length;

      months.push({
        name: `${monthName} ${year}`,
        'Payment Request': prCount,
        'Kasbon': kasbonCount,
        'Klaim': klaimCount
      });
    }

    return months;
  }, [trendRows]);

  // Prepare pie chart data - Status distribution
  const statusChartData = useMemo(() => {
    let data = [];
    switch (selectedReport) {
      case 'payment-request':
        data = filteredData.paymentRequests;
        break;
      case 'kasbon':
        data = filteredData.kasbon;
        break;
      case 'klaim':
        data = filteredData.klaim;
        break;
      case 'penyelesaian':
        data = filteredData.penyelesaian;
        break;
      default:
        data = [];
    }

    const approved = data.filter(item => item.status_approval === 'Approved').length;
    const pending = data.filter(item => item.status_approval === 'Pending').length;
    const rejected = data.filter(item => item.status_approval === 'Rejected').length;

    return [
      { name: 'Approved', value: approved, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#F59E0B' },
      { name: 'Rejected', value: rejected, color: '#EF4444' }
    ].filter(item => item.value > 0);
  }, [selectedReport, filteredData]);

  // Prepare bar chart data - Per module comparison
  const moduleComparisonData = useMemo(() => {
    return [
      {
        name: 'Payment Request',
        total: filteredData.paymentRequests.length,
        nominal: filteredData.paymentRequests.reduce((sum, item) => sum + (parseFloat(item.nominal) || 0), 0) / 1000000
      },
      {
        name: 'Kasbon',
        total: filteredData.kasbon.length,
        nominal: filteredData.kasbon.reduce((sum, item) => sum + (parseFloat(item.nominal) || 0), 0) / 1000000
      },
      {
        name: 'Klaim',
        total: filteredData.klaim.length,
        nominal: filteredData.klaim.reduce((sum, item) => sum + (parseFloat(item.nominal) || 0), 0) / 1000000
      },
      {
        name: 'Penyelesaian',
        total: filteredData.penyelesaian.length,
        nominal: filteredData.penyelesaian.reduce((sum, item) => sum + (parseFloat(item.kasbon_nominal) || 0), 0) / 1000000
      }
    ];
  }, [filteredData]);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {typeof entry.value === 'number' && entry.value % 1 !== 0
                ? `Rp ${entry.value.toFixed(1)} Juta`
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate data per kategori (tipe) - using filtered data
  const getDataByCategory = () => {
    let data = [];
    switch (selectedReport) {
      case 'payment-request':
        data = filteredData.paymentRequests;
        break;
      case 'kasbon':
        data = filteredData.kasbon;
        break;
      case 'klaim':
        data = filteredData.klaim;
        break;
      case 'penyelesaian':
        data = filteredData.penyelesaian;
        break;
      default:
        data = [];
    }

    // Group by tipe
    const grouped = data.reduce((acc, item) => {
      const tipe = item.tipe || 'Lainnya';
      if (!acc[tipe]) {
        acc[tipe] = { count: 0, nominal: 0 };
      }
      acc[tipe].count++;
      const nominalField = selectedReport === 'penyelesaian' ? 'kasbon_nominal' : 'nominal';
      acc[tipe].nominal += parseFloat(item[nominalField]) || 0;
      return acc;
    }, {});

    return Object.entries(grouped).map(([tipe, stats]) => ({
      kategori: tipe,
      total: stats.count,
      nominal: stats.nominal
    }));
  };

  // FIX: di-memo — grouping O(n) tidak diulang tiap render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categoryData = useMemo(() => getDataByCategory(), [filteredData, selectedReport]);

  // Gabungkan data dari semua modul berdasarkan nomor QL dan tipe
  const getCombinedDataByQL = () => {
    const combined = [];

    // Gabungkan semua data
    const allData = [
      ...filteredData.paymentRequests.map(item => ({ ...item, modul: 'Payment Request', nomorRef: item.nomor_pr })),
      ...filteredData.kasbon.map(item => ({ ...item, modul: 'Kasbon', nomorRef: item.nomor_kasbon })),
      ...filteredData.klaim.map(item => ({ ...item, modul: 'Klaim', nomorRef: item.nomor_klaim }))
    ];

    // Group by nomor_ql dan tipe
    const grouped = allData.reduce((acc, item) => {
      const key = `${item.nomor_ql || 'Tanpa QL'}_${item.tipe || 'Lainnya'}`;
      if (!acc[key]) {
        acc[key] = {
          nomor_ql: item.nomor_ql || '-',
          tipe: item.tipe || 'Lainnya',
          items: [],
          totalNominal: 0,
          count: 0
        };
      }
      acc[key].items.push(item);
      acc[key].totalNominal += parseFloat(item.nominal) || 0;
      acc[key].count++;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      // Sort by tipe first, then by nomor_ql
      if (a.tipe !== b.tipe) return a.tipe.localeCompare(b.tipe);
      return a.nomor_ql.localeCompare(b.nomor_ql);
    });
  };

  // FIX: di-memo — spread + group + sort seluruh data tidak diulang tiap render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const combinedData = useMemo(() => getCombinedDataByQL(), [filteredData]);

  // Function to export Excel with multiple sheets
  // FIX #5: xlsx (~800KB) dimuat dinamis hanya saat tombol diklik,
  // tidak membebani bundle awal halaman Laporan.
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Format Rupiah untuk Excel
      const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(angka);
      };

      // Sheet 1: Summary Report
      const summaryData = [
        ['LAPORAN KEUANGAN PRASASTI GROUP'],
        ['Periode:', selectedPeriod.toUpperCase()],
        ['Tanggal Export:', new Date().toLocaleDateString('id-ID')],
        [''],
        ['RINGKASAN TRANSAKSI'],
        ['Jenis Laporan', 'Total Transaksi', 'Total Nominal', 'Approved', 'Pending'],
        ...Object.entries(filteredReportStats).map(([key, stat]) => [
          reportTypes.find(t => t.value === key)?.label || key,
          stat.total,
          formatRupiah(stat.nominal),
          stat.approved,
          stat.pending
        ])
      ];

      const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);

      // Set column widths
      ws_summary['!cols'] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_summary, 'Ringkasan');

      // Sheet 2: Payment Request Detail (using filtered data)
      // Helper function to get vendor name
      const getVendorName = (vendorId) => {
        if (!vendorId) return '-';
        const vendor = reportData.vendors.find(v => v.id === vendorId);
        return vendor ? vendor.nama : '-';
      };

      // Helper untuk mendapatkan tujuan pembayaran (Vendor atau VA)
      const getPaymentDestination = (pr) => {
        if (pr.metode_pembayaran === 'Virtual Account') {
          return `VA: ${pr.virtual_account_name || '-'} (${pr.virtual_account_number || '-'})`;
        }
        return getVendorName(pr.vendor_id);
      };

      const prData = [
        ['DETAIL PAYMENT REQUEST'],
        [''],
        ['No PR', 'No QL', 'Tanggal', 'Tipe', 'Karyawan', 'Metode', 'Tujuan Pembayaran', 'Nominal', 'Status Approval', 'Disetujui Oleh', 'Status Transfer'],
        ...filteredData.paymentRequests.map(pr => [
          pr.nomor_pr || '-',
          pr.nomor_ql || '-',
          pr.created_at ? new Date(pr.created_at).toLocaleDateString('id-ID') : '-',
          pr.tipe || '-',
          pr.nama_karyawan || '-',
          pr.metode_pembayaran || 'Transfer Rekening',
          getPaymentDestination(pr),
          formatRupiah(pr.nominal || 0),
          pr.status_approval || 'Pending',
          pr.disetujui_oleh || '-',
          pr.status_transfer || 'Belum Transfer'
        ]),
        [''],
        ['TOTAL', '', '', '', '', '', '', formatRupiah(filteredData.paymentRequests.reduce((sum, pr) => sum + (parseFloat(pr.nominal) || 0), 0)), '', '', '']
      ];

      const ws_pr = XLSX.utils.aoa_to_sheet(prData);
      ws_pr['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_pr, 'Payment Request');

      // Sheet 3: Kasbon Detail (using filtered data)
      const kasbonData = [
        ['DETAIL KASBON'],
        [''],
        ['No Kasbon', 'No QL', 'Tanggal', 'Tipe', 'Karyawan', 'Nominal', 'Metode Pembayaran', 'Status Approval', 'Status Transfer'],
        ...filteredData.kasbon.map(kb => [
          kb.nomor_kasbon || '-',
          kb.nomor_ql || '-',
          kb.created_at ? new Date(kb.created_at).toLocaleDateString('id-ID') : '-',
          kb.tipe || '-',
          kb.nama_karyawan || '-',
          formatRupiah(kb.nominal || 0),
          kb.metode_pembayaran || '-',
          kb.status_approval || 'Pending',
          kb.status_transfer || 'Belum Transfer'
        ]),
        [''],
        ['TOTAL', '', '', '', '', formatRupiah(filteredData.kasbon.reduce((sum, kb) => sum + (parseFloat(kb.nominal) || 0), 0)), '', '', '']
      ];

      const ws_kasbon = XLSX.utils.aoa_to_sheet(kasbonData);
      ws_kasbon['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_kasbon, 'Kasbon');

      // Sheet 4: Klaim Detail (using filtered data)
      const klaimData = [
        ['DETAIL KLAIM'],
        [''],
        ['No Klaim', 'No QL', 'Tanggal', 'Tipe', 'Karyawan', 'Nominal', 'Metode Pembayaran', 'Status Approval', 'Status Transfer'],
        ...filteredData.klaim.map(kl => [
          kl.nomor_klaim || '-',
          kl.nomor_ql || '-',
          kl.created_at ? new Date(kl.created_at).toLocaleDateString('id-ID') : '-',
          kl.tipe || '-',
          kl.nama_karyawan || '-',
          formatRupiah(kl.nominal || 0),
          kl.metode_pembayaran || '-',
          kl.status_approval || 'Pending',
          kl.status_transfer || 'Belum Transfer'
        ]),
        [''],
        ['TOTAL', '', '', '', '', formatRupiah(filteredData.klaim.reduce((sum, kl) => sum + (parseFloat(kl.nominal) || 0), 0)), '', '', '']
      ];

      const ws_klaim = XLSX.utils.aoa_to_sheet(klaimData);
      ws_klaim['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_klaim, 'Klaim');

      // Sheet 5: Penyelesaian Detail (using filtered data)
      const penyelesaianData = [
        ['DETAIL PENYELESAIAN'],
        [''],
        ['No Penyelesaian', 'No Kasbon', 'No QL', 'Tanggal', 'Karyawan', 'Nominal Kasbon', 'Total Terpakai', 'Selisih', 'Status'],
        ...filteredData.penyelesaian.map(p => [
          p.nomor_penyelesaian || '-',
          p.nomor_kasbon || '-',
          p.nomor_ql || '-',
          p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '-',
          p.nama_karyawan || '-',
          formatRupiah(p.kasbon_nominal || 0),
          formatRupiah(p.total_terpakai || 0),
          formatRupiah(p.selisih || 0),
          p.status_selisih || '-'
        ]),
        [''],
        ['TOTAL', '', '', '', '',
          formatRupiah(filteredData.penyelesaian.reduce((sum, p) => sum + (parseFloat(p.kasbon_nominal) || 0), 0)),
          formatRupiah(filteredData.penyelesaian.reduce((sum, p) => sum + (parseFloat(p.total_terpakai) || 0), 0)),
          formatRupiah(filteredData.penyelesaian.reduce((sum, p) => sum + (parseFloat(p.selisih) || 0), 0)),
          ''
        ]
      ];

      const ws_penyelesaian = XLSX.utils.aoa_to_sheet(penyelesaianData);
      ws_penyelesaian['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_penyelesaian, 'Penyelesaian');

      // Sheet 6: Vendor List
      const vendorData = [
        ['MASTER VENDOR'],
        [''],
        ['ID', 'Nama Vendor', 'Kategori', 'Kontak Person', 'Nama Bank', 'Nomor Rekening', 'Pemilik Rekening', 'Status'],
        ['1', 'PT. Supplier Utama', 'Inventory', 'Ahmad Vendor', 'Bank Mandiri', '1370012345678', 'PT. Supplier Utama', 'Active'],
        ['2', 'CV. Teknologi Digital', 'IT Equipment', 'Budi Tech', 'Bank BCA', '5320098765432', 'CV. Teknologi Digital', 'Active'],
        ['3', 'PT. Jasa Konstruksi', 'Construction', 'Siti Builder', 'Bank BNI', '0234567890123', 'PT. Jasa Konstruksi', 'Active'],
        ['4', 'Toko Perlengkapan Kantor', 'Office Supplies', 'Rudi Office', 'Bank BRI', '0012345678901', 'Rudi Hartono', 'Active'],
        ['5', 'PT. Service Provider', 'Professional Services', 'Dewi Services', 'Bank CIMB Niaga', '7001234567890', 'PT. Service Provider', 'Active'],
      ];

      const ws_vendor = XLSX.utils.aoa_to_sheet(vendorData);
      ws_vendor['!cols'] = [
        { wch: 5 },
        { wch: 28 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 25 },
        { wch: 10 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_vendor, 'Master Vendor');

      // Sheet 7: Analisis per Kategori
      const totalNominal = categoryData.reduce((sum, item) => sum + item.nominal, 0);
      const analisisData = [
        ['ANALISIS TRANSAKSI PER KATEGORI'],
        [''],
        ['Kategori', 'Total Transaksi', 'Total Nominal', 'Persentase'],
        ...categoryData.map(item => [
          item.kategori,
          item.total.toString(),
          formatRupiah(item.nominal),
          totalNominal > 0 ? `${((item.nominal / totalNominal) * 100).toFixed(1)}%` : '0%'
        ]),
        [''],
        ['GRAND TOTAL', categoryData.reduce((sum, item) => sum + item.total, 0).toString(), formatRupiah(totalNominal), '100%']
      ];

      const ws_analisis = XLSX.utils.aoa_to_sheet(analisisData);
      ws_analisis['!cols'] = [
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_analisis, 'Analisis Kategori');

      // Generate filename with date
      const fileName = `Laporan_Keuangan_${selectedReport}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write the workbook
      XLSX.writeFile(wb, fileName);

      alert('Export Excel berhasil! File akan didownload.');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Terjadi kesalahan saat export Excel. Silakan coba lagi.');
    }
  };

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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Laporan Keuangan</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Analisis dan ringkasan transaksi keuangan</p>
          </div>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-sm sm:text-base w-full sm:w-auto"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium">Export Excel</span>
        </button>
      </div>

      {/* Filter Section */}
      <div className="card">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Filter Laporan</h2>
          </div>

          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Laporan</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {reportTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedReport(type.value)}
                  className={`flex items-center justify-center space-x-2 sm:space-x-3 p-3 sm:p-4 rounded-lg border-2 transition-all ${selectedReport === type.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <type.icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${selectedReport === type.value ? 'text-primary-600' : 'text-gray-600'
                    }`} />
                  <span className={`font-medium text-xs sm:text-sm ${selectedReport === type.value ? 'text-primary-700' : 'text-gray-700'
                    }`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Period Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Periode</label>
            <div className="flex flex-wrap gap-2">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${selectedPeriod === period.value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range (if custom selected) */}
          {selectedPeriod === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dari Tanggal</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sampai Tanggal</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Additional Filters */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter Tambahan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Search by QL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cari Nomor QL</label>
                <input
                  type="text"
                  value={searchQL}
                  onChange={(e) => setSearchQL(e.target.value)}
                  placeholder="Contoh: QL-12345"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* Filter by Tipe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipe</label>
                <select
                  value={filterTipe}
                  onChange={(e) => setFilterTipe(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 bg-white"
                  style={{ color: '#111827' }}
                >
                  <option value="all" className="text-gray-900">Semua Tipe</option>
                  {getTipeOptionsByRole(userRole).map(option => (
                    <option key={option.value} value={option.value} className="text-gray-900">{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Filter by ID Perusahaan - Optional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Perusahaan <span className="text-xs text-gray-500">(Opsional)</span>
                </label>
                <select
                  value={filterIdPerusahaan}
                  onChange={(e) => setFilterIdPerusahaan(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 bg-white"
                  style={{ color: '#111827' }}
                >
                  <option value="all" className="text-gray-900">-- Pilih ID Perusahaan (Opsional) --</option>
                  {getIdPerusahaanOptionsByRole(userRole).map(option => (
                    <option key={option.value} value={option.value} className="text-gray-900">{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Info & Reset Button */}
            <div className="mt-4 flex items-center justify-between">
              {/* Data Count Info */}
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-semibold text-primary-600">{currentStats.total}</span> data
                {(searchQL || filterTipe !== 'all' || filterIdPerusahaan !== 'all' || selectedPeriod !== 'month') && (
                  <span className="ml-1">(terfilter)</span>
                )}
              </div>

              {/* Reset Filter Button */}
              {(searchQL || filterTipe !== 'all' || filterIdPerusahaan !== 'all' || selectedPeriod === 'custom') && (
                <button
                  onClick={() => {
                    setSearchQL('');
                    setFilterTipe('all');
                    setFilterIdPerusahaan('all');
                    setCustomDateFrom('');
                    setCustomDateTo('');
                    setSelectedPeriod('month');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Transaksi */}
        <div className={`card bg-gradient-to-br ${currentStats.bgGradient} ${currentStats.border}`}>
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${currentStats.iconBg} rounded-xl flex items-center justify-center`}>
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">Total Transaksi</p>
            <p className={`text-2xl sm:text-3xl font-bold ${currentStats.textColor}`}>
              {isLoading ? '...' : currentStats.total}
            </p>
          </div>
        </div>

        {/* Total Nominal - Responsive untuk angka panjang */}
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">Total Nominal</p>
            <div className="min-h-[40px] sm:min-h-[48px] flex items-center">
              <p className="text-emerald-700 font-bold break-words w-full">
                <span className="text-sm sm:text-base lg:text-lg">Rp</span>
                <br className="sm:hidden" />
                <span className={`${currentStats.nominal >= 1000000000
                  ? 'text-base sm:text-lg lg:text-xl'
                  : 'text-lg sm:text-xl lg:text-2xl'
                  }`}>
                  {isLoading ? '...' : formatRupiah(currentStats.nominal)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Disetujui */}
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">Disetujui</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">
              {isLoading ? '...' : currentStats.approved}
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">Pending</p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-700">
              {isLoading ? '...' : currentStats.pending}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Chart 1 - Trend */}
        <div className="card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <LineChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-800">Trend Transaksi</h3>
                  <p className="text-xs sm:text-sm text-gray-600">6 bulan terakhir</p>
                </div>
              </div>
            </div>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="Payment Request" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPR)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Kasbon" stroke="#10B981" fillOpacity={1} fill="url(#colorKasbon)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Klaim" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorKlaim)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 2 - Distribution */}
        <div className="card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-800">Distribusi Status</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Berdasarkan approval</p>
                </div>
              </div>
            </div>
            <div className="h-48 sm:h-64">
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
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
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Tidak ada data untuk ditampilkan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3 - Module Comparison */}
      <div className="card">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Perbandingan Modul</h3>
                <p className="text-xs sm:text-sm text-gray-600">Total transaksi & nominal per modul</p>
              </div>
            </div>
          </div>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar yAxisId="left" dataKey="total" name="Total Transaksi" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="nominal" name="Nominal (Rp Juta)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table - Recurring Transactions */}
      {selectedReport === 'transaksi-berulang' ? (
        <div className="card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <Repeat className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-800">Detail Transaksi Berulang</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Riwayat pembayaran berulang dengan bukti transfer</p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                <div className="flex items-center space-x-2">
                  <Repeat className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs text-cyan-600">Template Aktif</span>
                </div>
                <p className="text-xl font-bold text-cyan-700 mt-1">
                  {reportData.recurringTemplates.filter(t => t.is_active).length}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-amber-600">Belum Transfer</span>
                </div>
                <p className="text-xl font-bold text-amber-700 mt-1">
                  {filteredData.recurringInstances.filter(i => i.status === 'pending').length}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600">Sudah Transfer</span>
                </div>
                <p className="text-xl font-bold text-emerald-700 mt-1">
                  {filteredData.recurringInstances.filter(i => i.status === 'transferred').length}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-blue-600">Total Nominal</span>
                </div>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  Rp {formatRupiah(filteredData.recurringInstances.reduce((sum, i) => sum + (parseFloat(i.recurring?.template_data?.nominal) || 0), 0))}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nama Transaksi</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Jadwal</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bank Tujuan</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nominal</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Transfer Oleh</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bukti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan="8" className="py-8 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm text-gray-600">Memuat data...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredData.recurringInstances.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-8 text-center text-sm text-gray-500">
                            Tidak ada data transaksi berulang untuk periode ini
                          </td>
                        </tr>
                      ) : (
                        filteredData.recurringInstances.map((instance) => {
                          const recurring = instance.recurring;
                          const templateData = recurring?.template_data || {};
                          return (
                            <tr key={instance.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{recurring?.name || '-'}</p>
                                  <p className="text-xs text-gray-500">{templateData.tipe || '-'}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-700">
                                    {instance.scheduled_date ? new Date(instance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{templateData.nama_bank || '-'}</p>
                                  <p className="text-xs text-gray-500">{templateData.nomor_rekening || '-'}</p>
                                  <p className="text-xs text-gray-400">{templateData.nama_pemilik_rekening || '-'}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-sm font-semibold text-gray-800">
                                  Rp {formatRupiah(templateData.nominal || 0)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {instance.invoice_url ? (
                                  <a
                                    href={instance.invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs hover:bg-emerald-100 transition-colors"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>Lihat</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${instance.status === 'transferred'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : instance.status === 'skipped'
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {instance.status === 'transferred' ? 'Sudah Transfer' : instance.status === 'skipped' ? 'Dilewati' : 'Belum Transfer'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="text-sm text-gray-700">{instance.transferred_by_name || '-'}</p>
                                  {instance.transferred_at && (
                                    <p className="text-xs text-gray-500">
                                      {new Date(instance.transferred_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {instance.bukti_transfer ? (
                                  <a
                                    href={instance.bukti_transfer}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors"
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                    <span>Lihat</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Detail Table - Regular Transactions */
        <div className="card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-800">Detail Transaksi Gabungan</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Data gabungan dari Payment Request, Kasbon, dan Klaim berdasarkan Nomor QL dan Tipe</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nomor QL</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Tipe</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Jumlah Transaksi</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Detail Modul</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Total Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm text-gray-600">Memuat data...</span>
                            </div>
                          </td>
                        </tr>
                      ) : combinedData.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-sm text-gray-500">
                            Tidak ada data untuk ditampilkan
                          </td>
                        </tr>
                      ) : (
                        combinedData.map((group, groupIndex) => (
                          <React.Fragment key={groupIndex}>
                            {/* Main Row */}
                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRows(prev => ({ ...prev, [groupIndex]: !prev[groupIndex] }))}>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  {expandedRows[groupIndex] ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                  <span className="text-xs sm:text-sm font-medium text-gray-800">{group.nomor_ql}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-xs sm:text-sm font-semibold text-primary-600">{group.tipe}</span>
                              </td>
                              <td className="text-center py-3 px-4">
                                <span className="text-xs sm:text-sm font-semibold text-gray-700">{group.count}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {group.items.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-2 py-1 rounded text-xs font-medium ${item.modul === 'Payment Request' ? 'bg-blue-100 text-blue-700' :
                                        item.modul === 'Kasbon' ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-violet-100 text-violet-700'
                                        }`}
                                    >
                                      {item.modul}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="text-right py-3 px-4">
                                <span className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                                  Rp {formatRupiah(group.totalNominal)}
                                </span>
                              </td>
                            </tr>

                            {/* Expanded Detail Rows */}
                            {expandedRows[groupIndex] && (
                              <tr>
                                <td colSpan="5" className="bg-gray-50 p-0">
                                  <div className="p-4">
                                    <div className="space-y-3">
                                      {group.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="bg-white rounded-lg border border-gray-200 p-4">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Nomor Referensi</p>
                                              <p className="text-sm font-semibold text-gray-800">{item.nomorRef}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Modul</p>
                                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${item.modul === 'Payment Request' ? 'bg-blue-100 text-blue-700' :
                                                item.modul === 'Kasbon' ? 'bg-emerald-100 text-emerald-700' :
                                                  'bg-violet-100 text-violet-700'
                                                }`}>
                                                {item.modul}
                                              </span>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Nama Karyawan</p>
                                              <p className="text-sm font-medium text-gray-800">{item.nama_karyawan || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Nominal</p>
                                              <p className="text-sm font-semibold text-primary-600">Rp {formatRupiah(item.nominal)}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Tanggal</p>
                                              <p className="text-sm text-gray-700">
                                                {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Status Approval</p>
                                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${item.status_approval === 'Approved' ? 'bg-green-100 text-green-700' :
                                                item.status_approval === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                  'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {item.status_approval || 'Pending'}
                                              </span>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">Status Transfer</p>
                                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${item.status_transfer === 'Sudah Transfer' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                                }`}>
                                                {item.status_transfer || 'Belum Transfer'}
                                              </span>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">ID Perusahaan</p>
                                              <p className="text-sm text-gray-700">{item.id_perusahaan || '-'}</p>
                                            </div>
                                            {item.keterangan && (
                                              <div className="col-span-full">
                                                <p className="text-xs text-gray-500 mb-1">Keterangan</p>
                                                <p className="text-sm text-gray-700">{item.keterangan}</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-600 border-0">
        <div className="p-4 sm:p-6 text-white">
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg mb-1">Laporan Real-time</h3>
              <p className="text-primary-100 text-xs sm:text-sm leading-relaxed">
                Data laporan ini di-update secara real-time berdasarkan transaksi yang masuk ke sistem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Laporan;
