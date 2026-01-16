import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useState, useRef, useEffect } from "react";

interface FloatingCartProps {
  onClick?: () => void;
  hasActiveOrders?: boolean;
  showOnlyWhenLiveOrderHidden?: boolean;
  isLiveOrderHidden?: boolean;
}

export default function FloatingCart({ 
  onClick, 
  hasActiveOrders = false,
  showOnlyWhenLiveOrderHidden = false,
  isLiveOrderHidden = false
}: FloatingCartProps) {
  const { getTotalItems, getTotalPrice, cart } = useCart();
  
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  
  // Animation state for entrance
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Draggable state for compact mode
  const [position, setPosition] = useState({ x: 16, y: window.innerHeight - 180 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasDraggedRef = useRef(false);
  
  // Trigger entrance animation when becoming visible
  useEffect(() => {
    if (showOnlyWhenLiveOrderHidden && isLiveOrderHidden && hasActiveOrders && totalItems > 0) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [showOnlyWhenLiveOrderHidden, isLiveOrderHidden, hasActiveOrders, totalItems]);
  
  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('floatingCartPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        setPosition({
          x: Math.min(Math.max(16, parsed.x), maxX),
          y: Math.min(Math.max(100, parsed.y), maxY)
        });
      } catch (e) {
        // Use default position
      }
    }
  }, []);
  
  // Handle drag start
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!hasActiveOrders) return;
    
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y
    };
  };
  
  // Handle drag move
  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasDraggedRef.current = true;
    }
    
    const newX = dragStartRef.current.posX + deltaX;
    const newY = dragStartRef.current.posY + deltaY;
    
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    
    setPosition({
      x: Math.min(Math.max(16, newX), maxX),
      y: Math.min(Math.max(100, newY), maxY)
    });
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const screenWidth = window.innerWidth;
    const snapToRight = position.x > screenWidth / 2;
    const snappedX = snapToRight ? screenWidth - 76 : 16;
    
    setPosition(prev => ({ ...prev, x: snappedX }));
    
    localStorage.setItem('floatingCartPosition', JSON.stringify({ 
      x: snappedX, 
      y: position.y 
    }));
  };
  
  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hasActiveOrders) return;
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };
  
  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasActiveOrders) return;
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };
  
  // Global mouse/touch move and end handlers
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    
    const handleMouseUp = () => {
      handleDragEnd();
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };
    
    const handleTouchEnd = () => {
      handleDragEnd();
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, position]);
  
  // Don't render if cart is empty
  if (totalItems === 0) {
    return null;
  }
  
  // New behavior: 
  // - If showOnlyWhenLiveOrderHidden is false (search mode), always show
  // - If showOnlyWhenLiveOrderHidden is true (normal mode):
  //   - If there are active orders, only show when live order is hidden (scrolled down)
  //   - If there are NO active orders, only show when scrolled down (isLiveOrderHidden = true)
  //     This prevents showing cart at top when header cart icon is visible
  if (showOnlyWhenLiveOrderHidden && !isLiveOrderHidden) {
    return null;
  }
  
  const handleClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    
    if (onClick) {
      onClick();
    } else {
      window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
    }
  };
  
  // Premium Cart Card - shown when live order is hidden
  if (showOnlyWhenLiveOrderHidden && hasActiveOrders) {
    return (
      <div
        className={`fixed left-3 right-3 z-[9999] transition-all ${
          isAnimating 
            ? 'animate-in slide-in-from-bottom-8 fade-in duration-500 ease-out' 
            : ''
        }`}
        style={{
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Ambient glow effect */}
        <div 
          className="absolute inset-x-4 -bottom-2 h-20 rounded-3xl blur-2xl pointer-events-none opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.4), rgba(192, 132, 252, 0.3))',
          }}
        />
        
        <button
          onClick={handleClick}
          className="relative w-full overflow-hidden rounded-[20px] transition-all duration-300 active:scale-[0.98] hover:scale-[1.005] group"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(168, 85, 247, 0.95) 50%, rgba(147, 51, 234, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `
              0 20px 60px -15px rgba(139, 92, 246, 0.5),
              0 10px 30px -10px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `,
          }}
          aria-label={`View cart with ${totalItems} items, total ₹${totalPrice}`}
        >
          {/* Animated gradient overlay */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)',
            }}
          />
          
          {/* Shimmer effect on hover */}
          <div 
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
            }}
          />
          
          {/* Content */}
          <div className="relative flex items-center justify-between px-5 py-4">
            {/* Left side - Cart info */}
            <div className="flex items-center gap-4">
              {/* Icon/Image container with glass effect */}
              <div className="relative">
                {cart.length > 0 && cart[0].imageUrl ? (
                  <div 
                    className="w-12 h-12 rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                    style={{
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <img 
                      src={cart[0].imageUrl} 
                      alt={cart[0].name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1))',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                )}
                {/* Item count badge */}
                <div 
                  className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff, #f0f0f0)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <span className="text-[11px] font-bold text-violet-600">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                </div>
              </div>
              
              {/* Text content */}
              <div className="flex flex-col items-start">
                <span className="text-white font-semibold text-[15px] tracking-tight">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-white/60 text-xs font-medium">
                  Ready to checkout
                </span>
              </div>
            </div>
            
            {/* Right side - Price and CTA */}
            <div 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 group-hover:gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              <span className="text-white font-bold text-base tracking-tight">
                ₹{totalPrice.toFixed(0)}
              </span>
              <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
        </button>
      </div>
    );
  }
  
  // Compact floating icon when there are active orders (legacy behavior)
  if (hasActiveOrders) {
    return (
      <button
        ref={dragRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`fixed z-[9999] flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
          isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab active:scale-95 hover:scale-105'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95))',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        aria-label={`View cart with ${totalItems} items, total ₹${totalPrice}`}
      >
        <div className="relative">
          <ShoppingBag className="w-6 h-6 text-white" />
          <span 
            className="absolute -top-2 -right-2 text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ffffff, #f0f0f0)',
              color: 'rgb(139, 92, 246)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
            }}
          >
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        </div>
      </button>
    );
  }
  
  // Full floating bar when no active orders - Premium Design
  return (
    <div
      className="fixed left-3 right-3 z-[9999]"
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Ambient glow effect */}
      <div 
        className="absolute inset-x-4 -bottom-2 h-20 rounded-3xl blur-2xl pointer-events-none opacity-60"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.4), rgba(192, 132, 252, 0.3))',
        }}
      />
      
      <button
        onClick={handleClick}
        className="relative w-full overflow-hidden rounded-[20px] transition-all duration-300 active:scale-[0.98] hover:scale-[1.005] group"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(168, 85, 247, 0.95) 50%, rgba(147, 51, 234, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: `
            0 20px 60px -15px rgba(139, 92, 246, 0.5),
            0 10px 30px -10px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1)
          `,
        }}
        aria-label={`View cart with ${totalItems} items, total ₹${totalPrice}`}
      >
        {/* Animated gradient overlay */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)',
          }}
        />
        
        {/* Shimmer effect on hover */}
        <div 
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
          }}
        />
        
        {/* Content */}
        <div className="relative flex items-center justify-between px-5 py-4">
          {/* Left side - Cart info */}
          <div className="flex items-center gap-4">
            {/* Icon/Image container with glass effect */}
            <div className="relative">
              {cart.length > 0 && cart[0].imageUrl ? (
                <div 
                  className="w-12 h-12 rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <img 
                    src={cart[0].imageUrl} 
                    alt={cart[0].name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1))',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              )}
              {/* Item count badge */}
              <div 
                className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #ffffff, #f0f0f0)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                <span className="text-[11px] font-bold text-violet-600">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              </div>
            </div>
            
            {/* Text content */}
            <div className="flex flex-col items-start">
              <span className="text-white font-semibold text-[15px] tracking-tight">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
              <span className="text-white/60 text-xs font-medium">
                Ready to checkout
              </span>
            </div>
          </div>
          
          {/* Right side - Price and CTA */}
          <div 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 group-hover:gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <span className="text-white font-bold text-base tracking-tight">
              ₹{totalPrice.toFixed(0)}
            </span>
            <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>
    </div>
  );
}