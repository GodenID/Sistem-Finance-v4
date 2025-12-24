import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getAllRecords } from '../lib/api';
import { useAuth } from './AuthContext';

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

  // Fetch notifications based on user role
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch data dari semua modul
      const [prData, kasbonData, klaimData, penyelesaianData, recurringInstancesData, recurringTemplatesData] = await Promise.all([
        getAllRecords('payment_requests'),
        getAllRecords('kasbon'),
        getAllRecords('klaim'),
        getAllRecords('penyelesaian'),
        getAllRecords('recurring_instances').catch(() => []),
        getAllRecords('recurring_transactions').catch(() => [])
      ]);

      let notifList = [];

      // Logic berdasarkan role
      if (['administrator', 'bod', 'manager'].includes(userRole)) {
        // Admin/BOD/Manager: Tampilkan yang perlu di-approve (status_approval = 'Pending')
        const pendingPR = prData.filter(pr => pr.status_approval === 'Pending');
        const pendingKasbon = kasbonData.filter(kb => kb.status_approval === 'Pending');
        const pendingKlaim = klaimData.filter(kl => kl.status_approval === 'Pending');

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

      // === NOTIFIKASI TRANSFER UNTUK USER YANG MEMBUAT TRANSAKSI ===
      // Team Finance fokus hanya yang belum transfer, tidak perlu notif sudah transfer
      // User lain hanya dapat notifikasi untuk transaksi yang mereka buat sendiri
      if (userRole !== 'team_finance') {
        // Tampilkan transaksi yang baru saja di-transfer (dalam 7 hari terakhir)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Filter: hanya transaksi milik user yang login (matching nama_karyawan)
        const recentTransferPR = prData.filter(
          pr => pr.status_transfer === 'Sudah Transfer' &&
            new Date(pr.updated_at) >= sevenDaysAgo &&
            pr.nama_karyawan === userName
        );
        const recentTransferKasbon = kasbonData.filter(
          kb => kb.status_transfer === 'Sudah Transfer' &&
            new Date(kb.updated_at) >= sevenDaysAgo &&
            kb.nama_karyawan === userName
        );
        const recentTransferKlaim = klaimData.filter(
          kl => kl.status_transfer === 'Sudah Transfer' &&
            new Date(kl.updated_at) >= sevenDaysAgo &&
            kl.nama_karyawan === userName
        );

        recentTransferPR.forEach(pr => {
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

        recentTransferKasbon.forEach(kb => {
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

        recentTransferKlaim.forEach(kl => {
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
    }
  }, [userRole, isAuthenticated, dismissedIds, userName]);

  // Setup polling instead of realtime subscription
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds for updates
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isAuthenticated, fetchNotifications]);

  // Manual refresh function
  const refreshNotifications = () => {
    fetchNotifications();
  };

  // Dismiss a transfer notification (only for transferred type)
  const dismissNotification = (notification) => {
    if (notification.type.includes('_transferred')) {
      const notifKey = `${notification.type}-${notification.id}`;
      const newDismissedIds = [...dismissedIds, notifKey];
      setDismissedIds(newDismissedIds);
      saveDismissedNotifications(newDismissedIds);
      // Refresh to update the list
      fetchNotifications();
    }
  };

  // Check if notification is dismissable (only transfer notifications)
  const isDismissable = (notification) => {
    return notification.type.includes('_transferred');
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      notificationCount,
      isLoading,
      refreshNotifications,
      dismissNotification,
      isDismissable
    }}>
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
