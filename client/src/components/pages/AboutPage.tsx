import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Award, Heart, Clock, Utensils, Info } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";

export default function AboutPage() {
  const [, setLocation] = useLocation();

  const handleBack = () => {
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
  };

  const features = [
    {
      icon: Clock,
      title: "Digital Ordering",
      description: "Order food online and track your order status in real-time"
    },
    {
      icon: Utensils,
      title: "Diverse Menu",
      description: "Wide variety of cuisines including North Indian, South Indian, Chinese, and snacks"
    },
    {
      icon: Heart,
      title: "Student-Friendly",
      description: "Affordable prices and quick service designed for college students"
    },
    {
      icon: Award,
      title: "Smart Management",
      description: "Advanced inventory management and real-time order tracking system"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="About Us"
        icon={Info}
        onBack={handleBack}
      />

      <div className="p-4 space-y-6">
        {/* Hero Section */}
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">SilloBite - Digital Canteen Management System</h2>
            <p className="text-muted-foreground">
              Modern digital canteen solution for educational institutions
            </p>
          </CardContent>
        </Card>

        {/* Mission */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Our Mission</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              To revolutionize the canteen experience in educational institutions through digital innovation.
              Our mission is to provide a seamless, efficient, and user-friendly platform that connects
              students with quality food services while streamlining operations for canteen management.
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div>
          <h2 className="text-lg font-semibold mb-4">What Makes Us Special</h2>
          <div className="space-y-4">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardContent className="p-4 flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}