import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, FileText, Paperclip, Trash2, PlusCircle, Banknote, Wallet, Download, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';

import { createRecord, getAllRecords, updateRecord, deleteRecord, uploadFile } from '../lib/api';
import { logActivity } from '../lib/auditLog';
import ConfirmDialog from '../components/ConfirmDialog';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { generatePenyelesaianNumber } from '../utils/generateUniqueNumber';

const Penyelesaian = () => {
  const navigate = useNavigate();
  const { userName, userRole, userId } = useAuth();
  const { showToast } = useToast();
  const { refreshNotifications } = useNotification();
  const isGuest = userRole === 'guest';
  const isFinance = userRole === 'team_finance';
  const canManage = ['administrator', 'manager', 'bod'].includes(userRole);
  const canDelete = ['administrator', 'manager'].includes(userRole);
  const [searchTerm, setSearchTerm] = useState('');

  // State untuk confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => { }
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
    keterangan: '',
  });

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [newExpenseItem, setNewExpenseItem] = useState({ deskripsi: '', nominal: '' });
  const [kasbonValidation, setKasbonValidation] = useState({ isValid: null, message: '', isChecking: false });

  // State untuk mencegah double submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Kasbon untuk di-lookup
  const [kasbonList, setKasbonList] = useState([]);
  const [isLoadingKasbon, setIsLoadingKasbon] = useState(true);

  // Data Penyelesaian dari Supabase
  const [penyelesaianRequests, setPenyelesaianRequests] = useState([]);
  const [isLoadingPenyelesaian, setIsLoadingPenyelesaian] = useState(true);

  // Fetch kasbon dari Supabase
  const fetchKasbon = async () => {
    try {
      setIsLoadingKasbon(true);
      const data = await getAllRecords('kasbon');
      const transformedData = data.map(item => ({
        id: item.id,
        nomorKasbon: item.nomor_kasbon,
        nomorQl: item.nomor_ql || '',
        namaEvent: item.nama_event || '', // Include nama_event from kasbon
        nominal: parseFloat(item.nominal) || 0,
        namaKaryawan: item.nama_karyawan || ''
      }));
      setKasbonList(transformedData);
    } catch (error) {
      console.error('Error fetching kasbon:', error);
    } finally {
      setIsLoadingKasbon(false);
    }
  };

  // Fetch penyelesaian dari Supabase
  const fetchPenyelesaian = async () => {
    try {
      setIsLoadingPenyelesaian(true);
      const data = await getAllRecords('penyelesaian');
      const transformedData = data.map(item => ({
        id: item.id,
        nomorPenyelesaian: item.nomor_penyelesaian,
        nomorKasbon: item.nomor_kasbon || '',
        nomorQl: item.nomor_ql || '',
        tanggal: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
        namaKaryawan: item.nama_karyawan || '',
        kasbonNominal: parseFloat(item.kasbon_nominal) || 0,
        totalPengeluaran: parseFloat(item.total_pengeluaran) || 0,
        selisih: parseFloat(item.selisih) || 0,
        statusSelisih: item.status_selisih || 'Pas',
        metodePengembalian: item.metode_pengembalian || '',
        lampiran: item.lampiran || null,
        statusApproval: item.status_approval || 'Pending',
        disetujuiOleh: item.nama_approver || '-',
        statusPenyelesaian: item.status_penyelesaian || 'Belum Selesai',
        detailPengeluaran: item.detail_pengeluaran || [],
        keterangan: item.keterangan || ''
      }));
      setPenyelesaianRequests(transformedData);
    } catch (error) {
      console.error('Error fetching penyelesaian:', error);
      showToast('Gagal memuat data penyelesaian', 'error');
    } finally {
      setIsLoadingPenyelesaian(false);
    }
  };

  React.useEffect(() => {
    fetchKasbon();
    fetchPenyelesaian();
  }, []);

  // Realtime subscription for automatic updates
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      setPenyelesaianRequests(prev => {
        const transformed = {
          id: newRecord.id,
          nomorPenyelesaian: newRecord.nomor_penyelesaian,
          nomorKasbon: newRecord.nomor_kasbon || '',
          nomorQl: newRecord.nomor_ql || '',
          tanggal: newRecord.created_at ? new Date(newRecord.created_at).toISOString().split('T')[0] : '',
          namaKaryawan: newRecord.nama_karyawan || '',
          kasbonNominal: parseFloat(newRecord.kasbon_nominal) || 0,
          totalPengeluaran: parseFloat(newRecord.total_pengeluaran) || 0,
          selisih: parseFloat(newRecord.selisih) || 0,
          statusSelisih: newRecord.status_selisih || 'Pas',
          metodePengembalian: newRecord.metode_pengembalian || '',
          lampiran: newRecord.lampiran || null,
          statusApproval: newRecord.status_approval || 'Pending',
          disetujuiOleh: newRecord.nama_approver || '-',
          statusPenyelesaian: newRecord.status_penyelesaian || 'Belum Selesai',
          detailPengeluaran: newRecord.detail_pengeluaran || [],
          keterangan: newRecord.keterangan || ''
        };
        return [transformed, ...prev];
      });
      showToast('Data penyelesaian baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      setPenyelesaianRequests(prev => prev.map(item => {
        if (item.id === newRecord.id) {
          return {
            ...item,
            nomorPenyelesaian: newRecord.nomor_penyelesaian,
            nomorKasbon: newRecord.nomor_kasbon || '',
            nomorQl: newRecord.nomor_ql || '',
            namaKaryawan: newRecord.nama_karyawan || '',
            kasbonNominal: parseFloat(newRecord.kasbon_nominal) || 0,
            totalPengeluaran: parseFloat(newRecord.total_pengeluaran) || 0,
            selisih: parseFloat(newRecord.selisih) || 0,
            statusSelisih: newRecord.status_selisih || 'Pas',
            metodePengembalian: newRecord.metode_pengembalian || '',
            lampiran: newRecord.lampiran || null,
            statusApproval: newRecord.status_approval || 'Pending',
            disetujuiOleh: newRecord.nama_approver || '-',
            statusPenyelesaian: newRecord.status_penyelesaian || 'Belum Selesai',
            detailPengeluaran: newRecord.detail_pengeluaran || [],
            keterangan: newRecord.keterangan || ''
          };
        }
        return item;
      }));
      showToast('Data penyelesaian diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      setPenyelesaianRequests(prev => prev.filter(item => item.id !== oldRecord.id));
      showToast('Data penyelesaian dihapus', 'info');
    }
    refreshNotifications();
  }, [refreshNotifications, showToast]);

  useRealtimeSubscription('penyelesaian', { onAnyChange: handleRealtimeChange });

  // Stats calculation
  const stats = [
    { label: 'Total Penyelesaian', value: penyelesaianRequests.length.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Belum Selesai', value: penyelesaianRequests.filter(p => p.statusPenyelesaian === 'Belum Selesai').length.toString(), color: 'bg-orange-50 text-orange-600' },
    { label: 'Selesai', value: penyelesaianRequests.filter(p => p.statusPenyelesaian === 'Selesai').length.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: penyelesaianRequests.filter(p => p.statusApproval === 'Approved').length.toString(), color: 'bg-blue-50 text-blue-600' },
  ];

  const getStatusApprovalBadge = (status) => {
    const badges = {
      'Pending': 'bg-amber-50 text-amber-700',
      'Approved': 'bg-emerald-50 text-emerald-700',
      'Rejected': 'bg-rose-50 text-rose-700',
    };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>{status}</span>;
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
      // Reset form data
      setFormData(prev => ({
        ...prev,
        nomorQl: '',
        kasbonNominal: 0,
        namaKaryawan: isGuest ? '' : userName || '',
        detailPengeluaran: [],
        metodePengembalian: ''
      }));
      return;
    }

    // Cek apakah kasbon sudah diselesaikan
    const sudahDiselesaikan = penyelesaianRequests.some(p => p.nomorKasbon === nomorKasbon);

    if (sudahDiselesaikan) {
      setKasbonValidation({
        isValid: false,
        message: 'Kasbon ini sudah diselesaikan',
        isChecking: false
      });
      // Reset form data
      setFormData(prev => ({
        ...prev,
        nomorQl: '',
        kasbonNominal: 0,
        namaKaryawan: isGuest ? '' : userName || '',
        detailPengeluaran: [],
        metodePengembalian: ''
      }));
      return;
    }

    // Kasbon valid, auto-fill data
    setKasbonValidation({
      isValid: true,
      message: 'Kasbon ditemukan',
      isChecking: false
    });
    setFormData(prev => ({
      ...prev,
      nomorQl: kasbon.nomorQl || '',
      namaEvent: kasbon.namaEvent || '', // Auto-fill namaEvent from kasbon
      kasbonNominal: kasbon.nominal || 0,
      namaKaryawan: kasbon.namaKaryawan || '',
      detailPengeluaran: [],
      metodePengembalian: ''
    }));
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

      try {
        const nomorPenyelesaian = formData.nomorPenyelesaian || generatePenyelesaianNumber();

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadFile(file, 'penyelesaian', nomorPenyelesaian, userName);

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

      // Simpan ke Supabase
      const selisih = calculateSelisih();
      const statusSelisih = getStatusSelisih();
      const totalPengeluaran = calculateTotalExpense();

      // Generate unique nomor penyelesaian at submit time to prevent conflicts
      const nomorPenyelesaian = generatePenyelesaianNumber();
      const newPenyelesaianData = {
        nomor_penyelesaian: nomorPenyelesaian,
        nomor_kasbon: formData.nomorKasbon,
        nomor_ql: formData.nomorQl || null,
        nama_event: formData.namaEvent || null, // Save nama_event
        kasbon_nominal: parseFloat(formData.kasbonNominal),
        nama_karyawan: formData.namaKaryawan,
        detail_pengeluaran: formData.detailPengeluaran,
        total_pengeluaran: totalPengeluaran,
        total_nominal: totalPengeluaran,
        selisih: selisih,
        status_selisih: statusSelisih,
        metode_pengembalian: formData.metodePengembalian || null,
        lampiran: formData.lampiran || null,
        keterangan: formData.keterangan || null,
        status_approval: 'Pending',
        disetujui_oleh: null,
        status_penyelesaian: 'Belum Selesai'
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

      await fetchPenyelesaian(); // Refresh data
      await fetchKasbon(); // Refresh kasbon list to reflect updated status

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
        keterangan: '',
      });
      setFileName('');
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

  // Handle Approve Penyelesaian
  const handleApprove = (penyelesaian) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Konfirmasi Approval',
      message: `Apakah Anda yakin ingin menyetujui Penyelesaian "${penyelesaian.nomorPenyelesaian}"? Tindakan ini akan mengubah status menjadi Approved.`,
      onConfirm: async () => {
        try {
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_approval: 'Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Penyelesaian berhasil disetujui', 'success');
          await fetchPenyelesaian();
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
          await updateRecord('penyelesaian', penyelesaian.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'penyelesaian',
            recordId: penyelesaian.id,
            recordNumber: penyelesaian.nomorPenyelesaian,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Penyelesaian berhasil ditolak', 'success');
          await fetchPenyelesaian();
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
      kasbonNominal: penyelesaian.kasbonNominal || 0,
      namaKaryawan: penyelesaian.namaKaryawan || '',
      detailPengeluaran: penyelesaian.detailPengeluaran || [],
      metodePengembalian: penyelesaian.metodePengembalian || '',
      lampiran: penyelesaian.lampiran || null,
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
          showToast('Penyelesaian berhasil dihapus', 'success');
          await fetchPenyelesaian();
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
          await fetchPenyelesaian();
          refreshNotifications();
        } catch (error) {
          console.error('Error marking penyelesaian as complete:', error);
          showToast('Gagal menandai Penyelesaian sebagai selesai', 'error');
        }
      }
    });
  };

  // Filter dan Search
  const getFilteredAndSearchedData = () => {
    // Sort by newest first (based on Nomor Penyelesaian descending)
    let filtered = [...penyelesaianRequests].sort((a, b) => {
      const numA = parseInt(a.nomorPenyelesaian.split('-')[1]) || 0;
      const numB = parseInt(b.nomorPenyelesaian.split('-')[1]) || 0;
      return numB - numA;
    });

    if (filterStatus !== 'all') {
      if (filterStatus === 'belum-selesai') {
        filtered = filtered.filter(p => p.statusPenyelesaian === 'Belum Selesai');
      } else if (filterStatus === 'selesai') {
        filtered = filtered.filter(p => p.statusPenyelesaian === 'Selesai');
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.nomorPenyelesaian.toLowerCase().includes(term) ||
        p.nomorKasbon.toLowerCase().includes(term) ||
        p.namaKaryawan.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const filteredPenyelesaianRequests = getFilteredAndSearchedData();

  // Pagination
  const totalPages = Math.ceil(filteredPenyelesaianRequests.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPenyelesaianRequests.slice(indexOfFirstItem, indexOfLastItem);

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
              placeholder="Cari berdasarkan Nomor Penyelesaian, Nomor Kasbon, atau Nama Karyawan..."
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
              Semua ({penyelesaianRequests.length})
            </button>
            <button
              onClick={() => handleFilterChange('belum-selesai')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'belum-selesai'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Belum Selesai ({penyelesaianRequests.filter(p => p.statusPenyelesaian === 'Belum Selesai').length})
            </button>
            <button
              onClick={() => handleFilterChange('selesai')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'selesai'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Selesai ({penyelesaianRequests.filter(p => p.statusPenyelesaian === 'Selesai').length})
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
              Menampilkan <span className="font-semibold text-gray-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, filteredPenyelesaianRequests.length)}</span> dari <span className="font-semibold text-gray-800">{filteredPenyelesaianRequests.length}</span> penyelesaian
              {filteredPenyelesaianRequests.length !== penyelesaianRequests.length && (
                <span className="text-gray-500"> (Total: {penyelesaianRequests.length})</span>
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
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Penyelesaian</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((penyelesaian) => (
                      <tr key={penyelesaian.nomorPenyelesaian} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="text-sm font-bold text-amber-600">{penyelesaian.nomorPenyelesaian}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-medium text-emerald-600">{penyelesaian.nomorKasbon}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-600">{penyelesaian.tanggal}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700 font-medium">{penyelesaian.namaKaryawan}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatRupiah(penyelesaian.kasbonNominal)}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatRupiah(penyelesaian.totalPengeluaran)}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusSelisihBadge(penyelesaian.statusSelisih)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {penyelesaian.statusSelisih === 'Pengembalian' ? (
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
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {penyelesaian.lampiran ? (
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
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusApprovalBadge(penyelesaian.statusApproval)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{penyelesaian.disetujuiOleh}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusPenyelesaianBadge(penyelesaian.statusPenyelesaian)}
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

                            {/* Aksi Approve/Reject untuk Manager/Admin/BOD */}
                            {canManage && penyelesaian.statusApproval === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                  title="Approve"
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

                            {/* Aksi Selesai untuk Finance */}
                            {isFinance && penyelesaian.statusApproval === 'Approved' && penyelesaian.statusPenyelesaian === 'Belum Selesai' && (
                              <button
                                onClick={() => handleMarkSelesai(penyelesaian)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                                title="Tandai Selesai"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Selesai</span>
                              </button>
                            )}

                            {/* Aksi Edit/Delete untuk Admin dan Manager */}
                            {canDelete && (
                              <>
                                <button
                                  onClick={() => handleEdit(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDelete(penyelesaian)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-medium"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Hapus</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="13" className="py-12 text-center">
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
        {filteredPenyelesaianRequests.length > 0 && totalPages > 1 && (
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
                {itemsPerPage} per halaman
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
                        onClick={() => setFormData(prev => ({ ...prev, metodePengembalian: 'Cash' }))}
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
    </div>
  );
};

export default Penyelesaian;
