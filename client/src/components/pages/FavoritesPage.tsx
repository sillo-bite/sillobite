import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Heart, Trash2, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { toast } from "sonner";
import { updateStatusBarColor } from "@/utils/statusBar";

// Utility function to format price with proper decimals
const formatPrice = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '₹0.00';
  }
  return `₹${price.toFixed(2)}`;
};

// Improved utility function to get default category name
const getDefaultCategoryName = (itemName: string): string => {
  if (!itemName || typeof itemName !== 'string') {
    return 'Main Course';
  }
  
  const name = itemName.toLowerCase().trim();
  
  // More specific patterns first
  if (/\b(tea|coffee|juice|drink|soda|cola|water|milkshake|smoothie|lassi|buttermilk)\b/.test(name)) {
    return 'Beverages';
  } else if (/\b(rice|biryani|curry|dal|sabzi|pulao|fried rice)\b/.test(name)) {
    return 'Main Course';
  } else if (/\b(snack|samosa|pakora|kachori|vada|dosa|idli|poha|upma)\b/.test(name)) {
    return 'Snacks';
  } else if (/\b(sweet|dessert|cake|gulab jamun|rasgulla|kheer|ice cream|halwa)\b/.test(name)) {
    return 'Desserts';
  } else if (/\b(bread|roti|naan|paratha|chapati|kulcha)\b/.test(name)) {
    return 'Bread';
  } else {
    return 'Main Course';
  }
};

