import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Download, Eye, X, ChevronLeft, ChevronRight, Banknote, Wallet, FileText, CheckCircle, XCircle, Upload, Trash2, Edit2, Paperclip } from 'lucide-react';
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
import { generateKasbonNumber } from '../utils/generateUniqueNumber';

const Kasbon = () => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKasbon, setSelectedKasbon] = useState(null);

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
  const [transferringKasbon, setTransferringKasbon] = useState(null);
  const [buktiTransferFile, setBuktiTransferFile] = useState(null);
  const [buktiTransferFileName, setBuktiTransferFileName] = useState('');
  const [uploadingBuktiTransfer, setUploadingBuktiTransfer] = useState(false);

  // State untuk mencegah double submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk editing
  const [editingKasbon, setEditingKasbon] = useState(null);

  // State untuk form Kasbon
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
    keterangan: '',
  });

  // Data Kasbon dari Supabase
  const [kasbonRequests, setKasbonRequests] = useState([]);
  const [isLoadingKasbon, setIsLoadingKasbon] = useState(true);

  // Fetch kasbon dari Supabase
  const fetchKasbon = async () => {
    try {
      setIsLoadingKasbon(true);
      const data = await getAllRecords('kasbon');
      // Transform data dari Supabase ke format yang digunakan di UI
      const transformedData = data.map(item => ({
        id: item.id,
        nomorKasbon: item.nomor_kasbon,
        nomorQl: item.nomor_ql || '',
        tanggal: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
        tipe: item.tipe || '',
        idPerusahaan: item.id_perusahaan || '',
        nominal: parseFloat(item.nominal) || 0,
        statusApproval: item.status_approval || 'Pending',
        disetujuiOleh: item.nama_approver || '-',
        statusTransfer: item.status_transfer || 'Belum Transfer',
        keterangan: item.keterangan || '',
        buktiTransfer: item.bukti_transfer || null,
        namaKaryawan: item.nama_karyawan || '',
        metodePembayaran: item.metode_pembayaran || '',
        namaBank: item.nama_bank || '',
        nomorRekening: item.nomor_rekening || '',
        namaPemilikRekening: item.nama_pemilik_rekening || '',
        statusPenyelesaian: item.status_penyelesaian || 'Belum Diselesaikan'
      }));
      setKasbonRequests(transformedData);
    } catch (error) {
      console.error('Error fetching kasbon:', error);
      showToast('Gagal memuat data kasbon', 'error');
    } finally {
      setIsLoadingKasbon(false);
    }
  };

  React.useEffect(() => {
    fetchKasbon();
  }, []);

  // Realtime subscription for automatic updates
  const handleRealtimeChange = useCallback((eventType, newRecord, oldRecord) => {
    if (eventType === 'INSERT') {
      setKasbonRequests(prev => {
        const transformed = {
          id: newRecord.id,
          nomorKasbon: newRecord.nomor_kasbon,
          nomorQl: newRecord.nomor_ql || '',
          tanggal: newRecord.created_at ? new Date(newRecord.created_at).toISOString().split('T')[0] : '',
          tipe: newRecord.tipe || '',
          idPerusahaan: newRecord.id_perusahaan || '',
          nominal: parseFloat(newRecord.nominal) || 0,
          statusApproval: newRecord.status_approval || 'Pending',
          disetujuiOleh: newRecord.nama_approver || '-',
          statusTransfer: newRecord.status_transfer || 'Belum Transfer',
          keterangan: newRecord.keterangan || '',
          buktiTransfer: newRecord.bukti_transfer || null,
          namaKaryawan: newRecord.nama_karyawan || '',
          metodePembayaran: newRecord.metode_pembayaran || '',
          namaBank: newRecord.nama_bank || '',
          nomorRekening: newRecord.nomor_rekening || '',
          namaPemilikRekening: newRecord.nama_pemilik_rekening || ''
        };
        return [transformed, ...prev];
      });
      showToast('Data kasbon baru ditambahkan', 'info');
    } else if (eventType === 'UPDATE') {
      setKasbonRequests(prev => prev.map(item => {
        if (item.id === newRecord.id) {
          return {
            ...item,
            nomorKasbon: newRecord.nomor_kasbon,
            nomorQl: newRecord.nomor_ql || '',
            tipe: newRecord.tipe || '',
            idPerusahaan: newRecord.id_perusahaan || '',
            nominal: parseFloat(newRecord.nominal) || 0,
            statusApproval: newRecord.status_approval || 'Pending',
            disetujuiOleh: newRecord.nama_approver || '-',
            statusTransfer: newRecord.status_transfer || 'Belum Transfer',
            keterangan: newRecord.keterangan || '',
            buktiTransfer: newRecord.bukti_transfer || null,
            namaKaryawan: newRecord.nama_karyawan || '',
            metodePembayaran: newRecord.metode_pembayaran || '',
            namaBank: newRecord.nama_bank || '',
            nomorRekening: newRecord.nomor_rekening || '',
            namaPemilikRekening: newRecord.nama_pemilik_rekening || ''
          };
        }
        return item;
      }));
      showToast('Data kasbon diperbarui', 'info');
    } else if (eventType === 'DELETE') {
      setKasbonRequests(prev => prev.filter(item => item.id !== oldRecord.id));
      showToast('Data kasbon dihapus', 'info');
    }
    refreshNotifications();
  }, [refreshNotifications, showToast]);

  useRealtimeSubscription('kasbon', { onAnyChange: handleRealtimeChange });

  // Stats calculation
  const stats = [
    { label: 'Total Kasbon', value: kasbonRequests.length.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Belum Transfer', value: kasbonRequests.filter(kb => kb.statusTransfer === 'Belum Transfer').length.toString(), color: 'bg-amber-50 text-amber-600' },
    { label: 'Sudah Transfer', value: kasbonRequests.filter(kb => kb.statusTransfer === 'Sudah Transfer').length.toString(), color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Approved', value: kasbonRequests.filter(kb => kb.statusApproval === 'Approved').length.toString(), color: 'bg-blue-50 text-blue-600' },
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

  const getStatusPenyelesaianBadge = (status) => {
    const badges = {
      'Belum Diselesaikan': 'bg-orange-50 text-orange-700',
      'Sudah Diselesaikan': 'bg-emerald-50 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-50 text-gray-600'}`}>
        {status}
      </span>
    );
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

      // Data kasbon
      const kasbonData = {
        nomor_ql: formData.nomorQl || null,
        nama_event: formData.namaEvent,
        tipe: formData.tipe,
        id_perusahaan: formData.idPerusahaan || null,
        nominal: parseFloat(formData.nominal),
        metode_pembayaran: formData.metodePembayaran,
        nama_bank: formData.namaBank || null,
        nomor_rekening: formData.nomorRekening || null,
        nama_pemilik_rekening: formData.namaPemilikRekening || null,
        keterangan: formData.keterangan || null,
        nama_karyawan: isGuest ? formData.namaKaryawan : userName || ''
      };

      // Jika editing mode
      if (editingKasbon) {
        await updateRecord('kasbon', editingKasbon.id, kasbonData);

        // Log activity untuk UPDATE
        await logActivity({
          tableName: 'kasbon',
          recordId: editingKasbon.id,
          recordNumber: editingKasbon.nomorKasbon,
          action: 'update',
          fieldChanged: 'multiple',
          oldValue: `Nominal: Rp ${editingKasbon.nominal.toLocaleString('id-ID')}`,
          newValue: `Nominal: Rp ${parseFloat(formData.nominal).toLocaleString('id-ID')}`,
          changedBy: userId,
          changedByName: userName
        });

        showToast('Kasbon berhasil diperbarui', 'success');
      } else {
        // Create new - BOD transactions are auto-approved and confidential
        const isBOD = userRole?.toLowerCase() === 'bod';

        kasbonData.status_approval = isBOD ? 'Approved' : 'Pending';
        kasbonData.status_transfer = 'Belum Transfer';
        kasbonData.disetujui_oleh = isBOD ? userId : null;
        kasbonData.nama_approver = isBOD ? userName : null;
        kasbonData.is_confidential = isBOD;

        // Generate unique nomor kasbon at submit time to prevent conflicts
        const nomorKasbon = generateKasbonNumber();
        kasbonData.nomor_kasbon = nomorKasbon;

        const createdKasbon = await createRecord('kasbon', kasbonData);

        // Log activity untuk CREATE
        await logActivity({
          tableName: 'kasbon',
          recordId: createdKasbon.id,
          recordNumber: nomorKasbon,
          action: 'create',
          fieldChanged: null,
          oldValue: null,
          newValue: `Nominal: Rp ${parseFloat(formData.nominal).toLocaleString('id-ID')}`,
          changedBy: userId,
          changedByName: userName
        });

        showToast('Kasbon berhasil ditambahkan', 'success');
      }

      await fetchKasbon(); // Refresh data
      setShowModal(false);
      setEditingKasbon(null);
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
        keterangan: '',
      });
    } catch (error) {
      console.error('Error saving kasbon:', error);
      showToast(editingKasbon ? 'Gagal memperbarui Kasbon' : 'Gagal menambahkan Kasbon', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetail = (kasbon) => {
    navigate(`/kasbon/${kasbon.id}`);
  };

  // Handle Edit Kasbon (untuk Administrator dan Manager)
  const handleEdit = (kasbon) => {
    setEditingKasbon(kasbon);
    setFormData({
      nomorQl: kasbon.nomorQl || '',
      tipe: kasbon.tipe || '',
      idPerusahaan: kasbon.idPerusahaan || '',
      namaKaryawan: kasbon.namaKaryawan || '',
      nominal: kasbon.nominal?.toString() || '',
      metodePembayaran: kasbon.metodePembayaran || '',
      namaBank: kasbon.namaBank || '',
      nomorRekening: kasbon.nomorRekening || '',
      namaPemilikRekening: kasbon.namaPemilikRekening || '',
      keterangan: kasbon.keterangan || '',
    });
    setShowModal(true);
  };

  // Handle Delete Kasbon (untuk Administrator dan Manager)
  const handleDelete = (kasbon) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Hapus',
      message: `Apakah Anda yakin ingin menghapus Kasbon "${kasbon.nomorKasbon}"? Data yang sudah dihapus tidak dapat dikembalikan.`,
      onConfirm: async () => {
        try {
          await deleteRecord('kasbon', kasbon.id);
          // Log activity
          await logActivity({
            tableName: 'kasbon',
            recordId: kasbon.id,
            recordNumber: kasbon.nomorKasbon,
            action: 'delete',
            fieldChanged: null,
            oldValue: `Nominal: Rp ${kasbon.nominal.toLocaleString('id-ID')}`,
            newValue: null,
            changedBy: userId,
            changedByName: userName
          });
          showToast('Kasbon berhasil dihapus', 'success');
          await fetchKasbon();
          refreshNotifications();
        } catch (error) {
          console.error('Error deleting kasbon:', error);
          showToast('Gagal menghapus Kasbon', 'error');
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
      message: `Apakah Anda yakin ingin menghapus ${selectedItems.length} kasbon? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await bulkDeleteRecords('kasbon', selectedItems);

          // Log activity untuk setiap item yang dihapus
          for (const id of selectedItems) {
            const kasbon = kasbonRequests.find(k => k.id === id);
            if (kasbon) {
              await logActivity({
                tableName: 'kasbon',
                recordId: id,
                recordNumber: kasbon.nomorKasbon,
                action: 'bulk_delete',
                fieldChanged: null,
                oldValue: `Nominal: Rp ${kasbon.nominal.toLocaleString('id-ID')}`,
                newValue: null,
                changedBy: userId,
                changedByName: userName
              });
            }
          }

          showToast(`${selectedItems.length} kasbon berhasil dihapus`, 'success');
          setSelectedItems([]);
          await fetchKasbon();
          refreshNotifications();
        } catch (error) {
          console.error('Error bulk deleting kasbon:', error);
          showToast('Gagal menghapus kasbon', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // Handle Approve Kasbon
  const handleApprove = (kasbon) => {
    setConfirmDialog({
      isOpen: true,
      type: 'success',
      title: 'Konfirmasi Approval',
      message: `Apakah Anda yakin ingin menyetujui Kasbon "${kasbon.nomorKasbon}"? Tindakan ini akan mengubah status menjadi Approved.`,
      onConfirm: async () => {
        try {
          await updateRecord('kasbon', kasbon.id, {
            status_approval: 'Approved',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'kasbon',
            recordId: kasbon.id,
            recordNumber: kasbon.nomorKasbon,
            action: 'approve',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Approved',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Kasbon berhasil disetujui', 'success');
          await fetchKasbon();
          refreshNotifications();
        } catch (error) {
          console.error('Error approving kasbon:', error);
          showToast('Gagal menyetujui Kasbon', 'error');
        }
      }
    });
  };

  // Handle Reject Kasbon
  const handleReject = (kasbon) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Konfirmasi Penolakan',
      message: `Apakah Anda yakin ingin menolak Kasbon "${kasbon.nomorKasbon}"? Tindakan ini akan mengubah status menjadi Rejected.`,
      onConfirm: async () => {
        try {
          await updateRecord('kasbon', kasbon.id, {
            status_approval: 'Rejected',
            disetujui_oleh: userId || null,
            nama_approver: userName || 'Manager'
          });
          // Log activity
          await logActivity({
            tableName: 'kasbon',
            recordId: kasbon.id,
            recordNumber: kasbon.nomorKasbon,
            action: 'reject',
            fieldChanged: 'status_approval',
            oldValue: 'Pending',
            newValue: 'Rejected',
            changedBy: userId,
            changedByName: userName
          });
          showToast('Kasbon berhasil ditolak', 'success');
          await fetchKasbon();
          refreshNotifications();
        } catch (error) {
          console.error('Error rejecting kasbon:', error);
          showToast('Gagal menolak Kasbon', 'error');
        }
      }
    });
  };

  // Handle update status transfer (khusus Finance)
  const handleUpdateTransferStatus = async (kasbon, newStatus) => {
    if (newStatus === 'Sudah Transfer') {
      // Cek metode pembayaran
      if (kasbon.metodePembayaran === 'Cash') {
        // Jika Cash, langsung update tanpa bukti transfer
        setConfirmDialog({
          isOpen: true,
          type: 'success',
          title: 'Konfirmasi Transfer Cash',
          message: `Apakah Anda yakin ingin menandai kasbon ini sudah dibayar tunai (cash)?`,
          onConfirm: async () => {
            try {
              await updateRecord('kasbon', kasbon.id, {
                status_transfer: 'Sudah Transfer'
              });
              // Log activity
              await logActivity({
                tableName: 'kasbon',
                recordId: kasbon.id,
                recordNumber: kasbon.nomorKasbon,
                action: 'transfer',
                fieldChanged: 'status_transfer',
                oldValue: 'Belum Transfer',
                newValue: 'Sudah Transfer',
                changedBy: userId,
                changedByName: userName
              });
              showToast('Status transfer berhasil diperbarui', 'success');
              await fetchKasbon();
              refreshNotifications();
            } catch (error) {
              console.error('Error updating transfer status:', error);
              showToast('Gagal memperbarui status transfer', 'error');
            }
          }
        });
      } else {
        // Jika Transfer, tampilkan modal upload bukti transfer
        setTransferringKasbon(kasbon);
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
        message: `Apakah Anda yakin ingin menolak transfer untuk kasbon ini?`,
        onConfirm: async () => {
          try {
            const oldStatus = kasbon.statusTransfer;
            await updateRecord('kasbon', kasbon.id, {
              status_transfer: newStatus
            });
            // Log activity
            await logActivity({
              tableName: 'kasbon',
              recordId: kasbon.id,
              recordNumber: kasbon.nomorKasbon,
              action: 'transfer',
              fieldChanged: 'status_transfer',
              oldValue: oldStatus,
              newValue: newStatus,
              changedBy: userId,
              changedByName: userName
            });
            showToast(`Status transfer berhasil diperbarui menjadi ${newStatus}`, 'success');
            await fetchKasbon();
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
      const result = await uploadFile(buktiTransferFile, 'kasbon', transferringKasbon.nomorKasbon);

      // Update record dengan bukti transfer dan status
      await updateRecord('kasbon', transferringKasbon.id, {
        bukti_transfer: result.url,
        status_transfer: 'Sudah Transfer'
      });

      // Log activity
      await logActivity({
        tableName: 'kasbon',
        recordId: transferringKasbon.id,
        recordNumber: transferringKasbon.nomorKasbon,
        action: 'transfer',
        fieldChanged: 'status_transfer',
        oldValue: 'Belum Transfer',
        newValue: 'Sudah Transfer',
        changedBy: userId,
        changedByName: userName
      });

      showToast('Bukti transfer berhasil diupload dan status diperbarui', 'success');
      setShowBuktiTransferModal(false);
      setTransferringKasbon(null);
      setBuktiTransferFile(null);
      setBuktiTransferFileName('');
      await fetchKasbon();
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
    // Sort by newest first (based on Nomor Kasbon descending)
    let filtered = [...kasbonRequests].sort((a, b) => {
      const numA = parseInt(a.nomorKasbon.split('-')[1]) || 0;
      const numB = parseInt(b.nomorKasbon.split('-')[1]) || 0;
      return numB - numA;
    });

    if (filterStatus !== 'all') {
      if (filterStatus === 'belum-transfer') {
        filtered = filtered.filter(kb => kb.statusTransfer === 'Belum Transfer');
      } else if (filterStatus === 'sudah-transfer') {
        filtered = filtered.filter(kb => kb.statusTransfer === 'Sudah Transfer');
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(kb =>
        kb.nomorKasbon.toLowerCase().includes(term) ||
        kb.nomorQl.toLowerCase().includes(term) ||
        kb.namaKaryawan.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const filteredKasbonRequests = getFilteredAndSearchedData();

  // Pagination
  const totalPages = Math.ceil(filteredKasbonRequests.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredKasbonRequests.slice(indexOfFirstItem, indexOfLastItem);

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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kasbon Karyawan</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Kelola pengajuan kasbon karyawan</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium">Ajukan Kasbon</span>
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
              placeholder="Cari berdasarkan Nomor Kasbon, Nomor QL, atau Nama Karyawan..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Semua ({kasbonRequests.length})
              </button>
              <button
                onClick={() => handleFilterChange('belum-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'belum-transfer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Belum ({kasbonRequests.filter(kb => kb.statusTransfer === 'Belum Transfer').length})
              </button>
              <button
                onClick={() => handleFilterChange('sudah-transfer')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterStatus === 'sudah-transfer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Sudah ({kasbonRequests.filter(kb => kb.statusTransfer === 'Sudah Transfer').length})
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
                Menampilkan <span className="font-semibold text-gray-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-gray-800">{Math.min(indexOfLastItem, filteredKasbonRequests.length)}</span> dari <span className="font-semibold text-gray-800">{filteredKasbonRequests.length}</span> kasbon
                {filteredKasbonRequests.length !== kasbonRequests.length && (
                  <span className="text-gray-500"> (Total: {kasbonRequests.length})</span>
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
                Hasil pencarian untuk: <span className="font-semibold text-emerald-600">"{searchTerm}"</span>
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
                          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                          title="Pilih Semua"
                        />
                      </th>
                    )}
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Kasbon</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor QL</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipe</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">ID Perusahaan</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Karyawan</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nominal</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Metode</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Informasi Bank</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Keterangan</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Approval</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disetujui Oleh</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Penyelesaian</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Bukti Transfer</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length > 0 ? (
                    currentItems.map((kasbon) => (
                      <tr key={kasbon.nomorKasbon} className={`hover:bg-gray-50 transition-colors ${selectedItems.includes(kasbon.id) ? 'bg-emerald-50' : ''}`}>
                        {/* Checkbox column - Administrator Only */}
                        {canEditDelete && (
                          <td className="py-4 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(kasbon.id)}
                              onChange={() => handleSelectItem(kasbon.id)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-4 px-6">
                          <span className="text-sm font-bold text-emerald-600">{kasbon.nomorKasbon}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{kasbon.nomorQl}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-600">{kasbon.tanggal}</span>
                        </td>
                        <td className="py-4 px-6">
                          <TipeBadge tipe={kasbon.tipe} size="sm" />
                        </td>
                        <td className="py-4 px-6">
                          <IdPerusahaanBadge idPerusahaan={kasbon.idPerusahaan} size="sm" showFullName={true} />
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700 font-medium">{kasbon.namaKaryawan}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatRupiah(kasbon.nominal)}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {kasbon.metodePembayaran === 'Transfer' ? (
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
                          {kasbon.metodePembayaran === 'Transfer' ? (
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-gray-800">{kasbon.namaBank}</p>
                              <p className="text-xs text-gray-600 font-mono">{kasbon.nomorRekening}</p>
                              <p className="text-xs text-gray-500">{kasbon.namaPemilikRekening}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-gray-600 line-clamp-2" title={kasbon.keterangan}>
                            {kasbon.keterangan || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusApprovalBadge(kasbon.statusApproval)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-700">{kasbon.disetujuiOleh}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusTransferBadge(kasbon.statusTransfer)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {getStatusPenyelesaianBadge(kasbon.statusPenyelesaian)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {kasbon.buktiTransfer ? (
                            <a
                              href={kasbon.buktiTransfer}
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
                              onClick={() => handleDetail(kasbon)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Detail</span>
                            </button>

                            {/* Aksi Approve/Reject untuk Manager/Admin/BOD */}
                            {canManage && kasbon.statusApproval === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(kasbon)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                  title="Approve"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleReject(kasbon)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Aksi khusus Finance untuk update status transfer */}
                            {isFinance && kasbon.statusApproval === 'Approved' && kasbon.statusTransfer === 'Belum Transfer' && (
                              <>
                                <button
                                  onClick={() => handleUpdateTransferStatus(kasbon, 'Sudah Transfer')}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                                  title={kasbon.metodePembayaran === 'Cash' ? 'Bayar Cash' : 'Upload Bukti Transfer'}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>{kasbon.metodePembayaran === 'Cash' ? 'Bayar' : 'Transfer'}</span>
                                </button>
                                <button
                                  onClick={() => handleUpdateTransferStatus(kasbon, 'Reject')}
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
                                  onClick={() => handleEdit(kasbon)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDelete(kasbon)}
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
                    ))
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
                                : 'Tidak ada kasbon dengan filter yang dipilih'}
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
        {filteredKasbonRequests.length > 0 && totalPages > 1 && (
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
                            ? 'bg-emerald-600 text-white shadow-sm'
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
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Ajukan Kasbon Baru</h2>
                  <p className="text-sm text-white/80 mt-1">Isi form untuk mengajukan kasbon</p>
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
                  <div className="w-1 h-6 bg-emerald-600 rounded-full mr-3"></div>
                  Informasi Dasar
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Nomor Kasbon (Auto-generated at submit) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Kasbon</label>
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  <div className="w-1 h-6 bg-emerald-600 rounded-full mr-3"></div>
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

              {/* Section: Detail Pembayaran */}
              <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-emerald-600 rounded-full mr-3"></div>
                  Detail Pembayaran
                </h3>
                <div className="flex flex-col gap-4">
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
                        className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold text-lg"
                      />
                    </div>
                  </div>

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

                  {/* Conditional Bank Fields - Only show if Transfer */}
                  {formData.metodePembayaran === 'Transfer' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col gap-4">
                      <h4 className="text-md font-bold text-gray-800 flex items-center">
                        <Banknote className="w-5 h-5 mr-2 text-blue-600" />
                        Informasi Bank
                      </h4>

                      {/* Nama Bank */}
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

                      {/* Nomor Rekening */}
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

                      {/* Nama Pemilik Rekening */}
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

                  {/* Keterangan */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      placeholder="Masukkan keterangan keperluan kasbon..."
                      rows="3"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
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
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                >
                  {isSubmitting ? 'Memproses...' : 'Ajukan Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {showDetailModal && selectedKasbon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <div>
                <h2 className="text-2xl font-bold text-white">Detail Kasbon</h2>
                <p className="text-sm text-white/80 mt-1">{selectedKasbon.nomorKasbon}</p>
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
              {/* Info Kasbon */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-emerald-600 rounded mr-3"></span>
                  Informasi Kasbon
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor Kasbon</label>
                    <p className="text-lg font-bold text-emerald-600 mt-1">{selectedKasbon.nomorKasbon}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor QL</label>
                    <p className="text-lg font-semibold text-gray-800 mt-1">{selectedKasbon.nomorQl}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</label>
                    <p className="text-base text-gray-700 mt-1">{selectedKasbon.tanggal}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</label>
                    <div className="mt-1">
                      <TipeBadge tipe={selectedKasbon.tipe} size="md" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Perusahaan</label>
                    <div className="mt-1">
                      <IdPerusahaanBadge idPerusahaan={selectedKasbon.idPerusahaan} size="md" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Karyawan</label>
                    <p className="text-base font-medium text-gray-700 mt-1">{selectedKasbon.namaKaryawan}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Metode Pembayaran</label>
                    <p className="text-base text-gray-700 mt-1">
                      {selectedKasbon.metodePembayaran === 'Transfer' ? (
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
                    <p className="text-3xl font-bold text-gray-800 mt-1">Rp {formatRupiah(selectedKasbon.nominal)}</p>
                  </div>
                </div>
              </div>

              {/* Keterangan */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-blue-600 rounded mr-3"></span>
                  Keterangan
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center mb-2">
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Keperluan Kasbon
                  </label>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {selectedKasbon.keterangan || '-'}
                  </p>
                </div>
              </div>

              {/* Informasi Bank (Conditional) */}
              {selectedKasbon.metodePembayaran === 'Transfer' && (
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
                        <p className="text-lg font-bold text-gray-800 mt-2">{selectedKasbon.namaBank}</p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Nomor Rekening</label>
                        <p className="text-2xl font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded-lg border border-blue-200 mt-2">
                          {selectedKasbon.nomorRekening}
                        </p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Nama Pemilik Rekening</label>
                        <p className="text-lg font-semibold text-gray-800 mt-2 bg-white px-4 py-2 rounded-lg border border-blue-200">
                          {selectedKasbon.namaPemilikRekening}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-amber-600 rounded mr-3"></span>
                  Status & Approval
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Approval</label>
                    <p className="mt-2">{getStatusApprovalBadge(selectedKasbon.statusApproval)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disetujui Oleh</label>
                    <p className="text-base text-gray-700 mt-1">{selectedKasbon.disetujuiOleh}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Transfer</label>
                    <p className="mt-2">{getStatusTransferBadge(selectedKasbon.statusTransfer)}</p>
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

      {/* Modal Upload Bukti Transfer */}
      {showBuktiTransferModal && transferringKasbon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                  <p className="text-sm text-white/80">{transferringKasbon.nomorKasbon}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBuktiTransferModal(false);
                  setTransferringKasbon(null);
                  setBuktiTransferFile(null);
                  setBuktiTransferFileName('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info Kasbon */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Karyawan:</span>
                    <p className="font-medium text-gray-800">{transferringKasbon.namaKaryawan}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nominal:</span>
                    <p className="font-semibold text-emerald-600">Rp {formatRupiah(transferringKasbon.nominal)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Rekening Tujuan:</span>
                    <p className="font-medium text-gray-800">{transferringKasbon.namaBank} - {transferringKasbon.nomorRekening}</p>
                    <p className="text-sm text-gray-600">{transferringKasbon.namaPemilikRekening}</p>
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
                    setTransferringKasbon(null);
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
                  className={`px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || uploadingBuktiTransfer) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

export default Kasbon;
