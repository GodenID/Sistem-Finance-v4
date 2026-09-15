import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';

const PAGE = {
  marginX: 16,
  top: 18,
  bottom: 18
};

const THEME = {
  blue: { primary: [37, 99, 235], soft: [239, 246, 255], text: [30, 64, 175] },
  emerald: { primary: [5, 150, 105], soft: [236, 253, 245], text: [4, 120, 87] },
  violet: { primary: [124, 58, 237], soft: [245, 243, 255], text: [109, 40, 217] },
  amber: { primary: [217, 119, 6], soft: [255, 251, 235], text: [180, 83, 9] }
};

const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL;
const activeExports = new Set();

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRupiah = (value) => {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const parseArrayField = (value) => {
  const parsed = parseMaybeJson(value);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
};

const normalizeText = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
    return JSON.stringify(parsed);
  }
  return String(parsed);
};

const normalizeUrl = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.url || item.file_url || item.href || item.path || null;
  }
  return null;
};

const getAttachmentName = (url, fallback) => {
  try {
    const parsed = new URL(url);
    const rawName = decodeURIComponent(parsed.pathname.split('/').pop() || fallback);
    return rawName || fallback;
  } catch {
    return String(url).split('/').pop() || fallback;
  }
};

const getExtension = (url) => {
  const cleanUrl = String(url || '').split('?')[0].toLowerCase();
  return cleanUrl.includes('.') ? cleanUrl.split('.').pop() : '';
};

const classifyAttachment = (url, contentType = '') => {
  const ext = getExtension(url);
  const type = contentType.toLowerCase();

  if (type.includes('pdf') || ext === 'pdf') return 'pdf';
  if (type.includes('png') || ext === 'png') return 'png';
  if (type.includes('jpeg') || type.includes('jpg') || ['jpg', 'jpeg'].includes(ext)) return 'jpg';
  if (type.startsWith('image/') || ['gif', 'webp', 'bmp'].includes(ext)) return 'image';
  return 'other';
};

const getProxyUrl = (url) => {
  if (!R2_WORKER_URL) return null;

  try {
    const source = new URL(url);
    const proxyBase = new URL(R2_WORKER_URL);
    proxyBase.pathname = source.pathname;
    proxyBase.search = '';
    return proxyBase.toString();
  } catch {
    return null;
  }
};

const getAttachmentFetchUrls = (url) => {
  const proxyUrl = getProxyUrl(url);
  return [proxyUrl, url].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index);
};

const collectRecordAttachments = (record) => {
  const rows = [];

  Object.entries(record || {}).forEach(([key, value]) => {
    if (!/(lampiran|bukti)/i.test(key) || !value) return;

    parseArrayField(value).forEach((item) => {
      const url = normalizeUrl(item);
      if (!url) return;

      rows.push({
        label: key.replace(/_/g, ' '),
        url,
        name: getAttachmentName(url, `${key}-${rows.length + 1}`)
      });
    });
  });

  return rows;
};

const safeFileName = (name) => {
  return String(name || 'detail')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const downloadBytes = (bytes, fileName) => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const convertImageBytesToPng = (bytes, contentType = 'image/*') => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          if (!pngBlob) {
            reject(new Error('Gagal konversi gambar ke PNG'));
            return;
          }
          pngBlob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/png');
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membaca gambar'));
    };

    image.src = url;
  });
};

const imageInfoFromBytes = async (pdf, attachment) => {
  if (attachment.kind === 'png') {
    return pdf.embedPng(attachment.bytes);
  }
  if (attachment.kind === 'jpg') {
    return pdf.embedJpg(attachment.bytes);
  }

  const pngBytes = await convertImageBytesToPng(attachment.bytes, attachment.contentType);
  return pdf.embedPng(pngBytes);
};

