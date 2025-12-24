import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Download, Eye, Edit, Trash2, Building2, X } from 'lucide-react';
import { useVendor } from '../context/VendorContext';

const Vendor = () => {
  const navigate = useNavigate();
  const { vendors, addVendor, deleteVendor } = useVendor();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    namaBank: '',
    nomorRekening: '',
    namaPemilikRekening: ''
  });
  const [vendorError, setVendorError] = useState('');

  // Filter vendors based on search (by nama or nomor rekening)
  const filteredVendors = vendors.filter(vendor =>
    vendor.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.nomorRekening.includes(searchTerm)
  );

  const stats = [
    { label: 'Total Vendor', value: vendors.length.toString(), color: 'bg-blue-50 text-blue-600' },
    { label: 'Active', value: vendors.filter(v => v.status === 'active').length.toString(), color: 'bg-emerald-50 text-emerald-600' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validasi nomor rekening real-time
    if (name === 'nomorRekening' && value) {
      setVendorError('');
      const existingVendor = vendors.find(v =>
        v.nomorRekening === value && v.status === 'active'
      );
      if (existingVendor) {
        setVendorError(`Vendor dengan nomor rekening ${value} sudah ada: ${existingVendor.nama}`);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setVendorError('');

    try {
      await addVendor(formData);
      setFormData({
        nama: '',
        namaBank: '',
        nomorRekening: '',
        namaPemilikRekening: ''
      });
      setVendorError('');
      setShowModal(false);
      alert('Vendor berhasil ditambahkan!');
    } catch (error) {
      console.error('Error adding vendor:', error);
      if (error.message?.includes('nomor rekening')) {
        setVendorError(error.message);
      } else {
        setVendorError('Gagal menambahkan vendor. Silakan coba lagi.');
      }
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus vendor ini?')) {
      deleteVendor(id);
      alert('Vendor berhasil dihapus!');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Master Vendor</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Kelola data vendor dan supplier perusahaan</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Vendor</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-4 sm:p-6">
            <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${stat.color} mb-2 sm:mb-3`}>
              <span className="text-xl sm:text-2xl font-bold">{stat.value}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari vendor berdasarkan nama atau nomor rekening..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center justify-center space-x-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-gray-700 font-medium">Filter</span>
          </button>
          <button className="flex items-center justify-center space-x-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-5 h-5 text-gray-600" />
            <span className="text-gray-700 font-medium">Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Vendor</th>
                <th className="text-left py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Bank</th>
                <th className="text-left py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nomor Rekening</th>
                <th className="text-left py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Pemilik Rekening</th>
                <th className="text-center py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-center py-3 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 sm:py-4 px-4 sm:px-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{vendor.nama}</span>
                    </div>
                  </td>
                  <td className="py-3 sm:py-4 px-4 sm:px-6">
                    <span className="text-sm font-medium text-gray-700">{vendor.namaBank}</span>
                  </td>
                  <td className="py-3 sm:py-4 px-4 sm:px-6">
                    <span className="text-sm text-gray-700 font-mono">{vendor.nomorRekening}</span>
                  </td>
                  <td className="py-3 sm:py-4 px-4 sm:px-6">
                    <span className="text-sm text-gray-700">{vendor.namaPemilikRekening}</span>
                  </td>
                  <td className="py-3 sm:py-4 px-4 sm:px-6 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${vendor.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                      }`}>
                      {vendor.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 sm:py-4 px-4 sm:px-6">
                    <div className="flex items-center justify-center space-x-2">
                      <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(vendor.id)}
                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">Tambah Vendor Baru</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Vendor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="PT. Nama Vendor"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">Informasi Bank</h4>

                {/* Error Message */}
                {vendorError && (
                  <div className="mb-4 bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <p className="text-sm text-rose-700">{vendorError}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Bank <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaBank"
                      value={formData.namaBank}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Bank BCA"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nomor Rekening <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nomorRekening"
                        value={formData.nomorRekening}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${vendorError && vendorError.includes('nomor rekening')
                          ? 'border-rose-300 focus:ring-rose-500'
                          : 'border-gray-200 focus:ring-primary-500'
                          }`}
                        placeholder="1234567890"
                      />
                      <p className="text-xs text-gray-500 mt-1">Nomor rekening harus unik</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nama Pemilik Rekening <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="namaPemilikRekening"
                        value={formData.namaPemilikRekening}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Nama Pemilik"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Simpan Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendor;
