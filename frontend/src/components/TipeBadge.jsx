import React from 'react';
import { getColorsByTipe } from '../constants/companyTypes';

const TipeBadge = ({ tipe, size = 'sm' }) => {
  const colors = getColorsByTipe(tipe);
  
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <span className={`inline-flex items-center ${colors.badgeBg} ${colors.textColor} font-medium rounded-full ${sizeClasses[size]} whitespace-nowrap`}>
      {tipe}
    </span>
  );
};

export default TipeBadge;

