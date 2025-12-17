import React from 'react';

export const LeafIcon: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      {/* Yellow leaf symbol - leaf shape (oval with pointed bottom) */}
      <ellipse cx="12" cy="10" rx="4" ry="3.5" fill="#FCD34D" fillOpacity="1"/>
      <path fill="#FCD34D" d="M 8 13.5 L 12 20 L 16 13.5 Z" fillOpacity="1" fillRule="evenodd"/>
      {/* Leaf center vein - darker yellow/orange */}
      <line x1="12" y1="6.5" x2="12" y2="20" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.9"/>
    </svg>
  );
};

