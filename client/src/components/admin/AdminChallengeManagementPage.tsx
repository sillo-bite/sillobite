import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Flame, Code, Trophy, Search, X, HelpCircle } from "lucide-react";

interface CodingChallenge {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  totalQuestions: number;
  tags: string[];
  xpReward: number;
  link?: string;
  rules?: string;
  termsAndConditions?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ChallengeForm {
  name: string;
  description: string;
  questionCount: number;
  totalQuestions: number;
  tags: string;
  xpReward: number;
  link: string;
  rules: string;
  termsAndConditions: string;
  isActive: boolean;
}

const defaultFormData: ChallengeForm = {
  name: '',
  description: '',
  questionCount: 0,
  totalQuestions: 0,
  tags: '',
  xpReward: 50,
  link: '',
  rules: '',
  termsAndConditions: '',
  isActive: true
};

export default function AdminChallengeManagementPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<CodingChallenge | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<ChallengeForm>(defaultFormData);
  const [tagInput, setTagInput] = useState('');

  const queryClient = useQueryClient();

  // Fetch challenges
  const { data: challenges = [], isLoading, error, refetch } = useQuery<CodingChallenge[]>({
    queryKey: ['/api/admin/challenges'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/admin/challenges');
        console.log('Fetched challenges:', data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching challenges:', error);
        throw error;
      }
    }
  });