const fetchAttachment = async (attachment) => {
  let lastError = null;

  for (const fetchUrl of getAttachmentFetchUrls(attachment.url)) {
    try {
      const response = await fetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      const kind = classifyAttachment(attachment.url, contentType);

      if (!['pdf', 'png', 'jpg', 'image'].includes(kind)) {
        return {
          ...attachment,
          kind,
          status: 'Belum digabung',
          note: 'Format file tidak bisa dirender otomatis ke halaman PDF',
          bytes: null
        };
      }

      return {
        ...attachment,
        kind,
        status: 'Masuk PDF',
        note: kind === 'pdf' ? 'PDF lampiran digabung' : 'Gambar lampiran ditambahkan sebagai halaman',
        bytes,
        contentType,
        fetchedFrom: fetchUrl
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ...attachment,
    kind: classifyAttachment(attachment.url),
    status: 'Belum digabung',
    note: `Tidak bisa mengambil file lampiran: ${lastError?.message || 'unknown error'}`,
    bytes: null
  };
};

const prepareAttachments = async (record) => {
  const attachments = collectRecordAttachments(record);
  return Promise.all(attachments.map(fetchAttachment));
};

const drawHeader = (doc, config, theme) => {
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...theme.primary);
  doc.roundedRect(PAGE.marginX, PAGE.top, width - PAGE.marginX * 2, 31, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(config.title, PAGE.marginX + 8, PAGE.top + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Prasasti Group', PAGE.marginX + 8, PAGE.top + 21);
  doc.text(`Export: ${formatDateTime(new Date())}`, PAGE.marginX + 8, PAGE.top + 27);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(config.documentNumber || '-', width - PAGE.marginX - 8, PAGE.top + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(config.status || '-', width - PAGE.marginX - 8, PAGE.top + 22, { align: 'right' });
};

const drawFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(PAGE.marginX, height - 12, width - PAGE.marginX, height - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated by Finance Prasasti Group', PAGE.marginX, height - 7);
    doc.text(`Halaman ${page} dari ${pageCount}`, width - PAGE.marginX, height - 7, { align: 'right' });
  }
};

const addInfoTable = (doc, y, title, rows, theme) => {
  autoTable(doc, {
    startY: y,
    head: [[title, '']],
    body: rows.map(([label, value]) => [label, normalizeText(value)]),
    theme: 'grid',
    margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.bottom },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
      valign: 'top'
    },
    headStyles: {
      fillColor: theme.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', textColor: [75, 85, 99] },
      1: { cellWidth: 'auto', textColor: [17, 24, 39] }
    }
  });

  return doc.lastAutoTable.finalY + 8;
};

const parseExpenseItems = (detailPengeluaran) => {
  const parsed = parseArrayField(detailPengeluaran);
  return parsed.filter((item) => item && typeof item === 'object');
};

const addExpenseTable = (doc, y, items, theme, title = 'Detail Pengeluaran') => {
  if (!items.length) return y;

  const total = items.reduce((sum, item) => sum + Number(item.nominal || 0), 0);
  const body = [
    ...items.map((item, index) => [
      index + 1,
      item.deskripsi || item.nama || '-',
      formatRupiah(item.nominal)
    ]),
    ['', 'Total', formatRupiah(total)]
  ];

  autoTable(doc, {
    startY: y,
    head: [['No', 'Deskripsi', 'Nominal']],
    body,
    theme: 'striped',
    margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.bottom },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: theme.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 44, halign: 'right' }
    },
    didParseCell: (data) => {
      const isTotalRow = data.section === 'body' && data.row.index === body.length - 1;
      if (isTotalRow) {
        data.cell.styles.fillColor = theme.soft;
        data.cell.styles.textColor = theme.text;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber === 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...theme.text);
        doc.text(title, PAGE.marginX, y - 5);
      }
    }
  });

  return doc.lastAutoTable.finalY + 8;
};

const addAttachmentTable = (doc, y, attachments, theme) => {
  const pendingAttachments = attachments.filter((item) => !item.bytes);
  if (!pendingAttachments.length) return y;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Lampiran', 'Jenis', 'Status', 'Catatan']],
    body: pendingAttachments.map((item, index) => [
      index + 1,
      item.label,
      item.kind?.toUpperCase() || '-',
      item.status,
      item.note
    ]),
    theme: 'grid',
    margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.bottom },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: theme.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 24 },
      4: { cellWidth: 'auto' }
    }
  });

  return doc.lastAutoTable.finalY + 8;
};

const createBasePdf = ({ config, record, sections, finalSummary = null, expenses = [], attachments = [] }) => {
  const theme = THEME[config.color] || THEME.blue;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  drawHeader(doc, config, theme);
  let y = PAGE.top + 42;

  sections.forEach((section) => {
    y = addInfoTable(doc, y, section.title, section.rows, theme);
  });

  if (expenses.length) {
    y += 6;
    y = addExpenseTable(doc, y + 5, expenses, theme);
  }

  if (record.keterangan) {
    y = addInfoTable(doc, y, 'Keterangan', [['Keterangan', record.keterangan]], theme);
  }

  if (finalSummary?.rows?.length) {
    y = addInfoTable(doc, y, finalSummary.title || 'Total', finalSummary.rows, theme);
  }

  y = addAttachmentTable(doc, y, attachments, theme);

  drawFooter(doc);
  return doc.output('arraybuffer');
};

