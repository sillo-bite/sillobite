import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    QrCode,
    Download,
    Share2,
    Copy,
    Printer,
    Plus,
    Trash2,
    ExternalLink,
    MapPin,
    Utensils,
    Smartphone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function CanteenOwnerQRManager() {
    const [activeTab, setActiveTab] = useState("general");

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        QR Manager
                    </h2>
                    <p className="text-muted-foreground">
                        Manage, customize, and track QR codes for your canteen ecosystem.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Preview Scanner
                    </Button>
                    <Button size="sm" className="h-9 shadow-md transition-all hover:shadow-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Custom QR
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="counters">Counters</TabsTrigger>
                    <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                </TabsList>

                {/* General Tab - Main Canteen QRs */}
                <TabsContent value="general" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Primary Canteen QR */}
                        <Card className="overflow-hidden border-primary/20 shadow-sm hover:border-primary/50 transition-all duration-300 group">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Utensils className="h-4 w-4 text-primary" />
                                            Main Menu QR
                                        </CardTitle>
                                        <CardDescription>Direct link to your full menu</CardDescription>
                                    </div>
                                    <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                                        Active
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex flex-col items-center justify-center space-y-6">
                                <div className="relative p-4 bg-white rounded-xl shadow-inner border border-border/50 group-hover:shadow-md transition-all">
                                    {/* Placeholder for actual QR */}
                                    <div className="w-48 h-48 bg-neutral-100 rounded-lg flex items-center justify-center">
                                        <QrCode className="h-24 w-24 text-neutral-300" />
                                    </div>
                                </div>
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Scans this month</span>
                                        <span className="font-medium">1,234</span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[70%]" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-4 flex justify-between gap-2">
                                <Button variant="ghost" size="sm" className="flex-1">
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-1">
                                    <Download className="mr-2 h-4 w-4" /> Save
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-1">
                                    <Share2 className="mr-2 h-4 w-4" /> Share
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Table/Location QR */}
                        <Card className="overflow-hidden shadow-sm hover:border-primary/50 transition-all duration-300 group">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-orange-500" />
                                            Table Ordering
                                        </CardTitle>
                                        <CardDescription>Generate codes for tables</CardDescription>
                                    </div>
                                    <Badge variant="outline">Setup Required</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Table Quantity</Label>
                                        <Input type="number" placeholder="e.g., 10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Prefix (Optional)</Label>
                                        <Input placeholder="e.g., T-" />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch id="auto-print" />
                                        <Label htmlFor="auto-print">Auto-generate PDF for printing</Label>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-4">
                                <Button className="w-full">Generate Table Codes</Button>
                            </CardFooter>
                        </Card>

                        {/* App Download QR */}
                        <Card className="overflow-hidden shadow-sm hover:border-primary/50 transition-all duration-300 group">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Smartphone className="h-4 w-4 text-blue-500" />
                                            App Download
                                        </CardTitle>
                                        <CardDescription>Link to install the PWA/App</CardDescription>
                                    </div>
                                    <Badge variant="secondary">Static</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex flex-col items-center justify-center space-y-6">
                                <div className="w-full p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg flex flex-col items-center justify-center gap-2 text-center py-8">
                                    <Download className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="text-sm text-muted-foreground">Universal download link</p>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-4 flex justify-between gap-2">
                                <Button variant="ghost" size="sm" className="flex-1">
                                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-1">
                                    <Download className="mr-2 h-4 w-4" /> PNG
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                {/* Counters Tab */}
                <TabsContent value="counters" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Counter-Specific QR Codes</CardTitle>
                            <CardDescription>
                                Direct customers to specific counters. Useful for large canteens with multiple stalls.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <div className="p-4 text-center text-muted-foreground py-12">
                                    <p>Select counters to generate specific QR codes.</p>
                                    <Button variant="outline" className="mt-4">Load Counters</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Campaigns Tab */}
                <TabsContent value="campaigns" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle>Marketing Campaigns</CardTitle>
                                <CardDescription>
                                    Trackable QR codes for flyers, social media, and events.
                                </CardDescription>
                            </div>
                            <Button size="sm">New Campaign</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <div className="p-4 text-center text-muted-foreground py-12">
                                    <p>No active campaigns found.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
