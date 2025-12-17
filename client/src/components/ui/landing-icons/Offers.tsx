import React from 'react';

export const Offers: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blue price tag */}
      <path
        d="M 12 12 L 24 12 L 36 24 L 24 36 L 12 24 Z"
        fill="#3B82F6"
      />
      <path
        d="M 12 12 L 24 12 L 36 24 L 24 36 L 12 24 Z"
        stroke="#1E40AF"
        strokeWidth="1"
        fill="none"
      />
      
      {/* White percentage symbol */}
      <circle cx="18" cy="20" r="2.5" fill="#FFFFFF"/>
      <circle cx="30" cy="28" r="2.5" fill="#FFFFFF"/>
      <line x1="16" y1="28" x2="32" y2="20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Sparkling stars */}
      <path
        d="M 20 8 L 20.5 9.5 L 22 10 L 20.5 10.5 L 20 12 L 19.5 10.5 L 18 10 L 19.5 9.5 Z"
        fill="#FFFFFF"
        opacity="0.8"
      />
      <path
        d="M 28 6 L 28.5 7.5 L 30 8 L 28.5 8.5 L 28 10 L 27.5 8.5 L 26 8 L 27.5 7.5 Z"
        fill="#FFFFFF"
        opacity="0.8"
      />
      <path
        d="M 36 14 L 36.5 15.5 L 38 16 L 36.5 16.5 L 36 18 L 35.5 16.5 L 34 16 L 35.5 15.5 Z"
        fill="#FFFFFF"
        opacity="0.8"
      />
    </svg>
  );
};


