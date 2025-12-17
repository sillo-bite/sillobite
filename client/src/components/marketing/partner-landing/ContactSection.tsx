import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle, AlertCircle, Mail, Phone, Building, User } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface DemoRequestData {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  message: string;
}

async function submitDemoRequest(data: DemoRequestData): Promise<{ success: boolean; error?: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log("Demo Request Submitted:", {
    name: data.name,
    organisation: data.organisation,
    email: data.email,
    phone: data.phone,
    message: data.message || "(no message)",
    timestamp: new Date().toISOString(),
  });

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
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Get Started{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Today
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Share your details and we'll arrange a personalized consultation tailored to your college, hospital, or corporate cafeteria requirements.
          </p>
        </div>

        {/* Split-Screen Layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Visual/Info Section */}
          <div
            className={`space-y-8 transition-all duration-700 ease-out ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 rounded-3xl p-10 border border-primary/20 shadow-xl">
              <h3 className="font-heading text-2xl font-bold text-foreground mb-6">
                Schedule Your Personalized Consultation
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Discover how Sillobyte can transform your institutional dining operations. Our team will provide a comprehensive demonstration tailored to your specific needs.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground mb-1">Email Support</h4>
                    <p className="text-sm text-muted-foreground">Get in touch via email for detailed inquiries</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center border border-secondary/20 flex-shrink-0">
                    <Phone className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground mb-1">Phone Consultation</h4>
                    <p className="text-sm text-muted-foreground">Schedule a call with our experts</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
                    <Building className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground mb-1">On-Site Demo</h4>
                    <p className="text-sm text-muted-foreground">Arrange an in-person demonstration at your facility</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form Section */}
          <div
            className={`bg-gradient-to-br from-background via-background to-card/50 rounded-3xl border border-border/50 p-8 md:p-10 shadow-2xl transition-all duration-700 ease-out ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {isSubmitted ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center border-2 border-secondary/20 shadow-lg">
                  <CheckCircle className="w-10 h-10 text-secondary" />
                </div>
                <h3 className="font-heading text-3xl font-bold text-foreground mb-3">
                  Thank You!
                </h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  We've received your request and will be in touch within 24 hours to schedule your consultation.
                </p>
                <Button variant="outline" onClick={resetForm} className="border-2">
                  Submit Another Request
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold">
                    <User className="w-4 h-4" />
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={`h-12 border-2 ${errors.name ? "border-destructive focus-visible:ring-destructive" : "border-border/50 focus-visible:border-primary"}`}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organisation" className="flex items-center gap-2 text-sm font-semibold">
                    <Building className="w-4 h-4" />
                    Organisation / Institution *
                  </Label>
                  <Input
                    id="organisation"
                    placeholder="e.g., ABC University"
                    value={formData.organisation}
                    onChange={(e) => handleInputChange("organisation", e.target.value)}
                    className={`h-12 border-2 ${errors.organisation ? "border-destructive focus-visible:ring-destructive" : "border-border/50 focus-visible:border-primary"}`}
                  />
                  {errors.organisation && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.organisation}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold">
                      <Mail className="w-4 h-4" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@organisation.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`h-12 border-2 ${errors.email ? "border-destructive focus-visible:ring-destructive" : "border-border/50 focus-visible:border-primary"}`}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold">
                      <Phone className="w-4 h-4" />
                      Phone *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className={`h-12 border-2 ${errors.phone ? "border-destructive focus-visible:ring-destructive" : "border-border/50 focus-visible:border-primary"}`}
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
                  <Label htmlFor="message" className="text-sm font-semibold">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us about your dining operations, number of counters, daily volume, and institution type..."
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    className="resize-none border-2 border-border/50 focus-visible:border-primary"
                  />
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-xl hover:shadow-2xl transition-all duration-300"
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
                      <Send className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
