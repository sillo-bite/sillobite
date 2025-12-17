import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Star, MessageSquare, Send, CheckCircle, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
export default function FeedbackPage() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      alert("Please provide a rating before submitting.");
      return;
    }

    if (!feedback.trim()) {
      alert("Please provide your feedback before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call (replace with actual API call later)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Show success state
      setIsSubmitted(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setRating(0);
        setFeedback("");
        setName("");
        setEmail("");
        setSelectedCategory(null);
        setIsSubmitted(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackCategories = [
    { name: "App Experience", emoji: "📱", color: "bg-black", iconColor: "text-blue-400" },
    { name: "Technical Issues", emoji: "🔧", color: "bg-black", iconColor: "text-red-400" },
    { name: "Feature Requests", emoji: "💡", color: "bg-black", iconColor: "text-yellow-400" },
    { name: "Performance", emoji: "⚡", color: "bg-black", iconColor: "text-green-400" },
    { name: "User Interface", emoji: "🎨", color: "bg-black", iconColor: "text-purple-400" },
    { name: "Support Quality", emoji: "🤝", color: "bg-black", iconColor: "text-cyan-400" }
  ];

  return (
    <div className={`min-h-screen ${
      'bg-background'
    }`}>
      {/* Header */}
      <div className="bg-red-600 text-white px-4 pt-12 pb-6 sticky top-0 z-10 rounded-b-2xl shadow-lg">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 transition-all duration-200 rounded-full" 
            onClick={() => {
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
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <h1 className="text-xl font-semibold">Feedback</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Success Message */}
        {isSubmitted && (
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-green-900/20 border-green-700' 
              : 'bg-green-50 border-green-200'
          } border-2`}>
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">
                Thank You for Your Feedback!
              </h2>
              <p className="text-sm text-green-600 dark:text-green-400">
                Your feedback has been submitted successfully. We appreciate your input!
              </p>
            </CardContent>
          </Card>
        )}

        {/* 1. PRIORITY: Main Feedback Section - Core Content */}
        {!isSubmitted && (
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800' 
              : 'bg-white border-gray-200'
          } shadow-lg`}>
            <CardContent className="p-4 space-y-4">
              {/* Introduction */}
              <div className="flex items-center space-x-3">
                <MessageSquare className={`w-6 h-6 ${
                  resolvedTheme === 'dark' ? 'text-red-500' : 'text-red-600'
                }`} />
                <div>
                  <h2 className={`text-base font-semibold ${
                    resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                  }`}>
                    We Value Your Opinion
                  </h2>
                  <p className={`text-sm ${
                    resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Help us improve our app by sharing your experience
                  </p>
                </div>
              </div>

              {/* Overall Experience Rating */}
              <div>
                <h3 className={`text-base font-semibold mb-4 ${
                  resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                }`}>
                  How was your overall experience? *
                </h3>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-8 h-8 cursor-pointer transition-all duration-200 hover:scale-110 ${
                        star <= (hoveredStar || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : resolvedTheme === 'dark' 
                            ? "text-gray-600 hover:text-yellow-300" 
                            : "text-gray-300 hover:text-yellow-300"
                      }`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                    />
                  ))}
                </div>
                {rating > 0 && (
                  <p className={`text-sm mt-2 ${
                    resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {rating === 1 && "Poor"}
                    {rating === 2 && "Fair"}
                    {rating === 3 && "Good"}
                    {rating === 4 && "Very Good"}
                    {rating === 5 && "Excellent"}
                  </p>
                )}
              </div>

              {/* Main Feedback */}
              <div>
                <h3 className={`text-base font-semibold mb-4 ${
                  resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                }`}>
                  Your Feedback *
                </h3>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us more about your experience..."
                  rows={4}
                  className={`w-full text-sm ${
                    resolvedTheme === 'dark' 
                      ? 'bg-black border-gray-800 text-gray-100' 
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 2. PRIORITY: Category & Contact Section - Secondary Information */}
        {!isSubmitted && (
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800' 
              : 'bg-white border-gray-200'
          } shadow-lg`}>
            <CardContent className="p-4 space-y-4">
              {/* Category Selection */}
              <div>
                <h3 className={`text-base font-semibold mb-4 ${
                  resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                }`}>
                  Categorize your feedback (optional)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {feedbackCategories.map((category, index) => (
                    <Card 
                      key={index} 
                      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                        selectedCategory === category.name
                          ? `border-2 border-red-500 ${resolvedTheme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'}`
                          : resolvedTheme === 'dark' 
                            ? 'bg-black border-gray-800 hover:border-gray-700' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedCategory(
                        selectedCategory === category.name ? null : category.name
                      )}
                    >
                      <CardContent className="p-2 text-center">
                        <div className={`w-8 h-8 ${category.color} border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-1`}>
                          <span className={`text-sm ${category.iconColor}`}>{category.emoji}</span>
                        </div>
                        <p className={`text-xs font-medium ${
                          resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                        }`}>
                          {category.name}
                        </p>
                        {selectedCategory === category.name && (
                          <div className="mt-1">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full mx-auto"></div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className={`text-base font-semibold mb-4 ${
                  resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                }`}>
                  Your Contact Info (optional)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name (Optional)"
                    className={`h-10 text-sm ${
                      resolvedTheme === 'dark' 
                        ? 'bg-black border-gray-800 text-gray-100' 
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (Optional)"
                    className={`h-10 text-sm ${
                      resolvedTheme === 'dark' 
                        ? 'bg-black border-gray-800 text-gray-100' 
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. PRIORITY: Submit Button - Final Action */}
        {!isSubmitted && (
          <form onSubmit={handleSubmit}>
            <Button 
              type="submit" 
              disabled={isSubmitting || rating === 0 || !feedback.trim()}
              className={`w-full h-12 text-base font-semibold flex items-center justify-center space-x-2 transition-all duration-200 ${
                isSubmitting || rating === 0 || !feedback.trim()
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-lg'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Send Feedback</span>
              )}
            </Button>
          </form>
        )}

      </div>
    </div>
  );
}