import React from 'react';

export const Collections: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stack of cards/items - Back card */}
      <rect x="12" y="20" width="24" height="18" rx="2" fill="#E63946" fillOpacity="0.15" transform="rotate(-2 24 29)"/>
      
      {/* Middle card */}
      <rect x="12" y="16" width="24" height="18" rx="2" fill="#E63946" fillOpacity="0.25" transform="rotate(1 24 25)"/>
      
      {/* Front card */}
      <rect x="12" y="12" width="24" height="18" rx="2" fill="#E63946" fillOpacity="0.35"/>
      <rect x="12" y="12" width="24" height="18" rx="2" fill="none" stroke="#E63946" strokeWidth="2"/>
      
      {/* Collection badge/star on front card */}
      <circle cx="30" cy="18" r="4" fill="#E63946"/>
      <path
        d="M 30 15 L 30.8 17.2 L 33 17.5 L 31.2 19.1 L 31.6 21.5 L 30 20.4 L 28.4 21.5 L 28.8 19.1 L 27 17.5 L 29.2 17.2 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};


