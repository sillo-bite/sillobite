import React from 'react';

export const PlanAParty: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Disco ball background */}
      <circle cx="24" cy="24" r="22" fill="#F3F4F6"/>
      <circle cx="24" cy="24" r="20" fill="#E5E7EB"/>
      
      {/* Disco ball pattern */}
      <circle cx="18" cy="18" r="1.5" fill="#9CA3AF"/>
      <circle cx="24" cy="16" r="1.5" fill="#9CA3AF"/>
      <circle cx="30" cy="18" r="1.5" fill="#9CA3AF"/>
      <circle cx="20" cy="24" r="1.5" fill="#9CA3AF"/>
      <circle cx="28" cy="24" r="1.5" fill="#9CA3AF"/>
      <circle cx="18" cy="30" r="1.5" fill="#9CA3AF"/>
      <circle cx="24" cy="32" r="1.5" fill="#9CA3AF"/>
      <circle cx="30" cy="30" r="1.5" fill="#9CA3AF"/>
      
      {/* White plate */}
      <ellipse cx="24" cy="28" rx="14" ry="8" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1"/>
      
      {/* Red drinks */}
      <rect x="16" y="20" width="4" height="8" rx="2" fill="#E63946"/>
      <rect x="28" y="20" width="4" height="8" rx="2" fill="#E63946"/>
      
      {/* Bread slices */}
      <ellipse cx="20" cy="26" rx="3" ry="2" fill="#FCD34D" transform="rotate(-15 20 26)"/>
      <ellipse cx="24" cy="25" rx="3" ry="2" fill="#FCD34D"/>
      <ellipse cx="28" cy="26" rx="3" ry="2" fill="#FCD34D" transform="rotate(15 28 26)"/>
    </svg>
  );
};


