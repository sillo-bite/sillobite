import { TrendingUp, ShoppingBag, Flame, Activity, ArrowUp, ArrowDown, BarChart3, DollarSign, Clock, Users } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useState } from "react";

// Chart data
const chartData = [
  { day: "Mon", value: 18.5, height: 45 },
  { day: "Tue", value: 25.2, height: 62 },
  { day: "Wed", value: 22.0, height: 55 },
  { day: "Thu", value: 31.5, height: 78 },
  { day: "Fri", value: 26.0, height: 65 },
  { day: "Sat", value: 35.5, height: 88 },
  { day: "Sun", value: 29.0, height: 72 },
];

const weeklyTrend = 8.2;

export const AnalyticsSection = () => {
  const { ref, isVisible } = useScrollAnimation();
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  return (
    <section className="section-padding bg-gradient-to-b from-background to-card/30">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Data-Driven{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Insights
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Access intelligent business intelligence with real-time analytics across all your institutional dining locations.
          </p>
        </div>

        {/* Modern Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Main Dashboard Card - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Bar */}
            <div
              className={`bg-gradient-to-br from-card via-card to-card/95 rounded-3xl border border-border/50 p-6 shadow-xl transition-all duration-700 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "150ms" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 flex items-center justify-center border border-primary/30 shadow-lg">
                    <BarChart3 className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-2xl text-foreground">Performance Overview</h3>
                    <p className="text-sm text-muted-foreground">Real-time business metrics</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Data
                </div>
              </div>

              {/* Modern Chart */}
              <div className="bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl p-6 border border-border/30">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="font-heading font-semibold text-lg text-foreground mb-1">Revenue Trend</h4>
                    <p className="text-xs text-muted-foreground">Last 7 days performance</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      weeklyTrend > 0
                        ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"
                        : "text-rose-400 bg-rose-400/10 border border-rose-400/20"
                    }`}>
                      {weeklyTrend > 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      <span>{Math.abs(weeklyTrend).toFixed(1)}% vs last week</span>
                    </div>
                  </div>
                </div>

                {/* Modern Bar Chart */}
                <div className="relative h-64">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                    <span className="text-right">40K</span>
                    <span className="text-right">30K</span>
                    <span className="text-right">20K</span>
                    <span className="text-right">10K</span>
                    <span className="text-right">0K</span>
                  </div>

                  {/* Chart Area */}
                  <div className="ml-14 h-full flex items-end gap-2">
                    {chartData.map((data, i) => {
                      const isToday = i === chartData.length - 1;
                      const isHovered = hoveredBar === i;
                      const barHeight = `${data.height}%`;

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center group cursor-pointer"
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute bottom-full mb-2 bg-neutral-900/95 backdrop-blur-sm text-foreground text-xs px-3 py-2 rounded-lg shadow-xl border border-border/50 z-20 whitespace-nowrap">
                              <div className="font-semibold">{data.day} — ₹{data.value.toFixed(1)}K</div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900/95" />
                            </div>
                          )}

                          {/* Bar */}
                          <div
                            className={`w-full rounded-t-lg transition-all duration-300 relative ${
                              isToday
                                ? "bg-gradient-to-t from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/30"
                                : "bg-gradient-to-t from-primary/70 via-primary/60 to-primary/50"
                            } ${isHovered ? "scale-105" : ""}`}
                            style={{ height: barHeight }}
                          >
                            {/* Glow effect on today */}
                            {isToday && (
                              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-t-lg" />
                            )}
                          </div>

                          {/* Day Label */}
                          <div className="mt-2 text-center">
                            <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                              {data.day}
                            </div>
                            {isToday && (
                              <div className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full mt-1">
                                Today
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Stats Column */}
          <div className="space-y-6">
            {/* Revenue Card */}
            <div
              className={`bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl border border-primary/20 p-6 shadow-xl transition-all duration-700 ease-out hover:scale-[1.02] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/30">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-1 rounded-full">
                  <ArrowUp className="w-3 h-3" />
                  <span>+8%</span>
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-foreground mb-1">₹24.8K</div>
              <div className="text-sm text-muted-foreground font-medium">Today's Revenue</div>
            </div>

            {/* Orders Card */}
            <div
              className={`bg-gradient-to-br from-card via-card to-card/95 rounded-3xl border border-border/50 p-6 shadow-xl transition-all duration-700 ease-out hover:scale-[1.02] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center border border-secondary/30">
                  <ShoppingBag className="w-6 h-6 text-secondary" />
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">
                  <ArrowUp className="w-3 h-3" />
                  <span>+12%</span>
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-foreground mb-1">384</div>
              <div className="text-sm text-muted-foreground font-medium">Daily Orders</div>
            </div>

            {/* Live Orders Card */}
            <div
              className={`bg-gradient-to-br from-card via-card to-card/95 rounded-3xl border border-border/50 p-6 shadow-xl transition-all duration-700 ease-out hover:scale-[1.02] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/30">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              </div>
              <div className="text-4xl font-heading font-bold text-foreground mb-1">18</div>
              <div className="text-sm text-muted-foreground font-medium">Live Orders</div>
            </div>

            {/* Trending Item Card */}
            <div
              className={`bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent rounded-3xl border border-red-500/20 p-6 shadow-xl transition-all duration-700 ease-out hover:scale-[1.02] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-red-500/10 flex items-center justify-center border border-red-500/30">
                  <Flame className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded-full font-semibold">
                  Trending
                </div>
              </div>
              <div className="text-xl font-heading font-bold text-foreground mb-1">Chicken Biryani</div>
              <div className="text-sm text-muted-foreground font-medium">87 orders today</div>
            </div>
          </div>
        </div>

        {/* Additional Metrics Row */}
        <div
          className={`grid sm:grid-cols-3 gap-6 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "600ms" }}
        >
          <div className="bg-gradient-to-br from-card via-card to-card/95 rounded-2xl border border-border/50 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-muted-foreground">Peak Hours</span>
            </div>
            <div className="text-2xl font-heading font-bold text-foreground">12:00 PM</div>
            <div className="text-xs text-muted-foreground mt-1">Most active time</div>
          </div>

          <div className="bg-gradient-to-br from-card via-card to-card/95 rounded-2xl border border-border/50 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-secondary" />
              <span className="text-sm font-semibold text-muted-foreground">Avg. Order Value</span>
            </div>
            <div className="text-2xl font-heading font-bold text-foreground">₹64.50</div>
            <div className="text-xs text-muted-foreground mt-1">Per transaction</div>
          </div>

          <div className="bg-gradient-to-br from-card via-card to-card/95 rounded-2xl border border-border/50 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-muted-foreground">Growth Rate</span>
            </div>
            <div className="text-2xl font-heading font-bold text-foreground">+15.2%</div>
            <div className="text-xs text-muted-foreground mt-1">This month</div>
          </div>
        </div>
      </div>
    </section>
  );
};
