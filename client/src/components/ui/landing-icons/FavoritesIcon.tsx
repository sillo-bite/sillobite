import React from 'react';

export const FavoritesIcon: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red heart icon */}
      <path
        d="M 24 38 C 24 38, 8 26, 8 18 C 8 12, 12 8, 18 8 C 20 8, 22 9, 24 11 C 26 9, 28 8, 30 8 C 36 8, 40 12, 40 18 C 40 26, 24 38, 24 38 Z"
        fill="#E63946"
        stroke="#DC2626"
        strokeWidth="1.5"
      />
    </svg>
  );
};

