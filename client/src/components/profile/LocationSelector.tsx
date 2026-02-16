import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  GraduationCap,
  UtensilsCrossed,
  ChevronRight,
  MapPin,
  X,
  Loader2
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation as useLocationContext } from "@/contexts/LocationContext";

interface Location {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

interface LocationSelectorProps {
  onClose: () => void;
}

export default function LocationSelector({ onClose }: LocationSelectorProps) {
  const { resolvedTheme } = useTheme();
  const { setLocation: saveLocation } = useLocationContext();
  const [step, setStep] = useState<'type' | 'select'>('type');
  const [selectedType, setSelectedType] = useState<'college' | 'organization' | 'restaurant' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: locationsData, isLoading } = useQuery<{ locations: Location[] }>({
    queryKey: [`/api/locations/${selectedType}`],
    enabled: !!selectedType && step === 'select',
  });

  const locations: Location[] = locationsData?.locations?.filter((loc: Location) => loc.isActive !== false) || [];

  const handleTypeSelect = (type: 'college' | 'organization' | 'restaurant') => {
    setSelectedType(type);
    setStep('select');
  };

  const handleLocationSelect = async (location: Location) => {
    try {
      setIsSaving(true);
      await saveLocation(selectedType!, location.id, location.name);
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'college':
        return <GraduationCap className="w-8 h-8" />;
      case 'organization':
        return <Building2 className="w-8 h-8" />;
      case 'restaurant':
        return <UtensilsCrossed className="w-8 h-8" />;
      default:
        return <MapPin className="w-8 h-8" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}>
        {step === 'type' && (
          <>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className={`text-xl font-bold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                Select Location Type
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-3">
              <Card
                className={`cursor-pointer transition-all hover:scale-[1.02] ${resolvedTheme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                onClick={() => handleTypeSelect('college')}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${resolvedTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                      }`}>
                      <GraduationCap className={`w-6 h-6 ${resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                        College Campus
                      </h3>
                      <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        Select your college
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:scale-[1.02] ${resolvedTheme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                onClick={() => handleTypeSelect('organization')}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${resolvedTheme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                      }`}>
                      <Building2 className={`w-6 h-6 ${resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                        Organization
                      </h3>
                      <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        Select your organization
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:scale-[1.02] ${resolvedTheme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                onClick={() => handleTypeSelect('restaurant')}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${resolvedTheme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
                      }`}>
                      <UtensilsCrossed className={`w-6 h-6 ${resolvedTheme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                        }`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                        Restaurant
                      </h3>
                      <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        Select a restaurant
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {step === 'select' && (
          <>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setStep('type')}
                  className="text-muted-foreground"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </Button>
                <h2 className={`text-xl font-bold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                  Select {selectedType === 'college' ? 'College' : selectedType === 'organization' ? 'Organization' : 'Restaurant'}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : locations.length === 0 ? (
                <div className="text-center py-12">
                  <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    No {selectedType}s available
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {locations.map((location) => (
                    <Card
                      key={location.id}
                      className={`cursor-pointer transition-all hover:scale-[1.01] ${resolvedTheme === 'dark'
                          ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                        }`}
                      onClick={() => handleLocationSelect(location)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                              }`}>
                              {location.name}
                            </h3>
                            {location.code && (
                              <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                {location.code}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isSaving && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
