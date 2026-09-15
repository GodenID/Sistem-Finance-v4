import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, Printer, FileText, Calendar, User, Building2, DollarSign, CheckCircle, XCircle, Eye, Loader2, Upload, X, Briefcase } from 'lucide-react';
import { getRecordById, updateRecord, uploadFile } from '../lib/api';
import { useVendor } from '../context/VendorContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { logActivity } from '../lib/auditLog';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';
import QLLink from '../components/QLLink';
import ConfirmModal from '../components/ConfirmModal';
import PasteUpload from '../components/PasteUpload';
import { sendTransferNotification } from '../lib/emailNotifications';
import { exportPaymentRequestDetailExcel } from '../utils/detailExcelExport';
import { exportPaymentRequestDetailPdf } from '../utils/detailPdfExport';

import jsPDF from 'jspdf';

const PaymentRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getVendorById } = useVendor();
  const { showToast } = useToast();
  const { userName, userRole, userId } = useAuth();
  const { refreshNotifications } = useNotification();
  const [pr, setPr] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Transfer states for team_finance
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [buktiTransferFile, setBuktiTransferFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check if user can approve
  const canApprove = ['administrator', 'bod', 'manager'].includes(userRole);
  const canTransfer = userRole === 'team_finance';
  const canViewConfidential = ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());


  useEffect(() => {
    const fetchPRDetail = async () => {
      try {
        setIsLoading(true);
        const data = await getRecordById('payment_requests', id);
        setPr(data);
      } catch (error) {
        console.error('Error fetching PR detail:', error);
        showToast('Gagal memuat detail Payment Request', 'error');
        navigate('/payment-request');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchPRDetail();
    }
  }, [id, navigate, showToast]);

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  // Show Approve Modal
  const showApproveModal = () => {
    setConfirmModal({ isOpen: true, type: 'approve' });
  };

  // Show Reject Modal
  const showRejectModal = () => {
    setConfirmModal({ isOpen: true, type: 'reject' });
  };

  // Close Modal
  const closeModal = () => {
    setConfirmModal({ isOpen: false, type: null });
  };

  // Handle Approve
  const handleApprove = async () => {
    if (!pr || !canApprove) return;

    setIsApproving(true);
    try {
      await updateRecord('payment_requests', pr.id, {
        status_approval: 'Approved',
        disetujui_oleh: userName || 'Manager'
      });
      await logActivity({
        tableName: 'payment_requests',
        recordId: pr.id,
        recordNumber: pr.nomor_pr,
        action: 'approve',
        fieldChanged: 'status_approval',
        oldValue: 'Pending',
        newValue: 'Approved',
        changedBy: userId,
        changedByName: userName
      });
      closeModal();
      showToast('Payment Request berhasil disetujui', 'success');
      refreshNotifications();
      const data = await getRecordById('payment_requests', id);
      setPr(data);
    } catch (error) {
      console.error('Error approving:', error);
      showToast('Gagal menyetujui Payment Request', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!pr || !canApprove) return;

    setIsApproving(true);
    try {
      await updateRecord('payment_requests', pr.id, {
        status_approval: 'Rejected',
        disetujui_oleh: userName || 'Manager'
      });
      await logActivity({
        tableName: 'payment_requests',
        recordId: pr.id,
        recordNumber: pr.nomor_pr,
        action: 'reject',
        fieldChanged: 'status_approval',
        oldValue: 'Pending',
        newValue: 'Rejected',
        changedBy: userId,
        changedByName: userName
      });
      closeModal();
      showToast('Payment Request berhasil ditolak', 'success');
      refreshNotifications();
      const data = await getRecordById('payment_requests', id);
      setPr(data);
    } catch (error) {
      console.error('Error rejecting:', error);
      showToast('Gagal menolak Payment Request', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Transfer for team_finance
  const handleConfirmTransfer = async () => {
    if (!pr || !canTransfer || !buktiTransferFile) return;

    setIsUploading(true);
    try {
      // Upload bukti transfer
      const result = await uploadFile(buktiTransferFile, 'payment-requests', pr.nomor_pr);

      // Update record
      await updateRecord('payment_requests', pr.id, {
        bukti_transfer: result.url,
        status_transfer: 'Sudah Transfer'
      });

      // Log activity
      await logActivity({
        tableName: 'payment_requests',
        recordId: pr.id,
        recordNumber: pr.nomor_pr,
        action: 'transfer',
        fieldChanged: 'status_transfer',
        oldValue: 'Belum Transfer',
        newValue: 'Sudah Transfer',
        changedBy: userId,
        changedByName: userName
      });

      await sendTransferNotification({
        tableName: 'payment_requests',
        record: pr,
        amount: pr.nominal,
        proofUrl: result.url,
        transferredBy: userName,
        detailPath: `/payment-request/${pr.id}`
      });

      showToast('Bukti transfer berhasil diupload', 'success');
      setShowTransferModal(false);
      setBuktiTransferFile(null);
      refreshNotifications();

      // Refresh data
      const data = await getRecordById('payment_requests', id);
      setPr(data);
    } catch (error) {
      console.error('Error uploading transfer:', error);
      showToast('Gagal mengupload bukti transfer', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportPDF = () => {
    if (!pr) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const vendorInfo = pr.vendor_id ? getVendorById(pr.vendor_id) : null;

    // Colors
    const primaryColor = [37, 99, 235]; // Blue
    const grayColor = [107, 114, 128];
    const lightGrayColor = [243, 244, 246];

    // Header with background
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Company Logo/Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT REQUEST', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Prasasti Group', pageWidth / 2, 30, { align: 'center' });
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 37, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    let yPos = 55;

    // Document Info Box
    doc.setFillColor(...lightGrayColor);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 25, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Nomor PR:', margin + 5, yPos + 10);
    doc.setFont(undefined, 'normal');
    doc.text(pr.nomor_pr || '-', margin + 35, yPos + 10);

    doc.setFont(undefined, 'bold');
    doc.text('Nomor QL:', margin + 5, yPos + 18);
    doc.setFont(undefined, 'normal');
    doc.text(pr.nomor_ql || '-', margin + 35, yPos + 18);

    // Status badges on the right
    const statusX = pageWidth - margin - 50;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);

    // Status Approval
    if (pr.status_approval === 'Approved') {
      doc.setFillColor(220, 252, 231);
      doc.setTextColor(22, 163, 74);
    } else if (pr.status_approval === 'Rejected') {
      doc.setFillColor(254, 226, 226);
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setFillColor(254, 243, 199);
      doc.setTextColor(217, 119, 6);
    }
    doc.roundedRect(statusX, yPos + 5, 45, 7, 2, 2, 'F');
    doc.text(pr.status_approval || 'Pending', statusX + 22.5, yPos + 9.5, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    yPos += 35;

    // Section: Informasi Dasar
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INFORMASI DASAR', margin, yPos);

    // Line under section title
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    const addField = (label, value, isFullWidth = false) => {
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...grayColor);
      doc.text(label, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);

      if (isFullWidth) {
        const lines = doc.splitTextToSize(value, pageWidth - margin * 2);
        doc.text(lines, margin, yPos + 5);
        yPos += 5 + (lines.length * 5);
      } else {
        doc.text(value, margin + 50, yPos);
      }
      yPos += 7;
    };

    addField('Tanggal', pr.created_at ? new Date(pr.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-');
    addField('Nama Karyawan', pr.nama_karyawan || '-');
    addField('Tipe', pr.tipe || '-');
    addField('ID Perusahaan', pr.id_perusahaan || '-');
    addField('Nama Event/Project', pr.nama_event || '-');

    yPos += 5;

    // Section: Informasi Vendor atau Virtual Account
    if (pr.metode_pembayaran === 'Virtual Account') {
      // Virtual Account Section
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(147, 51, 234); // Purple
      doc.text('INFORMASI VIRTUAL ACCOUNT', margin, yPos);
      doc.setDrawColor(147, 51, 234);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

      yPos += 10;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      addField('Nomor Virtual Account', pr.virtual_account_number || '-');
      addField('Nama Virtual Account', pr.virtual_account_name || '-');

      yPos += 5;
    } else if (vendorInfo) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('INFORMASI VENDOR', margin, yPos);
      doc.setDrawColor(...primaryColor);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

      yPos += 10;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      addField('Nama Vendor', vendorInfo.nama || '-');
      addField('Kategori', vendorInfo.kategori || '-');
      addField('Nama Bank', vendorInfo.namaBank || '-');
      addField('No. Rekening', vendorInfo.nomorRekening || '-');
      addField('Pemilik Rekening', vendorInfo.namaPemilikRekening || '-');

      yPos += 5;
    }

    // Section: Nominal (Highlighted Box)
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 20, 3, 3, 'FD');

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...grayColor);
    doc.text('NOMINAL', margin + 5, yPos + 8);

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text(`Rp ${formatRupiah(pr.nominal || 0)}`, margin + 5, yPos + 16);

    yPos += 30;

    // Section: Status
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('STATUS', margin, yPos);
    doc.setDrawColor(...primaryColor);
    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    addField('Status Approval', pr.status_approval || 'Pending');
    addField('Disetujui Oleh', pr.disetujui_oleh || '-');
    addField('Status Transfer', pr.status_transfer || 'Belum Transfer');

    // Section: Keterangan
    if (pr.keterangan) {
      yPos += 5;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('KETERANGAN', margin, yPos);
      doc.setDrawColor(...primaryColor);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

      yPos += 10;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');

      const keteranganLines = doc.splitTextToSize(pr.keterangan, pageWidth - (margin * 2));
      doc.text(keteranganLines, margin, yPos);
      yPos += keteranganLines.length * 5 + 10;
    }

    // Footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(...grayColor);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.setFont(undefined, 'italic');
    doc.text('Dokumen ini digenerate secara otomatis oleh sistem Finance Prasasti Group', pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text(`Halaman 1 dari 1`, pageWidth - margin, footerY + 5, { align: 'right' });

    doc.save(`Payment-Request-${pr.nomor_pr}.pdf`);
  };

  const handleExportExcel = () => {
    if (!pr) return;

    try {
      const selectedVendorInfo = (pr.vendor_id || pr.id_vendor)
        ? getVendorById(pr.vendor_id || pr.id_vendor)
        : null;

      exportPaymentRequestDetailExcel(pr, selectedVendorInfo);
      showToast('Excel detail Payment Request berhasil diexport', 'success');
    } catch (error) {
      console.error('Error exporting Payment Request Excel:', error);
      showToast('Gagal export Excel Payment Request', 'error');
    }
  };

  const handleExportPDFModern = async () => {
    if (!pr || isExportingPdf) return;

    try {
      setIsExportingPdf(true);
      const selectedVendorInfo = (pr.vendor_id || pr.id_vendor)
        ? getVendorById(pr.vendor_id || pr.id_vendor)
        : null;

      await exportPaymentRequestDetailPdf(pr, selectedVendorInfo);
      showToast('PDF detail Payment Request berhasil diexport', 'success');
    } catch (error) {
      console.error('Error exporting Payment Request PDF:', error);
      showToast('Gagal export PDF Payment Request', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-gray-600">Memuat data...</span>
        </div>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">Data tidak ditemukan</p>
          <button
            onClick={() => navigate('/payment-request')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Check if user can view confidential data
  if (pr.is_confidential && !canViewConfidential) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">
            Data ini bersifat <strong>CONFIDENTIAL</strong> dan hanya dapat diakses oleh pihak yang berwenang.
          </p>
          <button
            onClick={() => navigate('/payment-request')}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    );
  }

  const vendorInfo = pr.vendor_id ? getVendorById(pr.vendor_id) : null;

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            break-inside: avoid;
          }
          h1, h2, h3 {
            color: #1f2937 !important;
          }
        }
      `}</style>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/payment-request')}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Detail Payment Request</h1>
              <p className="text-sm text-gray-600 mt-1">{pr.nomor_pr}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <Printer className="w-5 h-5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              onClick={handleExportPDFModern}
              disabled={isExportingPdf}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span className="hidden sm:inline">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>
          </div>
        </div>

        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-6">
          <div className="text-center border-b-2 border-primary-600 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-primary-600">PAYMENT REQUEST</h1>
            <p className="text-sm text-gray-600 mt-2">Prasasti Group</p>
            <p className="text-xs text-gray-500 mt-1">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nomor PR</p>
                <p className="text-lg font-bold text-gray-800">{pr.nomor_pr}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Nomor QL</p>
                <p className="text-lg font-bold text-gray-800"><QLLink ql={pr.nomor_ql} linkClassName="text-blue-600" /></p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div id="printable-area" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="card">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <span>Informasi Dasar</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Nomor PR</label>
                  <p className="text-base font-semibold text-gray-800">{pr.nomor_pr}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Nomor QL</label>
                  <p className="text-base font-semibold text-gray-800"><QLLink ql={pr.nomor_ql} linkClassName="text-blue-600" /></p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Tanggal</label>
                  <p className="text-base text-gray-800 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{pr.created_at ? new Date(pr.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Nama Karyawan</label>
                  <p className="text-base text-gray-800 flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{pr.nama_karyawan || '-'}</span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Tipe</label>
                  <div className="mt-1">
                    <TipeBadge tipe={pr.tipe} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">ID Perusahaan</label>
                  <div className="mt-1">
                    <IdPerusahaanBadge idPerusahaan={pr.id_perusahaan} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-gray-500">Nama Event/Project</label>
                  <p className="text-base text-gray-800 flex items-center space-x-2 mt-1">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span>{pr.nama_event || '-'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Info Card - shown for Transfer Rekening */}
            {vendorInfo && pr.metode_pembayaran !== 'Virtual Account' && (
              <div className="card">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-primary-600" />
                  <span>Informasi Vendor</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Nama Vendor</label>
                    <p className="text-base font-semibold text-gray-800">{vendorInfo.nama}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Kategori</label>
                    <p className="text-base text-gray-800">{vendorInfo.kategori || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Nama Bank</label>
                    <p className="text-base text-gray-800">{vendorInfo.namaBank || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Nomor Rekening</label>
                    <p className="text-base font-mono text-gray-800">{vendorInfo.nomorRekening || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm text-gray-500">Nama Pemilik Rekening</label>
                    <p className="text-base text-gray-800">{vendorInfo.namaPemilikRekening || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Virtual Account Info Card - shown for Virtual Account */}
            {pr.metode_pembayaran === 'Virtual Account' && (
              <div className="card">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  <span>Informasi Virtual Account</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">VA</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Nomor Virtual Account</label>
                    <p className="text-base font-mono font-semibold text-gray-800">{pr.virtual_account_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Nama Virtual Account</label>
                    <p className="text-base font-semibold text-gray-800">{pr.virtual_account_name || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Keterangan */}
            {pr.keterangan && (
              <div className="card">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Keterangan</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{pr.keterangan}</p>
              </div>
            )}

            {/* Lampiran */}
            {pr.lampiran && (
              <div className="card">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Lampiran</h2>
                {(() => {
                  // Parse lampiran - could be JSON array or single URL string
                  let lampiranList = [];
                  try {
                    if (typeof pr.lampiran === 'string') {
                      if (pr.lampiran.startsWith('[')) {
                        lampiranList = JSON.parse(pr.lampiran);
                      } else {
                        lampiranList = [pr.lampiran];
                      }
                    } else if (Array.isArray(pr.lampiran)) {
                      lampiranList = pr.lampiran;
                    }
                  } catch (e) {
                    lampiranList = [pr.lampiran];
                  }

                  return (
                    <div className="space-y-2">
                      {lampiranList.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          <span className="truncate">Lampiran {lampiranList.length > 1 ? index + 1 : ''}</span>
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Nominal Card */}
            <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
              <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Nominal</span>
              </h2>
              <p className="text-3xl font-bold text-primary-700">
                Rp {formatRupiah(pr.nominal || 0)}
              </p>
            </div>

            {/* Status Cards */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Status</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Status Approval</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${pr.status_approval === 'Approved' ? 'bg-green-100 text-green-700' :
                      pr.status_approval === 'Rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                      {pr.status_approval === 'Approved' && <CheckCircle className="w-4 h-4 mr-1" />}
                      {pr.status_approval === 'Rejected' && <XCircle className="w-4 h-4 mr-1" />}
                      {pr.status_approval || 'Pending'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Disetujui Oleh</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">{pr.disetujui_oleh || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status Transfer</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${pr.status_transfer === 'Sudah Transfer' ? 'bg-blue-100 text-blue-700' :
                      ['Tidak Transfer', 'Reject', 'Rejected'].includes(pr.status_transfer) ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                      {pr.status_transfer || 'Belum Transfer'}
                    </span>
                  </div>
                </div>
                {pr.bukti_transfer && (
                  <div>
                    <label className="text-xs text-gray-500">Bukti Transfer</label>
                    <div className="mt-1">
                      <a
                        href={pr.bukti_transfer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Lihat Bukti Transfer</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Actions */}
            {canApprove && pr.status_approval === 'Pending' && (
              <div className="card border-2 border-amber-200 bg-amber-50">
                <h2 className="text-sm font-semibold text-amber-800 mb-3">Aksi Approval</h2>
                <div className="space-y-2">
                  <button
                    onClick={showApproveModal}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={showRejectModal}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            )}

            {/* Transfer Actions for Team Finance */}
            {canTransfer && pr.status_approval === 'Approved' && pr.status_transfer === 'Belum Transfer' && (
              <div className="card border-2 border-blue-200 bg-blue-50">
                <h2 className="text-sm font-semibold text-blue-800 mb-3">Aksi Transfer</h2>
                <p className="text-xs text-blue-600 mb-3">
                  PR ini sudah di-approve dan menunggu transfer
                </p>
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Bukti Transfer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'approve'}
        onClose={closeModal}
        onConfirm={handleApprove}
        type="success"
        title="Setujui Payment Request"
        message={`Apakah Anda yakin ingin menyetujui Payment Request ini?`}
        confirmText="Ya, Setujui"
        cancelText="Batal"
        isLoading={isApproving}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nomor PR:</span>
              <span className="font-semibold text-gray-800">{pr?.nomor_pr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Nominal:</span>
              <span className="font-semibold text-green-600">Rp {formatRupiah(pr?.nominal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor:</span>
              <span className="font-medium text-gray-800">{pr?.vendor_name || getVendorById(pr?.id_vendor)?.nama || '-'}</span>
            </div>
          </div>
        }
      />

      {/* Reject Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'reject'}
        onClose={closeModal}
        onConfirm={handleReject}
        type="danger"
        title="Tolak Payment Request"
        message={`Apakah Anda yakin ingin menolak Payment Request ini?`}
        confirmText="Ya, Tolak"
        cancelText="Batal"
        isLoading={isApproving}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nomor PR:</span>
              <span className="font-semibold text-gray-800">{pr?.nomor_pr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Nominal:</span>
              <span className="font-semibold text-red-600">Rp {formatRupiah(pr?.nominal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor:</span>
              <span className="font-medium text-gray-800">{pr?.vendor_name || getVendorById(pr?.id_vendor)?.nama || '-'}</span>
            </div>
          </div>
        }
      />

      {/* Transfer Modal for Team Finance */}
      {showTransferModal && pr && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                  <p className="text-sm text-white/80">{pr.nomor_pr}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setBuktiTransferFile(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info PR */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Vendor:</span>
                    <p className="font-medium text-gray-800">{pr.vendor_name || getVendorById(pr.id_vendor)?.nama || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nominal:</span>
                    <p className="font-semibold text-blue-600">Rp {formatRupiah(pr.nominal || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bukti Transfer <span className="text-red-500">*</span>
                </label>
                <PasteUpload
                  onFileSelect={(file) => setBuktiTransferFile(file)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSize={10}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setBuktiTransferFile(null);
                  }}
                  disabled={isUploading}
                  className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  disabled={!buktiTransferFile || isUploading}
                  className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
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
    </>
  );
};

export default PaymentRequestDetail;
