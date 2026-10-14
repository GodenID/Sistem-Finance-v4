import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, FileText, Paperclip, Trash2, PlusCircle, Banknote, Wallet, Download, Edit2, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';

import { createRecord, updateRecord, deleteRecord, uploadFile, countRecords, getLightweightRows, getKasbonByNomor } from '../lib/api';
import { usePaginatedTable } from '../hooks/usePaginatedTable';
import { logActivity } from '../lib/auditLog';
import { deleteFilesOfRecords, deleteR2Files, uploadThenSave } from '../utils/fileCleanup';
import ConfirmDialog from '../components/ConfirmDialog';
import PasteUpload from '../components/PasteUpload';
import QLInfo from '../components/QLInfo';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { generatePenyelesaianNumber } from '../utils/generateUniqueNumber';
import { formatTanggalJamPendek, getStatusBadgeClass, calcDurations } from '../lib/approvalFlow';

const Penyelesaian = () => {
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
  const canDelete = hasPermission ? hasPermission('delete_penyelesaian') : ['administrator', 'manager'].includes(userRole);
  const canEdit = hasPermission ? hasPermission('edit_penyelesaian') : ['administrator', 'manager', 'bod'].includes(userRole);
  const isAdmin = userRole === 'administrator';
  const canViewConfidential = hasPermission ? hasPermission('view_confidential') : ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());

  const isLocked = (item) => {
    if (isAdmin) return false;
    return item.statusApproval === 'Approved' || item.statusPenyelesaian === 'Selesai';
  };
  // State untuk confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => { }
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const ITEMS_PER_PAGE = 10;
  const [showModal, setShowModal] = useState(false);

  // State untuk form Penyelesaian
  const [formData, setFormData] = useState({
    nomorKasbon: '',
    nomorQl: '',
    namaEvent: '', // Nama Event/Project dari Kasbon
    kasbonNominal: 0,
    namaKaryawan: isGuest ? '' : userName || '',
    detailPengeluaran: [],
    metodePengembalian: '',
    lampiran: null,
    lampiranPengembalian: null,
    keterangan: '',
  });

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // State untuk lampiran bukti pengembalian ke finance
  const [fileNamePengembalian, setFileNamePengembalian] = useState('');
  const [fileSizePengembalian, setFileSizePengembalian] = useState(0);
  const [uploadingFilePengembalian, setUploadingFilePengembalian] = useState(false);
  const [uploadProgressPengembalian, setUploadProgressPengembalian] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [newExpenseItem, setNewExpenseItem] = useState({ deskripsi: '', nominal: '' });
  const [kasbonValidation, setKasbonValidation] = useState({ isValid: null, message: '', isChecking: false });

  // Draft penyelesaian (localStorage) — agar detailPengeluaran tidak hilang saat
  // back / pindah ke detail / modal tertutup / refresh. Draft hanya dihapus setelah submit sukses.
  const DRAFT_KEY = 'penyelesaian_form_draft_v1';
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Restore draft saat komponen mount (misal user back dari detail)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === 'object') {
          if (draft.formData) {
            setFormData(prev => ({ ...prev, ...draft.formData }));
          }
          if (draft.newExpenseItem) {
            setNewExpenseItem(draft.newExpenseItem);
          }
          if (draft.kasbonValidation && draft.kasbonValidation.isValid === true) {
            setKasbonValidation(draft.kasbonValidation);
          }
          if (draft.fileName) setFileName(draft.fileName);
          if (draft.fileNamePengembalian) setFileNamePengembalian(draft.fileNamePengembalian);
        }
      }
    } catch (e) {
      console.warn('Gagal restore draft penyelesaian:', e);
    } finally {
      setDraftLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan draft setiap ada perubahan (hanya setelah restore selesai & saat modal create terbuka,
  // agar state edit/detail yang navigasi away tidak ikut tersimpan sebagai draft create)
  useEffect(() => {
    if (!draftLoaded) return;
    if (!showModal) return;
    try {
      const hasContent =
        (formData.nomorKasbon && formData.nomorKasbon.trim() !== '') ||
        (formData.detailPengeluaran && formData.detailPengeluaran.length > 0) ||
        (formData.keterangan && formData.keterangan.trim() !== '') ||
        (newExpenseItem.deskripsi && newExpenseItem.deskripsi.trim() !== '') ||
        (newExpenseItem.nominal && String(newExpenseItem.nominal).trim() !== '');
      if (!hasContent) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        formData,
        newExpenseItem,
        kasbonValidation: kasbonValidation.isValid === true ? kasbonValidation : { isValid: null, message: '', isChecking: false },
        fileName,
        fileNamePengembalian,
      }));
    } catch (e) {
      console.warn('Gagal simpan draft penyelesaian:', e);
    }
  }, [formData, newExpenseItem, kasbonValidation, fileName, fileNamePengembalian, draftLoaded, showModal]);

  const clearPenyelesaianDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  };

  // State untuk mencegah double submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk upload bukti kekurangan dari table
  const [showBuktiKekuranganModal, setShowBuktiKekuranganModal] = useState(false);
  const [buktiKekuranganFile, setBuktiKekuranganFile] = useState(null);
  const [isUploadingBuktiKekurangan, setIsUploadingBuktiKekurangan] = useState(false);
  const [selectedPenyelesaianForKekurangan, setSelectedPenyelesaianForKekurangan] = useState(null);

  // Data Kasbon untuk di-lookup (dropdown saja — kolom ringan, bukan full row)
  const [kasbonList, setKasbonList] = useState([]);
  const [isLoadingKasbon, setIsLoadingKasbon] = useState(true);

  // Transform row penyelesaian Supabase -> UI (dipakai hook pagination + realtime).
  // Pagination + search + filter dikerjakan di server (Supabase .range/.or),
  // browser hanya menerima 1 halaman (10 row), bukan ribuan row.
  const transformPenyelesaianRow = useCallback((item) => ({
    id: item.id,
    nomorPenyelesaian: item.nomor_penyelesaian,
    nomorKasbon: item.nomor_kasbon || '',
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
    namaKaryawan: item.nama_karyawan || '',
    kasbonNominal: parseFloat(item.kasbon_nominal) || 0,
    totalPengeluaran: parseFloat(item.total_pengeluaran) || 0,
    selisih: parseFloat(item.selisih) || 0,
    statusSelisih: item.status_selisih || 'Pas',
    metodePengembalian: item.metode_pengembalian || '',
    lampiran: item.lampiran || null,
    lampiranPengembalian: item.lampiran_pengembalian || null,
    buktiKekurangan: item.bukti_kekurangan || null,
    statusApproval: item.status_approval || 'Pending',
    disetujuiOleh: item.nama_approver || '-',
    disetujuiHeadFinance: item.head_finance_approved_by || '-',
    statusPenyelesaian: item.status_penyelesaian || 'Belum Selesai',
    detailPengeluaran: item.detail_pengeluaran || [],
    keterangan: item.keterangan || '',
    isConfidential: item.is_confidential || false
  }), []);

  const serverFilters = useMemo(() => {
    const f = {};
    if (filterStatus === 'belum-selesai') f.status_penyelesaian = 'Belum Selesai';
    if (filterStatus === 'selesai') f.status_penyelesaian = 'Selesai';
    if (dateFrom) f.start_date = dateFrom;
    if (dateTo) f.end_date = dateTo;
    return f;
  }, [filterStatus, dateFrom, dateTo]);

  const {
    items: penyelesaianRequests,
    totalCount,
    totalPages,
    page: currentPage,
    setPage: setCurrentPage,
    search: searchTerm,
    setSearch: setSearchTerm,
    setFilters: setServerFilters,
    loading: isLoadingPenyelesaian,
    refresh: refreshPage,
    applyInsert,
    applyUpdate,
    applyDelete,
  } = usePaginatedTable('penyelesaian', {
    limit: ITEMS_PER_PAGE,
    transform: transformPenyelesaianRow,
  });

  // Terapkan filter status + tanggal UI ke query server (reset ke halaman 1)
  useEffect(() => {
    setServerFilters(serverFilters);
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, dateFrom, dateTo]);

  // Statistik kartu via HEAD count (4 request ringan, tanpa download row).
  const [penyelesaianStats, setPenyelesaianStats] = useState({ total: 0, belumSelesai: 0, selesai: 0, approved: 0 });
  const refreshStats = useCallback(async () => {
    try {
      const [total, belumSelesai, selesai, approved] = await Promise.all([
        countRecords('penyelesaian'),
        countRecords('penyelesaian', { status_penyelesaian: 'Belum Selesai' }),
        countRecords('penyelesaian', { status_penyelesaian: 'Selesai' }),
        countRecords('penyelesaian', { status_approval: 'Approved' }),
      ]);
      setPenyelesaianStats({ total, belumSelesai, selesai, approved });
    } catch (e) {
      console.error('Error fetching penyelesaian stats:', e);
    }
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  const refreshData = useCallback(async () => {
    await Promise.all([refreshPage(), refreshStats()]);
  }, [refreshPage, refreshStats]);

  // Lookup ringan kasbon untuk dropdown (kolom minimal, limit 500)
  const fetchKasbonLookup = useCallback(async () => {
    try {
      setIsLoadingKasbon(true);
      const data = await getLightweightRows('kasbon', {
        columns: 'id,nomor_kasbon,nomor_ql,nama_event,nominal,nama_karyawan',
        limit: 500,
      });
      const transformedData = data.map(item => ({
        id: item.id,
        nomorKasbon: item.nomor_kasbon,
        nomorQl: item.nomor_ql || '',
        namaEvent: item.nama_event || '',
        nominal: parseFloat(item.nominal) || 0,
        namaKaryawan: item.nama_karyawan || ''
      }));
      setKasbonList(transformedData);
    } catch (error) {
      console.error('Error fetching kasbon lookup:', error);
    } finally {
      setIsLoadingKasbon(false);
    }
  }, []);

  useEffect(() => {
    fetchKasbonLookup();
  }, [fetchKasbonLookup]);

  // Realtime: update halaman aktif saja, tanpa refetch full.
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      applyInsert(transformPenyelesaianRow(newRecord));
      refreshStats();
      showToast('Data penyelesaian baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      applyUpdate(newRecord.id, transformPenyelesaianRow(newRecord));
      refreshStats();
      showToast('Data penyelesaian diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      applyDelete(oldRecord.id);
      refreshStats();
      showToast('Data penyelesaian dihapus', 'info');
    }
    refreshNotifications();
  }, [applyInsert, applyUpdate, applyDelete, transformPenyelesaianRow, refreshStats, refreshNotifications, showToast]);

  useRealtimeSubscription('penyelesaian', { onAnyChange: handleRealtimeChange });

  // Stats calculation (dari HEAD count, bukan dari array halaman)
  const stats = [
    { label: 'Total Penyelesaian', value: penyelesaianStats.total.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Belum Selesai', value: penyelesaianStats.belumSelesai.toString(), color: 'bg-orange-50 text-orange-600' },
    { label: 'Selesai', value: penyelesaianStats.selesai.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: penyelesaianStats.approved.toString(), color: 'bg-blue-50 text-blue-600' },
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

  const getStatusPenyelesaianBadge = (status) => {
    const badges = {
      'Belum Selesai': 'bg-orange-50 text-orange-700',
      'Selesai': 'bg-emerald-50 text-emerald-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>{status}</span>;
  };

  const getStatusSelisihBadge = (status) => {
    const badges = {
      'Pas': 'bg-emerald-50 text-emerald-700',
      'Pengembalian': 'bg-blue-50 text-blue-700',
      'Kekurangan': 'bg-amber-50 text-amber-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>{status}</span>;
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const validateKasbon = async (nomorKasbon) => {
    if (!nomorKasbon.trim()) {
      setKasbonValidation({ isValid: null, message: '', isChecking: false });
      return;
    }

    setKasbonValidation({ isValid: null, message: '', isChecking: true });

    // Cek apakah kasbon ada di database
    const kasbon = kasbonList.find(k => k.nomorKasbon === nomorKasbon);

    if (!kasbon) {
      setKasbonValidation({
        isValid: false,
        message: 'Nomor kasbon tidak valid atau tidak ditemukan',
        isChecking: false
      });
      // Jangan hapus detailPengeluaran user — hanya reset field auto-fill dari kasbon.
      // User bisa perbaiki nomor kasbon tanpa harus input ulang detail.
      setFormData(prev => ({
        ...prev,
        nomorQl: '',
        namaEvent: '',
        kasbonNominal: 0,
        namaKaryawan: isGuest ? '' : userName || ''
      }));
      return;
    }

    // Cek apakah kasbon sudah diselesaikan (server-side count — list utama paginated,
    // tidak bisa dicek dari array halaman saja)
    let sudahDiselesaikan = false;
    try {
      sudahDiselesaikan = (await countRecords('penyelesaian', { nomor_kasbon: nomorKasbon })) > 0;
    } catch (e) {
      console.error('Error checking penyelesaian:', e);
      sudahDiselesaikan = penyelesaianRequests.some(p => p.nomorKasbon === nomorKasbon);
    }

    if (sudahDiselesaikan) {
      setKasbonValidation({
        isValid: false,
        message: 'Kasbon ini sudah diselesaikan',
        isChecking: false
      });
      // Jangan hapus detailPengeluaran user — hanya reset field auto-fill dari kasbon.
      setFormData(prev => ({
        ...prev,
        nomorQl: '',
        namaEvent: '',
        kasbonNominal: 0,
        namaKaryawan: isGuest ? '' : userName || ''
      }));
      return;
    }

    // Kasbon valid, auto-fill data
    setKasbonValidation({
      isValid: true,
      message: 'Kasbon ditemukan',
      isChecking: false
    });
    setFormData(prev => {
      // Pertahankan detailPengeluaran user — jangan pernah reset saat re-validasi kasbon yang sama.
      // Hanya reset metodePengembalian jika ganti ke kasbon lain (nominal/karyawan berbeda),
      // karena total & selisih ikut berubah.
      const isGantiKasbon =
        prev.kasbonNominal !== (kasbon.nominal || 0) ||
        prev.namaKaryawan !== (kasbon.namaKaryawan || '');
      return {
        ...prev,
        nomorQl: kasbon.nomorQl || '',
        namaEvent: kasbon.namaEvent || '', // Auto-fill namaEvent from kasbon
        kasbonNominal: kasbon.nominal || 0,
        namaKaryawan: kasbon.namaKaryawan || '',
        ...(isGantiKasbon ? { metodePengembalian: '' } : {}),
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validasi kasbon saat user selesai mengetik (onBlur akan lebih baik)
    if (name === 'nomorKasbon') {
      // Reset validation saat user mengetik
      setKasbonValidation({ isValid: null, message: '', isChecking: false });
    }
  };

  const handleKasbonBlur = () => {
    if (formData.nomorKasbon) {
      validateKasbon(formData.nomorKasbon);
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

      let progressInterval = null;
      try {
        const nomorPenyelesaian = formData.nomorPenyelesaian || generatePenyelesaianNumber();

        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadFile(file, 'penyelesaian', nomorPenyelesaian, userName);

        setUploadProgress(100);

        // File lama yang tertimpa tidak dipakai lagi — hapus agar tidak yatim
        if (formData.lampiran && formData.lampiran !== result.url) {
          deleteR2Files([formData.lampiran]);
        }
        setFormData(prev => ({ ...prev, lampiran: result.url }));
        showToast('File berhasil diupload', 'success');
      } catch (error) {
        console.error('Error uploading file:', error);
        showToast('Gagal mengupload file: ' + (error.message || 'Silakan coba lagi'), 'error');
        setFileName('');
        setFileSize(0);
        setUploadProgress(0);
        setFormData(prev => ({ ...prev, lampiran: null }));
        e.target.value = '';
      } finally {
        // WAJIB clear — sebelumnya interval bocor saat upload gagal
        // sehingga progress jalan terus & tombol stuck
        if (progressInterval) clearInterval(progressInterval);
        setUploadingFile(false);
        // Biarkan status 100% terlihat sebentar saat sukses, baru reset
        setTimeout(() => setUploadProgress(0), 2000);
      }
    }
  };

  // Handle file upload untuk bukti pengembalian ke finance
  const handleFilePengembalianChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(`File terlalu besar. Maksimal ${(maxSize / 1024 / 1024).toFixed(0)}MB`, 'error');
        e.target.value = '';
        return;
      }

      setUploadingFilePengembalian(true);
      setFileNamePengembalian(file.name);
      setFileSizePengembalian(file.size);
      setUploadProgressPengembalian(0);

      let progressIntervalPengembalian = null;
      try {
        const nomorPenyelesaian = formData.nomorPenyelesaian || generatePenyelesaianNumber();

        progressIntervalPengembalian = setInterval(() => {
          setUploadProgressPengembalian(prev => {
            if (prev >= 90) {
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadFile(file, 'penyelesaian', `${nomorPenyelesaian}-pengembalian`, userName);

        setUploadProgressPengembalian(100);

        // File lama yang tertimpa tidak dipakai lagi — hapus agar tidak yatim
        if (formData.lampiranPengembalian && formData.lampiranPengembalian !== result.url) {
          deleteR2Files([formData.lampiranPengembalian]);
        }
        setFormData(prev => ({ ...prev, lampiranPengembalian: result.url }));
        showToast('Bukti pengembalian berhasil diupload', 'success');
      } catch (error) {
        console.error('Error uploading file pengembalian:', error);
        showToast('Gagal mengupload bukti pengembalian: ' + (error.message || 'Silakan coba lagi'), 'error');
        setFileNamePengembalian('');
        setFileSizePengembalian(0);
        setUploadProgressPengembalian(0);
        setFormData(prev => ({ ...prev, lampiranPengembalian: null }));
        e.target.value = '';
      } finally {
        // WAJIB clear — sebelumnya interval bocor saat upload gagal
        // sehingga progress jalan terus & tombol stuck
        if (progressIntervalPengembalian) clearInterval(progressIntervalPengembalian);
        setUploadingFilePengembalian(false);
        // Biarkan status 100% terlihat sebentar saat sukses, baru reset
        setTimeout(() => setUploadProgressPengembalian(0), 2000);
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

  const handleExpenseItemChange = (e) => {
    const { name, value } = e.target;
    if (name === 'nominal') {
      const cleanValue = value.replace(/\./g, '');
      if (!isNaN(cleanValue)) {
        setNewExpenseItem(prev => ({ ...prev, nominal: cleanValue }));
      }
    } else {
      setNewExpenseItem(prev => ({ ...prev, [name]: value }));
    }
  };

  const addExpenseItem = () => {
    if (newExpenseItem.deskripsi && newExpenseItem.nominal) {
      setFormData(prev => {
        const newExpenses = [...prev.detailPengeluaran, {
          deskripsi: newExpenseItem.deskripsi,
          nominal: parseInt(newExpenseItem.nominal)
        }];
        // Reset metode pengembalian jika status berubah
        return {
          ...prev,
          detailPengeluaran: newExpenses,
          metodePengembalian: '' // Reset karena total berubah
        };
      });
      setNewExpenseItem({ deskripsi: '', nominal: '' });
    }
  };

  const removeExpenseItem = (index) => {
    setFormData(prev => ({
      ...prev,
      detailPengeluaran: prev.detailPengeluaran.filter((_, i) => i !== index),
      metodePengembalian: '' // Reset karena total berubah
    }));
  };

  const calculateTotalExpense = () => {
    return formData.detailPengeluaran.reduce((sum, item) => sum + item.nominal, 0);
  };

  const calculateSelisih = () => {
    const total = calculateTotalExpense();
    return formData.kasbonNominal - total;
  };

  const getStatusSelisih = () => {
    const selisih = calculateSelisih();
    if (selisih === 0) return 'Pas';
    if (selisih > 0) return 'Pengembalian'; // Ada sisa, harus dikembalikan
    return 'Kekurangan'; // Kurang, butuh tambahan
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Cegah double submit
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validasi form
      if (!formData.nomorKasbon) {
        showToast('Mohon masukkan nomor kasbon', 'error');
        return;
      }

      // Validasi kasbon harus valid
      if (kasbonValidation.isValid !== true) {
        showToast('Nomor kasbon tidak valid. Mohon periksa kembali', 'error');
        return;
      }

      if (formData.detailPengeluaran.length === 0) {
        showToast('Mohon tambahkan minimal satu detail pengeluaran', 'error');
        return;
      }

      // Validasi bukti pengembalian jika metode Transfer
      if (getStatusSelisih() === 'Pengembalian' && formData.metodePengembalian === 'Transfer' && !formData.lampiranPengembalian) {
        showToast('Mohon upload bukti pengembalian ke finance untuk metode Transfer', 'error');
        return;
      }

      // Simpan ke Supabase
      const selisih = calculateSelisih();
      const statusSelisih = getStatusSelisih();
      const totalPengeluaran = calculateTotalExpense();

      // Generate unique nomor penyelesaian at submit time to prevent conflicts
      const nomorPenyelesaian = generatePenyelesaianNumber();
      const isBOD = userRole?.toLowerCase() === 'bod';
      const isHRD = userRole?.toLowerCase() === 'hrd';
      const newPenyelesaianData = {
        nomor_penyelesaian: nomorPenyelesaian,
        nomor_kasbon: formData.nomorKasbon,
        nomor_ql: formData.nomorQl || null,
        nama_event: formData.namaEvent || null,
        kasbon_nominal: parseFloat(formData.kasbonNominal),
        nama_karyawan: formData.namaKaryawan,
        detail_pengeluaran: formData.detailPengeluaran,
        total_pengeluaran: totalPengeluaran,
        total_nominal: totalPengeluaran,
        selisih: selisih,
        status_selisih: statusSelisih,
        metode_pengembalian: formData.metodePengembalian || null,
        lampiran: formData.lampiran || null,
        lampiran_pengembalian: formData.lampiranPengembalian || null,
        keterangan: formData.keterangan || null,
        status_approval: isBOD ? 'Approved' : 'Pending',
        disetujui_oleh: isBOD ? userName : null,
        manager_approved_by: isBOD ? userName : null,
        manager_approved_at: isBOD ? new Date().toISOString() : null,
        head_finance_approved_by: isBOD ? userName : null,
        head_finance_approved_at: isBOD ? new Date().toISOString() : null,
        status_penyelesaian: 'Belum Selesai',
        is_confidential: isBOD || isHRD
      };

      const createdPenyelesaian = await createRecord('penyelesaian', newPenyelesaianData);

      // Update status_penyelesaian di tabel kasbon
      const kasbonRecord = kasbonList.find(k => k.nomorKasbon === formData.nomorKasbon);
      if (kasbonRecord) {
        await updateRecord('kasbon', kasbonRecord.id, {
          status_penyelesaian: 'Sudah Diselesaikan'
        });
      }

      // Log activity untuk CREATE
      await logActivity({
        tableName: 'penyelesaian',
        recordId: createdPenyelesaian.id,
        recordNumber: nomorPenyelesaian,
        action: 'create',
        fieldChanged: null,
        oldValue: null,
        newValue: `Total: Rp ${totalPengeluaran.toLocaleString('id-ID')}, Selisih: ${statusSelisih}`,
        changedBy: userId,
        changedByName: userName
      });

      await refreshData(); // Refresh halaman aktif + statistik (paginated)
      await fetchKasbonLookup(); // Refresh kasbon lookup to reflect updated status

      setShowModal(false);
      // Reset form
      setFormData({
        nomorKasbon: '',
        nomorQl: '',
        namaEvent: '',
        kasbonNominal: 0,
        namaKaryawan: isGuest ? '' : userName || '',
        detailPengeluaran: [],
        metodePengembalian: '',
        lampiran: null,
        lampiranPengembalian: null,
        keterangan: '',
      });
      setFileName('');
      setFileNamePengembalian('');
      setFileSizePengembalian(0);
      setNewExpenseItem({ deskripsi: '', nominal: '' });
      setKasbonValidation({ isValid: null, message: '', isChecking: false });
      clearPenyelesaianDraft();
      showToast('Penyelesaian berhasil ditambahkan', 'success');
    } catch (error) {
      console.error('Error adding penyelesaian:', error);
      showToast('Gagal menambahkan Penyelesaian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetail = (penyelesaian) => {
    navigate(`/penyelesaian/${penyelesaian.id}`);
  };

  // Navigasi ke detail kasbon dari nomor kasbon (klik di tabel / detail).
  // Cek dulu lookup lokal, fallback query Supabase by nomor_kasbon.
  const handleKasbonDetail = async (nomorKasbon) => {
    if (!nomorKasbon) return;
    const local = kasbonList.find(k => k.nomorKasbon === nomorKasbon);
    if (local) {
      navigate(`/kasbon/${local.id}`);
      return;
    }
    try {
      const kasbon = await getKasbonByNomor(nomorKasbon);
      if (kasbon?.id) {
        navigate(`/kasbon/${kasbon.id}`);
      } else {
        showToast(`Detail kasbon "${nomorKasbon}" tidak ditemukan`, 'error');
      }
    } catch (e) {
      console.error('Error navigating to kasbon detail:', e);
      showToast('Gagal membuka detail kasbon', 'error');
    }
  };

  // Handle Approve Penyelesaian Tahap 1 (Manager): Pending -> Manager Approved
  const handleApprove = (penyelesaian) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Approval Manager (Tahap 1)',
      message: `Setujui sebagai Manager? "${penyelesaian.nomorPenyelesaian}" akan diteruskan ke Head Finance.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_approval: 'Manager Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager',
            manager_approved_by: userName || 'Manager',
            manager_approved_at: nowIso
          });
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
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
          console.error('Error approving penyelesaian:', error);
          showToast('Gagal menyetujui Penyelesaian', 'error');
        }
      }
    });
  };

  // Handle Approve Penyelesaian Tahap 2 (Head Finance): Manager Approved -> Approved
  const handleApproveHead = (penyelesaian) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Approval Head Finance (Tahap 2)',
      message: `Setujui sebagai Head Finance? "${penyelesaian.nomorPenyelesaian}" akan dapat ditandai Selesai oleh Finance.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_approval: 'Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Head Finance',
            head_finance_approved_by: userName || 'Head Finance',
            head_finance_approved_at: nowIso
          });
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Manager Approved',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Disetujui Head Finance.', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving penyelesaian:', error);
          showToast('Gagal menyetujui Penyelesaian', 'error');
        }
      }
    });
  };

  // Handle Reject Penyelesaian
  const handleReject = (penyelesaian) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Penolakan',
      message: `Apakah Anda yakin ingin menolak Penyelesaian "${penyelesaian.nomorPenyelesaian}"? Tindakan ini akan mengubah status menjadi Rejected.`,
      onConfirm: async () => {
        try {
          const nowIso = new Date().toISOString();
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager',
            rejected_by: userName || 'Manager',
            rejected_at: nowIso
          });
          // Log activity
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: penyelesaian.statusApproval || 'Pending',
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Penyelesaian berhasil ditolak', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error rejecting penyelesaian:', error);
          showToast('Gagal menolak Penyelesaian', 'error');
        }
      }
    });
  };

  // Handle Edit Penyelesaian - Only for Admin and Manager  
  const handleEdit = (penyelesaian) => {
    setFormData({
      nomorKasbon: penyelesaian.nomorKasbon || '',
      nomorQl: penyelesaian.nomorQl || '',
      namaEvent: penyelesaian.namaEvent || '',
      kasbonNominal: penyelesaian.kasbonNominal || 0,
      namaKaryawan: penyelesaian.namaKaryawan || '',
      detailPengeluaran: penyelesaian.detailPengeluaran || [],
      metodePengembalian: penyelesaian.metodePengembalian || '',
      lampiran: penyelesaian.lampiran || null,
      lampiranPengembalian: penyelesaian.lampiranPengembalian || null,
      keterangan: penyelesaian.keterangan || '',
    });
    setKasbonValidation({ isValid: true, message: 'Data dari penyelesaian yang diedit', isChecking: false });
    navigate(`/penyelesaian/${penyelesaian.id}`);
  };

  // Handle Delete Penyelesaian - Only for Admin and Manager
  const handleDelete = (penyelesaian) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Hapus Penyelesaian',
      message: `Apakah Anda yakin ingin menghapus Penyelesaian "${penyelesaian.nomorPenyelesaian}"? Data yang dihapus tidak dapat dikembalikan.`,
      onConfirm: async () => {
        try {
          // Log activity before delete
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'delete',
            fieldChanged: null,
            oldValue: `Kasbon: ${penyelesaian.nomorKasbon}, Total: Rp ${formatRupiah(penyelesaian.totalPengeluaran)}`,
            newValue: null,
            changedBy: userId,
            changedByName: userName
          });

          await deleteRecord('penyelesaian', penyelesaian.id);
          // Hapus file R2 milik record agar tidak jadi file yatim (best-effort)
          await deleteFilesOfRecords([penyelesaian]);
          showToast('Penyelesaian berhasil dihapus', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error deleting penyelesaian:', error);
          showToast('Gagal menghapus Penyelesaian', 'error');
        }
      }
    });
  };

  // Handle Mark as Selesai - Only for Finance
  const handleMarkSelesai = (penyelesaian) => {
    // Jika status selisih = Kekurangan, harus upload bukti transfer kekurangan dulu
    if (penyelesaian.statusSelisih === 'Kekurangan' && !penyelesaian.buktiKekurangan) {
      setSelectedPenyelesaianForKekurangan(penyelesaian);
      setShowBuktiKekuranganModal(true);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Tandai Selesai',
      message: `Apakah Anda yakin ingin menandai Penyelesaian "${penyelesaian.nomorPenyelesaian}" sebagai Selesai?`,
      onConfirm: async () => {
        try {
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_penyelesaian: 'Selesai'
          });

          // Log activity
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'complete',
            fieldChanged: 'status_penyelesaian',
            oldValue: 'Belum Selesai',
            newValue: 'Selesai',
            changedBy: userId,
            changedByName: userName
          });

          showToast('Penyelesaian berhasil ditandai selesai', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error marking penyelesaian as complete:', error);
          showToast('Gagal menandai Penyelesaian sebagai selesai', 'error');
        }
      }
    });
  };

  // Handle Upload Bukti Kekurangan & Tandai Selesai dari table
  const handleUploadBuktiKekuranganTable = async () => {
    if (!selectedPenyelesaianForKekurangan || !buktiKekuranganFile) return;

    setIsUploadingBuktiKekurangan(true);
    try {
      // Upload lalu update — bila update gagal, file ikut dihapus (anti yatim)
      const { result } = await uploadThenSave(
        () => uploadFile(buktiKekuranganFile, 'penyelesaian', selectedPenyelesaianForKekurangan.nomorPenyelesaian),
        (uploadResult) => updateRecord('penyelesaian', selectedPenyelesaianForKekurangan.id, {
          bukti_kekurangan: uploadResult.url,
          status_penyelesaian: 'Selesai'
        })
      );

      // Log activity
      await logActivity({
        tableName: 'penyelesaian',
        recordId: selectedPenyelesaianForKekurangan.id,
        recordNumber: selectedPenyelesaianForKekurangan.nomorPenyelesaian,
        action: 'upload_bukti_kekurangan',
        fieldChanged: 'bukti_kekurangan, status_penyelesaian',
        oldValue: 'Belum Selesai',
        newValue: 'Selesai (Bukti transfer kekurangan diupload)',
        changedBy: userId,
        changedByName: userName
      });

      showToast('Bukti transfer kekurangan berhasil diupload & penyelesaian ditandai selesai', 'success');
      setShowBuktiKekuranganModal(false);
      setBuktiKekuranganFile(null);
      setSelectedPenyelesaianForKekurangan(null);
      await refreshData();
      refreshNotifications();
    } catch (error) {
      console.error('Error uploading bukti kekurangan:', error);
      showToast('Gagal mengupload bukti transfer kekurangan', 'error');
    } finally {
      setIsUploadingBuktiKekurangan(false);
    }
  };

  // Data halaman aktif SUDAH difilter + dicari di server — tidak ada
  // sort/filter/slice di browser lagi. totalCount/totalPages dari Supabase count.
  const currentItems = penyelesaianRequests;
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Penyelesaian Kasbon</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Kelola pertanggungjawaban kasbon</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium">Buat Penyelesaian</span>
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
              placeholder="Cari berdasarkan Nomor Penyelesaian, Nomor Kasbon, Nama Event, atau Nama Karyawan..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700 mr-2">Filter Status:</span>
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Semua ({penyelesaianStats.total})
            </button>
            <button
              onClick={() => handleFilterChange('belum-selesai')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'belum-selesai'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Belum Selesai ({penyelesaianStats.belumSelesai})
            </button>
            <button
              onClick={() => handleFilterChange('selesai')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'selesai'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Selesai ({penyelesaianStats.selesai})
            </button>

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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
            <p className="text-gray-600">
              Menampilkan <span className="font-semibold text-gray-800">{totalCount === 0 ? 0 : indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, totalCount)}</span> dari <span className="font-semibold text-gray-800">{totalCount}</span> penyelesaian
              {isLoadingPenyelesaian && (
                <span className="text-gray-500"> (memuat...)</span>
              )}
            </p>
            {searchTerm && (
              <p className="text-gray-600">
                Hasil pencarian untuk: <span className="font-semibold text-amber-600">"{searchTerm}"</span>
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
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Penyelesaian</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Kasbon</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Karyawan</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nominal Kasbon</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Pengeluaran</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Selisih</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Metode Pengembalian</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Lampiran</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Approval</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Oleh</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Head Finance</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Penyelesaian</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((penyelesaian) => {
                      const isHidden = penyelesaian.isConfidential && !canViewConfidential;
                      return (
                      <tr key={penyelesaian.nomorPenyelesaian} className={`hover:bg-gray-50 transition-colors ${isHidden ? 'bg-gray-50' : ''}`}>
                        <td className="py-4 px-6">
                          <Link
                            to={`/penyelesaian/${penyelesaian.id}`}
                            className="text-sm font-bold text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
                          >
                            {penyelesaian.isConfidential && (
                              <span className="inline-flex items-center mr-1.5 text-amber-600" title="Confidential">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                              </span>
                            )}
                            {penyelesaian.nomorPenyelesaian}
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          {isHidden || !penyelesaian.nomorKasbon ? (
                            <span className="text-sm font-medium text-emerald-600">{isHidden ? '***' : '-'}</span>
                          ) : (() => {
                            const kasbonId = kasbonList.find(k => k.nomorKasbon === penyelesaian.nomorKasbon)?.id;
                            return kasbonId ? (
                              <Link
                                to={`/kasbon/${kasbonId}`}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                                title={`Lihat detail kasbon ${penyelesaian.nomorKasbon}`}
                              >
                                {penyelesaian.nomorKasbon}
                              </Link>
                            ) : (
                              <button
                                onClick={() => handleKasbonDetail(penyelesaian.nomorKasbon)}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                                title={`Lihat detail kasbon ${penyelesaian.nomorKasbon}`}
                              >
                                {penyelesaian.nomorKasbon}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-600 whitespace-nowrap">{penyelesaian.tanggal}</div>
                          {penyelesaian.tanggalJam && penyelesaian.tanggalJam !== '-' && (
                            <div className="text-xs text-gray-400 whitespace-nowrap">{penyelesaian.tanggalJam.split(' ')[1] || ''}</div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700 font-medium">{isHidden ? 'CONFIDENTIAL' : penyelesaian.namaKaryawan}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{isHidden ? 'CONFIDENTIAL' : formatRupiah(penyelesaian.kasbonNominal)}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{isHidden ? 'CONFIDENTIAL' : formatRupiah(penyelesaian.totalPengeluaran)}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isHidden ? <span className="text-xs text-gray-400">CONFIDENTIAL</span> : getStatusSelisihBadge(penyelesaian.statusSelisih)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isHidden ? (
                            <span className="text-xs text-gray-400">CONFIDENTIAL</span>
                          ) : (
                            penyelesaian.statusSelisih === 'Pengembalian' ? (
                              penyelesaian.metodePengembalian === 'Transfer' ? (
                                <div className="flex items-center justify-center space-x-1">
                                  <Banknote className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs font-medium text-blue-700">Transfer</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-1">
                                  <Wallet className="w-4 h-4 text-emerald-600" />
                                  <span className="text-xs font-medium text-emerald-700">Cash</span>
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isHidden ? (
                            <span className="text-xs text-gray-400">CONFIDENTIAL</span>
                          ) : (
                            penyelesaian.lampiran ? (
                              <a
                                href={penyelesaian.lampiran}
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
                            )
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isHidden ? <span className="text-xs text-gray-400">CONFIDENTIAL</span> : getStatusApprovalBadge(penyelesaian.statusApproval)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{isHidden ? '***' : penyelesaian.disetujuiOleh}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{isHidden ? '***' : (penyelesaian.disetujuiHeadFinance || '-')}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isHidden ? <span className="text-xs text-gray-400">CONFIDENTIAL</span> : getStatusPenyelesaianBadge(penyelesaian.statusPenyelesaian)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleDetail(penyelesaian)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Detail</span>
                            </button>

                            {/* Approve Tahap 1 (Manager): Pending -> Manager Approved */}
                            {canApproveManager && penyelesaian.statusApproval === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                  title="Approve Manager"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleReject(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Approve Tahap 2 (Head Finance): Manager Approved -> Approved */}
                            {canApproveHead && penyelesaian.statusApproval === 'Manager Approved' && (
                              <>
                                <button
                                  onClick={() => handleApproveHead(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                  title="Approve Head Finance"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Approve HF</span>
                                </button>
                                <button
                                  onClick={() => handleReject(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Aksi Selesai untuk Finance */}
                            {isFinance && penyelesaian.statusApproval === 'Approved' && penyelesaian.statusPenyelesaian === 'Belum Selesai' && (
                              <button
                                onClick={() => handleMarkSelesai(penyelesaian)}
                                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                                  penyelesaian.statusSelisih === 'Kekurangan' && !penyelesaian.buktiKekurangan
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                }`}
                                title={penyelesaian.statusSelisih === 'Kekurangan' && !penyelesaian.buktiKekurangan ? 'Upload Bukti Kekurangan & Selesai' : 'Tandai Selesai'}
                              >
                                {penyelesaian.statusSelisih === 'Kekurangan' && !penyelesaian.buktiKekurangan ? (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    <span>Selesai</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Selesai</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Aksi Edit/Delete — edit & hapus mengikuti permission per-user */}
                            {canEdit && !isLocked(penyelesaian) && (
                              <button
                                onClick={() => handleEdit(penyelesaian)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                            )}
                            {canDelete && !isLocked(penyelesaian) && (
                              <button
                                onClick={() => handleDelete(penyelesaian)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan="14" className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-gray-600 font-medium">Tidak ada data ditemukan</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {searchTerm
                                ? `Tidak ada hasil untuk "${searchTerm}"`
                                : 'Tidak ada penyelesaian dengan filter yang dipilih'}
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
                            ? 'bg-amber-600 text-white shadow-sm'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-amber-600 sticky top-0 z-10 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Buat Penyelesaian Kasbon</h2>
                  <p className="text-sm text-white/80 mt-1">Isi form pertanggungjawaban kasbon</p>
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
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Info Dasar */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-amber-600 rounded mr-3"></span>
                  Informasi Dasar
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Nomor Penyelesaian (Auto) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Penyelesaian</label>
                    <input
                      type="text"
                      value="Akan digenerate otomatis saat submit"
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 italic"
                    />
                    <p className="text-xs text-gray-500 mt-1">Nomor unik akan digenerate saat submit untuk menghindari konflik</p>
                  </div>

                  {/* Nomor Kasbon - Input untuk lookup */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Kasbon <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          name="nomorKasbon"
                          value={formData.nomorKasbon}
                          onChange={handleInputChange}
                          onBlur={handleKasbonBlur}
                          required
                          placeholder="Masukkan nomor kasbon (contoh: KBN-...)"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${kasbonValidation.isValid === true
                            ? 'border-green-500 focus:ring-green-500'
                            : kasbonValidation.isValid === false
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-200 focus:ring-amber-500'
                            }`}
                        />
                        {kasbonValidation.isChecking && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleKasbonBlur}
                        disabled={kasbonValidation.isChecking || !formData.nomorKasbon}
                        className="px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400 flex items-center gap-2 font-medium shadow-sm whitespace-nowrap"
                      >
                        <Search className="w-4 h-4" />
                        <span>Cek Nomor</span>
                      </button>
                    </div>
                    {kasbonValidation.message && (
                      <p className={`text-xs mt-1 font-medium ${kasbonValidation.isValid ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {kasbonValidation.message}
                      </p>
                    )}
                    {!kasbonValidation.message && (
                      <p className="text-xs text-gray-500 mt-1">Masukkan nomor kasbon lalu klik Cek Nomor</p>
                    )}
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

                  {/* Nomor QL (Auto dari kasbon) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor QL</label>
                    <input
                      type="text"
                      value={formData.nomorQl}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                    />
                    <QLInfo value={formData.nomorQl} />
                    <p className="text-xs text-gray-500 mt-1">Otomatis dari kasbon</p>
                  </div>

                  {/* Nama Event/Project (Auto dari kasbon) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Event/Project</label>
                    <input
                      type="text"
                      value={formData.namaEvent || '-'}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Otomatis dari kasbon</p>
                  </div>

                  {/* Nama Karyawan */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Karyawan {isGuest && !formData.nomorKasbon && <span className="text-red-500">*</span>}
                    </label>
                    {isGuest && !formData.nomorKasbon ? (
                      <input
                        type="text"
                        name="namaKaryawan"
                        value={formData.namaKaryawan}
                        onChange={handleInputChange}
                        placeholder="Masukkan nama karyawan"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData.namaKaryawan}
                        disabled
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {isGuest && !formData.nomorKasbon
                        ? 'Input manual untuk role guest (jika tidak memilih kasbon)'
                        : 'Otomatis dari kasbon'}
                    </p>
                  </div>

                  {/* Nominal Kasbon (Auto dari kasbon) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nominal Kasbon</label>
                    <input
                      type="text"
                      value={formData.kasbonNominal ? formatRupiah(formData.kasbonNominal) : '0'}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-semibold"
                    />
                    <p className="text-xs text-gray-500 mt-1">Otomatis dari kasbon</p>
                  </div>
                </div>
              </div>

              {/* Detail Pengeluaran */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-blue-600 rounded mr-3"></span>
                  Detail Pengeluaran
                </h3>

                {/* Input Expense Item */}
                <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-blue-700 mb-2">Deskripsi Pengeluaran</label>
                      <input
                        type="text"
                        name="deskripsi"
                        value={newExpenseItem.deskripsi}
                        onChange={handleExpenseItemChange}
                        placeholder="Misal: Bensin, Makan, Tol, dll"
                        className="w-full px-4 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-blue-700 mb-2">Nominal</label>
                        <input
                          type="text"
                          name="nominal"
                          value={formatRupiah(newExpenseItem.nominal || 0)}
                          onChange={handleExpenseItemChange}
                          placeholder="0"
                          className="w-full px-4 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addExpenseItem}
                        disabled={!newExpenseItem.deskripsi || !newExpenseItem.nominal}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <PlusCircle className="w-5 h-5" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* List Expenses */}
                {formData.detailPengeluaran.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {formData.detailPengeluaran.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{item.deskripsi}</p>
                          <p className="text-xs text-gray-500 mt-1">Item #{index + 1}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <p className="text-base font-bold text-gray-900">Rp {formatRupiah(item.nominal)}</p>
                          <button
                            type="button"
                            onClick={() => removeExpenseItem(index)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">Belum ada detail pengeluaran</p>
                    <p className="text-xs text-gray-500 mt-1">Tambahkan item pengeluaran di atas</p>
                  </div>
                )}

                {/* Summary */}
                {formData.detailPengeluaran.length > 0 && (
                  <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-6 border-2 border-emerald-200 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Nominal Kasbon</label>
                        <p className="text-2xl font-bold text-gray-900 mt-2">Rp {formatRupiah(formData.kasbonNominal)}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Pengeluaran</label>
                        <p className="text-2xl font-bold text-gray-900 mt-2">Rp {formatRupiah(calculateTotalExpense())}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</label>
                        <div className="mt-2">
                          {getStatusSelisihBadge(getStatusSelisih())}
                          <p className={`text-lg font-bold mt-2 ${calculateSelisih() > 0 ? 'text-blue-600' : calculateSelisih() < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {calculateSelisih() > 0 ? 'Pengembalian: ' : calculateSelisih() < 0 ? 'Kekurangan: ' : 'Pas: '}
                            Rp {formatRupiah(Math.abs(calculateSelisih()))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Metode Pengembalian - Conditional */}
              {formData.detailPengeluaran.length > 0 && getStatusSelisih() === 'Pengembalian' && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-1 h-6 bg-blue-600 rounded mr-3"></span>
                    Metode Pengembalian
                  </h3>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <label className="block text-sm font-semibold text-blue-800 mb-3">
                      Pilih Metode Pengembalian Sisa Dana <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, metodePengembalian: 'Transfer' }))}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-lg border-2 transition-all ${formData.metodePengembalian === 'Transfer'
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-blue-200 hover:border-blue-300 bg-white'
                          }`}
                      >
                        <Banknote className={`w-6 h-6 ${formData.metodePengembalian === 'Transfer' ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className={`font-medium ${formData.metodePengembalian === 'Transfer' ? 'text-blue-700' : 'text-gray-700'}`}>
                          Transfer Bank
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, metodePengembalian: 'Cash', lampiranPengembalian: null }));
                          setFileNamePengembalian('');
                          setFileSizePengembalian(0);
                        }}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-lg border-2 transition-all ${formData.metodePengembalian === 'Cash'
                          ? 'border-emerald-500 bg-emerald-100'
                          : 'border-blue-200 hover:border-blue-300 bg-white'
                          }`}
                      >
                        <Wallet className={`w-6 h-6 ${formData.metodePengembalian === 'Cash' ? 'text-emerald-600' : 'text-gray-600'}`} />
                        <span className={`font-medium ${formData.metodePengembalian === 'Cash' ? 'text-emerald-700' : 'text-gray-700'}`}>
                          Cash / Tunai
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-blue-700 mt-3">
                      Sisa dana sebesar <span className="font-bold">Rp {formatRupiah(Math.abs(calculateSelisih()))}</span> akan dikembalikan ke Finance
                    </p>

                    {/* Upload Bukti Pengembalian - Hanya muncul jika Transfer */}
                    {formData.metodePengembalian === 'Transfer' && (
                      <div className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <label className="block text-sm font-semibold text-amber-800 mb-3">
                          Lampiran Bukti Pengembalian ke Finance <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center space-x-3">
                            <label className={`flex-1 flex items-center justify-center space-x-3 px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${uploadingFilePengembalian
                              ? 'border-amber-300 bg-amber-100 cursor-wait'
                              : 'border-amber-300 hover:border-amber-500 hover:bg-amber-100 cursor-pointer bg-white'
                              }`}>
                              <Paperclip className={`w-5 h-5 ${uploadingFilePengembalian ? 'text-amber-600 animate-pulse' : 'text-amber-500'}`} />
                              <span className={`text-sm ${uploadingFilePengembalian ? 'text-amber-700 font-medium' : 'text-amber-600'}`}>
                                {uploadingFilePengembalian ? 'Mengupload file...' : fileNamePengembalian ? fileNamePengembalian : 'Upload bukti transfer pengembalian'}
                              </span>
                              <input
                                type="file"
                                onChange={handleFilePengembalianChange}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                className="hidden"
                                disabled={uploadingFilePengembalian}
                              />
                            </label>
                            {fileNamePengembalian && !uploadingFilePengembalian && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Hapus file dari storage juga agar tidak yatim
                                  if (formData.lampiranPengembalian) {
                                    deleteR2Files([formData.lampiranPengembalian]);
                                  }
                                  setFileNamePengembalian('');
                                  setFileSizePengembalian(0);
                                  setFormData(prev => ({ ...prev, lampiranPengembalian: null }));
                                }}
                                className="p-2.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                                title="Hapus file"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>

                          {/* Upload Progress */}
                          {uploadingFilePengembalian && (
                            <div className="bg-amber-100 border border-amber-300 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-amber-700">Mengupload...</span>
                                <span className="text-sm text-amber-600">{uploadProgressPengembalian}%</span>
                              </div>
                              <div className="w-full bg-amber-200 rounded-full h-2">
                                <div
                                  className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgressPengembalian}%` }}
                                ></div>
                              </div>
                              {fileSizePengembalian > 0 && (
                                <p className="text-xs text-amber-600 mt-2">
                                  Ukuran file: {formatFileSize(fileSizePengembalian)}
                                </p>
                              )}
                            </div>
                          )}

                          {/* File Info */}
                          {fileNamePengembalian && fileSizePengembalian > 0 && !uploadingFilePengembalian && (
                            <div className="bg-white border border-amber-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-amber-600" />
                                  <span className="text-sm font-medium text-amber-700">{fileNamePengembalian}</span>
                                </div>
                                <span className="text-xs text-amber-500">{formatFileSize(fileSizePengembalian)}</span>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-amber-600">
                            Upload bukti transfer pengembalian dana ke Finance (Format: PDF, Word, Excel, atau Gambar - Max 10MB)
                          </p>

                          {formData.lampiranPengembalian && !uploadingFilePengembalian && (
                            <div className="flex items-center space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-bold">✓</span>
                              </div>
                              <span className="text-sm font-medium text-emerald-700">Bukti pengembalian berhasil diupload</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lampiran */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-emerald-600 rounded mr-3"></span>
                  Lampiran & Keterangan
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lampiran Bukti <span className="text-red-500">*</span></label>
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center space-x-3">
                        <label className={`flex-1 flex items-center justify-center space-x-3 px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${uploadingFile
                          ? 'border-amber-300 bg-amber-50 cursor-wait'
                          : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50 cursor-pointer'
                          }`}>
                          <Paperclip className={`w-5 h-5 ${uploadingFile ? 'text-amber-600 animate-pulse' : 'text-gray-500'}`} />
                          <span className={`text-sm ${uploadingFile ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>
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
                              // Hapus file dari storage juga agar tidak yatim
                              if (formData.lampiran) {
                                deleteR2Files([formData.lampiran]);
                              }
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
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-amber-700">Mengupload...</span>
                            <span className="text-sm text-amber-600">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-amber-200 rounded-full h-2">
                            <div
                              className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          {fileSize > 0 && (
                            <p className="text-xs text-amber-600 mt-2">
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan <span className="text-red-500">*</span></label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      placeholder="Masukkan keterangan penyelesaian kasbon..."
                      required
                      rows="4"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Jelaskan detail pertanggungjawaban kasbon</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || formData.detailPengeluaran.length === 0 || (getStatusSelisih() === 'Pengembalian' && !formData.metodePengembalian)}
                  className="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : 'Buat Penyelesaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Lampiran */}
      {showPreviewModal && previewFile && (
        <FilePreview
          fileUrl={previewFile}
          fileName={previewFile?.split('/').pop() || 'File'}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewFile(null);
          }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Modal Upload Bukti Transfer Kekurangan */}
      {showBuktiKekuranganModal && selectedPenyelesaianForKekurangan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-600 to-amber-700 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer Kekurangan</h3>
                  <p className="text-sm text-white/80">{selectedPenyelesaianForKekurangan.nomorPenyelesaian}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBuktiKekuranganModal(false);
                  setBuktiKekuranganFile(null);
                  setSelectedPenyelesaianForKekurangan(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info Penyelesaian */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Karyawan:</span>
                    <p className="font-medium text-gray-800">{selectedPenyelesaianForKekurangan.namaKaryawan || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nominal Kekurangan:</span>
                    <p className="font-semibold text-amber-600">Rp {new Intl.NumberFormat('id-ID').format(Math.abs(selectedPenyelesaianForKekurangan.selisih || 0))}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Kasbon:</span>
                    <p className="font-medium text-gray-800">Rp {new Intl.NumberFormat('id-ID').format(selectedPenyelesaianForKekurangan.kasbonNominal || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Pengeluaran:</span>
                    <p className="font-medium text-gray-800">Rp {new Intl.NumberFormat('id-ID').format(selectedPenyelesaianForKekurangan.totalPengeluaran || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Info Kekurangan */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  Karyawan mengeluarkan lebih dari kasbon yang diberikan. Silakan transfer kekurangan sebesar <strong>Rp {new Intl.NumberFormat('id-ID').format(Math.abs(selectedPenyelesaianForKekurangan.selisih || 0))}</strong> dan upload bukti transfernya untuk menandai penyelesaian ini selesai.
                </p>
              </div>

              {/* Upload Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lampiran Bukti Transfer yang Kekurangan <span className="text-red-500">*</span>
                </label>
                <PasteUpload
                  onFileSelect={(file) => setBuktiKekuranganFile(file)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSize={10}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowBuktiKekuranganModal(false);
                    setBuktiKekuranganFile(null);
                    setSelectedPenyelesaianForKekurangan(null);
                  }}
                  disabled={isUploadingBuktiKekurangan}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleUploadBuktiKekuranganTable}
                  disabled={!buktiKekuranganFile || isUploadingBuktiKekurangan}
                  className={`px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiKekuranganFile || isUploadingBuktiKekurangan) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploadingBuktiKekurangan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Upload & Tandai Selesai</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Penyelesaian;
