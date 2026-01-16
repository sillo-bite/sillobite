import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, Image, Video, Plus, 
  Trash2, Eye, Upload, Search, X, Loader2, Play, Pause, CheckCircle, XCircle, Clock, RefreshCw,
  Filter, Grid3x3, List, FileImage, FileVideo
} from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import { useTriggerBasedUpdates } from "@/hooks/useTriggerBasedUpdates";
import type { MediaBanner } from "@shared/schema";

export default function AdminContentManagementPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuthSync();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dialog states for media management
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaBanner | null>(null);
  
  // Multiple file upload state
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: { name: string; status: 'waiting' | 'uploading' | 'success' | 'error'; error?: string }
  }>({});
  const [isMultipleUpload, setIsMultipleUpload] = useState(false);

  // Trigger-based updates instead of SSE
  const { triggerBannerRefresh } = useTriggerBasedUpdates();

  // Fetch media banners (admin view - all banners)
  const { data: mediaData = [], isLoading: mediaLoading, refetch: refetchMedia } = useQuery<MediaBanner[]>({
    queryKey: ['/api/media-banners', 'admin'],
    queryFn: async () => {
      const response = await fetch('/api/media-banners?admin=true');
      if (!response.ok) {
        throw new Error('Failed to fetch media banners');
      }
      return response.json();
    },
    staleTime: 1000 * 30, // 30 seconds for real-time updates
    refetchOnMount: true,
  });

  // Upload media mutation
  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (user?.id) {
        formData.append('uploadedBy', user.id.toString());
      }

      const response = await fetch('/api/media-banners', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both admin and user queries for comprehensive updates
      queryClient.invalidateQueries({ queryKey: ['/api/media-banners'] });
      },
    onError: (error: Error) => {
      },
  });

  // Delete media mutation
  const deleteMediaMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      const response = await fetch(`/api/media-banners/${bannerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media-banners'] });
      setDeleteDialogOpen(false);
      },
    onError: (error: Error) => {
      },
  });

  // Toggle media status mutation
  const toggleMediaMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      const response = await fetch(`/api/media-banners/${bannerId}/toggle`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Toggle failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media-banners'] });
      },
    onError: (error: Error) => {
      },
  });

  // Update display mode mutation
  const updateDisplayModeMutation = useMutation({
    mutationFn: async ({ bannerId, displayMode }: { bannerId: string; displayMode: 'fit' | 'fill' }) => {
      const response = await fetch(`/api/media-banners/${bannerId}/display-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayMode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }

      const result = await response.json();
      return result;
    },
    onMutate: async ({ bannerId, displayMode }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/media-banners', 'admin'] });

      // Snapshot the previous value
      const previousBanners = queryClient.getQueryData(['/api/media-banners', 'admin']);

      // Optimistically update to the new value
      queryClient.setQueryData(['/api/media-banners', 'admin'], (old: any) => {
        if (!old) return old;
        return old.map((banner: any) => 
          banner.id === bannerId 
            ? { ...banner, displayMode } 
            : banner
        );
      });

      // Return a context object with the snapshotted value
      return { previousBanners };
    },
    onSuccess: (data, variables) => {
      // Update the cache with the server response
      queryClient.setQueryData(['/api/media-banners', 'admin'], (old: any) => {
        if (!old) return old;
        return old.map((banner: any) => 
          banner.id === variables.bannerId 
            ? { ...banner, ...data } 
            : banner
        );
      });
      triggerBannerRefresh();
    },
    onError: (error: Error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousBanners) {
        queryClient.setQueryData(['/api/media-banners', 'admin'], context.previousBanners);
      }
    },
    onSettled: () => {
      // Refetch after mutation completes (success or error)
      queryClient.invalidateQueries({ queryKey: ['/api/media-banners', 'admin'] });
    },
  });

  // File upload handlers
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Validate all files first
    const invalidFiles = fileArray.filter(file => 
      !file.type.startsWith('image/') && !file.type.startsWith('video/') ||
      file.size > 50 * 1024 * 1024
    );

    if (invalidFiles.length > 0) {
      // Filter out invalid files and continue with valid ones
      const validFiles = fileArray.filter(file => 
        (file.type.startsWith('image/') || file.type.startsWith('video/')) &&
        file.size <= 50 * 1024 * 1024
      );
      
      if (validFiles.length === 0) {
        if (event.target) {
          event.target.value = '';
        }
        return;
      }
    }

    const validFiles = fileArray.filter(file => 
      (file.type.startsWith('image/') || file.type.startsWith('video/')) &&
      file.size <= 50 * 1024 * 1024
    );

    if (validFiles.length === 1) {
      // Single file upload - use existing logic
      uploadMediaMutation.mutate(validFiles[0]);
    } else {
      // Multiple file upload - handle sequentially
      await handleMultipleFileUpload(validFiles);
    }
    
    // Reset the input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleMultipleFileUpload = async (files: File[]) => {
    setIsMultipleUpload(true);
    
    // Initialize progress state
    const initialProgress: typeof uploadProgress = {};
    files.forEach((file, index) => {
      initialProgress[`${index}-${file.name}`] = {
        name: file.name,
        status: 'waiting'
      };
    });
    setUploadProgress(initialProgress);

    let successCount = 0;
    let errorCount = 0;

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileKey = `${i}-${file.name}`;
      
      // Update status to uploading
      setUploadProgress(prev => ({
        ...prev,
        [fileKey]: { ...prev[fileKey], status: 'uploading' }
      }));

      try {
        // Create FormData for this file
        const formData = new FormData();
        formData.append('file', file);
        if (user?.id) {
          formData.append('uploadedBy', user.id.toString());
        }

        const response = await fetch('/api/media-banners', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }

        // Update status to success
        setUploadProgress(prev => ({
          ...prev,
          [fileKey]: { ...prev[fileKey], status: 'success' }
        }));
        successCount++;
      } catch (error) {
        // Update status to error
        setUploadProgress(prev => ({
          ...prev,
          [fileKey]: { 
            ...prev[fileKey], 
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          }
        }));
        errorCount++;
      }
    }

    // Show final result
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/media-banners'] });
    }
    
    // Clear progress after a delay
    setTimeout(() => {
      setUploadProgress({});
      setIsMultipleUpload(false);
    }, 3000);
  };

  // Button handlers for media
  const handleView = (item: MediaBanner) => {
    setSelectedItem(item);
    setViewDialogOpen(true);
  };

  const handleDelete = (item: MediaBanner) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedItem?.id) {
      deleteMediaMutation.mutate(selectedItem.id);
    }
  };

  // Filter media based on search, status, and type
  const filteredMedia = mediaData.filter((item: MediaBanner) => {
    const matchesSearch = (item.originalName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const renderMediaGrid = () => {
    if (mediaLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <span className="text-muted-foreground">Loading media files...</span>
        </div>
      );
    }

    if (filteredMedia.length === 0 && !searchTerm && statusFilter === 'all' && typeFilter === 'all') {
      return (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Image className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No media files uploaded yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Upload images and videos to display as banners</p>
          <Button 
            onClick={handleFileSelect}
            className="bg-primary hover:bg-primary/90"
            disabled={uploadMediaMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadMediaMutation.isPending ? 'Uploading...' : 'Upload Media'}
          </Button>
        </div>
      );
    }

    if (filteredMedia.length === 0) {
      return (
        <div className="text-center py-16">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No media files found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {item.type === 'video' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                    <div className="text-center">
                      <Video className="h-12 w-12 text-primary mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Video File</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.cloudinaryUrl || `/api/media-banners/${item.fileId}/file`}
                    alt={item.originalName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleView(item)}
                    className="h-8"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleMediaMutation.mutate(item.id)}
                    disabled={toggleMediaMutation.isPending}
                    className="h-8"
                  >
                    {item.isActive ? (
                      <Pause className="h-3 w-3 mr-1" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    {item.isActive ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    className="h-8"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm line-clamp-2 flex-1">{item.originalName}</h4>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{Math.round(item.size / 1024)} KB</span>
                    <span className="text-muted-foreground/60">•</span>
                    <span>Order: {item.displayOrder}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Display:</span>
                    <div className="flex gap-1">
                      <Button
                        variant={item.displayMode === 'fit' ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => updateDisplayModeMutation.mutate({ bannerId: item.id, displayMode: 'fit' })}
                        disabled={updateDisplayModeMutation.isPending}
                      >
                        Fit
                      </Button>
                      <Button
                        variant={item.displayMode === 'fill' || !item.displayMode ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => updateDisplayModeMutation.mutate({ bannerId: item.id, displayMode: 'fill' })}
                        disabled={updateDisplayModeMutation.isPending}
                      >
                        Fill
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    } else {
      // List view
      return (
        <div className="space-y-3">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="hover:bg-muted/50 transition-colors">
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-16 bg-muted rounded-md overflow-hidden shrink-0">
                    {item.type === 'video' ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                        <Video className="h-6 w-6 text-primary" />
                      </div>
                    ) : (
                      <img
                        src={item.cloudinaryUrl || `/api/media-banners/${item.fileId}/file`}
                        alt={item.originalName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{item.originalName}</h4>
                      <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{Math.round(item.size / 1024)} KB</span>
                      <span>•</span>
                      <span>{item.mimeType}</span>
                      <span>•</span>
                      <span>Order: {item.displayOrder}</span>
                      {item.uploadedBy && (
                        <>
                          <span>•</span>
                          <span>Uploaded by: User {item.uploadedBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleView(item)}
                      title="View Media"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleMediaMutation.mutate(item.id)}
                      disabled={toggleMediaMutation.isPending}
                      title={item.isActive ? "Deactivate" : "Activate"}
                    >
                      {item.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(item)}
                      title="Delete Media"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/admin")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Content Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage media banners displayed throughout the application
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={triggerBannerRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleFileSelect}
              disabled={uploadMediaMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMediaMutation.isPending ? 'Uploading...' : 'Upload Media'}
            </Button>
          </div>
        </div>
      </section>

      {/* Upload Progress Section */}
      {isMultipleUpload && Object.keys(uploadProgress).length > 0 && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Progress
              </CardTitle>
              <CardDescription>
                Tracking the progress of your media uploads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(uploadProgress).map(([key, progress]) => (
                  <div key={key} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <div className="shrink-0">
                      {progress.status === 'waiting' && <Clock className="h-5 w-5 text-muted-foreground" />}
                      {progress.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {progress.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {progress.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{progress.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {progress.status === 'waiting' && 'Waiting in queue...'}
                        {progress.status === 'uploading' && 'Uploading to server...'}
                        {progress.status === 'success' && 'Upload completed successfully'}
                        {progress.status === 'error' && `Upload failed: ${progress.error}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Search and Filters Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
            <CardDescription>
              Find and filter media files by name, status, or type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search media files by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={statusFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                      className="h-8"
                    >
                      All
                    </Button>
                    <Button
                      variant={statusFilter === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('active')}
                      className="h-8"
                    >
                      Active
                    </Button>
                    <Button
                      variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('inactive')}
                      className="h-8"
                    >
                      Inactive
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={typeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('all')}
                      className="h-8"
                    >
                      All
                    </Button>
                    <Button
                      variant={typeFilter === 'image' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('image')}
                      className="h-8"
                    >
                      <FileImage className="h-3 w-3 mr-1" />
                      Images
                    </Button>
                    <Button
                      variant={typeFilter === 'video' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('video')}
                      className="h-8"
                    >
                      <FileVideo className="h-3 w-3 mr-1" />
                      Videos
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium text-muted-foreground">View:</span>
                  <div className="flex gap-1 border rounded-md p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 p-0"
                      title="Grid View"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 p-0"
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{filteredMedia.length}</span> of{' '}
                  <span className="font-medium text-foreground">{mediaData.length}</span> media files
                </p>
                {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}
                    className="h-8"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Media Library Section */}
      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Media Library
                </CardTitle>
                <CardDescription>
                  {viewMode === 'grid' 
                    ? 'Browse your media files in a visual grid layout'
                    : 'Browse your media files in a detailed list layout'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderMediaGrid()}
          </CardContent>
        </Card>
      </section>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        multiple
        className="hidden"
      />

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.type === 'video' ? (
                <Video className="h-5 w-5" />
              ) : (
                <Image className="h-5 w-5" />
              )}
              {selectedItem?.originalName}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg overflow-hidden border bg-muted">
                {selectedItem.type === 'video' ? (
                  <video
                    className="w-full max-h-96"
                    controls
                    src={selectedItem.cloudinaryUrl || `/api/media-banners/${selectedItem.fileId}/file`}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={selectedItem.cloudinaryUrl || `/api/media-banners/${selectedItem.fileId}/file`}
                    alt={selectedItem.originalName}
                    className="w-full max-h-96 object-contain"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                  <p className="text-sm font-semibold capitalize">{selectedItem.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">MIME Type</p>
                  <p className="text-sm font-semibold">{selectedItem.mimeType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Size</p>
                  <p className="text-sm font-semibold">{Math.round(selectedItem.size / 1024)} KB</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge variant={selectedItem.isActive ? "default" : "secondary"}>
                    {selectedItem.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Display Order</p>
                  <p className="text-sm font-semibold">{selectedItem.displayOrder}</p>
                </div>
                {selectedItem.uploadedBy && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Uploaded By</p>
                    <p className="text-sm font-semibold">User {selectedItem.uploadedBy}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{selectedItem?.originalName}"</strong>? 
              This action cannot be undone and the file will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
