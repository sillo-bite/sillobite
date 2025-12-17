import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Package, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCcw,
  ShoppingCart,
  CalendarDays,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Settings
} from "lucide-react";
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  maxThreshold: number;
  unitCost: number;
  supplier: string;
  lastRestocked: string;
  expiryDate?: string;
  description?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
}

interface StockMovement {
  id: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  date: string;
  user: string;
  cost?: number;
}

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showStockMovement, setShowStockMovement] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Form states for new item
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    unit: "kg",
    currentStock: 0,
    minThreshold: 10,
    maxThreshold: 100,
    unitCost: 0,
    supplier: "",
    description: "",
    expiryDate: ""
  });

  // Fetch inventory data
  const { data: inventoryItems = [], refetch: refetchInventory } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    enabled: true
  });

  const { data: stockMovements = [] } = useQuery<StockMovement[]>({
    queryKey: ['/api/inventory/movements'],
    enabled: true
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['/api/inventory/suppliers'],
    enabled: true
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: (itemData: any) => apiRequest('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setShowAddItem(false);
      setNewItem({
        name: "",
        category: "",
        unit: "kg",
        currentStock: 0,
        minThreshold: 10,
        maxThreshold: 100,
        unitCost: 0,
        supplier: "",
        description: "",
        expiryDate: ""
      });
      }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setEditingItem(null);
      }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/inventory/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      }
  });

  const stockMovementMutation = useMutation({
    mutationFn: (movementData: any) => apiRequest('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(movementData)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
      setShowStockMovement(false);
      setMovementQuantity("");
      setMovementReason("");
      setSelectedItem(null);
      }
  });

  // Filter and search logic
  const filteredItems = inventoryItems.filter((item: InventoryItem) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Get unique categories
  const categories = Array.from(new Set(inventoryItems.map((item: InventoryItem) => item.category)));

  // Calculate inventory analytics
  const inventoryStats = {
    totalItems: inventoryItems.length,
    lowStockItems: inventoryItems.filter((item: InventoryItem) => item.status === 'low_stock').length,
    outOfStockItems: inventoryItems.filter((item: InventoryItem) => item.status === 'out_of_stock').length,
    expiredItems: inventoryItems.filter((item: InventoryItem) => item.status === 'expired').length,
    totalValue: inventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.currentStock * item.unitCost), 0)
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'bg-green-100 text-green-800 border-green-200';
      case 'low_stock': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out_of_stock': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'in_stock': return 'In Stock';
      case 'low_stock': return 'Low Stock';
      case 'out_of_stock': return 'Out of Stock';
      case 'expired': return 'Expired';
      default: return 'Unknown';
    }
  };

  const handleAddItem = () => {
    addItemMutation.mutate({
      ...newItem,
      id: Date.now().toString() // Temporary ID generation
    });
  };

  const handleStockMovement = () => {
    if (!selectedItem || !movementQuantity || !movementReason) {
      return;
    }

    stockMovementMutation.mutate({
      itemId: selectedItem.id,
      type: movementType,
      quantity: parseInt(movementQuantity),
      reason: movementReason,
      date: new Date().toISOString(),
      user: "Current User" // Should be from auth context
    });
  };

  return (
    <div className="space-y-6">
      {/* Inventory Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Management</h2>
          <p className="text-muted-foreground">Track stock levels, manage supplies, and monitor inventory health</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetchInventory()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddItem(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Inventory Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{inventoryStats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{inventoryStats.lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{inventoryStats.outOfStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-gray-600">{inventoryStats.expiredItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-green-600">₹{inventoryStats.totalValue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4" />
              <Input
                placeholder="Search items, categories, suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Inventory Overview</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Reports</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        {/* Inventory Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Items ({filteredItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item Name</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Current Stock</th>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Unit Cost</th>
                      <th className="text-left p-2">Total Value</th>
                      <th className="text-left p-2">Supplier</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: InventoryItem) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2 text-muted-foreground">{item.category}</td>
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <span className={item.currentStock <= item.minThreshold ? 'text-red-600 font-bold' : ''}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              (Min: {item.minThreshold})
                            </span>
                          </div>
                        </td>
                        <td className="p-2">{item.unit}</td>
                        <td className="p-2">
                          <Badge className={getStockStatusColor(item.status)} variant="outline">
                            {getStockStatusText(item.status)}
                          </Badge>
                        </td>
                        <td className="p-2">₹{item.unitCost}</td>
                        <td className="p-2 font-medium">₹{item.currentStock * item.unitCost}</td>
                        <td className="p-2 text-muted-foreground">{item.supplier}</td>
                        <td className="p-2">
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowStockMovement(true);
                              }}
                            >
                              <ShoppingCart className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(item)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stockMovements.slice(0, 20).map((movement: StockMovement) => {
                  const item = inventoryItems.find((i: InventoryItem) => i.id === movement.itemId);
                  return (
                    <div key={movement.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          movement.type === 'in' ? 'bg-green-500' :
                          movement.type === 'out' ? 'bg-red-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <p className="font-medium">{item?.name || 'Unknown Item'}</p>
                          <p className="text-sm text-muted-foreground">{movement.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          movement.type === 'in' ? 'text-green-600' :
                          movement.type === 'out' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : '±'}{movement.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(movement.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts & Reports Tab */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            {/* Low Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inventoryItems
                    .filter((item: InventoryItem) => item.status === 'low_stock')
                    .map((item: InventoryItem) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Current: {item.currentStock} {item.unit} (Min: {item.minThreshold})
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setMovementType('in');
                            setShowStockMovement(true);
                          }}
                        >
                          Restock
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Out of Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Out of Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inventoryItems
                    .filter((item: InventoryItem) => item.status === 'out_of_stock')
                    .map((item: InventoryItem) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Stock depleted - Last restocked: {new Date(item.lastRestocked).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedItem(item);
                            setMovementType('in');
                            setShowStockMovement(true);
                          }}
                        >
                          Urgent Restock
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suppliers.map((supplier: any) => (
                  <div key={supplier.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{supplier.name}</p>
                      <p className="text-sm text-muted-foreground">{supplier.contact}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Items: {supplier.itemCount}</p>
                      <p className="text-sm text-muted-foreground">Total Value: ₹{supplier.totalValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                placeholder="Enter item name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Input
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  placeholder="e.g., Vegetables"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={newItem.unit} onValueChange={(value) => setNewItem({...newItem, unit: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="l">Liters (l)</SelectItem>
                    <SelectItem value="ml">Milliliters (ml)</SelectItem>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="pkt">Packets (pkt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  value={newItem.currentStock}
                  onChange={(e) => setNewItem({...newItem, currentStock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Min Threshold</Label>
                <Input
                  type="number"
                  value={newItem.minThreshold}
                  onChange={(e) => setNewItem({...newItem, minThreshold: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Max Threshold</Label>
                <Input
                  type="number"
                  value={newItem.maxThreshold}
                  onChange={(e) => setNewItem({...newItem, maxThreshold: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit Cost (₹)</Label>
                <Input
                  type="number"
                  value={newItem.unitCost}
                  onChange={(e) => setNewItem({...newItem, unitCost: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Supplier</Label>
                <Input
                  value={newItem.supplier}
                  onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                  placeholder="Supplier name"
                />
              </div>
            </div>

            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                placeholder="Item description..."
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={handleAddItem} disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddItem(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={showStockMovement} onOpenChange={setShowStockMovement}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Stock Movement</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedItem.name}</p>
                <p className="text-sm text-muted-foreground">
                  Current Stock: {selectedItem.currentStock} {selectedItem.unit}
                </p>
              </div>

              <div>
                <Label>Movement Type</Label>
                <Select value={movementType} onValueChange={(value: any) => setMovementType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Stock In (Purchase/Restock)</SelectItem>
                    <SelectItem value="out">Stock Out (Usage/Sale)</SelectItem>
                    <SelectItem value="adjustment">Adjustment (Correction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <Label>Reason</Label>
                <Textarea
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Reason for stock movement..."
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleStockMovement} disabled={stockMovementMutation.isPending}>
                  {stockMovementMutation.isPending ? "Recording..." : "Record Movement"}
                </Button>
                <Button variant="outline" onClick={() => setShowStockMovement(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}