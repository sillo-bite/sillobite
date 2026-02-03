import CollegeAdminLayout from "./CollegeAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCanteensByCollege, useUpdateCanteen, type Canteen } from "@/hooks/useCanteens";
import { useAuthSync } from "@/hooks/useDataSync";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Utensils, MapPin, Phone, Clock, Activity, Settings, Edit, Save } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function CollegeCanteensPage() {
    const { user, isAdmin } = useAuthSync();
    const [_, setLocation] = useLocation();
    const { toast } = useToast();
    const updateCanteenMutation = useUpdateCanteen();

    // Edit state
    const [editingCanteen, setEditingCanteen] = useState<Canteen | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        isActive: boolean;
        description: string;
        contactNumber: string;
    }>({
        name: "",
        isActive: true,
        description: "",
        contactNumber: ""
    });

    // Fetch college details again (cached by React Query) to get the correct college ID
    // This pairs with the query in CollegeAdminLayout
    const { data: collegeData } = useQuery({
        queryKey: ['/api/system-settings/admin/my-college'],
        queryFn: async () => {
            const data = await apiRequest('/api/system-settings/admin/my-college');
            return data;
        },
        enabled: !!user?.email && (isAdmin || user?.role === 'SUPER_ADMIN')
    });

    const collegeId = collegeData?.college?.id;

    // Use the specialized hook to filter by college on the server/hook side
    const { data: canteensData, isLoading } = useCanteensByCollege(collegeId);

    // Extract canteens safeley
    const collegeCanteens = canteensData?.canteens || [];

    // Prioritize active canteens in display
    const sortedCanteens = [...collegeCanteens].sort((a, b) => {
        if (a.isActive === b.isActive) return 0;
        return a.isActive ? -1 : 1;
    });

    const handleEditClick = (canteen: Canteen) => {
        setEditingCanteen(canteen);
        setEditForm({
            name: canteen.name,
            isActive: canteen.isActive,
            description: canteen.description || "",
            contactNumber: canteen.contactNumber || ""
        });
    };

    const handleSaveEdit = () => {
        if (!editingCanteen) return;

        updateCanteenMutation.mutate({
            id: editingCanteen.id,
            name: editForm.name,
            isActive: editForm.isActive,
            description: editForm.description,
            contactNumber: editForm.contactNumber
        }, {
            onSuccess: () => {
                toast({
                    title: "Success",
                    description: "Canteen updated successfully",
                });
                setEditingCanteen(null);
            },
            onError: (error) => {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to update canteen",
                });
            }
        });
    };

    const handleMonitorClick = (canteenId: string) => {
        setLocation(`/college-admin/canteen/${canteenId}/monitor`);
    };

    return (
        <CollegeAdminLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Canteens</h2>
                    <p className="text-muted-foreground">
                        Overview of canteens serving your college.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground mt-4">Loading canteens...</p>
                    </div>
                ) : sortedCanteens.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No canteens found associated with this college.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {sortedCanteens.map((canteen) => (
                            <Card key={canteen.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex items-center space-x-2">
                                            <Utensils className="h-5 w-5 text-primary" />
                                            <span>{canteen.name}</span>
                                        </span>
                                        <Badge variant={canteen.isActive ? "default" : "secondary"}>
                                            {canteen.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center space-x-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span>{canteen.location || "No location provided"}</span>
                                        </div>
                                        {canteen.contactNumber && (
                                            <div className="flex items-center space-x-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{canteen.contactNumber}</span>
                                            </div>
                                        )}
                                        <div className="flex items-start space-x-2">
                                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <p>Open: {canteen.operatingHours?.open || "--"}</p>
                                                <p>Close: {canteen.operatingHours?.close || "--"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex gap-2 border-t p-4 bg-muted/20">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleEditClick(canteen)}
                                    >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleMonitorClick(canteen.id)}
                                    >
                                        <Activity className="h-4 w-4 mr-2" />
                                        Monitor
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Edit Dialog */}
                <Dialog open={!!editingCanteen} onOpenChange={(open) => !open && setEditingCanteen(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Canteen</DialogTitle>
                            <DialogDescription>
                                Make changes to the canteen details here. Click save when you're done.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="name"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contact" className="text-right">
                                    Contact
                                </Label>
                                <Input
                                    id="contact"
                                    value={editForm.contactNumber}
                                    onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    Desc
                                </Label>
                                <Input
                                    id="description"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="active" className="text-right">
                                    Active
                                </Label>
                                <div className="col-span-3 flex items-center space-x-2">
                                    <Switch
                                        id="active"
                                        checked={editForm.isActive}
                                        onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                                    />
                                    <Label htmlFor="active" className="font-normal text-muted-foreground">
                                        {editForm.isActive ? "Canteen is visible to users" : "Canteen is hidden"}
                                    </Label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingCanteen(null)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={updateCanteenMutation.isPending}>
                                {updateCanteenMutation.isPending ? "Saving..." : "Save changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </CollegeAdminLayout>
    );
}
