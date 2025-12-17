import React from "react";

const TestPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Welcome!</h1>
          <p className="text-xl text-muted-foreground">
            This is the test page. You've successfully navigated here!
          </p>
        </div>
      </div>

      {/* Animated water background at the bottom */}
      <div className="relative w-full h-64 overflow-hidden">
        {/* Water waves */}
        <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden">
          {/* Wave 1 - Deep red */}
          <svg
            className="absolute bottom-0 left-0 w-full h-full wave-animation-1"
            viewBox="-400 0 4800 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e93925" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#c52e1f" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path
              d="M-400,100 Q-250,10 -100,100 Q50,190 200,100 Q350,10 500,100 Q650,190 800,100 Q950,10 1100,100 Q1250,190 1400,100 Q1550,10 1700,100 Q1850,190 2000,100 Q2150,10 2300,100 Q2450,190 2600,100 Q2750,10 2900,100 Q3050,190 3200,100 Q3350,10 3500,100 Q3650,190 3800,100 Q3950,10 4100,100 Q4250,190 4400,100 L4400,200 L-400,200 Z"
              fill="url(#gradient1)"
              opacity="0.8"
            />
          </svg>

          {/* Wave 2 - Medium red */}
          <svg
            className="absolute bottom-0 left-0 w-full h-full wave-animation-2"
            viewBox="-1200 0 4000 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f55a4a" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#e93925" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <path
              d="M-1200,120 Q-1000,20 -800,120 Q-600,200 -400,120 Q-200,20 0,120 Q200,200 400,120 Q600,20 800,120 Q1000,200 1200,120 Q1400,20 1600,120 Q1800,200 2000,120 Q2200,20 2400,120 Q2600,200 2800,120 L2800,200 L-1200,200 Z"
              fill="url(#gradient2)"
              opacity="0.6"
            />
          </svg>

        </div>
      </div>

      <style>{`
        @keyframes wave1 {
          0% {
            transform: translateX(0) translateY(0) scaleY(1);
          }
          25% {
            transform: translateX(-20px) translateY(2px) scaleY(1.02);
          }
          50% {
            transform: translateX(-40px) translateY(0) scaleY(1);
          }
          75% {
            transform: translateX(-20px) translateY(-2px) scaleY(0.98);
          }
          100% {
            transform: translateX(0) translateY(0) scaleY(1);
          }
        }

        @keyframes wave2 {
          0% {
            transform: translateX(0) translateY(0) scaleY(1);
          }
          25% {
            transform: translateX(20px) translateY(-1px) scaleY(0.99);
          }
          50% {
            transform: translateX(40px) translateY(0) scaleY(1);
          }
          75% {
            transform: translateX(20px) translateY(1px) scaleY(1.01);
          }
          100% {
            transform: translateX(0) translateY(0) scaleY(1);
          }
        }

        .wave-animation-1 {
          animation: wave1 7s ease-in-out infinite;
        }

        .wave-animation-2 {
          animation: wave2 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TestPage;

