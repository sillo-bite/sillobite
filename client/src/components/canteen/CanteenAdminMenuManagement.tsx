import React, { useState, useEffect } from "react";


import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useTriggerBasedUpdates } from "@/hooks/useTriggerBasedUpdates";
import { VegIndicator } from "@/components/ui/VegIndicator";
import ImageUpload from "@/components/ui/ImageUpload";
import MenuAnalytics from "@/components/menu/MenuAnalytics";
import type { MenuItem, Category } from "@shared/schema";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Loader2,
  X,
  ChefHat,
  TrendingUp,
  AlertTriangle,
  Package,
  BarChart3,
  Filter,
  Minus,
  Download,
  Upload,
  Eye,
  Save,
  Utensils
} from "lucide-react";

interface CanteenAdminMenuManagementProps {
  canteenId: string;
}

// Category Icon Component
const CategoryIcon = ({ category }: { category: Category }) => {
  // Priority: imageUrl > icon > default icon
  if (category.imageUrl) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        <img 
          src={category.imageUrl} 
          alt={category.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If image fails to load, hide the img and show fallback
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = category.icon || '<svg class="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>';
            }
          }}
        />
      </div>
    );
  }
  
  if (category.icon) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg">
        {category.icon}
      </div>
    );
  }
  
  // Default fallback icon
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
      <Utensils className="w-4 h-4 text-muted-foreground" />
    </div>
  );
};

