import React from 'react';
import { getCompanyById, getColorsByTipe } from '../constants/companyTypes';

const IdPerusahaanBadge = ({ idPerusahaan, size = 'sm', showFullName = false }) => {
  const company = getCompanyById(idPerusahaan);
  
  if (!company) {
    return <span className="text-xs text-gray-500">-</span>;
  }

  const colors = getColorsByTipe(company.tipe);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 font-bold',
    md: 'text-sm px-2.5 py-1 font-bold',
    lg: 'text-base px-3 py-1.5 font-bold'
  };

  // Untuk table, tampilkan nama lengkap
  if (showFullName) {
    return (
      <span className={`inline-flex items-center ${colors.darkColor} text-white rounded ${sizeClasses[size]} whitespace-nowrap`}>
        {company.fullName}
      </span>
    );
  }

  // Untuk detail modal, tetap tampilkan singkatan
  return (
    <span className={`inline-flex items-center ${colors.darkColor} text-white rounded ${sizeClasses[size]} whitespace-nowrap`}>
      {idPerusahaan}
    </span>
  );
};

export default IdPerusahaanBadge;

