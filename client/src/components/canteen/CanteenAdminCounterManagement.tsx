import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Trash2, Store, ArrowLeft } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Counter schema for validation
const counterSchema = z.object({
  name: z.string().min(1, 'Counter name is required').max(50, 'Counter name must be less than 50 characters'),
  code: z.string().min(1, 'Counter code is required').max(10, 'Counter code must be less than 10 characters').regex(/^[A-Z0-9]+$/, 'Counter code must contain only uppercase letters and numbers'),
  type: z.enum(['payment', 'store', 'kot'], { required_error: 'Counter type is required' }),
});

type CounterFormData = z.infer<typeof counterSchema>;

interface Counter {
  id: string;
  name: string;
  code: string;
  counterId: string;
  canteenId: string;
  type: 'payment' | 'store' | 'kot';
  createdAt: Date;
}

interface CanteenAdminCounterManagementProps {
  canteenId: string;
}

export default function CanteenAdminCounterManagement({ canteenId }: CanteenAdminCounterManagementProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch counters
  const { data: countersData, isLoading, error } = useQuery({
    queryKey: ['/api/counters', canteenId],
    queryFn: () => apiRequest(`/api/counters?canteenId=${canteenId}`),
    enabled: !!canteenId,
  });

  // Extract counters from the API response
  // Handle both array response and object with items property
  let counters: Counter[] = [];
  if (Array.isArray(countersData)) {
    counters = countersData;
  } else if (countersData && typeof countersData === 'object') {
    // Check if response is wrapped in items property
    if (Array.isArray((countersData as any).items)) {
      counters = (countersData as any).items;
    } else if (Array.isArray((countersData as any).counters)) {
      counters = (countersData as any).counters;
    }
  }
  
  // Debug logging
  console.log('🔍 Admin Counter Management - Counters Data:', countersData);
  console.log('🔍 Admin Counter Management - Counters Data Type:', typeof countersData);
  console.log('🔍 Admin Counter Management - Is Array:', Array.isArray(countersData));
  console.log('🔍 Admin Counter Management - Extracted Counters:', counters);
  console.log('🔍 Admin Counter Management - Counters Length:', counters.length);
  console.log('🔍 Admin Counter Management - Loading:', isLoading);
  console.log('🔍 Admin Counter Management - Error:', error);
  
  // Log each counter for debugging
  if (counters.length > 0) {
    console.log('🔍 Admin Counter Management - Counter Types:', counters.map(c => ({ name: c.name, type: c.type })));
  }

  // Create counter mutation
  const createCounterMutation = useMutation({
    mutationFn: (data: CounterFormData) => 
      apiRequest('/api/counters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, canteenId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counters', canteenId] });
      console.log('Counter created successfully');
      setIsCreateDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      console.error('Failed to create counter:', error.message || 'Unknown error');
    },
  });

  // Delete counter mutation
  const deleteCounterMutation = useMutation({
    mutationFn: (counterId: string) => 
      apiRequest(`/api/counters/${counterId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counters', canteenId] });
      console.log('Counter deleted successfully');
    },
    onError: (error: any) => {
      console.error('Failed to delete counter:', error.message || 'Unknown error');
    },
  });

  // Form setup
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CounterFormData>({
    resolver: zodResolver(counterSchema),
  });

  const onSubmit = (data: CounterFormData) => {
    createCounterMutation.mutate(data);
  };

  const handleDelete = (counterId: string) => {
    deleteCounterMutation.mutate(counterId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Failed to load counters</p>
          <Button onClick={() => window.location.reload()} className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/admin/canteen/${canteenId}`)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Overview</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Counter Management</h1>
            <p className="text-muted-foreground">Manage counters for this canteen</p>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Counter</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Counter</DialogTitle>
              <DialogDescription>
                Add a new counter to manage orders and payments.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Counter Name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., Main Counter, Express Counter"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Counter Code</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="e.g., MAIN, EXPRESS"
                  className="uppercase"
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Counter code must be uppercase letters and numbers only
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Counter Type</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select counter type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment">Payment Counter</SelectItem>
                        <SelectItem value="store">Store Mode</SelectItem>
                        <SelectItem value="kot">KOT Counter</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Payment Counter: Process payments and manage orders
                  <br />
                  Store Mode: Manage orders and track store operations
                  <br />
                  KOT Counter: Kitchen Order Ticket counter for order tracking
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCounterMutation.isPending}
                >
                  {createCounterMutation.isPending ? 'Creating...' : 'Create Counter'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Counters List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {counters.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Store className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Counters Found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first counter to start managing orders and payments.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Counter
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          counters.map((counter: Counter) => (
            <Card key={counter.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Store className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{counter.name}</CardTitle>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Counter</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{counter.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(counter.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 mb-1">
                    <span>Counter Code:</span>
                    <Badge variant="secondary">{counter.code}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Type:</span>
                    <Badge variant={counter.type === 'payment' ? 'default' : 'outline'}>
                      {counter.type === 'payment' ? 'Payment Counter' : counter.type === 'store' ? 'Store Mode' : 'KOT Counter'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Counter ID:</span>
                    <span className="font-mono text-xs">{counter.counterId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(counter.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => setLocation(`/admin/canteen/${canteenId}/counter/${counter.id}`)}
                      className="w-full"
                    >
                      {counter.type === 'payment' ? 'Open Payment Counter' : counter.type === 'store' ? 'Open Store Mode' : 'Open KOT Counter'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
