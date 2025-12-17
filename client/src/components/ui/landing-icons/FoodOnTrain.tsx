import React from 'react';

export const FoodOnTrain: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Train car body - blue */}
      <rect x="8" y="18" width="32" height="16" rx="2" fill="#3B82F6"/>
      
      {/* Train windows - white */}
      <rect x="12" y="20" width="6" height="6" rx="1" fill="#FFFFFF"/>
      <rect x="20" y="20" width="6" height="6" rx="1" fill="#FFFFFF"/>
      <rect x="28" y="20" width="6" height="6" rx="1" fill="#FFFFFF"/>
      
      {/* Train wheels */}
      <circle cx="14" cy="36" r="3" fill="#1E40AF"/>
      <circle cx="34" cy="36" r="3" fill="#1E40AF"/>
      <circle cx="14" cy="36" r="1.5" fill="#FFFFFF"/>
      <circle cx="34" cy="36" r="1.5" fill="#FFFFFF"/>
      
      {/* Train details */}
      <rect x="8" y="18" width="32" height="2" fill="#1E40AF"/>
      <rect x="8" y="32" width="32" height="2" fill="#1E40AF"/>
    </svg>
  );
};


