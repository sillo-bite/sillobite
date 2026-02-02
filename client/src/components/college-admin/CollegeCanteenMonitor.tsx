import { useRoute, useLocation } from "wouter";
import CollegeAdminLayout from "./CollegeAdminLayout";
import { useCanteen } from "@/hooks/useCanteens";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, ShoppingBag, UtensilsCrossed, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function CollegeCanteenMonitor() {
    const [_, params] = useRoute("/college-admin/canteen/:id/monitor");
    const [__, setLocation] = useLocation();
    const canteenId = params?.id;

    const { data: canteen, isLoading, refetch } = useCanteen(canteenId);

    const { data: stats } = useQuery({
        queryKey: ['/api/canteen-analytics', canteenId, 'monitor'],
        queryFn: async () => {
            const res = await apiRequest(`/api/canteen-analytics/${canteenId}/monitor`);
            return res; // apiRequest returns parsed JSON
        },
        enabled: !!canteenId
    });

    const { data: menuStats } = useQuery({
        queryKey: ['/api/canteen-analytics', canteenId, 'menu-stats'],
        queryFn: async () => {
            const res = await apiRequest(`/api/canteen-analytics/${canteenId}/menu-stats`);
            return res;
        },
        enabled: !!canteenId
    });

    if (isLoading) {
        return (
            <CollegeAdminLayout>
                <div className="flex items-center justify-center h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </CollegeAdminLayout>
        );
    }

    if (!canteen) {
        return (
            <CollegeAdminLayout>
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold">Canteen Not Found</h2>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setLocation("/college-admin/canteens")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Canteens
                    </Button>
                </div>
            </CollegeAdminLayout>
        );
    }



    return (
        <CollegeAdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setLocation("/college-admin/canteens")}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h2 className="text-3xl font-bold tracking-tight">{canteen.name} Monitor</h2>
                        </div>
                        <p className="text-muted-foreground ml-10">
                            Real-time monitoring and analytics
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Badge variant={canteen.isActive ? "default" : "secondary"} className="h-8 px-3">
                            {canteen.isActive ? "Live" : "Offline"}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Active Orders
                            </CardTitle>
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.activeOrders ?? "--"}</div>
                            <p className="text-xs text-muted-foreground">
                                Orders in preparation
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Menu Items
                            </CardTitle>
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalMenuItems ?? "--"}</div>
                            <p className="text-xs text-muted-foreground">
                                Active items listed
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Today's Revenue
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹{stats?.todayRevenue ?? "--"}</div>
                            <p className="text-xs text-muted-foreground">
                                Sales generated today
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Staff Active
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.activeStaff ?? "--"}</div>
                            <p className="text-xs text-muted-foreground">
                                Staff currently online
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="live-orders">Live Orders</TabsTrigger>
                        <TabsTrigger value="menu">Menu Analysis</TabsTrigger>
                        <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity Overview</CardTitle>
                                <CardDescription>
                                    Summary of today's operational metrics.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                                Charts and detailed analytics will appear here.
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="live-orders">
                        <Card>
                            <CardHeader>
                                <CardTitle>Live Order Feed</CardTitle>
                                <CardDescription>
                                    Real-time stream of incoming orders.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                                Live order list placeholder.
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="menu">
                        <Card>
                            <CardHeader>
                                <CardTitle>Menu Performance</CardTitle>
                                <CardDescription>
                                    Top items by availability and status.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {!menuStats?.items?.length ? (
                                        <div className="text-center text-muted-foreground py-8">No menu items found.</div>
                                    ) : (
                                        <div className="border rounded-md">
                                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
                                                <div className="w-10"></div>
                                                <div>Item Name</div>
                                                <div className="text-right">Price</div>
                                                <div className="text-center">Stock</div>
                                                <div className="text-right">Status</div>
                                            </div>
                                            <div className="max-h-[400px] overflow-y-auto">
                                                {menuStats.items.map((item: any) => (
                                                    <div key={item._id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 p-4 border-b last:border-0 text-sm hover:bg-muted/30 items-center">
                                                        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                                            {item.imageUrl ? (
                                                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <UtensilsCrossed className="h-5 w-5 text-muted-foreground/50" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{item.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {item.isVegetarian ? "Veg" : "Non-Veg"}
                                                                {item.isTrending && " • Trending"}
                                                            </span>
                                                        </div>
                                                        <div className="text-right my-auto">₹{item.price}</div>
                                                        <div className="text-center my-auto">
                                                            <Badge variant={item.stock > 10 ? "outline" : "secondary"}>
                                                                {item.stock ?? 0}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-right my-auto">
                                                            <Badge variant={item.available ? "default" : "destructive"}>
                                                                {item.available ? "Available" : "Unavailable"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </CollegeAdminLayout>
    );
}
