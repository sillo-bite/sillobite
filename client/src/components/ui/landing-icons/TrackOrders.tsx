import React from 'react';

export const TrackOrders: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blue location pin */}
      <path
        d="M 24 8 C 18 8, 14 14, 14 20 C 14 26, 24 38, 24 38 C 24 38, 34 26, 34 20 C 34 14, 30 8, 24 8 Z"
        fill="#3B82F6"
        stroke="#1E40AF"
        strokeWidth="1.5"
      />
      {/* White circle */}
      <circle cx="24" cy="20" r="6" fill="#FFFFFF"/>
      {/* Blue dot in center */}
      <circle cx="24" cy="20" r="3" fill="#3B82F6"/>
    </svg>
  );
};

