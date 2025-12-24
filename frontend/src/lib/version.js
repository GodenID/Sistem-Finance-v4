import { getAllRecords } from './api';
import { APP_VERSION } from '../data/changelog';

// Cache for version
let cachedVersion = null;

// Get current version from changelog database or fallback
export const getCurrentVersion = async () => {
  if (cachedVersion) return cachedVersion;

  try {
    const data = await getAllRecords('changelog');
    if (data && data.length > 0) {
      // Get unique versions and sort descending
      const versions = [...new Set(data.map(item => item.version))].sort((a, b) => {
        const vA = a.split('.').map(Number);
        const vB = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (vA[i] !== vB[i]) return vB[i] - vA[i];
        }
        return 0;
      });
      cachedVersion = versions[0] || APP_VERSION;
      return cachedVersion;
    }
  } catch (error) {
    console.error('Error fetching version:', error);
  }

  return APP_VERSION;
};

// Sync function for initial render (uses fallback)
export const getVersionSync = () => {
  return cachedVersion || APP_VERSION;
};

// Hook for React components
import { useState, useEffect } from 'react';

export const useAppVersion = () => {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    getCurrentVersion().then(v => setVersion(v));
  }, []);

  return version;
};
