import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Star, Calendar, MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import BottomNavigation from "@/components/navigation/BottomNavigation";

const UserReviewsPage = () => {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Get user info for API calls
  const [userInfo, setUserInfo] = useState(null);

  // Fetch user info from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserInfo(user);
    }
  }, []);

  // Fetch user reviews from API
  const { data: reviews = [], isLoading: loading, error } = useQuery({
    queryKey: ['/api/user-reviews', userInfo?.email],
    enabled: !!userInfo?.email,
    queryFn: async () => {
      try {
        const url = `/api/user-reviews?userEmail=${encodeURIComponent(userInfo.email)}`;
        console.log('Fetching user reviews from:', url);
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Non-JSON response received:', text.substring(0, 200));
          throw new Error(`Server returned ${contentType || 'unknown'} instead of JSON. Status: ${response.status}`);
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch reviews:', response.status, errorText);
          throw new Error(`Failed to fetch reviews: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Received reviews data:', data);
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('Error in user reviews query:', err);
        throw err;
      }
    },
    retry: 1,
    onError: (err) => {
      console.error('User reviews query error:', err);
    },
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredAndSortedReviews = reviews
    .filter(review => {
      const itemName = review.itemName?.toLowerCase() || '';
      const comment = review.comment?.toLowerCase() || '';
      const canteenName = review.canteenName?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = itemName.includes(searchLower) ||
                           comment.includes(searchLower) ||
                           canteenName.includes(searchLower);
      
      const matchesRating = ratingFilter === "all" || (review.rating?.toString() === ratingFilter);
      
      return matchesSearch && matchesRating;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateB - dateA;
        case "oldest":
          const dateAOld = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateBOld = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateAOld - dateBOld;
        case "rating-high":
          return (b.rating || 0) - (a.rating || 0);
        case "rating-low":
          return (a.rating || 0) - (b.rating || 0);
        default:
          return 0;
      }
    });

  const handleHelpfulVote = async (reviewId: number, isHelpful: boolean) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isHelpful }),
      });
      
      if (response.ok) {
        // Refetch reviews to get updated data
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error('Failed to vote on review:', error);
    }
  };

  const stats = {
    totalReviews: reviews.length,
    averageRating: reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length 
      : 0,
    totalHelpfulVotes: reviews.reduce((sum, review) => sum + (review.helpfulVotes || 0), 0)
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-[#724491] px-4 pt-12 pb-6 rounded-b-2xl">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20" 
            onClick={() => {
              // Dispatch custom event to navigate back using history
              // Check if we came from Profile
              const fromProfile = sessionStorage.getItem('navigationFrom') === 'profile';
              
              if (fromProfile) {
                // Navigate back to Profile view
                setLocation("/app");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                }, 0);
              } else {
                // Use history-based back navigation
                setLocation("/app");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
                }, 0);
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">My Reviews</h1>
          <div className="w-10"></div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-primary-foreground/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-foreground">{stats.totalReviews}</div>
            <div className="text-primary-foreground/80 text-sm">Reviews</div>
          </div>
          <div className="bg-primary-foreground/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-foreground">{stats.averageRating.toFixed(1)}</div>
            <div className="text-primary-foreground/80 text-sm">Avg Rating</div>
          </div>
          <div className="bg-primary-foreground/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-foreground">{stats.totalHelpfulVotes}</div>
            <div className="text-primary-foreground/80 text-sm">Helpful</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Search and Filters */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="space-y-4">
              <Input
                placeholder="Search your reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              <div className="flex gap-2">
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Filter by rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="rating-high">Highest Rating</SelectItem>
                    <SelectItem value="rating-low">Lowest Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading your reviews...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-destructive mb-2">Failed to load reviews</div>
            {error instanceof Error && (
              <div className="text-sm text-muted-foreground mb-4">
                {error.message}
              </div>
            )}
            <Button 
              onClick={() => {
                // Force refetch
                window.location.reload();
              }} 
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Reviews List */}
        {!loading && !error && (
          <div className="space-y-4">
            {filteredAndSortedReviews.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">No reviews found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || ratingFilter !== "all" 
                      ? "Try adjusting your search or filters" 
                      : "You haven't written any reviews yet"}
                  </p>
                  {!searchTerm && ratingFilter === "all" && (
                    <Button 
                      onClick={() => {
                        // Dispatch custom event to switch to orders view in AppPage
                        window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
                        setLocation("/app");
                      }}
                      variant="outline"
                    >
                      View Orders to Review
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
            filteredAndSortedReviews.map((review) => (
              <Card key={review.id} className="hover:shadow-md transition-shadow bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <img
                      src={review.itemImage || '/placeholder.png'}
                      alt={review.itemName || 'Item'}
                      className="w-12 h-12 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-card-foreground">{review.itemName || 'Unnamed Item'}</h3>
                        <Badge className={getStatusColor(review.status || 'pending')}>
                          {review.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{review.canteenName || 'Unknown Canteen'}</p>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="flex items-center space-x-1">
                          {renderStars(review.rating || 0)}
                        </div>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">{review.submittedAt || 'Unknown date'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {review.comment && (
                    <p className="text-card-foreground mb-3">{review.comment}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="w-4 h-4" />
                        <span>{review.helpfulVotes || 0} helpful</span>
                      </div>
                      {review.orderId && (
                        <span>Order #{review.orderId}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleHelpfulVote(review.id, true)}
                        className="text-green-600 hover:bg-green-50"
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" />
                        Helpful
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
            )}
          </div>
        )}
      </div>
      
      {/* Bottom spacing for navigation */}
      <div className="mb-24"></div>

      <BottomNavigation currentPage="profile" />
    </div>
  );
};

export default UserReviewsPage;
