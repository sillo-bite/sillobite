import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface DemoRequestData {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  message: string;
}

/**
 * Submit a demo request to the backend.
 * TODO: Replace this with actual API call when backend is ready.
 * Example: await fetch('/api/demo-requests', { method: 'POST', body: JSON.stringify(data) })
 */
async function submitDemoRequest(data: DemoRequestData): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Log for development - remove in production
  console.log("Demo Request Submitted:", {
    name: data.name,
    organisation: data.organisation,
    email: data.email,
    phone: data.phone,
    message: data.message || "(no message)",
    timestamp: new Date().toISOString(),
  });

  // TODO: Implement actual submission logic here
  // Options:
  // 1. Supabase: await supabase.from('demo_requests').insert(data)
  // 2. API endpoint: await fetch('/api/demo-requests', { method: 'POST', ... })
  // 3. Email service: integrate with SendGrid, Resend, etc.

  return { success: true };
}

export const ContactSection = () => {
  const { ref, isVisible } = useScrollAnimation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DemoRequestData, string>>>({});

  const [formData, setFormData] = useState<DemoRequestData>({
    name: "",
    organisation: "",
    email: "",
    phone: "",
    message: "",
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DemoRequestData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.organisation.trim()) {
      newErrors.organisation = "Organisation is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone is required";
    } else if (!/^[\d\s+\-()]{8,}$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof DemoRequestData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Please fix the errors",
        description: "Some required fields are missing or invalid.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitDemoRequest(formData);

      if (result.success) {
        setIsSubmitted(true);
        toast({
          title: "Request submitted!",
          description: "We'll get back to you within 24 hours.",
        });
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setFormData({
      name: "",
      organisation: "",
      email: "",
      phone: "",
      message: "",
    });
    setErrors({});
  };

  return (
    <section id="contact" className="section-padding bg-card">
      <div ref={ref} className="max-w-4xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Book a <span className="text-red-600">Demo</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Share a few details and we'll schedule a personalized walkthrough for your college, hospital, or corporate cafeteria.
          </p>
        </div>

        {/* Form */}
        <div
          className={`bg-background rounded-2xl border border-border p-6 md:p-10 shadow-soft transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "150ms" }}
        >
          {isSubmitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="font-heading text-2xl font-bold text-foreground mb-2">
                Thank You!
              </h3>
              <p className="text-muted-foreground mb-6">
                We've received your request and will be in touch within 24 hours.
              </p>
              <Button variant="outline" onClick={resetForm}>
                Submit Another Request
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={`h-12 ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organisation">Organisation / Institution *</Label>
                  <Input
                    id="organisation"
                    placeholder="e.g., ABC Institution"
                    value={formData.organisation}
                    onChange={(e) => handleInputChange("organisation", e.target.value)}
                    className={`h-12 ${errors.organisation ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.organisation && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.organisation}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@organisation.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`h-12 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className={`h-12 ${errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us about your canteen operations, number of counters, daily volume, and the type of institution (college, hospital, or company)."
                  rows={4}
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                variant="hero"
                size="xl"
                className="w-full md:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Request
                    <Send className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

