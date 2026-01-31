import CollegeAdminLayout from "./CollegeAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCanteensByCollege, type Canteen } from "@/hooks/useCanteens";
import { useAuthSync } from "@/hooks/useDataSync";
import { Utensils, MapPin, Phone, Clock } from "lucide-react";

export default function CollegeCanteensPage() {
    const { user } = useAuthSync();

    // Use the specialized hook to filter by college on the server/hook side
    const { data: canteensData, isLoading } = useCanteensByCollege(user?.organizationId);

    // Extract canteens safely
    const collegeCanteens = canteensData?.canteens || [];

    // Prioritize active canteens in display
    const sortedCanteens = [...collegeCanteens].sort((a, b) => {
        if (a.isActive === b.isActive) return 0;
        return a.isActive ? -1 : 1;
    });

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
                            <Card key={canteen.id}>
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
                                <CardContent>
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
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </CollegeAdminLayout>
    );
}
