import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Star, Camera, Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
const RateReviewPage = () => {
  const [, setLocation] = useLocation();
  // Get orderId from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');

  // Mock order data
  const orderData = {
    id: orderId || 'ORD001',
    items: [
      {
        id: 1,
        name: 'Grilled Chicken Burger',
        image: '/placeholder.png'
      },
      {
        id: 2,
        name: 'Crispy French Fries',
        image: '/placeholder.png'
      },
      {
        id: 3,
        name: 'Chocolate Milkshake',
        image: '/placeholder.png'
      }
    ]
  };

  const [reviews, setReviews] = useState(
    orderData.items.map(item => ({
      itemId: item.id,
      rating: 0,
      comment: '',
      photos: []
    }))
  );
  
  const [overallRating, setOverallRating] = useState(0);
  const [overallComment, setOverallComment] = useState('');

  const updateItemRating = (itemId: number, rating: number) => {
    setReviews(reviews.map(review =>
      review.itemId === itemId ? { ...review, rating } : review
    ));
  };

  const updateItemComment = (itemId: number, comment: string) => {
    setReviews(reviews.map(review =>
      review.itemId === itemId ? { ...review, comment } : review
    ));
  };

  const renderStars = (rating: number, onStarClick: (star: number) => void, size = "h-6 w-6") => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onStarClick(star)}
            className="transition-colors"
          >
            <Star
              className={`${size} ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const handleSubmit = () => {
    const hasAllRatings = reviews.every(review => review.rating > 0) && overallRating > 0;
    
    if (!hasAllRatings) {
      return;
    }

    // Dispatch custom event to switch to orders view in AppPage
    window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
    setLocation('/app');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Dispatch custom event to switch to orders view in AppPage
              window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
              setLocation('/app');
            }}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Rate & Review</h1>
            <p className="text-sm text-muted-foreground">Order #{orderData.id}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Overall Rating */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Overall Experience</h2>
            <div className="text-center space-y-3">
              {renderStars(overallRating, setOverallRating, "h-8 w-8")}
              <p className="text-sm text-muted-foreground">
                {overallRating === 0 && "Tap to rate"}
                {overallRating === 1 && "Poor"}
                {overallRating === 2 && "Fair"}
                {overallRating === 3 && "Good"}
                {overallRating === 4 && "Very Good"}
                {overallRating === 5 && "Excellent"}
              </p>
            </div>
            <Textarea
              placeholder="Share your overall experience..."
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              className="mt-3"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Individual Items */}
        <div className="space-y-4">
          <h2 className="font-semibold">Rate Individual Items</h2>
          
          {orderData.items.map((item) => {
            const review = reviews.find(r => r.itemId === item.id);
            
            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3 mb-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <div className="mt-1">
                        {renderStars(
                          review?.rating || 0,
                          (rating) => updateItemRating(item.id, rating)
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Textarea
                    placeholder={`What did you think of the ${item.name}?`}
                    value={review?.comment || ''}
                    onChange={(e) => updateItemComment(item.id, e.target.value)}
                    rows={2}
                    className="mb-3"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      }}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photos (Optional)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tips Section */}
        <Card className="bg-accent/50">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Help others decide</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Share what you liked or didn't like</li>
              <li>• Mention food quality, taste, and portion size</li>
              <li>• Add photos to show how your food looked</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Action */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <Button
          onClick={handleSubmit}
          className="w-full"
          variant="food"
          size="mobile"
        >
          <Send className="h-4 w-4 mr-2" />
          Submit Review
        </Button>
      </div>
    </div>
  );
};

export default RateReviewPage;