import React from 'react';

export const QuickOrder: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Lightning bolt for quick/fast ordering */}
      <path
        d="M 24 6 L 16 24 L 22 24 L 18 42 L 32 18 L 26 18 Z"
        fill="#E63946"
        stroke="#DC2626"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Speed lines/particles */}
      <circle cx="34" cy="10" r="1.5" fill="#FCD34D" opacity="0.9"/>
      <circle cx="38" cy="8" r="1" fill="#FCD34D" opacity="0.7"/>
      <circle cx="14" cy="28" r="1" fill="#FCD34D" opacity="0.7"/>
    </svg>
  );
};

