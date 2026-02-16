import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, PieChart, Users, Smartphone, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

export const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] bg-[#FFFBF7] overflow-hidden pt-32 pb-20">
      {/* Abstract Background Blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#9847D1] opacity-10 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#FFB17A] opacity-10 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/4 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#2D3748] mb-6 leading-tight"
          >
            Streamline Campus & Corporate Dining with <span className="text-[#9847D1]">SilloBite.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto"
          >
            A complete multi-vendor management platform for modern cafeterias.
            Contactless ordering, powerful admin controls, and seamless vendor operations.
          </motion.p>
        </div>

        {/* Hero Visual Composition */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative max-w-5xl mx-auto h-[400px] md:h-[500px] lg:h-[600px]"
        >
          {/* Dashboard Mockup (Back) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full md:w-[90%] h-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden hidden md:block">
            {/* Dashboard Header */}
            <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            {/* Dashboard Content Mockup */}
            <div className="p-6 grid grid-cols-12 gap-6 bg-gray-50/50 h-full">
              <div className="col-span-2 space-y-4">
                <div className="h-8 w-full bg-purple-100 rounded-md" />
                <div className="h-4 w-3/4 bg-gray-200 rounded-md" />
                <div className="h-4 w-5/6 bg-gray-200 rounded-md" />
                <div className="h-4 w-4/6 bg-gray-200 rounded-md" />
              </div>
              <div className="col-span-10 grid grid-cols-3 gap-6">
                {/* Stats Cards */}
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">Total Revenue</span>
                    <BarChart3 className="w-4 h-4 text-[#9847D1]" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">$12,450</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">Orders</span>
                    <ShoppingBag className="w-4 h-4 text-[#FFB17A]" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">1,240</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">Active Users</span>
                    <Users className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">856</div>
                </div>

                {/* Main Chart Area */}
                <div className="col-span-2 bg-white p-4 rounded-xl shadow-sm h-64 flex items-end gap-4 justify-between px-8 pb-4">
                  {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                    <div key={i} className="w-8 bg-purple-100 rounded-t-md relative group">
                      <div className="absolute bottom-0 w-full bg-[#FFB17A] rounded-t-md transition-all duration-1000" style={{ height: `${h}%` }} />
                    </div>
                  ))}
                </div>
                {/* Pie Chart Area */}
                <div className="col-span-1 bg-white p-4 rounded-xl shadow-sm h-64 flex items-center justify-center relative">
                  <div className="w-32 h-32 rounded-full border-[12px] border-[#9847D1] border-r-transparent rotate-45" />
                  <div className="absolute text-center">
                    <span className="text-2xl font-bold text-gray-800">85%</span>
                    <span className="block text-xs text-gray-400">Satisfaction</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile App Mockup (Front) */}
          <div className="absolute bottom-0 left-1/2 md:-translate-x-[120px] -translate-x-1/2 translate-y-20 w-[280px] h-[580px] bg-gray-900 rounded-[40px] border-8 border-gray-900 shadow-2xl overflow-hidden z-20 md:translate-y-12">
            <div className="w-full h-full bg-white relative">
              {/* Status Bar */}
              <div className="h-8 bg-gray-100 flex items-center justify-between px-4 text-[10px] text-gray-500 font-medium">
                <span>9:41</span>
                <div className="flex gap-1">
                  <div className="w-4 h-3 bg-gray-300 rounded-sm" />
                  <div className="w-4 h-3 bg-gray-300 rounded-sm" />
                </div>
              </div>

              {/* App Content */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-6">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="text-sm font-bold text-gray-800">SilloBite</div>
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 leading-tight mb-2">What would you like to eat?</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    <div className="px-4 py-2 bg-[#9847D1] text-white rounded-full text-xs whitespace-nowrap">All</div>
                    <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-xs whitespace-nowrap">Pizza</div>
                    <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-xs whitespace-nowrap">Burger</div>
                    <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-xs whitespace-nowrap">Asian</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4 p-3 rounded-xl bg-white shadow-md border border-gray-50/50">
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">Spicy Chicken Burger</h4>
                        <p className="text-xs text-gray-400 mb-2">Fast Food • 20 min</p>
                        <div className="flex justify-between items-center w-32">
                          <span className="font-bold text-[#9847D1]">$8.50</span>
                          <div className="w-6 h-6 bg-[#FFB17A] rounded-full flex items-center justify-center text-white text-xs">+</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="absolute bottom-0 w-full h-16 bg-white border-t border-gray-100 flex justify-around items-center px-6 text-gray-300">
                <div className="text-[#9847D1]"><Smartphone className="w-6 h-6" /></div>
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Purple Wave Divider */}
      <div className="absolute bottom-0 left-0 w-full leading-none z-20">
        <svg className="block w-full h-24 md:h-32 lg:h-48" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#FFB17A" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>
    </section>
  );
};
