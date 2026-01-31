import CollegeAdminLayout from "./CollegeAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CollegeReportsPage() {
    return (
        <CollegeAdminLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                    <p className="text-muted-foreground">
                        View detailed reports and analytics for your college.
                    </p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Coming Soon</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Detailed reports will be available here.</p>
                    </CardContent>
                </Card>
            </div>
        </CollegeAdminLayout>
    );
}
