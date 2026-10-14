import React from 'react';
import { CheckCircle, Clock, XCircle, Info } from 'lucide-react';
import { formatTanggalJam, formatDurasi, calcDurations } from '../lib/approvalFlow';
import { useAuth } from '../context/AuthContext';

/**
 * Timeline 4 tahap: Pengajuan -> Manager -> Head Finance -> Transfer/Selesai.
 * Menampilkan waktu+jam tiap tahap + durasi SLA antar tahap.
 */
const ApprovalTimeline = ({ record = {}, transferLabel = 'Transfer Finance' }) => {
  const d = calcDurations(record);
  const rejected = record.status_approval === 'Rejected';
  const { userRole, hasPermission } = useAuth();
  const can = (key, fallbackRoles) =>
    hasPermission ? hasPermission(key) : fallbackRoles.includes(userRole);
  const iCanManager = can('approve_manager', ['administrator', 'bod', 'manager']) || can('approve', ['administrator', 'bod', 'manager']);
  const iCanHead = can('approve_head_finance', ['administrator', 'head_finance']) || can('approve', ['administrator', 'head_finance']);
  const iCanTransfer = can('transfer', ['administrator', 'team_finance']);
  const isTransferred = !!(record.transferred_at || record.completed_at || record.status_transfer === 'Sudah Transfer' || record.status_penyelesaian === 'Selesai');
  const waitingTransfer = !isTransferred && (record.status_transfer === 'Belum Transfer' || record.status_penyelesaian === 'Belum Selesai' || !record.status_transfer) && record.status_approval === 'Approved' && !rejected;

  const steps = [
    {
      title: 'Pengajuan User',
      time: record.created_at,
      by: record.nama_karyawan || record.nama_event || '-',
      done: true,
      duration: null,
    },
    {
      title: 'Approve Manager',
      time: record.manager_approved_at,
      by: record.manager_approved_by || record.nama_approver || record.disetujui_oleh || null,
      done: !!record.manager_approved_at,
      waiting: record.status_approval === 'Pending' && !rejected,
      duration: d.managerMs != null ? `Durasi: ${d.manager}` : null,
    },
    {
      title: 'Approve Head Finance',
      time: record.head_finance_approved_at,
      by: record.head_finance_approved_by || null,
      done: !!record.head_finance_approved_at,
      waiting: record.status_approval === 'Manager Approved' && !rejected,
      duration: d.headFinanceMs != null ? `Durasi: ${d.headFinance}` : null,
    },
    {
      title: transferLabel,
      time: record.transferred_at || record.completed_at,
      by: null,
      done: isTransferred,
      waiting: waitingTransfer,
      duration: d.transferMs != null ? `Durasi: ${d.transfer}` : null,
    },
  ];

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary-600" />
        Timeline & Durasi SLA
      </h2>
      <ol className="relative border-l-2 border-gray-200 ml-2 space-y-5">
        {steps.map((s, i) => (
          <li key={i} className="ml-4">
            <span className={`absolute -left-[9px] mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
              rejected && i > 0 ? 'border-red-300' : s.done ? 'border-green-500' : s.waiting ? 'border-amber-400' : 'border-gray-300'
            }`}>
              {s.done && <span className="w-2 h-2 rounded-full bg-green-500" />}
              {s.waiting && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
            </span>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              {s.title}
              {s.done && <CheckCircle className="w-4 h-4 text-green-600" />}
              {s.waiting && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">menunggu</span>}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{formatTanggalJam(s.time)}</p>
            {s.by && <p className="text-xs text-gray-500">Oleh: {s.by}</p>}
            {s.duration && <p className="text-xs font-medium text-blue-700 mt-0.5">{s.duration}</p>}
          </li>
        ))}
      </ol>
      {rejected && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5" />
          <div>
            <p className="font-semibold">Ditolak{record.rejected_by ? ` oleh ${record.rejected_by}` : ''}</p>
            <p className="text-xs mt-0.5">{formatTanggalJam(record.rejected_at)}</p>
          </div>
        </div>
      )}
      {!rejected && record.status_approval === 'Pending' && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{iCanManager
            ? 'Menunggu approval Manager — Anda bisa menyetujui lewat panel Aksi Approval.'
            : 'Menunggu approval Manager — akun Anda tidak punya akses approve tahap ini.'}</p>
        </div>
      )}
      {!rejected && record.status_approval === 'Manager Approved' && (
        <div className="mt-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{iCanHead
            ? 'Menunggu approval Head Finance — Anda bisa menyetujui lewat panel Aksi Approval.'
            : 'Menunggu approval Head Finance — akun Anda tidak punya akses tahap ini. Jika Anda Head Finance tapi tombol tidak muncul: pastikan role Anda sudah "Head Finance" di menu Karyawan, lalu refresh / login ulang.'}</p>
        </div>
      )}
      {!rejected && waitingTransfer && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{iCanTransfer
            ? 'Menunggu transfer Finance — Anda bisa upload bukti transfer lewat panel Aksi Transfer.'
            : 'Menunggu transfer oleh Finance.'}</p>
        </div>
      )}
      {!rejected && isTransferred && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Selesai — sudah ditransfer{record.transferred_at || record.completed_at ? ` pada ${formatTanggalJam(record.transferred_at || record.completed_at)}` : ''}.</p>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-3">
        SLA: Manager dihitung dari pengajuan • Head Finance dari approve Manager • Transfer dari approve Head Finance.
      </p>
    </div>
  );
};

export default ApprovalTimeline;
