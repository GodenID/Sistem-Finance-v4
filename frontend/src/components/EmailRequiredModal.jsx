import React, { useState } from 'react';
import { Mail, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateRecord } from '../lib/api';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const EmailRequiredModal = () => {
  const { userId, userName, userRole, userEmail, userStatus, emailNotificationsEnabled, login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState(userEmail || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!userId || userEmail || userStatus === 'suspended' || !emailNotificationsEnabled) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      showToast('Masukkan alamat email yang valid', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateRecord('users', userId, { email: trimmedEmail });
      login({
        id: userId,
        name: userName,
        role: userRole,
        email: trimmedEmail,
        status: userStatus,
        email_notifications_enabled: emailNotificationsEnabled
      });
      showToast('Email berhasil disimpan', 'success');
    } catch (error) {
      console.error('Error saving user email:', error);
      showToast('Gagal menyimpan email', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
              <Mail className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lengkapi Email</h2>
              <p className="text-sm text-gray-500">Email ini dipakai untuk notifikasi transfer.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-700">
                Anda harus mengisi email sebelum melanjutkan menggunakan aplikasi.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="nama@perusahaan.com"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Simpan Email</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailRequiredModal;
