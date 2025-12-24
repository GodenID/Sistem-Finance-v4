import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, X, ChevronLeft, ChevronRight, Banknote, Wallet, FileText, Paperclip, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS } from '../constants/companyTypes';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';

import { uploadFile } from '../lib/api';

const Klaim = () => {
  const navigate = useNavigate();
  const { userName, userRole } = useAuth();
  const { showToast } = useToast();
  const isGuest = userRole === 'guest';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKlaim, setSelectedKlaim] = useState(null);

  // State untuk form Klaim
  const [formData, setFormData] = useState({
    nomorQl: '',
    tipe: '',
    idPerusahaan: '',
    namaKaryawan: isGuest ? '' : userName || '', // Untuk guest harus diinput manual
    nominal: '',
    metodePembayaran: '',
    namaBank: '',
    nomorRekening: '',
    namaPemilikRekening: '',
    lampiran: null, // Will store R2 URL
    keterangan: '',
  });

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);



  // Data Klaim dari Supabase (akan di-fetch nanti)
  const [klaimRequests, setKlaimRequests] = useState([]);

  // Stats calculation
  const stats = [
    { label: 'Total Klaim', value: klaimRequests.length.toString(), color: 'bg-violet-50 text-violet-600' },
    { label: 'Belum Transfer', value: klaimRequests.filter(kl => kl.statusTransfer === 'Belum Transfer').length.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Sudah Transfer', value: klaimRequests.filter(kl => kl.statusTransfer === 'Sudah Transfer').length.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: klaimRequests.filter(kl => kl.statusApproval === 'Approved').length.toString(), color: 'bg-blue-50 text-blue-600' },
  ];

  const getStatusApprovalBadge = (status) => {
    const badges = {
      'Pending': 'bg-amber-50 text-amber-700',
      'Approved': 'bg-emerald-50 text-emerald-700',
      'Rejected': 'bg-rose-50 text-rose-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>{status}</span>;
  };

  const getStatusTransferBadge = (status) => {
    const badges = {
      'Belum Transfer': 'bg-gray-100 text-gray-700',
      'Sudah Transfer': 'bg-blue-50 text-blue-700',
      'Tidak Transfer': 'bg-rose-50 text-rose-700',
      'Reject': 'bg-rose-50 text-rose-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>{status}</span>;
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const generateNomorKlaim = () => {
    if (klaimRequests.length === 0) {
      return 'KLM-0001';
    }
    // Cari nomor Klaim terbesar dari semua data
    const maxNumber = klaimRequests.reduce((max, kl) => {
      const klNumber = parseInt(kl.nomorKlaim.split('-')[1]) || 0;
      return klNumber > max ? klNumber : max;
    }, 0);
    const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
    return `KLM-${nextNumber}`;
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Reset bank fields jika Cash dipilih
    if (name === 'metodePembayaran' && value === 'Cash') {
      setFormData(prev => ({
        ...prev,
        namaBank: '',
        nomorRekening: '',
        namaPemilikRekening: ''
      }));
    }
  };

  const handleNominalChange = (e) => {
    const value = e.target.value.replace(/\./g, '');
    if (!isNaN(value)) {
      setFormData(prev => ({
        ...prev,
        nominal: value
      }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(`File terlalu besar. Maksimal ${(maxSize / 1024 / 1024).toFixed(0)}MB`, 'error');
        e.target.value = '';
        return;
      }

      setUploadingFile(true);
      setFileName(file.name);
      setFileSize(file.size);
      setUploadProgress(0);

      try {
        const nomorKlaim = formData.nomorKlaim || generateNomorKlaim();

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadFile(file, 'klaim', nomorKlaim);

        clearInterval(progressInterval);
        setUploadProgress(100);

        setFormData(prev => ({ ...prev, lampiran: result.url }));
        showToast('File berhasil diupload', 'success');
      } catch (error) {
        console.error('Error uploading file:', error);
        showToast('Gagal mengupload file: ' + (error.message || 'Silakan coba lagi'), 'error');
        setFileName('');
        setFileSize(0);
        setFormData(prev => ({ ...prev, lampiran: null }));
        e.target.value = '';
      } finally {
        setUploadingFile(false);
        setUploadProgress(0);
        setTimeout(() => setFileSize(0), 1000);
      }
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };



  // Handle download lampiran
  const handleDownloadLampiran = async (fileUrl) => {
    if (!fileUrl) {
      showToast('Tidak ada file lampiran', 'error');
      return;
    }

    let url = fileUrl;
    if (!url.startsWith('http')) {
      const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';
      if (r2PublicUrl) {
        const baseUrl = r2PublicUrl.endsWith('/') ? r2PublicUrl.slice(0, -1) : r2PublicUrl;
        url = `${baseUrl}/${url}`;
      } else {
        showToast('URL file tidak valid', 'error');
        return;
      }
    }

    try {
      // Coba download dengan fetch, dengan timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': '*/*'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = url.split('/').pop() || 'file';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }, 100);

      showToast('File berhasil didownload', 'success');
    } catch (error) {
      console.error('Error downloading file:', error);

      // Jika fetch gagal, coba langsung buka di tab baru
      const link = document.createElement('a');
      link.href = url;
      link.download = url.split('/').pop() || 'file';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Membuka file untuk download', 'info');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validasi form
      if (!formData.nominal || !formData.tipe) {
        showToast('Mohon lengkapi semua field yang wajib diisi', 'error');
        return;
      }

      // TODO: Simpan ke Supabase
      // await createRecord('klaim', formData);

      console.log('Submit Klaim:', formData);
      setShowModal(false);
      // Reset form
      setFormData({
        nomorQl: '',
        tipe: '',
        idPerusahaan: '',
        nominal: '',
        namaKaryawan: isGuest ? '' : userName || '',
        metodePembayaran: '',
        namaBank: '',
        nomorRekening: '',
        namaPemilikRekening: '',
        lampiran: null,
        keterangan: '',
      });
      setFileName('');
      showToast('Klaim berhasil ditambahkan', 'success');
    } catch (error) {
      console.error('Error adding klaim:', error);
      showToast('Gagal menambahkan Klaim', 'error');
    }
  };

  const handleDetail = (klaim) => {
    setSelectedKlaim(klaim);
    setShowDetailModal(true);
  };

  // Filter dan Search
  const getFilteredAndSearchedData = () => {
    // Sort by newest first (based on Nomor Klaim descending)
    let filtered = [...klaimRequests].sort((a, b) => {
      const numA = parseInt(a.nomorKlaim.split('-')[1]) || 0;
      const numB = parseInt(b.nomorKlaim.split('-')[1]) || 0;
      return numB - numA;
    });

    if (filterStatus !== 'all') {
      if (filterStatus === 'belum-transfer') {
        filtered = filtered.filter(kl => kl.statusTransfer === 'Belum Transfer');
      } else if (filterStatus === 'sudah-transfer') {
        filtered = filtered.filter(kl => kl.statusTransfer === 'Sudah Transfer');
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(kl =>
        kl.nomorKlaim.toLowerCase().includes(term) ||
        kl.nomorQl.toLowerCase().includes(term) ||
        kl.namaKaryawan.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const filteredKlaimRequests = getFilteredAndSearchedData();

  // Pagination
  const totalPages = Math.ceil(filteredKlaimRequests.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredKlaimRequests.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Klaim Reimbursement</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Kelola pengajuan klaim karyawan</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium">Ajukan Klaim</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="p-4 sm:p-6">
              <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${stat.color} mb-2 sm:mb-3`}>
                <span className="text-base sm:text-xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="p-6 space-y-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nomor Klaim, Nomor QL, atau Nama Karyawan..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700 mr-2">Filter Status Transfer:</span>
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Semua ({klaimRequests.length})
            </button>
            <button
              onClick={() => handleFilterChange('belum-transfer')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'belum-transfer'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Belum Transfer ({klaimRequests.filter(kl => kl.statusTransfer === 'Belum Transfer').length})
            </button>
            <button
              onClick={() => handleFilterChange('sudah-transfer')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'sudah-transfer'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Sudah Transfer ({klaimRequests.filter(kl => kl.statusTransfer === 'Sudah Transfer').length})
            </button>

            {(filterStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Result Info */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-600">
              Menampilkan <span className="font-semibold text-gray-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, filteredKlaimRequests.length)}</span> dari <span className="font-semibold text-gray-800">{filteredKlaimRequests.length}</span> klaim
              {filteredKlaimRequests.length !== klaimRequests.length && (
                <span className="text-gray-500"> (Total: {klaimRequests.length})</span>
              )}
            </p>
            {searchTerm && (
              <p className="text-gray-600">
                Hasil pencarian untuk: <span className="font-semibold text-violet-600">"{searchTerm}"</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Klaim</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor QL</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipe</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">ID Perusahaan</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Karyawan</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nominal</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Metode</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Informasi Bank</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Lampiran</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Keterangan</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Approval</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Oleh</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Bukti Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((klaim) => (
                      <tr key={klaim.nomorKlaim} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="text-sm font-bold text-violet-600">{klaim.nomorKlaim}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{klaim.nomorQl}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-600">{klaim.tanggal}</span>
                        </td>
                        <td className="py-4 px-6">
                          <TipeBadge tipe={klaim.tipe} size="sm" />
                        </td>
                        <td className="py-4 px-6">
                          <IdPerusahaanBadge idPerusahaan={klaim.idPerusahaan} size="sm" showFullName={true} />
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700 font-medium">{klaim.namaKaryawan}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatRupiah(klaim.nominal)}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {klaim.metodePembayaran === 'Transfer' ? (
                            <div className="flex items-center justify-center space-x-1">
                              <Banknote className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-medium text-blue-700">Transfer</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-1">
                              <Wallet className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-medium text-emerald-700">Cash</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {klaim.metodePembayaran === 'Transfer' ? (
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-gray-800">{klaim.namaBank}</p>
                              <p className="text-xs text-gray-600 font-mono">{klaim.nomorRekening}</p>
                              <p className="text-xs text-gray-500">{klaim.namaPemilikRekening}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {klaim.lampiran ? (
                            <a
                              href={klaim.lampiran}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center space-x-1 hover:bg-emerald-50 p-1 rounded transition-colors"
                              title="Lihat Lampiran"
                            >
                              <Paperclip className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-medium text-emerald-700">Ada</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-gray-600 line-clamp-2" title={klaim.keterangan}>
                            {klaim.keterangan || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusApprovalBadge(klaim.statusApproval)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{klaim.disetujuiOleh}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusTransferBadge(klaim.statusTransfer)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {klaim.buktiTransfer ? (
                            <a
                              href={klaim.buktiTransfer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center space-x-1 hover:bg-blue-50 p-1 rounded transition-colors"
                              title="Lihat Bukti Transfer"
                            >
                              <Paperclip className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-medium text-blue-700">Lihat</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleDetail(klaim)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Detail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="15" className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-gray-600 font-medium">Tidak ada data ditemukan</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {searchTerm
                                ? `Tidak ada hasil untuk "${searchTerm}"`
                                : 'Tidak ada klaim dengan filter yang dipilih'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {filteredKlaimRequests.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman <span className="font-semibold text-gray-800">{currentPage}</span> dari <span className="font-semibold text-gray-800">{totalPages}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-1">
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                    if (endPage - startPage < maxVisible - 1) {
                      startPage = Math.max(1, endPage - maxVisible + 1);
                    }

                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => handlePageChange(1)}
                          className="w-10 h-10 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pages.push(<span key="dots1" className="px-2 text-gray-400">...</span>);
                      }
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${currentPage === i
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {i}
                        </button>
                      );
                    }

                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(<span key="dots2" className="px-2 text-gray-400">...</span>);
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => handlePageChange(totalPages)}
                          className="w-10 h-10 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-sm text-gray-600">
                {itemsPerPage} per halaman
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form Create */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-500 to-violet-600">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Ajukan Klaim Baru</h2>
                  <p className="text-sm text-white/80 mt-1">Isi form untuk mengajukan klaim</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 grid grid-cols-2 gap-4">
              {/* Nomor Klaim (Auto) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Klaim</label>
                <input
                  type="text"
                  value={generateNomorKlaim()}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Nomor otomatis ter-generate</p>
              </div>

              {/* Nomor QL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor QL <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nomorQl"
                  value={formData.nomorQl}
                  onChange={handleInputChange}
                  placeholder="Contoh: 12345"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Tanggal (Auto) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
                <input
                  type="date"
                  value={getCurrentDate()}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Tanggal hari ini otomatis terisi</p>
              </div>

              {/* Tipe */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe <span className="text-red-500">*</span></label>
                <select
                  name="tipe"
                  value={formData.tipe}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  <option value="">Pilih Tipe</option>
                  {TIPE_OPTIONS.map((tipe) => (
                    <option key={tipe.value} value={tipe.value}>
                      {tipe.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ID Perusahaan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID Perusahaan <span className="text-red-500">*</span></label>
                <select
                  name="idPerusahaan"
                  value={formData.idPerusahaan}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  <option value="">Pilih ID Perusahaan</option>
                  {ID_PERUSAHAAN_OPTIONS.map((company) => (
                    <option key={company.value} value={company.value}>
                      {company.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nama Karyawan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Karyawan {isGuest && <span className="text-red-500">*</span>}
                </label>
                {isGuest ? (
                  <input
                    type="text"
                    name="namaKaryawan"
                    value={formData.namaKaryawan}
                    onChange={handleInputChange}
                    placeholder="Masukkan nama karyawan"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type="text"
                    value={userName || ''}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {isGuest ? 'Input manual untuk role guest' : 'Otomatis dari user yang login'}
                </p>
              </div>

              {/* Nominal */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nominal <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nominal"
                  value={formatRupiah(formData.nominal || 0)}
                  onChange={handleNominalChange}
                  placeholder="Contoh: 100.000"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Format otomatis dengan pemisah ribuan</p>
              </div>

              {/* Metode Pembayaran */}
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Pembayaran <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'metodePembayaran', value: 'Transfer' } })}
                    className={`flex items-center justify-center space-x-3 p-4 rounded-lg border-2 transition-all ${formData.metodePembayaran === 'Transfer'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    <Banknote className={`w-6 h-6 ${formData.metodePembayaran === 'Transfer' ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`font-medium ${formData.metodePembayaran === 'Transfer' ? 'text-blue-700' : 'text-gray-700'}`}>
                      Transfer Bank
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange({ target: { name: 'metodePembayaran', value: 'Cash' } })}
                    className={`flex items-center justify-center space-x-3 p-4 rounded-lg border-2 transition-all ${formData.metodePembayaran === 'Cash'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    <Wallet className={`w-6 h-6 ${formData.metodePembayaran === 'Cash' ? 'text-emerald-600' : 'text-gray-600'}`} />
                    <span className={`font-medium ${formData.metodePembayaran === 'Cash' ? 'text-emerald-700' : 'text-gray-700'}`}>
                      Cash / Tunai
                    </span>
                  </button>
                </div>
              </div>

              {/* Conditional Bank Fields */}
              {formData.metodePembayaran === 'Transfer' && (
                <>
                  <div className="col-span-2 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                      <Banknote className="w-5 h-5 mr-2 text-blue-600" />
                      Informasi Bank
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Bank <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="namaBank"
                      value={formData.namaBank}
                      onChange={handleInputChange}
                      placeholder="Contoh: BCA, Mandiri, BNI"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Rekening <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="nomorRekening"
                      value={formData.nomorRekening}
                      onChange={handleInputChange}
                      placeholder="Contoh: 1234567890"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pemilik Rekening <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="namaPemilikRekening"
                      value={formData.namaPemilikRekening}
                      onChange={handleInputChange}
                      placeholder="Nama sesuai rekening bank"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {/* Lampiran */}
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lampiran <span className="text-red-500">*</span></label>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-3">
                    <label className={`flex-1 flex items-center justify-center space-x-3 px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${uploadingFile
                      ? 'border-violet-300 bg-violet-50 cursor-wait'
                      : 'border-gray-300 hover:border-violet-500 hover:bg-violet-50 cursor-pointer'
                      }`}>
                      <Paperclip className={`w-5 h-5 ${uploadingFile ? 'text-violet-600 animate-pulse' : 'text-gray-500'}`} />
                      <span className={`text-sm ${uploadingFile ? 'text-violet-700 font-medium' : 'text-gray-600'}`}>
                        {uploadingFile ? 'Mengupload file...' : fileName ? fileName : 'Pilih file atau drag & drop di sini'}
                      </span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={uploadingFile}
                        required
                      />
                    </label>
                    {fileName && !uploadingFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setFileName('');
                          setFileSize(0);
                          setFormData(prev => ({ ...prev, lampiran: null }));
                        }}
                        className="p-2.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                        title="Hapus file"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {uploadingFile && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-violet-700">Mengupload...</span>
                        <span className="text-sm text-violet-600">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-violet-200 rounded-full h-2">
                        <div
                          className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      {fileSize > 0 && (
                        <p className="text-xs text-violet-600 mt-2">
                          Ukuran file: {formatFileSize(fileSize)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* File Info */}
                  {fileName && fileSize > 0 && !uploadingFile && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">{fileName}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatFileSize(fileSize)}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Format: PDF, Word, Excel, atau Gambar (Max 10MB)
                  </p>

                  {formData.lampiran && !uploadingFile && (
                    <div className="flex items-center space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <span className="text-sm font-medium text-emerald-700">File berhasil diupload</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Keterangan */}
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan <span className="text-red-500">*</span></label>
                <textarea
                  name="keterangan"
                  value={formData.keterangan}
                  onChange={handleInputChange}
                  placeholder="Masukkan keterangan keperluan klaim..."
                  required
                  rows="4"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">Jelaskan keperluan dan detail klaim</p>
              </div>

              {/* Modal Footer */}
              <div className="col-span-2 flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors"
                >
                  Ajukan Klaim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {showDetailModal && selectedKlaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-500 to-violet-600">
              <div>
                <h2 className="text-2xl font-bold text-white">Detail Klaim</h2>
                <p className="text-sm text-white/80 mt-1">{selectedKlaim.nomorKlaim}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Info Klaim */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-violet-600 rounded mr-3"></span>
                  Informasi Klaim
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor Klaim</label>
                    <p className="text-lg font-bold text-violet-600 mt-1">{selectedKlaim.nomorKlaim}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor QL</label>
                    <p className="text-lg font-semibold text-gray-800 mt-1">{selectedKlaim.nomorQl}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</label>
                    <p className="text-base text-gray-700 mt-1">{selectedKlaim.tanggal}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</label>
                    <div className="mt-1">
                      <TipeBadge tipe={selectedKlaim.tipe} size="md" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Perusahaan</label>
                    <div className="mt-1">
                      <IdPerusahaanBadge idPerusahaan={selectedKlaim.idPerusahaan} size="md" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Karyawan</label>
                    <p className="text-base font-medium text-gray-700 mt-1">{selectedKlaim.namaKaryawan}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Metode Pembayaran</label>
                    <p className="text-base text-gray-700 mt-1">
                      {selectedKlaim.metodePembayaran === 'Transfer' ? (
                        <span className="inline-flex items-center space-x-1 text-blue-700">
                          <Banknote className="w-4 h-4" />
                          <span>Transfer Bank</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-emerald-700">
                          <Wallet className="w-4 h-4" />
                          <span>Cash / Tunai</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nominal</label>
                    <p className="text-3xl font-bold text-gray-800 mt-1">Rp {formatRupiah(selectedKlaim.nominal)}</p>
                  </div>
                </div>
              </div>

              {/* Informasi Bank (Conditional) */}
              {selectedKlaim.metodePembayaran === 'Transfer' && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-1 h-6 bg-blue-600 rounded mr-3"></span>
                    Informasi Bank
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center">
                          <Banknote className="w-3.5 h-3.5 mr-1" />
                          Nama Bank
                        </label>
                        <p className="text-lg font-bold text-gray-800 mt-2">{selectedKlaim.namaBank}</p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Nomor Rekening</label>
                        <p className="text-2xl font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded-lg border border-blue-200 mt-2">
                          {selectedKlaim.nomorRekening}
                        </p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Nama Pemilik Rekening</label>
                        <p className="text-lg font-semibold text-gray-800 mt-2 bg-white px-4 py-2 rounded-lg border border-blue-200">
                          {selectedKlaim.namaPemilikRekening}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Keterangan & Lampiran */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-emerald-600 rounded mr-3"></span>
                  Keterangan & Lampiran
                </h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center mb-2">
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      Keterangan
                    </label>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedKlaim.keterangan || '-'}
                    </p>
                  </div>

                  {selectedKlaim.lampiran && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center mb-3">
                        <Paperclip className="w-3.5 h-3.5 mr-1" />
                        Lampiran Dokumen
                      </label>
                      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-emerald-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {selectedKlaim.lampiran?.startsWith('http')
                                ? selectedKlaim.lampiran.split('/').pop()
                                : selectedKlaim.lampiran}
                            </p>
                            <p className="text-xs text-gray-500">Dokumen pendukung</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={selectedKlaim.lampiran}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-white border border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-medium flex items-center space-x-2"
                            title="Lihat File"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Lihat</span>
                          </a>
                          <button
                            onClick={() => handleDownloadLampiran(selectedKlaim.lampiran)}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center space-x-2"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-amber-600 rounded mr-3"></span>
                  Status & Approval
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Approval</label>
                    <p className="mt-2">{getStatusApprovalBadge(selectedKlaim.statusApproval)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disetujui Oleh</label>
                    <p className="text-base text-gray-700 mt-1">{selectedKlaim.disetujuiOleh}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Transfer</label>
                    <p className="mt-2">{getStatusTransferBadge(selectedKlaim.statusTransfer)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Klaim;
