import React from 'react';

export const Gourmet: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* White plate */}
      <ellipse cx="24" cy="28" rx="18" ry="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1"/>
      <ellipse cx="24" cy="28" rx="16" ry="10" fill="#F9FAFB"/>
      
      {/* Pasta (spaghetti) */}
      <path
        d="M 12 24 Q 16 22, 20 24 T 28 24 T 36 24"
        stroke="#F59E0B"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 12 26 Q 16 24, 20 26 T 28 26 T 36 26"
        stroke="#F59E0B"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 12 28 Q 16 26, 20 28 T 28 28 T 36 28"
        stroke="#F59E0B"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Sauce/garnish */}
      <circle cx="20" cy="26" r="2" fill="#DC2626"/>
      <circle cx="28" cy="26" r="2" fill="#DC2626"/>
      <circle cx="24" cy="24" r="1.5" fill="#059669"/>
      <circle cx="18" cy="28" r="1" fill="#059669"/>
      <circle cx="30" cy="28" r="1" fill="#059669"/>
    </svg>
  );
};


