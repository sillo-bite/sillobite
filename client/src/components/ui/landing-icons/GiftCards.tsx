import React from 'react';

export const GiftCards: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* First envelope (back) */}
      <rect x="10" y="16" width="20" height="16" rx="2" fill="#E63946" opacity="0.9"/>
      <path d="M 10 16 L 20 22 L 30 16" stroke="#DC2626" strokeWidth="1.5" fill="none"/>
      
      {/* Second envelope (front, partially open) */}
      <rect x="18" y="12" width="20" height="16" rx="2" fill="#E63946"/>
      <path d="M 18 12 L 28 18 L 38 12" stroke="#DC2626" strokeWidth="1.5" fill="none"/>
      
      {/* Gold card visible in open envelope */}
      <rect x="20" y="16" width="14" height="10" rx="1" fill="#FCD34D"/>
      <rect x="20" y="16" width="14" height="10" rx="1" stroke="#F59E0B" strokeWidth="0.5"/>
      
      {/* Red ribbon */}
      <rect x="26" y="10" width="4" height="20" rx="1" fill="#DC2626"/>
      <circle cx="28" cy="10" r="2" fill="#DC2626"/>
    </svg>
  );
};


