import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, Calendar, User, DollarSign, CheckCircle, XCircle, Wallet, Eye, Download } from 'lucide-react';
import { getRecordById, updateRecord } from '../lib/api';
import { logActivity } from '../lib/auditLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';
import ConfirmDialog from '../components/ConfirmDialog';
import jsPDF from 'jspdf';

const PenyelesaianDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { userRole, userId, userName } = useAuth();
    const { refreshNotifications } = useNotification();
    const isFinance = userRole === 'team_finance';
    const [penyelesaian, setPenyelesaian] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        type: 'warning',
        title: '',
        message: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        const fetchPenyelesaianDetail = async () => {
            try {
                setIsLoading(true);
                const data = await getRecordById('penyelesaian', id);
                setPenyelesaian(data);
            } catch (error) {
                console.error('Error fetching penyelesaian detail:', error);
                showToast('Gagal memuat detail Penyelesaian', 'error');
                navigate('/penyelesaian');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchPenyelesaianDetail();
        }
    }, [id, navigate, showToast]);

    const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID').format(angka);
    };

    // Refetch function
    const refetchPenyelesaian = useCallback(async () => {
        try {
            const data = await getRecordById('penyelesaian', id);
            setPenyelesaian(data);
        } catch (error) {
            console.error('Error refetching penyelesaian:', error);
        }
    }, [id]);

    // Handle Mark as Selesai - Only for Finance
    const handleMarkSelesai = () => {
        setConfirmDialog({
            isOpen: true,
            type: 'success',
            title: 'Tandai Selesai',
            message: `Apakah Anda yakin ingin menandai Penyelesaian "${penyelesaian.nomor_penyelesaian}" sebagai Selesai?`,
            onConfirm: async () => {
                try {
                    await updateRecord('penyelesaian', penyelesaian.id, {
                        status_penyelesaian: 'Selesai'
                    });

                    // Log activity
                    await logActivity({
                        tableName: 'penyelesaian',
                        recordId: penyelesaian.id,
                        recordNumber: penyelesaian.nomor_penyelesaian,
                        action: 'complete',
                        fieldChanged: 'status_penyelesaian',
                        oldValue: 'Belum Selesai',
                        newValue: 'Selesai',
                        changedBy: userId,
                        changedByName: userName
                    });

                    showToast('Penyelesaian berhasil ditandai selesai', 'success');
                    await refetchPenyelesaian();
                    refreshNotifications();
                } catch (error) {
                    console.error('Error marking penyelesaian as complete:', error);
                    showToast('Gagal menandai Penyelesaian sebagai selesai', 'error');
                }
            }
        });
    };

    const handleExportPDF = () => {
        if (!penyelesaian) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Colors - Amber theme for Penyelesaian
        const primaryColor = [217, 119, 6]; // Amber
        const grayColor = [107, 114, 128];
        const lightGrayColor = [243, 244, 246];

        // Header with background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Company Logo/Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('PENYELESAIAN KASBON', pageWidth / 2, 20, { align: 'center' });

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

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('No. Penyelesaian:', margin + 5, yPos + 10);
        doc.setFont(undefined, 'normal');
        doc.text(penyelesaian.nomor_penyelesaian || '-', margin + 48, yPos + 10);

        doc.setFont(undefined, 'bold');
        doc.text('No. Kasbon:', margin + 5, yPos + 18);
        doc.setFont(undefined, 'normal');
        doc.text(penyelesaian.nomor_kasbon || '-', margin + 48, yPos + 18);

        // Status badges on the right
        const statusX = pageWidth - margin - 50;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);

        if (penyelesaian.status_approval === 'Approved') {
            doc.setFillColor(220, 252, 231);
            doc.setTextColor(22, 163, 74);
        } else if (penyelesaian.status_approval === 'Rejected') {
            doc.setFillColor(254, 226, 226);
            doc.setTextColor(220, 38, 38);
        } else {
            doc.setFillColor(254, 243, 199);
            doc.setTextColor(217, 119, 6);
        }
        doc.roundedRect(statusX, yPos + 5, 45, 7, 2, 2, 'F');
        doc.text(penyelesaian.status_approval || 'Pending', statusX + 22.5, yPos + 9.5, { align: 'center' });

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
                doc.text(value, margin + 55, yPos);
            }
            yPos += 7;
        };

        addField('Tanggal', penyelesaian.created_at ? new Date(penyelesaian.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-');
        addField('Nama Karyawan', penyelesaian.nama_karyawan || '-');
        addField('Nomor QL', penyelesaian.nomor_ql || '-');
        addField('Nominal Kasbon', `Rp ${formatRupiah(penyelesaian.kasbon_nominal || 0)}`);

        yPos += 5;

        // Section: Detail Pengeluaran
        if (penyelesaian.detail_pengeluaran && penyelesaian.detail_pengeluaran.length > 0) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('DETAIL PENGELUARAN', margin, yPos);
            doc.setDrawColor(...primaryColor);
            doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

            yPos += 10;

            // Table header
            const tableStartX = margin;
            const tableWidth = pageWidth - (margin * 2);
            const colNoWidth = 15;
            const colNominalWidth = 45;
            const colDeskripsiWidth = tableWidth - colNoWidth - colNominalWidth;
            const rowHeight = 8;

            // Header row background
            doc.setFillColor(...primaryColor);
            doc.rect(tableStartX, yPos - 5, tableWidth, rowHeight, 'F');

            // Header text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('No', tableStartX + 2, yPos);
            doc.text('Deskripsi', tableStartX + colNoWidth + 2, yPos);
            doc.text('Nominal', tableStartX + tableWidth - 2, yPos, { align: 'right' });

            yPos += rowHeight - 2;

            // Table rows
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');

            penyelesaian.detail_pengeluaran.forEach((item, index) => {
                // Alternating row background
                if (index % 2 === 0) {
                    doc.setFillColor(255, 251, 235); // Light amber
                } else {
                    doc.setFillColor(255, 255, 255); // White
                }
                doc.rect(tableStartX, yPos - 5, tableWidth, rowHeight, 'F');

                // Row border
                doc.setDrawColor(229, 231, 235); // Gray-200
                doc.setLineWidth(0.3);
                doc.line(tableStartX, yPos + 3, tableStartX + tableWidth, yPos + 3); // Bottom line

                // Row content
                doc.setTextColor(0, 0, 0);
                doc.text(`${index + 1}`, tableStartX + 2, yPos);

                // Truncate description if too long
                const maxDeskripsiWidth = colDeskripsiWidth - 4;
                let deskripsi = item.deskripsi || '-';
                while (doc.getTextWidth(deskripsi) > maxDeskripsiWidth && deskripsi.length > 3) {
                    deskripsi = deskripsi.slice(0, -4) + '...';
                }
                doc.text(deskripsi, tableStartX + colNoWidth + 2, yPos);
                doc.text(`Rp ${formatRupiah(item.nominal)}`, tableStartX + tableWidth - 2, yPos, { align: 'right' });

                yPos += rowHeight;
            });

            // Table outer border
            doc.setDrawColor(...primaryColor);
            doc.setLineWidth(0.5);
            const tableHeight = (penyelesaian.detail_pengeluaran.length + 1) * rowHeight;
            doc.rect(tableStartX, yPos - tableHeight - 2, tableWidth, tableHeight, 'S');

            // Vertical lines
            doc.line(tableStartX + colNoWidth, yPos - tableHeight - 2, tableStartX + colNoWidth, yPos - 2);
            doc.line(tableStartX + colNoWidth + colDeskripsiWidth, yPos - tableHeight - 2, tableStartX + colNoWidth + colDeskripsiWidth, yPos - 2);

            yPos += 8;
        }

        // Section: Nominal Summary (Highlighted Box)
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(1);
        doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...grayColor);
        doc.text('TOTAL PENGELUARAN', margin + 5, yPos + 8);
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text(`Rp ${formatRupiah(penyelesaian.total_pengeluaran || 0)}`, margin + 5, yPos + 15);

        doc.setFontSize(10);
        doc.setTextColor(...grayColor);
        doc.text('SELISIH', margin + 5, yPos + 24);
        const selisihColor = penyelesaian.status_selisih === 'Pas' ? [22, 163, 74] :
            penyelesaian.status_selisih === 'Pengembalian' ? [37, 99, 235] : [217, 119, 6];
        doc.setFontSize(14);
        doc.setTextColor(...selisihColor);
        doc.text(`Rp ${formatRupiah(Math.abs(penyelesaian.selisih || 0))} (${penyelesaian.status_selisih || '-'})`, margin + 5, yPos + 31);

        yPos += 45;

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

        addField('Status Approval', penyelesaian.status_approval || 'Pending');
        addField('Disetujui Oleh', penyelesaian.nama_approver || '-');
        addField('Status Penyelesaian', penyelesaian.status_penyelesaian || 'Belum Selesai');
        if (penyelesaian.metode_pengembalian) {
            addField('Metode Pengembalian', penyelesaian.metode_pengembalian);
        }

        // Section: Keterangan
        if (penyelesaian.keterangan) {
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

            const keteranganLines = doc.splitTextToSize(penyelesaian.keterangan, pageWidth - (margin * 2));
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

        doc.save(`Penyelesaian-${penyelesaian.nomor_penyelesaian}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg text-gray-600">Memuat data...</span>
                </div>
            </div>
        );
    }

    if (!penyelesaian) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-gray-600 mb-4">Data tidak ditemukan</p>
                    <button
                        onClick={() => navigate('/penyelesaian')}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                        Kembali
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
                            onClick={() => navigate('/penyelesaian')}
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Detail Penyelesaian</h1>
                            <p className="text-sm text-gray-600 mt-1">{penyelesaian.nomor_penyelesaian}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportPDF}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2"
                        >
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline">Export PDF</span>
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
                    <div className="text-center border-b-2 border-amber-600 pb-4 mb-6">
                        <h1 className="text-3xl font-bold text-amber-600">PENYELESAIAN KASBON</h1>
                        <p className="text-sm text-gray-600 mt-2">Prasasti Group</p>
                        <p className="text-xs text-gray-500 mt-1">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Nomor Penyelesaian</p>
                                <p className="text-lg font-bold text-gray-800">{penyelesaian.nomor_penyelesaian}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Nomor Kasbon</p>
                                <p className="text-lg font-bold text-gray-800">{penyelesaian.nomor_kasbon || '-'}</p>
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
                                <FileText className="w-5 h-5 text-amber-600" />
                                <span>Informasi Dasar</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">Nomor Penyelesaian</label>
                                    <p className="text-base font-semibold text-gray-800">{penyelesaian.nomor_penyelesaian}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nomor Kasbon</label>
                                    <p className="text-base font-semibold text-gray-800">{penyelesaian.nomor_kasbon || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nomor QL</label>
                                    <p className="text-base font-semibold text-gray-800">{penyelesaian.nomor_ql || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Tanggal</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{penyelesaian.created_at ? new Date(penyelesaian.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nama Karyawan</label>
                                    <p className="text-base text-gray-800 flex items-center space-x-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span>{penyelesaian.nama_karyawan || '-'}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nominal Kasbon</label>
                                    <p className="text-base font-semibold text-gray-800">Rp {formatRupiah(penyelesaian.kasbon_nominal || 0)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Detail Pengeluaran */}
                        {penyelesaian.detail_pengeluaran && penyelesaian.detail_pengeluaran.length > 0 && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Detail Pengeluaran</h2>
                                <div className="space-y-3">
                                    {penyelesaian.detail_pengeluaran.map((item, index) => (
                                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-base font-semibold text-gray-800">{item.deskripsi}</p>
                                                    <p className="text-xs text-gray-500 mt-1">#{index + 1}</p>
                                                </div>
                                                <p className="text-base font-bold text-gray-900">Rp {formatRupiah(item.nominal)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Keterangan */}
                        {penyelesaian.keterangan && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Keterangan</h2>
                                <p className="text-gray-700 whitespace-pre-wrap">{penyelesaian.keterangan}</p>
                            </div>
                        )}

                        {/* Lampiran */}
                        {penyelesaian.lampiran && (
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Lampiran</h2>
                                <a
                                    href={penyelesaian.lampiran}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Lihat Lampiran
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Total Pengeluaran Card */}
                        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                            <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center space-x-2">
                                <DollarSign className="w-4 h-4" />
                                <span>Total Pengeluaran</span>
                            </h2>
                            <p className="text-3xl font-bold text-blue-700">
                                Rp {formatRupiah(penyelesaian.total_pengeluaran || 0)}
                            </p>
                        </div>

                        {/* Selisih Card */}
                        <div className={`card ${penyelesaian.status_selisih === 'Pas' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' :
                            penyelesaian.status_selisih === 'Pengembalian' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' :
                                'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
                            }`}>
                            <h2 className="text-sm font-semibold text-gray-600 mb-2">Selisih</h2>
                            <p className={`text-3xl font-bold ${penyelesaian.status_selisih === 'Pas' ? 'text-emerald-700' :
                                penyelesaian.status_selisih === 'Pengembalian' ? 'text-blue-700' :
                                    'text-amber-700'
                                }`}>
                                Rp {formatRupiah(Math.abs(penyelesaian.selisih || 0))}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                                Status: <span className="font-semibold">{penyelesaian.status_selisih || '-'}</span>
                            </p>
                            {penyelesaian.metode_pengembalian && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Metode: <span className="font-semibold">{penyelesaian.metode_pengembalian}</span>
                                </p>
                            )}
                        </div>

                        {/* Status Cards */}
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-600 mb-3">Status</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500">Status Approval</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${penyelesaian.status_approval === 'Approved' ? 'bg-green-100 text-green-700' :
                                            penyelesaian.status_approval === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {penyelesaian.status_approval === 'Approved' && <CheckCircle className="w-4 h-4 mr-1" />}
                                            {penyelesaian.status_approval === 'Rejected' && <XCircle className="w-4 h-4 mr-1" />}
                                            {penyelesaian.status_approval || 'Pending'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Disetujui Oleh</label>
                                    <p className="text-sm font-medium text-gray-800 mt-1">{penyelesaian.nama_approver || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Status Penyelesaian</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${penyelesaian.status_penyelesaian === 'Selesai' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                            }`}>
                                            {penyelesaian.status_penyelesaian || 'Belum Selesai'}
                                        </span>
                                    </div>
                                </div>

                                {/* Tombol Selesai untuk Finance */}
                                {isFinance && penyelesaian.status_approval === 'Approved' && penyelesaian.status_penyelesaian !== 'Selesai' && (
                                    <div className="pt-3 border-t border-gray-200">
                                        <button
                                            onClick={handleMarkSelesai}
                                            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            <span>Tandai Selesai</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                type={confirmDialog.type}
                title={confirmDialog.title}
                message={confirmDialog.message}
            />
        </>
    );
};

export default PenyelesaianDetail;
