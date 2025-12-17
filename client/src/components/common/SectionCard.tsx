import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface SectionCardProps {
  icon?: LucideIcon;
  title: string;
  content: string[];
  className?: string;
}

/**
 * Reusable section card component for legal/info pages
 * Displays a section with icon, title, and list of content items
 */
export default function SectionCard({
  icon: Icon,
  title,
  content,
  className = ""
}: SectionCardProps) {
  return (
    <Card className={`shadow-card ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          {Icon && (
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={index} className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-muted-foreground text-sm leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

