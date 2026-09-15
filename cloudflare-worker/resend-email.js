/**
 * Cloudflare Worker for transactional email via Resend.
 *
 * Required secrets/env:
 * - RESEND_API_KEY: set with `wrangler secret put RESEND_API_KEY`
 * - RESEND_FROM_EMAIL: verified sender, e.g. Finance Prasasti <finance@prasastigroup.com>
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const APP_BASE_URL = 'https://finance.prasastigroup.id';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (!env.RESEND_API_KEY) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500, corsHeaders);
    }

    try {
      const payload = await request.json();
      const notification = normalizeTransferNotification(payload);

      if (!notification.to) {
        return jsonResponse({ error: 'Recipient email is required' }, 400, corsHeaders);
      }

      const from = env.RESEND_FROM_EMAIL || 'Finance Prasasti <onboarding@resend.dev>';
      const subject = `Transfer berhasil: ${notification.documentLabel} ${notification.documentNumber}`;

      const resendResponse = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [notification.to],
          subject,
          html: buildTransferEmailHtml(notification),
          text: buildTransferEmailText(notification),
        }),
      });

      const result = await resendResponse.json();
      if (!resendResponse.ok) {
        console.error('Resend error:', result);
        return jsonResponse({ error: 'Failed to send email', details: result }, resendResponse.status, corsHeaders);
      }

      return jsonResponse({ success: true, id: result.id }, 200, corsHeaders);
    } catch (error) {
      console.error('Email worker error:', error);
      return jsonResponse({ error: error.message || 'Internal server error' }, 500, corsHeaders);
    }
  },
};

function normalizeTransferNotification(payload) {
  return {
    to: String(payload.to || '').trim().toLowerCase(),
    recipientName: payload.recipientName || 'User',
    documentType: payload.documentType || 'transaksi',
    documentLabel: payload.documentLabel || 'Transaksi',
    documentNumber: payload.documentNumber || '-',
    amount: payload.amount || 0,
    transferredBy: payload.transferredBy || 'Finance',
    transferredAt: payload.transferredAt || new Date().toISOString(),
    proofUrl: normalizeSafeUrl(payload.proofUrl),
    appUrl: normalizeAppUrl(payload.appUrl),
    details: normalizeDetails(payload.details),
  };
}

function formatRupiah(amount) {
  const number = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeSafeUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  try {
    const url = new URL(rawValue);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeAppUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return APP_BASE_URL;

  try {
    const url = new URL(rawValue, APP_BASE_URL);
    return `${APP_BASE_URL}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return APP_BASE_URL;
  }
}

function normalizeDetails(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
    }))
    .filter((item) => item.label && item.value)
    .slice(0, 12);
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid #edf2f7;color:#667085;font-size:13px;line-height:20px;">${escapeHtml(label)}</td>
      <td style="padding:13px 0;border-bottom:1px solid #edf2f7;color:#111827;font-size:13px;line-height:20px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildTransferEmailHtml(notification) {
  const proofLink = notification.proofUrl
    ? `<a href="${escapeHtml(notification.proofUrl)}" style="display:inline-block;margin:12px 0 0;color:#0f766e;text-decoration:none;font-size:13px;font-weight:700;">Lihat bukti transfer</a>`
    : '';
  const appLink = `<a href="${escapeHtml(notification.appUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 18px;border-radius:8px;">Buka detail transaksi</a>`;
  const formattedAmount = formatRupiah(notification.amount);
  const formattedDate = formatDate(notification.transferredAt);
  const extraDetails = notification.details.length
    ? `
      <p style="margin:2px 0 10px;color:#111827;font-size:14px;line-height:22px;font-weight:800;">Detail Transaksi</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
        ${notification.details.map((item) => detailRow(item.label, item.value)).join('')}
      </table>
    `
    : '';

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(notification.documentLabel)} ${escapeHtml(notification.documentNumber)} sebesar ${escapeHtml(formattedAmount)} sudah ditransfer.
    </div>
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 14px 32px rgba(17,24,39,0.08);">
          <div style="background:#111827;padding:26px 28px;color:#ffffff;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td>
                  <p style="margin:0 0 10px;color:#9ca3af;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Finance Prasasti Group</p>
                  <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:32px;font-weight:800;">Dana Sudah Ditransfer</h1>
                </td>
                <td style="text-align:right;vertical-align:top;">
                  <span style="display:inline-block;background:#d1fae5;color:#065f46;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800;">Sudah Transfer</span>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 8px;color:#111827;font-size:16px;line-height:24px;font-weight:700;">Halo ${escapeHtml(notification.recipientName)},</p>
            <p style="margin:0 0 22px;color:#4b5563;font-size:14px;line-height:22px;">
              ${escapeHtml(notification.documentLabel)} Anda sudah diproses dan ditandai <strong style="color:#111827;">Sudah Transfer</strong> oleh tim Finance.
            </p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 18px;">
              <p style="margin:0 0 6px;color:#667085;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Nominal Transfer</p>
              <p style="margin:0;color:#111827;font-size:30px;line-height:38px;font-weight:800;">${escapeHtml(formattedAmount)}</p>
            </div>

            <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
              ${detailRow('Jenis Dokumen', notification.documentLabel)}
              ${detailRow('Nomor Dokumen', notification.documentNumber)}
              ${detailRow('Status', 'Sudah Transfer')}
              ${detailRow('Ditransfer Oleh', notification.transferredBy)}
              ${detailRow('Waktu Transfer', formattedDate)}
              ${detailRow('Penerima Notifikasi', notification.recipientName)}
            </table>

            ${extraDetails}

            <div style="margin:0 0 22px;">
              ${appLink}
              ${proofLink}
            </div>

            <div style="background:#f8fafc;border-left:4px solid #0f766e;border-radius:8px;padding:14px 16px;">
              <p style="margin:0;color:#475467;font-size:13px;line-height:20px;">
                Silakan cek detail transaksi melalui aplikasi Finance. Jika nominal atau data transaksi tidak sesuai, hubungi tim Finance Prasasti Group.
              </p>
            </div>
          </div>
          <div style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#667085;font-size:12px;line-height:18px;">Email ini dikirim otomatis oleh sistem Finance Prasasti Group.</p>
            <p style="margin:6px 0 0;color:#667085;font-size:12px;line-height:18px;">
              Link aplikasi: <a href="${escapeHtml(notification.appUrl)}" style="color:#111827;text-decoration:none;font-weight:700;">${escapeHtml(notification.appUrl)}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildTransferEmailText(notification) {
  const appUrl = notification.appUrl || APP_BASE_URL;
  const extraDetails = notification.details.map((item) => `${item.label}: ${item.value}`);

  return [
    `Halo ${notification.recipientName},`,
    '',
    `${notification.documentLabel} ${notification.documentNumber} sudah diproses dan ditandai Sudah Transfer.`,
    `Jenis dokumen: ${notification.documentLabel}`,
    `Nomor dokumen: ${notification.documentNumber}`,
    'Status: Sudah Transfer',
    `Nominal: ${formatRupiah(notification.amount)}`,
    `Ditransfer oleh: ${notification.transferredBy}`,
    `Waktu: ${formatDate(notification.transferredAt)}`,
    ...extraDetails,
    notification.proofUrl ? `Bukti transfer: ${notification.proofUrl}` : '',
    `Detail transaksi: ${appUrl}`,
    '',
    'Email ini dikirim otomatis oleh sistem Finance Prasasti Group.',
  ].filter(Boolean).join('\n');
}

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
