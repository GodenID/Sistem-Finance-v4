import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, X, ChevronLeft, ChevronRight, Banknote, Wallet, FileText, Paperclip, Download, CheckCircle, XCircle, Upload, Edit2, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS } from '../constants/companyTypes';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';

import { createRecord, getAllRecords, updateRecord, deleteRecord, bulkDeleteRecords, uploadFile } from '../lib/api';
import { logActivity } from '../lib/auditLog';
import ConfirmDialog from '../components/ConfirmDialog';
import PasteUpload from '../components/PasteUpload';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { generateKlaimNumber } from '../utils/generateUniqueNumber';


const Klaim = () => {
  const navigate = useNavigate();
  const { userName, userRole, userId } = useAuth();
  const { showToast } = useToast();
  const { refreshNotifications } = useNotification();
  const isGuest = userRole === 'guest';
  const isFinance = userRole === 'team_finance';
  const canManage = ['administrator', 'manager', 'bod'].includes(userRole);
  const isAdmin = userRole?.toLowerCase() === 'administrator';
  // BOD, Team Finance & Admin can edit and delete
  const canEditDelete = ['administrator', 'bod', 'team_finance'].includes(userRole?.toLowerCase());
  const canViewConfidential = ['administrator', 'bod', 'team_finance'].includes(userRole?.toLowerCase());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
    lampiran: null,
    keterangan: '',
  });

  // State untuk detail pengeluaran
  const [expenseItems, setExpenseItems] = useState([{ nama: '', nominal: '' }]);

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



  // Data Klaim dari Supabase
  const [klaimRequests, setKlaimRequests] = useState([]);
  const [isLoadingKlaim, setIsLoadingKlaim] = useState(true);

  // Fetch klaim dari Supabase
  const fetchKlaim = async () => {
    try {
      setIsLoadingKlaim(true);
      const data = await getAllRecords('klaim');
      // Transform data dari Supabase ke format yang digunakan di UI
      const transformedData = data.map(item => ({
        id: item.id,
        nomorKlaim: item.nomor_klaim,
        nomorQl: item.nomor_ql || '',
        tanggal: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
        tipe: item.tipe || '',
        idPerusahaan: item.id_perusahaan || '',
        nominal: parseFloat(item.nominal) || 0,
        statusApproval: item.status_approval || 'Pending',
        disetujuiOleh: item.nama_approver || '-',
        statusTransfer: item.status_transfer || 'Belum Transfer',
        keterangan: item.keterangan || '',
        lampiran: item.lampiran || null,
        buktiTransfer: item.bukti_transfer || null,
        namaKaryawan: item.nama_karyawan || '',
        metodePembayaran: item.metode_pembayaran || '',
        namaBank: item.nama_bank || '',
        nomorRekening: item.nomor_rekening || '',
        namaPemilikRekening: item.nama_pemilik_rekening || '',
        isConfidential: item.is_confidential || false
      }));
      setKlaimRequests(transformedData);
    } catch (error) {
      console.error('Error fetching klaim:', error);
      showToast('Gagal memuat data klaim', 'error');
    } finally {
      setIsLoadingKlaim(false);
    }
  };

  useEffect(() => {
    fetchKlaim();
  }, []);

  // Realtime subscription for automatic updates
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      setKlaimRequests(prev => {
        const transformed = {
          id: newRecord.id,
          nomorKlaim: newRecord.nomor_klaim,
          nomorQl: newRecord.nomor_ql || '',
          tanggal: newRecord.created_at ? new Date(newRecord.created_at).toISOString().split('T')[0] : '',
          tipe: newRecord.tipe || '',
          idPerusahaan: newRecord.id_perusahaan || '',
          nominal: parseFloat(newRecord.nominal) || 0,
          statusApproval: newRecord.status_approval || 'Pending',
          disetujuiOleh: newRecord.nama_approver || '-',
          statusTransfer: newRecord.status_transfer || 'Belum Transfer',
          keterangan: newRecord.keterangan || '',
          lampiran: newRecord.lampiran || null,
          buktiTransfer: newRecord.bukti_transfer || null,
          namaKaryawan: newRecord.nama_karyawan || '',
          metodePembayaran: newRecord.metode_pembayaran || '',
          namaBank: newRecord.nama_bank || '',
          nomorRekening: newRecord.nomor_rekening || '',
          namaPemilikRekening: newRecord.nama_pemilik_rekening || '',
          isConfidential: newRecord.is_confidential || false
        };
        return [transformed, ...prev];
      });
      showToast('Data klaim baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      setKlaimRequests(prev => prev.map(item => {
        if (item.id === newRecord.id) {
          return {
            ...item,
            nomorKlaim: newRecord.nomor_klaim,
            nomorQl: newRecord.nomor_ql || '',
            tipe: newRecord.tipe || '',
            idPerusahaan: newRecord.id_perusahaan || '',
            nominal: parseFloat(newRecord.nominal) || 0,
            statusApproval: newRecord.status_approval || 'Pending',
            disetujuiOleh: newRecord.nama_approver || '-',
            statusTransfer: newRecord.status_transfer || 'Belum Transfer',
            keterangan: newRecord.keterangan || '',
            lampiran: newRecord.lampiran || null,
            buktiTransfer: newRecord.bukti_transfer || null,
            namaKaryawan: newRecord.nama_karyawan || '',
            metodePembayaran: newRecord.metode_pembayaran || '',
            namaBank: newRecord.nama_bank || '',
            nomorRekening: newRecord.nomor_rekening || '',
            namaPemilikRekening: newRecord.nama_pemilik_rekening || '',
            isConfidential: newRecord.is_confidential || false
          };
        }
        return item;
      }));
      showToast('Data klaim diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      setKlaimRequests(prev => prev.filter(item => item.id !== oldRecord.id));
      showToast('Data klaim dihapus', 'info');
    }
    refreshNotifications();
  }, [refreshNotifications, showToast]);

  useRealtimeSubscription('klaim', { onAnyChange: handleRealtimeChange });

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
        // Generate unique nomor klaim for file path if not already generated
        const nomorKlaim = generatedNomorKlaim || generateKlaimNumber();
        if (!generatedNomorKlaim) {
          setGeneratedNomorKlaim(nomorKlaim);
        }

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadFile(file, 'klaim', nomorKlaim, userName);

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

    // Cegah double submit
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validasi form
      if (!formData.nominal || !formData.tipe || !formData.namaEvent) {
        showToast('Mohon lengkapi semua field yang wajib diisi (termasuk Nama Event/Project)', 'error');
        return;
      }

      // Generate unique nomor klaim at submit time to prevent conflicts
      const nomorKlaim = generatedNomorKlaim || generateKlaimNumber();

      // BOD transactions are confidential and auto-approved
      const isBOD = userRole?.toLowerCase() === 'bod';

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
        lampiran: formData.lampiran || null,
        keterangan: formData.keterangan || null,
        detail_pengeluaran: JSON.stringify(expenseItems.filter(item => item.nama && item.nominal)),
        status_approval: isBOD ? 'Approved' : 'Pending',
        status_transfer: 'Belum Transfer',
        disetujui_oleh: isBOD ? userId : null,
        nama_approver: isBOD ? userName : null,
        nama_karyawan: formData.namaKaryawan || userName || null,
        is_confidential: isBOD ? true : false,
      };

      const createdKlaim = await createRecord('klaim', newKlaimData);

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

      await fetchKlaim(); // Refresh data
      setShowModal(false);
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
        lampiran: null,
        keterangan: '',
      });
      setExpenseItems([{ nama: '', nominal: '' }]); // Reset expense items
      setFileName('');
      setGeneratedNomorKlaim(''); // Reset pre-generated nomor klaim
      showToast('Klaim berhasil ditambahkan', 'success');
    } catch (error) {
      console.error('Error adding klaim:', error);
      showToast('Gagal menambahkan Klaim', 'error');
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
    setFormData({
      nomorQl: klaim.nomorQl || '',
      tipe: klaim.tipe || '',
      idPerusahaan: klaim.idPerusahaan || '',
      namaKaryawan: klaim.namaKaryawan || '',
      nominal: klaim.nominal?.toString() || '',
      metodePembayaran: klaim.metodePembayaran || '',
      namaBank: klaim.namaBank || '',
      nomorRekening: klaim.nomorRekening || '',
      namaPemilikRekening: klaim.namaPemilikRekening || '',
      lampiran: klaim.lampiran || null,
      keterangan: klaim.keterangan || '',
    });
    setFileName(klaim.lampiran ? klaim.lampiran.split('/').pop() : '');
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
          await fetchKlaim();
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
          await fetchKlaim();
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

  // Handle Approve Klaim
  const handleApprove = (klaim) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Konfirmasi Approval',
      message: `Apakah Anda yakin ingin menyetujui Klaim "${klaim.nomorKlaim}"? Tindakan ini akan mengubah status menjadi Approved.`,
      onConfirm: async () => {
        try {
          await updateRecord('klaim', klaim.id, {
            status_approval: 'Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Klaim berhasil disetujui', 'success');
          await fetchKlaim();
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
          await updateRecord('klaim', klaim.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'klaim',
            recordId: klaim.id,
            recordNumber: klaim.nomorKlaim,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Klaim berhasil ditolak', 'success');
          await fetchKlaim();
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
              showToast('Status transfer berhasil diperbarui', 'success');
              await fetchKlaim();
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
            await fetchKlaim();
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
      // Upload file ke R2
      const result = await uploadFile(buktiTransferFile, 'klaim', transferringKlaim.nomorKlaim, userName);

      // Update record dengan bukti transfer dan status
      await updateRecord('klaim', transferringKlaim.id, {
        bukti_transfer: result.url,
        status_transfer: 'Sudah Transfer'
      });

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

      showToast('Bukti transfer berhasil diupload dan status diperbarui', 'success');
      setShowBuktiTransferModal(false);
      setTransferringKlaim(null);
      setBuktiTransferFile(null);
      setBuktiTransferFileName('');
      await fetchKlaim();
      refreshNotifications();
    } catch (error) {
      console.error('Error uploading bukti transfer:', error);
      showToast('Gagal mengupload bukti transfer: ' + (error.message || 'Silakan coba lagi'), 'error');
    } finally {
      setUploadingBuktiTransfer(false);
    }
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
                Semua ({klaimRequests.length})
              </button>
              <button
                onClick={() => handleFilterChange('belum-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'belum-transfer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Belum ({klaimRequests.filter(kl => kl.statusTransfer === 'Belum Transfer').length})
              </button>
              <button
                onClick={() => handleFilterChange('sudah-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'sudah-transfer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Sudah ({klaimRequests.filter(kl => kl.statusTransfer === 'Sudah Transfer').length})
              </button>
            </div>

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
            <div className="flex items-center gap-4">
              <p className="text-gray-600">
                Menampilkan <span className="font-semibold text-gray-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, filteredKlaimRequests.length)}</span> dari <span className="font-semibold text-gray-800">{filteredKlaimRequests.length}</span> klaim
                {filteredKlaimRequests.length !== klaimRequests.length && (
                  <span className="text-gray-500"> (Total: {klaimRequests.length})</span>
                )}
              </p>
              {/* Bulk Delete Button - Administrator Only */}
              {canEditDelete && selectedItems.length > 0 && (
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
                              <span className="text-sm font-bold text-violet-600">{klaim.nomorKlaim}</span>
                              {klaim.isConfidential && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-800 text-white rounded">
                                  🔒
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-700">{isHidden ? '••••••' : klaim.nomorQl}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-600">{klaim.tanggal}</span>
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

                              {/* Aksi Approve/Reject untuk Manager/Admin/BOD */}
                              {canManage && klaim.statusApproval === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                    title="Approve"
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
                              {canEditDelete && (
                                <>
                                  <button
                                    onClick={() => handleEdit(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(klaim)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Hapus</span>
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
                      <td colSpan={canEditDelete ? "17" : "16"} className="py-12 text-center">
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
                      type="number"
                      name="nomorQl"
                      value={formData.nomorQl}
                      onChange={handleInputChange}
                      placeholder="Contoh: 12345"
                      min="0"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
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
                      {TIPE_OPTIONS.map((tipe) => (
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
                      {ID_PERUSAHAAN_OPTIONS.map((company) => (
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

                  {/* Lampiran - WAJIB */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lampiran <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-violet-500 transition-colors bg-white">
                      <input
                        type="file"
                        id="lampiran-klaim"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        disabled={uploadingFile}
                      />
                      <label htmlFor="lampiran-klaim" className="cursor-pointer flex flex-col items-center">
                        {uploadingFile ? (
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mb-2"></div>
                            <p className="text-sm text-gray-600">Mengupload... {uploadProgress}%</p>
                          </div>
                        ) : fileName || formData.lampiran ? (
                          <div className="flex flex-col items-center">
                            <FileText className="w-8 h-8 text-violet-600 mb-2" />
                            <p className="text-sm font-medium text-gray-800">{fileName || 'File terlampir'}</p>
                            {fileSize > 0 && <p className="text-xs text-gray-500 mt-1">{formatFileSize(fileSize)}</p>}
                            <p className="text-xs text-violet-600 mt-2 hover:underline">Klik untuk ganti file</p>
                          </div>
                        ) : (
                          <>
                            <Paperclip className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm font-medium text-gray-700">Klik untuk upload lampiran</p>
                            <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel, JPG, PNG (Max. 10MB)</p>
                          </>
                        )}
                      </label>
                    </div>
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
