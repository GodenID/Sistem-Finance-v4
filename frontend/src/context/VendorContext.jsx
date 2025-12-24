import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllRecords, createRecord, updateRecord, deleteRecord } from '../lib/api';

const VendorContext = createContext();

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('useVendor must be used within VendorProvider');
  }
  return context;
};

// Initial vendor data
const initialVendors = [
  {
    id: 1,
    nama: 'PT. Supplier Utama',
    kategori: 'Inventory',
    kontak: 'Ahmad Vendor',
    alamat: 'Jakarta Selatan',
    namaBank: 'Bank Mandiri',
    nomorRekening: '1370012345678',
    namaPemilikRekening: 'PT. Supplier Utama',
    status: 'active'
  },
  {
    id: 2,
    nama: 'CV. Teknologi Digital',
    kategori: 'IT Equipment',
    kontak: 'Budi Tech',
    alamat: 'Jakarta Barat',
    namaBank: 'Bank BCA',
    nomorRekening: '5320098765432',
    namaPemilikRekening: 'CV. Teknologi Digital',
    status: 'active'
  },
  {
    id: 3,
    nama: 'PT. Jasa Konstruksi',
    kategori: 'Construction',
    kontak: 'Siti Builder',
    alamat: 'Tangerang',
    namaBank: 'Bank BNI',
    nomorRekening: '0234567890123',
    namaPemilikRekening: 'PT. Jasa Konstruksi',
    status: 'active'
  },
  {
    id: 4,
    nama: 'Toko Perlengkapan Kantor',
    kategori: 'Office Supplies',
    kontak: 'Rudi Office',
    alamat: 'Jakarta Pusat',
    namaBank: 'Bank BRI',
    nomorRekening: '0012345678901',
    namaPemilikRekening: 'Rudi Hartono',
    status: 'active'
  },
  {
    id: 5,
    nama: 'PT. Service Provider',
    kategori: 'Professional Services',
    kontak: 'Dewi Services',
    alamat: 'Jakarta Timur',
    namaBank: 'Bank CIMB Niaga',
    nomorRekening: '7001234567890',
    namaPemilikRekening: 'PT. Service Provider',
    status: 'active'
  },
];

export const VendorProvider = ({ children }) => {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch vendors from Supabase on mount
  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords('vendors', { status: 'active' });

      // Transform data to match frontend format
      const transformedData = data.map(vendor => ({
        id: vendor.id,
        nama: vendor.nama,
        namaBank: vendor.nama_bank,
        nomorRekening: vendor.nomor_rekening,
        namaPemilikRekening: vendor.nama_pemilik_rekening,
        status: vendor.status,
      }));

      setVendors(transformedData);
    } catch (error) {
      console.error('Error fetching vendors from Supabase:', error);
      // Fallback to localStorage
      const savedVendors = localStorage.getItem('vendors');
      if (savedVendors) {
        setVendors(JSON.parse(savedVendors));
      } else {
        setVendors(initialVendors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add new vendor
  const addVendor = async (vendorData) => {
    try {
      // Validasi nomor rekening sudah ada
      const existingVendor = vendors.find(v =>
        v.nomorRekening === vendorData.nomorRekening && v.status === 'active'
      );

      if (existingVendor) {
        throw new Error(`Vendor dengan nomor rekening ${vendorData.nomorRekening} sudah ada: ${existingVendor.nama}`);
      }

      // Transform to Supabase format
      const supabaseData = {
        nama: vendorData.nama,
        nama_bank: vendorData.namaBank,
        nomor_rekening: vendorData.nomorRekening,
        nama_pemilik_rekening: vendorData.namaPemilikRekening,
        status: 'active',
      };

      const newVendor = await createRecord('vendors', supabaseData);

      // Transform back to frontend format
      const transformedVendor = {
        id: newVendor.id,
        nama: newVendor.nama,
        namaBank: newVendor.nama_bank,
        nomorRekening: newVendor.nomor_rekening,
        namaPemilikRekening: newVendor.nama_pemilik_rekening,
        status: newVendor.status,
      };

      setVendors([...vendors, transformedVendor]);
      return transformedVendor;
    } catch (error) {
      console.error('Error adding vendor:', error);
      // Re-throw error untuk ditangani di component
      throw error;
    }
  };

  // Update vendor
  const updateVendor = async (id, vendorData) => {
    try {
      // Validasi nomor rekening jika berubah
      if (vendorData.nomorRekening) {
        const existingVendor = vendors.find(v =>
          v.nomorRekening === vendorData.nomorRekening &&
          v.status === 'active' &&
          v.id !== id
        );

        if (existingVendor) {
          throw new Error(`Vendor dengan nomor rekening ${vendorData.nomorRekening} sudah ada: ${existingVendor.nama}`);
        }
      }

      // Transform to Supabase format
      const supabaseData = {
        nama: vendorData.nama,
        nama_bank: vendorData.namaBank,
        nomor_rekening: vendorData.nomorRekening,
        nama_pemilik_rekening: vendorData.namaPemilikRekening,
        status: vendorData.status,
      };

      const updatedVendor = await updateRecord('vendors', id, supabaseData);

      // Transform back to frontend format
      const transformedVendor = {
        id: updatedVendor.id,
        nama: updatedVendor.nama,
        namaBank: updatedVendor.nama_bank,
        nomorRekening: updatedVendor.nomor_rekening,
        namaPemilikRekening: updatedVendor.nama_pemilik_rekening,
        status: updatedVendor.status,
      };

      setVendors(vendors.map(vendor =>
        vendor.id === id ? transformedVendor : vendor
      ));
    } catch (error) {
      console.error('Error updating vendor:', error);
      throw error;
    }
  };

  // Delete vendor
  const deleteVendor = async (id) => {
    try {
      await deleteRecord('vendors', id);
      setVendors(vendors.filter(vendor => vendor.id !== id));
    } catch (error) {
      console.error('Error deleting vendor:', error);
      // Fallback: delete from local state
      setVendors(vendors.filter(vendor => vendor.id !== id));
    }
  };

  // Get vendor by id
  const getVendorById = (id) => {
    return vendors.find(vendor => vendor.id === id);
  };

  // Get active vendors
  const getActiveVendors = () => {
    return vendors.filter(vendor => vendor.status === 'active');
  };

  // Search vendors (by nama, nomor rekening, or nama pemilik rekening)
  const searchVendors = (searchTerm) => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return vendors.filter(vendor =>
      vendor.status === 'active' && (
        (vendor.nama && vendor.nama.toLowerCase().includes(term)) ||
        (vendor.nomorRekening && vendor.nomorRekening.toLowerCase().includes(term)) ||
        (vendor.namaPemilikRekening && vendor.namaPemilikRekening.toLowerCase().includes(term))
      )
    );
  };

  const value = {
    vendors,
    isLoading,
    addVendor,
    updateVendor,
    deleteVendor,
    getVendorById,
    getActiveVendors,
    searchVendors,
    refreshVendors: fetchVendors
  };

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};