  // Create challenge mutation
  const createChallengeMutation = useMutation({
    mutationFn: async (data: ChallengeForm) => {
      const tagsArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      const result = await apiRequest('/api/admin/challenges', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          tags: tagsArray
        })
      });
      console.log('Created challenge:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Challenge created successfully:', data);
      console.log('Invalidating queries and refetching...');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/challenges'] });
      // Use setTimeout to ensure the query is invalidated before refetch
      setTimeout(() => {
        refetch();
      }, 100);
      setShowCreateDialog(false);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      console.error('Error creating challenge:', error);
      alert(`Failed to create challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Update challenge mutation
  const updateChallengeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ChallengeForm }) => {
      const tagsArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      const result = await apiRequest(`/api/admin/challenges/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          tags: tagsArray
        })
      });
      console.log('Updated challenge:', result);
      return result;
    },
    onSuccess: () => {
      console.log('Challenge updated successfully, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/challenges'] });
      setTimeout(() => {
        refetch();
      }, 100);
      setEditingChallenge(null);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      console.error('Error updating challenge:', error);
      alert(`Failed to update challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Delete challenge mutation
  const deleteChallengeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/challenges/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/challenges'] });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      apiRequest(`/api/admin/challenges/${id}/toggle-active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/challenges'] });
    }
  });

  const handleEdit = (challenge: CodingChallenge) => {
    setEditingChallenge(challenge);
    setFormData({
      name: challenge.name,
      description: challenge.description,
      questionCount: challenge.questionCount,
      totalQuestions: challenge.totalQuestions,
      tags: challenge.tags.join(', '),
      xpReward: challenge.xpReward,
      link: challenge.link || '',
      rules: challenge.rules || '',
      termsAndConditions: challenge.termsAndConditions || '',
      isActive: challenge.isActive
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (id: string) => {
    deleteChallengeMutation.mutate(id);
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingChallenge) {
      updateChallengeMutation.mutate({ id: editingChallenge.id, data: formData });
    } else {
      createChallengeMutation.mutate(formData);
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingChallenge(null);
    setFormData(defaultFormData);
    setTagInput('');
  };

  const addTag = () => {
    if (tagInput.trim()) {
      const currentTags = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];
      if (!currentTags.includes(tagInput.trim())) {
        setFormData({
          ...formData,
          tags: [...currentTags, tagInput.trim()].join(', ')
        });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(t => t !== tagToRemove);
    setFormData({
      ...formData,
      tags: currentTags.join(', ')
    });
  };

  // Filter challenges
  const filteredChallenges = challenges.filter(challenge => {
    const matchesSearch = challenge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         challenge.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         challenge.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Code className="w-8 h-8" />
            <span>Challenge Management</span>
          </h1>
          <p className="text-muted-foreground mt-1">Manage coding challenges for students</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingChallenge(null);
              setFormData(defaultFormData);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Challenge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}</DialogTitle>
              <DialogDescription>
                {editingChallenge ? 'Update the challenge details below.' : 'Fill in the details to create a new coding challenge.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Challenge Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Array Fundamentals"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the challenge and what students will learn..."
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="questionCount">Question Count *</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    min="1"
                    value={formData.questionCount}
                    onChange={(e) => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 0 })}
                    placeholder="Number of questions"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Number of questions in this challenge</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalQuestions">Total Questions *</Label>
                  <Input
                    id="totalQuestions"
                    type="number"
                    min="1"
                    value={formData.totalQuestions}
                    onChange={(e) => setFormData({ ...formData, totalQuestions: parseInt(e.target.value) || 0 })}
                    placeholder="Total questions"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Total questions available (can be same as question count)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="xpReward">XP Reward *</Label>
                  <Input
                    id="xpReward"
                    type="number"
                    min="1"
                    value={formData.xpReward}
                    onChange={(e) => setFormData({ ...formData, xpReward: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isActive">Status</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Active
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated) *</Label>
                <div className="flex space-x-2">
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., Arrays, Hash Table, Algorithms"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Separate tags with commas (e.g., Arrays, Hash Table, Algorithms)
                </p>
                {formData.tags && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.split(',').map((tag, index) => {
                      const trimmedTag = tag.trim();
                      return trimmedTag ? (
                        <Badge key={index} variant="outline" className="flex items-center space-x-1">
                          <span>{trimmedTag}</span>
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeTag(trimmedTag)}
                          />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="link">Challenge Link</Label>
                <Input
                  id="link"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com/challenge"
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: External link to the challenge platform or resource
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rules">Rules & Regulations</Label>
                <Textarea
                  id="rules"
                  value={formData.rules}
                  onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                  placeholder="Enter the rules and regulations for this challenge..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Rules that participants must follow when attempting this challenge
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                <Textarea
                  id="termsAndConditions"
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  placeholder="Enter the terms and conditions for this challenge..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Terms and conditions that participants must agree to
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createChallengeMutation.isPending || updateChallengeMutation.isPending}>
                  {editingChallenge ? 'Update' : 'Create'} Challenge
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search challenges by name, description, or tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mb-4 bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4">
            <p className="text-xs text-yellow-800">
              <strong>Debug:</strong> Challenges count: {challenges.length}, 
              Filtered: {filteredChallenges.length}, 
              Loading: {isLoading ? 'Yes' : 'No'},
              Error: {error ? 'Yes' : 'No'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Challenges List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading challenges...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <p className="text-red-500 mb-4">Error loading challenges</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredChallenges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'No challenges match your search.' 
                : 'No challenges found. Create your first challenge!'}
            </p>
            {challenges.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Note: {challenges.length} challenge(s) exist but are filtered out.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredChallenges.map((challenge) => (
            <Card key={challenge.id} className={!challenge.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <CardTitle className="text-xl">{challenge.name}</CardTitle>
                      {!challenge.isActive && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">{challenge.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {challenge.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                {/* Question Information */}
                <div className="mb-4 p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Questions</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {challenge.questionCount} / {challenge.totalQuestions} questions
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${challenge.totalQuestions > 0 ? Math.round((challenge.questionCount / challenge.totalQuestions) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Trophy className="w-4 h-4" />
                      <span>{challenge.xpReward} XP</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(challenge.id, challenge.isActive)}
                      disabled={toggleActiveMutation.isPending}
                    >
                      {challenge.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(challenge)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the challenge "{challenge.title}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(challenge.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Code className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Challenges</p>
                <p className="text-2xl font-bold">{challenges.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Challenges</p>
                <p className="text-2xl font-bold">{challenges.filter(c => c.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Questions</p>
                <p className="text-2xl font-bold">
                  {challenges.filter(c => c.isActive).reduce((sum, c) => sum + c.totalQuestions, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total XP Available</p>
                <p className="text-2xl font-bold">
                  {challenges.filter(c => c.isActive).reduce((sum, c) => sum + c.xpReward, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

