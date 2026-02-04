import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Trash2, GripVertical, Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from "@hello-pangea/dnd";

interface Banner {
    id: string;
    originalName: string;
    cloudinaryUrl: string;
    isActive: boolean;
    displayOrder: number;
    mimeType: string;
}

interface CanteenAdminBannerManagementProps {
    canteenId: string;
}

export default function CanteenAdminBannerManagement({ canteenId }: CanteenAdminBannerManagementProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Fetch banners
    const { data: banners, isLoading } = useQuery<Banner[]>({
        queryKey: ['/api/media-banners/canteen', canteenId],
        queryFn: () => apiRequest(`/api/media-banners/canteen/${canteenId}`),
    });

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('canteenId', canteenId);
            formData.append('file', file);

            const res = await fetch('/api/media-banners', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to upload banner');
            }

            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/media-banners/canteen', canteenId] });
            toast({
                title: "Success",
                description: "Banner uploaded successfully",
            });
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
            setIsUploading(false);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest(`/api/media-banners/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/media-banners/canteen', canteenId] });
            toast({
                title: "Success",
                description: "Banner deleted successfully",
            });
        },
    });

    // Toggle active mutation
    const toggleMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest(`/api/media-banners/${id}/toggle`, { method: 'PUT' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/media-banners/canteen', canteenId] });
        },
    });

    // Reorder mutation
    const reorderMutation = useMutation({
        mutationFn: async (bannerIds: string[]) => {
            await apiRequest('/api/media-banners/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bannerIds }),
            });
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Banners reordered successfully",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/media-banners/canteen', canteenId] });
        },
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Please upload an image or video file",
            });
            return;
        }

        setIsUploading(true);
        uploadMutation.mutate(file);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !banners) return;

        const items = Array.from(banners);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Optimistically update cache? No, just wait for invalidate
        // Actually better to optimistically update or just trigger mutation
        reorderMutation.mutate(items.map(b => b.id));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Media Banners</CardTitle>
                            <CardDescription>
                                Manage promotional banners displayed on the canteen home page
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="gap-2"
                        >
                            {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            Upload Banner
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {banners && banners.length > 0 ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="banners">
                            {(provided: DroppableProvided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="space-y-3"
                                >
                                    {banners.map((banner, index) => (
                                        <Draggable key={banner.id} draggableId={banner.id} index={index}>
                                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`flex items-center justify-between p-3 border rounded-lg bg-card ${snapshot.isDragging ? 'shadow-md ring-2 ring-primary/20' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div
                                                            {...provided.dragHandleProps}
                                                            className="p-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                                        >
                                                            <GripVertical className="h-5 w-5" />
                                                        </div>

                                                        <div className="relative w-24 h-14 rounded-md overflow-hidden bg-muted">
                                                            {banner.mimeType.startsWith('video/') ? (
                                                                <video src={banner.cloudinaryUrl} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img
                                                                    src={banner.cloudinaryUrl}
                                                                    alt={banner.originalName}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            )}
                                                        </div>

                                                        <div>
                                                            <p className="font-medium text-sm truncate max-w-[200px]">
                                                                {banner.originalName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {banner.isActive ? 'Active' : 'Inactive'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => toggleMutation.mutate(banner.id)}
                                                            title={banner.isActive ? "Hide banner" : "Show banner"}
                                                        >
                                                            {banner.isActive ? (
                                                                <Eye className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                            )}
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                if (confirm('Are you sure you want to delete this banner?')) {
                                                                    deleteMutation.mutate(banner.id)
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No banners uploaded yet</p>
                        <p className="text-sm">Upload images or videos to display on the home page</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
