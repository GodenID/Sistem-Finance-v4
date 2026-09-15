import { useState, useEffect } from 'react';
import { getAllRecords } from './api';
import { APP_VERSION } from '../data/changelog';

// Cache for version (memory + localStorage agar render pertama tidak
// menampilkan fallback lawas saat DB sudah punya versi lebih baru)
let cachedVersion = null;
const LS_KEY = 'app_version';

/** Ubah "4.0" / "3.2.1" jadi array angka yang aman dibandingkan. */
const toParts = (v) =>
  String(v || '')
    .split('.')
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });

/** Komparator descending yang tahan beda jumlah segmen ("4.0" vs "3.2.1"). */
export const compareVersionsDesc = (a, b) => {
  const A = toParts(a);
  const B = toParts(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return y - x;
  }
  return 0;
};

const getStoredVersion = () => {
  try {
    return localStorage.getItem(LS_KEY) || '';
  } catch {
    return '';
  }
};

const storeVersion = (v) => {
  try {
    if (v) localStorage.setItem(LS_KEY, v);
  } catch {
    /* abaikan */
  }
};

// Get current version from changelog database or fallback
export const getCurrentVersion = async () => {
  if (cachedVersion) return cachedVersion;

  try {
    const data = await getAllRecords('changelog');
    if (data && data.length > 0) {
      // Get unique versions and sort descending (robust untuk "4.0" vs "3.2.1")
      const versions = [...new Set(data.map((item) => item.version).filter(Boolean))].sort(compareVersionsDesc);
      cachedVersion = versions[0] || getStoredVersion() || APP_VERSION;
      storeVersion(cachedVersion);
      return cachedVersion;
    }
  } catch (error) {
    console.error('Error fetching version:', error);
  }

  cachedVersion = getStoredVersion() || APP_VERSION;
  return cachedVersion;
};

// Sync function for initial render (versi terakhir yang diketahui, bukan fallback lawas)
export const getVersionSync = () => {
  return cachedVersion || getStoredVersion() || APP_VERSION;
};

// Hook for React components
export const useAppVersion = () => {
  const [version, setVersion] = useState(() => getVersionSync());

  useEffect(() => {
    getCurrentVersion().then((v) => setVersion(v));
  }, []);

  return version;
};
