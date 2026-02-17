import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/ui/pagination";
import { VegIndicator } from "@/components/ui/VegIndicator";
import type { MenuItem, Category, Order } from "@shared/schema";
import { formatOrderIdDisplay } from "@shared/utils";
import SyncStatus from "@/components/common/SyncStatus";
import { useAuthSync } from "@/hooks/useDataSync";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { usePaginatedOrders } from "@/hooks/usePaginatedOrders";
import { usePaginatedActiveOrders } from "@/hooks/usePaginatedActiveOrders";
import { useOrderSearch } from "@/hooks/useOrderSearch";
import { useMultiCanteenWebSocket } from "@/hooks/useMultiCanteenWebSocket";
import BarcodeDisplay from "./BarcodeDisplay";
import PaymentCounterDashboard from "@/components/payment/PaymentCounterDashboard";
import { UpdateManager } from "@/utils/updateManager";
import { passiveUpdateDetector } from "@/utils/passiveUpdateDetector";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";
import {
  ChefHat,
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  Clock,
  Star,
  Settings,
  Plus,
  Edit3,
  Trash2,
  Package,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  ScanLine,
  X,
  RefreshCcw,
  Search,
  CalendarDays,
  ChevronDown,
  Filter,
  Loader2,
  Receipt,
  User,
  Maximize,
  Minimize,
  Menu,
  CreditCard,
  Truck,
  Gavel,
  LogOut,
  Info,
  Download,
  Sun,
  Moon,
  Monitor,
  QrCode,
  Camera,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import ContentManager from "@/components/canteen/ContentManager";
import CanteenOwnerMenuManagement from "@/components/canteen/CanteenOwnerMenuManagement";
import DeliveryManagement from "@/components/canteen/DeliveryManagement";
import PosBilling from "@/components/canteen/PosBilling";
import PayoutManagement from "@/components/canteen/PayoutManagement";
import PositionBidding from "@/components/canteen/PositionBidding";
import CanteenOwnerQRManager from "@/components/canteen/CanteenOwnerQRManager";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { compressImage } from "@/utils/imageCompression";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/utils/formatting";

// Sidebar Navigation Item Component
interface SidebarNavItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  collapsed?: boolean;
}

function SidebarNavItem({ icon: Icon, label, active, onClick, badge, collapsed }: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full relative flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-3"} py-2 text-sm font-medium rounded-lg transition-colors ${active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
    >
      <div className="flex items-center">
        <Icon className={`w-4 h-4 ${collapsed ? "" : "mr-3"}`} />
        {!collapsed && <span>{label}</span>}
      </div>
      {badge !== undefined && !collapsed && (
        <Badge variant={active ? "secondary" : "outline"} className="text-xs">
          {badge}
        </Badge>
      )}
      {badge !== undefined && collapsed && (
        <Badge
          variant={active ? "secondary" : "outline"}
          className="absolute right-1.5 top-1.5 h-5 min-w-5 px-1 flex items-center justify-center text-[10px]"
        >
          {badge}
        </Badge>
      )}
    </button>
  );
}

// Helper functions for order status
const getOrderStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending': return 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50';
    case 'preparing': return 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary border border-primary/40 dark:border-primary/50';
    case 'ready': return 'bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50';
    case 'completed': case 'delivered': return 'bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50';
    case 'out_for_delivery': return 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50';
    case 'cancelled': return 'bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive border border-destructive/40 dark:border-destructive/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const getOrderStatusText = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending': return 'Pending';
    case 'preparing': return 'Preparing';
    case 'ready': return 'Ready';
    case 'completed': return 'Completed';
    case 'delivered': return 'Delivered';
    case 'out_for_delivery': return 'Out for Delivery';
    case 'cancelled': return 'Cancelled';
    default: return status || 'Unknown';
  }
};

