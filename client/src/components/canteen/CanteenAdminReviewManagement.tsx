import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Star, ThumbsUp, ThumbsDown, Flag, 
  Search, Filter, Eye, Trash2, CheckCircle, 
  XCircle, MessageSquare, Calendar, TrendingUp
} from "lucide-react";
interface CanteenAdminReviewManagementProps {
  canteenId: string;
}

export default function CanteenAdminReviewManagement({ canteenId }: CanteenAdminReviewManagementProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  const reviews: any[] = []; // Will be populated from actual review data when review system is implemented

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-success text-success-foreground";
      case "Pending": return "bg-warning text-warning-foreground";
      case "Rejected": return "bg-destructive text-destructive-foreground";
      case "Flagged": return "bg-red-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-warning fill-warning' : 'text-muted-foreground'}`}
      />
    ));
  };

  const filteredReviews = reviews.filter((review: any) => {
    const matchesSearch = review?.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review?.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review?.comment?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRating = ratingFilter === "all" || review.rating.toString() === ratingFilter;
    
    let matchesStatus = true;
    if (activeTab === "pending") {
      matchesStatus = review.status === "Pending";
    } else if (activeTab === "approved") {
      matchesStatus = review.status === "Approved";
    } else if (activeTab === "rejected") {
      matchesStatus = review.status === "Rejected";
    } else if (activeTab === "flagged") {
      matchesStatus = review.status === "Flagged";
    }
    
    return matchesSearch && matchesRating && matchesStatus;
  });

  const handleApproveReview = (reviewId: string) => {
    };

  const handleRejectReview = (reviewId: string) => {
    };

  const handleFlagReview = (reviewId: string) => {
    };

  const handleDeleteReview = (reviewId: string) => {
    };

  return (
    <div className="p-6 space-y-6" data-testid="canteen-admin-review-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`/admin/canteen/${canteenId}`)}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Review Management</h1>
            <p className="text-muted-foreground">Manage customer reviews and ratings for this canteen</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Total Reviews</span>
            <Badge variant="outline" data-testid="total-reviews">
              {reviews.length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Star className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-average-rating">
                  {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "0.0"}
                </p>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-approved">
                  {reviews.filter(r => r.status === "Approved").length}
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <Calendar className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-pending">
                  {reviews.filter(r => r.status === "Pending").length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-destructive/20 rounded-lg flex items-center justify-center">
                <Flag className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-flagged">
                  {reviews.filter(r => r.status === "Flagged").length}
                </p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search reviews by user, item, or comment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-32" data-testid="rating-filter">
                  <SelectValue placeholder="Rating" />
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        {[
          { id: "all", label: "All Reviews", count: reviews.length },
          { id: "pending", label: "Pending", count: reviews.filter(r => r.status === "Pending").length },
          { id: "approved", label: "Approved", count: reviews.filter(r => r.status === "Approved").length },
          { id: "rejected", label: "Rejected", count: reviews.filter(r => r.status === "Rejected").length },
          { id: "flagged", label: "Flagged", count: reviews.filter(r => r.status === "Flagged").length }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            className="relative"
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {tab.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reviews Found</h3>
              <p className="text-muted-foreground">
                {reviews.length === 0 
                  ? "No reviews have been submitted for this canteen yet."
                  : "No reviews match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReviews.map((review: any) => (
            <Card key={review.id} className="hover:shadow-lg transition-shadow" data-testid={`review-card-${review.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {review.user?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{review.user || "Anonymous User"}</h4>
                      <p className="text-sm text-muted-foreground">{review.itemName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(review.status)} data-testid={`status-${review.id}`}>
                      {review.status}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-foreground mb-3">{review.comment}</p>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(review.date).toLocaleDateString()}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{review.likes || 0}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <ThumbsDown className="h-3 w-3" />
                      <span>{review.dislikes || 0}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {review.status === "Pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveReview(review.id)}
                          className="bg-success hover:bg-success/90"
                          data-testid={`approve-${review.id}`}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectReview(review.id)}
                          data-testid={`reject-${review.id}`}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    
                    {review.status === "Approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFlagReview(review.id)}
                        data-testid={`flag-${review.id}`}
                      >
                        <Flag className="h-3 w-3 mr-1" />
                        Flag
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteReview(review.id)}
                      data-testid={`delete-${review.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
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



