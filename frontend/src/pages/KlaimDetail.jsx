import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, Calendar, User, DollarSign, CheckCircle, XCircle, Banknote, Wallet, Eye, Download, FileSpreadsheet, Loader2, Upload, X, Briefcase } from 'lucide-react';
import { getRecordById, updateRecord, uploadFile } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { logActivity } from '../lib/auditLog';
import { uploadThenSave } from '../utils/fileCleanup';
import TipeBadge from '../components/TipeBadge';
import IdPerusahaanBadge from '../components/IdPerusahaanBadge';
import QLLink from '../components/QLLink';
import ConfirmModal from '../components/ConfirmModal';
import PasteUpload from '../components/PasteUpload';
import ApprovalTimeline from '../components/ApprovalTimeline';
import { formatTanggalJam, getStatusBadgeClass, STAGE_LABEL } from '../lib/approvalFlow';
import jsPDF from 'jspdf';
import { sendTransferNotification } from '../lib/emailNotifications';
import { exportKlaimDetailExcel } from '../utils/detailExcelExport';
import { exportKlaimDetailPdf } from '../utils/detailPdfExport';

const KlaimDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { userName, userRole, userId, hasPermission } = useAuth();
    const { refreshNotifications } = useNotification();
    const [klaim, setKlaim] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApproving, setIsApproving] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // Transfer states for team_finance
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [buktiTransferFile, setBuktiTransferFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Tahap 1 (Manager): Pending -> Manager Approved | Tahap 2 (Head Finance): Manager Approved -> Approved
    const canManagerApprove = klaim?.status_approval === 'Pending' && (hasPermission
        ? (hasPermission('approve_manager') || hasPermission('approve'))
        : ['administrator', 'bod', 'manager'].includes(userRole));
    const canHeadApprove = klaim?.status_approval === 'Manager Approved' && (hasPermission
        ? (hasPermission('approve_head_finance') || hasPermission('approve'))
        : ['administrator', 'head_finance'].includes(userRole));
    const canApprove = canManagerApprove || canHeadApprove;
    const canTransfer = hasPermission ? hasPermission('transfer') : userRole === 'team_finance';
    const canViewConfidential = hasPermission ? hasPermission('view_confidential') : ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());

    useEffect(() => {
        const fetchKlaimDetail = async () => {
            try {
                setIsLoading(true);
                const data = await getRecordById('klaim', id);
                setKlaim(data);
            } catch (error) {
                console.error('Error fetching klaim detail:', error);
                showToast('Gagal memuat detail Klaim', 'error');
                navigate('/klaim');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchKlaimDetail();
        }
    }, [id, navigate, showToast]);

    const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID').format(angka);
    };

    const showApproveModal = () => setConfirmModal({ isOpen: true, type: canHeadApprove ? 'approve-head' : 'approve' });
    const showRejectModal = () => setConfirmModal({ isOpen: true, type: 'reject' });
    const closeModal = () => setConfirmModal({ isOpen: false, type: null });

    const handleApprove = async () => {
        if (!klaim || !canManagerApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('klaim', klaim.id, {
                status_approval: 'Manager Approved',
                nama_approver: userName || 'Manager',
                manager_approved_by: userName || 'Manager',
                manager_approved_at: nowIso
            });
            await logActivity({
                tableName: 'klaim',
                recordId: klaim.id,
                recordNumber: klaim.nomor_klaim,
                action: 'approve',
                fieldChanged: 'status_approval',
                oldValue: 'Pending',
                newValue: 'Manager Approved',
                changedBy: userId,
                changedByName: userName
            });
            closeModal();
            showToast('Disetujui Manager. Menunggu approval Head Finance.', 'success');
            refreshNotifications();
            const data = await getRecordById('klaim', id);
            setKlaim(data);
        } catch (error) {
            console.error('Error approving:', error);
            showToast('Gagal menyetujui Klaim', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const handleApproveHead = async () => {
        if (!klaim || !canHeadApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('klaim', klaim.id, {
                status_approval: 'Approved',
                nama_approver: userName || 'Head Finance',
                head_finance_approved_by: userName || 'Head Finance',
                head_finance_approved_at: nowIso
            });
            await logActivity({
                tableName: 'klaim',
                recordId: klaim.id,
                recordNumber: klaim.nomor_klaim,
                action: 'approve',
                fieldChanged: 'status_approval',
                oldValue: 'Manager Approved',
                newValue: 'Approved',
                changedBy: userId,
                changedByName: userName
            });
            closeModal();
            showToast('Disetujui Head Finance. Siap transfer oleh Finance.', 'success');
            refreshNotifications();
            const data = await getRecordById('klaim', id);
            setKlaim(data);
        } catch (error) {
            console.error('Error approving:', error);
            showToast('Gagal menyetujui Klaim', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!klaim || !canApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('klaim', klaim.id, {
                status_approval: 'Rejected',
                nama_approver: userName || 'Manager',
                rejected_by: userName || 'Manager',
                rejected_at: nowIso
            });
            await logActivity({
                tableName: 'klaim',
                recordId: klaim.id,
                recordNumber: klaim.nomor_klaim,
                action: 'reject',
                fieldChanged: 'status_approval',
                oldValue: klaim.status_approval || 'Pending',
                newValue: 'Rejected',
                changedBy: userId,
                changedByName: userName
            });
            closeModal();
            showToast('Klaim berhasil ditolak', 'success');
            refreshNotifications();
            const data = await getRecordById('klaim', id);
            setKlaim(data);
        } catch (error) {
            console.error('Error rejecting:', error);
            showToast('Gagal menolak Klaim', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    // Handle Transfer for team_finance
    const handleConfirmTransfer = async () => {
        if (!klaim || !canTransfer || !buktiTransferFile) return;

        setIsUploading(true);
        try {
            // Upload lalu update — bila update gagal, file ikut dihapus (anti yatim)
            const { result } = await uploadThenSave(
                () => uploadFile(buktiTransferFile, 'klaim', klaim.nomor_klaim),
                (uploadResult) => updateRecord('klaim', klaim.id, {
                    bukti_transfer: uploadResult.url,
                    status_transfer: 'Sudah Transfer',
                    transferred_at: new Date().toISOString()
                })
            );

            await logActivity({
                tableName: 'klaim',
                recordId: klaim.id,
                recordNumber: klaim.nomor_klaim,
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
                proofUrl: result.url,
                transferredBy: userName,
                detailPath: `/klaim/${klaim.id}`
            });

            showToast('Bukti transfer berhasil diupload', 'success');
            setShowTransferModal(false);
            setBuktiTransferFile(null);
            refreshNotifications();

            const data = await getRecordById('klaim', id);
            setKlaim(data);
        } catch (error) {
            console.error('Error uploading transfer:', error);
            showToast('Gagal mengupload bukti transfer', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleExportPDF = () => {
        if (!klaim) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Colors - Violet theme for Klaim
        const primaryColor = [139, 92, 246]; // Violet
        const grayColor = [107, 114, 128];
        const lightGrayColor = [243, 244, 246];

        // Header with background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Company Logo/Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('KLAIM REIMBURSEMENT', pageWidth / 2, 20, { align: 'center' });

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
        doc.text('Nomor Klaim:', margin + 5, yPos + 10);
        doc.setFont(undefined, 'normal');
        doc.text(klaim.nomor_klaim || '-', margin + 42, yPos + 10);

        doc.setFont(undefined, 'bold');
        doc.text('Nomor QL:', margin + 5, yPos + 18);
        doc.setFont(undefined, 'normal');
        doc.text(klaim.nomor_ql || '-', margin + 42, yPos + 18);

        // Status badges on the right
        const statusX = pageWidth - margin - 50;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);

        if (klaim.status_approval === 'Approved') {
            doc.setFillColor(220, 252, 231);
            doc.setTextColor(22, 163, 74);
        } else if (klaim.status_approval === 'Rejected') {
            doc.setFillColor(254, 226, 226);
            doc.setTextColor(220, 38, 38);
        } else {
            doc.setFillColor(254, 243, 199);
            doc.setTextColor(217, 119, 6);
        }
        doc.roundedRect(statusX, yPos + 5, 45, 7, 2, 2, 'F');
        doc.text(klaim.status_approval || 'Pending', statusX + 22.5, yPos + 9.5, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        yPos += 35;

        // Section: Informasi Dasar
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('INFORMASI DASAR', margin, yPos);

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

        addField('Tanggal', klaim.created_at ? new Date(klaim.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-');
        addField('Nama Karyawan', klaim.nama_karyawan || '-');
        addField('Tipe', klaim.tipe || '-');
        addField('ID Perusahaan', klaim.id_perusahaan || '-');
        addField('Nama Event/Project', klaim.nama_event || '-');

        yPos += 5;

        // Section: Metode Pembayaran
        if (klaim.metode_pembayaran) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('METODE PEMBAYARAN', margin, yPos);
            doc.setDrawColor(...primaryColor);
            doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

            yPos += 10;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);

            addField('Metode', klaim.metode_pembayaran || '-');
            if (klaim.metode_pembayaran === 'Transfer') {
                addField('Nama Bank', klaim.nama_bank || '-');
                addField('No. Rekening', klaim.nomor_rekening || '-');
                addField('Pemilik Rek.', klaim.nama_pemilik_rekening || '-');
            }

            yPos += 5;
        }

        // Section: Nominal (Highlighted Box)
        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(1);
        doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 20, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...grayColor);
        doc.text('NOMINAL', margin + 5, yPos + 8);

        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text(`Rp ${formatRupiah(klaim.nominal || 0)}`, margin + 5, yPos + 16);

        yPos += 30;

        // Section: Rincian Pengeluaran (if available)
        if (klaim.detail_pengeluaran) {
            try {
                const items = typeof klaim.detail_pengeluaran === 'string'
                    ? JSON.parse(klaim.detail_pengeluaran)
                    : klaim.detail_pengeluaran;

                if (Array.isArray(items) && items.length > 0) {
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(...primaryColor);
                    doc.text('RINCIAN PENGELUARAN', margin, yPos);
                    doc.setDrawColor(...primaryColor);
                    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

                    yPos += 10;
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(10);

                    // Table header
                    doc.setFillColor(...lightGrayColor);
                    doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(...grayColor);
                    doc.text('No', margin + 3, yPos + 5);
                    doc.text('Nama Pengeluaran', margin + 15, yPos + 5);
                    doc.text('Nominal', pageWidth - margin - 35, yPos + 5);
                    yPos += 10;

                    // Table rows
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(0, 0, 0);
                    let total = 0;
                    items.forEach((item, index) => {
                        const itemNominal = parseInt(item.nominal) || 0;
                        total += itemNominal;
                        doc.text(`${index + 1}`, margin + 3, yPos + 4);
                        doc.text(item.nama || '-', margin + 15, yPos + 4);
                        doc.text(`Rp ${formatRupiah(itemNominal)}`, pageWidth - margin - 35, yPos + 4);
                        yPos += 7;
                    });

                    // Total row
                    doc.setFillColor(245, 243, 255);
                    doc.rect(margin, yPos, pageWidth - (margin * 2), 10, 'F');
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(...primaryColor);
                    doc.text('TOTAL', margin + 15, yPos + 6);
                    doc.text(`Rp ${formatRupiah(total)}`, pageWidth - margin - 35, yPos + 6);
                    yPos += 15;
                }
            } catch (e) {
                // Skip if parsing fails
            }
        }

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

        addField('Status Approval', klaim.status_approval || 'Pending');
        addField('Disetujui Oleh', klaim.nama_approver || '-');
        addField('Status Transfer', klaim.status_transfer || 'Belum Transfer');

        // Section: Keterangan
        if (klaim.keterangan) {
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

            const keteranganLines = doc.splitTextToSize(klaim.keterangan, pageWidth - (margin * 2));
            doc.text(keteranganLines, margin, yPos);
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

        doc.save(`Klaim-${klaim.nomor_klaim}.pdf`);
    };

    const handleExportExcel = () => {
        if (!klaim) return;

        try {
            exportKlaimDetailExcel(klaim);
            showToast('Excel detail Klaim berhasil diexport', 'success');
        } catch (error) {
            console.error('Error exporting Klaim Excel:', error);
            showToast('Gagal export Excel Klaim', 'error');
        }
    };

    const handleExportPDFModern = async () => {
        if (!klaim || isExportingPdf) return;

        try {
            setIsExportingPdf(true);
            await exportKlaimDetailPdf(klaim);
            showToast('PDF detail Klaim berhasil diexport', 'success');
        } catch (error) {
            console.error('Error exporting Klaim PDF:', error);
            showToast('Gagal export PDF Klaim', 'error');
        } finally {
            setIsExportingPdf(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg text-gray-600">Memuat data...</span>
                </div>
            </div>
        );
    }

    if (!klaim) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-gray-600 mb-4">Data tidak ditemukan</p>
                    <button
                        onClick={() => navigate('/klaim')}
                        className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    // Check if user can view confidential data
    if (klaim.is_confidential && !canViewConfidential) {
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
                        onClick={() => navigate('/klaim')}
                        className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
                    >
                        Kembali ke Daftar
                    </button>
                </div>
            </div>
        );
    }

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
          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            break-inside: avoid;
          }
        }
      `}</style>

            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between no-print">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate('/klaim')}
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Detail Klaim</h1>
                            <p className="text-sm text-gray-600 mt-1">{klaim.nomor_klaim}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
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
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isExportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            <span className="hidden sm:inline">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        >
                            <Printer className="w-5 h-5" />
                            <span className="hidden sm:inline">Print</span>
                        </button>
                    </div>
                </div>

                {/* Print Header */}
                <div className="hidden print:block mb-6">
                    <div className="text-center border-b-2 border-violet-600 pb-4 mb-6">
                        <h1 className="text-3xl font-bold text-violet-600">KLAIM REIMBURSEMENT</h1>
                        <p className="text-sm text-gray-600 mt-2">Prasasti Group</p>
                        <p className="text-xs text-gray-500 mt-1">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Nomor Klaim</p>
                                <p className="text-lg font-bold text-gray-800">{klaim.nomor_klaim}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Nomor QL</p>
                                <p className="text-lg font-bold text-gray-800"><QLLink ql={klaim.nomor_ql} linkClassName="text-violet-600" /></p>
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
                                <FileText className="w-5 h-5 text-violet-600" />
                                <span>Informasi Dasar</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">Nomor Klaim</label>
                                    <p className="text-base font-semibold text-gray-800">{klaim.nomor_klaim}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nomor QL</label>
                                    <p className="text-base font-semibold text-gray-800"><QLLink ql={klaim.nomor_ql} linkClassName="text-violet-600" /></p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Tanggal & Jam Pengajuan</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{klaim.created_at ? formatTanggalJam(klaim.created_at) : '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nama Karyawan</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span>{klaim.nama_karyawan || '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Tipe</label>
                                    <div className="mt-1">
                                        <TipeBadge tipe={klaim.tipe} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">ID Perusahaan</label>
                                    <div className="mt-1">
                                        <IdPerusahaanBadge idPerusahaan={klaim.id_perusahaan} />
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-sm text-gray-500">Nama Event/Project</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2 mt-1">
                                        <Briefcase className="w-4 h-4 text-gray-400" />
                                        <span>{klaim.nama_event || '-'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Card */}
                        {klaim.metode_pembayaran && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                                    {klaim.metode_pembayaran === 'Transfer' ? (
                                        <Banknote className="w-5 h-5 text-blue-600" />
                                    ) : (
                                        <Wallet className="w-5 h-5 text-emerald-600" />
                                    )}
                                    <span>Metode Pembayaran</span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-500">Metode</label>
                                        <p className="text-base font-semibold text-gray-800">{klaim.metode_pembayaran}</p>
                                    </div>
                                    {klaim.metode_pembayaran === 'Transfer' && (
                                        <>
                                            <div>
                                                <label className="text-sm text-gray-500">Nama Bank</label>
                                                <p className="text-base text-gray-800">{klaim.nama_bank || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Nomor Rekening</label>
                                                <p className="text-base font-mono text-gray-800">{klaim.nomor_rekening || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Nama Pemilik Rekening</label>
                                                <p className="text-base text-gray-800">{klaim.nama_pemilik_rekening || '-'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Detail Rincian Pengeluaran */}
                        {klaim.detail_pengeluaran && (() => {
                            try {
                                const items = typeof klaim.detail_pengeluaran === 'string'
                                    ? JSON.parse(klaim.detail_pengeluaran)
                                    : klaim.detail_pengeluaran;
                                if (Array.isArray(items) && items.length > 0) {
                                    return (
                                        <div className="card">
                                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                                                <FileText className="w-5 h-5 text-violet-600" />
                                                <span>Rincian Pengeluaran</span>
                                            </h2>
                                            <div className="space-y-3">
                                                {items.map((item, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                                                                <span className="text-sm font-semibold text-violet-600">{index + 1}</span>
                                                            </div>
                                                            <span className="text-gray-800 font-medium">{item.nama}</span>
                                                        </div>
                                                        <span className="font-semibold text-gray-800">Rp {formatRupiah(item.nominal || 0)}</span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-gray-200 pt-3 mt-3">
                                                    <div className="flex items-center justify-between bg-violet-100 p-4 rounded-lg">
                                                        <span className="font-bold text-violet-800">Total</span>
                                                        <span className="text-xl font-bold text-violet-800">
                                                            Rp {formatRupiah(items.reduce((sum, item) => sum + (parseInt(item.nominal) || 0), 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            } catch (e) {
                                return null;
                            }
                        })()}

                        {/* Keterangan */}
                        {klaim.keterangan && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Keterangan</h2>
                                <p className="text-gray-700 whitespace-pre-wrap">{klaim.keterangan}</p>
                            </div>
                        )}

                        {/* Lampiran */}
                        {klaim.lampiran && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Lampiran</h2>
                                {(() => {
                                    // Parse lampiran - could be JSON array or single URL string
                                    let lampiranList = [];
                                    try {
                                        if (typeof klaim.lampiran === 'string') {
                                            if (klaim.lampiran.startsWith('[')) {
                                                lampiranList = JSON.parse(klaim.lampiran);
                                            } else {
                                                lampiranList = [klaim.lampiran];
                                            }
                                        } else if (Array.isArray(klaim.lampiran)) {
                                            lampiranList = klaim.lampiran;
                                        }
                                    } catch (e) {
                                        lampiranList = [klaim.lampiran];
                                    }

                                    return (
                                        <div className="space-y-2">
                                            {lampiranList.map((url, index) => (
                                                <a
                                                    key={index}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center px-4 py-2 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors"
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
                        <div className="card bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
                            <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center space-x-2">
                                <DollarSign className="w-4 h-4" />
                                <span>Nominal</span>
                            </h2>
                            <p className="text-3xl font-bold text-violet-700">
                                Rp {formatRupiah(klaim.nominal || 0)}
                            </p>
                        </div>

                        {/* Status Cards */}
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-600 mb-3">Status</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500">Status Approval</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${getStatusBadgeClass(klaim.status_approval)}`}>
                                            {klaim.status_approval === 'Approved' && <CheckCircle className="w-4 h-4 mr-1" />}
                                            {klaim.status_approval === 'Rejected' && <XCircle className="w-4 h-4 mr-1" />}
                                            {klaim.status_approval === 'Manager Approved' ? 'Manager Approved' : (klaim.status_approval || 'Pending')}
                                        </span>
                                        <p className="text-[11px] text-gray-500 mt-1">{STAGE_LABEL[klaim.status_approval] || ''}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Disetujui Oleh</label>
                                    <p className="text-sm font-medium text-gray-800 mt-1">{klaim.head_finance_approved_by || klaim.manager_approved_by || klaim.nama_approver || klaim.disetujui_oleh || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Status Transfer</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${klaim.status_transfer === 'Sudah Transfer' ? 'bg-blue-100 text-blue-700' :
                                            ['Tidak Transfer', 'Reject', 'Rejected'].includes(klaim.status_transfer) ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {klaim.status_transfer || 'Belum Transfer'}
                                        </span>
                                    </div>
                                </div>
                                {klaim.bukti_transfer && (
                                    <div>
                                        <label className="text-xs text-gray-500">Bukti Transfer</label>
                                        <div className="mt-1">
                                            <a
                                                href={klaim.bukti_transfer}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors text-sm font-medium"
                                            >
                                                <FileText className="w-4 h-4" />
                                                <span>Lihat Bukti Transfer</span>
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Approval Actions Tahap 1: Manager */}
                        {canManagerApprove && (
                            <div className="card border-2 border-amber-200 bg-amber-50">
                                <h2 className="text-sm font-semibold text-amber-800 mb-1">Approval Manager (Tahap 1)</h2>
                                <p className="text-xs text-amber-700 mb-3">Menyetujui akan meneruskan ke Head Finance.</p>
                                <div className="space-y-2">
                                    <button
                                        onClick={showApproveModal}
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Approve Manager</span>
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

                        {/* Approval Actions Tahap 2: Head Finance */}
                        {canHeadApprove && (
                            <div className="card border-2 border-indigo-200 bg-indigo-50">
                                <h2 className="text-sm font-semibold text-indigo-800 mb-1">Approval Head Finance (Tahap 2)</h2>
                                <p className="text-xs text-indigo-700 mb-3">Sudah di-approve Manager. Menyetujui akan meneruskan ke Finance untuk transfer.</p>
                                <div className="space-y-2">
                                    <button
                                        onClick={showApproveModal}
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Approve Head Finance</span>
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

                        {/* Timeline SLA */}
                        <ApprovalTimeline record={klaim} transferLabel="Transfer Finance" />

                        {/* Transfer Actions for Team Finance */}
                        {canTransfer && klaim.status_approval === 'Approved' && klaim.status_transfer === 'Belum Transfer' && (
                            <div className="card border-2 border-violet-200 bg-violet-50">
                                <h2 className="text-sm font-semibold text-violet-800 mb-3">Aksi Transfer</h2>
                                <p className="text-xs text-violet-600 mb-3">
                                    Klaim ini sudah di-approve dan menunggu transfer
                                </p>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Upload Bukti Transfer</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Approval Modal Tahap 1 (Manager) */}
            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === 'approve'}
                onClose={closeModal}
                onConfirm={handleApprove}
                type="success"
                title="Approve Manager (Tahap 1)"
                message="Setujui sebagai Manager? Setelah ini diteruskan ke Head Finance."
                confirmText="Ya, Approve Manager"
                cancelText="Batal"
                isLoading={isApproving}
                details={
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nomor Klaim:</span>
                            <span className="font-semibold text-gray-800">{klaim?.nomor_klaim}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-green-600">Rp {formatRupiah(klaim?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{klaim?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

            {/* Approval Modal Tahap 2 (Head Finance) */}
            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === 'approve-head'}
                onClose={closeModal}
                onConfirm={handleApproveHead}
                type="success"
                title="Approve Head Finance (Tahap 2)"
                message="Setujui sebagai Head Finance? Setelah ini diteruskan ke Finance untuk transfer."
                confirmText="Ya, Approve Head Finance"
                cancelText="Batal"
                isLoading={isApproving}
                details={
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nomor Klaim:</span>
                            <span className="font-semibold text-gray-800">{klaim?.nomor_klaim}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-green-600">Rp {formatRupiah(klaim?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{klaim?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === 'reject'}
                onClose={closeModal}
                onConfirm={handleReject}
                type="danger"
                title="Tolak Klaim"
                message="Apakah Anda yakin ingin menolak Klaim ini?"
                confirmText="Ya, Tolak"
                cancelText="Batal"
                isLoading={isApproving}
                details={
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nomor Klaim:</span>
                            <span className="font-semibold text-gray-800">{klaim?.nomor_klaim}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-red-600">Rp {formatRupiah(klaim?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{klaim?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

            {/* Transfer Modal for Team Finance */}
            {showTransferModal && klaim && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-2xl">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Upload className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                                    <p className="text-sm text-white/80">{klaim.nomor_klaim}</p>
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
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500">Karyawan:</span>
                                        <p className="font-medium text-gray-800">{klaim.nama_karyawan || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Nominal:</span>
                                        <p className="font-semibold text-violet-600">Rp {formatRupiah(klaim.nominal || 0)}</p>
                                    </div>
                                </div>
                            </div>

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
                                    className={`px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

export default KlaimDetail;
