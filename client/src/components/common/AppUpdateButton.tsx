import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Zap, Info } from "lucide-react";
import { UpdateManager } from "@/utils/updateManager";
import { passiveUpdateDetector } from "@/utils/passiveUpdateDetector";
export default function AppUpdateButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string; cacheVersion: string }>({
    version: '1.0.0',
    cacheVersion: 'unknown'
  });

  useEffect(() => {
    // Check for version info
    UpdateManager.getVersionInfo().then(setVersionInfo);
    
    // Check if update is available (this would be set by the update manager)
    const checkUpdateStatus = () => {
      const manager = UpdateManager.getInstance();
      setUpdateAvailable(manager.isUpdateReady());
    };
    
    checkUpdateStatus();
  }, []);

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await UpdateManager.forceRefresh();
    } catch (error) {
      console.error('Force refresh failed:', error);
      } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheckForUpdates = async () => {
    await passiveUpdateDetector.manualCheck();
  };

  const handleUpdateApp = () => {
    const manager = UpdateManager.getInstance();
    manager.applyUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          App Updates
        </h3>
        {updateAvailable && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <Download className="w-3 h-3 mr-1" />
            Available
          </Badge>
        )}
      </div>

      {/* Version Info */}
      <div className="text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Version:</span>
          <span className="font-mono text-foreground">{versionInfo.version}</span>
        </div>
      </div>

      {/* Update Available Section */}
      {updateAvailable && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-4 h-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-green-800 dark:text-green-200 font-medium">New version ready!</p>
              <p className="text-green-700 dark:text-green-300 mt-1">
                An updated version with improvements is available.
              </p>
            </div>
          </div>
          <Button 
            onClick={handleUpdateApp}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
            size="sm"
            data-testid="button-update-app"
          >
            <Download className="w-4 h-4 mr-2" />
            Update Now
          </Button>
        </div>
      )}

      {/* Manual Check Section */}
      <div className="border-t border-border pt-4">
        <p className="text-sm text-muted-foreground mb-3">
          Keep your app up to date with the latest features and improvements.
        </p>
        <div className="flex space-x-2">
          <Button 
            onClick={handleCheckForUpdates}
            variant="outline"
            size="sm"
            className="flex-1 bg-background hover:bg-accent text-foreground border-border"
            data-testid="button-check-updates"
          >
            <Download className="w-4 h-4 mr-2" />
            Check for Updates
          </Button>
          <Button 
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="flex-1 bg-background hover:bg-accent text-foreground border-border"
            data-testid="button-force-refresh"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Force Refresh
              </>
            )}
          </Button>
        </div>
      </div>

    </div>
  );
}