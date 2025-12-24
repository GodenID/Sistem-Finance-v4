import React from 'react';
import { getCompanyColors } from '../constants/companyTypes';

const CompanyBadge = ({ value, showId = true, size = 'md' }) => {
  const colors = getCompanyColors(value);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const idSizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1'
  };

  return (
    <div className="flex items-center space-x-2">
      {showId && colors.id && (
        <span className={`${colors.darkColor} text-white font-bold rounded ${idSizeClasses[size]}`}>
          {colors.id}
        </span>
      )}
      <span className={`${colors.badgeBg} ${colors.textColor} font-medium rounded-full ${sizeClasses[size]} whitespace-nowrap`}>
        {value}
      </span>
    </div>
  );
};

export default CompanyBadge;

