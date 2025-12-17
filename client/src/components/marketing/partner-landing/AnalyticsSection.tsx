import { TrendingUp, ShoppingBag, Flame, Activity, ArrowUp, ArrowDown } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useState, useEffect } from "react";

// Chart data with trend information
const chartData = [
  { day: "Mon", value: 18.5, height: 45, trend: -2.3 },
  { day: "Tue", value: 25.2, height: 62, trend: 8.1 },
  { day: "Wed", value: 22.0, height: 55, trend: -5.2 },
  { day: "Thu", value: 31.5, height: 78, trend: 8.0 },
  { day: "Fri", value: 26.0, height: 65, trend: -3.4 },
  { day: "Sat", value: 35.5, height: 88, trend: 12.5 },
  { day: "Sun", value: 29.0, height: 72, trend: 8.2 },
];

const yAxisTicks = [0, 10, 20, 30, 40];

// Overall weekly trend (fake static value)
const weeklyTrend = 8.2;

// Hook to check for reduced motion preference
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};

const ChartComponent = ({ isVisible }: { isVisible: boolean }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartHeight, setChartHeight] = useState(128); // h-32 = 128px (mobile default)
  const prefersReducedMotion = useReducedMotion();

  // Update chart height based on screen size
  useEffect(() => {
    const updateHeight = () => {
      // h-32 = 128px (8rem), h-40 = 160px (10rem)
      setChartHeight(window.innerWidth >= 640 ? 160 : 128);
    };
    
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const numBars = chartData.length;
  const todayIndex = chartData.length - 1; // Last day (Sun) is "Today"

  // Calculate positions for the connecting line (in percentage)
  const getBarCenterX = (index: number) => {
    const barWidth = 100 / numBars;
    return (index * barWidth) + (barWidth / 2);
  };

  const linePoints = chartData.map((data, i) => {
    const x = getBarCenterX(i);
    const y = 100 - (data.height / 100) * 100; // Convert to percentage
    return `${x},${y}`;
  }).join(" ");

  // Area fill points
  const areaPoints = `0,100 ${linePoints} 100,100`;

  // Handle mobile tap
  const handleBarClick = (index: number) => {
    if (hoveredIndex === index) {
      setHoveredIndex(null);
    } else {
      setHoveredIndex(index);
    }
  };

  // Handle keyboard navigation
  const handleBarKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBarClick(index);
    } else if (e.key === "Escape") {
      setHoveredIndex(null);
    }
  };

  return (
    <div className="relative">
      {/* Y-axis and Grid */}
      <div className="flex gap-3 mb-2">
        {/* Y-axis labels - responsive font size */}
        <div className="flex flex-col justify-between h-32 sm:h-40 w-8 sm:w-10 text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
          {yAxisTicks.map((tick) => (
            <span key={tick} className="text-right pr-1 sm:pr-2">
              {tick}K
            </span>
          ))}
        </div>

        {/* Chart area with grid and bars - responsive height */}
        <div className="flex-1 relative h-32 sm:h-40">
          {/* Grid lines - improved with more subtle styling */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {yAxisTicks.map((tick, idx) => {
              if (idx === yAxisTicks.length - 1) return null; // Skip bottom line
              const position = (idx / (yAxisTicks.length - 1)) * 100;
              return (
                <div
                  key={tick}
                  className="absolute w-full h-px border-t border-white/5"
                  style={{ top: `${position}%` }}
                />
              );
            })}
          </div>

          {/* Connecting line and area (SVG overlay) - animated on scroll */}
          <svg
            className={`absolute inset-0 w-full h-full pointer-events-none transition-all duration-700 ease-out ${
              isVisible && !prefersReducedMotion
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
            style={{ 
              zIndex: 1,
              transitionDelay: prefersReducedMotion ? "0ms" : "600ms"
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Area fill under line */}
            <polygon
              points={areaPoints}
              fill="hsl(var(--secondary))"
              fillOpacity="0.1"
            />
            {/* Connecting line */}
            <polyline
              points={linePoints}
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="0.5"
              strokeOpacity="0.7"
            />
          </svg>

          {/* Bars with dots */}
          <div className="absolute inset-0 flex items-end gap-1.5 px-1">
            {chartData.map((data, i) => {
              const barHeight = (data.height / 100) * chartHeight;
              const isHovered = hoveredIndex === i;
              const isToday = i === todayIndex;
              const trend = data.trend;
              const isPositiveTrend = trend > 0;

              // Generate aria-label for accessibility
              const ariaLabel = `${data.day}: ₹${data.value.toFixed(1)}K, ${isPositiveTrend ? "up" : "down"} ${Math.abs(trend).toFixed(1)}% vs last week`;

              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  className="flex-1 flex flex-col items-center relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-t"
                  style={{ height: `${chartHeight}px` }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleBarClick(i)}
                  onKeyDown={(e) => handleBarKeyDown(e, i)}
                >
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t transition-all duration-300 relative ${
                      isVisible && !prefersReducedMotion ? "scale-y-100" : "scale-y-0"
                    } ${isHovered ? "scale-105" : ""} ${
                      isToday ? "shadow-[0_0_25px_rgba(248,113,113,0.35)]" : ""
                    }`}
                    style={{
                      height: `${barHeight}px`,
                      background: isToday
                        ? "linear-gradient(to top, hsl(var(--primary) / 0.75), hsl(var(--primary) / 0.95))"
                        : "linear-gradient(to top, hsl(var(--primary) / 0.6), hsl(var(--primary)))",
                      transitionDelay: prefersReducedMotion ? "0ms" : `${500 + i * 50}ms`,
                      transformOrigin: "bottom",
                      transitionDuration: prefersReducedMotion ? "0ms" : "500ms",
                    }}
                  >
                    {/* Dot on top of bar */}
                    <div
                      className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background transition-all ${
                        isHovered ? "scale-125" : ""
                      }`}
                    />
                  </div>

                  {/* Tooltip - Enhanced with trend - mobile-safe positioning */}
                  {isHovered && (
                    <div
                      className="absolute z-20 bg-neutral-900/95 backdrop-blur-sm text-foreground text-xs px-3 py-2 rounded-lg shadow-xl border border-border/50 max-w-[140px] sm:max-w-none sm:whitespace-nowrap"
                      style={{
                        left: "50%",
                        transform: "translateX(-50%)",
                        bottom: "100%",
                        marginBottom: "8px",
                        maxWidth: "min(140px, calc(100vw - 16px))",
                      }}
                    >
                      <div className="font-medium">
                        {data.day} — ₹{data.value.toFixed(1)}K
                      </div>
                      <div
                        className={`flex items-center gap-1 mt-1 ${
                          isPositiveTrend ? "text-emerald-400" : "text-rose-400"
                        } ${isToday ? "font-semibold" : ""}`}
                      >
                        {isPositiveTrend ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        <span>
                          {Math.abs(trend).toFixed(1)}% vs last week
                        </span>
                      </div>
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900/95" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-3 mt-2">
        <div className="w-10" /> {/* Spacer for Y-axis */}
        <div className="flex-1 flex justify-between px-1">
          {chartData.map((data, i) => {
            const isToday = i === todayIndex;
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className={`text-xs text-muted-foreground text-center ${isToday ? "font-medium" : ""}`}>
                  {data.day}
                </span>
                {isToday && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full mt-1">
                    Today
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend - Improved UI - responsive font size */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-border/30 flex-wrap">
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full hover:bg-muted/30 transition-colors cursor-default">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">Revenue</span>
        </div>
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full hover:bg-muted/30 transition-colors cursor-default">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-secondary" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">Trend</span>
        </div>
      </div>
    </div>
  );
};

export const AnalyticsSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Powerful <span className="text-red-600">Analytics</span> at Your Fingertips
          </h2>
          <p className="text-lg text-muted-foreground">
            Get real-time insights into orders, revenue, and trending items across all your{" "}
            institutional cafeterias & canteens.
          </p>
        </div>

        {/* Dashboard Preview */}
        <div
          className={`bg-black/40 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-soft transition-all duration-600 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "150ms" }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">Analytics Dashboard</h3>
                <p className="text-xs text-muted-foreground">Real-time overview</p>
              </div>
            </div>
            {/* Live Indicator - Enhanced */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {/* Daily Orders */}
            <div
              className={`bg-card rounded-xl p-5 border border-border transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "250ms" }}
            >
              <div className="flex items-center justify-between mb-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary font-medium">+12%</span>
              </div>
              <div className="text-3xl font-heading font-bold text-foreground mb-1">384</div>
              <div className="text-sm text-muted-foreground">Daily Orders</div>
            </div>

            {/* Revenue */}
            <div
              className={`bg-card rounded-xl p-5 border border-border transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-secondary" />
                <span className="text-xs text-secondary font-medium">+8%</span>
              </div>
              <div className="text-3xl font-heading font-bold text-foreground mb-1">₹24.8K</div>
              <div className="text-sm text-muted-foreground">Today's Revenue</div>
            </div>

            {/* Top Item */}
            <div
              className={`bg-card rounded-xl p-5 border border-border transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "350ms" }}
            >
              <div className="flex items-center justify-between mb-3">
                <Flame className="w-5 h-5 text-red-600" />
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Trending</span>
              </div>
              <div className="text-lg font-heading font-bold text-foreground mb-1">Chicken Biryani</div>
              <div className="text-sm text-muted-foreground">87 orders today</div>
            </div>

            {/* Live Orders */}
            <div
              className={`bg-card rounded-xl p-5 border border-border transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="flex items-center justify-between mb-3">
                <Activity className="w-5 h-5 text-primary" />
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              </div>
              <div className="text-3xl font-heading font-bold text-foreground mb-1">18</div>
              <div className="text-sm text-muted-foreground">Live Orders</div>
            </div>
          </div>

          {/* Chart representation */}
          <div
            className={`bg-muted/30 rounded-xl p-6 transition-all duration-500 ease-out ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "450ms" }}
          >
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <span className="text-sm font-medium text-foreground">Revenue – Last 7 Days</span>
                <div className="flex items-center gap-3">
                  {/* Trend Badge */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      weeklyTrend > 0
                        ? "text-emerald-400 bg-emerald-400/10"
                        : "text-rose-400 bg-rose-400/10"
                    }`}
                  >
                    {weeklyTrend > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    <span>{Math.abs(weeklyTrend).toFixed(1)}% vs last week</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Weekly</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Based on completed, paid orders.</p>
            </div>

            {/* Mini Chart */}
            <ChartComponent isVisible={isVisible} />

            {/* Optional: Metric Toggle (commented out for now, can be enabled) */}
            {/* <div className="mt-4 flex justify-end">
              <MetricToggle selectedMetric={selectedMetric} onMetricChange={setSelectedMetric} />
            </div> */}

            {/* Optional: Payment Type Chart (commented out for now, can be enabled) */}
            {/* <PaymentTypeChart /> */}

            {/* Optional: Top Items List (commented out for now, can be enabled) */}
            {/* <TopItemsList /> */}
          </div>
        </div>
      </div>
    </section>
  );
};
