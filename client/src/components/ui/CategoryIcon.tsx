import { Utensils } from "lucide-react";
import type { Category } from "@shared/schema";

interface CategoryIconProps {
  category: Category;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CategoryIcon = ({ category, size = "md", className = "" }: CategoryIconProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-10 h-10"
  };

  const containerClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10"
  };

  // Priority: imageUrl > icon > default icon
  if (category.imageUrl) {
    return (
      <div className={`${containerClasses[size]} rounded overflow-hidden flex-shrink-0 ${className}`}>
        <img 
          src={category.imageUrl} 
          alt={category.name}
          className={`${sizeClasses[size]} object-contain`}
          onError={(e) => {
            // If image fails to load, replace with fallback icon
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = category.icon || '<svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>';
            }
          }}
        />
      </div>
    );
  }
  
  if (category.icon) {
    return (
      <div className={`${containerClasses[size]} flex items-center justify-center text-lg flex-shrink-0 ${className}`}>
        {category.icon}
      </div>
    );
  }
  
  // Default fallback icon
  return (
    <div className={`${containerClasses[size]} flex items-center justify-center flex-shrink-0 ${className}`}>
      <Utensils className={`${sizeClasses[size]} text-gray-500`} />
    </div>
  );
};

export default CategoryIcon;
