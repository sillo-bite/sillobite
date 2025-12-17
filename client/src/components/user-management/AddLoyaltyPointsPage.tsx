import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Gift, Plus } from "lucide-react";
export default function AddLoyaltyPointsPage() {
  const [, setLocation] = useLocation();
  const [pointsData, setPointsData] = useState({
    userGroup: "all",
    points: "",
    reason: "",
    expiryDays: "365"
  });

  const userGroups = [
    { value: "all", label: "All Users" },
    { value: "students", label: "Students Only" },
    { value: "faculty", label: "Faculty Only" },
    { value: "staff", label: "Staff Only" },
    { value: "top-spenders", label: "Top Spenders" },
    { value: "frequent-users", label: "Frequent Users" }
  ];

  const handleAddPoints = () => {
    setLocation("/admin/user-management");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin/user-management")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Add Loyalty Points</h1>
              <p className="text-sm text-muted-foreground">Reward users with loyalty points</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gift className="w-5 h-5" />
                <span>Points Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userGroup">Select User Group</Label>
                <Select value={pointsData.userGroup} onValueChange={(value) => setPointsData(prev => ({ ...prev, userGroup: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose user group" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGroups.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="points">Points to Add</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="Enter points amount"
                  value={pointsData.points}
                  onChange={(e) => setPointsData(prev => ({ ...prev, points: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="reason">Reason for Points</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for awarding points..."
                  value={pointsData.reason}
                  onChange={(e) => setPointsData(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="expiryDays">Points Expiry (Days)</Label>
                <Select value={pointsData.expiryDays} onValueChange={(value) => setPointsData(prev => ({ ...prev, expiryDays: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiry period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">6 Months</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="never">Never Expire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Points Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Group:</span>
                  <div className="font-medium">{userGroups.find(g => g.value === pointsData.userGroup)?.label}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Points Per User:</span>
                  <div className="font-medium">{pointsData.points || "0"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Expiry:</span>
                  <div className="font-medium">
                    {pointsData.expiryDays === "never" ? "Never" : `${pointsData.expiryDays} days`}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Users:</span>
                  <div className="font-medium">~150 users</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setLocation("/admin/user-management")}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleAddPoints}
              disabled={!pointsData.points || !pointsData.reason}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Points</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}