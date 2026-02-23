import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Download, Share2, Plus, Loader2, Trash2, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";

interface CanteenOwnerQRManagerProps {
    canteenId?: string;
}

export default function CanteenOwnerQRManager({ canteenId }: CanteenOwnerQRManagerProps) {
    const queryClient = useQueryClient();
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (url: string, id: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Fetch canteen details to know which locations it serves
    const { data: canteen, isLoading: isLoadingCanteen } = useQuery({
        queryKey: ['canteen-details', canteenId],
        queryFn: async () => {
            const res = await fetch(`/api/system-settings/canteens/${canteenId}`);
            if (!res.ok) throw new Error('Failed to fetch canteen');
            return res.json();
        },
        enabled: !!canteenId
    });

    // Fetch master list of colleges to get names
    const { data: colleges = [] } = useQuery({
        queryKey: ['admin-colleges'],
        queryFn: async () => {
            const res = await fetch('/api/system-settings/colleges');
            if (!res.ok) throw new Error('Failed to fetch colleges');
            const data = await res.json();
            return data.colleges || data.list || [];
        }
    });

    // Fetch master list of organizations to get names
    const { data: organizations = [] } = useQuery({
        queryKey: ['admin-organizations'],
        queryFn: async () => {
            const res = await fetch('/api/system-settings/organizations');
            if (!res.ok) return []; // Might not exist yet
            const data = await res.json();
            return data.organizations || data.list || [];
        }
    });

    // Fetch generated location QRs
    const { data: qrCodes = [], isLoading: isLoadingQRs } = useQuery({
        queryKey: ['canteen-qrs', canteenId],
        queryFn: async () => {
            const res = await fetch(`/api/system-settings/canteens/${canteenId}/qr/location`);
            if (!res.ok) throw new Error('Failed to fetch QRs');
            return res.json();
        },
        enabled: !!canteenId
    });

    const generateQRMutation = useMutation({
        mutationFn: async (locationData: { type: string, id: string }) => {
            const res = await fetch(`/api/system-settings/canteens/${canteenId}/qr/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationType: locationData.type,
                    locationId: locationData.id
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to generate QR');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['canteen-qrs', canteenId] });
            setSelectedLocation('');
        }
    });

    const deleteQRMutation = useMutation({
        mutationFn: async (qrId: string) => {
            const res = await fetch(`/api/system-settings/canteens/${canteenId}/qr/location/${qrId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete QR');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['canteen-qrs', canteenId] });
        }
    });

    const handleGenerateQR = () => {
        if (!selectedLocation) return;

        const [type, id] = selectedLocation.split(':');
        generateQRMutation.mutate({ type, id });
    };

    const handleDownload = (qrCodeUrl: string, qrId: string) => {
        const canvas = document.getElementById(`qr-${qrId}`) as HTMLCanvasElement;
        if (!canvas) return;

        const downloadWithComposition = () => {
            const composedCanvas = document.createElement('canvas');
            composedCanvas.width = canvas.width;
            composedCanvas.height = canvas.height;
            const ctx = composedCanvas.getContext('2d');
            if (!ctx) return;

            // Draw original QR Code
            ctx.drawImage(canvas, 0, 0);

            // Try drawing Logo if available
            const logoImg = document.getElementById('canteen-logo-hidden') as HTMLImageElement;
            if (canteen?.logoUrl && logoImg && logoImg.complete) {
                const logoSize = canvas.width * 0.22; // 22% of QR width
                const center = canvas.width / 2;
                const logoXY = center - logoSize / 2;

                // Draw white circular cutout background
                ctx.beginPath();
                ctx.arc(center, center, (logoSize / 2) + ((canvas.width / 32) * 1.2), 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();

                // Draw circular logo image
                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
                ctx.clip();

                try {
                    ctx.drawImage(logoImg, logoXY, logoXY, logoSize, logoSize);
                } catch (e) {
                    console.error("CORS issue drawing logo:", e);
                }
                ctx.restore();
            }

            try {
                const url = composedCanvas.toDataURL("image/png");
                const a = document.createElement('a');
                a.href = url;
                a.download = `canteen-qr-${qrId}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (error) {
                console.error("Error creating data URL:", error);
                alert("Failed to download image. This could be due to a CORS issue from the image server.");
            }
        };

        downloadWithComposition();
    };

    // Combine available locations based on canteen data
    const availableLocations: { type: string, id: string, name: string }[] = [];
    if (canteen?.collegeIds && canteen.collegeIds.length > 0) {
        canteen.collegeIds.forEach((id: string) => {
            const college = colleges.find((c: any) => c.id === id);
            if (college) {
                availableLocations.push({ type: 'college', id, name: college.name });
            }
        });
    } else if (canteen?.collegeId) {
        const college = colleges.find((c: any) => c.id === canteen.collegeId);
        if (college) {
            availableLocations.push({ type: 'college', id: canteen.collegeId, name: college.name });
        }
    }

    if (canteen?.organizationIds && canteen.organizationIds.length > 0) {
        canteen.organizationIds.forEach((id: string) => {
            const org = organizations.find((o: any) => o.id === id);
            if (org) {
                availableLocations.push({ type: 'organization', id, name: org.name });
            }
        });
    } else if (canteen?.organizationId) {
        const org = organizations.find((o: any) => o.id === canteen.organizationId);
        if (org) {
            availableLocations.push({ type: 'organization', id: canteen.organizationId, name: org.name });
        }
    }

    if (!canteenId) {
        return <div>Loading Canteen Environment...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto pb-10 pr-2">
            {canteen?.logoUrl && (
                <img id="canteen-logo-hidden" src={canteen.logoUrl} crossOrigin="anonymous" style={{ display: 'none' }} alt="" />
            )}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Landing QRs
                    </h2>
                    <p className="text-muted-foreground">
                        Generate and manage location-specific QR codes. Customers who scan these will automatically be linked to your canteen within their campus context.
                    </p>
                </div>
            </div>

            <Card className="border-primary/20 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        Generate New Location QR
                    </CardTitle>
                    <CardDescription>Select a college or organization your canteen serves to generate a dedicated QR code.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full sm:w-72 space-y-2">
                            <label className="text-sm font-medium">Target Location</label>
                            <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLoadingCanteen}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingCanteen ? "Loading..." : "Select a location"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableLocations.map(loc => (
                                        <SelectItem key={`${loc.type}:${loc.id}`} value={`${loc.type}:${loc.id}`}>
                                            {loc.type === 'college' ? '🎓 ' : '🏢 '} {loc.name}
                                        </SelectItem>
                                    ))}
                                    {availableLocations.length === 0 && !isLoadingCanteen && (
                                        <SelectItem value="none" disabled>No locations configured for this canteen</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleGenerateQR}
                            disabled={!selectedLocation || selectedLocation === 'none' || generateQRMutation.isPending}
                        >
                            {generateQRMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            Generate QR
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                {isLoadingQRs ? (
                    <div className="col-span-full flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : qrCodes.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                        <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No QR codes generated yet.</p>
                        <p className="text-sm">Select a location above to create one.</p>
                    </div>
                ) : (
                    qrCodes.map((qr: any) => (
                        <Card key={qr.qrId} className="overflow-hidden shadow-sm hover:border-primary/50 transition-all duration-300 group">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base flex items-center gap-2 pr-2">
                                            {qr.locationType === 'college' ? '🎓' : '🏢'}
                                            <span className="truncate" title={availableLocations.find(l => l.id === qr.locationId)?.name || qr.locationId}>
                                                {availableLocations.find(l => l.id === qr.locationId)?.name || qr.locationId}
                                            </span>
                                        </CardTitle>
                                        <CardDescription className="text-xs">ID: {qr.qrId}</CardDescription>
                                    </div>
                                    <Badge variant="default" className="bg-primary/10 text-primary whitespace-nowrap">
                                        Active
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
                                <div className="relative p-3 bg-white rounded-xl shadow-inner border border-border/50 group-hover:shadow-md transition-all flex items-center justify-center">
                                    <QRCodeCanvas
                                        id={`qr-${qr.qrId}`}
                                        value={qr.qrCodeUrl}
                                        size={256}
                                        level={"H"}
                                        className="w-40 h-40"
                                        includeMargin={true}
                                    />
                                    {canteen?.logoUrl && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-white rounded-full flex items-center justify-center pt-px pl-px" style={{ width: '22%', height: '22%' }}>
                                                <img
                                                    src={canteen.logoUrl}
                                                    className="w-[90%] h-[90%] rounded-full object-cover"
                                                    alt="Logo"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full flex items-center justify-center gap-1 group/link max-w-full px-2">
                                    <p className="text-xs text-muted-foreground truncate max-w-[80%]" title={qr.qrCodeUrl}>
                                        {qr.qrCodeUrl}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleCopy(qr.qrCodeUrl, qr.qrId)}
                                    >
                                        {copiedId === qr.qrId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-3 flex justify-between gap-2">
                                <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleDownload(qr.qrCodeUrl, qr.qrId)}>
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-none text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteQRMutation.mutate(qr.qrId)} disabled={deleteQRMutation.isPending}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
