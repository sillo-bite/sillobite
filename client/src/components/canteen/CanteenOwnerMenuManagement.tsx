import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerButton } from "@/components/owner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useTriggerBasedUpdates } from "@/hooks/useTriggerBasedUpdates";
import { VegIndicator } from "@/components/ui/VegIndicator";
import ImageUpload from "@/components/ui/ImageUpload";
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
  EyeOff,
  RefreshCcw
} from "lucide-react";

interface CanteenOwnerMenuManagementProps {
  menuItems: MenuItem[];
  categories: Category[];
  onMenuUpdate: () => void;
  canteenId?: string;
}

export default function CanteenOwnerMenuManagement({ 
  menuItems, 
  categories, 
  onMenuUpdate,
  canteenId
}: CanteenOwnerMenuManagementProps) {
  const { triggerMenuRefresh } = useTriggerBasedUpdates();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all"); // all, low_stock, out_of_stock
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    categoryId: "",
    description: "",
    stock: "",
    available: true,
    isVegetarian: true,
    isMarkable: true,
    isQuickPick: false,
    addOns: "[]",
    imageUrl: "",
    imagePublicId: "",
    storeCounterId: "",
    paymentCounterId: "",
    kotCounterId: ""
  });
  
  // Store the pending image file for new items
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [addOns, setAddOns] = useState<Array<{ name: string; price: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Fetch counters for the canteen
  const { data: countersData, isLoading: countersLoading, error: countersError } = useQuery<{
    items: Array<{ id: string; name: string; code: string; type: 'payment' | 'store' | 'kot' }>;
  }>({
    queryKey: ['/api/counters', canteenId],
    queryFn: async () => {
      const params = new URLSearchParams({ canteenId: canteenId || '' });
      const result = await apiRequest(`/api/counters?${params.toString()}`);
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
  
  // Enhanced mutations with comprehensive synchronization
  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MenuItem> }) => {
      return apiRequest(`/api/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      // Only invalidate the specific canteen query to avoid cascade
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      onMenuUpdate();
    },
    onError: () => {
      // Error handled by React Query
      }
  });

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
      // Only invalidate the specific canteen query to avoid cascade
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      resetForm();
      setIsAddingItem(false);
      onMenuUpdate();
    },
    onError: () => {
      // Error handled by React Query
      }
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/menu/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Only invalidate the specific canteen query to avoid cascade
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      onMenuUpdate();
    },
    onError: () => {
      // Error handled by React Query
      }
  });


  const updateStockMutation = useMutation({
    mutationFn: async ({ id, newStock }: { id: string; newStock: number }) => {
      return apiRequest(`/api/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ stock: newStock }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      // Only invalidate the specific canteen query to avoid cascade
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      onMenuUpdate();
    },
    onError: () => {
      // Error handled by React Query
      }
  });

  // Toggle availability directly from card
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      return apiRequest(`/api/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ available }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId, 'owner-all-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      onMenuUpdate();
    },
    onError: () => {
      // Error handled by React Query
      }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      if (!(file instanceof File)) {
        throw new Error('Invalid file object');
      }
      
      if (!id) {
        throw new Error('Menu item ID is required');
      }
      
      const formData = new FormData();
      formData.append('image', file);
      
      // Use direct fetch instead of apiRequest to avoid JSON header issues
      const url = `/api/menu/${id}/image`;
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData
        // Don't set Content-Type - let browser set it with boundary
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Upload failed' };
        }
        
        throw new Error(errorData.message || `Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      return responseData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      onMenuUpdate();
      
      // Update form state with new image data
      setEditForm(prev => ({
        ...prev,
        imageUrl: data.imageUrl,
        imagePublicId: data.publicId
      }));
    },
    onError: () => {
      // Error handled by React Query
    }
  });

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
      onMenuUpdate();
      
      // Update form state to remove image data
      setEditForm(prev => ({
        ...prev,
        imageUrl: "",
        imagePublicId: ""
      }));
    },
    onError: () => {
      // Error handled by React Query
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
      isQuickPick: false,
      addOns: "[]",
      imageUrl: "",
      imagePublicId: "",
      storeCounterId: "",
      paymentCounterId: ""
    });
    setAddOns([]);
    setPendingImageFile(null);
  };

  // Image upload handlers - for edit dialog, store file locally
  const handleImageUpload = async (file: File) => {
    // Validate file
    if (!(file instanceof File)) {
      alert('Error: Invalid file selected. Please try again.');
      return;
    }
    
    // Store the file for later upload when saving
    setPendingImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setEditForm(prev => ({
        ...prev,
        imageUrl: previewUrl
      }));
    };
    reader.onerror = () => {
      alert('Error: Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = async () => {
    // Clear the pending file
    setPendingImageFile(null);
    
    // Clear the form image URL
    setEditForm(prev => ({
      ...prev,
      imageUrl: "",
      imagePublicId: ""
    }));
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
          categoryName: categories.find(cat => cat.id === item.categoryId)?.name || '',
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
      onMenuUpdate();

      } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
      } finally {
      setIsImporting(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setPendingImageFile(null); // Clear any pending file when editing
    
    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToSet = typeof item.categoryId === 'string' 
      ? item.categoryId 
      : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);
    
    const formData = {
      name: item.name || "",
      price: item.price?.toString() || "",
      categoryId: categoryIdToSet,
      description: item.description || "",
      stock: item.stock?.toString() || "",
      available: item.available ?? true,
      isVegetarian: item.isVegetarian ?? true,
      isMarkable: item.isMarkable ?? true,
      isQuickPick: item.isQuickPick ?? false,
      addOns: item.addOns || "[]",
      imageUrl: item.imageUrl || "",
      imagePublicId: item.imagePublicId || "",
      storeCounterId: item.storeCounterId || "",
      paymentCounterId: item.paymentCounterId || "",
      kotCounterId: item.kotCounterId || ""
    };
    
    setEditForm(formData);
    
    try {
      const parsedAddOns = JSON.parse(item.addOns || "[]");
      if (Array.isArray(parsedAddOns)) {
        setAddOns(parsedAddOns);
      }
    } catch {
      setAddOns([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editForm.name || !editForm.price || !editForm.categoryId) {
      return;
    }
    
    // Validate mandatory counter assignments
    if (!editForm.storeCounterId || !editForm.paymentCounterId) {
      alert('Please select both Store Counter and Payment Counter for this menu item. Counter assignment is mandatory.');
      return;
    }
    
    // Extract the ID properly (handle both id and _id fields)
    const itemId = editingItem.id || (editingItem as any)._id;
    
    if (!itemId) {
      alert('Error: Menu item ID not found. Please try again.');
      return;
    }
    
    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToUse = typeof editForm.categoryId === 'string' 
      ? editForm.categoryId 
      : (editForm.categoryId as any)?._id || (editForm.categoryId as any)?.id || String(editForm.categoryId);
    
    // Build update data, excluding the base64 preview imageUrl (which can be very large)
    // We only send imagePublicId if it exists (from a previously uploaded image)
    // New images are uploaded separately via the image upload endpoint
    const updatedData: any = {
      name: editForm.name,
      price: parseInt(editForm.price),
      categoryId: categoryIdToUse,
      description: editForm.description,
      stock: parseInt(editForm.stock),
      available: editForm.available,
      isVegetarian: editForm.isVegetarian,
      isMarkable: editForm.isMarkable,
      addOns: JSON.stringify(addOns.filter(addon => addon.name && addon.price)),
      storeCounterId: editForm.storeCounterId, // Now mandatory
      paymentCounterId: editForm.paymentCounterId, // Now mandatory
      kotCounterId: editForm.kotCounterId || undefined // Optional KOT counter
    };
    
    // Only include imagePublicId if it exists (from a previously uploaded image)
    // Don't include imageUrl as it's a base64 preview that can be very large
    if (editForm.imagePublicId && !pendingImageFile) {
      // If there's an existing image and no new file pending, keep the existing image
      updatedData.imagePublicId = editForm.imagePublicId;
      // Only include imageUrl if it's a Cloudinary URL (starts with http), not a base64 data URL
      if (editForm.imageUrl && editForm.imageUrl.startsWith('http')) {
        updatedData.imageUrl = editForm.imageUrl;
      }
    }
    
    try {
      // First update the menu item
      await updateMenuItemMutation.mutateAsync({ id: itemId, data: updatedData });
      
      // Then handle image upload if there's a pending file
      if (pendingImageFile) {
        try {
          await uploadImageMutation.mutateAsync({ id: itemId, file: pendingImageFile });
          setPendingImageFile(null);
        } catch (uploadError: any) {
          const errorMessage = uploadError?.message || 'Failed to upload image. The menu item was saved but the image was not uploaded.';
          alert(`Warning: ${errorMessage}\n\nYou can try uploading the image again by editing this menu item.`);
          // Don't clear pendingImageFile so user can try again
        }
      }
      
      setEditingItem(null);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update menu item. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleAdd = async () => {
    if (!editForm.name || !editForm.price || !editForm.categoryId) {
      return;
    }
    
    // Validate mandatory counter assignments
    if (!editForm.storeCounterId || !editForm.paymentCounterId) {
      alert('Please select both Store Counter and Payment Counter for this menu item. Counter assignment is mandatory.');
      return;
    }
    
    if (!canteenId) {
      return;
    }
    
    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToUse = typeof editForm.categoryId === 'string' 
      ? editForm.categoryId 
      : (editForm.categoryId as any)?._id || (editForm.categoryId as any)?.id || String(editForm.categoryId);
    
    // Build new item data, excluding the base64 preview imageUrl (which can be very large)
    // New images are uploaded separately via the image upload endpoint after item creation
    const newItemData: any = {
      name: editForm.name,
      price: parseInt(editForm.price),
      categoryId: categoryIdToUse,
      description: editForm.description,
      stock: parseInt(editForm.stock) || 0,
      available: editForm.available,
      isVegetarian: editForm.isVegetarian,
      isMarkable: editForm.isMarkable,
      addOns: JSON.stringify(addOns.filter(addon => addon.name && addon.price)),
      storeCounterId: editForm.storeCounterId, // Now mandatory
      paymentCounterId: editForm.paymentCounterId, // Now mandatory
      kotCounterId: editForm.kotCounterId || undefined // Optional KOT counter
    };
    
    // Don't include imageUrl or imagePublicId for new items
    // Images will be uploaded separately after the item is created
    
    try {
      const createdItem = await addMenuItemMutation.mutateAsync(newItemData);
      
      // If there's a pending image file, upload it now
      if (pendingImageFile) {
        try {
          await uploadImageMutation.mutateAsync({ id: createdItem.id, file: pendingImageFile });
          setPendingImageFile(null);
        } catch (uploadError) {
          // Image upload failed - item was created successfully
          }
      }
      
      resetForm();
      setIsAddingItem(false);
    } catch (error) {
      // Error handled by React Query
    }
  };


  const addAddon = () => {
    setAddOns([...addOns, { name: "", price: "" }]);
  };

  const removeAddon = (index: number) => {
    setAddOns(addOns.filter((_, i) => i !== index));
  };

  const updateAddon = (index: number, field: 'name' | 'price', value: string) => {
    const updated = [...addOns];
    updated[index][field] = value;
    setAddOns(updated);
  };

  // Get real stock data for menu items
  const getStockData = (item: MenuItem) => {
    const currentStock = item.stock || 0;
    const minThreshold = 5;
    let status = "in_stock";
    if (currentStock === 0) status = "out_of_stock";
    else if (currentStock <= minThreshold) status = "low_stock";
    
    return {
      currentStock,
      minThreshold,
      status
    };
  };

  // Enhanced menu items with stock data
  const menuItemsWithStock = menuItems.map(item => ({
    ...item,
    stockData: getStockData(item)
  }));

  // Calculate analytics
  const totalItems = menuItemsWithStock.length;
  const lowStockItems = menuItemsWithStock.filter(item => item.stockData.status === "low_stock").length;
  const outOfStockItems = menuItemsWithStock.filter(item => item.stockData.status === "out_of_stock").length;
  const inStockItems = menuItemsWithStock.filter(item => item.stockData.status === "in_stock").length;
  const totalStockValue = menuItemsWithStock.reduce((sum, item) => sum + (item.stockData.currentStock * item.price), 0);

  // Filter menu items
  const filteredItems = menuItemsWithStock.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Handle both string and object categoryId
    const categoryIdToFind = typeof item.categoryId === 'string' 
      ? item.categoryId 
      : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);
    
    const itemCategory = categories.find(cat => cat.id === categoryIdToFind);
    const matchesCategory = selectedCategory === "all" || 
      itemCategory?.name === selectedCategory;
    
    const matchesStock = stockFilter === "all" || item.stockData.status === stockFilter;
    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="h-full flex flex-col min-h-0">
      <Card className="flex-1 flex flex-col min-h-0 bg-card border-border">
        <CardHeader className="flex-shrink-0 p-4 pb-2 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="flex items-center text-lg text-foreground">
              <ChefHat className="w-4 h-4 mr-2 text-primary" />
              Menu Management
            </CardTitle>
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
              {/* Refresh Button */}
              <OwnerButton 
                variant="secondary" 
                onClick={onMenuUpdate}
                icon={<RefreshCcw className="w-4 h-4" />}
                className="px-2"
                aria-label="Refresh menu"
              >
                <span className="hidden sm:inline">Refresh</span>
              </OwnerButton>
              
              {/* Import/Export Buttons */}
              <OwnerButton 
                variant="secondary" 
                onClick={exportToXML}
                icon={<Download className="w-4 h-4" />}
                className="px-2"
                aria-label="Export menu as XML"
              >
                <span className="hidden sm:inline">Export XML</span>
              </OwnerButton>
              <div className="relative">
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isImporting}
                />
                <OwnerButton 
                  variant="secondary"
                  disabled={isImporting}
                  isLoading={isImporting}
                  icon={!isImporting ? <Upload className="w-4 h-4" /> : undefined}
                  className="px-2"
                  aria-label="Import menu from XML"
                >
                  <span className="hidden sm:inline">Import XML</span>
                </OwnerButton>
              </div>
              
              {/* Toggle stats */}
              <OwnerButton
                variant="secondary"
                onClick={() => setShowStats(prev => !prev)}
                icon={showStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                className="px-2"
                aria-label={showStats ? "Hide stats" : "Show stats"}
              >
                <span className="hidden sm:inline">{showStats ? "Hide Stats" : "Show Stats"}</span>
              </OwnerButton>
              
              {/* Add Menu Item Button */}
              <OwnerButton 
                variant="primary"
                onClick={() => setIsAddingItem(true)}
                data-testid="button-add-menu-item"
                icon={<Plus className="w-4 h-4" />}
                className="px-2"
                aria-label="Add new item"
              >
                <span className="hidden sm:inline">Add New Item</span>
              </OwnerButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-2">
          {/* Analytics Dashboard */}
          {showStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 flex-shrink-0">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Items</p>
                <p className="text-xl font-bold text-foreground">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">In Stock</p>
                <p className="text-xl font-bold text-success">{inStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Low Stock</p>
                <p className="text-xl font-bold text-warning">{lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Out of Stock</p>
                <p className="text-xl font-bold text-destructive">{outOfStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
          )}

          {/* Search and Filter */}
          <div className="space-y-3 mb-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm sm:text-base"
                data-testid="input-search-menu"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value)}
                data-testid="select-filter-category"
              >
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category, index) => {
                    const categoryId = category.id || (category as any)._id || `category-${index}`;
                    return (
                      <SelectItem key={categoryId} value={category.name}>
                        {category.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select
                value={stockFilter}
                onValueChange={(value) => setStockFilter(value)}
                data-testid="select-filter-stock"
              >
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="All Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        {/* Menu Items Grid - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
          <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No menu items found</p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <Card key={item.id || `item-${index}`} className="relative bg-card border-border hover:shadow-card transition-shadow">
              <CardContent className="p-3 sm:p-3.5 space-y-2">
                <div className="flex gap-2.5">
                  {/* Main Content - Left Side */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="space-y-1">
                      {/* Item Name and Price Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <h3 className="font-medium text-xs sm:text-sm leading-tight break-words" data-testid={`text-item-name-${item.id}`}>
                            {item.name}
                          </h3>
                          <VegIndicator isVegetarian={item.isVegetarian} />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-primary whitespace-nowrap flex-shrink-0" data-testid={`text-item-price-${item.id}`}>
                          ₹{item.price}
                        </p>
                      </div>
                      
                      {/* Menu Item Image */}
                      {item.imageUrl && (
                        <div className="w-full h-20 sm:h-24 rounded-md overflow-hidden bg-muted">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(item.imageUrl, '_blank')}
                          />
                        </div>
                      )}
                      
                      {/* Category */}
                      <div className="text-xs text-muted-foreground break-words">
                        {(item as any).categoryName || categories.find(cat => {
                          const catId = cat.id || (cat as any)._id;
                          const itemCategoryId = item.categoryId;
                          // Handle both string and object comparisons
                          return catId === itemCategoryId || 
                                 catId === (itemCategoryId as any)?._id || 
                                 catId === (itemCategoryId as any)?.id ||
                                 String(catId) === String(itemCategoryId);
                        })?.name || 'Unknown'}
                      </div>
                      
                      {/* Description - fully visible, wraps naturally */}
                      {item.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Status Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px]">
                      <Badge 
                        variant={item.available ? "default" : "secondary"}
                        className={`text-xs px-1.5 py-0.5 ${
                          item.available 
                            ? "bg-success/20 text-success border-success/40" 
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                        data-testid={`badge-item-status-${item.id}`}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] sm:text-xs text-muted-foreground">Visible</span>
                        <Switch
                          checked={item.available}
                          onCheckedChange={(checked) => {
                            toggleAvailabilityMutation.mutate({ id: item.id, available: checked });
                          }}
                          disabled={toggleAvailabilityMutation.isPending}
                          data-testid={`switch-card-available-${item.id}`}
                          aria-label={`Set ${item.name} as ${item.available ? 'unavailable' : 'available'}`}
                          className="scale-95 sm:scale-100 origin-left"
                        />
                      </div>
                      <Badge 
                        variant={item.isMarkable ? "secondary" : "outline"}
                        className={`text-xs px-1.5 py-0.5 ${
                          item.isMarkable 
                            ? "bg-primary/20 text-primary border-primary/40" 
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                        data-testid={`badge-item-markable-${item.id}`}
                      >
                        {item.isMarkable ? "Markable" : "Auto"}
                      </Badge>
                      {item.isQuickPick && (
                        <Badge 
                          variant="secondary"
                          className="text-xs px-1.5 py-0.5 bg-warning/20 text-warning border-warning/40"
                          data-testid={`badge-item-quickpick-${item.id}`}
                        >
                          Quick Pick
                        </Badge>
                      )}
                    </div>
                    
                    {/* Stock Control & Actions - Mobile friendly */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1 bg-muted/40 rounded-md px-2 py-1">
                        <OwnerButton
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 p-0 text-xs"
                          aria-label={`Decrease stock for ${item.name}`}
                          onClick={() => {
                            const currentStock = item.stock || 0;
                            if (currentStock > 0) {
                              updateStockMutation.mutate({ id: item.id, newStock: currentStock - 1 });
                            }
                          }}
                          disabled={!item.stock || item.stock <= 0 || updateStockMutation.isPending}
                          data-testid={`button-decrease-stock-${item.id}`}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </OwnerButton>
                        <Badge 
                          variant={
                            item.stockData.status === "in_stock" ? "default" : 
                            item.stockData.status === "low_stock" ? "destructive" : "secondary"
                          }
                          className={`text-xs px-2 py-1 min-w-[56px] text-center ${
                            item.stockData.status === "in_stock" ? "bg-success/20 text-success border-success/40" :
                            item.stockData.status === "low_stock" ? "bg-warning/20 text-warning border-warning/40" :
                            "bg-destructive/20 text-destructive border-destructive/40"
                          }`}
                          data-testid={`badge-item-stock-${item.id}`}
                        >
                          {item.stock || 0} pcs
                        </Badge>
                        <OwnerButton
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 p-0 text-xs"
                          aria-label={`Increase stock for ${item.name}`}
                          onClick={() => {
                            const currentStock = item.stock || 0;
                            updateStockMutation.mutate({ id: item.id, newStock: currentStock + 1 });
                          }}
                          disabled={updateStockMutation.isPending}
                          data-testid={`button-increase-stock-${item.id}`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </OwnerButton>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <OwnerButton
                          variant="secondary"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                          aria-label={`Edit ${item.name}`}
                        >
                          <Edit className="w-2.5 h-2.5" />
                        </OwnerButton>
                        <OwnerButton
                          variant="danger"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => deleteMenuItemMutation.mutate(item.id)}
                          disabled={deleteMenuItemMutation.isPending}
                          data-testid={`button-delete-${item.id}`}
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </OwnerButton>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Add Menu Item Dialog */}
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto app-scrollbar">
          <DialogHeader>
            <DialogTitle>Add New Menu Item</DialogTitle>
            <DialogDescription>
              Add a new item to your menu with all the necessary details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 app-scrollbar">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                data-testid="input-item-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Item name"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="add-price">Price (₹) *</Label>
              <Input
                id="add-price"
                data-testid="input-item-price"
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                placeholder="0"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="add-category">Category *</Label>
              <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({...editForm, categoryId: value})}>
                <SelectTrigger data-testid="select-item-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category, index) => {
                    const categoryId = category.id || (category as any)._id || `category-${index}`;
                    return (
                      <SelectItem key={categoryId} value={categoryId.toString()}>
                        {category.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                data-testid="input-item-description"
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                placeholder="Item description"
                rows={3}
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label htmlFor="add-stock">Stock</Label>
              <Input
                id="add-stock"
                data-testid="input-item-stock"
                type="number"
                value={editForm.stock}
                onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                placeholder="0"
              />
            </div>

            {/* Available */}
            <div className="flex items-center space-x-2">
              <Switch
                id="add-available"
                data-testid="switch-item-available"
                checked={editForm.available}
                onCheckedChange={(checked) => setEditForm({...editForm, available: checked})}
              />
              <Label htmlFor="add-available">Available</Label>
            </div>

            {/* Vegetarian */}
            <div className="flex items-center space-x-2">
              <Switch
                id="add-vegetarian"
                data-testid="switch-item-vegetarian"
                checked={editForm.isVegetarian}
                onCheckedChange={(checked) => setEditForm({...editForm, isVegetarian: checked})}
              />
              <Label htmlFor="add-vegetarian">Vegetarian</Label>
            </div>

            {/* Markable */}
            <div className="flex items-center space-x-2">
              <Switch
                id="add-markable"
                data-testid="switch-item-markable"
                checked={editForm.isMarkable}
                onCheckedChange={(checked) => setEditForm({...editForm, isMarkable: checked})}
              />
              <div className="space-y-1">
                <Label htmlFor="add-markable">Markable Dish</Label>
                <p className="text-xs text-muted-foreground">
                  {editForm.isMarkable ? "Requires preparation - manually mark as ready" : "Auto-ready - order goes directly to ready status"}
                </p>
              </div>
            </div>

            {/* Quick Pick */}
            <div className="flex items-center space-x-2">
              <Switch
                id="add-quickpick"
                data-testid="switch-item-quickpick"
                checked={editForm.isQuickPick}
                onCheckedChange={(checked) => setEditForm({...editForm, isQuickPick: checked})}
              />
              <div className="space-y-1">
                <Label htmlFor="add-quickpick">Quick Pick</Label>
                <p className="text-xs text-muted-foreground">
                  {editForm.isQuickPick ? "Appears in Quick Picks section for faster ordering" : "Regular menu item"}
                </p>
              </div>
            </div>

            {/* Counter Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-store-counter">Store Counter <span className="text-red-500">*</span></Label>
                <Select 
                  value={editForm.storeCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, storeCounterId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store counter (required)" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeCounters.map((counter) => (
                      <SelectItem key={counter.id} value={counter.id}>
                        {counter.name} ({counter.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Orders with this item will be assigned to the selected store counter
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-payment-counter">Payment Counter <span className="text-red-500">*</span></Label>
                <Select 
                  value={editForm.paymentCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, paymentCounterId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment counter (required)" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentCounters.map((counter) => (
                      <SelectItem key={counter.id} value={counter.id}>
                        {counter.name} ({counter.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Orders with this item will be assigned to the selected payment counter
                </p>
              </div>
            </div>

            {/* KOT Counter Selection (Optional) */}
            {kotCounters.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="add-kot-counter">KOT Counter (Optional)</Label>
                <Select 
                  value={editForm.kotCounterId || ""} 
                  onValueChange={(value) => setEditForm({ ...editForm, kotCounterId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select KOT counter (optional)" />
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
                <p className="text-xs text-muted-foreground">
                  Optional: Assign this item to a KOT counter for kitchen order tracking
                </p>
              </div>
            )}

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Menu Image (Optional)</Label>
              <ImageUpload
                currentImageUrl={editForm.imageUrl}
                onImageUpload={async (file) => {
                  setPendingImageFile(file);
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    setEditForm(prev => ({
                      ...prev,
                      imageUrl: e.target?.result as string
                    }));
                  };
                  reader.readAsDataURL(file);
                }}
                onImageRemove={async () => {
                  setPendingImageFile(null);
                  setEditForm(prev => ({
                    ...prev,
                    imageUrl: "",
                    imagePublicId: ""
                  }));
                }}
                disabled={false}
                maxSizeKB={100}
              />
            </div>

            {/* Add-ons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Add-ons</Label>
                <OwnerButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addAddon}
                  data-testid="button-add-addon"
                  icon={<Plus className="w-3 h-3" />}
                >
                  Add Add-on
                </OwnerButton>
              </div>
              <div className="space-y-2">
                {addOns.map((addon, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Add-on name"
                      value={addon.name}
                      onChange={(e) => updateAddon(index, 'name', e.target.value)}
                      className="border-border"
                      data-testid={`input-addon-name-${index}`}
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={addon.price}
                      onChange={(e) => updateAddon(index, 'price', e.target.value)}
                      className="border-border"
                      data-testid={`input-addon-price-${index}`}
                    />
                    <OwnerButton
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeAddon(index)}
                      data-testid={`button-remove-addon-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </OwnerButton>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-border">
            <OwnerButton
              variant="secondary"
              onClick={() => {
                setIsAddingItem(false);
                resetForm();
              }}
              data-testid="button-cancel-add"
            >
              Cancel
            </OwnerButton>
            <OwnerButton
              variant="primary"
              onClick={handleAdd}
              disabled={addMenuItemMutation.isPending}
              isLoading={addMenuItemMutation.isPending}
              data-testid="button-save-add"
            >
              Add Item
            </OwnerButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto app-scrollbar">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the details of your menu item.
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 app-scrollbar">
              {/* Same form fields as add dialog but with edit data */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  data-testid="input-edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  placeholder="Item name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">Price (₹) *</Label>
                <Input
                  id="edit-price"
                  data-testid="input-edit-price"
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({...editForm, categoryId: value})}>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category, index) => {
                      const categoryId = category.id || (category as any)._id || `category-${index}`;
                      return (
                        <SelectItem key={categoryId} value={categoryId.toString()}>
                          {category.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  data-testid="input-edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  placeholder="Item description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stock">Stock</Label>
                <Input
                  id="edit-stock"
                  data-testid="input-edit-stock"
                  type="number"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-available"
                  data-testid="switch-edit-available"
                  checked={editForm.available}
                  onCheckedChange={(checked) => setEditForm({...editForm, available: checked})}
                />
                <Label htmlFor="edit-available">Available</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-vegetarian"
                  data-testid="switch-edit-vegetarian"
                  checked={editForm.isVegetarian}
                  onCheckedChange={(checked) => setEditForm({...editForm, isVegetarian: checked})}
                />
                <Label htmlFor="edit-vegetarian">Vegetarian</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-markable"
                  data-testid="switch-edit-markable"
                  checked={editForm.isMarkable}
                  onCheckedChange={(checked) => setEditForm({...editForm, isMarkable: checked})}
                />
                <div className="space-y-1">
                  <Label htmlFor="edit-markable">Markable Dish</Label>
                  <p className="text-xs text-muted-foreground">
                    {editForm.isMarkable ? "Requires preparation - manually mark as ready" : "Auto-ready - order goes directly to ready status"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-quickpick"
                  data-testid="switch-edit-quickpick"
                  checked={editForm.isQuickPick}
                  onCheckedChange={(checked) => setEditForm({...editForm, isQuickPick: checked})}
                />
                <div className="space-y-1">
                  <Label htmlFor="edit-quickpick">Quick Pick</Label>
                  <p className="text-xs text-muted-foreground">
                    {editForm.isQuickPick ? "Appears in Quick Picks section for faster ordering" : "Regular menu item"}
                  </p>
                </div>
              </div>

              {/* Image Upload */}
              {/* Counter Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-store-counter">Store Counter <span className="text-red-500">*</span></Label>
                  <Select 
                    value={editForm.storeCounterId || ""} 
                    onValueChange={(value) => setEditForm({ ...editForm, storeCounterId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select store counter (required)" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeCounters.map((counter) => (
                        <SelectItem key={counter.id} value={counter.id}>
                          {counter.name} ({counter.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Orders with this item will be assigned to the selected store counter
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-payment-counter">Payment Counter <span className="text-red-500">*</span></Label>
                  <Select 
                    value={editForm.paymentCounterId || ""} 
                    onValueChange={(value) => setEditForm({ ...editForm, paymentCounterId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment counter (required)" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentCounters.map((counter) => (
                        <SelectItem key={counter.id} value={counter.id}>
                          {counter.name} ({counter.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Orders with this item will be assigned to the selected payment counter
                  </p>
                </div>
              </div>

              {/* KOT Counter Selection (Optional) */}
              {kotCounters.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="edit-kot-counter">KOT Counter (Optional)</Label>
                  <Select 
                    value={editForm.kotCounterId || ""} 
                    onValueChange={(value) => setEditForm({ ...editForm, kotCounterId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select KOT counter (optional)" />
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
                  <p className="text-xs text-muted-foreground">
                    Optional: Assign this item to a KOT counter for kitchen order tracking
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Menu Image (Optional)</Label>
                <ImageUpload
                  currentImageUrl={editForm.imageUrl}
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
                  disabled={uploadImageMutation.isPending || removeImageMutation.isPending}
                  maxSizeKB={100}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                <Label>Add-ons</Label>
                <OwnerButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addAddon}
                  data-testid="button-edit-add-addon"
                  icon={<Plus className="w-3 h-3" />}
                >
                  Add Add-on
                </OwnerButton>
                </div>
                <div className="space-y-2">
                  {addOns.map((addon, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="Add-on name"
                        value={addon.name}
                        onChange={(e) => updateAddon(index, 'name', e.target.value)}
                        className="border-border"
                        data-testid={`input-edit-addon-name-${index}`}
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={addon.price}
                        onChange={(e) => updateAddon(index, 'price', e.target.value)}
                        className="border-border"
                        data-testid={`input-edit-addon-price-${index}`}
                      />
                      <OwnerButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeAddon(index)}
                        data-testid={`button-edit-remove-addon-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </OwnerButton>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t border-border">
            <OwnerButton
              variant="secondary"
              onClick={() => setEditingItem(null)}
              data-testid="button-cancel-edit"
              disabled={updateMenuItemMutation.isPending || uploadImageMutation.isPending}
            >
              Cancel
            </OwnerButton>
            <OwnerButton
              variant="primary"
              onClick={handleSaveEdit}
              disabled={updateMenuItemMutation.isPending || uploadImageMutation.isPending}
              isLoading={updateMenuItemMutation.isPending || uploadImageMutation.isPending}
              data-testid="button-save-edit"
            >
              {uploadImageMutation.isPending ? 'Uploading Image...' : updateMenuItemMutation.isPending ? 'Saving...' : 'Save Changes'}
            </OwnerButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}