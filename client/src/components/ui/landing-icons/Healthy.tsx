import React from 'react';

export const Healthy: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
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
      
      {/* Green peas */}
      <circle cx="18" cy="24" r="3" fill="#10B981"/>
      <circle cx="24" cy="22" r="3" fill="#10B981"/>
      <circle cx="30" cy="24" r="3" fill="#10B981"/>
      <circle cx="20" cy="28" r="2.5" fill="#10B981"/>
      <circle cx="28" cy="28" r="2.5" fill="#10B981"/>
      
      {/* Yellow melon/fruit slices */}
      <ellipse cx="16" cy="30" rx="4" ry="2.5" fill="#FCD34D" transform="rotate(-20 16 30)"/>
      <ellipse cx="32" cy="30" rx="4" ry="2.5" fill="#FCD34D" transform="rotate(20 32 30)"/>
      <ellipse cx="24" cy="32" rx="3.5" ry="2" fill="#FCD34D"/>
    </svg>
  );
};