const appendAttachmentsToPdf = async (basePdfBytes, attachments) => {
  const mainPdf = await PDFDocument.load(basePdfBytes);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;

  for (const attachment of attachments) {
    if (!attachment.bytes || !['pdf', 'png', 'jpg', 'image'].includes(attachment.kind)) continue;

    try {
      if (attachment.kind === 'pdf') {
        const attachmentPdf = await PDFDocument.load(attachment.bytes);
        const pages = await mainPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
        pages.forEach((page) => mainPdf.addPage(page));
      } else {
        const page = mainPdf.addPage([pageWidth, pageHeight]);
        const image = await imageInfoFromBytes(mainPdf, attachment);
        const dims = image.scale(1);
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2 - 26;
        const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height, 1);
        const drawWidth = dims.width * scale;
        const drawHeight = dims.height * scale;

        page.drawText(attachment.name || attachment.label || 'Lampiran', {
          x: margin,
          y: pageHeight - margin,
          size: 11
        });
        page.drawImage(image, {
          x: (pageWidth - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2 - 10,
          width: drawWidth,
          height: drawHeight
        });
      }
    } catch {
      // The attachment is already listed in the base PDF. Skip failed merge pages.
    }
  }

  return mainPdf.save();
};

const exportDetailPdf = async (payload) => {
  const fileName = safeFileName(`${payload.config.filePrefix}-${payload.config.documentNumber || payload.record.id || 'detail'}.pdf`);

  if (activeExports.has(fileName)) {
    return [];
  }

  activeExports.add(fileName);
  try {
    const attachments = await prepareAttachments(payload.record);
    const expenses = payload.expenses || parseExpenseItems(payload.record.detail_pengeluaran);
    const basePdf = createBasePdf({ ...payload, expenses, attachments });
    const finalPdf = await appendAttachmentsToPdf(basePdf, attachments);

    downloadBytes(finalPdf, fileName);
    return attachments;
  } finally {
    activeExports.delete(fileName);
  }
};

export const exportPaymentRequestDetailPdf = async (pr, vendorInfo) => {
  return exportDetailPdf({
    config: {
      title: 'Detail Payment Request',
      documentNumber: pr.nomor_pr,
      status: `${pr.status_approval || 'Pending'} / ${pr.status_transfer || 'Belum Transfer'}`,
      color: 'blue',
      filePrefix: 'Payment-Request'
    },
    record: pr,
    finalSummary: {
      title: 'Total',
      rows: [['Nominal', formatRupiah(pr.nominal)]]
    },
    sections: [
      {
        title: 'Informasi Dasar',
        rows: [
          ['Nomor PR', pr.nomor_pr],
          ['Nomor QL', pr.nomor_ql],
          ['Tanggal', formatDate(pr.created_at)],
          ['Nama Karyawan', pr.nama_karyawan],
          ['Tipe', pr.tipe],
          ['ID Perusahaan', pr.id_perusahaan],
          ['Nama Event/Project', pr.nama_event]
        ]
      },
      {
        title: pr.metode_pembayaran === 'Virtual Account' ? 'Informasi Virtual Account' : 'Informasi Vendor',
        rows: pr.metode_pembayaran === 'Virtual Account'
          ? [
            ['Metode Pembayaran', pr.metode_pembayaran],
            ['Nomor Virtual Account', pr.virtual_account_number],
            ['Nama Virtual Account', pr.virtual_account_name]
          ]
          : [
            ['Metode Pembayaran', pr.metode_pembayaran],
            ['Nama Vendor', vendorInfo?.nama || pr.vendor_name || '-'],
            ['Kategori', vendorInfo?.kategori],
            ['Nama Bank', vendorInfo?.namaBank],
            ['Nomor Rekening', vendorInfo?.nomorRekening],
            ['Pemilik Rekening', vendorInfo?.namaPemilikRekening]
          ]
      },
      {
        title: 'Status',
        rows: [
          ['Status Approval', pr.status_approval || 'Pending'],
          ['Disetujui Oleh', pr.disetujui_oleh],
          ['Status Transfer', pr.status_transfer || 'Belum Transfer']
        ]
      }
    ]
  });
};

