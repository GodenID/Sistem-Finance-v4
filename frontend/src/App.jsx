import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VendorProvider } from './context/VendorContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PageLoading from './components/PageLoading';

// Lazy load components
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const PaymentRequest = React.lazy(() => import('./pages/PaymentRequest'));
const PaymentRequestDetail = React.lazy(() => import('./pages/PaymentRequestDetail'));
const Kasbon = React.lazy(() => import('./pages/Kasbon'));
const KasbonDetail = React.lazy(() => import('./pages/KasbonDetail'));
const Klaim = React.lazy(() => import('./pages/Klaim'));
const KlaimDetail = React.lazy(() => import('./pages/KlaimDetail'));
const Penyelesaian = React.lazy(() => import('./pages/Penyelesaian'));
const PenyelesaianDetail = React.lazy(() => import('./pages/PenyelesaianDetail'));
const Vendor = React.lazy(() => import('./pages/Vendor'));
const Laporan = React.lazy(() => import('./pages/Laporan'));
const ActivityLog = React.lazy(() => import('./pages/ActivityLog'));
const Karyawan = React.lazy(() => import('./pages/Karyawan'));
const Backup = React.lazy(() => import('./pages/Backup'));
const Changelog = React.lazy(() => import('./pages/Changelog'));
const Performance = React.lazy(() => import('./pages/Performance'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Users = React.lazy(() => import('./pages/Users'));
const RecurringTransactions = React.lazy(() => import('./pages/RecurringTransactions'));
const ImageToPdf = React.lazy(() => import('./pages/ImageToPdf'));
const Login = React.lazy(() => import('./pages/Login'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function App() {
  // Set initial sidebar state based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // Open by default on desktop, closed on mobile
    }
    return true;
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Auto open sidebar on desktop, keep current state on mobile
      if (window.innerWidth >= 1024 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <VendorProvider>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  {/* Public Route - Login */}
                  <Route path="/login" element={<Login />} />

                  {/* 404 Page - Full screen tanpa sidebar */}
                  <Route path="/404" element={<NotFound />} />

                  {/* Protected Routes dengan Sidebar */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <div className="flex h-screen bg-gray-50 overflow-hidden">
                          {/* Sidebar */}
                          <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

                          {/* Main Content */}
                          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                            <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
                              <Suspense fallback={<PageLoading />}>
                                <Routes>
                                  <Route path="/" element={<Dashboard />} />
                                  <Route path="/payment-request" element={<PaymentRequest />} />
                                  <Route path="/payment-request/:id" element={<PaymentRequestDetail />} />
                                  <Route path="/kasbon" element={<Kasbon />} />
                                  <Route path="/kasbon/:id" element={<KasbonDetail />} />
                                  <Route path="/klaim" element={<Klaim />} />
                                  <Route path="/klaim/:id" element={<KlaimDetail />} />
                                  <Route path="/penyelesaian" element={<Penyelesaian />} />
                                  <Route path="/penyelesaian/:id" element={<PenyelesaianDetail />} />
                                  <Route path="/vendor" element={<Vendor />} />
                                  <Route path="/laporan" element={<Laporan />} />
                                  <Route path="/activity-log" element={<ActivityLog />} />
                                  <Route
                                    path="/karyawan"
                                    element={
                                      <AdminRoute>
                                        <Karyawan />
                                      </AdminRoute>
                                    }
                                  />
                                  <Route
                                    path="/backup"
                                    element={
                                      <AdminRoute>
                                        <Backup />
                                      </AdminRoute>
                                    }
                                  />
                                  <Route
                                    path="/performance"
                                    element={
                                      <AdminRoute>
                                        <Performance />
                                      </AdminRoute>
                                    }
                                  />
                                  <Route path="/changelog" element={<Changelog />} />
                                  <Route path="/profile" element={<Profile />} />
                                  <Route path="/profile/:id" element={<Profile />} />
                                  <Route path="/users" element={<Users />} />
                                  <Route path="/recurring" element={<RecurringTransactions />} />
                                  <Route path="/tools/image-to-pdf" element={<ImageToPdf />} />
                                  <Route path="*" element={<Navigate to="/404" replace />} />
                                </Routes>
                              </Suspense>
                            </main>
                          </div>
                        </div>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </VendorProvider>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
