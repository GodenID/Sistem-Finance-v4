// FIX #5: xlsx dimuat dinamis (await import) di exportDetailWorkbook agar tidak
// masuk bundle awal halaman detail — hanya diunduh saat user klik Export.

const EMPTY_VALUE = '-';

const formatDate = (value, options = {}) => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options
  });
};

const formatDateTime = (value) => {
  if (!value) return EMPTY_VALUE;
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

const formatRupiahValue = (value) => {
  const numberValue = Number(value || 0);
  return `Rp ${new Intl.NumberFormat('id-ID').format(numberValue)}`;
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeCellValue = (value) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
    return JSON.stringify(parsed);
  }

  return parsed;
};

const safeSheetName = (name) => {
  return String(name)
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31) || 'Sheet';
};

const safeFileName = (name) => {
  return String(name)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const addSheet = (XLSX, workbook, sheetName, rows, columnWidths = []) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const maxColumnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  worksheet['!cols'] = columnWidths.length
    ? columnWidths.map((width) => ({ wch: width }))
    : Array.from({ length: maxColumnCount }).map((_, columnIndex) => {
      const maxLength = rows.reduce((max, row) => {
        const value = row[columnIndex];
        return Math.max(max, String(value ?? '').length);
      }, 10);
      return { wch: Math.min(Math.max(maxLength + 2, 12), 60) };
    });

  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
};

const objectToRows = (data, title = 'Data') => {
  const parsed = parseMaybeJson(data);
  if (Array.isArray(parsed)) {
    return [
      [title],
      [],
      ['No', 'Value'],
      ...parsed.map((item, index) => [index + 1, normalizeCellValue(item)])
    ];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [
      [title],
      [],
      ['Field', 'Value'],
      ['Value', normalizeCellValue(parsed)]
    ];
  }

  return [
    [title],
    [],
    ['Field', 'Value'],
    ...Object.keys(parsed)
      .sort()
      .map((key) => [key, normalizeCellValue(parsed[key])])
  ];
};

const parseArrayField = (value) => {
  const parsed = parseMaybeJson(value);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
};

const collectAttachmentRows = (record) => {
  const rows = [];

  Object.entries(record || {}).forEach(([key, value]) => {
    if (!value || !/(lampiran|bukti)/i.test(key)) return;

    const values = parseArrayField(value);
    values.forEach((item, index) => {
      rows.push([
        rows.length + 1,
        key,
        values.length > 1 ? index + 1 : '',
        normalizeCellValue(item)
      ]);
    });
  });

  return rows;
};

const appendDetailPengeluaranSheet = (XLSX, workbook, rawDetail) => {
  const items = parseArrayField(rawDetail);
  if (!items.length) return;

  const allKeys = Array.from(
    items.reduce((keys, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.keys(item).forEach((key) => keys.add(key));
      }
      return keys;
    }, new Set())
  );

  const preferredKeys = ['deskripsi', 'nama', 'nominal'];
  const orderedKeys = [
    ...preferredKeys.filter((key) => allKeys.includes(key)),
    ...allKeys.filter((key) => !preferredKeys.includes(key))
  ];

  addSheet(
    XLSX,
    workbook,
    'Detail Pengeluaran',
    [
      ['Detail Pengeluaran'],
      [],
      ['No', ...orderedKeys],
      ...items.map((item, index) => [
        index + 1,
        ...orderedKeys.map((key) => normalizeCellValue(item?.[key]))
      ])
    ]
  );
};

