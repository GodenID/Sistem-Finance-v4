import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, Calendar, User, DollarSign, CheckCircle, XCircle, Banknote, Wallet, Download, FileSpreadsheet, Loader2, Upload, X, Briefcase } from 'lucide-react';
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
import { exportKasbonDetailExcel } from '../utils/detailExcelExport';
import { exportKasbonDetailPdf } from '../utils/detailPdfExport';

const KasbonDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { userName, userRole, userId, hasPermission } = useAuth();
    const { refreshNotifications } = useNotification();
    const [kasbon, setKasbon] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApproving, setIsApproving] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // Transfer states for team_finance
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [buktiTransferFile, setBuktiTransferFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Permission per-user (default mengikuti role, bisa dioverride Administrator)
    // Tahap 1 (Manager): Pending -> Manager Approved | Tahap 2 (Head Finance): Manager Approved -> Approved
    const canManagerApprove = kasbon?.status_approval === 'Pending' && (hasPermission
        ? (hasPermission('approve_manager') || hasPermission('approve'))
        : ['administrator', 'bod', 'manager'].includes(userRole));
    const canHeadApprove = kasbon?.status_approval === 'Manager Approved' && (hasPermission
        ? (hasPermission('approve_head_finance') || hasPermission('approve'))
        : ['administrator', 'head_finance'].includes(userRole));
    const canApprove = canManagerApprove || canHeadApprove;
    const canTransfer = hasPermission ? hasPermission('transfer') : userRole === 'team_finance';
    const canViewConfidential = hasPermission ? hasPermission('view_confidential') : ['administrator', 'bod', 'team_finance', 'hrd'].includes(userRole?.toLowerCase());

    useEffect(() => {
        const fetchKasbonDetail = async () => {
            try {
                setIsLoading(true);
                const data = await getRecordById('kasbon', id);
                setKasbon(data);
            } catch (error) {
                console.error('Error fetching kasbon detail:', error);
                showToast('Gagal memuat detail Kasbon', 'error');
                navigate('/kasbon');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchKasbonDetail();
        }
    }, [id, navigate, showToast]);

    const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID').format(angka);
    };

    const showApproveModal = () => setConfirmModal({ isOpen: true, type: canHeadApprove ? 'approve-head' : 'approve' });
    const showRejectModal = () => setConfirmModal({ isOpen: true, type: 'reject' });
    const closeModal = () => setConfirmModal({ isOpen: false, type: null });

    const handleApprove = async () => {
        if (!kasbon || !canManagerApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('kasbon', kasbon.id, {
                status_approval: 'Manager Approved',
                nama_approver: userName || 'Manager',
                manager_approved_by: userName || 'Manager',
                manager_approved_at: nowIso
            });
            await logActivity({
                tableName: 'kasbon',
                recordId: kasbon.id,
                recordNumber: kasbon.nomor_kasbon,
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
            const data = await getRecordById('kasbon', id);
            setKasbon(data);
        } catch (error) {
            console.error('Error approving:', error);
            showToast('Gagal menyetujui Kasbon', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const handleApproveHead = async () => {
        if (!kasbon || !canHeadApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('kasbon', kasbon.id, {
                status_approval: 'Approved',
                head_finance_approved_by: userName || 'Head Finance',
                head_finance_approved_at: nowIso
            });
            await logActivity({
                tableName: 'kasbon',
                recordId: kasbon.id,
                recordNumber: kasbon.nomor_kasbon,
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
            const data = await getRecordById('kasbon', id);
            setKasbon(data);
        } catch (error) {
            console.error('Error approving:', error);
            showToast('Gagal menyetujui Kasbon', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!kasbon || !canApprove) return;

        setIsApproving(true);
        const nowIso = new Date().toISOString();
        try {
            await updateRecord('kasbon', kasbon.id, {
                status_approval: 'Rejected',
                nama_approver: userName || 'Manager',
                rejected_by: userName || 'Manager',
                rejected_at: nowIso
            });
            await logActivity({
                tableName: 'kasbon',
                recordId: kasbon.id,
                recordNumber: kasbon.nomor_kasbon,
                action: 'reject',
                fieldChanged: 'status_approval',
                oldValue: kasbon.status_approval || 'Pending',
                newValue: 'Rejected',
                changedBy: userId,
                changedByName: userName
            });
            closeModal();
            showToast('Kasbon berhasil ditolak', 'success');
            refreshNotifications();
            const data = await getRecordById('kasbon', id);
            setKasbon(data);
        } catch (error) {
            console.error('Error rejecting:', error);
            showToast('Gagal menolak Kasbon', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    // Handle Transfer for team_finance
    const handleConfirmTransfer = async () => {
        if (!kasbon || !canTransfer || !buktiTransferFile) return;

        setIsUploading(true);
        try {
            // Upload lalu update — bila update gagal, file ikut dihapus (anti yatim)
            const { result } = await uploadThenSave(
                () => uploadFile(buktiTransferFile, 'kasbon', kasbon.nomor_kasbon),
                (uploadResult) => updateRecord('kasbon', kasbon.id, {
                    bukti_transfer: uploadResult.url,
                    status_transfer: 'Sudah Transfer',
                    transferred_at: new Date().toISOString()
                })
            );

            await logActivity({
                tableName: 'kasbon',
                recordId: kasbon.id,
                recordNumber: kasbon.nomor_kasbon,
                action: 'transfer',
                fieldChanged: 'status_transfer',
                oldValue: 'Belum Transfer',
                newValue: 'Sudah Transfer',
                changedBy: userId,
                changedByName: userName
            });

            await sendTransferNotification({
                tableName: 'kasbon',
                record: kasbon,
                amount: kasbon.nominal,
                proofUrl: result.url,
                transferredBy: userName,
                detailPath: `/kasbon/${kasbon.id}`
            });

            showToast('Bukti transfer berhasil diupload', 'success');
            setShowTransferModal(false);
            setBuktiTransferFile(null);
            refreshNotifications();

            const data = await getRecordById('kasbon', id);
            setKasbon(data);
        } catch (error) {
            console.error('Error uploading transfer:', error);
            showToast('Gagal mengupload bukti transfer', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleExportPDF = () => {
        if (!kasbon) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Colors - Emerald theme for Kasbon
        const primaryColor = [16, 185, 129]; // Emerald
        const grayColor = [107, 114, 128];
        const lightGrayColor = [243, 244, 246];

        // Header with background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Company Logo/Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('KASBON KARYAWAN', pageWidth / 2, 20, { align: 'center' });

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
        doc.text('Nomor Kasbon:', margin + 5, yPos + 10);
        doc.setFont(undefined, 'normal');
        doc.text(kasbon.nomor_kasbon || '-', margin + 45, yPos + 10);

        doc.setFont(undefined, 'bold');
        doc.text('Nomor QL:', margin + 5, yPos + 18);
        doc.setFont(undefined, 'normal');
        doc.text(kasbon.nomor_ql || '-', margin + 45, yPos + 18);

        // Status badges on the right
        const statusX = pageWidth - margin - 50;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);

        if (kasbon.status_approval === 'Approved') {
            doc.setFillColor(220, 252, 231);
            doc.setTextColor(22, 163, 74);
        } else if (kasbon.status_approval === 'Rejected') {
            doc.setFillColor(254, 226, 226);
            doc.setTextColor(220, 38, 38);
        } else {
            doc.setFillColor(254, 243, 199);
            doc.setTextColor(217, 119, 6);
        }
        doc.roundedRect(statusX, yPos + 5, 45, 7, 2, 2, 'F');
        doc.text(kasbon.status_approval || 'Pending', statusX + 22.5, yPos + 9.5, { align: 'center' });

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

        addField('Tanggal', kasbon.created_at ? new Date(kasbon.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-');
        addField('Nama Karyawan', kasbon.nama_karyawan || '-');
        addField('Tipe', kasbon.tipe || '-');
        addField('ID Perusahaan', kasbon.id_perusahaan || '-');
        addField('Nama Event/Project', kasbon.nama_event || '-');

        yPos += 5;

        // Section: Metode Pembayaran
        if (kasbon.metode_pembayaran) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('METODE PEMBAYARAN', margin, yPos);
            doc.setDrawColor(...primaryColor);
            doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

            yPos += 10;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);

            addField('Metode', kasbon.metode_pembayaran || '-');
            if (kasbon.metode_pembayaran === 'Transfer') {
                addField('Nama Bank', kasbon.nama_bank || '-');
                addField('No. Rekening', kasbon.nomor_rekening || '-');
                addField('Pemilik Rek.', kasbon.nama_pemilik_rekening || '-');
            }

            yPos += 5;
        }

        // Section: Nominal (Highlighted Box)
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(1);
        doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 20, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...grayColor);
        doc.text('NOMINAL', margin + 5, yPos + 8);

        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text(`Rp ${formatRupiah(kasbon.nominal || 0)}`, margin + 5, yPos + 16);

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

        addField('Status Approval', kasbon.status_approval || 'Pending');
        addField('Disetujui Manager', kasbon.manager_approved_by || kasbon.nama_approver || '-');
        addField('Disetujui Head Finance', kasbon.head_finance_approved_by || '-');
        addField('Status Transfer', kasbon.status_transfer || 'Belum Transfer');

        // Section: Keterangan
        if (kasbon.keterangan) {
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

            const keteranganLines = doc.splitTextToSize(kasbon.keterangan, pageWidth - (margin * 2));
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

        doc.save(`Kasbon-${kasbon.nomor_kasbon}.pdf`);
    };

    const handleExportExcel = () => {
        if (!kasbon) return;

        try {
            exportKasbonDetailExcel(kasbon);
            showToast('Excel detail Kasbon berhasil diexport', 'success');
        } catch (error) {
            console.error('Error exporting Kasbon Excel:', error);
            showToast('Gagal export Excel Kasbon', 'error');
        }
    };

    const handleExportPDFModern = async () => {
        if (!kasbon || isExportingPdf) return;

        try {
            setIsExportingPdf(true);
            await exportKasbonDetailPdf(kasbon);
            showToast('PDF detail Kasbon berhasil diexport', 'success');
        } catch (error) {
            console.error('Error exporting Kasbon PDF:', error);
            showToast('Gagal export PDF Kasbon', 'error');
        } finally {
            setIsExportingPdf(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg text-gray-600">Memuat data...</span>
                </div>
            </div>
        );
    }

    if (!kasbon) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-gray-600 mb-4">Data tidak ditemukan</p>
                    <button
                        onClick={() => navigate('/kasbon')}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    // Check if user can view confidential data
    if (kasbon.is_confidential && !canViewConfidential) {
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
                        onClick={() => navigate('/kasbon')}
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
                            onClick={() => navigate('/kasbon')}
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Detail Kasbon</h1>
                            <p className="text-sm text-gray-600 mt-1">{kasbon.nomor_kasbon}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportExcel}
                            className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors flex items-center space-x-2"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                            <span className="hidden sm:inline">Export Excel</span>
                        </button>
                        <button
                            onClick={handleExportPDFModern}
                            disabled={isExportingPdf}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <div className="text-center border-b-2 border-emerald-600 pb-4 mb-6">
                        <h1 className="text-3xl font-bold text-emerald-600">KASBON KARYAWAN</h1>
                        <p className="text-sm text-gray-600 mt-2">Prasasti Group</p>
                        <p className="text-xs text-gray-500 mt-1">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Nomor Kasbon</p>
                                <p className="text-lg font-bold text-gray-800">{kasbon.nomor_kasbon}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Nomor QL</p>
                                <p className="text-lg font-bold text-gray-800"><QLLink ql={kasbon.nomor_ql} linkClassName="text-emerald-600" /></p>
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
                                <FileText className="w-5 h-5 text-emerald-600" />
                                <span>Informasi Dasar</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">Nomor Kasbon</label>
                                    <p className="text-base font-semibold text-gray-800">{kasbon.nomor_kasbon}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nomor QL</label>
                                    <p className="text-base font-semibold text-gray-800"><QLLink ql={kasbon.nomor_ql} linkClassName="text-emerald-600" /></p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Tanggal & Jam Pengajuan</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{kasbon.created_at ? formatTanggalJam(kasbon.created_at) : '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nama Karyawan</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span>{kasbon.nama_karyawan || '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Tipe</label>
                                    <div className="mt-1">
                                        <TipeBadge tipe={kasbon.tipe} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">ID Perusahaan</label>
                                    <div className="mt-1">
                                        <IdPerusahaanBadge idPerusahaan={kasbon.id_perusahaan} />
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-sm text-gray-500">Nama Event/Project</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2 mt-1">
                                        <Briefcase className="w-4 h-4 text-gray-400" />
                                        <span>{kasbon.nama_event || '-'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Card */}
                        {kasbon.metode_pembayaran && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                                    {kasbon.metode_pembayaran === 'Transfer' ? (
                                        <Banknote className="w-5 h-5 text-blue-600" />
                                    ) : (
                                        <Wallet className="w-5 h-5 text-emerald-600" />
                                    )}
                                    <span>Metode Pembayaran</span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-500">Metode</label>
                                        <p className="text-base font-semibold text-gray-800">{kasbon.metode_pembayaran}</p>
                                    </div>
                                    {kasbon.metode_pembayaran === 'Transfer' && (
                                        <>
                                            <div>
                                                <label className="text-sm text-gray-500">Nama Bank</label>
                                                <p className="text-base text-gray-800">{kasbon.nama_bank || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Nomor Rekening</label>
                                                <p className="text-base font-mono text-gray-800">{kasbon.nomor_rekening || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Nama Pemilik Rekening</label>
                                                <p className="text-base text-gray-800">{kasbon.nama_pemilik_rekening || '-'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Keterangan */}
                        {kasbon.keterangan && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Keterangan</h2>
                                <p className="text-gray-700 whitespace-pre-wrap">{kasbon.keterangan}</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Nominal Card */}
                        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                            <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center space-x-2">
                                <DollarSign className="w-4 h-4" />
                                <span>Nominal</span>
                            </h2>
                            <p className="text-3xl font-bold text-emerald-700">
                                Rp {formatRupiah(kasbon.nominal || 0)}
                            </p>
                        </div>

                        {/* Status Cards */}
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-600 mb-3">Status</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500">Status Approval</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${getStatusBadgeClass(kasbon.status_approval)}`}>
                                            {kasbon.status_approval === 'Approved' && <CheckCircle className="w-4 h-4 mr-1" />}
                                            {kasbon.status_approval === 'Rejected' && <XCircle className="w-4 h-4 mr-1" />}
                                            {kasbon.status_approval === 'Manager Approved' ? 'Manager Approved' : (kasbon.status_approval || 'Pending')}
                                        </span>
                                        <p className="text-[11px] text-gray-500 mt-1">{STAGE_LABEL[kasbon.status_approval] || ''}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Disetujui Manager</label>
                                    <p className="text-sm font-medium text-gray-800 mt-1">{kasbon.manager_approved_by || kasbon.nama_approver || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Disetujui Head Finance</label>
                                    <p className="text-sm font-medium text-gray-800 mt-1">{kasbon.head_finance_approved_by || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Status Transfer</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${kasbon.status_transfer === 'Sudah Transfer' ? 'bg-blue-100 text-blue-700' :
                                            ['Tidak Transfer', 'Reject', 'Rejected'].includes(kasbon.status_transfer) ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {kasbon.status_transfer || 'Belum Transfer'}
                                        </span>
                                    </div>
                                </div>
                                {kasbon.bukti_transfer && (
                                    <div>
                                        <label className="text-xs text-gray-500">Bukti Transfer</label>
                                        <div className="mt-1">
                                            <a
                                                href={kasbon.bukti_transfer}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
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
                        <ApprovalTimeline record={kasbon} transferLabel="Transfer Finance" />

                        {/* Transfer Actions for Team Finance */}
                        {canTransfer && kasbon.status_approval === 'Approved' && kasbon.status_transfer === 'Belum Transfer' && (
                            <div className="card border-2 border-emerald-200 bg-emerald-50">
                                <h2 className="text-sm font-semibold text-emerald-800 mb-3">Aksi Transfer</h2>
                                <p className="text-xs text-emerald-600 mb-3">
                                    Kasbon ini sudah di-approve dan menunggu transfer
                                </p>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
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
                            <span className="text-gray-500">Nomor Kasbon:</span>
                            <span className="font-semibold text-gray-800">{kasbon?.nomor_kasbon}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-green-600">Rp {formatRupiah(kasbon?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{kasbon?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

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
                            <span className="text-gray-500">Nomor Kasbon:</span>
                            <span className="font-semibold text-gray-800">{kasbon?.nomor_kasbon}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-green-600">Rp {formatRupiah(kasbon?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{kasbon?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === 'reject'}
                onClose={closeModal}
                onConfirm={handleReject}
                type="danger"
                title="Tolak Kasbon"
                message="Apakah Anda yakin ingin menolak Kasbon ini?"
                confirmText="Ya, Tolak"
                cancelText="Batal"
                isLoading={isApproving}
                details={
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nomor Kasbon:</span>
                            <span className="font-semibold text-gray-800">{kasbon?.nomor_kasbon}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nominal:</span>
                            <span className="font-semibold text-red-600">Rp {formatRupiah(kasbon?.nominal || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nama Karyawan:</span>
                            <span className="font-medium text-gray-800">{kasbon?.nama_karyawan || '-'}</span>
                        </div>
                    </div>
                }
            />

            {/* Transfer Modal for Team Finance */}
            {showTransferModal && kasbon && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-t-2xl">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Upload className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Upload Bukti Transfer</h3>
                                    <p className="text-sm text-white/80">{kasbon.nomor_kasbon}</p>
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
                                        <p className="font-medium text-gray-800">{kasbon.nama_karyawan || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Nominal:</span>
                                        <p className="font-semibold text-emerald-600">Rp {formatRupiah(kasbon.nominal || 0)}</p>
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
                                    className={`px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center space-x-2 ${(!buktiTransferFile || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

export default KasbonDetail;
