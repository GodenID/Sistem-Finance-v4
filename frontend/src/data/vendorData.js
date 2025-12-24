// Data vendor yang akan digunakan di seluruh aplikasi
// NOTE: Data ini sekarang dikelola oleh VendorContext
// File ini tetap ada untuk backward compatibility

export const vendorList = [
  { 
    id: 1, 
    nama: 'PT. Supplier Utama',
    namaBank: 'Bank Mandiri',
    nomorRekening: '1370012345678',
    namaPemilikRekening: 'PT. Supplier Utama',
    status: 'active'
  },
  { 
    id: 2, 
    nama: 'CV. Teknologi Digital',
    namaBank: 'Bank BCA',
    nomorRekening: '5320098765432',
    namaPemilikRekening: 'CV. Teknologi Digital',
    status: 'active'
  },
  { 
    id: 3, 
    nama: 'PT. Jasa Konstruksi',
    namaBank: 'Bank BNI',
    nomorRekening: '0234567890123',
    namaPemilikRekening: 'PT. Jasa Konstruksi',
    status: 'active'
  },
  { 
    id: 4, 
    nama: 'Toko Perlengkapan Kantor',
    namaBank: 'Bank BRI',
    nomorRekening: '0012345678901',
    namaPemilikRekening: 'Rudi Hartono',
    status: 'active'
  },
  { 
    id: 5, 
    nama: 'PT. Service Provider',
    namaBank: 'Bank CIMB Niaga',
    nomorRekening: '7001234567890',
    namaPemilikRekening: 'PT. Service Provider',
    status: 'active'
  },
];

// Function untuk get vendor by id
export const getVendorById = (id, vendors = vendorList) => {
  return vendors.find(vendor => vendor.id === id);
};

// Function untuk get active vendors only
export const getActiveVendors = (vendors = vendorList) => {
  return vendors.filter(vendor => vendor.status === 'active');
};

// Function untuk search vendors (by nama or nomor rekening)
export const searchVendors = (searchTerm, vendors = vendorList) => {
  if (!searchTerm) return [];
  const term = searchTerm.toLowerCase();
  return vendors.filter(vendor => 
    vendor.status === 'active' && (
      vendor.nama.toLowerCase().includes(term) ||
      vendor.nomorRekening.includes(term)
    )
  );
};
