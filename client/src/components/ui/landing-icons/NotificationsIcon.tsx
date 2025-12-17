import React from 'react';

export const NotificationsIcon: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bell clapper - yellow, fully filled U-shape, positioned BEHIND the bell */}
      <path
        fill="#FCD34D"
        d="M 19 29 L 29 29 L 29 36.5 C 29 39.2, 26.8 41.5, 24 41.5 C 21.2 41.5, 19 39.2, 19 36.5 L 19 29 Z"
        fillOpacity="1"
        fillRule="nonzero"
      />
      {/* Red bell body */}
      <path
        fill="#E63946"
        d="M 24 6 C 19 6, 15 10, 15 15 L 15 19 C 15 21, 13 25, 11 27 L 11 33 L 37 33 L 37 27 C 35 25, 33 21, 33 19 L 33 15 C 33 10, 29 6, 24 6 Z"
        fillOpacity="1"
        fillRule="nonzero"
      />
      {/* Bell inner left side - lighter red */}
      <path
        fill="#EF7F72"
        d="M 15 19 C 15 21, 13 25, 11 27 L 11 33 L 24 33 L 24 19 C 24 17, 20 15, 15 19 Z"
        fillOpacity="1"
        fillRule="nonzero"
      />
      {/* Bell inner right side - darker red */}
      <path
        fill="#DC2626"
        d="M 33 19 C 33 21, 35 25, 37 27 L 37 33 L 24 33 L 24 19 C 24 17, 28 15, 33 19 Z"
        fillOpacity="1"
        fillRule="nonzero"
      />
      {/* Bell dark red outline */}
      <path
        fill="#DC2626"
        d="M 24 4 C 18 4, 13 8, 13 15 L 13 19 C 13 21.5, 11 25.5, 9 27.5 L 9 35 L 39 35 L 39 27.5 C 37 25.5, 35 21.5, 35 19 L 35 15 C 35 8, 30 4, 24 4 Z M 24 6 C 19 6, 15 10, 15 15 L 15 19 C 15 21, 13 25, 11 27 L 11 33 L 37 33 L 37 27 C 35 25, 33 21, 33 19 L 33 15 C 33 10, 29 6, 24 6 Z"
        fillOpacity="1"
        fillRule="nonzero"
      />
    </svg>
  );
};

