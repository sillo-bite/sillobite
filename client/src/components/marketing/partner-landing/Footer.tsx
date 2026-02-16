import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-[#1a1510] text-white pt-20 pb-10 border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          {/* Brand & Newsletter */}
          <div className="md:col-span-1 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFB17A] to-[#9847D1] flex items-center justify-center text-white font-bold text-lg">
                C
              </div>
              <span className="text-xl font-bold">
                Cafeteria <span className="text-[#FFB17A]">SaaS</span>
              </span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Our lab is filling your cafe with delicious dining efficiency.
              Integrated ordering, analytics and contactless delivery.
            </p>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="font-bold mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-white/60">
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Launch</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Career</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Fast Food</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-white/60">
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Institutional</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Central</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Email</a></li>
              <li><a href="#" className="hover:text-[#9847D1] transition-colors">Phone</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="md:col-span-1">
            <h4 className="font-bold mb-6">Newsletter</h4>
            <div className="relative">
              <Input
                placeholder="Enter your address"
                className="bg-white/10 border-white/10 text-white placeholder:text-white/40 rounded-full pr-12 focus:bg-white/20 transition-all"
              />
              <Button
                size="icon"
                className="absolute right-1 top-1 w-8 h-8 rounded-full bg-[#9847D1] hover:bg-[#E05E15]"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-white/40 mt-3">
              Subscribe to our creative newsletter.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/40">
          <p>© {new Date().getFullYear()} SilloBite. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