export const exportKasbonDetailPdf = async (kasbon) => {
  return exportDetailPdf({
    config: {
      title: 'Detail Kasbon',
      documentNumber: kasbon.nomor_kasbon,
      status: `${kasbon.status_approval || 'Pending'} / ${kasbon.status_transfer || 'Belum Transfer'}`,
      color: 'emerald',
      filePrefix: 'Kasbon'
    },
    record: kasbon,
    finalSummary: {
      title: 'Total',
      rows: [['Nominal', formatRupiah(kasbon.nominal)]]
    },
    sections: [
      {
        title: 'Informasi Dasar',
        rows: [
          ['Nomor Kasbon', kasbon.nomor_kasbon],
          ['Nomor QL', kasbon.nomor_ql],
          ['Tanggal', formatDate(kasbon.created_at)],
          ['Nama Karyawan', kasbon.nama_karyawan],
          ['Tipe', kasbon.tipe],
          ['ID Perusahaan', kasbon.id_perusahaan],
          ['Nama Event/Project', kasbon.nama_event]
        ]
      },
      {
        title: 'Metode Pembayaran',
        rows: [
          ['Metode', kasbon.metode_pembayaran],
          ['Nama Bank', kasbon.nama_bank],
          ['Nomor Rekening', kasbon.nomor_rekening],
          ['Nama Pemilik Rekening', kasbon.nama_pemilik_rekening]
        ]
      },
      {
        title: 'Status',
        rows: [
          ['Status Approval', kasbon.status_approval || 'Pending'],
          ['Disetujui Oleh', kasbon.nama_approver],
          ['Status Transfer', kasbon.status_transfer || 'Belum Transfer']
        ]
      }
    ]
  });
};

export const exportKlaimDetailPdf = async (klaim) => {
  return exportDetailPdf({
    config: {
      title: 'Detail Klaim Reimbursement',
      documentNumber: klaim.nomor_klaim,
      status: `${klaim.status_approval || 'Pending'} / ${klaim.status_transfer || 'Belum Transfer'}`,
      color: 'violet',
      filePrefix: 'Klaim'
    },
    record: klaim,
    finalSummary: {
      title: 'Total',
      rows: [['Nominal Klaim', formatRupiah(klaim.nominal)]]
    },
    expenses: parseExpenseItems(klaim.detail_pengeluaran),
    sections: [
      {
        title: 'Informasi Dasar',
        rows: [
          ['Nomor Klaim', klaim.nomor_klaim],
          ['Nomor QL', klaim.nomor_ql],
          ['Tanggal', formatDate(klaim.created_at)],
          ['Nama Karyawan', klaim.nama_karyawan],
          ['Tipe', klaim.tipe],
          ['ID Perusahaan', klaim.id_perusahaan],
          ['Nama Event/Project', klaim.nama_event]
        ]
      },
      {
        title: 'Metode Pembayaran',
        rows: [
          ['Metode', klaim.metode_pembayaran],
          ['Nama Bank', klaim.nama_bank],
          ['Nomor Rekening', klaim.nomor_rekening],
          ['Nama Pemilik Rekening', klaim.nama_pemilik_rekening]
        ]
      },
      {
        title: 'Status',
        rows: [
          ['Status Approval', klaim.status_approval || 'Pending'],
          ['Disetujui Oleh', klaim.nama_approver],
          ['Status Transfer', klaim.status_transfer || 'Belum Transfer']
        ]
      }
    ]
  });
};

export const exportPenyelesaianDetailPdf = async (penyelesaian) => {
  return exportDetailPdf({
    config: {
      title: 'Detail Penyelesaian Kasbon',
      documentNumber: penyelesaian.nomor_penyelesaian,
      status: `${penyelesaian.status_approval || 'Pending'} / ${penyelesaian.status_penyelesaian || 'Belum Selesai'}`,
      color: 'amber',
      filePrefix: 'Penyelesaian'
    },
    record: penyelesaian,
    finalSummary: {
      title: 'Total',
      rows: [
        ['Total Pengeluaran', formatRupiah(penyelesaian.total_pengeluaran)],
        ['Selisih', formatRupiah(Math.abs(Number(penyelesaian.selisih || 0)))],
        ['Status Selisih', penyelesaian.status_selisih]
      ]
    },
    expenses: parseExpenseItems(penyelesaian.detail_pengeluaran),
    sections: [
      {
        title: 'Informasi Dasar',
        rows: [
          ['Nomor Penyelesaian', penyelesaian.nomor_penyelesaian],
          ['Nomor Kasbon', penyelesaian.nomor_kasbon],
          ['Nomor Referensi', penyelesaian.nomor_referensi],
          ['Nomor QL', penyelesaian.nomor_ql],
          ['Tanggal', formatDate(penyelesaian.created_at)],
          ['Nama Karyawan', penyelesaian.nama_karyawan],
          ['Nominal Kasbon', formatRupiah(penyelesaian.kasbon_nominal)]
        ]
      },
      {
        title: 'Status',
        rows: [
          ['Status Approval', penyelesaian.status_approval || 'Pending'],
          ['Disetujui Oleh', penyelesaian.nama_approver],
          ['Status Penyelesaian', penyelesaian.status_penyelesaian || 'Belum Selesai'],
          ['Metode Pengembalian', penyelesaian.metode_pengembalian]
        ]
      }
    ]
  });
};
