import CollegeAdminLayout from "./CollegeAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CollegeSettingsPage() {
    return (
        <CollegeAdminLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground">
                        Manage your college settings and preferences.
                    </p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>College Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Settings configuration will be available here.</p>
                    </CardContent>
                </Card>
            </div>
        </CollegeAdminLayout>
    );
}
