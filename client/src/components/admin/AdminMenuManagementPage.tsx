import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { VegIndicator } from "@/components/ui/VegIndicator";
import type { MenuItem, Category } from "@shared/schema";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  X
} from "lucide-react";

export default function AdminMenuManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    categoryId: "",
    description: "",
    stock: "",
    available: true,
    isVegetarian: true,
    addOns: "[]"
  });
  const [addOns, setAddOns] = useState<Array<{ name: string; price: string }>>([]);
  // Disable API calls for admin menu management - use mock data to prevent unnecessary calls
  const categories: Category[] = [];
  const menuItems: MenuItem[] = [];
  const categoriesLoading = false;
  const menuItemsLoading = false;

  const isLoading = categoriesLoading || menuItemsLoading;

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
      // Invalidate all related queries for real-time sync across dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
    },
    onError: () => {
    }
  });

  // Delete menu item mutation with enhanced sync
  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/menu/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for all dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: () => {
    }
  });

  const toggleAvailability = (id: string, available: boolean) => {
    updateMenuItemMutation.mutate({ id, data: { available } });
  };

  const deleteItem = (id: string) => {
    deleteMenuItemMutation.mutate(id);
  };

  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);

    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToSet = typeof item.categoryId === 'string'
      ? item.categoryId
      : (item.categoryId as any)?._id || (item.categoryId as any)?.id || String(item.categoryId);

    setEditForm({
      name: item.name,
      price: item.price.toString(),
      categoryId: categoryIdToSet,
      description: item.description || "",
      stock: item.stock.toString(),
      available: item.available,
      isVegetarian: item.isVegetarian,
      addOns: item.addOns || "[]"
    });

    // Parse existing add-ons
    try {
      const existingAddOns = JSON.parse(item.addOns || "[]");
      setAddOns(existingAddOns.length > 0 ? existingAddOns : []);
    } catch {
      setAddOns([]);
    }
  };

  const addNewAddOn = () => {
    setAddOns([...addOns, { name: "", price: "" }]);
  };

  const updateAddOn = (index: number, field: "name" | "price", value: string) => {
    const updatedAddOns = [...addOns];
    updatedAddOns[index][field] = value;
    setAddOns(updatedAddOns);
  };

  const removeAddOn = (index: number) => {
    setAddOns(addOns.filter((_, i) => i !== index));
  };

  const saveEditedItem = () => {
    if (!editingItem) return;

    // Extract categoryId properly (handle both string and object formats)
    const categoryIdToUse = typeof editForm.categoryId === 'string'
      ? editForm.categoryId
      : (editForm.categoryId as any)?._id || (editForm.categoryId as any)?.id || String(editForm.categoryId);

    const updatedData = {
      name: editForm.name,
      price: parseInt(editForm.price),
      categoryId: categoryIdToUse,
      description: editForm.description,
      stock: parseInt(editForm.stock),
      available: editForm.available,
      isVegetarian: editForm.isVegetarian,
      addOns: JSON.stringify(addOns.filter(addon => addon.name && addon.price))
    };

    // Extract the ID properly (handle both id and _id fields)
    const itemId = editingItem.id || (editingItem as any)._id;
    if (!itemId) {
      console.error('No ID found for menu item:', editingItem);
      return;
    }
    updateMenuItemMutation.mutate({ id: itemId, data: updatedData });
    setEditingItem(null);
  };

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" ||
      categories.find(cat => cat.id === item.categoryId)?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Menu Management</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add New Item
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Menu Items Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <p>No menu items found</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(item as any).categoryName || categories.find(cat => {
                        const catId = cat.id || (cat as any)._id;
                        const itemCategoryId = item.categoryId;
                        return catId === itemCategoryId ||
                          catId === (itemCategoryId as any)?._id ||
                          catId === (itemCategoryId as any)?.id ||
                          String(catId) === String(itemCategoryId);
                      })?.name || "Unknown Category"}
                    </p>
                  </div>
                  <Badge variant={item.available ? "default" : "secondary"}>
                    {item.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground truncate">
                  {item.description || "No description available"}
                </p>

                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">₹{item.price}</span>
                  <span className="text-sm text-muted-foreground">
                    Stock: {item.stock}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={item.available}
                      onCheckedChange={(checked) => toggleAvailability(item.id, checked)}
                    />
                    <Label className="text-sm">
                      {item.available ? "Available" : "Unavailable"}
                    </Label>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the menu item details including add-ons.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Item name"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({ ...editForm, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Item description"
                rows={3}
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={editForm.stock}
                onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Available */}
            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={editForm.available}
                onCheckedChange={(checked) => setEditForm({ ...editForm, available: checked })}
              />
              <Label htmlFor="available">Available</Label>
            </div>

            {/* Vegetarian */}
            <div className="flex items-center space-x-2">
              <Switch
                id="vegetarian"
                checked={editForm.isVegetarian}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isVegetarian: checked })}
              />
              <Label htmlFor="vegetarian" className="flex items-center space-x-2">
                <span>Vegetarian</span>
                <VegIndicator isVegetarian={editForm.isVegetarian} size="sm" />
              </Label>
            </div>

            {/* Add-ons Section */}
            <div className="space-y-2 border border-dashed border-gray-300 p-4 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Add-ons</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewAddOn}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Add-on
                </Button>
              </div>

              <div className="space-y-2">
                {addOns.map((addon, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <Input
                      placeholder="Add-on name"
                      value={addon.name}
                      onChange={(e) => updateAddOn(index, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Price"
                      type="number"
                      value={addon.price}
                      onChange={(e) => updateAddOn(index, "price", e.target.value)}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeAddOn(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {addOns.length === 0 && (
                <p className="text-sm text-muted-foreground">No add-ons configured</p>
              )}
            </div>
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex justify-end space-x-2 pt-4 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => setEditingItem(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveEditedItem}
              disabled={!editForm.name || !editForm.price}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}