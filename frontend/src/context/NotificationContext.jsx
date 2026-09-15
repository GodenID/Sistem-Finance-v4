import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/api';
import { useAuth } from './AuthContext';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

const NotificationContext = createContext(null);

// Key for localStorage
const DISMISSED_NOTIFS_KEY = 'dismissed_transfer_notifications';

// Get dismissed notifications from localStorage
const getDismissedNotifications = () => {
  try {
    const stored = localStorage.getItem(DISMISSED_NOTIFS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save dismissed notifications to localStorage
const saveDismissedNotifications = (ids) => {
  try {
    localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Error saving dismissed notifications:', error);
  }
};

export const NotificationProvider = ({ children }) => {
  const { userRole, isAuthenticated, userId, userName } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(getDismissedNotifications());
  const pollIntervalRef = useRef(null);
  const realtimeTimerRef = useRef(null);
  const fetchNotificationsRef = useRef(null);
  const fetchInFlightRef = useRef(false);

  // FIX #3: throttle realtime — maks 1 refetch per 5 detik agar ledakan
  // INSERT/UPDATE tidak memicu badai 6x full-table scan.
  const handleRealtimeUpdate = useCallback(() => {
    if (realtimeTimerRef.current) return;
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      fetchNotificationsRef.current?.();
    }, 5000);
  }, []);

  useRealtimeSubscription('kasbon', { onAnyChange: handleRealtimeUpdate }, isAuthenticated);
  useRealtimeSubscription('payment_requests', { onAnyChange: handleRealtimeUpdate }, isAuthenticated);
  useRealtimeSubscription('klaim', { onAnyChange: handleRealtimeUpdate }, isAuthenticated);
  useRealtimeSubscription('penyelesaian', { onAnyChange: handleRealtimeUpdate }, isAuthenticated);

  // Fetch notifications based on user role
  // FIX #3: query ringan per-role (kolom minimal + filter status di SERVER +
  // limit 50), bukan 6x select('*') full. Recurring hanya untuk team_finance.
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }
    // Cegah fetch bertumpuk (polling + realtime + refresh manual bersamaan)
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    const pick = async (promise) => {
      try {
        const { data } = await promise;
        return data || [];
      } catch {
        return [];
      }
    };

    try {
      setIsLoading(true);

      const isApprover = ['administrator', 'bod', 'manager'].includes(userRole);
      const isFinance = userRole === 'team_finance';

      let prData = [];
      let kasbonData = [];
      let klaimData = [];
      let penyelesaianData = [];
      let recurringInstancesData = [];
      let recurringTemplatesData = [];

      if (isApprover) {
        // Hanya yang Pending, kolom notifikasi saja
        [prData, kasbonData, klaimData, penyelesaianData] = await Promise.all([
          pick(supabase.from('payment_requests').select('id,nomor_pr,nominal,created_at,status_approval').eq('status_approval', 'Pending').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('kasbon').select('id,nomor_kasbon,nominal,created_at,status_approval').eq('status_approval', 'Pending').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('klaim').select('id,nomor_klaim,nominal,created_at,status_approval').eq('status_approval', 'Pending').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('penyelesaian').select('id,nomor_penyelesaian,total_pengeluaran,total_nominal,created_at,status_approval').eq('status_approval', 'Pending').order('created_at', { ascending: false }).limit(50)),
        ]);
      } else if (isFinance) {
        // Hanya yang Approved tapi belum transfer/selesai
        [prData, kasbonData, klaimData, penyelesaianData] = await Promise.all([
          pick(supabase.from('payment_requests').select('id,nomor_pr,nominal,created_at,status_approval,status_transfer').eq('status_approval', 'Approved').eq('status_transfer', 'Belum Transfer').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('kasbon').select('id,nomor_kasbon,nominal,created_at,status_approval,status_transfer').eq('status_approval', 'Approved').eq('status_transfer', 'Belum Transfer').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('klaim').select('id,nomor_klaim,nominal,created_at,status_approval,status_transfer').eq('status_approval', 'Approved').eq('status_transfer', 'Belum Transfer').order('created_at', { ascending: false }).limit(50)),
          pick(supabase.from('penyelesaian').select('id,nomor_penyelesaian,total_pengeluaran,total_nominal,created_at,status_approval,status_penyelesaian').eq('status_approval', 'Approved').order('created_at', { ascending: false }).limit(50)),
        ]);

        // Transaksi berulang jatuh tempo — hanya finance yang butuh
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        recurringInstancesData = await pick(
          supabase.from('recurring_instances').select('id,recurring_id,scheduled_date,status').eq('status', 'pending').lte('scheduled_date', today.toISOString()).order('scheduled_date', { ascending: true }).limit(50)
        );
        const templateIds = [...new Set((recurringInstancesData || []).map((i) => i.recurring_id).filter(Boolean))];
        if (templateIds.length > 0) {
          recurringTemplatesData = await pick(
            supabase.from('recurring_transactions').select('id,name,template_data').in('id', templateIds)
          );
        }
      } else {
        // Role lain: tidak butuh antrean approval/transfer — kosongkan agar ringan.
        // Notifikasi personal (kasbon belum selesai + transfer milik sendiri) diisi di bawah.
      }

      let notifList = [];

      // Logic berdasarkan role
      if (['administrator', 'bod', 'manager'].includes(userRole)) {
        // Admin/BOD/Manager: Tampilkan yang perlu di-approve (status_approval = 'Pending')
        const pendingPR = prData.filter(pr => pr.status_approval === 'Pending');
        const pendingKasbon = kasbonData.filter(kb => kb.status_approval === 'Pending');
        const pendingKlaim = klaimData.filter(kl => kl.status_approval === 'Pending');
        const pendingPenyelesaian = penyelesaianData.filter(p => p.status_approval === 'Pending');

        // Build notification list
        pendingPR.forEach(pr => {
          notifList.push({
            id: pr.id,
            type: 'payment_request',
            title: 'Payment Request Pending',
            message: `${pr.nomor_pr} menunggu approval`,
            nominal: pr.nominal,
            createdAt: pr.created_at,
            link: `/payment-request/${pr.id}`
          });
        });

        pendingKasbon.forEach(kb => {
          notifList.push({
            id: kb.id,
            type: 'kasbon',
            title: 'Kasbon Pending',
            message: `${kb.nomor_kasbon} menunggu approval`,
            nominal: kb.nominal,
            createdAt: kb.created_at,
            link: `/kasbon/${kb.id}`
          });
        });

        pendingKlaim.forEach(kl => {
          notifList.push({
            id: kl.id,
            type: 'klaim',
            title: 'Klaim Pending',
            message: `${kl.nomor_klaim} menunggu approval`,
            nominal: kl.nominal,
            createdAt: kl.created_at,
            link: `/klaim/${kl.id}`
          });
        });

        pendingPenyelesaian.forEach(p => {
          notifList.push({
            id: p.id,
            type: 'penyelesaian',
            title: 'Penyelesaian Pending',
            message: `${p.nomor_penyelesaian} menunggu approval`,
            nominal: p.total_pengeluaran || p.total_nominal,
            createdAt: p.created_at,
            link: `/penyelesaian/${p.id}`
          });
        });

      } else if (userRole === 'team_finance') {
        // Team Finance: Tampilkan yang sudah approved tapi belum transfer
        const needTransferPR = prData.filter(
          pr => pr.status_approval === 'Approved' && pr.status_transfer === 'Belum Transfer'
        );
        const needTransferKasbon = kasbonData.filter(
          kb => kb.status_approval === 'Approved' && kb.status_transfer === 'Belum Transfer'
        );
        const needTransferKlaim = klaimData.filter(
          kl => kl.status_approval === 'Approved' && kl.status_transfer === 'Belum Transfer'
        );

        needTransferPR.forEach(pr => {
          notifList.push({
            id: pr.id,
            type: 'payment_request',
            title: 'PR Belum Transfer',
            message: `${pr.nomor_pr} sudah approved, menunggu transfer`,
            nominal: pr.nominal,
            createdAt: pr.created_at,
            link: `/payment-request/${pr.id}`
          });
        });

        needTransferKasbon.forEach(kb => {
          notifList.push({
            id: kb.id,
            type: 'kasbon',
            title: 'Kasbon Belum Transfer',
            message: `${kb.nomor_kasbon} sudah approved, menunggu transfer`,
            nominal: kb.nominal,
            createdAt: kb.created_at,
            link: `/kasbon/${kb.id}`
          });
        });

        needTransferKlaim.forEach(kl => {
          notifList.push({
            id: kl.id,
            type: 'klaim',
            title: 'Klaim Belum Transfer',
            message: `${kl.nomor_klaim} sudah approved, menunggu transfer`,
            nominal: kl.nominal,
            createdAt: kl.created_at,
            link: `/klaim/${kl.id}`
          });
        });

        // Penyelesaian yang sudah approved tapi belum selesai
        const needCompletePenyelesaian = penyelesaianData.filter(
          p => p.status_approval === 'Approved' && p.status_penyelesaian === 'Belum Selesai'
        );

        needCompletePenyelesaian.forEach(p => {
          notifList.push({
            id: p.id,
            type: 'penyelesaian',
            title: 'Penyelesaian Belum Selesai',
            message: `${p.nomor_penyelesaian} sudah approved, menunggu diselesaikan`,
            nominal: p.total_pengeluaran || p.total_nominal,
            createdAt: p.created_at,
            link: `/penyelesaian/${p.id}`
          });
        });

        // Transaksi berulang yang jatuh tempo (hari ini atau sudah lewat)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueRecurring = (recurringInstancesData || []).filter(instance => {
          if (instance.status !== 'pending') return false;
          const scheduledDate = new Date(instance.scheduled_date);
          scheduledDate.setHours(0, 0, 0, 0);
          return scheduledDate <= today;
        });

        dueRecurring.forEach(instance => {
          // Find the template
          const template = (recurringTemplatesData || []).find(t => t.id === instance.recurring_id);
          const templateData = template?.template_data || {};

          notifList.push({
            id: instance.id,
            type: 'recurring',
            title: 'Transaksi Berulang Jatuh Tempo',
            message: `${template?.name || 'Transaksi'} perlu ditransfer`,
            nominal: templateData.nominal,
            createdAt: instance.scheduled_date,
            link: '/recurring-transactions'
          });
        });
      }

      // === REMINDER KASBON BELUM DISELESAIKAN (Untuk semua user) ===
      // Query ringan milik user sendiri — bukan filter dari array full.
      if (isAuthenticated && userName) {
        const myUnsettled = await pick(
          supabase.from('kasbon').select('id,nomor_kasbon,nominal,updated_at,status_penyelesaian').eq('nama_karyawan', userName).eq('status_transfer', 'Sudah Transfer').order('updated_at', { ascending: false }).limit(20)
        );
        const unsettledKasbon = myUnsettled.filter(kb =>
          (kb.status_penyelesaian === 'Belum Diselesaikan' || !kb.status_penyelesaian)
        );

        unsettledKasbon.forEach(kb => {
          notifList.push({
            id: kb.id,
            type: 'unsettled_kasbon',
            title: 'Kasbon Belum Diselesaikan',
            message: `Kasbon ${kb.nomor_kasbon} menunggu penyelesaian`,
            nominal: kb.nominal,
            createdAt: kb.updated_at,
            link: '/penyelesaian'
          });
        });
      }

      // === NOTIFIKASI TRANSFER UNTUK USER YANG MEMBUAT TRANSAKSI ===
      // Team Finance fokus hanya yang belum transfer, tidak perlu notif sudah transfer
      // User lain hanya dapat notifikasi untuk transaksi yang mereka buat sendiri.
      // Query ringan milik sendiri (7 hari terakhir), bukan scan full tabel.
      if (userRole !== 'team_finance' && userName) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sinceISO = sevenDaysAgo.toISOString();

        const [myPR, myKasbon, myKlaim] = await Promise.all([
          pick(supabase.from('payment_requests').select('id,nomor_pr,nominal,updated_at').eq('nama_karyawan', userName).eq('status_transfer', 'Sudah Transfer').gte('updated_at', sinceISO).order('updated_at', { ascending: false }).limit(10)),
          pick(supabase.from('kasbon').select('id,nomor_kasbon,nominal,updated_at').eq('nama_karyawan', userName).eq('status_transfer', 'Sudah Transfer').gte('updated_at', sinceISO).order('updated_at', { ascending: false }).limit(10)),
          pick(supabase.from('klaim').select('id,nomor_klaim,nominal,updated_at').eq('nama_karyawan', userName).eq('status_transfer', 'Sudah Transfer').gte('updated_at', sinceISO).order('updated_at', { ascending: false }).limit(10)),
        ]);

        myPR.forEach(pr => {
          notifList.push({
            id: pr.id,
            type: 'payment_request_transferred',
            title: 'Payment Request Ditransfer',
            message: `${pr.nomor_pr} sudah ditransfer`,
            nominal: pr.nominal,
            createdAt: pr.updated_at,
            link: `/payment-request/${pr.id}`
          });
        });

        myKasbon.forEach(kb => {
          notifList.push({
            id: kb.id,
            type: 'kasbon_transferred',
            title: 'Kasbon Ditransfer',
            message: `${kb.nomor_kasbon} sudah ditransfer`,
            nominal: kb.nominal,
            createdAt: kb.updated_at,
            link: `/kasbon/${kb.id}`
          });
        });

        myKlaim.forEach(kl => {
          notifList.push({
            id: kl.id,
            type: 'klaim_transferred',
            title: 'Klaim Ditransfer',
            message: `${kl.nomor_klaim} sudah ditransfer`,
            nominal: kl.nominal,
            createdAt: kl.updated_at,
            link: `/klaim/${kl.id}`
          });
        });
      }

      // Sort by createdAt descending
      notifList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Filter out dismissed transfer notifications
      const filteredNotifs = notifList.filter(notif => {
        // Only filter dismissed for transfer notifications
        if (notif.type.includes('_transferred')) {
          const notifKey = `${notif.type}-${notif.id}`;
          return !dismissedIds.includes(notifKey);
        }
        return true;
      });

      // Limit to 20 notifications for display
      const limitedNotifs = filteredNotifs.slice(0, 20);

      setNotifications(limitedNotifs);
      setNotificationCount(filteredNotifs.length);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [userRole, isAuthenticated, dismissedIds, userName]);

  // Daftarkan fetch terbaru agar handler realtime (throttled) selalu memanggil versi fresh
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Setup polling instead of realtime subscription
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch
    fetchNotifications();

    // Poll setiap 60 detik (sebelumnya 30 dtk + 6x full scan tiap poll)
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 60000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isAuthenticated, fetchNotifications]);

  // Manual refresh function
  const refreshNotifications = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss a transfer notification (only for transferred type)
  const dismissNotification = useCallback((notification) => {
    if (notification.type.includes('_transferred')) {
      const notifKey = `${notification.type}-${notification.id}`;
      const newDismissedIds = [...dismissedIds, notifKey];
      setDismissedIds(newDismissedIds);
      saveDismissedNotifications(newDismissedIds);
      // Refresh to update the list
      fetchNotifications();
    }
  }, [dismissedIds, fetchNotifications]);

  // Check if notification is dismissable (only transfer notifications)
  const isDismissable = useCallback((notification) => {
    return notification.type.includes('_transferred');
  }, []);

  // FIX #1: value di-memo agar Header & semua halaman tidak render ulang
  // setiap provider render (polling 60 dtk + event realtime).
  const value = useMemo(() => ({
    notifications,
    notificationCount,
    isLoading,
    refreshNotifications,
    dismissNotification,
    isDismissable
  }), [notifications, notificationCount, isLoading, refreshNotifications, dismissNotification, isDismissable]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
