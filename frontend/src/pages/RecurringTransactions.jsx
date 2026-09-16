import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Calendar,
  Repeat,
  CreditCard,
  Wallet,
  FileText,
  Play,
  Pause,
  Trash2,
  Edit2,
  X,
  Check,
  AlertCircle,
  Clock,
  History,
  Upload,
  Image,
  CheckCircle,
  Ban,
  ExternalLink,
  FileUp,
  Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAllRecords, createRecord, updateRecord, deleteRecord } from '../lib/api';
import { TIPE_OPTIONS, ID_PERUSAHAAN_OPTIONS, getTipeOptionsByRole, getIdPerusahaanOptionsByRole } from '../constants/companyTypes';
import ConfirmModal from '../components/ConfirmModal';
import PasteUpload from '../components/PasteUpload';
import { uploadFileToR2 } from '../utils/r2Upload';

const RecurringTransactions = () => {
  const navigate = useNavigate();
  const { userName, userRole, userId, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [recurringList, setRecurringList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, item: null });
  const [tableExists, setTableExists] = useState(true);

  // New states for instances/jadwal pembayaran
  const [activeTab, setActiveTab] = useState('jadwal'); // 'jadwal' or 'template'
  const [instances, setInstances] = useState([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [instancesTableExists, setInstancesTableExists] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringInstance, setTransferringInstance] = useState(null);
  const [transferFile, setTransferFile] = useState(null);
  const [transferNotes, setTransferNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState({ isOpen: false, instance: null });
  const [confirmDeleteInstance, setConfirmDeleteInstance] = useState({ isOpen: false, instance: null });

  // Invoice upload states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceInstance, setInvoiceInstance] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'payment_request',
    frequency: 'monthly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    templateData: {
      tipe: '',
      id_perusahaan: '',
      nominal: '',
      keterangan: '',
      nama_karyawan: '',
      nama_bank: '',
      nomor_rekening: '',
      nama_pemilik_rekening: ''
    }
  });

  // Permission per-user (default mengikuti role, bisa dioverride Administrator)
  const canManage = hasPermission ? hasPermission('manage_recurring') : ['administrator', 'team_finance'].includes(userRole);
  const isAdmin = userRole === 'administrator';

  useEffect(() => {
    fetchRecurringTransactions();
    fetchInstances();
  }, []);

  // Fetch recurring instances
  const fetchInstances = async () => {
    try {
      setInstancesLoading(true);

      // Fetch both tables
      const [instancesData, templatesData] = await Promise.all([
        getAllRecords('recurring_instances'),
        getAllRecords('recurring_transactions')
      ]);

      // Manual join
      const joinedData = (instancesData || []).map(instance => {
        const template = (templatesData || []).find(t => t.id === instance.recurring_id);
        return {
          ...instance,
          recurring: template ? {
            id: template.id,
            name: template.name,
            type: template.type,
            template_data: template.template_data,
            frequency: template.frequency,
            day_of_month: template.day_of_month,
            day_of_week: template.day_of_week,
            is_active: template.is_active
          } : null
        };
      });

      // Sort by scheduled_date asc
      joinedData.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

      setInstancesTableExists(true);
      setInstances(joinedData);
    } catch (error) {
      console.error('Error fetching instances:', error);
      // Assume table exists if error is not 404/relation not found (api might throw different errors)
      // But for now just show error
      showToast('Gagal memuat jadwal pembayaran', 'error');
    } finally {
      setInstancesLoading(false);
    }
  };

  const fetchRecurringTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords('recurring_transactions');

      // Sort by created_at desc
      const sortedData = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setTableExists(true);
      setRecurringList(sortedData);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
      showToast('Gagal memuat data transaksi berulang', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'payment_request':
        return <CreditCard className="w-5 h-5 text-blue-600" />;
      case 'kasbon':
        return <Wallet className="w-5 h-5 text-emerald-600" />;
      case 'klaim':
        return <FileText className="w-5 h-5 text-violet-600" />;
      default:
        return <Repeat className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeBadge = (type) => {
    const badges = {
      payment_request: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Payment Request' },
      kasbon: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Kasbon' },
      klaim: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Klaim' }
    };
    return badges[type] || badges.payment_request;
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Harian',
      weekly: 'Mingguan',
      monthly: 'Bulanan',
      yearly: 'Tahunan'
    };
    return labels[frequency] || frequency;
  };

  const getDayOfWeekLabel = (day) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[day] || day;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('template_')) {
      const templateField = name.replace('template_', '');
      setFormData(prev => ({
        ...prev,
        templateData: {
          ...prev.templateData,
          [templateField]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'payment_request',
      frequency: 'monthly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      templateData: {
        tipe: '',
        id_perusahaan: '',
        nominal: '',
        keterangan: '',
        nama_karyawan: '',
        nama_bank: '',
        nomor_rekening: '',
        nama_pemilik_rekening: ''
      }
    });
    setEditingItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const templateData = item.template_data || {};
    setFormData({
      name: item.name || '',
      type: item.type || 'payment_request',
      frequency: item.frequency || 'monthly',
      dayOfWeek: item.day_of_week || 1,
      dayOfMonth: item.day_of_month || 1,
      templateData: {
        tipe: templateData.tipe || '',
        id_perusahaan: templateData.id_perusahaan || '',
        nominal: templateData.nominal || '',
        keterangan: templateData.keterangan || '',
        nama_karyawan: templateData.nama_karyawan || '',
        nama_bank: templateData.nama_bank || '',
        nomor_rekening: templateData.nomor_rekening || '',
        nama_pemilik_rekening: templateData.nama_pemilik_rekening || ''
      }
    });
    setShowModal(true);
  };

  const calculateNextRunDate = () => {
    const now = new Date();
    let nextDate = new Date();

    switch (formData.frequency) {
      case 'daily':
        nextDate.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        const currentDay = now.getDay();
        const targetDay = parseInt(formData.dayOfWeek);
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        nextDate.setDate(now.getDate() + daysUntil);
        break;
      case 'monthly':
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, parseInt(formData.dayOfMonth));
        if (nextDate <= now) {
          nextDate = new Date(now.getFullYear(), now.getMonth() + 2, parseInt(formData.dayOfMonth));
        }
        break;
      case 'yearly':
        nextDate = new Date(now.getFullYear() + 1, now.getMonth(), parseInt(formData.dayOfMonth));
        break;
    }

    return nextDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tableExists) {
      showToast('Tabel recurring_transactions belum dibuat. Silakan jalankan migration SQL terlebih dahulu.', 'error');
      return;
    }

    if (!formData.name.trim()) {
      showToast('Nama transaksi harus diisi', 'error');
      return;
    }

    if (!formData.templateData.nominal || parseFloat(formData.templateData.nominal) <= 0) {
      showToast('Nominal harus diisi dan lebih dari 0', 'error');
      return;
    }

    try {
      const recordData = {
        name: formData.name.trim(),
        type: formData.type,
        frequency: formData.frequency,
        day_of_week: formData.frequency === 'weekly' ? parseInt(formData.dayOfWeek) : null,
        day_of_month: ['monthly', 'yearly'].includes(formData.frequency) ? parseInt(formData.dayOfMonth) : null,
        template_data: {
          ...formData.templateData,
          nominal: parseFloat(formData.templateData.nominal)
        },
        next_run_date: calculateNextRunDate(),
        is_active: true,
        created_by: userId
      };

      let result;
      if (editingItem) {
        result = await updateRecord('recurring_transactions', editingItem.id, recordData);
        showToast('Transaksi berulang berhasil diperbarui', 'success');
      } else {
        result = await createRecord('recurring_transactions', recordData);
        showToast('Transaksi berulang berhasil dibuat', 'success');
      }

      setShowModal(false);
      resetForm();
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error saving recurring transaction:', error);
      showToast(`Gagal menyimpan: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateRecord('recurring_transactions', item.id, { is_active: !item.is_active });
      showToast(item.is_active ? 'Transaksi berulang dinonaktifkan' : 'Transaksi berulang diaktifkan', 'success');
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast(`Gagal mengubah status: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.item) return;

    try {
      await deleteRecord('recurring_transactions', confirmDelete.item.id);
      showToast('Transaksi berulang berhasil dihapus', 'success');
      setConfirmDelete({ isOpen: false, item: null });
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error deleting:', error);
      showToast(`Gagal menghapus: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  // Calculate next scheduled date based on frequency
  const calculateNextDate = (currentDate, frequency, dayOfMonth, dayOfWeek) => {
    const current = new Date(currentDate);
    let nextDate = new Date(current);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(current.getMonth() + 1);
        if (dayOfMonth) {
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        }
        break;
      case 'yearly':
        nextDate.setFullYear(current.getFullYear() + 1);
        break;
    }

    return nextDate.toISOString().split('T')[0];
  };

  // Open transfer modal
  const openTransferModal = (instance) => {
    setTransferringInstance(instance);
    setTransferFile(null);
    setTransferNotes('');
    setShowTransferModal(true);
  };

  // Handle transfer submission
  const handleTransfer = async () => {
    if (!transferringInstance) return;

    if (!transferFile) {
      showToast('Silakan upload bukti transfer terlebih dahulu', 'error');
      return;
    }

    try {
      setIsUploading(true);

      // Upload file to R2
      const uploadResult = await uploadFileToR2(
        transferFile,
        'recurring',
        `transfer-${transferringInstance.id}`
      );

      // Update instance with bukti transfer
      await updateRecord('recurring_instances', transferringInstance.id, {
        status: 'transferred',
        bukti_transfer: uploadResult.url,
        transferred_at: new Date().toISOString(),
        transferred_by: userId,
        transferred_by_name: userName,
        notes: transferNotes || null
      });

      // Get recurring transaction details for next instance
      const recurring = transferringInstance.recurring;
      if (recurring && recurring.is_active) {
        // Calculate next date
        const nextDate = calculateNextDate(
          transferringInstance.scheduled_date,
          recurring.frequency,
          recurring.day_of_month,
          recurring.day_of_week
        );

        // Check if next instance already exists
        const existingInstances = await getAllRecords('recurring_instances', {
          recurring_id: recurring.id,
          scheduled_date: nextDate
        });

        // Create next instance if not exists
        if (!existingInstances || existingInstances.length === 0) {
          try {
            await createRecord('recurring_instances', {
              recurring_id: recurring.id,
              scheduled_date: nextDate,
              status: 'pending'
            });
          } catch (insertError) {
            console.error('Error creating next instance:', insertError);
          }
        }

        // Update recurring_transactions next_run_date
        await updateRecord('recurring_transactions', recurring.id, {
          next_run_date: nextDate,
          last_run_date: transferringInstance.scheduled_date
        });
      }

      showToast('Bukti transfer berhasil diupload', 'success');
      setShowTransferModal(false);
      setTransferringInstance(null);
      setTransferFile(null);
      setTransferNotes('');
      fetchInstances();
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error handling transfer:', error);
      showToast(`Gagal upload bukti: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle skip instance
  const handleSkipInstance = async () => {
    if (!confirmSkip.instance) return;

    try {
      const instance = confirmSkip.instance;

      // Update instance status to skipped
      await updateRecord('recurring_instances', instance.id, {
        status: 'skipped',
        notes: 'Dilewati oleh ' + userName
      });

      // Get recurring transaction details for next instance
      const recurring = instance.recurring;
      if (recurring && recurring.is_active) {
        // Calculate next date
        const nextDate = calculateNextDate(
          instance.scheduled_date,
          recurring.frequency,
          recurring.day_of_month,
          recurring.day_of_week
        );

        // Check if next instance already exists
        const existingInstances = await getAllRecords('recurring_instances', {
          recurring_id: recurring.id,
          scheduled_date: nextDate
        });

        // Create next instance if not exists
        if (!existingInstances || existingInstances.length === 0) {
          await createRecord('recurring_instances', {
            recurring_id: recurring.id,
            scheduled_date: nextDate,
            status: 'pending'
          });
        }

        // Update recurring_transactions next_run_date
        await updateRecord('recurring_transactions', recurring.id, {
          next_run_date: nextDate
        });
      }

      showToast('Jadwal pembayaran dilewati', 'success');
      setConfirmSkip({ isOpen: false, instance: null });
      fetchInstances();
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error skipping instance:', error);
      showToast(`Gagal melewati jadwal: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  // Open invoice upload modal
  const openInvoiceModal = (instance) => {
    setInvoiceInstance(instance);
    setInvoiceFile(null);
    setShowInvoiceModal(true);
  };
  // Handle delete instance - Admin only
  const handleDeleteInstance = async () => {
    if (!confirmDeleteInstance.instance) return;
    try {
      await deleteRecord('recurring_instances', confirmDeleteInstance.instance.id);
      showToast('Jadwal berhasil dihapus', 'success');
      setConfirmDeleteInstance({ isOpen: false, instance: null });
      fetchInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      showToast('Gagal menghapus jadwal', 'error');
    }
  };


  // Handle invoice upload
  const handleInvoiceUpload = async () => {
    if (!invoiceInstance) return;

    if (!invoiceFile) {
      showToast('Silakan pilih file invoice terlebih dahulu', 'error');
      return;
    }

    try {
      setIsUploadingInvoice(true);

      // Upload file to R2
      const uploadResult = await uploadFileToR2(
        invoiceFile,
        'recurring',
        `invoice-${invoiceInstance.id}`
      );

      // Update instance with invoice URL
      await updateRecord('recurring_instances', invoiceInstance.id, {
        invoice_url: uploadResult.url,
        invoice_uploaded_at: new Date().toISOString(),
        invoice_uploaded_by: userId,
        invoice_uploaded_by_name: userName
      });

      showToast('Invoice berhasil diupload', 'success');
      setShowInvoiceModal(false);
      setInvoiceInstance(null);
      setInvoiceFile(null);
      fetchInstances();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      showToast(`Gagal upload invoice: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  // Get status badge for instance
  const getInstanceStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Belum Transfer' },
      transferred: { bg: 'bg-green-100', text: 'text-green-700', label: 'Sudah Transfer' },
      skipped: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Dilewati' }
    };
    return badges[status] || badges.pending;
  };

  // Filter instances
  const pendingInstances = instances.filter(i => i.status === 'pending');
  const completedInstances = instances.filter(i => i.status !== 'pending');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Transaksi Berulang</h1>
            <p className="text-sm text-gray-600 mt-1">Kelola transaksi otomatis yang berulang</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Tambah Baru</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{recurringList.length}</p>
              <p className="text-xs text-blue-600">Total Template</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{pendingInstances.length}</p>
              <p className="text-xs text-amber-600">Belum Transfer</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {instances.filter(i => i.status === 'transferred').length}
              </p>
              <p className="text-xs text-emerald-600">Sudah Transfer</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-700">
                {pendingInstances.filter(i => {
                  const scheduled = new Date(i.scheduled_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return scheduled <= today;
                }).length}
              </p>
              <p className="text-xs text-violet-600">Jatuh Tempo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('jadwal')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all ${activeTab === 'jadwal'
            ? 'bg-white text-primary-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Jadwal Pembayaran</span>
          {pendingInstances.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
              {pendingInstances.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all ${activeTab === 'template'
            ? 'bg-white text-primary-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Template Transaksi</span>
        </button>
      </div>

      {/* Jadwal Pembayaran Tab */}
      {activeTab === 'jadwal' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Jadwal Pembayaran</h2>
            <button
              onClick={fetchInstances}
              disabled={instancesLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${instancesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {instancesLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat jadwal...</p>
            </div>
          ) : !instancesTableExists ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold mb-2">Tabel Instance Belum Tersedia</p>
              <p className="text-sm text-gray-600 mb-4">
                Fitur Jadwal Pembayaran memerlukan setup database tambahan.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-sm text-amber-800 font-medium mb-2">Untuk mengaktifkan fitur ini:</p>
                <ol className="text-xs text-amber-700 list-decimal list-inside space-y-1">
                  <li>Buka Supabase Dashboard</li>
                  <li>Masuk ke SQL Editor</li>
                  <li>Jalankan migration dari file: <code className="bg-amber-100 px-1 rounded">supabase/migrations/recurring_instances.sql</code></li>
                </ol>
              </div>
            </div>
          ) : instances.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Belum ada jadwal pembayaran</p>
              <p className="text-sm text-gray-500">Buat template transaksi berulang terlebih dahulu</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Instances */}
              {pendingInstances.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Menunggu Transfer ({pendingInstances.length})</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Transaksi</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Jadwal</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nominal</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bank Tujuan</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pendingInstances.map((instance) => {
                          const recurring = instance.recurring;
                          const templateData = recurring?.template_data || {};
                          const isOverdue = new Date(instance.scheduled_date) <= new Date();
                          const typeBadge = getTypeBadge(recurring?.type);

                          return (
                            <tr key={instance.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                    {getTypeIcon(recurring?.type)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{recurring?.name || '-'}</p>
                                    <p className="text-xs text-gray-500">{templateData.tipe || '-'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <Calendar className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                                  <div>
                                    <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                                      {new Date(instance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                    {isOverdue && (
                                      <p className="text-xs text-red-500 font-medium">Jatuh Tempo!</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-sm font-semibold text-gray-800">
                                  Rp {formatRupiah(templateData.nominal || 0)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{templateData.nama_bank || '-'}</p>
                                  <p className="text-xs text-gray-500">{templateData.nomor_rekening || '-'}</p>
                                  <p className="text-xs text-gray-400">{templateData.nama_pemilik_rekening || '-'}</p>
                                </div>
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
                                  <button
                                    onClick={() => openInvoiceModal(instance)}
                                    className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-colors"
                                  >
                                    <FileUp className="w-3.5 h-3.5" />
                                    <span>Upload</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
                                  Belum Transfer
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center space-x-2">
                                  {canManage && (
                                    <>
                                      <button
                                        onClick={() => openTransferModal(instance)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Upload Bukti</span>
                                      </button>
                                      <button
                                        onClick={() => setConfirmSkip({ isOpen: true, instance })}
                                        className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                                        title="Lewati"
                                      >
                                        <Ban className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Completed Instances */}
              {completedInstances.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center space-x-2">
                    <History className="w-4 h-4" />
                    <span>Riwayat ({completedInstances.length})</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Transaksi</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Jadwal</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nominal</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Transfer Oleh</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bukti</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {completedInstances.slice(0, 10).map((instance) => {
                          const recurring = instance.recurring;
                          const templateData = recurring?.template_data || {};
                          const statusBadge = getInstanceStatusBadge(instance.status);

                          return (
                            <tr key={instance.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                    {getTypeIcon(recurring?.type)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{recurring?.name || '-'}</p>
                                    <p className="text-xs text-gray-500">{templateData.tipe || '-'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-sm text-gray-700">
                                  {new Date(instance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
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
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                                  {statusBadge.label}
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Template List Tab */}
      {activeTab === 'template' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Daftar Template Transaksi</h2>
            <button
              onClick={fetchRecurringTransactions}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data...</p>
            </div>
          ) : !tableExists ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold mb-2">Tabel Belum Tersedia</p>
              <p className="text-sm text-gray-600 mb-4">
                Fitur Transaksi Berulang memerlukan setup database tambahan.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-sm text-amber-800 font-medium mb-2">Untuk mengaktifkan fitur ini:</p>
                <ol className="text-xs text-amber-700 list-decimal list-inside space-y-1">
                  <li>Buka Supabase Dashboard</li>
                  <li>Masuk ke SQL Editor</li>
                  <li>Jalankan migration dari file: <code className="bg-amber-100 px-1 rounded">supabase/migrations/recurring_transactions.sql</code></li>
                </ol>
              </div>
            </div>
          ) : recurringList.length === 0 ? (
            <div className="py-12 text-center">
              <Repeat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Belum ada transaksi berulang</p>
              <p className="text-sm text-gray-500">Klik tombol "Tambah Baru" untuk membuat transaksi berulang</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nama</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Tipe</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Frekuensi</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nominal</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Jadwal Berikutnya</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recurringList.map((item) => {
                    const typeBadge = getTypeBadge(item.type);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              {getTypeIcon(item.type)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.template_data?.tipe || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeBadge.bg} ${typeBadge.text}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{getFrequencyLabel(item.frequency)}</p>
                            <p className="text-xs text-gray-500">
                              {item.frequency === 'weekly' && `Setiap ${getDayOfWeekLabel(item.day_of_week)}`}
                              {item.frequency === 'monthly' && `Tanggal ${item.day_of_month}`}
                              {item.frequency === 'daily' && 'Setiap hari'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-gray-800">
                            Rp {formatRupiah(item.template_data?.nominal || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {item.next_run_date
                                ? new Date(item.next_run_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${item.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`p-2 rounded-lg transition-colors ${item.is_active
                                ? 'hover:bg-amber-100 text-amber-600'
                                : 'hover:bg-green-100 text-green-600'
                                }`}
                              title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {item.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ isOpen: true, item })}
                                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingItem ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Transaksi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Contoh: Gaji Bulanan, Sewa Kantor"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipe Transaksi <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="payment_request">Payment Request</option>
                  <option value="kasbon">Kasbon</option>
                  <option value="klaim">Klaim</option>
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Frekuensi <span className="text-red-500">*</span>
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>

              {/* Day of Week (for weekly) */}
              {formData.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hari dalam Minggu <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="dayOfWeek"
                    value={formData.dayOfWeek}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="0">Minggu</option>
                    <option value="1">Senin</option>
                    <option value="2">Selasa</option>
                    <option value="3">Rabu</option>
                    <option value="4">Kamis</option>
                    <option value="5">Jumat</option>
                    <option value="6">Sabtu</option>
                  </select>
                </div>
              )}

              {/* Day of Month (for monthly/yearly) */}
              {['monthly', 'yearly'].includes(formData.frequency) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tanggal dalam Bulan <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="dayOfMonth"
                    value={formData.dayOfMonth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Template Data Transaksi</h4>

                {/* Tipe */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                  <select
                    name="template_tipe"
                    value={formData.templateData.tipe}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Pilih Tipe</option>
                    {getTipeOptionsByRole(userRole).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* ID Perusahaan */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Perusahaan</label>
                  <select
                    name="template_id_perusahaan"
                    value={formData.templateData.id_perusahaan}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Pilih ID Perusahaan</option>
                    {getIdPerusahaanOptionsByRole(userRole).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Nominal */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nominal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="template_nominal"
                    value={formData.templateData.nominal}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="0"
                  />
                </div>

                {/* Nama Karyawan */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Karyawan</label>
                  <input
                    type="text"
                    name="template_nama_karyawan"
                    value={formData.templateData.nama_karyawan}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Nama karyawan"
                  />
                </div>

                {/* Keterangan */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                  <textarea
                    name="template_keterangan"
                    value={formData.templateData.keterangan}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                    placeholder="Keterangan transaksi"
                  />
                </div>
              </div>

              {/* Bank Information Section */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Informasi Bank</h4>

                {/* Nama Bank */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                  <input
                    type="text"
                    name="template_nama_bank"
                    value={formData.templateData.nama_bank}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Contoh: BCA, Mandiri, BNI"
                  />
                </div>

                {/* Nomor Rekening */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    name="template_nomor_rekening"
                    value={formData.templateData.nomor_rekening}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Nomor rekening tujuan"
                  />
                </div>

                {/* Nama Pemilik Rekening */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    name="template_nama_pemilik_rekening"
                    value={formData.templateData.nama_pemilik_rekening}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="Nama sesuai rekening"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingItem ? 'Simpan' : 'Tambah'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        type="danger"
        title="Hapus Transaksi Berulang"
        message={`Apakah Anda yakin ingin menghapus transaksi berulang "${confirmDelete.item?.name}"?`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      {/* Skip Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmSkip.isOpen}
        onClose={() => setConfirmSkip({ isOpen: false, instance: null })}
        onConfirm={handleSkipInstance}
        type="warning"
        title="Lewati Pembayaran"
        message={`Apakah Anda yakin ingin melewati pembayaran "${confirmSkip.instance?.recurring?.name}" untuk periode ${confirmSkip.instance?.scheduled_date ? new Date(confirmSkip.instance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}?`}
        confirmText="Ya, Lewati"
        cancelText="Batal"
      />

      {/* Transfer Modal */}
      {showTransferModal && transferringInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-emerald-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                  <p className="text-sm text-emerald-100">{transferringInstance.recurring?.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferringInstance(null);
                  setTransferFile(null);
                  setTransferNotes('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Transfer Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Jadwal</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {new Date(transferringInstance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nominal</span>
                  <span className="text-sm font-bold text-primary-600">
                    Rp {formatRupiah(transferringInstance.recurring?.template_data?.nominal || 0)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Bank Tujuan</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {transferringInstance.recurring?.template_data?.nama_bank || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {transferringInstance.recurring?.template_data?.nomor_rekening || '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    a.n. {transferringInstance.recurring?.template_data?.nama_pemilik_rekening || '-'}
                  </p>
                </div>
              </div>

              {/* Upload Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bukti Transfer <span className="text-red-500">*</span>
                </label>
                <PasteUpload
                  onFileSelect={setTransferFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSize={10}
                  placeholder="Paste screenshot atau pilih file"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                  placeholder="Catatan tambahan..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferringInstance(null);
                    setTransferFile(null);
                    setTransferNotes('');
                  }}
                  disabled={isUploading}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={isUploading || !transferFile}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Upload Modal */}
      {showInvoiceModal && invoiceInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-violet-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Invoice</h3>
                  <p className="text-sm text-violet-100">{invoiceInstance.recurring?.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceInstance(null);
                  setInvoiceFile(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Invoice Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Jadwal</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {new Date(invoiceInstance.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nominal</span>
                  <span className="text-sm font-bold text-primary-600">
                    Rp {formatRupiah(invoiceInstance.recurring?.template_data?.nominal || 0)}
                  </span>
                </div>
              </div>

              {/* Upload Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  File Invoice <span className="text-red-500">*</span>
                </label>
                <PasteUpload
                  onFileSelect={setInvoiceFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSize={10}
                  placeholder="Paste screenshot atau pilih file invoice"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setInvoiceInstance(null);
                    setInvoiceFile(null);
                  }}
                  disabled={isUploadingInvoice}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleInvoiceUpload}
                  disabled={isUploadingInvoice || !invoiceFile}
                  className="px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isUploadingInvoice ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Upload Invoice</span>
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

export default RecurringTransactions;
