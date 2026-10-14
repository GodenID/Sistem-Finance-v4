import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, X, ChevronLeft, ChevronRight, Banknote, Wallet, FileText, Paperclip, Download, CheckCircle, XCircle, Upload, Edit2, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS, getTipeOptionsByRole, getIdPerusahaanOptionsByRole } from '../constants/companyTypes';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';
import QLInfo from '../components/QLInfo';
import QLLink from '../components/QLLink';

import { createRecord, updateRecord, deleteRecord, bulkDeleteRecords, uploadFile, countRecords } from '../lib/api';
import { usePaginatedTable } from '../hooks/usePaginatedTable';
import { logActivity } from '../lib/auditLog';
import { deleteFilesOfRecords, deleteReplacedFiles, deleteR2Files, uploadThenSave } from '../utils/fileCleanup';
import ConfirmDialog from '../components/ConfirmDialog';
import PasteUpload from '../components/PasteUpload';
import MultiFileUpload from '../components/MultiFileUpload';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { generateKlaimNumber } from '../utils/generateUniqueNumber';
import { sendTransferNotification } from '../lib/emailNotifications';
import { formatTanggalJamPendek, getStatusBadgeClass, calcDurations } from '../lib/approvalFlow';


const Klaim = () => {
  const navigate = useNavigate();
  const { userName, userRole, userId, hasPermission } = useAuth();
  const { showToast } = useToast();
  const { refreshNotifications } = useNotification();
  const isGuest = userRole === 'guest';
  // Permission per-user (default mengikuti role, bisa dioverride Administrator dari halaman Karyawan)
  const isFinance = hasPermission ? hasPermission('transfer') : userRole === 'team_finance';
  const canManage = hasPermission ? hasPermission('approve') : ['administrator', 'manager', 'bod'].includes(userRole);
  const canApproveManager = hasPermission ? (hasPermission('approve_manager') || hasPermission('approve')) : ['administrator', 'manager', 'bod'].includes(userRole);
  const canApproveHead = hasPermission ? (hasPermission('approve_head_finance') || hasPermission('approve')) : ['administrator', 'head_finance'].includes(userRole);
  const isAdmin = userRole?.toLowerCase() === 'administrator';
  const canEditDelete = hasPermission ? hasPermission('edit_klaim') : ['administrator', 'bod', 'team_finance'].includes(userRole?.toLowerCase());
  // Only Admin & BOD can delete
  const canDelete = hasPermission ? hasPermission('delete_klaim') : ['administrator', 'bod'].includes(userRole?.toLowerCase());

  // Helper to check if record is locked
  const isLocked = (record) => {
    if (isAdmin) return false;
    return record.statusTransfer === 'Sudah Transfer';
  };
  const canViewConfidential = hasPermission ? hasPermission('view_confidential') : ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const ITEMS_PER_PAGE = 10;
  const [showModal, setShowModal] = useState(false);

  // State untuk bulk delete (hanya Administrator)
  const [selectedItems, setSelectedItems] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // State untuk confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => { }
  });

  // State untuk modal bukti transfer
  const [showBuktiTransferModal, setShowBuktiTransferModal] = useState(false);
  const [transferringKlaim, setTransferringKlaim] = useState(null);
  const [buktiTransferFile, setBuktiTransferFile] = useState(null);
  const [buktiTransferFileName, setBuktiTransferFileName] = useState('');
  const [uploadingBuktiTransfer, setUploadingBuktiTransfer] = useState(false);

  // State untuk mencegah double submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk editing
  const [editingKlaim, setEditingKlaim] = useState(null);

  // State untuk form Klaim
  const [formData, setFormData] = useState({
    nomorQl: '',
    namaEvent: '', // Field wajib untuk nama event/project
    tipe: '',
    idPerusahaan: '',
    namaKaryawan: isGuest ? '' : userName || '',
    nominal: '',
    metodePembayaran: '',
    namaBank: '',
    nomorRekening: '',
    namaPemilikRekening: '',
    lampiran: [], // Array untuk multiple files
    keterangan: '',
  });

  // State untuk detail pengeluaran
  const [expenseItems, setExpenseItems] = useState([{ nama: '', nominal: '' }]);

  // State untuk multiple files upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUploadProgress, setFileUploadProgress] = useState({});

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatedNomorKlaim, setGeneratedNomorKlaim] = useState(''); // Pre-generated nomor klaim for file path

  // Calculate total from expense items
  const calculateTotal = () => {
    return expenseItems.reduce((total, item) => {
      const itemNominal = parseInt(item.nominal.toString().replace(/\./g, '')) || 0;
      return total + itemNominal;
    }, 0);
  };

  // Update formData.nominal when expense items change
  useEffect(() => {
    const total = calculateTotal();
    setFormData(prev => ({ ...prev, nominal: total.toString() }));
  }, [expenseItems]);

  // Handle expense item change
  const handleExpenseItemChange = (index, field, value) => {
    const newItems = [...expenseItems];
    if (field === 'nominal') {
      // Remove dots and format
      const cleanValue = value.replace(/\./g, '');
      if (!isNaN(cleanValue)) {
        newItems[index][field] = cleanValue;
      }
    } else {
      newItems[index][field] = value;
    }
    setExpenseItems(newItems);
  };

  // Add new expense item
  const addExpenseItem = () => {
    setExpenseItems([...expenseItems, { nama: '', nominal: '' }]);
  };

  // Remove expense item
  const removeExpenseItem = (index) => {
    if (expenseItems.length > 1) {
      const newItems = expenseItems.filter((_, i) => i !== index);
      setExpenseItems(newItems);
    }
  };



  // Pagination + search + filter di server (Supabase .range/.or),
  // browser hanya menerima 1 halaman (10 row), bukan ribuan row.
  // Kolom search default SEARCH_COLUMNS.klaim: nomor_klaim, nomor_ql, nama_karyawan, nama_event, keterangan.
  const transformKlaimRow = useCallback((item) => {
    let detailPengeluaran = [];
    if (item.detail_pengeluaran) {
      try {
        detailPengeluaran = typeof item.detail_pengeluaran === 'string'
          ? JSON.parse(item.detail_pengeluaran)
          : item.detail_pengeluaran;
        if (!Array.isArray(detailPengeluaran)) detailPengeluaran = [];
      } catch {
        detailPengeluaran = [];
      }
    }
    return {
      id: item.id,
      nomorKlaim: item.nomor_klaim,
      nomorQl: item.nomor_ql || '',
      namaEvent: item.nama_event || '',
      tanggal: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
      tanggalJam: formatTanggalJamPendek(item.created_at),
      manager_approved_at: item.manager_approved_at || null,
      manager_approved_by: item.manager_approved_by || null,
      head_finance_approved_at: item.head_finance_approved_at || null,
      head_finance_approved_by: item.head_finance_approved_by || null,
      transferred_at: item.transferred_at || null,
      completed_at: item.completed_at || null,
      rejected_at: item.rejected_at || null,
      rejected_by: item.rejected_by || null,
      tipe: item.tipe || '',
      idPerusahaan: item.id_perusahaan || '',
      nominal: parseFloat(item.nominal) || 0,
      statusApproval: item.status_approval || 'Pending',
      disetujuiOleh: item.nama_approver || '-',
      disetujuiHeadFinance: item.head_finance_approved_by || '-',
      statusTransfer: item.status_transfer || 'Belum Transfer',
      keterangan: item.keterangan || '',
      lampiran: item.lampiran || null,
      buktiTransfer: item.bukti_transfer || null,
      namaKaryawan: item.nama_karyawan || '',
      user_id: item.user_id || null,
      metodePembayaran: item.metode_pembayaran || '',
      namaBank: item.nama_bank || '',
      nomorRekening: item.nomor_rekening || '',
      namaPemilikRekening: item.nama_pemilik_rekening || '',
      isConfidential: item.is_confidential || false,
      detailPengeluaran: detailPengeluaran
    };
  }, []);

  const serverFilters = useMemo(() => {
    const f = {};
    if (filterStatus === 'belum-transfer') f.status_transfer = 'Belum Transfer';
    if (filterStatus === 'sudah-transfer') f.status_transfer = 'Sudah Transfer';
    if (dateFrom) f.start_date = dateFrom;
    if (dateTo) f.end_date = dateTo;
    return f;
  }, [filterStatus, dateFrom, dateTo]);

  const {
    items: klaimRequests,
    totalCount,
    totalPages,
    page: currentPage,
    setPage: setCurrentPage,
    search: searchTerm,
    setSearch: setSearchTerm,
    setFilters: setServerFilters,
    loading: isLoadingKlaim,
    refresh: refreshPage,
    applyInsert,
    applyUpdate,
    applyDelete,
  } = usePaginatedTable('klaim', {
    limit: ITEMS_PER_PAGE,
    transform: transformKlaimRow,
  });

  // Terapkan filter status + tanggal UI ke query server (reset ke halaman 1)
  useEffect(() => {
    setServerFilters(serverFilters);
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, dateFrom, dateTo]);

  // Statistik kartu via HEAD count (4 request ringan, tanpa download row).
  const [klaimStats, setKlaimStats] = useState({ total: 0, belum: 0, sudah: 0, approved: 0 });
  const refreshStats = useCallback(async () => {
    try {
      const [total, belum, sudah, approved] = await Promise.all([
        countRecords('klaim'),
        countRecords('klaim', { status_transfer: 'Belum Transfer' }),
        countRecords('klaim', { status_transfer: 'Sudah Transfer' }),
        countRecords('klaim', { status_approval: 'Approved' }),
      ]);
      setKlaimStats({ total, belum, sudah, approved });
    } catch (e) {
      console.error('Error fetching klaim stats:', e);
    }
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  const refreshData = useCallback(async () => {
    await Promise.all([refreshPage(), refreshStats()]);
  }, [refreshPage, refreshStats]);

  // Realtime: update halaman aktif saja, tanpa refetch full.
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      applyInsert(transformKlaimRow(newRecord));
      refreshStats();
      showToast('Data klaim baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      const patch = transformKlaimRow(newRecord);
      applyUpdate(newRecord.id, patch);
      refreshStats();
      showToast('Data klaim diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      applyDelete(oldRecord.id);
      refreshStats();
      showToast('Data klaim dihapus', 'info');
    }
    refreshNotifications();
  }, [applyInsert, applyUpdate, applyDelete, transformKlaimRow, refreshStats, refreshNotifications, showToast]);

  useRealtimeSubscription('klaim', { onAnyChange: handleRealtimeChange });

  // Stats calculation (dari HEAD count, bukan dari array halaman)
  const stats = [
    { label: 'Total Klaim', value: klaimStats.total.toString(), color: 'bg-violet-50 text-violet-600' },
    { label: 'Belum Transfer', value: klaimStats.belum.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Sudah Transfer', value: klaimStats.sudah.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: klaimStats.approved.toString(), color: 'bg-blue-50 text-blue-600' },
  ];

  const getStatusApprovalBadge = (status) => {
    const badges = {
      'Pending': 'bg-amber-50 text-amber-700',
      'Manager Approved': 'bg-blue-50 text-blue-700',
      'Approved': 'bg-emerald-50 text-emerald-700',
      'Rejected': 'bg-rose-50 text-rose-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
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

  const parseLampiran = (lampiran) => {
    if (!lampiran) return [];
    try {
      const parsed = typeof lampiran === 'string' ? JSON.parse(lampiran) : lampiran;
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [parsed];
    } catch {
      return [lampiran];
    }
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

    // Auto-set ID Perusahaan tidak diperlukan lagi - semua options ditampilkan

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

  // Handle multiple files change from MultiFileUpload component
  const handleFilesChange = (newFiles) => {
    setSelectedFiles(newFiles);
  };

  // Upload all selected files before submit
  const uploadAllFiles = async (nomorKlaim) => {
    if (selectedFiles.length === 0) return [];

    setUploadingFile(true);
    const uploadedUrls = [];
    const newProgress = {};

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        newProgress[file.name] = 0;
        setFileUploadProgress({ ...newProgress });

        // Simulate progress
        const progressInterval = setInterval(() => {
          newProgress[file.name] = Math.min((newProgress[file.name] || 0) + 10, 90);
          setFileUploadProgress({ ...newProgress });
        }, 100);

        try {
          const result = await uploadFile(file, 'klaim', nomorKlaim, userName);

          newProgress[file.name] = 100;
          setFileUploadProgress({ ...newProgress });

          uploadedUrls.push(result.url);
        } catch (fileError) {
          // Tandai file yang gagal agar user tahu file mana yang bermasalah,
          // lalu batalkan dengan pesan yang jelas (tidak ngestuck diam-diam)
          newProgress[file.name] = 0;
          setFileUploadProgress({ ...newProgress });
          throw new Error(`Upload "${file.name}" gagal: ${fileError?.message || 'Silakan coba lagi'}`);
        } finally {
          // WAJIB clear — sebelumnya interval bocor saat upload gagal
          // sehingga progress jalan terus & tombol stuck
          clearInterval(progressInterval);
        }
      }
      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setUploadingFile(false);
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

    // Cegah double submit
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validasi form
      if (!formData.nominal || !formData.tipe || !formData.namaEvent) {
        showToast('Mohon lengkapi semua field yang wajib diisi (termasuk Nama Event/Project)', 'error');
        return;
      }

      // Jika sedang edit, update data yang ada
      if (editingKlaim) {
        // Saat edit: pertahankan nama karyawan asli, jangan overwrite dengan nama admin
        const namaKaryawanValue = formData.namaKaryawan || '';
        // Upload new files if any
        let uploadedUrls = [...(formData.lampiran || [])];
        let newUrls = [];
        if (selectedFiles.length > 0) {
          newUrls = await uploadAllFiles(editingKlaim.nomorKlaim);
          uploadedUrls = [...uploadedUrls, ...newUrls];
        }

        const updateData = {
          nomor_ql: formData.nomorQl || null,
          nama_event: formData.namaEvent,
          tipe: formData.tipe,
          id_perusahaan: formData.idPerusahaan || null,
          nominal: parseFloat(formData.nominal),
          metode_pembayaran: formData.metodePembayaran || null,
          nama_bank: formData.namaBank || null,
          nomor_rekening: formData.nomorRekening || null,
          nama_pemilik_rekening: formData.namaPemilikRekening || null,
          lampiran: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
          keterangan: formData.keterangan || null,
          detail_pengeluaran: JSON.stringify(expenseItems.filter(item => item.nama && item.nominal)),
          nama_karyawan: namaKaryawanValue
        };

        try {
          await updateRecord('klaim', editingKlaim.id, updateData);
        } catch (updateErr) {
          // Update gagal — hapus file yang baru diupload agar tidak yatim
          await deleteR2Files(newUrls);
          throw updateErr;
        }
        // Hapus file lama yang sudah tidak dipakai lagi (best-effort)
        await deleteReplacedFiles(editingKlaim.lampiran, uploadedUrls);

        // Log activity untuk UPDATE
        await logActivity({
          tableName: 'klaim',
          recordId: editingKlaim.id,
          recordNumber: editingKlaim.nomorKlaim,
          action: 'update',
          fieldChanged: 'multiple',
          oldValue: `Nominal: Rp ${editingKlaim.nominal.toLocaleString('id-ID')}`,
          newValue: `Nominal: Rp ${parseFloat(formData.nominal).toLocaleString('id-ID')}`,
          changedBy: userId,
          changedByName: userName
        });

        showToast('Klaim berhasil diperbarui', 'success');
      } else {
        // Generate unique nomor klaim at submit time to prevent conflicts
        const nomorKlaim = generatedNomorKlaim || generateKlaimNumber();

        // Upload all selected files
        let uploadedUrls = [];
        if (selectedFiles.length > 0) {
          uploadedUrls = await uploadAllFiles(nomorKlaim);
        }

        // BOD transactions are confidential and auto-approved
        // HRD transactions are confidential but need BOD approval
        const isBOD = userRole?.toLowerCase() === 'bod';
        const isHRD = userRole?.toLowerCase() === 'hrd';

        const namaKaryawanValue = isGuest ? formData.namaKaryawan : userName || '';

        const newKlaimData = {
          nomor_klaim: nomorKlaim,
          nomor_ql: formData.nomorQl || null,
          nama_event: formData.namaEvent,
          tipe: formData.tipe,
          id_perusahaan: formData.idPerusahaan || null,
          nominal: parseFloat(formData.nominal),
          metode_pembayaran: formData.metodePembayaran || null,
          nama_bank: formData.namaBank || null,
          nomor_rekening: formData.nomorRekening || null,
          nama_pemilik_rekening: formData.namaPemilikRekening || null,
          lampiran: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
          keterangan: formData.keterangan || null,
          detail_pengeluaran: JSON.stringify(expenseItems.filter(item => item.nama && item.nominal)),
          status_approval: isBOD ? 'Approved' : 'Pending',
          status_transfer: 'Belum Transfer',
          disetujui_oleh: isBOD ? userId : null,
          nama_approver: isBOD ? userName : null,
          manager_approved_by: isBOD ? userName : null,
          manager_approved_at: isBOD ? new Date().toISOString() : null,
          head_finance_approved_by: isBOD ? userName : null,
          head_finance_approved_at: isBOD ? new Date().toISOString() : null,
          nama_karyawan: namaKaryawanValue,
          is_confidential: isBOD || isHRD,
        };

        try {
          await createRecord('klaim', newKlaimData);
        } catch (createErr) {
          // Simpan gagal — hapus file yang sudah terupload agar tidak yatim
          await deleteR2Files(uploadedUrls);
          throw createErr;
        }

        // Log activity untuk CREATE
        await logActivity({
          tableName: 'klaim',
          recordId: null,
          recordNumber: nomorKlaim,
          action: 'create',
          fieldChanged: null,
          oldValue: null,
          newValue: `Nominal: Rp ${parseFloat(formData.nominal).toLocaleString('id-ID')}`,
          changedBy: userId,
          changedByName: userName
        });

        showToast('Klaim berhasil ditambahkan', 'success');
      }

      await refreshData(); // Refresh data
      setShowModal(false);
      setEditingKlaim(null);
      // Reset form
      setFormData({
        nomorQl: '',
        namaEvent: '',
        tipe: '',
        idPerusahaan: '',
        nominal: '',
        namaKaryawan: isGuest ? '' : userName || '',
        metodePembayaran: '',
        namaBank: '',
        nomorRekening: '',
        namaPemilikRekening: '',
        lampiran: [],
        keterangan: '',
      });
      setExpenseItems([{ nama: '', nominal: '' }]); // Reset expense items
      setSelectedFiles([]);
      setFileUploadProgress({});
      setFileName('');
      setGeneratedNomorKlaim(''); // Reset pre-generated nomor klaim
    } catch (error) {
      console.error('Error saving klaim:', error);
      showToast(editingKlaim ? 'Gagal memperbarui Klaim' : 'Gagal menambahkan Klaim', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetail = (klaim) => {
    navigate(`/klaim/${klaim.id}`);
  };

  // Handle Edit Klaim (untuk Administrator dan Manager)
  const handleEdit = (klaim) => {
    setEditingKlaim(klaim);
    // Parse lampiran jika berupa JSON string
    let lampiranArray = [];
    if (klaim.lampiran) {
      try {
        lampiranArray = typeof klaim.lampiran === 'string' ? JSON.parse(klaim.lampiran) : klaim.lampiran;
        if (!Array.isArray(lampiranArray)) lampiranArray = [lampiranArray];
      } catch {
        lampiranArray = [klaim.lampiran];
      }
    }
    setFormData({
      nomorQl: klaim.nomorQl || '',
      namaEvent: klaim.namaEvent || '',
      tipe: klaim.tipe || '',
      idPerusahaan: klaim.idPerusahaan || '',
      namaKaryawan: klaim.namaKaryawan || '',
      nominal: klaim.nominal?.toString() || '',
      metodePembayaran: klaim.metodePembayaran || '',
      namaBank: klaim.namaBank || '',
      nomorRekening: klaim.nomorRekening || '',
      namaPemilikRekening: klaim.namaPemilikRekening || '',
      lampiran: lampiranArray,
      keterangan: klaim.keterangan || '',
    });
    // Load expense items dari detailPengeluaran
    if (klaim.detailPengeluaran && klaim.detailPengeluaran.length > 0) {
      setExpenseItems(klaim.detailPengeluaran.map(item => ({
        nama: item.nama || '',
        nominal: item.nominal?.toString() || ''
      })));
    } else {
      setExpenseItems([{ nama: '', nominal: '' }]);
    }
    setFileName(klaim.lampiran ? 'Multiple files' : '');
    setShowModal(true);
  };

  // Handle Delete Klaim (untuk Administrator dan Manager)
  const handleDelete = (klaim) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Hapus',
      message: `Apakah Anda yakin ingin menghapus Klaim "${klaim.nomorKlaim}"? Data yang sudah dihapus tidak dapat dikembalikan.`,
      onConfirm: async () => {
        try {
          await deleteRecord('klaim', klaim.id);
          // Hapus file R2 milik record agar tidak jadi file yatim (best-effort)
          await deleteFilesOfRecords([klaim]);
          // Log activity
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'delete',
            fieldChanged: null,
            oldValue: `Nominal: Rp ${klaim.nominal.toLocaleString('id-ID')}`,
            newValue: null,
            changedBy: userId,
            changedByName: userName
          });
          showToast('Klaim berhasil dihapus', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error deleting klaim:', error);
          showToast('Gagal menghapus Klaim', 'error');
        }
      }
    });
  };

  // Handle bulk delete (hanya Administrator)
  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === currentItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentItems.map(item => item.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.length === 0) {
      showToast('Pilih minimal satu item untuk dihapus', 'error');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Hapus Massal',
      message: `Apakah Anda yakin ingin menghapus ${selectedItems.length} klaim? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await bulkDeleteRecords('klaim', selectedItems);

          // Hapus file R2 milik record yang dihapus (best-effort)
          const deletedItems = selectedItems
            .map((id) => klaimRequests.find((k) => k.id === id))
            .filter(Boolean);
          await deleteFilesOfRecords(deletedItems);

          // Log activity untuk setiap item yang dihapus
          for (const id of selectedItems) {
            const klaim = klaimRequests.find(k => k.id === id);
            if (klaim) {
              await logActivity({
                tableName: 'klaim',
                recordId: id,
                recordNumber: klaim.nomorKlaim,
                action: 'bulk_delete',
                fieldChanged: null,
                oldValue: `Nominal: Rp ${klaim.nominal.toLocaleString('id-ID')}`,
                newValue: null,
                changedBy: userId,
                changedByName: userName
              });
            }
          }

          showToast(`${selectedItems.length} klaim berhasil dihapus`, 'success');
          setSelectedItems([]);
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error bulk deleting klaim:', error);
          showToast('Gagal menghapus klaim', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // Handle Approve Klaim Tahap 1 (Manager): Pending -> Manager Approved
  const handleApprove = (klaim) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Approval Manager (Tahap 1)',
      message: `Setujui sebagai Manager? "${klaim.nomorKlaim}" akan diteruskan ke Head Finance.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('klaim', klaim.id, {
            status_approval: 'Manager Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager',
            manager_approved_by: userName || 'Manager',
            manager_approved_at: nowIso
          });
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Manager Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Disetujui Manager. Menunggu approval Head Finance.', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving klaim:', error);
          showToast('Gagal menyetujui Klaim', 'error');
        }
      }
    });
  };

  // Handle Approve Klaim Tahap 2 (Head Finance): Manager Approved -> Approved
  const handleApproveHead = (klaim) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Approval Head Finance (Tahap 2)',
      message: `Setujui sebagai Head Finance? "${klaim.nomorKlaim}" akan siap transfer oleh Finance.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('klaim', klaim.id, {
            status_approval: 'Approved',
            head_finance_approved_by: userName || 'Head Finance',
            head_finance_approved_at: nowIso
          });
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Manager Approved',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Disetujui Head Finance. Siap transfer oleh Finance.', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving klaim:', error);
          showToast('Gagal menyetujui Klaim', 'error');
        }
      }
    });
  };

  // Handle Reject Klaim
  const handleReject = (klaim) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Penolakan',
      message: `Apakah Anda yakin ingin menolak Klaim "${klaim.nomorKlaim}"? Tindakan ini akan mengubah status menjadi Rejected.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('klaim', klaim.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager',
            rejected_by: userName || 'Manager',
            rejected_at: nowIso
          });
          // Log activity
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: klaim.statusApproval || 'Pending',
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Klaim berhasil ditolak', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error rejecting klaim:', error);
          showToast('Gagal menolak Klaim', 'error');
        }
      }
    });
  };

  // Handle update status transfer (khusus Finance)
  const handleUpdateTransferStatus = async (klaim, newStatus) => {
    if (newStatus === 'Sudah Transfer') {
      // Cek metode pembayaran
      if (klaim.metodePembayaran === 'Cash') {
        // Jika Cash, langsung update tanpa bukti transfer
        setConfirmDialog({
          isOpen: true,
          type: 'success',
          title: 'Konfirmasi Transfer Cash',
          message: `Apakah Anda yakin ingin menandai klaim ini sudah dibayar tunai (cash)?`,
          onConfirm: async () => {
            try {
              await updateRecord('klaim', klaim.id, {
                status_transfer: 'Sudah Transfer'
              });
              // Log activity
              await logActivity({
                tableName: 'klaim',
                recordId: klaim.id,
                recordNumber: klaim.nomorKlaim,
                action: 'transfer',
                fieldChanged: 'status_transfer',
                oldValue: 'Belum Transfer',
                newValue: 'Sudah Transfer',
                changedBy: userId,
                changedByName: userName
              });
              await sendTransferNotification({
                tableName: 'klaim',
                record: klaim,
                amount: klaim.nominal,
                proofUrl: '',
                transferredBy: userName,
                detailPath: `/klaim/${klaim.id}`
              });
              showToast('Status transfer berhasil diperbarui', 'success');
              await refreshData();
              refreshNotifications();
            } catch (error) {
              console.error('Error updating transfer status:', error);
              showToast('Gagal memperbarui status transfer', 'error');
            }
          }
        });
      } else {
        // Jika Transfer, tampilkan modal upload bukti transfer
        setTransferringKlaim(klaim);
        setBuktiTransferFile(null);
        setBuktiTransferFileName('');
        setShowBuktiTransferModal(true);
      }
    } else {
      // Untuk reject, langsung konfirmasi
      setConfirmDialog({
        isOpen: true,
        type: 'danger',
        title: 'Konfirmasi Tolak Transfer',
        message: `Apakah Anda yakin ingin menolak transfer untuk klaim ini?`,
        onConfirm: async () => {
          try {
            const oldStatus = klaim.statusTransfer;
            await updateRecord('klaim', klaim.id, {
              status_transfer: newStatus
            });
            // Log activity
            await logActivity({
              tableName: 'klaim',
              recordId: klaim.id,
              recordNumber: klaim.nomorKlaim,
              action: 'transfer',
              fieldChanged: 'status_transfer',
              oldValue: oldStatus,
              newValue: newStatus,
              changedBy: userId,
              changedByName: userName
            });
            showToast(`Status transfer berhasil diperbarui menjadi ${newStatus}`, 'success');
            await refreshData();
            refreshNotifications();
          } catch (error) {
            console.error('Error updating transfer status:', error);
            showToast('Gagal memperbarui status transfer', 'error');
          }
        }
      });
    }
  };

  // Handle file change untuk bukti transfer
  const handleBuktiTransferFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        showToast('File terlalu besar. Maksimal 10MB', 'error');
        e.target.value = '';
        return;
      }
      setBuktiTransferFile(file);
      setBuktiTransferFileName(file.name);
    }
  };

  // Handle konfirmasi transfer dengan upload bukti
  const handleConfirmTransfer = async () => {
    if (!buktiTransferFile) {
      showToast('Mohon upload bukti transfer terlebih dahulu', 'error');
      return;
    }

    setUploadingBuktiTransfer(true);
    try {
      // Upload lalu update — bila update gagal, file ikut dihapus (anti yatim)
      const { result } = await uploadThenSave(
        () => uploadFile(buktiTransferFile, 'klaim', transferringKlaim.nomorKlaim, userName),
        (uploadResult) => updateRecord('klaim', transferringKlaim.id, {
          bukti_transfer: uploadResult.url,
          status_transfer: 'Sudah Transfer'
        })
      );

      // Log activity
      await logActivity({
        tableName: 'klaim',
        recordId: transferringKlaim.id,
        recordNumber: transferringKlaim.nomorKlaim,
        action: 'transfer',
        fieldChanged: 'status_transfer',
        oldValue: 'Belum Transfer',
        newValue: 'Sudah Transfer',
        changedBy: userId,
        changedByName: userName
      });

      await sendTransferNotification({
        tableName: 'klaim',
        record: transferringKlaim,
        amount: transferringKlaim.nominal,
        proofUrl: result.url,
        transferredBy: userName,
        detailPath: `/klaim/${transferringKlaim.id}`
      });

      showToast('Bukti transfer berhasil diupload dan status diperbarui', 'success');
      setShowBuktiTransferModal(false);
      setTransferringKlaim(null);
      setBuktiTransferFile(null);
      setBuktiTransferFileName('');
      await refreshData();
      refreshNotifications();
    } catch (error) {
      console.error('Error uploading bukti transfer:', error);
      showToast('Gagal mengupload bukti transfer: ' + (error.message || 'Silakan coba lagi'), 'error');
    } finally {
      setUploadingBuktiTransfer(false);
    }
  };

  // Data halaman aktif SUDAH difilter + dicari di server — tidak ada
  // sort/filter/slice di browser lagi. totalCount/totalPages dari Supabase count.
  const currentItems = klaimRequests;
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = (currentPage - 1) * ITEMS_PER_PAGE;

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
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
              placeholder="Cari berdasarkan Nomor Klaim, Nomor QL, Nama Event, atau Nama Karyawan..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-2 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Filter:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'all'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Semua ({klaimStats.total})
              </button>
              <button
                onClick={() => handleFilterChange('belum-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'belum-transfer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Belum ({klaimStats.belum})
              </button>
              <button
                onClick={() => handleFilterChange('sudah-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'sudah-transfer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Sudah ({klaimStats.sudah})
              </button>
            </div>

            {(filterStatus !== 'all' || searchTerm || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setSearchTerm('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Tanggal */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Filter Tanggal:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Dari tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors self-end"
                >
                  Reset Tanggal
                </button>
              )}
            </div>
          </div>

          {/* Result Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <p className="text-gray-600">
                Menampilkan <span className="font-semibold text-gray-800">{totalCount === 0 ? 0 : indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, totalCount)}</span> dari <span className="font-semibold text-gray-800">{totalCount}</span> klaim
                {isLoadingKlaim && (
                  <span className="text-gray-500"> (memuat...)</span>
                )}
              </p>
              {/* Bulk Delete Button - Admin & BOD Only */}
              {canDelete && selectedItems.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center space-x-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Menghapus...' : `Hapus (${selectedItems.length})`}</span>
                </button>
              )}
            </div>
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
                    {/* Checkbox column - Administrator Only */}
                    {canEditDelete && (
                      <th className="w-12 py-4 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={currentItems.length > 0 && selectedItems.length === currentItems.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500 cursor-pointer"
                          title="Pilih Semua"
                        />
                      </th>
                    )}
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Klaim</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor QL</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Event</th>
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
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Manager</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Head Finance</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Bukti Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((klaim) => {
                      // Check if data is confidential and user cannot view
                      const isHidden = klaim.isConfidential && !canViewConfidential;

                      return (
                        <tr key={klaim.nomorKlaim} className={`hover:bg-gray-50 transition-colors ${isHidden ? 'bg-gray-50' : ''} ${selectedItems.includes(klaim.id) ? 'bg-violet-50' : ''}`}>
                          {/* Checkbox column - Administrator Only */}
                          {canEditDelete && (
                            <td className="py-4 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(klaim.id)}
                                onChange={() => handleSelectItem(klaim.id)}
                                className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <Link
                                to={`/klaim/${klaim.id}`}
                                className="text-sm font-bold text-violet-600 hover:text-violet-800 hover:underline cursor-pointer"
                              >
                                {klaim.nomorKlaim}
                              </Link>
                              {klaim.isConfidential && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-800 text-white rounded">
                                  🔒
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <QLLink ql={klaim.nomorQl} hidden={isHidden} className="text-sm text-gray-700" linkClassName="text-violet-600 font-medium" />
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{isHidden ? 'CONFIDENTIAL' : (klaim.namaEvent || '-')}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm text-gray-600 whitespace-nowrap">{klaim.tanggal}</div>
                            {klaim.tanggalJam && klaim.tanggalJam !== '-' && (
                              <div className="text-xs text-gray-400 whitespace-nowrap">{klaim.tanggalJam.split(' ')[1] || ''}</div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {isHidden ? <span className="text-sm text-gray-400">CONFIDENTIAL</span> : <TipeBadge tipe={klaim.tipe} size="sm" />}
                          </td>
                          <td className="py-4 px-6">
                            {isHidden ? <span className="text-sm text-gray-400">CONFIDENTIAL</span> : <IdPerusahaanBadge idPerusahaan={klaim.idPerusahaan} size="sm" showFullName={true} />}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700 font-medium">{isHidden ? 'CONFIDENTIAL' : klaim.namaKaryawan}</span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className="text-sm font-semibold text-gray-900">{isHidden ? 'CONFIDENTIAL' : formatRupiah(klaim.nominal)}</span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isHidden ? (
                              <span className="text-sm text-gray-400">-</span>
                            ) : klaim.metodePembayaran === 'Transfer' ? (
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
                            {isHidden ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : klaim.metodePembayaran === 'Transfer' ? (
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
                            {isHidden ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : klaim.lampiran ? (
                              (() => {
                                const urls = parseLampiran(klaim.lampiran);
                                if (urls.length === 1) {
                                  return (
                                    <a
                                      href={urls[0]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center space-x-1 hover:bg-emerald-50 p-1 rounded transition-colors"
                                      title="Lihat Lampiran"
                                    >
                                      <Paperclip className="w-4 h-4 text-emerald-600" />
                                      <span className="text-xs font-medium text-emerald-700">Ada</span>
                                    </a>
                                  );
                                }
                                return (
                                  <span className="flex items-center justify-center space-x-1 text-xs font-medium text-emerald-700">
                                    <Paperclip className="w-4 h-4 text-emerald-600" />
                                    <span>{urls.length} file</span>
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs text-gray-600 line-clamp-2" title={isHidden ? '' : klaim.keterangan}>
                              {isHidden ? '-' : (klaim.keterangan || '-')}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {getStatusApprovalBadge(klaim.statusApproval)}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{klaim.disetujuiOleh}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{klaim.disetujuiHeadFinance || '-'}</span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {getStatusTransferBadge(klaim.statusTransfer)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isHidden ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : klaim.buktiTransfer ? (
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
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleDetail(klaim)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Detail</span>
                              </button>

                              {/* Approve Tahap 1 (Manager): Pending -> Manager Approved */}
                              {canApproveManager && klaim.statusApproval === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                    title="Approve Manager"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleReject(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* Approve Tahap 2 (Head Finance): Manager Approved -> Approved */}
                              {canApproveHead && klaim.statusApproval === 'Manager Approved' && (
                                <>
                                  <button
                                    onClick={() => handleApproveHead(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                    title="Approve Head Finance"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Approve HF</span>
                                  </button>
                                  <button
                                    onClick={() => handleReject(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* Aksi khusus Finance untuk update status transfer */}
                              {isFinance && klaim.statusApproval === 'Approved' && klaim.statusTransfer === 'Belum Transfer' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateTransferStatus(klaim, 'Sudah Transfer')}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors text-sm font-medium"
                                    title={klaim.metodePembayaran === 'Cash' ? 'Bayar Cash' : 'Upload Bukti Transfer'}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{klaim.metodePembayaran === 'Cash' ? 'Bayar' : 'Transfer'}</span>
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransferStatus(klaim, 'Reject')}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                    title="Tolak Transfer"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* Aksi Edit/Delete untuk Admin dan Manager */}
                              {canEditDelete && !isLocked(klaim) && (
                                <>
                                  <button
                                    onClick={() => handleEdit(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    <span>Edit</span>
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDelete(klaim)}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span>Hapus</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={canEditDelete ? "18" : "17"} className="py-12 text-center">
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
        {totalCount > 0 && totalPages > 1 && (
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
                {ITEMS_PER_PAGE} per halaman
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
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Section: Informasi Dasar */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-violet-600 rounded-full mr-3"></div>
                  Informasi Dasar
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Nomor Klaim (Auto-generated at submit) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Klaim</label>
                    <input
                      type="text"
                      value="Akan digenerate otomatis saat submit"
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 italic"
                    />
                    <p className="text-xs text-gray-500 mt-1">Nomor unik akan digenerate saat submit untuk menghindari konflik</p>
                  </div>

                  {/* Nomor QL - Opsional */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nomor QL <span className="text-gray-400 text-xs">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      name="nomorQl"
                      value={formData.nomorQl}
                      onChange={handleInputChange}
                      placeholder="Contoh: PSQL-0080"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <QLInfo value={formData.nomorQl} />
                  </div>

                  {/* Nama Event/Project - WAJIB */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Event/Project <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaEvent"
                      value={formData.namaEvent}
                      onChange={handleInputChange}
                      placeholder="Contoh: Wedding Budi & Ani, Proyek Taman Villa X"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                    />
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
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Detail Perusahaan */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-violet-600 rounded-full mr-3"></div>
                  Detail Perusahaan
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Tipe Unit Bisnis */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Unit Bisnis <span className="text-red-500">*</span></label>
                    <select
                      name="tipe"
                      value={formData.tipe}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      <option value="">Pilih Tipe Unit Bisnis</option>
                      {getTipeOptionsByRole(userRole).map((tipe) => (
                        <option key={tipe.value} value={tipe.value}>
                          {tipe.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ID Perusahaan - Semua pilihan ditampilkan */}
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
                      {getIdPerusahaanOptionsByRole(userRole).map((company) => (
                        <option key={company.value} value={company.value}>
                          {company.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Detail Pengeluaran */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <div className="w-1 h-6 bg-violet-600 rounded-full mr-3"></div>
                    Detail Pengeluaran
                  </h3>
                  <button
                    type="button"
                    onClick={addExpenseItem}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors text-sm font-medium"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Tambah Item</span>
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {expenseItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.nama}
                          onChange={(e) => handleExpenseItemChange(index, 'nama', e.target.value)}
                          placeholder="Nama pengeluaran (misal: Bensin)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="w-40">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">Rp</span>
                          <input
                            type="text"
                            value={formatRupiah(item.nominal || 0)}
                            onChange={(e) => handleExpenseItemChange(index, 'nominal', e.target.value)}
                            placeholder="0"
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm font-medium"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExpenseItem(index)}
                        disabled={expenseItems.length === 1}
                        className={`p-2 rounded-lg transition-colors ${expenseItems.length === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50'}`}
                      >
                        <MinusCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Total */}
                <div className="bg-violet-100 border border-violet-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="font-semibold text-violet-800">Total Nominal</span>
                  <span className="text-2xl font-bold text-violet-800">Rp {formatRupiah(calculateTotal())}</span>
                </div>
                <p className="text-xs text-gray-500">Total nominal akan otomatis terhitung dari jumlah semua item pengeluaran</p>
              </div>

              {/* Section: Detail Pembayaran */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-violet-600 rounded-full mr-3"></div>
                  Detail Pembayaran
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Metode Pembayaran */}
                  <div>
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
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col gap-4">
                      <h4 className="text-md font-bold text-gray-800 flex items-center">
                        <Banknote className="w-5 h-5 mr-2 text-blue-600" />
                        Informasi Bank
                      </h4>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Bank <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="namaBank"
                          value={formData.namaBank}
                          onChange={handleInputChange}
                          placeholder="Contoh: BCA, Mandiri, BNI"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pemilik Rekening <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="namaPemilikRekening"
                          value={formData.namaPemilikRekening}
                          onChange={handleInputChange}
                          placeholder="Nama sesuai rekening bank"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Keterangan - WAJIB */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan <span className="text-red-500">*</span></label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      placeholder="Masukkan keterangan keperluan klaim..."
                      rows="3"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Lampiran - Multi-file Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lampiran <span className="text-red-500">*</span>
                      <span className="text-gray-400 text-xs ml-2">(Dapat upload lebih dari 1 file)</span>
                    </label>
                    {/* Existing Files (saat edit) */}
                    {editingKlaim && formData.lampiran && formData.lampiran.length > 0 && (
                      <div className="mb-3 p-3 bg-violet-50 border border-violet-100 rounded-lg">
                        <p className="text-sm font-medium text-violet-800 mb-2">File yang sudah diupload:</p>
                        <div className="space-y-2">
                          {formData.lampiran.map((url, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-violet-200">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span className="truncate max-w-xs">{url.split('/').pop()}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    lampiran: prev.lampiran.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                title="Hapus file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <MultiFileUpload
                      files={selectedFiles}
                      onFilesChange={handleFilesChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      maxSize={10}
                      maxFiles={10}
                      uploading={uploadingFile}
                      uploadProgress={fileUploadProgress}
                      accentColor="violet"
                      required={true}
                      disabled={uploadingFile}
                    />
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingFile || isSubmitting}
                  className={`px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors shadow-sm ${(uploadingFile || isSubmitting) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Memproses...' : uploadingFile ? 'Mengupload...' : 'Ajukan Klaim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload Bukti Transfer */}
      {showBuktiTransferModal && transferringKlaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                  <p className="text-sm text-white/80">{transferringKlaim.nomorKlaim}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBuktiTransferModal(false);
                  setTransferringKlaim(null);
                  setBuktiTransferFile(null);
                  setBuktiTransferFileName('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info Klaim */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Karyawan:</span>
                    <p className="font-medium text-gray-800">{transferringKlaim.namaKaryawan}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nominal:</span>
                    <p className="font-semibold text-violet-600">Rp {formatRupiah(transferringKlaim.nominal)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Rekening Tujuan:</span>
                    <p className="font-medium text-gray-800">{transferringKlaim.namaBank} - {transferringKlaim.nomorRekening}</p>
                    <p className="text-sm text-gray-600">{transferringKlaim.namaPemilikRekening}</p>
                  </div>
                </div>
              </div>

              {/* Upload Area with Paste Support */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bukti Transfer <span className="text-red-500">*</span>
                </label>
                <PasteUpload
                  onFileSelect={(file) => {
                    setBuktiTransferFile(file);
                    setBuktiTransferFileName(file ? file.name : '');
                  }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSize={10}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowBuktiTransferModal(false);
                    setTransferringKlaim(null);
                    setBuktiTransferFile(null);
                    setBuktiTransferFileName('');
                  }}
                  disabled={uploadingBuktiTransfer}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  disabled={!buktiTransferFile || uploadingBuktiTransfer}
                  className={`px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || uploadingBuktiTransfer) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploadingBuktiTransfer ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Konfirmasi Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default Klaim;
