import { Card, CardContent } from "@/components/ui/card";
import { Shield, Eye, Database, Lock } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { useBackNavigation } from "@/hooks/useBackNavigation";

export default function PrivacyPolicyPage() {
  const { handleBackClick } = useBackNavigation({
    referrerKey: 'termsPrivacyReferrer',
    referrerRoute: '/login'
  });

  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: [
        "Personal information you provide when creating an account (name, email, phone number, student ID)",
        "Order history and preferences to improve your experience",
        "Payment information (processed securely through encrypted channels)",
        "Device information and app usage data for analytics and improvements"
      ]
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: [
        "Process and fulfill your food orders",
        "Send order updates and notifications",
        "Improve our services and app functionality",
        "Provide customer support and resolve issues",
        "Analyze usage patterns to enhance user experience"
      ]
    },
    {
      icon: Shield,
      title: "Information Sharing",
      content: [
        "We DO NOT sell your personal information to third parties",
        "Order details are shared with canteen staff only to fulfill your orders",
        "Anonymous usage data may be used for app improvements",
        "Information may be shared if required by law or to protect our rights"
      ]
    },
    {
      icon: Lock,
      title: "Data Security",
      content: [
        "All data is encrypted in transit and at rest",
        "Payment information is processed through secure, PCI-compliant systems",
        "Regular security audits and updates to protect your information",
        "Access to your data is limited to authorized personnel only"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Privacy Policy" 
        onBack={handleBackClick}
      />

      <div className="px-4 py-6 space-y-6">
        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Your Privacy Matters</h2>
            <p className="text-muted-foreground leading-relaxed">
              At our Digital Canteen, we are committed to protecting your privacy and personal information. 
              This Privacy Policy explains how we collect, use, and safeguard your data when you use our application.
            </p>
            <div className="mt-4 p-3 bg-accent/50 rounded-lg">
              <p className="text-sm font-medium">Last Updated: January 2024</p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Sections */}
        {sections.map((section, index) => (
          <SectionCard
            key={index}
            icon={section.icon}
            title={section.title}
            content={section.content}
          />
        ))}

        {/* Your Rights */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Your Rights</h3>
            <div className="space-y-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-1">Access Your Data</h4>
                <p className="text-sm text-muted-foreground">
                  You can request a copy of all personal data we have about you.
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-1">Correct Information</h4>
                <p className="text-sm text-muted-foreground">
                  Update or correct any inaccurate personal information.
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-1">Delete Your Account</h4>
                <p className="text-sm text-muted-foreground">
                  Request deletion of your account and associated data.
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-1">Data Portability</h4>
                <p className="text-sm text-muted-foreground">
                  Export your data in a machine-readable format.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <p className="text-muted-foreground mb-4">
              If you have any questions about this Privacy Policy or how we handle your data, please contact us:
            </p>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Email:</span> dinez.production@gmail.com</p>
              <p><span className="font-medium">Phone:</span> +91 8220963071</p>
              <p><span className="font-medium">Address:</span> Main Campus, City, State, Country</p>
            </div>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card className="shadow-card border-warning">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-warning mb-2">Policy Updates</h3>
            <p className="text-sm text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any significant changes 
              through the app or via email. Your continued use of the app after such modifications will constitute 
              your acknowledgment of the modified Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}