import { useState } from "react";
import { Flame, Zap } from "lucide-react";
import { OwnerPageLayout, OwnerTabs, OwnerTabList, OwnerTab } from "@/components/owner";
import { TrendingConfigPanel } from "./TrendingConfigPanel";
import { QuickPickConfigPanel } from "./QuickPickConfigPanel";

interface ContentManagerProps {
  canteenId?: string;
}

export default function ContentManager({ canteenId }: ContentManagerProps) {
  const [activeTab, setActiveTab] = useState<"trending" | "quickpicks">("trending");

  return (
    <OwnerPageLayout>
      <OwnerTabs value={activeTab} onValueChange={(v) => setActiveTab(v as "trending" | "quickpicks")}>
        <OwnerTabList>
          <OwnerTab value="trending" icon={<Flame className="w-4 h-4" />}>
            Trending Items
          </OwnerTab>
          <OwnerTab value="quickpicks" icon={<Zap className="w-4 h-4" />}>
            Quick Picks
          </OwnerTab>
        </OwnerTabList>

        {/* Single shared content container - only one panel rendered at a time */}
        <div className="content-manager-tab-content flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === "trending" ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TrendingConfigPanel canteenId={canteenId} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <QuickPickConfigPanel canteenId={canteenId} />
            </div>
          )}
        </div>
      </OwnerTabs>
    </OwnerPageLayout>
  );
}