export default function FavoritesPage() {
  const [, setLocation] = useLocation();
  const { getFavoritesByCanteen, removeFromFavorites } = useFavorites();
  const { addToCart } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Get favorites for current canteen with error handling
  let currentCanteenFavorites: any[] = [];
  try {
    currentCanteenFavorites = selectedCanteen?.id 
      ? getFavoritesByCanteen(selectedCanteen.id)
      : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    toast.error('Failed to load favorites');
  }
  
  // Validate item data before adding to cart
  const validateItem = (item: any): boolean => {
    if (!item) {
      toast.error('Invalid item data');
      return false;
    }
    if (!item.id) {
      toast.error('Item ID is missing');
      return false;
    }
    if (!item.name || typeof item.name !== 'string') {
      toast.error('Item name is invalid');
      return false;
    }
    if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) {
      toast.error('Item price is invalid');
      return false;
    }
    if (!selectedCanteen?.id) {
      toast.error('Please select a canteen first');
      return false;
    }
    return true;
  };

  const handleRemoveFavorite = (itemId: string) => {
    try {
      removeFromFavorites(itemId);
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove favorite');
    }
  };
  
  const handleAddAllToCart = async () => {
    if (!selectedCanteen?.id) {
      toast.error('Please select a canteen first');
      return;
    }
    
    if (currentCanteenFavorites.length === 0) {
      toast.info('No favorites to add');
      return;
    }
    
    setIsAddingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const item of currentCanteenFavorites) {
        if (validateItem(item)) {
          const category = getDefaultCategoryName(item.name || '');
          addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            isVegetarian: item.isVegetarian || false,
            canteenId: selectedCanteen.id,
            category: category,
            description: item.description
          });
          successCount++;
        } else {
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Added ${successCount} item${successCount !== 1 ? 's' : ''} to cart`);
      }
      if (errorCount > 0) {
        toast.warning(`Failed to add ${errorCount} item${errorCount !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Error adding all to cart:', error);
      toast.error('Failed to add items to cart');
    } finally {
      setIsAddingAll(false);
    }
  };
  
  const handleImageError = (itemId: string) => {
    setImageErrors(prev => new Set(prev).add(itemId));
  };
  
  const handleBackNavigation = () => {
    // Use only one navigation method to avoid double navigation
    window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
    // Don't call setLocation here - let the event handler manage navigation
  };

  // Update status bar to match header color
  useEffect(() => {
    updateStatusBarColor('#724491'); // purple primary color
  }, []);

  return (
    <>
      <div
        className={`w-full h-auto min-h-fit flex flex-col ${
      resolvedTheme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-50'
    }`}
      >
      {/* Header */}
      <div className="bg-red-600 text-white px-4 pt-12 pb-6 sticky top-0 z-10 rounded-b-2xl flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20" 
            onClick={handleBackNavigation}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-white" />
            <h1 className="text-xl font-bold text-white">My Favorites</h1>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex flex-col px-4 pb-24 mt-4">
        {currentCanteenFavorites.length > 0 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {currentCanteenFavorites.length} item{currentCanteenFavorites.length !== 1 ? 's' : ''} in your favorites
            </p>
            
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1" role="list" aria-label="Favorite items">
              {currentCanteenFavorites.map((item) => {
                const hasImageError = imageErrors.has(item.id);
                const showImage = item.imageUrl && !hasImageError;
                
                return (
                <Card 
                  key={item.id}
                  role="listitem"
                  className={`${
                    resolvedTheme === 'dark' 
                      ? 'bg-black hover:bg-gray-950' 
                      : 'bg-white hover:bg-gray-50'
                  } rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden`}
                >
                  <CardContent className="p-0">
                    {/* Top Section - Restaurant info and remove button */}
                    <div className="flex items-center p-3">
                      {/* Left: Product image */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 mr-3" role="img" aria-label={`${item.name} image`}>
                        <div className={`w-full h-full ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-700' 
                            : 'bg-gray-200'
                        } flex items-center justify-center`}>
                          {showImage ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() => handleImageError(item.id)}
                            />
                          ) : (
                            <span className="text-lg" aria-hidden="true">🍽️</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Center: Veg indicator, name, and price */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center space-x-2 mb-1">
                          {/* Vegetarian indicator */}
                          <div 
                            className={`w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0 ${
                              item.isVegetarian ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            role="img"
                            aria-label={item.isVegetarian ? 'Vegetarian' : 'Non-vegetarian'}
                          >
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                          
                          {/* Item name */}
                          <h3 className={`font-bold text-sm truncate leading-tight ${
                            resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                          }`}>
                            {item.name || 'Unnamed Item'}
                          </h3>
                        </div>
                        
                        {/* Price */}
                        <div className={`text-sm font-medium ml-5 ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {formatPrice(item.price)}
                        </div>
                      </div>
                      
                      {/* Right: Remove button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavorite(item.id);
                        }}
                        className={`w-6 h-6 flex items-center justify-center transition-colors ${
                          resolvedTheme === 'dark' ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                        }`}
                        aria-label={`Remove ${item.name} from favorites`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Bottom Section - Description and add button */}
                    <div className="flex items-start justify-between p-3 pt-0">
                      {/* Left: Description */}
                      <div className="flex-1 min-w-0 pr-3">
                        <div className={`text-sm leading-tight truncate ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {item.description || 'Delicious food item'}
                        </div>
                      </div>
                      
                    {/* Right: Add to cart button removed per request */}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            <Card className="mt-6 bg-card">
              <CardContent className="p-4 text-center">
                <h3 className="font-semibold mb-2 text-card-foreground">Quick Order</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add all favorites to cart with one click
                </p>
                <Button 
                  className="w-full"
                  onClick={handleAddAllToCart}
                  disabled={isAddingAll || !selectedCanteen?.id || currentCanteenFavorites.length === 0}
                  aria-label="Add all favorites to cart"
                >
                  {isAddingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add All to Cart
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-foreground">No favorites yet</h2>
            <p className="text-muted-foreground mb-6">
              Tap the heart icon on any dish to add to favorites
            </p>
            <Button 
              onClick={() => {
                // Navigate to menu view using the app's internal navigation system
                window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                  detail: { category: 'all' }
                }));
              }}
              aria-label="Browse menu to add favorites"
            >
              Browse Menu
            </Button>
          </div>
        )}
        </div>
      </div>
      {/* Bottom Navigation - fixed at bottom */}
      <div className="flex-shrink-0">
        <BottomNavigation currentPage="favorites" />
      </div>
    </>
  );
}