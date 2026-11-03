import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMaintenanceMode } from '../lib/api';
import EmailRequiredModal from './EmailRequiredModal';
import MaintenancePage from '../pages/MaintenancePage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isSuspended, userRole } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const status = await getMaintenanceMode();
        setIsMaintenance(status);
      } catch (error) {
        console.error('Error checking maintenance:', error);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    // Jalankan paralel dengan verifikasi sesi (/api/auth/me). Dulu menunggu
    // isAuthenticated, jadi dua round trip serial sebelum halaman dirender.
    // Tanpa token request gagal → getMaintenanceMode sudah mengembalikan false.
    checkMaintenance();
  }, []);

  // Show loading spinner saat checking authentication
  if (isLoading || checkingMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect ke login jika belum authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isSuspended) {
    return <Navigate to="/login" replace />;
  }

  // Maintenance mode check: only administrators can access
  if (isMaintenance && userRole?.toLowerCase() !== 'administrator') {
    return <MaintenancePage />;
  }

  return (
    <>
      {children}
      <EmailRequiredModal />
    </>
  );
};

export default ProtectedRoute;