export default function CanteenAdminMenuManagement({ canteenId }: CanteenAdminMenuManagementProps) {
  const { triggerMenuRefresh } = useTriggerBasedUpdates();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  // Debounce search term to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory, stockFilter]);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState("");
  const [newCategoryImagePublicId, setNewCategoryImagePublicId] = useState("");
  const [pendingNewCategoryImageFile, setPendingNewCategoryImageFile] = useState<File | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    icon: "",
    imageUrl: "",
    imagePublicId: ""
  });
  const [pendingCategoryImageFile, setPendingCategoryImageFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    categoryId: "",
    description: "",
    stock: "",
    available: true,
    isVegetarian: true,
    isMarkable: true,
    addOns: "[]",
    imageUrl: "",
    imagePublicId: "",
    storeCounterId: "",
    paymentCounterId: "",
    kotCounterId: ""
  });
  
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [addOns, setAddOns] = useState<Array<{ name: string; price: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [chargeForm, setChargeForm] = useState({ name: "", type: "percent", value: "" });
  const [selectedCharge, setSelectedCharge] = useState<any>(null);

  // Reset categories pagination when search changes
  useEffect(() => {
    setCategoriesPage(1);
  }, [categorySearchTerm]);
  // Pagination state - Use higher limit for menu management to show all items
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1000); // Show all items by default in menu management
  
  // Fetch menu items with pagination and server-side filtering
  const { data: menuData, isLoading: menuLoading, refetch: refetchMenuItems } = useQuery<{
    items: MenuItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    filters: {
      search: string;
      category: string;
      stockFilter: string;
      sortBy: string;
      sortOrder: string;
    };
  }>({
    queryKey: ['/api/menu', canteenId, debouncedSearchTerm, selectedCategory, stockFilter, currentPage, itemsPerPage],
    queryFn: () => {
      const params = new URLSearchParams({
        canteenId: canteenId || '',
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        availableOnly: 'false', // Show all items in menu management (including unavailable/out of stock)
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(stockFilter !== 'all' && { stockFilter })
      });
      
      console.log('📋 Menu Management - Fetching menu items:', {
        canteenId,
        page: currentPage,
        limit: itemsPerPage,
        params: params.toString()
      });
      
      return apiRequest(`/api/menu?${params.toString()}`);
    },
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 2, // 2 minutes - shorter for real-time filtering
    gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const menuItems = menuData?.items || [];
  const pagination = menuData?.pagination;
  
  // Debug logging
  console.log('📋 Menu Management - Menu data received:', {
    canteenId,
    itemsCount: menuItems.length,
    totalItems: pagination?.totalItems,
    currentPage: pagination?.currentPage,
    totalPages: pagination?.totalPages,
    sampleCanteenIds: menuItems.slice(0, 5).map(item => item.canteenId)
  });

  // Categories pagination state
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesPerPage, setCategoriesPerPage] = useState(50);
  
  // Fetch categories with pagination and optimized caching
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useQuery<{
    items: Category[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    filters: {
      search: string;
      sortBy: string;
      sortOrder: string;
    };
  }>({
    queryKey: ['/api/categories', canteenId, categoriesPage, categoriesPerPage, categorySearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        canteenId,
        page: categoriesPage.toString(),
        limit: categoriesPerPage.toString(),
        ...(categorySearchTerm && { search: categorySearchTerm })
      });
      return apiRequest(`/api/categories?${params.toString()}`);
    },
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 15, // 15 minutes - categories change less frequently
    gcTime: 1000 * 60 * 20, // 20 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch counters for the canteen
  const { data: countersData, isLoading: countersLoading, error: countersError } = useQuery<{
    items: Array<{ id: string; name: string; code: string; type: 'payment' | 'store' | 'kot' }>;
  }>({
    queryKey: ['/api/counters', canteenId],
    queryFn: async () => {
      const params = new URLSearchParams({ canteenId });
      const result = await apiRequest(`/api/counters?${params.toString()}`);
      console.log('🔍 Admin Counters API Response:', result);
      return result;
    },
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate store, payment, and KOT counters
  const storeCounters = (countersData as unknown as any[])?.filter((counter: any) => counter.type === 'store') || [];
  const paymentCounters = (countersData as unknown as any[])?.filter((counter: any) => counter.type === 'payment') || [];
  const kotCounters = (countersData as unknown as any[])?.filter((counter: any) => counter.type === 'kot') || [];

  // Charges (checkout fees) for this canteen
  const { data: chargesData, isLoading: chargesLoading, refetch: refetchCharges } = useQuery<{
    items: Array<{ id: string; name: string; type: 'percent' | 'fixed'; value: number; active: boolean; createdAt?: string }>;
  }>({
    queryKey: ['/api/canteens', canteenId, 'charges'],
    queryFn: async () => {
      return apiRequest(`/api/canteens/${canteenId}/charges`);
    },
    enabled: !!canteenId
  });
  
  // Debug logging
  console.log('🔍 Admin Counters Data:', countersData);
  console.log('🔍 Admin Store Counters:', storeCounters);
  console.log('🔍 Admin Payment Counters:', paymentCounters);
  console.log('🔍 Admin KOT Counters:', kotCounters);
  console.log('🔍 Admin Counters Loading:', countersLoading);
  console.log('🔍 Admin Counters Error:', countersError);

  const categories = categoriesData?.items || [];
  const categoriesPagination = categoriesData?.pagination;



  // Server-side filtering is now handled in the API call
  // No client-side filtering needed
  const filteredItems = menuItems;

  // Update menu item mutation
  const updateMenuItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest(`/api/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      // Only invalidate the specific canteen query to avoid cascade
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      setEditingItem(null);
      resetForm();
    },
    onError: (error) => {
      console.error('Update error:', error);
      }
  });

  // Add menu item mutation
  const addMenuItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const requestData = {
        ...data,
        canteenId: canteenId
      };
      return apiRequest('/api/menu', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      // Use a more conservative approach to avoid multiple API calls
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/menu', canteenId],
          exact: false,
          refetchType: 'active' // Only refetch active queries
        });
      }, 100); // Small delay to batch invalidations
      resetForm();
      setIsAddingItem(false);
    },
    onError: (error) => {
      console.error('Add error:', error);
      }
  });

  // Delete menu item mutation
  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/menu/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Use a more conservative approach to avoid multiple API calls
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/menu', canteenId],
          exact: false,
          refetchType: 'active' // Only refetch active queries
        });
      }, 100); // Small delay to batch invalidations
      },
    onError: (error) => {
      console.error('Delete error:', error);
      }
  });

  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; canteenId: string; icon?: string; imageUrl?: string; imagePublicId?: string }) => {
      return apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories', canteenId] });
      setNewCategoryName("");
      setNewCategoryIcon("");
      setNewCategoryImageUrl("");
      setNewCategoryImagePublicId("");
      setPendingNewCategoryImageFile(null);
      setIsAddingCategory(false);
    },
    onError: (error) => {
      console.error('Add category error:', error);
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/categories/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories', canteenId] });
      setDeletingCategory(null);
    },
    onError: (error) => {
      console.error('Delete category error:', error);
      }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; icon?: string; imageUrl?: string; imagePublicId?: string }) => {
      return apiRequest(`/api/categories/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories', canteenId] });
      setEditingCategory(null);
      setEditCategoryForm({ name: "", icon: "", imageUrl: "", imagePublicId: "" });
      setPendingCategoryImageFile(null);
    },
    onError: (error) => {
      console.error('Update category error:', error);
    }
  });

  // Upload category image mutation
  const uploadCategoryImageMutation = useMutation({
    mutationFn: async (data: { categoryId: string; image: File }) => {
      const formData = new FormData();
      formData.append('image', data.image);
      
      const response = await fetch(`/api/categories/${data.categoryId}/image`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setEditCategoryForm(prev => ({ 
        ...prev, 
        imageUrl: data.imageUrl, 
        imagePublicId: data.imagePublicId 
      }));
      setPendingCategoryImageFile(null);
    },
    onError: (error) => {
      console.error('Upload category image error:', error);
    }
  });

  // Remove category image mutation
  const removeCategoryImageMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      return apiRequest(`/api/categories/${categoryId}/image`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      setEditCategoryForm(prev => ({ ...prev, imageUrl: "", imagePublicId: "" }));
    },
    onError: (error) => {
      console.error('Remove category image error:', error);
    }
  });

  // Upload menu item image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      console.log('📸 ADMIN: Upload mutation called!', {
        id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isFileValid: file instanceof File
      });
      
      if (!(file instanceof File)) {
        console.error('❌ ADMIN: Not a valid File object:', file);
        throw new Error('Invalid file object');
      }
      
      if (!id) {
        console.error('❌ ADMIN: No menu item ID provided');
        throw new Error('Menu item ID is required');
      }
      
      const formData = new FormData();
      formData.append('image', file);
      
      console.log('📸 ADMIN: FormData created', {
        hasImage: formData.has('image'),
        formDataKeys: Array.from(formData.keys())
      });
      
      const url = `/api/menu/${id}/image`;
      console.log('📸 ADMIN: About to send fetch request', { url });
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });
      
      console.log('📸 ADMIN: Response received', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ADMIN: Upload failed', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Upload failed' };
        }
        
        throw new Error(errorData.message || `Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ ADMIN: Upload successful', responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log('✅ ADMIN: Upload mutation success callback', data);
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      
      // Update form state with new image data
      setEditForm(prev => ({
        ...prev,
        imageUrl: data.imageUrl,
        imagePublicId: data.publicId
      }));
    },
    onError: (error: any) => {
      console.error('❌ ADMIN: Image upload mutation error:', error);
      const errorMessage = error?.message || 'Failed to upload image';
      console.error('Error details:', {
        message: errorMessage,
        error: error
      });
    }
  });

  // Remove menu item image mutation
  const removeImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/menu/${id}/image`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Delete failed' }));
        throw new Error(errorData.message || 'Delete failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      
      // Update form state to remove image data
      setEditForm(prev => ({
        ...prev,
        imageUrl: "",
        imagePublicId: ""
      }));
    },
    onError: (error) => {
      console.error('Image removal error:', error);
    }
  });

  // Upload new category image mutation
  const uploadNewCategoryImageMutation = useMutation({
    mutationFn: async (data: { categoryId: string; image: File }) => {
      const formData = new FormData();
      formData.append('image', data.image);
      
      const response = await fetch(`/api/categories/${data.categoryId}/image`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setNewCategoryImageUrl(data.imageUrl);
      setNewCategoryImagePublicId(data.imagePublicId);
      setPendingNewCategoryImageFile(null);
    },
    onError: (error) => {
      console.error('Upload new category image error:', error);
    }
  });

  // Charges mutations
  const createChargeMutation = useMutation({
    mutationFn: async (payload: { name: string; type: 'percent' | 'fixed'; value: number }) => {
      return apiRequest(`/api/canteens/${canteenId}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, active: true })
      });
    },
    onSuccess: () => {
      refetchCharges();
      setChargeForm({ name: "", type: "percent", value: "" });
    }
  });

  const updateChargeMutation = useMutation({
    mutationFn: async (payload: { id: string; name?: string; type?: 'percent' | 'fixed'; value?: number; active?: boolean }) => {
      const { id, ...data } = payload;
      return apiRequest(`/api/canteen-charges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      refetchCharges();
      setSelectedCharge(null);
    }
  });

  const deleteChargeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/canteen-charges/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      refetchCharges();
    }
  });

  const resetForm = () => {
    setEditForm({
      name: "",
      price: "",
      categoryId: "",
      description: "",
      stock: "",
      available: true,
      isVegetarian: true,
      isMarkable: true,
      addOns: "[]",
      imageUrl: "",
      imagePublicId: "",
      storeCounterId: "",
      paymentCounterId: ""
    });
    setAddOns([]);
    setPendingImageFile(null);
  };

  // XML Export/Import Functions
  const exportToXML = () => {
    try {
      const exportData = {
        categories: categories.map(cat => ({
          name: cat.name,
          createdAt: cat.createdAt
        })),
        counters: [
          ...(storeCounters || []).map(counter => ({
            name: counter.name,
            code: counter.code,
            type: 'store'
          })),
          ...(paymentCounters || []).map(counter => ({
            name: counter.name,
            code: counter.code,
            type: 'payment'
          })),
          ...(kotCounters || []).map(counter => ({
            name: counter.name,
            code: counter.code,
            type: 'kot'
          }))
        ],
        menuItems: menuItems.map(item => ({
          name: item.name,
          price: item.price,
          categoryName: (() => {
            if (typeof item.categoryId === 'object' && (item.categoryId as any)?.name) {
              return (item.categoryId as any).name;
            }
            const categoryIdToFind = typeof item.categoryId === 'string' 
              ? item.categoryId 
              : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);
            return categories.find(cat => cat.id === categoryIdToFind)?.name || '';
          })(),
          available: item.available,
          stock: item.stock,
          description: item.description || '',
          addOns: item.addOns,
          isVegetarian: item.isVegetarian,
          isMarkable: item.isMarkable,
          isQuickPick: item.isQuickPick || false,
          isTrending: item.isTrending,
          storeCounterCode: storeCounters?.find(counter => counter.id === item.storeCounterId)?.code || '',
          paymentCounterCode: paymentCounters?.find(counter => counter.id === item.paymentCounterId)?.code || '',
          kotCounterCode: kotCounters?.find(counter => counter.id === item.kotCounterId)?.code || '',
          imageUrl: '' // Keep image blank as requested
        }))
      };

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<menu>
  <categories>
    ${exportData.categories.map(cat => `
    <category>
      <name>${cat.name}</name>
      <createdAt>${cat.createdAt}</createdAt>
    </category>`).join('')}
  </categories>
  <counters>
    ${exportData.counters.map(counter => `
    <counter>
      <name>${counter.name}</name>
      <code>${counter.code}</code>
      <type>${counter.type}</type>
    </counter>`).join('')}
  </counters>
  <menuItems>
    ${exportData.menuItems.map(item => `
    <menuItem>
      <name>${item.name}</name>
      <price>${item.price}</price>
      <categoryName>${item.categoryName}</categoryName>
      <available>${item.available}</available>
      <stock>${item.stock}</stock>
      <description>${item.description}</description>
      <addOns>${item.addOns}</addOns>
      <isVegetarian>${item.isVegetarian}</isVegetarian>
      <isMarkable>${item.isMarkable}</isMarkable>
      <isQuickPick>${item.isQuickPick}</isQuickPick>
      <isTrending>${item.isTrending}</isTrending>
      <storeCounterCode>${item.storeCounterCode}</storeCounterCode>
      <paymentCounterCode>${item.paymentCounterCode}</paymentCounterCode>
      <kotCounterCode>${item.kotCounterCode || ''}</kotCounterCode>
      <imageUrl>${item.imageUrl}</imageUrl>
    </menuItem>`).join('')}
  </menuItems>
</menu>`;

      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu-export-${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export menu. Please try again.');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      alert('Please select a valid XML file.');
      // Reset file input
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target?.result as string;
        parseAndImportXML(xmlContent);
      } catch (error) {
        console.error('File read error:', error);
        alert('Failed to read file. Please try again.');
      }
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const parseAndImportXML = (xmlContent: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        throw new Error('Invalid XML format');
      }

      const categories = xmlDoc.getElementsByTagName('category');
      const counters = xmlDoc.getElementsByTagName('counter');
      const menuItems = xmlDoc.getElementsByTagName('menuItem');

      if (!canteenId) {
        alert('Canteen ID is required for import.');
        return;
      }

      setIsImporting(true);
      importCategoriesCountersAndMenuItems(categories, counters, menuItems);
    } catch (error) {
      console.error('XML parsing error:', error);
      alert('Failed to parse XML file. Please check the file format.');
      setIsImporting(false);
    }
  };

  const importCategoriesCountersAndMenuItems = async (
    categories: HTMLCollectionOf<Element>, 
    counters: HTMLCollectionOf<Element>, 
    menuItems: HTMLCollectionOf<Element>
  ) => {
    try {
      const categoryMap = new Map<string, string>();
      const counterMap = new Map<string, string>();
      const importStats = {
        categoriesCreated: 0,
        categoriesSkipped: 0,
        countersCreated: 0,
        countersSkipped: 0,
        menuItemsCreated: 0,
        menuItemsSkipped: 0
      };
      
      // Get all existing categories for this canteen
      const existingCategoriesResponse = await apiRequest(`/api/categories?canteenId=${canteenId}&limit=1000`);
      const existingCategories = existingCategoriesResponse.items || [];
      
      // First, import categories (create if they don't exist)
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const name = category.getElementsByTagName('name')[0]?.textContent;
        
        if (name) {
          try {
            // Check if category already exists by exact name match
            const existingCategory = existingCategories.find((cat: any) => 
              cat.name.toLowerCase().trim() === name.toLowerCase().trim()
            );
            
            if (!existingCategory) {
              // Create new category if it doesn't exist
              const response = await apiRequest('/api/categories', {
                method: 'POST',
                body: JSON.stringify({ name, canteenId }),
                headers: { 'Content-Type': 'application/json' }
              });
              categoryMap.set(name, response.id);
              importStats.categoriesCreated++;
            } else {
              categoryMap.set(name, existingCategory.id);
              importStats.categoriesSkipped++;
            }
          } catch (error) {
            // Failed to create/find category - skip
          }
        }
      }

      // Get all existing counters for this canteen
      const existingCountersResponse = await apiRequest(`/api/counters?canteenId=${canteenId}`);
      const existingCounters = existingCountersResponse || [];
      
      // Second, import counters (create if they don't exist)
      for (let i = 0; i < counters.length; i++) {
        const counter = counters[i];
        const name = counter.getElementsByTagName('name')[0]?.textContent;
        const code = counter.getElementsByTagName('code')[0]?.textContent;
        const type = counter.getElementsByTagName('type')[0]?.textContent;
        
        if (name && code && type && ['payment', 'store', 'kot'].includes(type)) {
          try {
            // Check if counter already exists by code and type
            const existingCounter = existingCounters.find((cnt: any) => 
              cnt.code.toUpperCase() === code.toUpperCase() && cnt.type === type
            );
            
            if (!existingCounter) {
              // Create new counter if it doesn't exist
              const response = await apiRequest('/api/counters', {
                method: 'POST',
                body: JSON.stringify({ name, code, canteenId, type }),
                headers: { 'Content-Type': 'application/json' }
              });
              counterMap.set(`${code}_${type}`, response.id);
              importStats.countersCreated++;
            } else {
              counterMap.set(`${code}_${type}`, existingCounter.id);
              importStats.countersSkipped++;
            }
          } catch (error) {
            // Failed to create/find counter - skip
          }
        }
      }

      // Get all existing menu items for this canteen
      const existingMenuItemsResponse = await apiRequest(`/api/menu?canteenId=${canteenId}&limit=1000`);
      const existingMenuItems = existingMenuItemsResponse.items || [];
      
      // Third, import menu items (create if they don't exist)
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const name = item.getElementsByTagName('name')[0]?.textContent;
        const price = parseFloat(item.getElementsByTagName('price')[0]?.textContent || '0');
        const categoryName = item.getElementsByTagName('categoryName')[0]?.textContent;
        const available = item.getElementsByTagName('available')[0]?.textContent === 'true';
        const stock = parseInt(item.getElementsByTagName('stock')[0]?.textContent || '0');
        const description = item.getElementsByTagName('description')[0]?.textContent || '';
        const addOns = item.getElementsByTagName('addOns')[0]?.textContent || '[]';
        const isVegetarian = item.getElementsByTagName('isVegetarian')[0]?.textContent === 'true';
        const isMarkable = item.getElementsByTagName('isMarkable')[0]?.textContent === 'true';
        const isQuickPick = item.getElementsByTagName('isQuickPick')[0]?.textContent === 'true';
        const isTrending = item.getElementsByTagName('isTrending')[0]?.textContent === 'true';
        const storeCounterCode = item.getElementsByTagName('storeCounterCode')[0]?.textContent || '';
        const paymentCounterCode = item.getElementsByTagName('paymentCounterCode')[0]?.textContent || '';
        const kotCounterCode = item.getElementsByTagName('kotCounterCode')[0]?.textContent || '';
        const imageUrl = item.getElementsByTagName('imageUrl')[0]?.textContent || '';

        if (name && price > 0 && categoryName) {
          // Check if menu item already exists by name and category
          const categoryId = categoryMap.get(categoryName);
          const existingMenuItem = existingMenuItems.find((menuItem: any) => 
            menuItem.name.toLowerCase().trim() === name.toLowerCase().trim() && 
            menuItem.categoryId === categoryId
          );
          
          if (!existingMenuItem && categoryId) {
            // Validate that both store and payment counters are provided
            if (!storeCounterCode || !paymentCounterCode) {
              continue; // Skip this menu item
            }
            
            const storeCounterId = counterMap.get(`${storeCounterCode}_store`);
            const paymentCounterId = counterMap.get(`${paymentCounterCode}_payment`);
            const kotCounterId = kotCounterCode ? counterMap.get(`${kotCounterCode}_kot`) : null;
            
            // Validate that the counter IDs were found
            if (!storeCounterId) {
              continue; // Skip this menu item
            }
            
            if (!paymentCounterId) {
              continue; // Skip this menu item
            }
            
            try {
              await apiRequest('/api/menu', {
                method: 'POST',
                body: JSON.stringify({
                  name,
                  price,
                  categoryId,
                  canteenId,
                  available,
                  stock,
                  description,
                  addOns,
                  isVegetarian,
                  isMarkable,
                  isQuickPick: isQuickPick || false,
                  isTrending,
                  storeCounterId, // Now mandatory
                  paymentCounterId, // Now mandatory
                  kotCounterId: kotCounterId || undefined, // Optional KOT counter
                  imageUrl: imageUrl || undefined // Only include if not empty
                }),
                headers: { 'Content-Type': 'application/json' }
              });
              importStats.menuItemsCreated++;
            } catch (error) {
              // Failed to create menu item - skip
            }
          } else if (existingMenuItem) {
            importStats.menuItemsSkipped++;
          } else {
            // Category not found - skip
          }
        }
      }

      // Show user-friendly summary
      const totalCreated = importStats.categoriesCreated + importStats.countersCreated + importStats.menuItemsCreated;
      const totalSkipped = importStats.categoriesSkipped + importStats.countersSkipped + importStats.menuItemsSkipped;
      
      if (totalCreated > 0) {
        alert(`Import completed successfully!\n\nCreated: ${totalCreated} items\nSkipped (duplicates): ${totalSkipped} items`);
      } else if (totalSkipped > 0) {
        alert(`Import completed - all items already exist!\n\nSkipped (duplicates): ${totalSkipped} items\n\nNo new items were created.`);
      } else {
        alert('Import completed - no valid items found to import.');
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/categories', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      queryClient.invalidateQueries({ queryKey: ['/api/counters', canteenId] });
      refetchMenuItems();

    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setPendingImageFile(null); // Clear any pending file when editing
    
    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToSet = typeof item.categoryId === 'string' 
      ? item.categoryId 
      : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);
    
    
    // Setting edit form categoryId
    
    setEditForm({
      name: item.name,
      price: item.price.toString(),
      categoryId: categoryIdToSet,
      description: item.description || "",
      stock: item.stock?.toString() || "",
      available: item.available,
      isVegetarian: item.isVegetarian,
      isMarkable: item.isMarkable,
      addOns: JSON.stringify(item.addOns || []),
      imageUrl: item.imageUrl || "",
      imagePublicId: item.imagePublicId || "",
      storeCounterId: item.storeCounterId || "",
      paymentCounterId: item.paymentCounterId || ""
    });
    setAddOns(Array.isArray(item.addOns) ? item.addOns : []);
  };

  const handleSaveItem = async () => {
    if (!editForm.name || !editForm.price || !editForm.categoryId) {
      return;
    }

    // Extract the item ID properly (handle both id and _id formats)
    const itemId = editingItem?.id || (editingItem as any)?._id;
    
    console.log('🔍 ADMIN DEBUG: editingItem:', editingItem);
    console.log('🔍 ADMIN DEBUG: itemId:', itemId);
    console.log('📸 ADMIN Pending Image File:', pendingImageFile ? {
      name: pendingImageFile.name,
      size: pendingImageFile.size,
      type: pendingImageFile.type
    } : 'None');
    
    // Build item data, excluding the base64 preview imageUrl (which can be very large)
    // We only send imagePublicId if it exists (from a previously uploaded image)
    // New images are uploaded separately via the image upload endpoint
    const itemData: any = {
      name: editForm.name,
      price: parseFloat(editForm.price),
      description: editForm.description,
      stock: editForm.stock ? parseInt(editForm.stock) : null,
      available: editForm.available,
      isVegetarian: editForm.isVegetarian,
      isMarkable: editForm.isMarkable,
      addOns: JSON.stringify(addOns), // Convert array to string for server
      categoryId: typeof editForm.categoryId === 'string' 
        ? editForm.categoryId 
        : (editForm.categoryId as any)?._id || (editForm.categoryId as any)?.id || String(editForm.categoryId),
      storeCounterId: editForm.storeCounterId || undefined,
      paymentCounterId: editForm.paymentCounterId || undefined,
      ...(editingItem && itemId && { id: itemId }) // Only include id when editing and ID exists
    };
    
    // Only include imagePublicId if it exists (from a previously uploaded image)
    // Don't include imageUrl as it's a base64 preview that can be very large
    if (editForm.imagePublicId && !pendingImageFile) {
      // If there's an existing image and no new file pending, keep the existing image
      itemData.imagePublicId = editForm.imagePublicId;
      // Only include imageUrl if it's a Cloudinary URL (starts with http), not a base64 data URL
      if (editForm.imageUrl && editForm.imageUrl.startsWith('http')) {
        itemData.imageUrl = editForm.imageUrl;
      }
    }

    try {
      if (editingItem) {
        if (!itemId) {
          console.error('No ID found for menu item:', editingItem);
          alert('Error: Menu item ID not found. Please try again.');
          return;
        }
        
        // First update the menu item
        await updateMenuItemMutation.mutateAsync(itemData);
        console.log('✅ ADMIN: Menu item updated successfully');
        
        // Then handle image upload if there's a pending file
        if (pendingImageFile) {
          console.log('📸 ADMIN: Uploading pending image after saving menu item', {
            itemId,
            fileName: pendingImageFile.name,
            fileSize: pendingImageFile.size,
            fileType: pendingImageFile.type
          });
          try {
            await uploadImageMutation.mutateAsync({ id: itemId, file: pendingImageFile });
            setPendingImageFile(null);
            console.log('✅ ADMIN: Image uploaded successfully after saving');
          } catch (uploadError: any) {
            console.error('❌ ADMIN: Failed to upload image after saving:', uploadError);
            const errorMessage = uploadError?.message || 'Failed to upload image. The menu item was saved but the image was not uploaded.';
            alert(`Warning: ${errorMessage}\n\nYou can try uploading the image again by editing this menu item.`);
            // Don't clear pendingImageFile so user can try again
          }
        }
      } else {
        // Adding new item
        const createdItem = await addMenuItemMutation.mutateAsync(itemData);
        console.log('✅ ADMIN: Menu item created successfully', createdItem);
        
        // If there's a pending image file, upload it now
        if (pendingImageFile && createdItem?.id) {
          console.log('📸 ADMIN: Uploading pending image for new menu item:', {
            itemId: createdItem.id,
            fileName: pendingImageFile.name,
            fileSize: pendingImageFile.size,
            fileType: pendingImageFile.type
          });
          try {
            await uploadImageMutation.mutateAsync({ id: createdItem.id, file: pendingImageFile });
            setPendingImageFile(null);
            console.log('✅ ADMIN: Image uploaded successfully for new menu item');
          } catch (uploadError: any) {
            console.error('❌ ADMIN: Failed to upload image after creating menu item:', uploadError);
            const errorMessage = uploadError?.message || 'Failed to upload image. The menu item was created but the image was not uploaded.';
            alert(`Warning: ${errorMessage}\n\nYou can try uploading the image again by editing this menu item.`);
          }
        }
      }
    } catch (error: any) {
      console.error("❌ ADMIN: Error saving menu item:", error);
      const errorMessage = error?.message || 'Failed to save menu item. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm("Are you sure you want to delete this menu item?")) {
      deleteMenuItemMutation.mutate(id);
    }
  };


  const handleDeleteCategory = (id: string) => {
    if (window.confirm("Are you sure you want to delete this category? This will also delete all menu items in this category.")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryForm({
      name: category.name,
      icon: category.icon || "",
      imageUrl: category.imageUrl || "",
      imagePublicId: category.imagePublicId || ""
    });
    setPendingCategoryImageFile(null);
  };

  const handleCategoryImageUpload = async (file: File) => {
    setPendingCategoryImageFile(file);
    const imageUrl = URL.createObjectURL(file);
    setEditCategoryForm(prev => ({ ...prev, imageUrl }));
  };

  const handleCategoryImageRemove = async () => {
    setPendingCategoryImageFile(null);
    setEditCategoryForm(prev => ({ ...prev, imageUrl: "", imagePublicId: "" }));
  };

  const handleNewCategoryImageUpload = async (file: File) => {
    setPendingNewCategoryImageFile(file);
    const imageUrl = URL.createObjectURL(file);
    setNewCategoryImageUrl(imageUrl);
  };

  const handleNewCategoryImageRemove = async () => {
    setNewCategoryImageUrl("");
    setNewCategoryImagePublicId("");
    setPendingNewCategoryImageFile(null);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      return;
    }

    try {
      let finalImageUrl = newCategoryImageUrl;
      let finalImagePublicId = newCategoryImagePublicId;

      // Adding new category

      // First, create the category
      const categoryData = {
        name: newCategoryName.trim(),
        canteenId: canteenId,
        icon: newCategoryIcon || undefined,
        imageUrl: finalImageUrl || undefined,
        imagePublicId: finalImagePublicId || undefined
      };

      const newCategory = await addCategoryMutation.mutateAsync(categoryData);
      // Category created successfully

      // Then upload image if there's a pending file
      if (pendingNewCategoryImageFile && newCategory?.id) {
        // Uploading category image
        await uploadNewCategoryImageMutation.mutateAsync({
          categoryId: newCategory.id,
          image: pendingNewCategoryImageFile
        });
        // Image upload completed
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !editCategoryForm.name.trim()) {
      return;
    }

    try {
      let finalImageUrl = editCategoryForm.imageUrl;
      let finalImagePublicId = editCategoryForm.imagePublicId;

      // Saving category

      // First, upload image if there's a pending file
      if (pendingCategoryImageFile) {
        // Uploading category image
        const uploadResult = await uploadCategoryImageMutation.mutateAsync({
          categoryId: editingCategory.id,
          image: pendingCategoryImageFile
        });
        // Image upload result
        // Use the uploaded image data
        finalImageUrl = uploadResult.imageUrl;
        finalImagePublicId = uploadResult.imagePublicId;
      }

      // Updating category

      // Then update the category with the final image data
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        name: editCategoryForm.name.trim(),
        icon: editCategoryForm.icon,
        imageUrl: finalImageUrl,
        imagePublicId: finalImagePublicId
      });
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const addAddOn = () => {
    setAddOns([...addOns, { name: "", price: "" }]);
  };

  const removeAddOn = (index: number) => {
    setAddOns(addOns.filter((_, i) => i !== index));
  };

  const updateAddOn = (index: number, field: 'name' | 'price', value: string) => {
    const updated = [...addOns];
    updated[index][field] = value;
    setAddOns(updated);
  };

  if (menuLoading || categoriesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading menu items...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Menu Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage menu items, categories, and pricing for this canteen
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Import/Export Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={exportToXML}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export XML</span>
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xml"
                onChange={handleFileImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isImporting}
              />
              <Button 
                variant="outline"
                disabled={isImporting}
                className="flex items-center space-x-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Import XML</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setIsAddingItem(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsAddingCategory(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </Button>
        </div>
      </div>

      {/* Menu Analytics */}
      <MenuAnalytics canteenId={canteenId} />

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Items</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category, index) => (
                    <SelectItem key={category.id || `category-${index}`} value={category.name}>
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={category} />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stock">Stock Status</Label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Charges Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Checkout Charges</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="charge-name">Name</Label>
              <Input
                id="charge-name"
                value={chargeForm.name}
                onChange={(e) => setChargeForm({ ...chargeForm, name: e.target.value })}
                placeholder="e.g., Packaging Fee"
              />
            </div>
            <div>
              <Label htmlFor="charge-type">Type</Label>
              <Select
                value={chargeForm.type}
                onValueChange={(value) => setChargeForm({ ...chargeForm, type: value })}
              >
                <SelectTrigger id="charge-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="charge-value">Value</Label>
              <Input
                id="charge-value"
                type="number"
                min="0"
                value={chargeForm.value}
                onChange={(e) => setChargeForm({ ...chargeForm, value: e.target.value })}
                placeholder={chargeForm.type === 'percent' ? 'e.g., 5 for 5%' : 'e.g., 10 for ₹10'}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={
                !chargeForm.name ||
                chargeForm.value === "" ||
                createChargeMutation.isPending
              }
              onClick={() => {
                const valueNumber = parseFloat(chargeForm.value);
                if (isNaN(valueNumber)) return;
                createChargeMutation.mutate({
                  name: chargeForm.name.trim(),
                  type: chargeForm.type as 'percent' | 'fixed',
                  value: valueNumber
                });
              }}
            >
              {createChargeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Charge
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {chargesLoading && <p className="text-sm text-muted-foreground">Loading charges...</p>}
            {!chargesLoading && (!chargesData?.items || chargesData.items.length === 0) && (
              <p className="text-sm text-muted-foreground">No charges configured.</p>
            )}
            {chargesData?.items?.map((charge) => (
              <div
                key={charge.id}
                className="flex items-center justify-between border border-border rounded-lg px-3 py-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={charge.active ? "secondary" : "outline"}>
                      {charge.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="font-medium">{charge.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {charge.type === 'percent' ? `${charge.value}%` : `₹${charge.value.toFixed(2)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={charge.active}
                    onCheckedChange={(checked) => {
                      updateChargeMutation.mutate({ id: charge.id, active: checked });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteChargeMutation.mutate(charge.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item, index) => (
          <Card key={item.id || `item-${index}`} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <VegIndicator isVegetarian={item.isVegetarian} />
                  <span>{item.name}</span>
                </CardTitle>
                <Badge variant={item.available ? "default" : "secondary"}>
                  {item.available ? "Available" : "Unavailable"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {item.imageUrl && (
                  <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <span className="text-sm font-medium">
                    {(() => {
                      // Check if categoryId is populated (object) or just an ID (string)
                      if (typeof item.categoryId === 'object' && (item.categoryId as any)?.name) {
                        // Category is populated, use the name directly
                        return (item.categoryId as any).name;
                      } else {
                        // Category is not populated, try to find it in categories array
                        const categoryIdToFind = typeof item.categoryId === 'string' 
                          ? item.categoryId 
                          : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);
                        
                        const category = categories.find(cat => cat.id === categoryIdToFind);
                        return category?.name || 'Unknown';
                      }
                    })()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <span className="text-lg font-bold text-primary">₹{item.price}</span>
                </div>
                
                {item.stock !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Stock:</span>
                    <span className={`text-sm font-medium ${
                      item.stock === 0 ? 'text-red-600' : 
                      item.stock < 10 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {item.stock} {item.stock === 0 ? '(Out of Stock)' : item.stock < 10 ? '(Low Stock)' : ''}
                    </span>
                  </div>
                )}
                
                {item.description && (
                  <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                )}
                
                <div className="flex space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEditItem(item)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={deleteMenuItemMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Menu Items Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} items
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={!pagination.hasPrevPage}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={!pagination.hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Category Management Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Categories</span>
            <span className="text-sm text-muted-foreground">
              {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {categories.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No categories found. Add your first category to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category, index) => {
                // Use all menu items for counting, not filtered items
                const menuItemsInCategory = menuItems.filter(item => {
                  // Handle both populated and non-populated categoryId
                  if (typeof item.categoryId === 'object' && (item.categoryId as any)?.name) {
                    // Category is populated, compare by name
                    return (item.categoryId as any).name === category.name;
                  } else {
                    // Category is not populated, compare by ID
                    const itemCategoryId = typeof item.categoryId === 'string' 
                      ? item.categoryId 
                      : (item.categoryId as any)?._id || (item.categoryId as any)?.id;
                    return itemCategoryId === category.id;
                  }
                });
                const isDeleting = deletingCategory === category.id;
                
                return (
                  <div key={category.id || `category-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <CategoryIcon category={category} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{category.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {menuItemsInCategory.length} item{menuItemsInCategory.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={isDeleting || deleteCategoryMutation.isPending}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredItems.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No menu items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedCategory !== "all" || stockFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Get started by adding your first menu item"}
            </p>
            <Button onClick={() => setIsAddingItem(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={isAddingItem || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsAddingItem(false);
          setEditingItem(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the menu item details' : 'Add a new item to the menu'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  placeholder="Enter price"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({ ...editForm, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    ) : (
                      categories.map((category, index) => {
                        const categoryId = category.id || (category as any)._id || `category-${index}`;
                        return (
                          <SelectItem key={categoryId} value={categoryId}>
                            <div className="flex items-center gap-2">
                              <CategoryIcon category={category} />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stock">Stock (Optional)</Label>
                <Input
                  id="stock"
                  type="number"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                  placeholder="Enter stock quantity"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter item description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.available}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, available: checked })}
                />
                <Label>Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.isVegetarian}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isVegetarian: checked })}
                />
                <Label>Vegetarian</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.isMarkable}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isMarkable: checked })}
                />
                <Label>Markable</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="storeCounter">Store Counter (Optional)</Label>
                <Select 
                  value={editForm.storeCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, storeCounterId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store counter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Store Counter</SelectItem>
                    {storeCounters.map((counter) => (
                      <SelectItem key={counter.id} value={counter.id}>
                        {counter.name} ({counter.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Orders with this item will be assigned to the selected store counter
                </p>
              </div>
              <div>
                <Label htmlFor="paymentCounter">Payment Counter (Optional)</Label>
                <Select 
                  value={editForm.paymentCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, paymentCounterId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment counter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Payment Counter</SelectItem>
                    {paymentCounters.map((counter) => (
                      <SelectItem key={counter.id} value={counter.id}>
                        {counter.name} ({counter.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Orders with this item will be assigned to the selected payment counter
                </p>
              </div>
            </div>

            {/* KOT Counter Selection (Optional) */}
            {kotCounters.length > 0 && (
              <div>
                <Label htmlFor="kotCounter">KOT Counter (Optional)</Label>
                <Select 
                  value={editForm.kotCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, kotCounterId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select KOT counter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No KOT Counter</SelectItem>
                    {kotCounters.map((counter) => (
                      <SelectItem key={counter.id} value={counter.id}>
                        {counter.name} ({counter.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Assign this item to a KOT counter for kitchen order tracking
                </p>
              </div>
            )}

            <div>
              <Label>Image</Label>
              <ImageUpload
                onImageUpload={async (file) => {
                  console.log('📸 ADMIN: Image selected', {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    isFileValid: file instanceof File
                  });
                  
                  // Validate file
                  if (!(file instanceof File)) {
                    console.error('❌ ADMIN: Invalid file object:', file);
                    alert('Error: Invalid file selected. Please try again.');
                    return;
                  }
                  
                  // Store the file for later upload when saving
                  setPendingImageFile(file);
                  console.log('✅ ADMIN: File stored in pendingImageFile state');
                  
                  // Create preview
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const previewUrl = e.target?.result as string;
                    setEditForm(prev => ({
                      ...prev,
                      imageUrl: previewUrl
                    }));
                    console.log('✅ ADMIN: Preview created for image');
                  };
                  reader.onerror = () => {
                    console.error('❌ ADMIN: Error reading file for preview');
                    alert('Error: Failed to read image file. Please try again.');
                  };
                  reader.readAsDataURL(file);
                }}
                onImageRemove={async () => {
                  console.log('📸 ADMIN: Image removal requested');
                  setPendingImageFile(null);
                  setEditForm(prev => ({ ...prev, imageUrl: "", imagePublicId: "" }));
                  
                  // If editing an existing item with an image, remove it from server
                  if (editingItem && editingItem.id && editingItem.imagePublicId) {
                    try {
                      await removeImageMutation.mutateAsync(editingItem.id);
                      console.log('✅ ADMIN: Image removed from server');
                    } catch (error) {
                      console.error('❌ ADMIN: Failed to remove image from server:', error);
                      // Don't show error to user, just log it
                    }
                  }
                }}
                onImageChange={(url) => {
                  setEditForm(prev => ({ ...prev, imageUrl: url }));
                }}
                currentImageUrl={editForm.imageUrl}
                disabled={uploadImageMutation.isPending || removeImageMutation.isPending}
                maxSizeKB={100}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddingItem(false);
                  setEditingItem(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveItem}
                disabled={updateMenuItemMutation.isPending || addMenuItemMutation.isPending || uploadImageMutation.isPending}
              >
                {uploadImageMutation.isPending || updateMenuItemMutation.isPending || addMenuItemMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadImageMutation.isPending ? 'Uploading Image...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for menu items with optional icon and image.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-category-name">Category Name *</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
            
            <div>
              <Label htmlFor="new-category-icon">Icon (Optional)</Label>
              <Input
                id="new-category-icon"
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="e.g., 🍕, 🍔, 🥗"
              />
            </div>
            
            <div>
              <Label>Category Image (Optional)</Label>
              <ImageUpload
                currentImageUrl={newCategoryImageUrl}
                onImageUpload={handleNewCategoryImageUpload}
                onImageRemove={handleNewCategoryImageRemove}
                disabled={uploadNewCategoryImageMutation.isPending}
                maxSizeKB={50}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategoryName("");
                  setNewCategoryIcon("");
                  setNewCategoryImageUrl("");
                  setNewCategoryImagePublicId("");
                  setPendingNewCategoryImageFile(null);
                }}
                disabled={addCategoryMutation.isPending || uploadNewCategoryImageMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || addCategoryMutation.isPending || uploadNewCategoryImageMutation.isPending}
              >
                {addCategoryMutation.isPending || uploadNewCategoryImageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name, icon, and image.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-category-name">Category Name</Label>
              <Input
                id="edit-category-name"
                value={editCategoryForm.name}
                onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                placeholder="Enter category name"
              />
            </div>
            <div>
              <Label htmlFor="edit-category-icon">Icon (Optional)</Label>
              <Input
                id="edit-category-icon"
                value={editCategoryForm.icon}
                onChange={(e) => setEditCategoryForm({ ...editCategoryForm, icon: e.target.value })}
                placeholder="e.g., 🍕, 🍔, 🥗"
              />
            </div>
            <div>
              <Label>Category Image (Optional)</Label>
              <ImageUpload
                currentImageUrl={editCategoryForm.imageUrl}
                onImageUpload={handleCategoryImageUpload}
                onImageRemove={handleCategoryImageRemove}
                disabled={uploadCategoryImageMutation.isPending}
                maxSizeKB={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingCategory(null)}
              disabled={updateCategoryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={updateCategoryMutation.isPending || uploadCategoryImageMutation.isPending}
            >
              {updateCategoryMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




