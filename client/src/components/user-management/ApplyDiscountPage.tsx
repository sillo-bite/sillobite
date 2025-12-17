import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Percent, Tag } from "lucide-react";
export default function ApplyDiscountPage() {
  const [, setLocation] = useLocation();
  const [discountData, setDiscountData] = useState({
    userGroup: "all",
    discountType: "percentage",
    discountValue: "",
    validDays: "30",
    minOrderAmount: "",
    maxDiscountAmount: "",
    description: "",
    isActive: true
  });

  const userGroups = [
    { value: "all", label: "All Users" },
    { value: "students", label: "Students Only" },
    { value: "faculty", label: "Faculty Only" },
    { value: "staff", label: "Staff Only" },
    { value: "new-users", label: "New Users" },
    { value: "loyal-customers", label: "Loyal Customers" }
  ];

  const handleApplyDiscount = () => {
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
              <h1 className="text-2xl font-bold text-foreground">Apply Discount</h1>
              <p className="text-sm text-muted-foreground">Create discount offers for users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Tag className="w-5 h-5" />
                <span>Discount Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userGroup">Select User Group</Label>
                  <Select value={discountData.userGroup} onValueChange={(value) => setDiscountData(prev => ({ ...prev, userGroup: value }))}>
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
                  <Label htmlFor="discountType">Discount Type</Label>
                  <Select value={discountData.discountType} onValueChange={(value) => setDiscountData(prev => ({ ...prev, discountType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discountValue">
                    Discount Value {discountData.discountType === 'percentage' ? '(%)' : '(₹)'}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    placeholder={discountData.discountType === 'percentage' ? "e.g., 10" : "e.g., 50"}
                    value={discountData.discountValue}
                    onChange={(e) => setDiscountData(prev => ({ ...prev, discountValue: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="validDays">Valid For (Days)</Label>
                  <Select value={discountData.validDays} onValueChange={(value) => setDiscountData(prev => ({ ...prev, validDays: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select validity period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="15">15 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minOrderAmount">Minimum Order Amount (₹)</Label>
                  <Input
                    id="minOrderAmount"
                    type="number"
                    placeholder="e.g., 100"
                    value={discountData.minOrderAmount}
                    onChange={(e) => setDiscountData(prev => ({ ...prev, minOrderAmount: e.target.value }))}
                  />
                </div>

                {discountData.discountType === 'percentage' && (
                  <div>
                    <Label htmlFor="maxDiscountAmount">Maximum Discount Amount (₹)</Label>
                    <Input
                      id="maxDiscountAmount"
                      type="number"
                      placeholder="e.g., 200"
                      value={discountData.maxDiscountAmount}
                      onChange={(e) => setDiscountData(prev => ({ ...prev, maxDiscountAmount: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="description">Discount Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter discount description for users..."
                  value={discountData.description}
                  onChange={(e) => setDiscountData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={discountData.isActive}
                  onCheckedChange={(checked) => setDiscountData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Activate discount immediately</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Percent className="w-5 h-5" />
                <span>Discount Preview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Group:</span>
                  <div className="font-medium">{userGroups.find(g => g.value === discountData.userGroup)?.label}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Discount:</span>
                  <div className="font-medium">
                    {discountData.discountValue || "0"}{discountData.discountType === 'percentage' ? '%' : '₹'} OFF
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Validity:</span>
                  <div className="font-medium">{discountData.validDays} days</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Min Order:</span>
                  <div className="font-medium">₹{discountData.minOrderAmount || "0"}</div>
                </div>
                {discountData.discountType === 'percentage' && discountData.maxDiscountAmount && (
                  <div>
                    <span className="text-muted-foreground">Max Discount:</span>
                    <div className="font-medium">₹{discountData.maxDiscountAmount}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setLocation("/admin/user-management")}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleApplyDiscount}
              disabled={!discountData.discountValue}
              className="flex items-center space-x-2"
            >
              <Tag className="w-4 h-4" />
              <span>Create Discount</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}