const exportDetailWorkbook = async ({
  moduleName,
  title,
  primaryNumber,
  record,
  fields,
  extraSheets = []
}) => {
  if (!record) return;

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const exportedAt = new Date();

  addSheet(
    XLSX,
    workbook,
    'Ringkasan',
    [
      [title],
      ['Prasasti Group'],
      ['Tanggal Export', formatDateTime(exportedAt)],
      ['Nomor Dokumen', primaryNumber || EMPTY_VALUE],
      [],
      ['Informasi', 'Nilai'],
      ...fields.map(([label, value]) => [label, normalizeCellValue(value)])
    ],
    [28, 55]
  );

  addSheet(XLSX, workbook, 'Data Mentah', objectToRows(record, 'Data Mentah Lengkap'), [30, 80]);

  if (record.detail_pengeluaran) {
    appendDetailPengeluaranSheet(XLSX, workbook, record.detail_pengeluaran);
  }

  const attachmentRows = collectAttachmentRows(record);
  if (attachmentRows.length) {
    addSheet(
      XLSX,
      workbook,
      'Lampiran',
      [
        ['Lampiran dan Bukti'],
        [],
        ['No', 'Field', 'Urutan', 'URL / Data'],
        ...attachmentRows
      ],
      [8, 28, 12, 90]
    );
  }

  extraSheets.forEach(({ name, data, columns }) => {
    if (!data) return;
    if (Array.isArray(data)) {
      addSheet(XLSX, workbook, name, data, columns);
      return;
    }
    addSheet(XLSX, workbook, name, objectToRows(data, name), columns || [30, 80]);
  });

  const fileName = safeFileName(`${moduleName}-${primaryNumber || record.id || 'detail'}-${exportedAt.toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(workbook, fileName);
};

export const exportPaymentRequestDetailExcel = (pr, vendorInfo) => {
  const vendorName = vendorInfo?.nama || pr.vendor_name || pr.nama_vendor || EMPTY_VALUE;

  return exportDetailWorkbook({
    moduleName: 'Payment-Request',
    title: 'Detail Payment Request',
    primaryNumber: pr.nomor_pr,
    record: pr,
    fields: [
      ['Nomor PR', pr.nomor_pr],
      ['Nomor QL', pr.nomor_ql],
      ['Tanggal Dibuat', formatDate(pr.created_at)],
      ['Nama Karyawan', pr.nama_karyawan],
      ['Tipe', pr.tipe],
      ['ID Perusahaan', pr.id_perusahaan],
      ['Nama Event/Project', pr.nama_event],
      ['Metode Pembayaran', pr.metode_pembayaran],
      ['Nama Vendor', vendorName],
      ['Nomor Virtual Account', pr.virtual_account_number],
      ['Nama Virtual Account', pr.virtual_account_name],
      ['Nominal', formatRupiahValue(pr.nominal)],
      ['Status Approval', pr.status_approval || 'Pending'],
      ['Disetujui Oleh', pr.disetujui_oleh],
      ['Status Transfer', pr.status_transfer || 'Belum Transfer'],
      ['Bukti Transfer', pr.bukti_transfer],
      ['Lampiran', pr.lampiran],
      ['Confidential', pr.is_confidential ? 'Ya' : 'Tidak'],
      ['Keterangan', pr.keterangan],
      ['Dibuat Oleh', pr.created_by],
      ['Terakhir Diubah', formatDateTime(pr.updated_at)]
    ],
    extraSheets: vendorInfo
      ? [{ name: 'Vendor', data: vendorInfo, columns: [30, 80] }]
      : []
  });
};

export const exportKasbonDetailExcel = (kasbon) => {
  return exportDetailWorkbook({
    moduleName: 'Kasbon',
    title: 'Detail Kasbon',
    primaryNumber: kasbon.nomor_kasbon,
    record: kasbon,
    fields: [
      ['Nomor Kasbon', kasbon.nomor_kasbon],
      ['Nomor QL', kasbon.nomor_ql],
      ['Tanggal Dibuat', formatDate(kasbon.created_at)],
      ['Nama Karyawan', kasbon.nama_karyawan],
      ['Tipe', kasbon.tipe],
      ['ID Perusahaan', kasbon.id_perusahaan],
      ['Nama Event/Project', kasbon.nama_event],
      ['Metode Pembayaran', kasbon.metode_pembayaran],
      ['Nama Bank', kasbon.nama_bank],
      ['Nomor Rekening', kasbon.nomor_rekening],
      ['Nama Pemilik Rekening', kasbon.nama_pemilik_rekening],
      ['Nominal', formatRupiahValue(kasbon.nominal)],
      ['Status Approval', kasbon.status_approval || 'Pending'],
      ['Disetujui Oleh', kasbon.nama_approver],
      ['Status Transfer', kasbon.status_transfer || 'Belum Transfer'],
      ['Bukti Transfer', kasbon.bukti_transfer],
      ['Lampiran', kasbon.lampiran],
      ['Confidential', kasbon.is_confidential ? 'Ya' : 'Tidak'],
      ['Keterangan', kasbon.keterangan],
      ['User ID', kasbon.user_id],
      ['Terakhir Diubah', formatDateTime(kasbon.updated_at)]
    ]
  });
};

export const exportKlaimDetailExcel = (klaim) => {
  return exportDetailWorkbook({
    moduleName: 'Klaim',
    title: 'Detail Klaim',
    primaryNumber: klaim.nomor_klaim,
    record: klaim,
    fields: [
      ['Nomor Klaim', klaim.nomor_klaim],
      ['Nomor QL', klaim.nomor_ql],
      ['Tanggal Dibuat', formatDate(klaim.created_at)],
      ['Nama Karyawan', klaim.nama_karyawan],
      ['Tipe', klaim.tipe],
      ['ID Perusahaan', klaim.id_perusahaan],
      ['Nama Event/Project', klaim.nama_event],
      ['Metode Pembayaran', klaim.metode_pembayaran],
      ['Nama Bank', klaim.nama_bank],
      ['Nomor Rekening', klaim.nomor_rekening],
      ['Nama Pemilik Rekening', klaim.nama_pemilik_rekening],
      ['Nominal', formatRupiahValue(klaim.nominal)],
      ['Detail Pengeluaran', klaim.detail_pengeluaran],
      ['Status Approval', klaim.status_approval || 'Pending'],
      ['Disetujui Oleh', klaim.nama_approver],
      ['Status Transfer', klaim.status_transfer || 'Belum Transfer'],
      ['Bukti Transfer', klaim.bukti_transfer],
      ['Lampiran', klaim.lampiran],
      ['Confidential', klaim.is_confidential ? 'Ya' : 'Tidak'],
      ['Keterangan', klaim.keterangan],
      ['User ID', klaim.user_id],
      ['Terakhir Diubah', formatDateTime(klaim.updated_at)]
    ]
  });
};

export const exportPenyelesaianDetailExcel = (penyelesaian) => {
  return exportDetailWorkbook({
    moduleName: 'Penyelesaian',
    title: 'Detail Penyelesaian Kasbon',
    primaryNumber: penyelesaian.nomor_penyelesaian,
    record: penyelesaian,
    fields: [
      ['Nomor Penyelesaian', penyelesaian.nomor_penyelesaian],
      ['Nomor Kasbon', penyelesaian.nomor_kasbon],
      ['Nomor Referensi', penyelesaian.nomor_referensi],
      ['Nomor QL', penyelesaian.nomor_ql],
      ['Tanggal Dibuat', formatDate(penyelesaian.created_at)],
      ['Nama Karyawan', penyelesaian.nama_karyawan],
      ['Nominal Kasbon', formatRupiahValue(penyelesaian.kasbon_nominal)],
      ['Total Pengeluaran', formatRupiahValue(penyelesaian.total_pengeluaran)],
      ['Selisih', formatRupiahValue(Math.abs(Number(penyelesaian.selisih || 0)))],
      ['Status Selisih', penyelesaian.status_selisih],
      ['Metode Pengembalian', penyelesaian.metode_pengembalian],
      ['Detail Pengeluaran', penyelesaian.detail_pengeluaran],
      ['Status Approval', penyelesaian.status_approval || 'Pending'],
      ['Disetujui Oleh', penyelesaian.nama_approver],
      ['Status Penyelesaian', penyelesaian.status_penyelesaian || 'Belum Selesai'],
      ['Lampiran', penyelesaian.lampiran],
      ['Lampiran Pengembalian', penyelesaian.lampiran_pengembalian],
      ['Confidential', penyelesaian.is_confidential ? 'Ya' : 'Tidak'],
      ['Keterangan', penyelesaian.keterangan],
      ['User ID', penyelesaian.user_id],
      ['Terakhir Diubah', formatDateTime(penyelesaian.updated_at)]
    ]
  });
};
