import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Download, Eye, X, Building2, ChevronLeft, ChevronRight, Paperclip, FileText, ExternalLink, Printer, Edit2, Trash2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { useVendor } from '../context/VendorContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';
import { createRecord, updateRecord, deleteRecord, bulkDeleteRecords, uploadFile, countRecords } from '../lib/api';
import { usePaginatedTable } from '../hooks/usePaginatedTable';
import { logActivity } from '../lib/auditLog';
import { deleteFilesOfRecords, deleteReplacedFiles, deleteR2Files, uploadThenSave } from '../utils/fileCleanup';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS, getTipeOptionsByRole, getIdPerusahaanOptionsByRole } from '../constants/companyTypes';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';
import QLInfo from '../components/QLInfo';
import QLLink from '../components/QLLink';
import ConfirmDialog from '../components/ConfirmDialog';
import PasteUpload from '../components/PasteUpload';
import MultiFileUpload from '../components/MultiFileUpload';
import jsPDF from 'jspdf';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { generatePRNumber } from '../utils/generateUniqueNumber';
import { sendTransferNotification } from '../lib/emailNotifications';
import { formatTanggalJamPendek, getStatusBadgeClass, calcDurations } from '../lib/approvalFlow';

const PaymentRequest = () => {
  const navigate = useNavigate();
  const { vendors, addVendor, getVendorById, searchVendors, getActiveVendors } = useVendor();
  const { userName, userRole, userId, hasPermission } = useAuth();
  const { showToast } = useToast();
  const { refreshNotifications } = useNotification();

  // Check if user is manager (can edit/delete/approve)
  // Permission per-user (default mengikuti role, bisa dioverride Administrator dari halaman Karyawan)
  const canManage = hasPermission ? hasPermission('approve') : ['administrator', 'manager', 'bod'].includes(userRole);
  const isAuthorizedApprover = hasPermission ? hasPermission('approve') : ['administrator', 'manager', 'bod'].includes(userRole?.toLowerCase());
  const canApproveManager = hasPermission ? (hasPermission('approve_manager') || hasPermission('approve')) : ['administrator', 'manager', 'bod'].includes(userRole?.toLowerCase());
  const canApproveHead = hasPermission ? (hasPermission('approve_head_finance') || hasPermission('approve')) : ['administrator', 'head_finance'].includes(userRole?.toLowerCase());
  const isGuest = userRole === 'guest';
  const isFinance = hasPermission ? hasPermission('transfer') : userRole === 'team_finance';
  const isAdmin = userRole?.toLowerCase() === 'administrator';
  // BOD, Team Finance & Admin can edit
  const canEditDelete = hasPermission ? hasPermission('edit_payment_request') : ['administrator', 'bod', 'team_finance'].includes(userRole?.toLowerCase());
  // Only Admin & BOD can delete
  const canDelete = hasPermission ? hasPermission('delete_payment_request') : ['administrator', 'bod'].includes(userRole?.toLowerCase());

  // Helper to check if record is locked
  const isLocked = (record) => {
    if (isAdmin) return false;
    return record.statusTransfer === 'Sudah Transfer';
  };

  // Check if user can view confidential data (BOD, Admin, Team Finance, HRD)
  const canViewConfidential = hasPermission ? hasPermission('view_confidential') : ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());

  const [filterStatus, setFilterStatus] = useState('all'); // all, belum-transfer, sudah-transfer
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const ITEMS_PER_PAGE = 10;

  // State untuk bulk delete (hanya Administrator)
  const [selectedItems, setSelectedItems] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [editingPR, setEditingPR] = useState(null);

  // State untuk confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => { }
  });

  // State untuk autocomplete vendor
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // State untuk form PR
  const [formData, setFormData] = useState({
    nomorQl: '',
    namaEvent: '', // Field wajib untuk nama event/project
    tipe: '',
    idPerusahaan: '',
    metodePembayaran: 'Transfer Rekening', // Transfer Rekening atau Virtual Account
    vendor: '',
    vendorId: null,
    virtualAccountNumber: '',
    virtualAccountName: '',
    nominal: '',
    namaKaryawan: isGuest ? '' : userName || '',
    keterangan: '',
    lampiran: [], // Array untuk multiple files
  });

  // State untuk multiple files upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUploadProgress, setFileUploadProgress] = useState({});

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // State untuk form vendor baru
  const [newVendorData, setNewVendorData] = useState({
    nama: '',
    namaBank: '',
    nomorRekening: '',
    namaPemilikRekening: '',
  });

  const [vendorError, setVendorError] = useState('');

  // State untuk modal bukti transfer
  const [showBuktiTransferModal, setShowBuktiTransferModal] = useState(false);
  const [transferringPR, setTransferringPR] = useState(null);
  const [buktiTransferFile, setBuktiTransferFile] = useState(null);
  const [buktiTransferFileName, setBuktiTransferFileName] = useState('');
  const [uploadingBuktiTransfer, setUploadingBuktiTransfer] = useState(false);

  // State untuk mencegah double submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination + search + filter di server (Supabase .range/.or),
  // browser hanya menerima 1 halaman (10 row), bukan ribuan row.
  const transformPRRow = useCallback((pr) => {
    // Get vendor name - vendor_id bisa UUID atau INTEGER tergantung schema
    let vendorName = '';
    if (pr.vendor_id) {
      const vendor = getVendorById(pr.vendor_id);
      vendorName = vendor?.nama || '';
    }
    const sla = calcDurations(pr);

    return {
      id: pr.id,
      nomorPr: pr.nomor_pr,
      nomorQl: pr.nomor_ql || '',
      namaEvent: pr.nama_event || '',
      tanggal: pr.created_at ? new Date(pr.created_at).toISOString().split('T')[0] : '',
      tanggalJam: pr.created_at ? formatTanggalJamPendek(pr.created_at) : '-',
      tipe: pr.tipe || '',
      idPerusahaan: pr.id_perusahaan || '',
      metodePembayaran: pr.metode_pembayaran || 'Transfer Rekening',
      vendor: vendorName,
      vendorId: pr.vendor_id,
      virtualAccountNumber: pr.virtual_account_number || '',
      virtualAccountName: pr.virtual_account_name || '',
      nominal: parseFloat(pr.nominal) || 0,
      statusApproval: pr.status_approval || 'Pending',
      disetujuiOleh: pr.disetujui_oleh || '-',
      disetujuiHeadFinance: pr.head_finance_approved_by || '-',
      statusTransfer: pr.status_transfer || 'Belum Transfer',
      keterangan: pr.keterangan || '',
      lampiran: pr.lampiran || null,
      buktiTransfer: pr.bukti_transfer || null,
      namaKaryawan: pr.nama_karyawan || '',
      created_by: pr.created_by || null,
      isConfidential: pr.is_confidential || false,
      manager_approved_at: pr.manager_approved_at || null,
      manager_approved_by: pr.manager_approved_by || null,
      head_finance_approved_at: pr.head_finance_approved_at || null,
      head_finance_approved_by: pr.head_finance_approved_by || null,
      transferred_at: pr.transferred_at || null,
      rejected_at: pr.rejected_at || null,
      rejected_by: pr.rejected_by || null,
      durasiManager: sla.manager,
      durasiHeadFinance: sla.headFinance,
      durasiTransfer: sla.transfer
    };
  }, [getVendorById]);

  const serverFilters = useMemo(() => {
    const f = {};
    if (filterStatus === 'belum-transfer') f.status_transfer = 'Belum Transfer';
    if (filterStatus === 'sudah-transfer') f.status_transfer = 'Sudah Transfer';
    if (dateFrom) f.start_date = dateFrom;
    if (dateTo) f.end_date = dateTo;
    return f;
  }, [filterStatus, dateFrom, dateTo]);

  const {
    items: paymentRequests,
    totalCount,
    totalPages,
    page: currentPage,
    setPage: setCurrentPage,
    search: searchTerm,
    setSearch: setSearchTerm,
    setFilters: setServerFilters,
    loading: isLoadingPR,
    refresh: refreshPage,
    applyInsert,
    applyUpdate,
    applyDelete,
  } = usePaginatedTable('payment_requests', {
    limit: ITEMS_PER_PAGE,
    transform: transformPRRow,
  });

  // Terapkan filter status + tanggal UI ke query server (reset ke halaman 1)
  useEffect(() => {
    setServerFilters(serverFilters);
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, dateFrom, dateTo]);

  // Statistik kartu via HEAD count (4 request ringan, tanpa download row).
  const [prStats, setPrStats] = useState({ total: 0, belum: 0, sudah: 0, approved: 0 });
  const refreshStats = useCallback(async () => {
    try {
      const [total, belum, sudah, approved] = await Promise.all([
        countRecords('payment_requests'),
        countRecords('payment_requests', { status_transfer: 'Belum Transfer' }),
        countRecords('payment_requests', { status_transfer: 'Sudah Transfer' }),
        countRecords('payment_requests', { status_approval: 'Approved' }),
      ]);
      setPrStats({ total, belum, sudah, approved });
    } catch (e) {
      console.error('Error fetching payment request stats:', e);
    }
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  const refreshData = useCallback(async () => {
    await Promise.all([refreshPage(), refreshStats()]);
  }, [refreshPage, refreshStats]);

  // Realtime: update halaman aktif saja, tanpa refetch full.
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      applyInsert(transformPRRow(newRecord));
      refreshStats();
      showToast('Data payment request baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      const patch = transformPRRow(newRecord);
      applyUpdate(newRecord.id, patch);
      refreshStats();
      showToast('Data payment request diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      applyDelete(oldRecord.id);
      refreshStats();
      showToast('Data payment request dihapus', 'info');
    }
    refreshNotifications();
  }, [applyInsert, applyUpdate, applyDelete, transformPRRow, refreshStats, refreshNotifications, showToast]);

  useRealtimeSubscription('payment_requests', { onAnyChange: handleRealtimeChange });

  // Format tanggal sekarang
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Data halaman aktif SUDAH difilter + dicari di server — tidak ada
  // sort/filter/slice di browser lagi. totalCount/totalPages dari Supabase count.
  const currentItems = paymentRequests;
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = (currentPage - 1) * ITEMS_PER_PAGE;

  // Handle page change
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

  const stats = [
    { label: 'Total Request', value: prStats.total.toString(), color: 'bg-blue-50 text-blue-600' },
    { label: 'Belum Transfer', value: prStats.belum.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Sudah Transfer', value: prStats.sudah.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: prStats.approved.toString(), color: 'bg-blue-50 text-blue-600' },
  ];

  const getStatusApprovalBadge = (status) => {
    const badges = {
      'Pending': 'bg-amber-50 text-amber-700',
      'Manager Approved': 'bg-blue-50 text-blue-700',
      'Approved': 'bg-emerald-50 text-emerald-700',
      'Rejected': 'bg-rose-50 text-rose-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || getStatusBadgeClass(status)}`}>{status}</span>;
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Auto-set ID Perusahaan tidak diperlukan lagi - semua options ditampilkan
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
  const uploadAllFiles = async (nomorPr) => {
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
          const result = await uploadFile(file, 'payment-requests', nomorPr, userName);

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

  // Handle preview lampiran - langsung buka di tab baru
  const handlePreviewLampiran = (fileUrl) => {
    if (!fileUrl) {
      showToast('Tidak ada file lampiran', 'error');
      return;
    }
    window.open(fileUrl, '_blank');
  };

  const handleVendorSearch = (value) => {
    setVendorSearchTerm(value);
    if (value.trim().length > 0) {
      const results = searchVendors(value);
      setFilteredVendors(results);
      setShowVendorDropdown(true);
    } else {
      setFilteredVendors([]);
      setShowVendorDropdown(false);
    }
    // Clear selected vendor if user types
    setSelectedVendor(null);
    setFormData(prev => ({ ...prev, vendor: '', vendorId: null }));
  };

  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setVendorSearchTerm(vendor.nama);
    setFormData(prev => ({
      ...prev,
      vendor: vendor.nama,
      vendorId: vendor.id
    }));
    setShowVendorDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Cegah double submit
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Check if BOD (lampiran & nomor QL optional for BOD)
      const isBODUser = userRole?.toLowerCase() === 'bod';
      const isVirtualAccount = formData.metodePembayaran === 'Virtual Account';

      // Validasi form dasar
      if (!formData.nominal || !formData.tipe || !formData.namaEvent) {
        showToast('Mohon lengkapi semua field yang wajib diisi (termasuk Nama Event/Project)', 'error');
        return;
      }

      // Validasi berdasarkan metode pembayaran
      if (isVirtualAccount) {
        if (!formData.virtualAccountNumber || !formData.virtualAccountName) {
          showToast('Mohon lengkapi Nomor Virtual Account dan Nama', 'error');
          return;
        }
      } else {
        if (!formData.vendor || !formData.vendorId) {
          showToast('Mohon pilih vendor yang valid', 'error');
          return;
        }
      }

      // Validasi lampiran (opsional untuk BOD, wajib untuk lainnya)
      if (!isBODUser && selectedFiles.length === 0 && formData.lampiran.length === 0) {
        showToast('Mohon upload minimal 1 file lampiran', 'error');
        return;
      }

      // Jika sedang edit, update data yang ada
      if (editingPR) {
        // Saat edit: pertahankan nama karyawan asli, jangan overwrite dengan nama admin
        const namaKaryawanValue = formData.namaKaryawan || '';
        // Upload new files if any
        let uploadedUrls = [...(formData.lampiran || [])];
        let newUrls = [];
        if (selectedFiles.length > 0) {
          newUrls = await uploadAllFiles(editingPR.nomorPr);
          uploadedUrls = [...uploadedUrls, ...newUrls];
        }

        const updateData = {
          nomor_ql: formData.nomorQl || null,
          nama_event: formData.namaEvent,
          tipe: formData.tipe,
          id_perusahaan: formData.idPerusahaan || null,
          metode_pembayaran: formData.metodePembayaran,
          vendor_id: isVirtualAccount ? null : formData.vendorId,
          virtual_account_number: isVirtualAccount ? formData.virtualAccountNumber : null,
          virtual_account_name: isVirtualAccount ? formData.virtualAccountName : null,
          nominal: parseFloat(formData.nominal),
          keterangan: formData.keterangan || null,
          lampiran: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
          nama_karyawan: namaKaryawanValue
        };

        try {
          await updateRecord('payment_requests', editingPR.id, updateData);
        } catch (updateErr) {
          // Update gagal — hapus file yang baru diupload agar tidak yatim
          await deleteR2Files(newUrls);
          throw updateErr;
        }
        // Hapus file lama yang sudah tidak dipakai lagi (best-effort)
        await deleteReplacedFiles(editingPR.lampiran, uploadedUrls);
        showToast('Payment Request berhasil diperbarui', 'success');
      } else {

        // Jika baru, buat data baru - generate unique number at submit time
        const namaKaryawanValue = isGuest ? formData.namaKaryawan : userName || '';
        const nomorPr = generatePRNumber();

        // Upload all selected files
        let uploadedUrls = [];
        if (selectedFiles.length > 0) {
          uploadedUrls = await uploadAllFiles(nomorPr);
        }

        // BOD transactions are confidential and auto-approved
        // HRD transactions are confidential but need BOD approval
        const isBOD = userRole?.toLowerCase() === 'bod';
        const isHRD = userRole?.toLowerCase() === 'hrd';

        const newPRData = {
          nomor_pr: nomorPr,
          nomor_ql: formData.nomorQl || null,
          nama_event: formData.namaEvent,
          tipe: formData.tipe,
          id_perusahaan: formData.idPerusahaan || null,
          metode_pembayaran: formData.metodePembayaran,
          vendor_id: isVirtualAccount ? null : formData.vendorId,
          virtual_account_number: isVirtualAccount ? formData.virtualAccountNumber : null,
          virtual_account_name: isVirtualAccount ? formData.virtualAccountName : null,
          nominal: parseFloat(formData.nominal),
          keterangan: formData.keterangan || null,
          lampiran: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
          status_transfer: 'Belum Transfer',
          // BOD: auto lolos Manager + Head Finance sekaligus (langsung Approved final)
          status_approval: isBOD ? 'Approved' : 'Pending',
          disetujui_oleh: isBOD ? userName : null,
          manager_approved_by: isBOD ? userName : null,
          manager_approved_at: isBOD ? new Date().toISOString() : null,
          head_finance_approved_by: isBOD ? userName : null,
          head_finance_approved_at: isBOD ? new Date().toISOString() : null,
          nama_karyawan: namaKaryawanValue,
          is_confidential: isBOD || isHRD
        };

        let createdPR = null;
        try {
          createdPR = await createRecord('payment_requests', newPRData);
        } catch (createErr) {
          // Simpan gagal — hapus file yang sudah terupload agar tidak yatim
          await deleteR2Files(uploadedUrls);
          throw createErr;
        }

        // Log activity untuk CREATE
        await logActivity({
          tableName: 'payment_requests',
          recordId: createdPR.id,
          recordNumber: nomorPr,
          action: 'create',
          fieldChanged: null,
          oldValue: null,
          newValue: `Nominal: Rp ${parseFloat(formData.nominal).toLocaleString('id-ID')}`,
          changedBy: userId,
          changedByName: userName
        });

        showToast('Payment Request berhasil ditambahkan', 'success');
      }

      // Refresh data setelah berhasil simpan
      await refreshData();

      // Reset form
      setShowModal(false);
      setEditingPR(null);
      setFormData({
        nomorQl: '',
        namaEvent: '',
        tipe: '',
        idPerusahaan: '',
        metodePembayaran: 'Transfer Rekening',
        vendor: '',
        vendorId: null,
        virtualAccountNumber: '',
        virtualAccountName: '',
        nominal: '',
        namaKaryawan: isGuest ? '' : userName || '',
        keterangan: '',
        lampiran: []
      });
      setVendorSearchTerm('');
      setSelectedVendor(null);
      setSelectedFiles([]);
      setFileUploadProgress({});
      setFileName('');
      setFileSize(0);
    } catch (error) {
      console.error('Error adding payment request:', error);
      showToast('Gagal menambahkan Payment Request: ' + (error.message || 'Silakan coba lagi'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetail = (pr) => {
    navigate(`/payment-request/${pr.id}`);
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
      message: `Apakah Anda yakin ingin menghapus ${selectedItems.length} payment request? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await bulkDeleteRecords('payment_requests', selectedItems);

          // Hapus file R2 milik record yang dihapus (best-effort)
          const deletedItems = selectedItems
            .map((id) => paymentRequests.find((p) => p.id === id))
            .filter(Boolean);
          await deleteFilesOfRecords(deletedItems);

          // Log activity untuk setiap item yang dihapus
          for (const id of selectedItems) {
            const pr = paymentRequests.find(p => p.id === id);
            if (pr) {
              await logActivity({
                tableName: 'payment_requests',
                recordId: id,
                recordNumber: pr.nomorPr,
                action: 'bulk_delete',
                fieldChanged: null,
                oldValue: `Nominal: Rp ${pr.nominal.toLocaleString('id-ID')}`,
                newValue: null,
                changedBy: userId,
                changedByName: userName
              });
            }
          }

          showToast(`${selectedItems.length} payment request berhasil dihapus`, 'success');
          setSelectedItems([]);
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error bulk deleting payment requests:', error);
          showToast('Gagal menghapus payment request', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleEdit = (pr) => {
    setSelectedPR(pr);
    // Parse lampiran - bisa berupa string JSON array atau single URL
    let lampiranArray = [];
    if (pr.lampiran) {
      try {
        lampiranArray = typeof pr.lampiran === 'string' ? JSON.parse(pr.lampiran) : pr.lampiran;
        if (!Array.isArray(lampiranArray)) lampiranArray = [lampiranArray];
      } catch {
        lampiranArray = [pr.lampiran];
      }
    }
    setFormData({
      nomorQl: pr.nomorQl || '',
      namaEvent: pr.namaEvent || '',
      tipe: pr.tipe || '',
      idPerusahaan: pr.idPerusahaan || '',
      metodePembayaran: pr.metodePembayaran || 'Transfer Rekening',
      vendor: pr.vendor || '',
      vendorId: pr.vendorId || null,
      virtualAccountNumber: pr.virtualAccountNumber || '',
      virtualAccountName: pr.virtualAccountName || '',
      nominal: pr.nominal?.toString() || '',
      namaKaryawan: pr.namaKaryawan || '',
      keterangan: pr.keterangan || '',
      lampiran: lampiranArray,
    });
    setVendorSearchTerm(pr.vendor || '');
    if (pr.vendorId) {
      const vendor = getVendorById(pr.vendorId);
      setSelectedVendor(vendor);
    } else {
      setSelectedVendor(null);
    }
    setFileName(pr.lampiran ? pr.lampiran.split('/').pop() : '');
    setEditingPR(pr);
    setShowModal(true);
  };

  const handleDelete = (pr) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Hapus',
      message: `Apakah Anda yakin ingin menghapus Payment Request "${pr.nomorPr}"? Data yang sudah dihapus tidak dapat dikembalikan.`,
      onConfirm: async () => {
        try {
          await deleteRecord('payment_requests', pr.id);
          // Hapus file R2 milik record agar tidak jadi file yatim (best-effort)
          await deleteFilesOfRecords([pr]);
          showToast('Payment Request berhasil dihapus', 'success');
          await refreshData();
        } catch (error) {
          console.error('Error deleting payment request:', error);
          showToast('Gagal menghapus Payment Request', 'error');
        }
      }
    });
  };

  const handleApprove = (pr) => {
    if (pr.statusApproval !== 'Pending') {
      showToast('Hanya pengajuan Pending yang bisa disetujui Manager', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Konfirmasi Approval Manager',
      message: `Apakah Anda yakin ingin menyetujui Payment Request "${pr.nomorPr}"? Tindakan ini akan mengubah status menjadi Manager Approved.`,
      onConfirm: async () => {
        try {
          await updateRecord('payment_requests', pr.id, {
            status_approval: 'Manager Approved',
            disetujui_oleh: userName || 'Manager',
            manager_approved_by: userName || null,
            manager_approved_at: new Date().toISOString()
          });
          // Log activity
          await logActivity({
            tableName: 'payment_requests',
            recordId: pr.id,
            recordNumber: pr.nomorPr,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Manager Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Disetujui Manager. Menunggu Head Finance.', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving payment request:', error);
          showToast('Gagal menyetujui Payment Request', 'error');
        }
      }
    });
  };

  const handleApproveHead = (pr) => {
    if (pr.statusApproval !== 'Manager Approved') {
      showToast('Hanya pengajuan Manager Approved yang bisa disetujui Head Finance', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Konfirmasi Approval Head Finance',
      message: `Apakah Anda yakin ingin menyetujui Payment Request "${pr.nomorPr}"? Tindakan ini akan mengubah status menjadi Approved.`,
      onConfirm: async () => {
        try {
          await updateRecord('payment_requests', pr.id, {
            status_approval: 'Approved',
            disetujui_oleh: userName || 'Head Finance',
            head_finance_approved_by: userName || null,
            head_finance_approved_at: new Date().toISOString()
          });
          await logActivity({
            tableName: 'payment_requests',
            recordId: pr.id,
            recordNumber: pr.nomorPr,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Manager Approved',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Disetujui Head Finance. Siap transfer.', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving payment request:', error);
          showToast('Gagal menyetujui Payment Request', 'error');
        }
      }
    });
  };

  const handleReject = (pr) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Penolakan',
      message: `Apakah Anda yakin ingin menolak Payment Request "${pr.nomorPr}"? Tindakan ini akan mengubah status menjadi Rejected.`,
      onConfirm: async () => {
        try {
          await updateRecord('payment_requests', pr.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userName || 'Manager',
            rejected_by: userName || null,
            rejected_at: new Date().toISOString()
          });
          // Log activity
          await logActivity({
            tableName: 'payment_requests',
            recordId: pr.id,
            recordNumber: pr.nomorPr,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: pr.statusApproval,
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Payment Request berhasil ditolak', 'success');
          await refreshData();
          refreshNotifications();
        } catch (error) {
          console.error('Error rejecting payment request:', error);
          showToast('Gagal menolak Payment Request', 'error');
        }
      }
    });
  };

  // Handle update status transfer (khusus Finance)
  const handleUpdateTransferStatus = async (pr, newStatus) => {
    if (newStatus === 'Sudah Transfer') {
      // Tampilkan modal upload bukti transfer
      setTransferringPR(pr);
      setBuktiTransferFile(null);
      setBuktiTransferFileName('');
      setShowBuktiTransferModal(true);
    } else {
      // Untuk reject, langsung konfirmasi
      setConfirmDialog({
        isOpen: true,
        type: 'danger',
        title: 'Konfirmasi Tolak Transfer',
        message: `Apakah Anda yakin ingin menolak transfer untuk payment request ini?`,
        onConfirm: async () => {
          try {
            const oldStatus = pr.statusTransfer;
            await updateRecord('payment_requests', pr.id, {
              status_transfer: newStatus
            });
            // Log activity
            await logActivity({
              tableName: 'payment_requests',
              recordId: pr.id,
              recordNumber: pr.nomorPr,
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
        () => uploadFile(buktiTransferFile, 'payment-requests', transferringPR.nomorPr, userName),
        (uploadResult) => updateRecord('payment_requests', transferringPR.id, {
          bukti_transfer: uploadResult.url,
          status_transfer: 'Sudah Transfer'
        })
      );

      // Log activity
      await logActivity({
        tableName: 'payment_requests',
        recordId: transferringPR.id,
        recordNumber: transferringPR.nomorPr,
        action: 'transfer',
        fieldChanged: 'status_transfer',
        oldValue: 'Belum Transfer',
        newValue: 'Sudah Transfer',
        changedBy: userId,
        changedByName: userName
      });

      await sendTransferNotification({
        tableName: 'payment_requests',
        record: transferringPR,
        amount: transferringPR.nominal,
        proofUrl: result.url,
        transferredBy: userName,
        detailPath: `/payment-request/${transferringPR.id}`
      });

      showToast('Bukti transfer berhasil diupload dan status diperbarui', 'success');
      setShowBuktiTransferModal(false);
      setTransferringPR(null);
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

  const handleNewVendorInputChange = async (e) => {
    const { name, value } = e.target;
    setNewVendorData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validasi nomor rekening real-time
    if (name === 'nomorRekening' && value) {
      setVendorError('');
      // Cek apakah nomor rekening sudah ada
      const existingVendor = vendors.find(v =>
        v.nomorRekening === value && v.status === 'active'
      );
      if (existingVendor) {
        setVendorError(`Vendor dengan nomor rekening ${value} sudah ada: ${existingVendor.nama}`);
      }
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    setVendorError('');

    // Validasi nomor rekening
    const existingVendor = vendors.find(v =>
      v.nomorRekening === newVendorData.nomorRekening && v.status === 'active'
    );

    if (existingVendor) {
      setVendorError(`Vendor dengan nomor rekening ${newVendorData.nomorRekening} sudah ada: ${existingVendor.nama}`);
      return;
    }

    try {
      const newVendor = await addVendor(newVendorData);

      // Set vendor yang baru ditambahkan
      setSelectedVendor(newVendor);
      setVendorSearchTerm(newVendor.nama);
      setFormData(prev => ({
        ...prev,
        vendor: newVendor.nama,
        vendorId: newVendor.id
      }));

      // Reset form vendor
      setNewVendorData({
        nama: '',
        namaBank: '',
        nomorRekening: '',
        namaPemilikRekening: ''
      });
      setVendorError('');
      showToast('Vendor berhasil disimpan', 'success');
    } catch (error) {
      console.error('Error adding vendor:', error);
      if (error.message?.includes('nomor_rekening') || error.message?.includes('unique')) {
        setVendorError('Vendor dengan nomor rekening ini sudah ada');
        showToast('Vendor dengan nomor rekening ini sudah ada', 'error');
      } else {
        setVendorError('Gagal menambahkan vendor. Silakan coba lagi.');
        showToast('Gagal menambahkan vendor. Silakan coba lagi.', 'error');
      }
    }
  };

  const handleOpenAddVendor = () => {
    setShowModal(false);
    setShowAddVendorModal(true);
  };

  const handleBackToMainForm = () => {
    setShowAddVendorModal(false);
    setShowModal(true);
  };

  // Export PDF dengan design yang bagus
  const handleExportPDF = (pr) => {
    const doc = new jsPDF();
    const vendorInfo = pr.vendorId ? getVendorById(pr.vendorId) : null;

    // Set font
    doc.setFont('helvetica');

    // Header - Background biru
    doc.setFillColor(37, 99, 235); // Primary blue
    doc.rect(0, 0, 210, 40, 'F');

    // Logo & Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT REQUEST', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Finance Prasasti Group', 105, 28, { align: 'center' });
    doc.text('Detail Transaksi Keuangan', 105, 35, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    let yPos = 50;

    // Section 1: Informasi Payment Request
    doc.setFillColor(249, 250, 251);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('INFORMASI PAYMENT REQUEST', 15, yPos + 5.5);

    yPos += 15;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Data dalam 2 kolom
    const leftCol = 15;
    const rightCol = 110;

    // Kolom kiri
    doc.setFont('helvetica', 'bold');
    doc.text('Nomor PR:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    doc.text(pr.nomorPr, leftCol + 25, yPos);
    doc.setTextColor(0, 0, 0);

    // Kolom kanan
    doc.setFont('helvetica', 'bold');
    doc.text('Nomor QL:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.nomorQl, rightCol + 25, yPos);

    yPos += 8;

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.tanggal, leftCol + 25, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Tipe:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.tipe, rightCol + 25, yPos);

    yPos += 8;

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Karyawan:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.namaKaryawan, leftCol + 35, yPos);

    yPos += 8;

    // Row 4
    doc.setFont('helvetica', 'bold');
    doc.text('Vendor:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.vendor, leftCol + 25, yPos);

    yPos += 10;

    // Nominal - highlight dengan background
    doc.setFillColor(239, 246, 255);
    doc.rect(10, yPos - 5, 190, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NOMINAL:', leftCol, yPos);
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Rp ' + formatRupiah(pr.nominal), leftCol + 30, yPos + 1);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    yPos += 20;

    // Section 2: Keterangan
    doc.setFillColor(249, 250, 251);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('KETERANGAN', 15, yPos + 5.5);

    yPos += 15;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Split text keterangan jika panjang
    const keteranganLines = doc.splitTextToSize(pr.keterangan || '-', 180);
    doc.text(keteranganLines, leftCol, yPos);
    yPos += (keteranganLines.length * 5) + 10;

    // Section 3: Lampiran
    if (pr.lampiran) {
      doc.setFillColor(239, 246, 255);
      doc.rect(10, yPos, 190, 15, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('LAMPIRAN DOKUMEN:', leftCol, yPos + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(37, 99, 235);
      doc.text(pr.lampiran, leftCol, yPos + 11);
      doc.setTextColor(0, 0, 0);
      yPos += 20;
    }

    // Section 4: Informasi Bank Vendor atau Virtual Account
    if (pr.metodePembayaran === 'Virtual Account') {
      // Virtual Account Section
      doc.setFillColor(249, 250, 251);
      doc.rect(10, yPos, 190, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(147, 51, 234); // Purple
      doc.text('INFORMASI VIRTUAL ACCOUNT', 15, yPos + 5.5);

      yPos += 15;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      // Highlight box untuk info VA
      doc.setFillColor(243, 232, 255);
      doc.rect(10, yPos - 5, 190, 20, 'F');
      doc.setDrawColor(216, 180, 254);
      doc.rect(10, yPos - 5, 190, 20);

      doc.setFont('helvetica', 'bold');
      doc.text('Nomor VA:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(147, 51, 234);
      doc.text(pr.virtualAccountNumber || '-', leftCol + 25, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      yPos += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Nama VA:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(pr.virtualAccountName || '-', leftCol + 25, yPos);

      yPos += 15;
    } else if (vendorInfo) {
      // Vendor Section (Transfer Rekening)
      doc.setFillColor(249, 250, 251);
      doc.rect(10, yPos, 190, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Green
      doc.text('INFORMASI BANK VENDOR', 15, yPos + 5.5);

      yPos += 15;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      // Highlight box untuk info bank
      doc.setFillColor(236, 253, 245);
      doc.rect(10, yPos - 5, 190, 28, 'F');
      doc.setDrawColor(167, 243, 208);
      doc.rect(10, yPos - 5, 190, 28);

      doc.setFont('helvetica', 'bold');
      doc.text('ID Vendor:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(vendorInfo.id), leftCol + 25, yPos);

      doc.setFont('helvetica', 'bold');
      doc.text('Nama Bank:', rightCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(vendorInfo.namaBank, rightCol + 25, yPos);

      yPos += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Nomor Rekening:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(vendorInfo.nomorRekening, leftCol + 40, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      yPos += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Nama Pemilik:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(vendorInfo.namaPemilikRekening, leftCol + 30, yPos);

      yPos += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      yPos += 15;
    }

    // Section 5: Status & Approval
    doc.setFillColor(249, 250, 251);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(245, 158, 11); // Amber
    doc.text('STATUS & APPROVAL', 15, yPos + 5.5);

    yPos += 15;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    doc.setFont('helvetica', 'bold');
    doc.text('Status Approval:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');

    // Color based on status
    if (pr.statusApproval === 'Approved') {
      doc.setTextColor(16, 185, 129); // Green
    } else if (pr.statusApproval === 'Rejected') {
      doc.setTextColor(239, 68, 68); // Red
    } else {
      doc.setTextColor(245, 158, 11); // Amber
    }
    doc.text(pr.statusApproval, leftCol + 35, yPos);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Disetujui Oleh:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pr.disetujuiOleh, rightCol + 30, yPos);

    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Status Transfer:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');

    // Color based on transfer status
    if (pr.statusTransfer === 'Sudah Transfer') {
      doc.setTextColor(59, 130, 246); // Blue
    } else if (pr.statusTransfer === 'Tidak Transfer') {
      doc.setTextColor(239, 68, 68); // Red
    } else {
      doc.setTextColor(107, 114, 128); // Gray
    }
    doc.text(pr.statusTransfer, leftCol + 35, yPos);
    doc.setTextColor(0, 0, 0);

    // Footer
    yPos = 280;
    doc.setDrawColor(229, 231, 235);
    doc.line(10, yPos, 200, yPos);

    yPos += 5;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    doc.text('Dokumen ini digenerate secara otomatis oleh sistem Finance Prasasti Group', 105, yPos, { align: 'center' });
    doc.text('© 2025 Prasasti Group - Printed on ' + new Date().toLocaleDateString('id-ID'), 105, yPos + 4, { align: 'center' });

    // Save PDF
    doc.save(`Payment_Request_${pr.nomorPr}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Payment Request</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Kelola permintaan pembayaran vendor dan supplier</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm text-sm sm:text-base w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Buat Payment Request</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-4 sm:p-5">
            <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${stat.color} mb-2 sm:mb-3`}>
              <span className="text-lg sm:text-2xl font-bold">{stat.value}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nomor PR, Nomor QL, Nama Event, Vendor, atau Nama Karyawan..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Semua ({prStats.total})
              </button>
              <button
                onClick={() => handleFilterChange('belum-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'belum-transfer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Belum ({prStats.belum})
              </button>
              <button
                onClick={() => handleFilterChange('sudah-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'sudah-transfer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Sudah ({prStats.sudah})
              </button>
            </div>

            {/* Clear Filter & Search */}
            {(filterStatus !== 'all' || searchTerm || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setSearchTerm('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="ml-auto px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                Menampilkan <span className="font-semibold text-gray-800">{totalCount === 0 ? 0 : indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, totalCount)}</span> dari <span className="font-semibold text-gray-800">{totalCount}</span> payment request
                {isLoadingPR && (
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
                Hasil pencarian untuk: <span className="font-semibold text-primary-600">"{searchTerm}"</span>
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
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          title="Pilih Semua"
                        />
                      </th>
                    )}
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor PR</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor QL</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Event</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipe</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">ID Perusahaan</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Karyawan</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nominal</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Lampiran</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Keterangan</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Approval</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Oleh</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Head Finance</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Bukti Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((request) => {
                      // Check if data is confidential and user cannot view
                      const isHidden = request.isConfidential && !canViewConfidential;

                      return (
                        <tr key={request.nomorPr} className={`hover:bg-gray-50 transition-colors ${isHidden ? 'bg-gray-50' : ''} ${selectedItems.includes(request.id) ? 'bg-blue-50' : ''}`}>
                          {/* Checkbox column - Administrator Only */}
                          {canEditDelete && (
                            <td className="py-4 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(request.id)}
                                onChange={() => handleSelectItem(request.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <Link
                                to={`/payment-request/${request.id}`}
                                className="text-sm font-bold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                              >
                                {request.nomorPr}
                              </Link>
                              {request.isConfidential && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-800 text-white rounded inline-flex items-center" title="Confidential">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <QLLink ql={request.nomorQl} hidden={isHidden} className="text-sm text-gray-700" linkClassName="text-blue-600 font-medium" />
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{isHidden ? 'CONFIDENTIAL' : (request.namaEvent || '-')}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="leading-tight">
                              <div className="text-sm text-gray-600">{(request.tanggalJam || request.tanggal || '').split(' ')[0]}</div>
                              <div className="text-[11px] text-gray-400">{(request.tanggalJam || '').split(' ')[1] || ''}</div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {isHidden ? <span className="text-sm text-gray-400">CONFIDENTIAL</span> : <TipeBadge tipe={request.tipe} size="sm" />}
                          </td>
                          <td className="py-4 px-6">
                            {isHidden ? <span className="text-sm text-gray-400">CONFIDENTIAL</span> : <IdPerusahaanBadge idPerusahaan={request.idPerusahaan} size="sm" showFullName={true} />}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700 font-medium">{isHidden ? 'CONFIDENTIAL' : request.namaKaryawan}</span>
                          </td>
                          <td className="py-4 px-6">
                            {isHidden ? (
                              <span className="text-sm text-gray-400">CONFIDENTIAL</span>
                            ) : request.metodePembayaran === 'Virtual Account' ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 mb-1">VA</span>
                                <p className="text-sm text-gray-700">{request.virtualAccountName}</p>
                                <p className="text-xs text-gray-500">{request.virtualAccountNumber}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-700">{request.vendor}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className="text-sm font-semibold text-gray-900">{isHidden ? 'CONFIDENTIAL' : formatRupiah(request.nominal)}</span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isHidden ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : request.lampiran ? (
                              (() => {
                                const urls = parseLampiran(request.lampiran);
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
                            <span className="text-xs text-gray-600 line-clamp-2" title={isHidden ? '' : request.keterangan}>
                              {isHidden ? '-' : (request.keterangan || '-')}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {getStatusApprovalBadge(request.statusApproval)}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{request.disetujuiOleh}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{request.disetujuiHeadFinance || '-'}</span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {getStatusTransferBadge(request.statusTransfer)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isHidden ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : request.buktiTransfer ? (
                              <a
                                href={request.buktiTransfer}
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
                                onClick={() => handleDetail(request)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Detail</span>
                              </button>
                              {canEditDelete && !isLocked(request) && (
                                <>
                                  {isSubmitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleEdit(request)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        <span>Edit</span>
                                      </button>
                                      {canApproveManager && request.statusApproval === 'Pending' && (
                                        <button
                                          onClick={() => handleApprove(request)}
                                          className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                                          title="Approve Manager"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                          <span>Approve</span>
                                        </button>
                                      )}
                                      {canApproveHead && request.statusApproval === 'Manager Approved' && (
                                        <button
                                          onClick={() => handleApproveHead(request)}
                                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                          title="Approve Head Finance"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                          <span>Approve HF</span>
                                        </button>
                                      )}
                                      {(canApproveManager || canApproveHead || isAuthorizedApprover) && (request.statusApproval === 'Pending' || request.statusApproval === 'Manager Approved') && (
                                        <button
                                          onClick={() => handleReject(request)}
                                          className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                          title="Reject"
                                        >
                                          <XCircle className="w-4 h-4" />
                                          <span>Reject</span>
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDelete(request)}
                                          className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          <span>Delete</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </>
                              )}

                              {/* Aksi khusus Finance untuk update status transfer */}
                              {isFinance && request.statusApproval === 'Approved' && request.statusTransfer === 'Belum Transfer' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateTransferStatus(request, 'Sudah Transfer')}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                    title="Tandai Sudah Transfer"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Transfer</span>
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransferStatus(request, 'Reject')}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                    title="Tolak Transfer"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={canEditDelete ? "16" : "15"} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-gray-600 font-medium">Tidak ada data ditemukan</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {searchTerm
                                ? `Tidak ada hasil untuk "${searchTerm}"`
                                : 'Tidak ada payment request dengan filter yang dipilih'}
                            </p>
                          </div>
                          {(filterStatus !== 'all' || searchTerm) && (
                            <button
                              onClick={() => {
                                setFilterStatus('all');
                                setSearchTerm('');
                              }}
                              className="mt-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                            >
                              Reset Filter & Search
                            </button>
                          )}
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
        {
          totalCount > 0 && totalPages > 1 && (
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
                              ? 'bg-primary-600 text-white shadow-sm'
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
              </div>
            </div>
          )
        }
      </div>

      {/* Modal Form Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingPR ? 'Edit Payment Request' : 'Buat Payment Request Baru'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {editingPR ? 'Perbarui data payment request' : 'Isi form untuk membuat payment request baru'}
                  </p>
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
              {/* Basic Info Section */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-primary-600 rounded-full mr-3"></div>
                  Informasi Dasar
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Nomor PR (Auto-generated at submit) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor PR</label>
                    <input
                      type="text"
                      value={editingPR ? editingPR.nomorPr : 'Akan digenerate otomatis saat submit'}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 italic"
                    />
                    <p className="text-xs text-gray-500 mt-1">{editingPR ? 'Nomor tidak dapat diubah' : 'Nomor unik akan digenerate saat submit untuk menghindari konflik'}</p>
                  </div>

                  {/* Nomor QL */}
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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

              {/* Company & Vendor Section */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-primary-600 rounded-full mr-3"></div>
                  Detail Perusahaan & Vendor
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Pilih ID Perusahaan</option>
                      {getIdPerusahaanOptionsByRole(userRole).map((company) => (
                        <option key={company.value} value={company.value}>
                          {company.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Metode Pembayaran */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Pembayaran <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${formData.metodePembayaran === 'Transfer Rekening' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="metodePembayaran"
                          value="Transfer Rekening"
                          checked={formData.metodePembayaran === 'Transfer Rekening'}
                          onChange={handleInputChange}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="font-medium text-gray-700">Transfer Rekening</span>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${formData.metodePembayaran === 'Virtual Account' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="metodePembayaran"
                          value="Virtual Account"
                          checked={formData.metodePembayaran === 'Virtual Account'}
                          onChange={handleInputChange}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="font-medium text-gray-700">Virtual Account</span>
                      </label>
                    </div>
                  </div>

                  {/* Conditional: Vendor Search (Transfer Rekening) */}
                  {formData.metodePembayaran === 'Transfer Rekening' && (
                    <>
                  {/* Vendor Search */}
                  <div className="col-span-2 relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={vendorSearchTerm}
                          onChange={(e) => handleVendorSearch(e.target.value)}
                          placeholder="Cari nama vendor atau nomor rekening..."
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        {showVendorDropdown && filteredVendors.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredVendors.map((vendor) => (
                              <div
                                key={vendor.id}
                                onClick={() => handleSelectVendor(vendor)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                              >
                                <div className="font-medium text-gray-800">{vendor.nama}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  <span className="font-medium text-gray-600">{vendor.nomorRekening}</span>
                                  <span className="mx-1">�</span>
                                  <span>{vendor.namaBank}</span>
                                  <span className="mx-1">�</span>
                                  <span>{vendor.namaPemilikRekening}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddVendor}
                        className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Vendor Baru
                      </button>
                    </div>
                  </div>

                  {/* Selected Vendor Info */}
                  {selectedVendor && (
                    <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start space-x-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900">{selectedVendor.nama}</h4>
                        <div className="mt-1 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-blue-800">
                          <p><span className="opacity-70">Bank:</span> {selectedVendor.namaBank}</p>
                          <p><span className="opacity-70">Rekening:</span> {selectedVendor.nomorRekening}</p>
                          <p><span className="opacity-70">Pemilik:</span> {selectedVendor.namaPemilikRekening}</p>
                          <p><span className="opacity-70">Kategori:</span> {selectedVendor.kategori}</p>
                        </div>
                      </div>
                    </div>
                  )}
                    </>
                  )}

                  {/* Conditional: Virtual Account Fields */}
                  {formData.metodePembayaran === 'Virtual Account' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Virtual Account <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="virtualAccountNumber"
                          value={formData.virtualAccountNumber}
                          onChange={handleInputChange}
                          placeholder="Masukkan nomor virtual account..."
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Virtual Account <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="virtualAccountName"
                          value={formData.virtualAccountName}
                          onChange={handleInputChange}
                          placeholder="Masukkan nama virtual account..."
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-primary-600 rounded-full mr-3"></div>
                  Detail Pembayaran
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {/* Nominal */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nominal <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                      <input
                        type="text"
                        name="nominal"
                        value={formatRupiah(formData.nominal || 0)}
                        onChange={handleNominalChange}
                        placeholder="0"
                        required
                        className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-semibold text-lg"
                      />
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      placeholder="Masukkan keterangan pembayaran..."
                      rows="3"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Lampiran - Multi-file Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lampiran {userRole?.toLowerCase() !== 'bod' && <span className="text-red-500">*</span>}
                      {userRole?.toLowerCase() === 'bod' && <span className="text-gray-400 text-xs ml-1">(Opsional)</span>}
                      <span className="text-gray-400 text-xs ml-2">(Dapat upload lebih dari 1 file)</span>
                    </label>
                    {/* Existing Files (saat edit) */}
                    {editingPR && formData.lampiran && formData.lampiran.length > 0 && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-2">File yang sudah diupload:</p>
                        <div className="space-y-2">
                          {formData.lampiran.map((url, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-blue-200">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
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
                      accept=".pdf,.jpg,.jpeg,.png"
                      maxSize={10}
                      maxFiles={10}
                      uploading={uploadingFile}
                      uploadProgress={fileUploadProgress}
                      accentColor="primary"
                      required={userRole?.toLowerCase() !== 'bod'}
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
                  className={`px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center ${(uploadingFile || isSubmitting) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Memproses...' : uploadingFile ? 'Mengupload...' : 'Simpan Payment Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Vendor */}
      {showAddVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-800">Tambah Vendor Baru</h3>
              <button
                onClick={handleBackToMainForm}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddVendor} className="p-6 flex flex-col gap-4">
              {/* Nama Vendor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Vendor <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nama"
                  value={newVendorData.nama}
                  onChange={handleNewVendorInputChange}
                  placeholder="Contoh: PT. Maju Jaya"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Nama Bank */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Bank <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="namaBank"
                  value={newVendorData.namaBank}
                  onChange={handleNewVendorInputChange}
                  placeholder="Contoh: BCA"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Nomor Rekening */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Rekening <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nomorRekening"
                  value={newVendorData.nomorRekening}
                  onChange={handleNewVendorInputChange}
                  placeholder="Contoh: 1234567890"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {vendorError && (
                  <p className="text-xs text-red-500 mt-1">{vendorError}</p>
                )}
              </div>

              {/* Nama Pemilik Rekening */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pemilik Rekening <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="namaPemilikRekening"
                  value={newVendorData.namaPemilikRekening}
                  onChange={handleNewVendorInputChange}
                  placeholder="Contoh: Budi Santoso"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleBackToMainForm}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Simpan Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload Bukti Transfer */}
      {showBuktiTransferModal && transferringPR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                  <p className="text-sm text-white/80">{transferringPR.nomorPr}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBuktiTransferModal(false);
                  setTransferringPR(null);
                  setBuktiTransferFile(null);
                  setBuktiTransferFileName('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {/* Info PR */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">
                      {transferringPR.metodePembayaran === 'Virtual Account' ? 'Virtual Account:' : 'Vendor:'}
                    </span>
                    {transferringPR.metodePembayaran === 'Virtual Account' ? (
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 mb-1">VA</span>
                        <p className="font-medium text-gray-800">{transferringPR.virtualAccountName}</p>
                        <p className="text-xs text-gray-500">{transferringPR.virtualAccountNumber}</p>
                      </div>
                    ) : (
                      <p className="font-medium text-gray-800">{transferringPR.vendor}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Nominal:</span>
                    <p className="font-semibold text-primary-600">Rp {formatRupiah(transferringPR.nominal)}</p>
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
                    setTransferringPR(null);
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
                  className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || uploadingBuktiTransfer) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

export default PaymentRequest;