export default function CanteenOwnerDashboardSidebar() {
  const [location, setLocation] = useLocation();
  const { canteenId } = useParams();
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const ownerSidebarDefaults: Record<string, boolean> = {
    overview: true,
    counters: true,
    orders: true,
    "payment-counter": true,
    "pos-billing": true,
    menu: true,
    content: true,
    analytics: true,
    "delivery-management": true,
    payout: true,
    "position-bidding": true,
    "store-mode": true,
    "qr-manager": true,
  };
  const ownerSidebarOrder = [
    "overview",
    "counters",
    "orders",
    "payment-counter",
    "pos-billing",
    "menu",
    "content",
    "analytics",
    "delivery-management",
    "payout",
    "position-bidding",
    "store-mode",
    "qr-manager"
  ];
  const [activeTab, setActiveTab] = useState("overview");

  // Initialize active tab from URL query parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ownerSidebarOrder.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // Component to display counter name
  const CounterNameDisplay = ({ counterId }: { counterId: string }) => {
    const [name, setName] = useState<string>('Loading...');

    useEffect(() => {
      const fetchCounterName = async () => {
        try {
          const response = await apiRequest(`/api/counters/${counterId}/name`);
          setName(response.name || 'Unknown Counter');
        } catch (error) {
          setName('Unknown Counter');
        }
      };

      fetchCounterName();
    }, [counterId]);

    return <span className="font-medium text-success">{name}</span>;
  };

  const { user, isAuthenticated, isCanteenOwner } = useAuthSync();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { logout } = useAuth();

  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string; cacheVersion: string }>({
    version: '1.0.0',
    cacheVersion: 'unknown'
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [selectedOrderForScan, setSelectedOrderForScan] = useState<any>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState(false);
  const [showOrderDetailPopup, setShowOrderDetailPopup] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any>(null);
  const [isStoreMode, setIsStoreMode] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ownerSidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logo upload state
  const [showLogoCropper, setShowLogoCropper] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Banner upload state
  const [showBannerCropper, setShowBannerCropper] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Use the updated hook with canteenId
  const {
    requestPermission: requestPushPermission,
    isSubscribed: isPushSubscribed
  } = useWebPushNotifications(user?.email || undefined, "canteen_owner", canteenId);

  const { toast } = useToast();

  const sidebarCollapsed = isSidebarCollapsed && !isMobile;

  useEffect(() => {
    try {
      localStorage.setItem("ownerSidebarCollapsed", String(isSidebarCollapsed));
    } catch {
    }
  }, [isSidebarCollapsed]);

  // Load version info on mount
  useEffect(() => {
    UpdateManager.getVersionInfo().then(setVersionInfo);
    const manager = UpdateManager.getInstance();
    setUpdateAvailable(manager.isUpdateReady());
  }, []);

  // Helper functions
  const generateOrderNumber = () => Math.floor(Math.random() * 900000000000) + 100000000000;
  const generateBarcode = () => Math.floor(Math.random() * 900000000000) + 100000000000;

  // Theme options
  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  // Initialize Web Push (VAPID) for canteen owners
  useEffect(() => {
    const setupPush = async () => {
      try {
        if (!isAuthenticated || !isCanteenOwner || !user?.email || !canteenId) return;

        // Only request permission if not already subscribed and supported
        if (!isPushSubscribed) {
          // We can't auto-request permission in some browsers without user interaction
          // But since the original code did it, we'll try it here to maintain behavior
          // Ideally this should be a button click
          await requestPushPermission();
        }
      } catch (error) {
        console.warn("Push setup failed:", error);
      }
    };
    setupPush();
    setupPush();
  }, [isAuthenticated, isCanteenOwner, user?.email, canteenId, isPushSubscribed, requestPushPermission]);



  // Debug logging for canteen image




  const sendDeviceNotification = async (title: string, body: string, data?: Record<string, any>) => {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const registration = await navigator.serviceWorker?.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: "/api/icon.png?size=192",
          badge: "/api/icon.png?size=192",
          data,
          renotify: true,
          tag: data?.tag || "canteen-order",
          timestamp: Date.now(),
          vibrate: [200, 100, 200],
        } as any);
      }
    } catch (error) {
      console.warn("Failed to show device notification:", error);
    }
  };

  // Play notification sound for new orders
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Silent fail - notification sound is optional
    }
  };

  // Date filtering functions for analytics
  const getDateRange = (timeframe: string, date: Date) => {
    const now = new Date(date);
    let startDate: Date, endDate: Date;

    switch (timeframe) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
        endDate = new Date(startOfWeek);
        endDate.setDate(startOfWeek.getDate() + 7);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'annual':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    return { startDate, endDate };
  };

  const filterOrdersByDateRange = (orders: any[], startDate: Date, endDate: Date) => {
    return orders.filter((order: any) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate < endDate;
    });
  };

  const calculateAnalytics = (filteredOrders: any[]) => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const statusCounts = filteredOrders.reduce((acc: any, order: any) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    const itemStats: any = {};
    filteredOrders.forEach((order: any) => {
      if (order.items && typeof order.items === 'string') {
        try {
          const parsedItems = JSON.parse(order.items);
          if (Array.isArray(parsedItems)) {
            parsedItems.forEach((item: any) => {
              const key = item.name || item.id;
              if (!itemStats[key]) {
                itemStats[key] = {
                  name: item.name,
                  quantity: 0,
                  revenue: 0,
                  orders: 0
                };
              }
              itemStats[key].quantity += item.quantity || 1;
              itemStats[key].revenue += (item.price || 0) * (item.quantity || 1);
              itemStats[key].orders += 1;
            });
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
    });

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      statusCounts,
      itemStats
    };
  };

  // Responsive sidebar: keep open on desktop, toggle on mobile
  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth < 1024;
      setIsMobile((prev) => {
        if (prev !== mobileView) {
          setIsSidebarOpen(!mobileView);
        }
        return mobileView;
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Enhanced security check - redirect if not authenticated OR not canteen owner
  useEffect(() => {
    if (!isAuthenticated || !isCanteenOwner) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, isCanteenOwner, setLocation]);

  // Redirect to correct canteen dashboard if no canteenId in URL
  useEffect(() => {
    if (isAuthenticated && isCanteenOwner && user?.email && !canteenId) {
      // Fetch canteen ID for the logged-in canteen owner
      const fetchCanteenId = async () => {
        try {
          const response = await fetch(`/api/system-settings/canteens/by-owner/${user.email}`);

          if (response.ok) {
            const canteenData = await response.json();
            setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}`);
          } else {
            setLocation('/login?error=no_canteen');
          }
        } catch (error) {
          setLocation('/login?error=canteen_fetch_failed');
        }
      };

      fetchCanteenId();
    }
  }, [isAuthenticated, isCanteenOwner, user?.email, canteenId, setLocation]);

  // Data fetching queries - filter by canteen ID if available
  const { data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<{
    items: Category[];
    pagination: any;
  }>({
    queryKey: ["/api/categories", canteenId],
    queryFn: async () => {
      const url = canteenId
        ? `/api/categories?canteenId=${canteenId}&limit=1000` // Get all categories for dashboard
        : '/api/categories?limit=1000';
      const response = await apiRequest(url);
      return response;
    },
    enabled: !!canteenId, // Only run when canteenId is available
  });

  const categories = categoriesData?.items || [];

  const { data: menuData, isLoading: menuItemsLoading, refetch: refetchMenuItems } = useQuery<{
    items: MenuItem[];
    pagination: any;
  }>({
    // Separate cache key to avoid user-facing available-only menu cache
    queryKey: ["/api/menu", canteenId, "owner-all-items"],
    queryFn: async () => {
      const url = canteenId
        ? `/api/menu?canteenId=${canteenId}&limit=1000&availableOnly=false` // Owner view: include unavailable/out-of-stock
        : '/api/menu?limit=1000&availableOnly=false';
      const response = await apiRequest(url);
      return response;
    },
    enabled: !!canteenId, // Only run when canteenId is available
  });

  const menuItems = menuData?.items || [];

  // Fetch canteen data
  const { data: canteenData, isLoading: canteenDataLoading } = useQuery({
    queryKey: ["/api/system-settings/canteens", canteenId],
    queryFn: async () => {
      if (!canteenId) return null;
      const response = await apiRequest(`/api/system-settings/canteens/${canteenId}`);
      return response;
    },
    enabled: !!canteenId, // Only run when canteenId is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  });

  const ownerSidebarConfig = useMemo(() => ({
    ...ownerSidebarDefaults,
    ...(canteenData?.ownerSidebarConfig || {})
  }), [canteenData?.ownerSidebarConfig]);

  // Fetch canteen settings
  const { data: canteenSettings, refetch: refetchCanteenSettings } = useQuery({
    queryKey: ["/api/canteens/settings", canteenId],
    queryFn: async () => {
      if (!canteenId) return null;
      const response = await apiRequest(`/api/canteens/${canteenId}/settings`);
      return response;
    },
    enabled: !!canteenId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch counters for favorite counter selection
  const { data: counters = [] } = useQuery({
    queryKey: ["/api/counters", canteenId],
    queryFn: async () => {
      if (!canteenId) return [];
      const response = await apiRequest(`/api/counters?canteenId=${canteenId}`);
      return response;
    },
    enabled: !!canteenId,
  });

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 100 * 1024) { // > 100KB check
      // Basic client-side check
    }

    try {
      setIsImageUploading(true);

      // If the file is already a result of cropping (we can check by name or just process it), 
      // we might skip re-compression if it's already small, but for consistency we can keep using compressImage 
      // or just send it if we trust the cropper output.
      // The previous logic used compressImage. Let's keep it but ensure we handle the file correctly.

      const compressedBlob = await compressImage(file, 20); // Compress to ~20KB

      if (!compressedBlob) {
        throw new Error("Compression failed");
      }

      // Convert Blob to File for upload
      const fileName = file.name;
      const compressedFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('updatedBy', user?.id?.toString() || '0');

      const response = await apiRequest(`/api/system-settings/canteens/${canteenId}/profile-image`, {
        method: 'POST',
        body: formData,
      });

      console.log("Upload response:", response);

      // Force cache invalidation sequence
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens/by-college"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens/by-organization"] });

      // Update specific canteen cache
      await queryClient.refetchQueries({ queryKey: ["/api/system-settings/canteens", canteenId] });
      await refetchCanteenSettings();

      toast({
        title: "Profile Picture Updated",
        description: `Successfully uploaded. Original: ${formatBytes(file.size)}, Compressed: ${formatBytes(compressedFile.size)}`,
        variant: "default",
      });

    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImageUploading(false);
      setShowCropper(false);
      setSelectedImage(null);
    }
  };

  const onSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedImage(reader.result?.toString() || null);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
      // Reset input value so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "cropped-profile.jpg", { type: "image/jpeg" });
    await handleImageUpload(file);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsLogoUploading(true);

      const compressedBlob = await compressImage(file, 20); // Compress to ~20KB

      if (!compressedBlob) {
        throw new Error("Compression failed");
      }

      // Check against limit (100KB)
      if (compressedBlob.size > 100 * 1024) {
        toast({
          title: "Image Too Large",
          description: `Unable to compress logo to under 100KB. Current size: ${formatBytes(compressedBlob.size)}`,
          variant: "destructive",
        });
        return;
      }

      const fileName = file.name;
      const compressedFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('updatedBy', user?.id?.toString() || '0');

      const response = await apiRequest(`/api/system-settings/canteens/${canteenId}/logo`, {
        method: 'POST',
        body: formData,
      });

      console.log("Logo upload response:", response);

      // Force cache invalidation sequence
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens/by-college"] });

      // Update specific canteen cache
      await queryClient.refetchQueries({ queryKey: ["/api/system-settings/canteens", canteenId] });
      await refetchCanteenSettings();

      toast({
        title: "Logo Updated",
        description: `Successfully uploaded. Original: ${formatBytes(file.size)}, Compressed: ${formatBytes(compressedFile.size)}`,
        variant: "default",
      });

    } catch (error) {
      console.error("Logo upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLogoUploading(false);
      setShowLogoCropper(false);
      setSelectedLogo(null);
    }
  };

  const onSelectLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedLogo(reader.result?.toString() || null);
        setShowLogoCropper(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleLogoCropComplete = async (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "cropped-logo.jpg", { type: "image/jpeg" });
    await handleLogoUpload(file);
  };

  const handleBannerUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsBannerUploading(true);

      // Compress to ~100KB (target)
      const compressedBlob = await compressImage(file, 100);

      if (!compressedBlob) {
        throw new Error("Compression failed");
      }

      // Check against limit (200KB)
      if (compressedBlob.size > 200 * 1024) {
        toast({
          title: "Image Too Large",
          description: `Unable to compress banner to under 200KB. Current size: ${formatBytes(compressedBlob.size)}`,
          variant: "destructive",
        });
        return;
      }

      const fileName = file.name;
      const compressedFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('updatedBy', user?.id?.toString() || '0');

      const response = await apiRequest(`/api/system-settings/canteens/${canteenId}/banner`, {
        method: 'POST',
        body: formData,
      });

      console.log("Banner upload response:", response);

      // Force cache invalidation sequence
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/system-settings/canteens/by-college"] });

      // Update specific canteen cache
      await queryClient.refetchQueries({ queryKey: ["/api/system-settings/canteens", canteenId] });
      await refetchCanteenSettings();

      toast({
        title: "Banner Updated",
        description: `Successfully uploaded. Original: ${formatBytes(file.size)}, Compressed: ${formatBytes(compressedFile.size)}`,
        variant: "default",
      });

    } catch (error) {
      console.error("Banner upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBannerUploading(false);
      setShowBannerCropper(false);
      setSelectedBanner(null);
    }
  };

  const onSelectBanner = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedBanner(reader.result?.toString() || null);
        setShowBannerCropper(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleBannerCropComplete = async (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "cropped-banner.jpg", { type: "image/jpeg" });
    await handleBannerUpload(file);
  };



  // Debug logging for canteen image
  useEffect(() => {
    if (canteenData) {
      console.log("Canteen Data Updated:", {
        id: canteenData.id,
        name: canteenData.name,
        imageUrl: canteenData.imageUrl,
        hasImage: !!canteenData.imageUrl
      });
    }
  }, [canteenData]);



  // Mutation to update favorite counter
  const updateFavoriteCounterMutation = useMutation({
    mutationFn: async (favoriteCounterId: string) => {
      return apiRequest(`/api/canteens/${canteenId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ favoriteCounterId }),
      });
    },
    onSuccess: () => {
      refetchCanteenSettings();
      queryClient.invalidateQueries({ queryKey: ["/api/canteens/settings", canteenId] });
    },
  });

  const handleTabChange = (tab: string) => {
    if (ownerSidebarConfig[tab] === false) return;
    setActiveTab(tab);

    // Update URL with tab parameter to persist state on refresh
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('tab', tab);
    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    setLocation(newUrl);

    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // Ensure active tab is always enabled; fall back to first enabled item
  useEffect(() => {
    if (ownerSidebarConfig[activeTab] !== false) return;
    const nextTab = ownerSidebarOrder.find((key) => ownerSidebarConfig[key]);
    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [ownerSidebarConfig, activeTab]);

  // Set page title based on active tab
  useEffect(() => {
    const tabTitles: Record<string, string> = {
      overview: "Overview",
      orders: "Orders",
      "payment-counter": "Payment Counter",
      "pos-billing": "POS Billing",
      menu: "Menu Management",
      content: "Content Manager",
      analytics: "Analytics",
      "delivery-management": "Delivery Management",
      payout: "Payout",
      "store-mode": "Store Mode",
      "qr-manager": "QR Manager"
    };

    const tabTitle = tabTitles[activeTab] || "Dashboard";
    const canteenName = canteenData?.name || "Canteen";
    document.title = `${tabTitle} - ${canteenName} | KIT-CANTEEN Owner Dashboard`;
  }, [activeTab, canteenData?.name]);

  // Note: Removed ALL orders API call - using paginated orders instead for better performance

  // Paginated orders for all orders tab
  const {
    orders: paginatedOrders,
    totalCount: totalOrdersCount,
    totalPages,
    currentPage,
    isLoading: paginatedLoading,
    refetch: refetchPaginated,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage,
    hasPreviousPage,
  } = usePaginatedOrders(1, 12, canteenId);


  // Active orders pagination hook
  // In Store Mode we want to see all active orders without pagination, so request a large page size
  // For orders tab, show 3 rows: 3 rows × 4 columns (max) = 12 items per page
  const storeModeActivePageSize = isStoreMode ? 500 : 12;
  const {
    orders: paginatedActiveOrders,
    totalCount: totalActiveOrdersCount,
    totalPages: totalActivePages,
    currentPage: currentActivePage,
    isLoading: paginatedActiveLoading,
    refetch: refetchPaginatedActive,
    goToPage: goToActivePage,
    goToNextPage: goToActiveNextPage,
    goToPreviousPage: goToActivePreviousPage,
    goToFirstPage: goToActiveFirstPage,
    goToLastPage: goToActiveLastPage,
    hasNextPage: hasActiveNextPage,
    hasPreviousPage: hasActivePreviousPage,
  } = usePaginatedActiveOrders(1, storeModeActivePageSize, canteenId);


  // Use NotificationContext for better notification management
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    isMarkingAsRead,
    isMarkingAllAsRead
  } = useNotificationContext();


  // Order search hook
  const searchResults = useOrderSearch(searchQuery);

  // Use only current canteen for WebSocket room subscription
  const canteenIdsForWebSocket = [canteenId].filter(Boolean) as string[];

  // Multi-canteen real-time order updates via WebSocket - ONLY when in store mode
  const webSocketStatus = useMultiCanteenWebSocket({
    canteenIds: canteenIdsForWebSocket,
    enabled: isAuthenticated && isCanteenOwner, // Listen always for owner to notify across counters
    onNewOrder: (order) => {
      // Mark this order as new for visual indication
      setNewOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.add(order.id || order.orderNumber);
        return newSet;
      });
      // Play notification sound
      playNotificationSound();
      // For new orders, invalidate to get the full updated list
      queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });

      // Remove the new order indicator after 5 seconds
      setTimeout(() => {
        setNewOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(order.id || order.orderNumber);
          return newSet;
        });
      }, 5000);
    },
    onOrderUpdate: (order) => {
      // Update cache directly instead of refetching to avoid server load
      queryClient.setQueryData(["/api/orders/paginated"], (oldData: any) => {
        if (!oldData?.items) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((o: any) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? { ...o, ...order }
              : o
          )
        };
      });

      queryClient.setQueryData(["/api/orders/active/paginated"], (oldData: any) => {
        if (!oldData?.items) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((o: any) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? { ...o, ...order }
              : o
          )
        };
      });
    }
  });


  // Auto-refresh orders when entering store mode
  useEffect(() => {
    if (isStoreMode) {
      refreshAllData();
    }
  }, [isStoreMode]);


  // Filter orders - using paginated active orders for better performance
  const activeOrders = (paginatedActiveOrders as any[])
    .filter((order: any) => {
      // Filter by status first
      const isActiveStatus = order.status === "pending" || order.status === "preparing" || order.status === "ready";

      // If no search query, return all active orders
      if (!searchQuery) return isActiveStatus;

      // If there's a search query, also apply search filter
      if (isActiveStatus) {
        const searchLower = searchQuery.toLowerCase();
        return order.orderNumber?.toLowerCase().includes(searchLower) ||
          order.customerName?.toLowerCase().includes(searchLower) ||
          order.items?.toLowerCase().includes(searchLower);
      }

      return false;
    })
    .sort((a: any, b: any) => {
      // FIFO ordering - sort by creation time only (oldest first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const allFilteredOrders = searchQuery
    ? (paginatedOrders as any[]).filter((order: any) => {
      const searchLower = searchQuery.toLowerCase();
      return order.orderNumber?.toLowerCase().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.items?.toLowerCase().includes(searchLower);
    })
    : paginatedOrders;

  // Calculate real stats from actual orders data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Filter today's orders from paginated orders
  const todayOrders = (paginatedOrders as any[]).filter((order: any) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= today && orderDate <= todayEnd;
  });

  // Calculate today's revenue
  const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.amount || 0), 0);

  // Calculate total revenue from all orders (for this page - note: this is page-specific)
  // For accurate total revenue, we'd need all orders, but for overview we'll use what we have
  const totalRevenue = (paginatedOrders as any[]).reduce((sum, order) => sum + (order.amount || 0), 0);

  // Calculate yesterday's date for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayOrders = (paginatedOrders as any[]).filter((order: any) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= yesterday && orderDate <= yesterdayEnd;
  });

  const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + (order.amount || 0), 0);

  // Calculate trends
  const ordersTrend = yesterdayOrders.length > 0
    ? `${((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length * 100).toFixed(0)}% from yesterday`
    : todayOrders.length > 0 ? "New today" : "No orders yet";

  const revenueTrend = yesterdayRevenue > 0
    ? `${((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(0)}% from yesterday`
    : todayRevenue > 0 ? "New today" : "No revenue yet";

  // Stats calculation using REAL data
  const stats = [
    {
      title: "Today's Orders",
      value: todayOrders.length,
      trend: ordersTrend,
      icon: ShoppingBag
    },
    {
      title: "Today's Revenue",
      value: `₹${todayRevenue.toLocaleString('en-IN')}`,
      trend: revenueTrend,
      icon: DollarSign
    },
    {
      title: "Active Orders",
      value: activeOrders.length,
      trend: "Live updates",
      icon: Clock
    },
    {
      title: "Menu Items",
      value: menuItems.length,
      trend: `${menuItems.filter((item: any) => item.available).length} available`,
      icon: ChefHat
    }
  ];



  // Mutations

  const markOrderReadyMutation = useMutation({
    mutationFn: async ({ orderId, counterId }: { orderId: string; counterId?: string }) => {
      // Validate orderId
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      // Use the mark-ready endpoint which properly updates itemStatusByCounter
      return apiRequest(`/api/orders/${orderId}/mark-ready`, {
        method: "POST",
        body: JSON.stringify({ counterId }),
      });
    },
    onSuccess: () => {
      // Optimized: Only invalidate active/paginated orders queries
      // WebSocket will handle real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
    },
    onError: () => {
      // Error handling
    }
  });

  // Mark order as seen mutation
  const markOrderSeenMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/orders/${orderId}/mark-seen`, {
        method: "PATCH",
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: () => {
      // Silently fail - not critical if marking as seen fails
    }
  });

  // Handle barcode scan functionality
  const handleScanBarcode = (order: any) => {
    setSelectedOrderForScan(order);
    setBarcodeInput("");
    setScannedOrder(null);
    setShowOrderDetails(false);
    setShowBarcodeDialog(true);
  };

  // Helper function to check if scanned barcode matches order (full barcode or first 4 digits)
  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;

    // Exact match
    if (scannedBarcode === orderBarcode || scannedBarcode === String(orderBarcode) || String(orderBarcode) === scannedBarcode) {
      return true;
    }

    // Check if scanned is first 4 digits of order barcode
    if (scannedBarcode.length === 4 && orderBarcode.length >= 4) {
      const first4Digits = String(orderBarcode).slice(0, 4);
      return scannedBarcode === first4Digits;
    }

    // Check if order barcode starts with scanned barcode (for partial matches)
    const orderBarcodeStr = String(orderBarcode);
    if (scannedBarcode.length < orderBarcodeStr.length) {
      return orderBarcodeStr.startsWith(scannedBarcode);
    }

    return false;
  };

  // Handle barcode input submission
  const handleBarcodeSubmit = () => {
    if (!barcodeInput.trim()) {
      return;
    }

    // Find the order with matching barcode (full barcode or first 4 digits OTP) in both active and all orders for the current page
    const localOrders = [...(paginatedActiveOrders as any[]), ...(paginatedOrders as any[])];

    // Try to find order by full barcode, orderNumber, id, or first 4 digits OTP
    const matchingOrder = localOrders.find((order: any) => {
      // Full barcode match
      if (matchesBarcode(barcodeInput, order.barcode)) return true;
      if (matchesBarcode(barcodeInput, order.orderNumber)) return true;
      if (matchesBarcode(barcodeInput, order.id)) return true;

      // Legacy exact matches
      if (order.barcode === barcodeInput || order.orderNumber === barcodeInput || order.id === barcodeInput) return true;

      return false;
    });

    if (matchingOrder) {
      // Check if the scanned barcode matches the selected order
      if (selectedOrderForScan &&
        selectedOrderForScan.id !== matchingOrder.id &&
        !matchesBarcode(barcodeInput, selectedOrderForScan.barcode) &&
        !matchesBarcode(barcodeInput, selectedOrderForScan.orderNumber)) {
        setBarcodeInput("");
        return;
      }

      console.log("🔍 Barcode/OTP scan successful, showing order details in dialog");
      setScannedOrder(matchingOrder);
      setShowOrderDetails(true);
      // Keep the dialog open to show order details within the popup - DO NOT NAVIGATE
    } else {
      setBarcodeInput("");
    }
  };

  // Handle keyboard events for barcode scanning dialog
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (showBarcodeDialog) {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!showOrderDetails && barcodeInput.trim()) {
            // If order details not shown yet, submit barcode
            handleBarcodeSubmit();
          } else if (showOrderDetails && scannedOrder) {
            // If order details are shown, mark as delivered
            // For delivered status, use PATCH endpoint
            apiRequest(`/api/orders/${scannedOrder.id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "delivered" }),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
              queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
            });
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setShowBarcodeDialog(false);
          setSelectedOrderForScan(null);
          setBarcodeInput("");
          setScannedOrder(null);
          setShowOrderDetails(false);
        }
      }
    };

    if (showBarcodeDialog) {
      document.addEventListener('keydown', handleKeyPress);
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [showBarcodeDialog, showOrderDetails, scannedOrder, barcodeInput, markOrderReadyMutation, handleBarcodeSubmit]);

  // Function to fetch college name by ID
  const fetchCollegeName = async (collegeId: string) => {
    try {
      const response = await fetch(`/api/system-settings/colleges/${collegeId}/name`);
      if (response.ok) {
        const data = await response.json();
        return data.name || 'Unknown College';
      }
    } catch (error) {
      // Failed to fetch college name - return default
    }
    return 'Unknown College';
  };


  // Refresh all data function
  const refreshAllData = async () => {
    try {
      await Promise.all([
        refetchCategories(),
        refetchMenuItems(),
        refetchPaginated(),
        refetchPaginatedActive()
      ]);
    } catch (error) {
    }
  };

  // Handle order card click for details popup and mark as seen
  const handleOrderCardClick = (order: any) => {
    // Mark as seen if user hasn't seen this order yet
    if (user?.id && (!order.seenBy || !order.seenBy.includes(user.id))) {
      markOrderSeenMutation.mutate(order.id);
    }

    setSelectedOrderForDetails(order);
    setShowOrderDetailPopup(true);
  };

  // Helper function to check if order is unseen by current user
  const isOrderUnseen = (order: any) => {
    return user?.id && (!order.seenBy || !order.seenBy.includes(user.id));
  };

  // Memoize preparing orders filter to avoid recalculating on every render
  const preparingOrders = useMemo(() => {
    const filtered = paginatedActiveOrders.filter((order: any) => {
      // Exclude orders that are waiting for payment (pending_payment)
      if (order.status === "pending_payment") {
        return false;
      }

      // Only show orders in pending or preparing status that need prep
      if (order.status !== "pending" && order.status !== "preparing") {
        return false;
      }

      try {
        const items = JSON.parse(order.items || '[]');
        // Only show orders that have at least one markable item (prep required)
        const markableItems = items.filter((item: any) => item.isMarkable === true);

        // If no markable items, exclude from prep required
        if (markableItems.length === 0) {
          return false;
        }

        // Check if all markable items are already ready PER COUNTER
        const itemStatusByCounter = order.itemStatusByCounter || {};

        // Group markable items by their storeCounterId
        const markableItemsByCounter: { [counterId: string]: any[] } = {};
        markableItems.forEach((item: any) => {
          const itemCounterId = item.storeCounterId || 'default';
          if (!markableItemsByCounter[itemCounterId]) {
            markableItemsByCounter[itemCounterId] = [];
          }
          markableItemsByCounter[itemCounterId].push(item);
        });

        // Check if ANY counter has unready markable items
        for (const counterId in markableItemsByCounter) {
          const counterMarkableItems = markableItemsByCounter[counterId];

          // Check if all markable items for this counter are ready
          for (const item of counterMarkableItems) {
            const itemStatus = itemStatusByCounter[counterId]?.[item.id];
            if (itemStatus !== 'ready' && itemStatus !== 'completed') {
              return true; // Found unready items, include in prep required
            }
          }
        }

        return false; // All counters have all items ready
      } catch (error) {
        return false;
      }
    });

    // Priority-based sorting: Unseen orders first, then by creation time
    return filtered.sort((a: any, b: any) => {
      // Use isOrderUnseen function for consistency with rendering logic
      const aUnseen = isOrderUnseen(a);
      const bUnseen = isOrderUnseen(b);

      // If one is unseen and other is seen, prioritize unseen
      if (aUnseen && !bUnseen) return -1;
      if (!aUnseen && bUnseen) return 1;

      // If both have same seen status, sort by creation time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [paginatedActiveOrders, user]);

  // No longer tracking other canteens with pending orders

  // Store Mode Layout
  if (isStoreMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-hidden">
        {/* Store Mode Header */}
        <div className="bg-card border-b border-border flex flex-wrap items-start md:items-center justify-between px-4 md:px-6 py-2 gap-3">
          <div className="flex items-start md:items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                {canteenDataLoading ? 'Loading...' : (canteenData?.name || 'Canteen')} - Store Mode
              </h1>
              <p className="text-sm text-muted-foreground">Rush Business Mode</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Badge
              variant={webSocketStatus.isConnected ? "default" : "secondary"}
              className={`${webSocketStatus.isConnected ? "animate-pulse" : ""} whitespace-nowrap`}
            >
              {webSocketStatus.isConnected ? (
                <>
                  <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
                  Live Orders
                </>
              ) : webSocketStatus.isConnecting ? (
                <>
                  <div className="w-2 h-2 bg-warning rounded-full mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-destructive rounded-full mr-2" />
                  Offline
                </>
              )}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPaginatedActive()}
              className="flex items-center space-x-2"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="whitespace-nowrap">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size={isMobile ? "icon" : "sm"}
              onClick={() => setIsStoreMode(false)}
              data-testid="button-exit-store-mode"
              className={`flex items-center ${isMobile ? "" : "space-x-2"}`}
              aria-label="Exit Store Mode"
            >
              <Minimize className="w-4 h-4" />
              {!isMobile && <span className="whitespace-nowrap">Exit Store</span>}
            </Button>
          </div>
        </div>

        {/* Store Mode Main Content */}
        <div className="h-[calc(100vh-4rem)]">
          <PanelGroup direction={isMobile ? "vertical" : "horizontal"} className="h-full">
            {/* Left Side - Orders with Tabs */}
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full bg-background border-r border-border">
                <div className="h-full flex flex-col">
                  <div className="p-2 md:p-3 border-b border-border flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-semibold flex items-center">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Active Orders
                      </h2>
                      <Badge variant="destructive" className="text-sm px-2 py-0.5">
                        {activeOrders.length}
                      </Badge>
                    </div>
                    <Input
                      placeholder="Search active orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-8 text-xs"
                      data-testid="input-search-active-orders"
                    />
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-2 app-scrollbar">
                    {activeOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-xl text-muted-foreground">No Active Orders</p>
                        <p className="text-sm text-muted-foreground mt-2">New orders will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeOrders.map((order: any) => (
                          <Card key={order.id} className={`border-l-4 cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl border border-border bg-card ${order.status === 'preparing' ? 'border-l-primary hover:border-l-primary/80' :
                            order.status === 'ready' ? 'border-l-success hover:border-l-success/80' :
                              'border-l-warning hover:border-l-warning/80'
                            } ${isOrderUnseen(order) ? 'bg-success/10 border-success/20' : ''} ${newOrderIds.has(order.id || order.orderNumber) ? 'ring-2 ring-success/40 bg-success/10 animate-pulse' : ''
                            }`} onClick={() => handleOrderCardClick(order)}>
                            <CardContent className="p-2 sm:p-3">
                              <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-2">
                                    <div className="flex items-center font-medium text-sm sm:text-base">
                                      <span>#{(() => {
                                        const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                        return formatted.prefix;
                                      })()}</span>
                                      <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-0 text-xs sm:text-sm">
                                        {(() => {
                                          const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                          return formatted.highlighted;
                                        })()}
                                      </span>
                                    </div>
                                    {newOrderIds.has(order.id || order.orderNumber) && (
                                      <Badge variant="destructive" className="animate-pulse text-xs">
                                        NEW ORDER
                                      </Badge>
                                    )}
                                    <Badge className={`${getOrderStatusColor(order.status)} text-xs`}>
                                      {getOrderStatusText(order.status)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">{order.estimatedTime}m</Badge>
                                    {(() => {
                                      try {
                                        const items = JSON.parse(order.items || '[]');
                                        const hasMarkableItem = items.some((item: any) => {
                                          // Try both id and _id fields
                                          const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                          const isMarkable = menuItem?.isMarkable === true;
                                          return isMarkable;
                                        });
                                        return (
                                          <Badge
                                            variant={hasMarkableItem ? "secondary" : "outline"}
                                            className={hasMarkableItem ? "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50" : "bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50"}
                                          >
                                            {hasMarkableItem ? "Prep Required" : "Auto-Ready"}
                                          </Badge>
                                        );
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Customer: {order.customerName}</p>
                                  <p className="text-xs sm:text-sm line-clamp-2">
                                    {order.items && typeof order.items === 'string'
                                      ? (() => {
                                        try {
                                          const parsedItems = JSON.parse(order.items);
                                          return Array.isArray(parsedItems)
                                            ? parsedItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')
                                            : order.items;
                                        } catch {
                                          return order.items;
                                        }
                                      })()
                                      : 'No items'
                                    }
                                  </p>
                                </div>
                                <div className="text-left sm:text-right space-y-2 flex-shrink-0">
                                  <p className="font-semibold text-sm sm:text-base">₹{order.amount}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : 'N/A'}
                                  </p>
                                  <div className="flex flex-col sm:flex-col space-y-2">
                                    {(() => {
                                      try {
                                        const items = JSON.parse(order.items || '[]');
                                        const hasMarkableItem = items.some((item: any) => {
                                          const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                          return menuItem?.isMarkable === true;
                                        });

                                        // Auto-Ready orders that are stuck in pending - show Mark Ready button
                                        if (!hasMarkableItem && order.status === "pending") {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="cart"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // For non-markable items, use PATCH to update status directly
                                                apiRequest(`/api/orders/${order.id}`, {
                                                  method: "PATCH",
                                                  body: JSON.stringify({ status: "ready" }),
                                                }).then(() => {
                                                  queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                                                  queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
                                                });
                                              }}
                                              data-testid={`button-mark-ready-${order.id}`}
                                              className="text-xs sm:text-sm w-full sm:w-auto"
                                            >
                                              <span className="hidden sm:inline">Mark as Ready</span>
                                              <span className="sm:hidden">Mark Ready</span>
                                            </Button>
                                          );
                                        }

                                        // Auto-Ready orders show Scan Barcode button when ready
                                        if (!hasMarkableItem && order.status === "ready") {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="default"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleScanBarcode(order);
                                              }}
                                              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm w-full sm:w-auto"
                                              data-testid={`button-scan-barcode-${order.id}`}
                                            >
                                              <ScanLine className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                              <span className="hidden sm:inline">Scan Barcode</span>
                                              <span className="sm:hidden">Scan</span>
                                            </Button>
                                          );
                                        }

                                        // Prep Required orders show Mark Ready button when pending/preparing
                                        if (hasMarkableItem && (order.status === "pending" || order.status === "preparing")) {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="cart"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // Use mark-ready endpoint which updates itemStatusByCounter
                                                // counterId is optional - if not provided, all markable items will be marked ready
                                                // Get order ID - try id, _id, or orderNumber
                                                const orderAny = order as any;
                                                const orderId = order.id || orderAny._id || order.orderNumber;
                                                if (!orderId) {
                                                  return;
                                                }
                                                markOrderReadyMutation.mutate({ orderId });
                                              }}
                                              disabled={markOrderReadyMutation.isPending}
                                              data-testid={`button-mark-ready-${order.id}`}
                                              className="text-xs sm:text-sm w-full sm:w-auto"
                                            >
                                              {markOrderReadyMutation.isPending ? (
                                                <>
                                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                  <span className="hidden sm:inline">Updating...</span>
                                                  <span className="sm:hidden">...</span>
                                                </>
                                              ) : (
                                                "Mark Ready"
                                              )}
                                            </Button>
                                          );
                                        }

                                        // Prep Required orders show Scan Barcode button when ready
                                        if (hasMarkableItem && order.status === "ready") {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="default"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleScanBarcode(order);
                                              }}
                                              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm w-full sm:w-auto"
                                              data-testid={`button-scan-barcode-${order.id}`}
                                            >
                                              <ScanLine className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                              <span className="hidden sm:inline">Scan Barcode</span>
                                              <span className="sm:hidden">Scan</span>
                                            </Button>
                                          );
                                        }

                                        return null;
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

            {/* Right Side - Preparing Orders */}
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full bg-card">
                <div className="h-full flex flex-col">
                  <div className="p-2 md:p-3 border-b border-border flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1.5" />
                        Prep Required Orders
                      </h3>
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-success font-medium">Live</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Orders requiring manual preparation (unseen orders prioritized)</p>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-2 app-scrollbar">
                    {preparingOrders.length === 0 ? (
                      <div className="text-center py-6">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-muted-foreground">No prep-required orders</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Orders with markable items (pending/preparing) will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {preparingOrders.map((order: any) => (
                          <Card key={order.id} className={`border-l-4 cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl border-l-primary ${isOrderUnseen(order) ? 'bg-success/10 border-success/20' : ''}`} onClick={() => handleOrderCardClick(order)}>
                            <CardContent className="p-2 md:p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center flex-wrap gap-1.5 mb-2">
                                    <div className="flex items-center font-medium text-sm">
                                      <span>#{(() => {
                                        const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                        return formatted.prefix;
                                      })()}</span>
                                      <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-0 text-xs">
                                        {(() => {
                                          const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                          return formatted.highlighted;
                                        })()}
                                      </span>
                                    </div>
                                    <Badge className={`${getOrderStatusColor(order.status)} text-xs`}>
                                      {getOrderStatusText(order.status)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">{order.estimatedTime}m</Badge>
                                    {(() => {
                                      try {
                                        const items = JSON.parse(order.items || '[]');
                                        const hasMarkableItem = items.some((item: any) => {
                                          // Try both id and _id fields
                                          const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                          return menuItem?.isMarkable === true;
                                        });
                                        return (
                                          <>
                                            <Badge
                                              variant={hasMarkableItem ? "secondary" : "outline"}
                                              className={hasMarkableItem ? "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50 text-xs" : "bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs"}
                                            >
                                              {hasMarkableItem ? "Prep Required" : "Auto-Ready"}
                                            </Badge>
                                            {isOrderUnseen(order) && (
                                              <Badge variant="outline" className="bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive border border-destructive/40 dark:border-destructive/50 text-xs animate-pulse">
                                                Priority
                                              </Badge>
                                            )}
                                          </>
                                        );
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Customer: {order.customerName}</p>
                                  <p className="text-xs">
                                    {order.items && typeof order.items === 'string'
                                      ? (() => {
                                        try {
                                          const parsedItems = JSON.parse(order.items);
                                          return Array.isArray(parsedItems)
                                            ? parsedItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')
                                            : order.items;
                                        } catch {
                                          return order.items;
                                        }
                                      })()
                                      : 'No items'
                                    }
                                  </p>
                                </div>
                                <div className="text-left sm:text-right space-y-1">
                                  <p className="font-semibold text-sm">₹{order.amount}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : 'N/A'}
                                  </p>
                                  <div className="flex flex-col space-y-1">
                                    {(() => {
                                      try {
                                        const items = JSON.parse(order.items || '[]');
                                        const hasMarkableItem = items.some((item: any) => {
                                          // Try both id and _id fields
                                          const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                          return menuItem?.isMarkable === true;
                                        });

                                        // Show Mark Ready button for markable items in pending/preparing status
                                        if (hasMarkableItem && (order.status === "pending" || order.status === "preparing")) {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="cart"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // Get order ID - try id, _id, or orderNumber
                                                const orderAny = order as any;
                                                const orderId = order.id || orderAny._id || order.orderNumber;
                                                if (!orderId) {
                                                  return;
                                                }
                                                markOrderReadyMutation.mutate({ orderId });
                                              }}
                                              disabled={markOrderReadyMutation.isPending}
                                              data-testid={`button-mark-ready-${order.id}`}
                                            >
                                              {markOrderReadyMutation.isPending ? (
                                                <>
                                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                  Updating...
                                                </>
                                              ) : (
                                                "Mark Ready"
                                              )}
                                            </Button>
                                          );
                                        }


                                        return null;
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Keep all existing dialogs - they will work in both modes */}
        {/* Barcode Scanning Dialog */}
        <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
          <DialogContent
            className="max-w-lg w-[90%] sm:max-w-md max-h-[85vh] overflow-y-auto p-6 rounded-lg app-scrollbar"
            onKeyDown={(e) => {
              if (showOrderDetails && scannedOrder && e.key === 'Enter') {
                e.preventDefault();
                // For delivered status, use PATCH endpoint
                apiRequest(`/api/orders/${scannedOrder.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "delivered" }),
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
                });
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setShowBarcodeDialog(false);
                setSelectedOrderForScan(null);
                setBarcodeInput("");
                setScannedOrder(null);
                setShowOrderDetails(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {!showOrderDetails ? (
                  <>
                    <ScanLine className="w-5 h-5" />
                    Scan Barcode
                  </>
                ) : (
                  <>
                    <Receipt className="w-5 h-5" />
                    Order Details
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {!showOrderDetails ? (
                // Step 1: Barcode Input
                <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Enter Barcode</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="barcodeInput">Barcode</Label>
                      <Input
                        id="barcodeInput"
                        placeholder="Enter barcode and press Enter..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (barcodeInput.trim()) {
                              handleBarcodeSubmit();
                            }
                          }
                        }}
                        className="text-center font-mono text-lg"
                        autoFocus
                      />
                    </div>

                    <div className="bg-warning/20 border border-warning/40 dark:border-warning/50 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        <p className="font-medium text-warning text-sm">Instructions</p>
                      </div>
                      <p className="text-xs text-warning/90">
                        Enter the barcode and press <kbd className="px-1 py-0.5 text-xs font-semibold text-warning bg-warning/20 border border-warning/40 rounded">Enter</kbd> to find the order
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleBarcodeSubmit();
                      }}
                      className="w-full"
                      disabled={!barcodeInput.trim()}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Find Order
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                // Step 2: Order Details (after barcode scan)
                scannedOrder && (
                  <div className="space-y-4">
                    <div className="bg-success/20 border border-success/40 dark:border-success/50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-success" />
                        <h3 className="font-semibold text-success">Order Found!</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">Order ID:</span>
                          <p className="font-mono font-medium">#{(() => {
                            const formatted = formatOrderIdDisplay(scannedOrder.orderNumber || scannedOrder.id.toString());
                            return formatted.prefix + formatted.highlighted;
                          })()}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <div className="mt-1">
                            <Badge className={getOrderStatusColor(scannedOrder.status)}>
                              {getOrderStatusText(scannedOrder.status)}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Customer:</span>
                          <p className="font-medium">{scannedOrder.customerName || 'N/A'}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Total Amount:</span>
                          <p className="font-bold text-lg text-success">₹{scannedOrder.amount}</p>
                        </div>
                      </div>

                      <div className="border-t pt-4 mb-4">
                        <h4 className="font-bold text-lg mb-3 flex items-center text-foreground">
                          <Receipt className="w-5 h-5 mr-2 text-primary" />
                          Ordered Dishes
                        </h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto bg-muted/50 rounded-lg p-3 app-scrollbar">
                          {(() => {
                            try {
                              const items = typeof scannedOrder.items === 'string'
                                ? JSON.parse(scannedOrder.items)
                                : scannedOrder.items || [];

                              return items.length > 0 ? items.map((item: any, index: number) => (
                                <div key={index} className="bg-card rounded-lg p-3 shadow-sm border border-border">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="font-bold text-lg text-foreground">{item.name}</span>
                                        {item.isVegetarian && (
                                          <span className="bg-success text-success-foreground px-2 py-1 rounded-full text-xs font-semibold">VEG</span>
                                        )}
                                      </div>
                                      <div className="text-muted-foreground font-medium">₹{item.price} × {item.quantity} pieces</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-xl text-primary">₹{item.price * item.quantity}</div>
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <div className="text-center py-4 text-muted-foreground">No items found</div>
                              );
                            } catch (error) {
                              return (
                                <div className="text-center py-4 text-destructive">Error loading items</div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-3 text-center">
                      <p className="text-sm text-primary">
                        Press <kbd className="px-2 py-1 text-xs bg-primary/20 rounded">Enter</kbd> to deliver or <kbd className="px-2 py-1 text-xs bg-primary/20 rounded">Esc</kbd> to cancel
                      </p>
                    </div>
                  </div>
                )
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBarcodeDialog(false);
                    setSelectedOrderForScan(null);
                    setBarcodeInput("");
                    setScannedOrder(null);
                    setShowOrderDetails(false);
                  }}
                >
                  Cancel
                </Button>

                {showOrderDetails && scannedOrder && (
                  <Button
                    variant="cart"
                    onClick={() => {
                      // For delivered status, use PATCH endpoint
                      apiRequest(`/api/orders/${scannedOrder.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: "delivered" }),
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
                      });
                    }}
                  >
                    {markOrderReadyMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Delivered
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Order Detail Popup */}
        <Dialog open={showOrderDetailPopup} onOpenChange={setShowOrderDetailPopup}>
          <DialogContent className="max-w-2xl w-[95%] max-h-[90vh] overflow-y-auto p-0 app-scrollbar">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center space-x-2">
                <Receipt className="w-5 h-5" />
                Order Details
              </DialogTitle>
            </DialogHeader>

            {selectedOrderForDetails && (
              <div className="p-6 space-y-6">
                <div className="bg-primary/10 rounded-lg p-4">
                  <h3 className="font-bold text-xl mb-4 flex items-center text-foreground">
                    <ChefHat className="w-6 h-6 mr-2 text-primary" />
                    Ordered Dishes
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      try {
                        const items = typeof selectedOrderForDetails.items === 'string'
                          ? JSON.parse(selectedOrderForDetails.items)
                          : selectedOrderForDetails.items || [];

                        return items.length > 0 ? items.map((item: any, index: number) => (
                          <div key={index} className="bg-card rounded-lg p-4 shadow-sm border border-primary/20 dark:border-primary/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span className="font-bold text-xl text-foreground">{item.name}</span>
                                  {item.isVegetarian && (
                                    <span className="bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-semibold">VEG</span>
                                  )}
                                </div>
                                <div className="text-muted-foreground font-medium text-lg">
                                  ₹{item.price} × {item.quantity} pieces
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-2xl text-primary">₹{item.price * item.quantity}</div>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-4 text-muted-foreground">No items found</div>
                        );
                      } catch (error) {
                        return (
                          <div className="text-center py-4 text-destructive">Error loading items</div>
                        );
                      }
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Order Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order ID:</span>
                        <span className="font-mono">#{(() => {
                          const formatted = formatOrderIdDisplay(selectedOrderForDetails.orderNumber || selectedOrderForDetails.id.toString());
                          return formatted.prefix + formatted.highlighted;
                        })()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge className={getOrderStatusColor(selectedOrderForDetails.status)}>
                          {getOrderStatusText(selectedOrderForDetails.status)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Time:</span>
                        <span>{new Date(selectedOrderForDetails.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Time:</span>
                        <span>{selectedOrderForDetails.estimatedTime || 0} minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Customer & Payment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer:</span>
                        <span className="font-medium">{selectedOrderForDetails.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-bold text-xl text-success">₹{selectedOrderForDetails.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Barcode:</span>
                        <span className="font-mono text-xs">{selectedOrderForDetails.barcode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Barcode Used:</span>
                        <span className={selectedOrderForDetails.barcodeUsed ? "text-success" : "text-warning"}>
                          {selectedOrderForDetails.barcodeUsed ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowOrderDetailPopup(false)}
                  >
                    Close
                  </Button>
                  {selectedOrderForDetails.status === "ready" && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOrderDetailPopup(false);
                        setTimeout(() => {
                          handleScanBarcode(selectedOrderForDetails);
                        }, 100);
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <ScanLine className="w-4 h-4 mr-2" />
                      Scan Barcode
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  // Normal Dashboard Layout
  return (
    <div className="h-screen bg-background flex overflow-hidden relative">
      {/* Mobile overlay for sidebar */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 z-100 lg:hidden ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar Navigation */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 md:w-56 ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"} bg-card border-r border-border flex flex-col flex-shrink-0 transform transition-[transform,width] duration-200 ease-in-out lg:relative ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        {/* Sidebar Header */}
        <div className={`border-b flex-shrink-0 ${sidebarCollapsed ? "p-3" : "p-6"}`}>
          <div className={`${sidebarCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between"}`}>
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "space-x-3"}`}>
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-primary" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-lg font-semibold">
                    {canteenDataLoading ? 'Loading...' : (canteenData?.name || 'Canteen Dashboard')}
                  </h1>
                  <p className="text-sm text-muted-foreground">Owner Dashboard</p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <Maximize className="w-4 h-4" /> : <Minimize className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className={`flex-1 ${sidebarCollapsed ? "px-2" : "px-3"} py-4 space-y-2 overflow-y-auto min-h-0 app-scrollbar`}>
          {ownerSidebarConfig["overview"] && (
            <SidebarNavItem
              icon={BarChart3}
              label="Overview"
              active={activeTab === "overview"}
              onClick={() => handleTabChange("overview")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["counters"] && (
            <SidebarNavItem
              icon={Settings}
              label="Counter Selection"
              active={activeTab === "counters"}
              onClick={() => handleNavigate(`/canteen-owner-dashboard/${canteenId}/counters`)}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["orders"] && (
            <SidebarNavItem
              icon={ShoppingBag}
              label="Orders"
              active={activeTab === "orders"}
              onClick={() => handleTabChange("orders")}
              badge={activeOrders.length > 0 ? activeOrders.length : undefined}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["payment-counter"] && (
            <SidebarNavItem
              icon={CreditCard}
              label="Payment Counter"
              active={activeTab === "payment-counter"}
              onClick={() => handleTabChange("payment-counter")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["pos-billing"] && (
            <SidebarNavItem
              icon={Receipt}
              label="POS Billing"
              active={activeTab === "pos-billing"}
              onClick={() => handleTabChange("pos-billing")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["menu"] && (
            <SidebarNavItem
              icon={ChefHat}
              label="Menu Management"
              active={activeTab === "menu"}
              onClick={() => handleTabChange("menu")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["content"] && (
            <SidebarNavItem
              icon={TrendingUp}
              label="Content Manager"
              active={activeTab === "content"}
              onClick={() => handleTabChange("content")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["analytics"] && (
            <SidebarNavItem
              icon={BarChart3}
              label="Analytics"
              active={activeTab === "analytics"}
              onClick={() => handleTabChange("analytics")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["delivery-management"] && (
            <SidebarNavItem
              icon={Truck}
              label="Delivery Management"
              active={activeTab === "delivery-management"}
              onClick={() => handleTabChange("delivery-management")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["qr-manager"] && (
            <SidebarNavItem
              icon={QrCode}
              label="QR Manager"
              active={activeTab === "qr-manager"}
              onClick={() => handleTabChange("qr-manager")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["payout"] && (
            <SidebarNavItem
              icon={DollarSign}
              label="Payout"
              active={activeTab === "payout"}
              onClick={() => handleTabChange("payout")}
              collapsed={sidebarCollapsed}
            />
          )}
          {ownerSidebarConfig["position-bidding"] && (
            <SidebarNavItem
              icon={Gavel}
              label="Bid for Position"
              active={activeTab === "position-bidding"}
              onClick={() => handleTabChange("position-bidding")}
              collapsed={sidebarCollapsed}
            />
          )}

          {/* Store Mode Toggle */}
          {ownerSidebarConfig["store-mode"] && (
            <div className="border-t pt-2 mt-2">
              <SidebarNavItem
                icon={isStoreMode ? Minimize : Maximize}
                label={isStoreMode ? "Exit Store Mode" : "Store Mode"}
                active={false}
                onClick={() => setIsStoreMode(!isStoreMode)}
                collapsed={sidebarCollapsed}
              />
            </div>
          )}

        </nav>

        {/* Sidebar Footer */}
        <div className={`${sidebarCollapsed ? "p-2" : "p-3"} border-t space-y-2 flex-shrink-0`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(true)}
            className={`w-full ${sidebarCollapsed ? "justify-center px-2" : "justify-start"} relative`}
            title={sidebarCollapsed ? "Notifications" : undefined}
          >
            <Bell className={`w-4 h-4 ${sidebarCollapsed ? "" : "mr-2"}`} />
            {!sidebarCollapsed && "Notifications"}
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge
                variant="destructive"
                className={sidebarCollapsed ? "absolute right-1.5 top-1.5 h-5 min-w-5 px-1 flex items-center justify-center text-[10px]" : "ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs"}
              >
                {notifications.filter(n => !n.read).length}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className={`w-full ${sidebarCollapsed ? "justify-center px-2" : "justify-start"}`}
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings className={`w-4 h-4 ${sidebarCollapsed ? "" : "mr-2"}`} />
            {!sidebarCollapsed && "Settings"}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Top Header */}
        <div className="border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setIsSidebarOpen((open) => !open)}
                aria-label="Toggle navigation"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base md:text-lg font-semibold capitalize text-foreground truncate">{activeTab.replace('-', ' ')}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {activeTab === 'pos-billing' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (canteenSettings?.favoriteCounterId) {
                      setLocation(`/canteen-owner-dashboard/${canteenId}/counter/${canteenSettings.favoriteCounterId}`);
                    } else {
                      setShowSettings(true);
                    }
                  }}
                  title={canteenSettings?.favoriteCounterId ? "Go to Favorite Counter" : "Set Favorite Counter"}
                  className="text-primary border-primary/20 hover:bg-primary/10 h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                >
                  <Star className={`w-3.5 h-3.5 ${canteenSettings?.favoriteCounterId ? "fill-primary" : ""}`} />
                </Button>
              )}
              <SyncStatus showStats={false} className="shrink-0 scale-90 sm:scale-100" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setLocation("/login")}
                className="sm:hidden h-8 w-8"
                aria-label="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/login")}
                className="hidden sm:inline-flex hover:bg-accent hover:text-accent-foreground h-8"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-6 min-h-0 overflow-hidden">
          <div className={`max-w-7xl mx-auto w-full ${["orders", "pos-billing", "menu", "content", "analytics", "delivery-management", "payout", "qr-manager"].includes(activeTab)
            ? "h-full flex flex-col min-h-0"
            : ""
            }`}>
            {/* Overview Content */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                  {stats.map((stat, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                            <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{stat.value}</p>
                            <p className="text-[10px] sm:text-xs text-success line-clamp-1">{stat.trend}</p>
                          </div>
                          <stat.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary/60 flex-shrink-0 ml-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recent Orders Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Recent Orders
                      <Button size="sm" onClick={() => setActiveTab("orders")}>
                        View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                      {(paginatedOrders as any[]).slice(0, 7).map((order: any) => (
                        <div
                          key={order.id}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => setLocation(`/canteen-order-detail/${order.id}`)}
                        >
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center font-medium whitespace-nowrap">
                                <span>#{(() => {
                                  const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                  return formatted.prefix;
                                })()}</span>
                                <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-0">
                                  {(() => {
                                    const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                    return formatted.highlighted;
                                  })()}
                                </span>
                              </div>
                              <Badge className={`${getOrderStatusColor(order.status)} whitespace-nowrap`}>
                                {getOrderStatusText(order.status)}
                              </Badge>
                              {(() => {
                                try {
                                  const items = JSON.parse(order.items || '[]');
                                  const hasMarkableItem = items.some((item: any) => {
                                    const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                    return menuItem?.isMarkable === true;
                                  });
                                  return (
                                    <Badge
                                      variant={hasMarkableItem ? "secondary" : "outline"}
                                      className={`${hasMarkableItem ? "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50" : "bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50"} whitespace-nowrap`}
                                    >
                                      {hasMarkableItem ? "Requires Prep" : "Auto-Ready"}
                                    </Badge>
                                  );
                                } catch {
                                  return null;
                                }
                              })()}
                            </div>
                            <p className="text-sm text-muted-foreground">Customer: {order.customerName || 'N/A'}</p>
                            <p className="text-sm">
                              {order.items && typeof order.items === 'string'
                                ? (() => {
                                  try {
                                    const parsedItems = JSON.parse(order.items);
                                    return Array.isArray(parsedItems)
                                      ? parsedItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')
                                      : order.items;
                                  } catch {
                                    return order.items;
                                  }
                                })()
                                : 'No items'
                              }
                            </p>
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <p className="font-semibold">₹{order.amount}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : order.time || 'N/A'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Orders Content */}
            {activeTab === "orders" && (
              <div className="h-full flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col min-h-0">
                  <CardHeader className="flex-shrink-0 p-3 sm:p-4 pb-2 sm:pb-3">
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-base sm:text-lg">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Order Management</span>
                      </div>
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <Input
                          placeholder="Search orders..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full sm:w-64 md:w-80 h-8 sm:h-9 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            refetchPaginated();
                            refetchPaginatedActive();
                          }}
                          className="h-8 sm:h-9 px-2 sm:px-3"
                          aria-label="Refresh orders"
                        >
                          <RefreshCcw className="w-4 h-4" />
                          <span className="hidden sm:inline ml-2">Refresh</span>
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 pt-0 pb-0 overflow-hidden">
                    <Tabs defaultValue="active" className="w-full h-full flex flex-col min-h-0">
                      <TabsList className="w-full mb-2 flex-shrink-0 h-9 hidden">
                        <TabsTrigger value="active">Active Orders ({activeOrders.length})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="active" className="flex-1 flex flex-col min-h-0 mt-0">
                        {!showAllOrders ? (
                          <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-shrink-0 mb-1.5">
                              <div className="flex items-center justify-end">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">{totalActiveOrdersCount} active</Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAllOrders(true)}
                                    className="h-7 text-xs px-2"
                                  >
                                    Show All Orders
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">
                              {paginatedActiveLoading ? (
                                <div className="text-center py-8">
                                  <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                                  <p className="text-muted-foreground">Loading active orders...</p>
                                </div>
                              ) : paginatedActiveOrders.length === 0 ? (
                                <div className="text-center py-8">
                                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                  <p className="text-muted-foreground">No active orders</p>
                                  <p className="text-sm text-muted-foreground mt-2">Active orders will appear here when customers place orders</p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[140px] gap-1.5 sm:gap-2">
                                      {paginatedActiveOrders.map((order: any) => (
                                        <Card key={order.id} className={`h-auto sm:h-[140px] border-l-4 cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl border border-border bg-card flex flex-col ${order.status === 'preparing' ? 'border-l-primary hover:border-l-primary/80' :
                                          order.status === 'ready' ? 'border-l-success hover:border-l-success/80' :
                                            'border-l-warning hover:border-l-warning/80'
                                          }`} onClick={() => handleOrderCardClick(order)}>
                                          <CardContent className="p-2 flex flex-col h-full min-h-0">
                                            <div className="flex flex-col h-full min-h-0">
                                              {/* Header Section - Fixed Height */}
                                              <div className="flex-shrink-0 mb-1">
                                                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                  <div className="flex items-center font-medium text-foreground">
                                                    <span className="text-[10px]">#{(() => {
                                                      const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                                      return formatted.prefix;
                                                    })()}</span>
                                                    <span className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary font-bold px-1 py-0.5 rounded text-[10px] ml-0.5 border border-primary/30 dark:border-primary/50">
                                                      {(() => {
                                                        const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                                        return formatted.highlighted;
                                                      })()}
                                                    </span>
                                                  </div>
                                                  <Badge className={`${getOrderStatusColor(order.status)} text-[10px] px-1 py-0 h-4`}>
                                                    {getOrderStatusText(order.status)}
                                                  </Badge>
                                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{order.estimatedTime}m</Badge>
                                                  {(() => {
                                                    try {
                                                      const items = JSON.parse(order.items || '[]');
                                                      const hasMarkableItem = items.some((item: any) => {
                                                        const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                                        return menuItem?.isMarkable === true;
                                                      });

                                                      return (
                                                        <Badge
                                                          variant={hasMarkableItem ? "secondary" : "outline"}
                                                          className={`${hasMarkableItem ? "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50" : "bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50"} text-[10px] px-1 py-0 h-4`}
                                                        >
                                                          {hasMarkableItem ? "Prep" : "Auto"}
                                                        </Badge>
                                                      );
                                                    } catch (error) {
                                                      return null;
                                                    }
                                                  })()}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">{order.customerName}</p>
                                              </div>

                                              {/* Items List - Flexible with truncation */}
                                              <div className="flex-1 min-h-0 mb-1">
                                                <p className="text-[10px] text-foreground line-clamp-2 leading-tight">
                                                  {order.items && typeof order.items === 'string'
                                                    ? (() => {
                                                      try {
                                                        const parsedItems = JSON.parse(order.items);
                                                        return Array.isArray(parsedItems)
                                                          ? parsedItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')
                                                          : order.items;
                                                      } catch {
                                                        return order.items;
                                                      }
                                                    })()
                                                    : 'No items'
                                                  }
                                                </p>
                                              </div>

                                              {/* Footer Section - Fixed at Bottom */}
                                              <div className="flex-shrink-0 flex items-end justify-between gap-1.5">
                                                <div className="flex flex-col items-start">
                                                  <p className="text-xs font-semibold text-foreground">₹{order.amount}</p>
                                                  <p className="text-[10px] text-muted-foreground">
                                                    {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : 'N/A'}
                                                  </p>
                                                </div>
                                                <div className="flex-shrink-0">
                                                  {(() => {
                                                    try {
                                                      const items = JSON.parse(order.items || '[]');
                                                      const hasMarkableItem = items.some((item: any) => {
                                                        const menuItem = menuItems.find(mi => mi.id === item.id || (mi as any)._id === item.id);
                                                        return menuItem?.isMarkable === true;
                                                      });

                                                      // Auto-Ready orders that are stuck in pending - show Mark Ready button
                                                      if (!hasMarkableItem && order.status === "pending") {
                                                        return (
                                                          <Button
                                                            size="sm"
                                                            variant="cart"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              markOrderReadyMutation.mutate({ orderId: order.id });
                                                            }}
                                                            disabled={markOrderReadyMutation.isPending}
                                                            className="h-5 text-[10px] px-1.5"
                                                            data-testid={`button-mark-ready-${order.id}`}
                                                          >
                                                            {markOrderReadyMutation.isPending ? "..." : "Ready"}
                                                          </Button>
                                                        );
                                                      }

                                                      // Auto-Ready orders show Scan Barcode button when ready
                                                      if (!hasMarkableItem && order.status === "ready") {
                                                        return (
                                                          <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleScanBarcode(order);
                                                            }}
                                                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-5 text-[10px] px-1.5"
                                                            data-testid={`button-scan-barcode-${order.id}`}
                                                          >
                                                            <ScanLine className="w-2.5 h-2.5 mr-0.5" />
                                                            Scan
                                                          </Button>
                                                        );
                                                      }

                                                      // Prep Required orders show Mark Ready button when pending/preparing
                                                      if (hasMarkableItem && (order.status === "pending" || order.status === "preparing")) {
                                                        return (
                                                          <Button
                                                            size="sm"
                                                            variant="cart"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              markOrderReadyMutation.mutate({ orderId: order.id });
                                                            }}
                                                            disabled={markOrderReadyMutation.isPending}
                                                            className="h-5 text-[10px] px-1.5"
                                                            data-testid={`button-mark-ready-${order.id}`}
                                                          >
                                                            {markOrderReadyMutation.isPending ? (
                                                              <>
                                                                <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                                                                ...
                                                              </>
                                                            ) : (
                                                              "Ready"
                                                            )}
                                                          </Button>
                                                        );
                                                      }

                                                      // Prep Required orders show Scan Barcode button when ready
                                                      if (hasMarkableItem && order.status === "ready") {
                                                        return (
                                                          <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleScanBarcode(order);
                                                            }}
                                                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-5 text-[10px] px-1.5"
                                                            data-testid={`button-scan-barcode-${order.id}`}
                                                          >
                                                            <ScanLine className="w-2.5 h-2.5 mr-0.5" />
                                                            Scan
                                                          </Button>
                                                        );
                                                      }

                                                      return null;
                                                    } catch {
                                                      return null;
                                                    }
                                                  })()}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Active Orders Pagination - Bottom */}
                                  <div className="flex-shrink-0 mt-1 pt-1 border-t">
                                    <Pagination
                                      currentPage={currentActivePage}
                                      totalPages={totalActivePages || 1}
                                      onPageChange={goToActivePage}
                                      onNextPage={goToActiveNextPage}
                                      onPreviousPage={goToActivePreviousPage}
                                      onFirstPage={goToActiveFirstPage}
                                      onLastPage={goToActiveLastPage}
                                      hasNextPage={hasActiveNextPage}
                                      hasPreviousPage={hasActivePreviousPage}
                                      totalCount={totalActiveOrdersCount || 0}
                                      pageSize={12}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-shrink-0 mb-1.5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">All Orders</h3>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">Page {currentPage} / {totalPages || 1}</Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAllOrders(false)}
                                    className="h-7 text-xs px-2"
                                  >
                                    Back to Active Orders
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">
                              {paginatedLoading ? (
                                <div className="text-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                  <p className="text-muted-foreground mt-2">Loading orders...</p>
                                </div>
                              ) : paginatedOrders && paginatedOrders.length > 0 ? (
                                <>
                                  <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                                      {paginatedOrders.map((order) => (
                                        <Card key={order.id} className="h-auto sm:h-[180px] cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl border border-border bg-card flex flex-col" onClick={() => handleOrderCardClick(order)}>
                                          <CardContent className="p-2.5 sm:p-3 flex flex-col h-full min-h-0">
                                            <div className="flex flex-col h-full justify-between min-h-0">
                                              {/* Top Section - Order Info */}
                                              <div className="flex-shrink-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <h4 className="font-medium text-sm">
                                                    {(() => {
                                                      const formatted = formatOrderIdDisplay(order.orderNumber);
                                                      return (
                                                        <>
                                                          {formatted.prefix}
                                                          <span className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary font-bold px-1.5 py-0.5 rounded text-xs ml-1 border border-primary/30 dark:border-primary/50">
                                                            {formatted.highlighted}
                                                          </span>
                                                        </>
                                                      );
                                                    })()}
                                                  </h4>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Badge className={`${getOrderStatusColor(order.status)} text-xs px-1.5 py-0 h-5`}>
                                                      {getOrderStatusText(order.status)}
                                                    </Badge>
                                                    {order.isOffline && (
                                                      <Badge variant="outline" className="bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50 text-xs px-1.5 py-0 h-5">
                                                        <CreditCard className="h-3 w-3 mr-0.5" />
                                                        <span className="hidden sm:inline">Offline</span>
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">
                                                  Customer: <span className="text-foreground font-medium">{order.customerName || 'Unknown'}</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                  {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                                                </p>
                                              </div>

                                              {/* Bottom Section - Price and Button */}
                                              <div className="flex-shrink-0 flex items-end justify-between gap-2 mt-2 pt-2 border-t border-border">
                                                <p className="text-xs sm:text-sm font-semibold text-foreground">₹{order.amount}</p>
                                                <Button
                                                  size="sm"
                                                  variant="default"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLocation(`/canteen-order-detail/${order.id}`);
                                                  }}
                                                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl ring-2 ring-primary/20 hover:ring-primary/40 border border-primary/30 dark:border-primary/50 font-semibold h-7 text-xs px-2 sm:px-3 flex-shrink-0"
                                                >
                                                  <span className="hidden sm:inline">View Details</span>
                                                  <span className="sm:hidden">View</span>
                                                </Button>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>

                                  {/* All Orders Pagination */}
                                  <div className="flex-shrink-0 mt-1 pt-1 border-t">
                                    <Pagination
                                      currentPage={currentPage}
                                      totalPages={totalPages || 1}
                                      onPageChange={goToPage}
                                      onNextPage={goToNextPage}
                                      onPreviousPage={goToPreviousPage}
                                      onFirstPage={goToFirstPage}
                                      onLastPage={goToLastPage}
                                      hasNextPage={hasNextPage}
                                      hasPreviousPage={hasPreviousPage}
                                      totalCount={totalOrdersCount || 0}
                                      pageSize={12}
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-muted-foreground">No orders found</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </TabsContent>



                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payment Counter Content */}
            {activeTab === "payment-counter" && (
              <div className="space-y-6">
                <PaymentCounterDashboard canteenId={canteenId || ''} />
              </div>
            )}

            {/* POS Billing Content */}
            {activeTab === "pos-billing" && (
              <div className="h-full flex flex-col min-h-0">
                <PosBilling
                  canteenId={canteenId || ''}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>
            )}

            {/* Menu Content */}
            {activeTab === "menu" && (
              <div className="h-full flex flex-col min-h-0">
                <CanteenOwnerMenuManagement
                  menuItems={menuItems}
                  categories={categories}
                  onMenuUpdate={refetchMenuItems}
                  canteenId={canteenId}
                />
              </div>
            )}

            {/* Content Manager */}
            {activeTab === "content" && (
              <div className="h-full flex flex-col min-h-0">
                <ContentManager canteenId={canteenId} />
              </div>
            )}

            {/* QR Manager Content */}
            {activeTab === "qr-manager" && (
              <div className="h-full flex flex-col min-h-0">
                <CanteenOwnerQRManager />
              </div>
            )}

            {/* Analytics Content */}
            {activeTab === "analytics" && (
              <div className="h-full flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col min-h-0 bg-card border-border">
                  <CardHeader className="flex-shrink-0 p-4 pb-2 border-b border-border">
                    <div>
                      <CardTitle className="text-lg text-foreground">Analytics Dashboard</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Comprehensive insights with date-based filtering</p>
                    </div>

                    {/* Date Controls */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 pt-2 border-t border-border">
                      {/* Timeframe Selector */}
                      <div className="flex items-center space-x-2">
                        <Filter className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">Period:</span>
                        <Select value={analyticsTimeframe} onValueChange={(value: any) => setAnalyticsTimeframe(value)}>
                          <SelectTrigger className="w-28 h-7 text-xs bg-card border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Calendar Date Picker */}
                      <div className="flex items-center space-x-2">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-36 h-7 text-xs justify-start border-border bg-card hover:bg-accent hover:text-accent-foreground"
                            >
                              <CalendarDays className="mr-1 h-3 w-3" />
                              {selectedDate ? selectedDate.toLocaleDateString() : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                if (date) setSelectedDate(date);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Date Range Display */}
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>
                          {(() => {
                            const { startDate, endDate } = getDateRange(analyticsTimeframe, selectedDate);
                            const formatDateRange = () => {
                              const start = startDate.toLocaleDateString();
                              const end = new Date(endDate.getTime() - 1).toLocaleDateString();
                              return analyticsTimeframe === 'daily' ? start : `${start} - ${end}`;
                            };
                            return formatDateRange();
                          })()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-2">
                    <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
                      {(() => {
                        // Calculate filtered data based on selected timeframe and date
                        const { startDate, endDate } = getDateRange(analyticsTimeframe, selectedDate);
                        const filteredOrders = filterOrdersByDateRange(paginatedOrders, startDate, endDate);
                        const periodAnalytics = calculateAnalytics(filteredOrders);

                        return (
                          <div className="space-y-3">
                            {/* Key Performance Indicators */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <Card className="border-l-4 border-l-primary bg-card border-border">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">Total Orders</p>
                                      <p className="text-2xl font-bold text-primary">{periodAnalytics.totalOrders}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{analyticsTimeframe}</p>
                                    </div>
                                    <ShoppingBag className="w-6 h-6 text-primary" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-success bg-card border-border">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
                                      <p className="text-2xl font-bold text-success">₹{periodAnalytics.totalRevenue}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{analyticsTimeframe}</p>
                                    </div>
                                    <DollarSign className="w-6 h-6 text-success" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-warning bg-card border-border">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">Avg Order Value</p>
                                      <p className="text-2xl font-bold text-warning">₹{periodAnalytics.averageOrderValue}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Per order</p>
                                    </div>
                                    <TrendingUp className="w-6 h-6 text-warning" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-primary bg-card border-border">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">Active Items</p>
                                      <p className="text-2xl font-bold text-primary">{menuItems.filter((item: any) => item.available).length}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Menu items</p>
                                    </div>
                                    <ChefHat className="w-6 h-6 text-primary" />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Order Status Analysis */}
                            <Card className="bg-card border-border">
                              <CardHeader className="p-3 pb-2 border-b border-border">
                                <CardTitle className="text-sm flex items-center space-x-2 text-foreground">
                                  <BarChart3 className="w-4 h-4 text-primary" />
                                  Order Status Distribution ({analyticsTimeframe})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                                  {(() => {
                                    const statusConfig = [
                                      { status: 'pending', label: 'Pending', color: 'bg-warning', textColor: 'text-warning' },
                                      { status: 'preparing', label: 'Preparing', color: 'bg-primary', textColor: 'text-primary' },
                                      { status: 'ready', label: 'Ready', color: 'bg-success', textColor: 'text-success' },
                                      { status: 'delivered', label: 'Delivered', color: 'bg-muted', textColor: 'text-muted-foreground' }
                                    ];

                                    return statusConfig.map(config => (
                                      <div key={config.status} className="text-center p-3 border border-border rounded-lg bg-card">
                                        <div className={`w-10 h-10 ${config.color} rounded-full mx-auto mb-1.5 flex items-center justify-center`}>
                                          <span className="text-white font-bold text-sm">{periodAnalytics.statusCounts[config.status] || 0}</span>
                                        </div>
                                        <p className={`font-semibold text-sm ${config.textColor}`}>{config.label}</p>
                                        <p className="text-[10px] text-muted-foreground">Orders</p>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Top Performing Items for Period */}
                            <Card className="bg-card border-border">
                              <CardHeader className="p-3 pb-2 border-b border-border">
                                <CardTitle className="text-sm flex items-center space-x-2 text-foreground">
                                  <Star className="w-4 h-4 text-primary" />
                                  Top Performing Items ({analyticsTimeframe})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                <div className="space-y-3">
                                  {(() => {
                                    const topItems = Object.values(periodAnalytics.itemStats)
                                      .sort((a: any, b: any) => b.quantity - a.quantity)
                                      .slice(0, 5);

                                    if (topItems.length === 0) {
                                      return (
                                        <div className="text-center py-6">
                                          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
                                          <p className="text-sm text-muted-foreground">No order data for selected period</p>
                                        </div>
                                      );
                                    }

                                    const maxQuantity = Math.max(...topItems.map((item: any) => item.quantity));

                                    return topItems.map((item: any, index: number) => (
                                      <div key={index} className="flex items-center space-x-3">
                                        <div className="flex-shrink-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                                          <span className="text-primary-foreground text-xs font-bold">{index + 1}</span>
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-1">
                                            <p className="font-medium text-sm text-foreground">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.quantity} sold</p>
                                          </div>
                                          <div className="w-full bg-muted rounded-full h-1.5">
                                            <div
                                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                              style={{ width: `${maxQuantity > 0 ? (item.quantity / maxQuantity) * 100 : 0}%` }}
                                            ></div>
                                          </div>
                                          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                            <span>₹{item.revenue} revenue</span>
                                            <span>{item.orders} orders</span>
                                          </div>
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Period Activity Timeline */}
                            <Card className="bg-card border-border">
                              <CardHeader className="p-3 pb-2 border-b border-border">
                                <CardTitle className="text-sm flex items-center space-x-2 text-foreground">
                                  <Clock className="w-4 h-4 text-primary" />
                                  Activity Timeline ({analyticsTimeframe})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                <div className="space-y-3">
                                  {(() => {
                                    const recentOrders = [...filteredOrders]
                                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                      .slice(0, 10);

                                    if (recentOrders.length === 0) {
                                      return (
                                        <div className="text-center py-6">
                                          <Clock className="w-10 h-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
                                          <p className="text-sm text-muted-foreground">No activity for selected period</p>
                                        </div>
                                      );
                                    }

                                    return recentOrders.map((order: any, index: number) => (
                                      <div key={order.id} className="flex items-start space-x-2 pb-3 border-b border-border last:border-b-0">
                                        <div className={`w-2.5 h-2.5 rounded-full mt-2 ${order.status === 'delivered' ? 'bg-success' :
                                          order.status === 'ready' ? 'bg-primary' :
                                            order.status === 'preparing' ? 'bg-warning' :
                                              'bg-warning'
                                          }`}></div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="font-medium text-sm text-foreground truncate">
                                              Order #{(() => {
                                                const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                                                return formatted.prefix + formatted.highlighted;
                                              })()}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                              {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                                            </span>
                                          </div>
                                          <p className="text-xs text-muted-foreground truncate">{order.customerName}</p>
                                          <div className="flex items-center justify-between mt-1 gap-2">
                                            <Badge className={`${getOrderStatusColor(order.status)} text-xs px-1.5 py-0 h-4 border-border`} variant="outline">
                                              {getOrderStatusText(order.status)}
                                            </Badge>
                                            <span className="text-xs font-medium text-foreground">₹{order.amount}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Daily Detailed View (when daily is selected) */}
                            {analyticsTimeframe === 'daily' && (
                              <Card className="bg-card border-border">
                                <CardHeader className="p-3 pb-2 border-b border-border">
                                  <CardTitle className="text-sm flex items-center space-x-2 text-foreground">
                                    <CalendarDays className="w-4 h-4 text-primary" />
                                    Daily Performance - {selectedDate.toLocaleDateString()}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                      {
                                        title: "Daily Orders",
                                        value: periodAnalytics.totalOrders,
                                        subtitle: "orders placed",
                                        color: "text-primary"
                                      },
                                      {
                                        title: "Daily Revenue",
                                        value: `₹${periodAnalytics.totalRevenue}`,
                                        subtitle: "total sales",
                                        color: "text-success"
                                      },
                                      {
                                        title: "Avg Order Value",
                                        value: `₹${periodAnalytics.averageOrderValue}`,
                                        subtitle: "per order",
                                        color: "text-warning"
                                      }
                                    ].map((metric, index) => (
                                      <div key={index} className="text-center p-3 border border-border rounded-lg bg-card">
                                        <p className="text-xs font-medium text-muted-foreground">{metric.title}</p>
                                        <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
                                        <p className="text-[10px] text-muted-foreground">{metric.subtitle}</p>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Menu Performance Matrix for Period */}
                            <Card className="bg-card border-border">
                              <CardHeader className="p-3 pb-2 border-b border-border">
                                <CardTitle className="text-sm flex items-center space-x-2 text-foreground">
                                  <ChefHat className="w-4 h-4 text-primary" />
                                  Menu Performance Matrix ({analyticsTimeframe})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                <div className="overflow-x-auto app-scrollbar">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left p-1.5 text-foreground">Item Name</th>
                                        <th className="text-left p-1.5 text-foreground">Category</th>
                                        <th className="text-left p-1.5 text-foreground">Price</th>
                                        <th className="text-left p-1.5 text-foreground">Status</th>
                                        <th className="text-left p-1.5 text-foreground">Orders</th>
                                        <th className="text-left p-1.5 text-foreground">Revenue</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {menuItems.map((item: any) => {
                                        const itemStat = periodAnalytics.itemStats[item.name] || { quantity: 0, revenue: 0, orders: 0 };
                                        const category = categories.find((cat: any) => {
                                          const catId = cat.id || cat._id;
                                          const itemCategoryId = item.categoryId;
                                          return catId === itemCategoryId ||
                                            catId === (itemCategoryId as any)?._id ||
                                            catId === (itemCategoryId as any)?.id ||
                                            String(catId) === String(itemCategoryId);
                                        });

                                        return (
                                          <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                                            <td className="p-1.5 font-medium text-foreground">{item.name}</td>
                                            <td className="p-1.5 text-muted-foreground">{category?.name || 'Uncategorized'}</td>
                                            <td className="p-1.5 text-foreground">₹{item.price}</td>
                                            <td className="p-1.5">
                                              <Badge
                                                variant={item.available ? "default" : "secondary"}
                                                className={`text-[10px] px-1 py-0 h-4 border-border ${item.available
                                                  ? "bg-success/20 text-success border-success/40"
                                                  : "bg-muted text-muted-foreground"
                                                  }`}
                                              >
                                                {item.available ? "Available" : "Unavailable"}
                                              </Badge>
                                            </td>
                                            <td className="p-1.5 text-foreground">{itemStat.quantity}</td>
                                            <td className="p-1.5 font-medium text-primary">₹{itemStat.revenue}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Delivery Management Content */}
            {activeTab === "delivery-management" && (
              <div className="h-full flex flex-col min-h-0">
                <DeliveryManagement canteenId={canteenId || ''} />
              </div>
            )}

            {/* Payout Content */}
            {activeTab === "payout" && (
              <div className="h-full flex flex-col min-h-0">
                <PayoutManagement canteenId={canteenId || ''} />
              </div>
            )}

            {/* Position Bidding Content */}
            {activeTab === "position-bidding" && (
              <PositionBidding canteenId={canteenId || ''} />
            )}

          </div>
        </div>
      </div>


      {/* Notifications Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto app-scrollbar">
          <DialogHeader>
            <DialogDescription className="sr-only">
              Recent notifications and updates
            </DialogDescription>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </DialogTitle>
              {notifications.length > 0 && (
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                      disabled={isMarkingAllAsRead}
                    >
                      {isMarkingAllAsRead ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Marking...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark all read
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllNotifications}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {notificationsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.read;
                return (
                  <div key={notification.id} className={`p-3 border rounded-lg ${isUnread ? 'bg-primary/5 border-primary/20' : ''
                    }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title || notification.type}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          disabled={isMarkingAsRead}
                          className="ml-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto app-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Manage your account and canteen preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="space-y-4">
              {/* Canteen Profile Visuals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Canteen Identity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative group">
                      <Avatar className="w-20 h-20 border-2 border-border">
                        <AvatarImage src={canteenData?.imageUrl} alt={canteenData?.name} className="object-cover" />
                        <AvatarFallback className="text-lg bg-muted">
                          {canteenData?.name?.substring(0, 2).toUpperCase() || "CN"}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md hover:bg-primary/90 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImageUploading}
                      >
                        {isImageUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={onSelectImage}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{canteenData?.name || "My Canteen"}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a profile picture. Max 100KB original,<br />
                        auto-compressed to ~20KB.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Canteen Logo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Canteen Logo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative group">
                      <Avatar className="w-20 h-20 border-2 border-border rounded-lg">
                        <AvatarImage src={(canteenData as any)?.logoUrl} alt={canteenData?.name} className="object-contain" />
                        <AvatarFallback className="text-lg bg-muted rounded-lg">
                          {canteenData?.name?.substring(0, 2).toUpperCase() || "LG"}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md hover:bg-primary/90 transition-colors transform translate-x-1/4 translate-y-1/4"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isLogoUploading}
                      >
                        {isLogoUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="file"
                        ref={logoInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={onSelectLogo}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Brand Logo</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload your canteen logo (1:1 ratio).<br />
                        Target: ~20KB, Limit: 100KB.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Canteen Banner */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Canteen Banner</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative group w-full max-w-[200px] aspect-[4/3]">
                      <div className="w-full h-full border-2 border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {(canteenData as any)?.bannerUrl ? (
                          <img
                            src={(canteenData as any)?.bannerUrl}
                            alt="Canteen Banner"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <button
                        className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md hover:bg-primary/90 transition-colors"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={isBannerUploading}
                      >
                        {isBannerUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="file"
                        ref={bannerInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={onSelectBanner}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Marketing Banner</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a banner image (4:3 ratio).<br />
                        Target: ~100KB, Limit: 200KB.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Account</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{user?.name || 'Canteen Owner'}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </CardContent>
              </Card>

              {/* Preferences Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Preferences</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Theme</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {themeOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`p-3 rounded-lg border transition-all ${isActive
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                              }`}
                          >
                            <div className="flex flex-col items-center space-y-2">
                              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className={`text-sm ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                                {option.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: {theme.charAt(0).toUpperCase() + theme.slice(1)} ({resolvedTheme})
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Favorite Counter</Label>
                    <Select
                      value={canteenSettings?.favoriteCounterId || "none"}
                      onValueChange={(value) => {
                        updateFavoriteCounterMutation.mutate(value === "none" ? "" : value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a favorite counter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {counters.map((counter: any) => (
                          <SelectItem key={counter.id} value={counter.id}>
                            {counter.name} ({counter.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Set your default counter for quick access
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* App Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Info className="w-5 h-5" />
                    <span>App Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">App Version</p>
                      <p className="font-semibold text-foreground">{versionInfo.version}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Cache Version</p>
                      <p className="font-semibold text-foreground">{versionInfo.cacheVersion}</p>
                    </div>
                  </div>
                  {updateAvailable && (
                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        <p className="text-sm font-medium text-warning">Update Available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Actions Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <RefreshCcw className="w-5 h-5" />
                    <span>System Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 justify-start"
                      onClick={async () => {
                        await passiveUpdateDetector.manualCheck();
                      }}
                    >
                      <Download className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Check for Updates</p>
                        <p className="text-xs text-muted-foreground">Check if updates are available</p>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 justify-start"
                      onClick={async () => {
                        if (isRefreshing) return;
                        setIsRefreshing(true);
                        try {
                          await UpdateManager.forceRefresh();
                        } catch (error) {
                          console.error('Force refresh failed:', error);
                        } finally {
                          setIsRefreshing(false);
                        }
                      }}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-5 h-5 mr-3" />
                      )}
                      <div className="text-left">
                        <p className="font-semibold">{isRefreshing ? 'Refreshing...' : 'Force Refresh'}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRefreshing ? 'Clearing cache...' : 'Refresh all data and clear cache'}
                        </p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanning Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent className="max-w-lg w-[90%] sm:max-w-md max-h-[85vh] overflow-y-auto p-6 rounded-lg app-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <ScanLine className="w-5 h-5" />
              Barcode Scanner
            </DialogTitle>
            <DialogDescription className="sr-only">
              Scan utility for orders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Barcode Input Section */}
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Enter or Scan Barcode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barcodeInput">Barcode</Label>
                  <Input
                    id="barcodeInput"
                    placeholder="Scan barcode or type manually..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (barcodeInput.trim()) {
                          handleBarcodeSubmit();
                        }
                      }
                    }}
                    className="text-center font-mono text-lg"
                    autoFocus
                  />
                </div>

                <div className="bg-warning/20 border border-warning/40 dark:border-warning/50 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <p className="font-medium text-warning text-sm">Instructions</p>
                  </div>
                  <p className="text-xs text-warning/90">
                    Enter the barcode and press <kbd className="px-1 py-0.5 text-xs font-semibold text-warning bg-warning/20 border border-warning/40 rounded">Enter</kbd> to find the order
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBarcodeSubmit();
                  }}
                  className="w-full"
                  disabled={!barcodeInput.trim()}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Find Order
                </Button>
              </CardContent>
            </Card>

            {/* Complete Order Details - Show after successful barcode scan */}
            {showOrderDetails && scannedOrder && (
              <div className="space-y-4">
                {/* Complete Order Information */}
                <div className="bg-success/20 border border-success/40 dark:border-success/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <h3 className="font-semibold text-success">Order Found!</h3>
                  </div>

                  {/* Basic Order Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Order ID:</span>
                      <p className="font-mono font-medium">#{(() => {
                        const formatted = formatOrderIdDisplay(scannedOrder.orderNumber || scannedOrder.id.toString());
                        return formatted.prefix + formatted.highlighted;
                      })()}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        <Badge className={getOrderStatusColor(scannedOrder.status)}>
                          {getOrderStatusText(scannedOrder.status)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      <p className="font-medium">{scannedOrder.customerName || 'N/A'}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <p className="font-bold text-lg text-success">₹{scannedOrder.amount}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Barcode:</span>
                      <p className="font-mono text-xs">{scannedOrder.barcode}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Order Time:</span>
                      <p className="text-xs">{new Date(scannedOrder.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* DISHES/ITEMS - PRIORITY DISPLAY */}
                  <div className="border-t pt-4 mb-4">
                    <h4 className="font-bold text-lg mb-3 flex items-center text-foreground">
                      <Receipt className="w-5 h-5 mr-2 text-primary" />
                      Ordered Dishes
                    </h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto bg-muted/50 rounded-lg p-3">
                      {(() => {
                        try {
                          const items = typeof scannedOrder.items === 'string'
                            ? JSON.parse(scannedOrder.items)
                            : scannedOrder.items || [];

                          return items.length > 0 ? items.map((item: any, index: number) => (
                            <div key={index} className="bg-card rounded-lg p-3 shadow-sm border border-border">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-bold text-lg text-foreground">{item.name}</span>
                                    {item.isVegetarian && (
                                      <span className="bg-success text-success-foreground px-2 py-1 rounded-full text-xs font-semibold">VEG</span>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground font-medium">₹{item.price} × {item.quantity} pieces</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-xl text-primary">₹{item.price * item.quantity}</div>
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-4 text-muted-foreground">No items found</div>
                          );
                        } catch (error) {
                          return (
                            <div className="text-center py-4 text-destructive">Error loading items</div>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="border-t pt-2 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Time:</span>
                        <span>{scannedOrder.estimatedTime || 0} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Barcode Used:</span>
                        <span className={scannedOrder.barcodeUsed ? "text-success" : "text-warning"}>
                          {scannedOrder.barcodeUsed ? "Yes" : "No"}
                        </span>
                      </div>
                      {scannedOrder.deliveredAt && (
                        <div className="col-span-2 flex justify-between">
                          <span className="text-muted-foreground">Delivered:</span>
                          <span>{new Date(scannedOrder.deliveredAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>



                <div className="bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-primary">
                    Press <kbd className="px-2 py-1 text-xs bg-primary/20 rounded">Enter</kbd> to deliver or <kbd className="px-2 py-1 text-xs bg-primary/20 rounded">Esc</kbd> to cancel
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBarcodeDialog(false);
                  setSelectedOrderForScan(null);
                  setBarcodeInput("");
                  setScannedOrder(null);
                  setShowOrderDetails(false);
                }}
              >
                Cancel
              </Button>

              {showOrderDetails && scannedOrder && (
                <Button
                  variant="cart"
                  onClick={() => {
                    // For delivered status, use PATCH endpoint
                    apiRequest(`/api/orders/${scannedOrder.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: "delivered" }),
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/orders/active/paginated"] });
                    });
                  }}
                >
                  {markOrderReadyMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Delivered
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Detail Popup */}
      <Dialog open={showOrderDetailPopup} onOpenChange={setShowOrderDetailPopup}>
        <DialogContent className="max-w-2xl w-[95%] max-h-[90vh] overflow-y-auto p-0 app-scrollbar">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="w-5 h-5" />
              Order Details
            </DialogTitle>
          </DialogHeader>

          {selectedOrderForDetails && (
            <div className="p-6 space-y-6">
              {/* ORDERED DISHES - PRIORITY DISPLAY */}
              <div className="bg-primary/10 rounded-lg p-4">
                <h3 className="font-bold text-xl mb-4 flex items-center text-foreground">
                  <ChefHat className="w-6 h-6 mr-2 text-primary" />
                  Ordered Dishes
                </h3>
                <div className="space-y-3">
                  {(() => {
                    try {
                      const items = typeof selectedOrderForDetails.items === 'string'
                        ? JSON.parse(selectedOrderForDetails.items)
                        : selectedOrderForDetails.items || [];

                      return items.length > 0 ? items.map((item: any, index: number) => (
                        <div key={index} className="bg-card rounded-lg p-4 shadow-sm border border-primary/20 dark:border-primary/30">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="font-bold text-xl text-foreground">{item.name}</span>
                                {item.isVegetarian && (
                                  <span className="bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-semibold">VEG</span>
                                )}
                              </div>
                              <div className="text-muted-foreground font-medium text-lg">
                                ₹{item.price} × {item.quantity} pieces
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-2xl text-primary">₹{item.price * item.quantity}</div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-muted-foreground">No items found</div>
                      );
                    } catch (error) {
                      return (
                        <div className="text-center py-4 text-destructive">Error loading items</div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Order Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Order Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-mono">#{(() => {
                        const formatted = formatOrderIdDisplay(selectedOrderForDetails.orderNumber || selectedOrderForDetails.id.toString());
                        return formatted.prefix + formatted.highlighted;
                      })()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={getOrderStatusColor(selectedOrderForDetails.status)}>
                        {getOrderStatusText(selectedOrderForDetails.status)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Time:</span>
                      <span>{new Date(selectedOrderForDetails.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Time:</span>
                      <span>{selectedOrderForDetails.estimatedTime || 0} minutes</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Customer & Payment</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="font-medium">{selectedOrderForDetails.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Mode:</span>
                      <Badge variant={selectedOrderForDetails.isOffline ? 'outline' : 'default'} className={
                        selectedOrderForDetails.isOffline ? 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50' : ''
                      }>
                        {selectedOrderForDetails.isOffline ? 'Offline Payment' : 'Online Payment'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-bold text-xl text-success">₹{selectedOrderForDetails.amount}</span>
                    </div>
                    {selectedOrderForDetails.isOffline && selectedOrderForDetails.paymentConfirmedBy && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Confirmed By:</span>
                        <CounterNameDisplay counterId={selectedOrderForDetails.paymentConfirmedBy} />
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Barcode:</span>
                      <span className="font-mono text-xs">{selectedOrderForDetails.barcode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Barcode Used:</span>
                      <span className={selectedOrderForDetails.barcodeUsed ? "text-success" : "text-warning"}>
                        {selectedOrderForDetails.barcodeUsed ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offline Payment Confirmation Details */}
              {selectedOrderForDetails.isOffline && selectedOrderForDetails.paymentConfirmedBy && (
                <div className="bg-success/20 border border-success/40 dark:border-success/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center text-success">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Offline Payment Confirmation
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confirmed by Counter:</span>
                      <CounterNameDisplay counterId={selectedOrderForDetails.paymentConfirmedBy} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium">Cash/Card at Counter</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confirmation Status:</span>
                      <Badge variant="default" className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50">
                        Verified
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowOrderDetailPopup(false)}
                >
                  Close
                </Button>
                {selectedOrderForDetails.status === "ready" && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOrderDetailPopup(false);
                      setTimeout(() => {
                        handleScanBarcode(selectedOrderForDetails);
                      }, 100);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <ScanLine className="w-4 h-4 mr-2" />
                    Scan Barcode
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Cropper Modal */}
      {
        selectedImage && (
          <ImageCropper
            imageSrc={selectedImage}
            isOpen={showCropper}
            onClose={() => {
              setShowCropper(false);
              setSelectedImage(null);
            }}
            onCropComplete={handleCropComplete}
            aspect={16 / 9} // Using 16:9 as a reasonable default for canteen banners/cards
          />
        )
      }
      {/* Logo Cropper */}
      {
        showLogoCropper && selectedLogo && (
          <ImageCropper
            imageSrc={selectedLogo}
            isOpen={showLogoCropper}
            onClose={() => {
              setShowLogoCropper(false);
              setSelectedLogo(null);
            }}
            onCropComplete={handleLogoCropComplete}
            aspect={1} // 1:1 for logo
          />
        )
      }
      {/* Banner Cropper */}
      {
        showBannerCropper && selectedBanner && (
          <ImageCropper
            imageSrc={selectedBanner}
            isOpen={showBannerCropper}
            onClose={() => {
              setShowBannerCropper(false);
              setSelectedBanner(null);
            }}
            onCropComplete={handleBannerCropComplete}
            aspect={4 / 3} // 4:3 for banner
          />
        )
      }
    </div >
  );
}
