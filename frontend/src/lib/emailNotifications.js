import { supabase } from './supabase';

const EMAIL_WORKER_URL = import.meta.env.VITE_EMAIL_NOTIFICATION_URL;
const APP_BASE_URL = 'https://finance.prasastigroup.id';

const documentLabels = {
  payment_requests: 'Payment Request',
  kasbon: 'Kasbon',
  klaim: 'Klaim',
};

const documentNumberFields = {
  payment_requests: ['nomorPr', 'nomor_pr'],
  kasbon: ['nomorKasbon', 'nomor_kasbon'],
  klaim: ['nomorKlaim', 'nomor_klaim'],
};

const userIdFields = {
  payment_requests: ['created_by', 'createdBy'],
  kasbon: ['user_id', 'userId'],
  klaim: ['user_id', 'userId'],
};

const getFirstValue = (source, keys) => {
  for (const key of keys) {
    if (source?.[key]) return source[key];
  }
  return null;
};

const addDetail = (details, label, value) => {
  if (value === undefined || value === null || value === '' || value === '-') return;
  details.push({ label, value: String(value) });
};

const buildNotificationDetails = (tableName, record) => {
  const details = [];

  addDetail(details, 'Nama Karyawan', getFirstValue(record, ['namaKaryawan', 'nama_karyawan']));
  addDetail(details, 'ID Perusahaan', getFirstValue(record, ['idPerusahaan', 'id_perusahaan']));
  addDetail(details, 'Nama Event/Project', getFirstValue(record, ['namaEvent', 'nama_event']));
  addDetail(details, 'Metode Pembayaran', getFirstValue(record, ['metodePembayaran', 'metode_pembayaran']));

  if (tableName === 'payment_requests') {
    addDetail(details, 'Vendor', getFirstValue(record, ['vendor', 'vendor_name', 'nama_vendor']));
    addDetail(details, 'Nomor Virtual Account', getFirstValue(record, ['virtualAccountNumber', 'virtual_account_number']));
    addDetail(details, 'Nama Virtual Account', getFirstValue(record, ['virtualAccountName', 'virtual_account_name']));
  }

  addDetail(details, 'Nama Bank', getFirstValue(record, ['namaBank', 'nama_bank']));
  addDetail(details, 'No. Rekening', getFirstValue(record, ['nomorRekening', 'nomor_rekening']));
  addDetail(details, 'Pemilik Rekening', getFirstValue(record, ['namaPemilikRekening', 'nama_pemilik_rekening']));
  addDetail(details, 'Keterangan', record?.keterangan);
  addDetail(details, 'Tanggal Dibuat', getFirstValue(record, ['tanggal', 'created_at', 'createdAt']));

  return details;
};

const getRecipient = async (tableName, record) => {
  const userId = getFirstValue(record, userIdFields[tableName] || []);

  if (userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data?.email && data.email_notifications_enabled !== false) return data;
  }

  const employeeName = record?.namaKaryawan || record?.nama_karyawan;
  if (!employeeName) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', employeeName)
    .maybeSingle();

  if (error || !data?.email || data.email_notifications_enabled === false) return null;
  return data;
};

export const sendTransferNotification = async ({
  tableName,
  record,
  amount,
  proofUrl,
  transferredBy,
  detailPath,
}) => {
  if (!EMAIL_WORKER_URL) {
    console.warn('VITE_EMAIL_NOTIFICATION_URL is not configured. Transfer email skipped.');
    return { skipped: true, reason: 'missing-worker-url' };
  }

  try {
    const recipient = await getRecipient(tableName, record);
    if (!recipient?.email) {
      console.warn('Recipient email not found. Transfer email skipped.', { tableName, recordId: record?.id });
      return { skipped: true, reason: 'missing-recipient-email' };
    }

    const documentNumber = getFirstValue(record, documentNumberFields[tableName] || []) || '-';
    const appUrl = detailPath ? `${APP_BASE_URL}${detailPath}` : APP_BASE_URL;

    const response = await fetch(EMAIL_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipient.email,
        recipientName: recipient.name || record?.namaKaryawan || record?.nama_karyawan || 'User',
        documentType: tableName,
        documentLabel: documentLabels[tableName] || 'Transaksi',
        documentNumber,
        amount,
        transferredBy,
        transferredAt: new Date().toISOString(),
        proofUrl,
        appUrl,
        details: buildNotificationDetails(tableName, record),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Gagal mengirim email notifikasi');
    }

    return { success: true, id: result.id };
  } catch (error) {
    console.error('Transfer email notification failed:', error);
    return { skipped: true, reason: error.message };
  }
};
