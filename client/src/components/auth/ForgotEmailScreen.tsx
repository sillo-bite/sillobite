import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Mail, Phone, Search, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/contexts/ThemeContext";
import { updateStatusBarColor } from "@/utils/statusBar";

type Step = "lookup" | "verify" | "show-email" | "change-email";

const lookupSchema = z.object({
  identifier: z.string().min(1, "Please enter your register number or staff ID"),
});

const verifySchema = z.object({
  phoneNumber: z.string().min(10, "Please enter your phone number"),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
});

type LookupForm = z.infer<typeof lookupSchema>;
type VerifyForm = z.infer<typeof verifySchema>;
type ChangeEmailForm = z.infer<typeof changeEmailSchema>;

interface ForgotEmailScreenProps {
  onBackToLogin: () => void;
}

export default function ForgotEmailScreen({ onBackToLogin }: ForgotEmailScreenProps) {
  const [step, setStep] = useState<Step>("lookup");
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { resolvedTheme } = useTheme();

  // Update status bar to match background color
  useEffect(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const bgColor = computed.getPropertyValue('--background').trim();
    if (bgColor) {
      // Convert HSL to RGB/hex
      const tempDiv = document.createElement('div');
      tempDiv.style.backgroundColor = `hsl(${bgColor})`;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);
      updateStatusBarColor(computedColor);
    } else {
      // Fallback to light/dark based on theme
      const isDark = resolvedTheme === 'dark';
      updateStatusBarColor(isDark ? '#1a0a2e' : '#f5ecfa');
    }
  }, [resolvedTheme]);

  const lookupForm = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { identifier: "" },
  });

  const verifyForm = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: { phoneNumber: "" },
  });

  const changeEmailForm = useForm<ChangeEmailForm>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "" },
  });

  const handleLookup = async (data: LookupForm) => {
    setIsLoading(true);
    try {
      let response;
      // Try register number first (student format check)
      if (data.identifier.match(/^7115\d{2}[A-Za-z]{3}\d{3}$/)) {
        response = await fetch(`/api/users/by-register/${data.identifier}`);
      } 
      // Try staff ID (6 digits)
      else if (data.identifier.match(/^\d{6}$/)) {
        response = await fetch(`/api/users/by-staff/${data.identifier}`);
      }
      // Generic lookup - try both endpoints
      else {
        response = await fetch(`/api/users/by-register/${data.identifier}`);
        if (!response.ok) {
          response = await fetch(`/api/users/by-staff/${data.identifier}`);
        }
      }

      if (response.ok) {
        const user = await response.json();
        setUserData(user);
        setStep("verify");
      }
    } catch (error) {
      console.error("Error looking up user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (data: VerifyForm) => {
    setIsLoading(true);
    try {
      if (userData.phoneNumber === data.phoneNumber) {
        setStep("show-email");
      }
    } catch (error) {
      console.error("Error verifying phone:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async (data: ChangeEmailForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.newEmail }),
      });

      if (response.ok) {
        setTimeout(() => {
          onBackToLogin();
        }, 2000);
      } else {
        const error = await response.json();
        console.error("Error updating email:", error);
      }
    } catch (error) {
      console.error("Error changing email:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "lookup":
        return (
          <div className="space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-card border-2 border-primary rounded-xl mx-auto">
                <Search className="w-7 h-7 text-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Find Your Account</h2>
              <p className="text-sm text-muted-foreground">
                Enter your register number or staff ID to recover your email
              </p>
            </div>

            <Form {...lookupForm}>
              <form onSubmit={lookupForm.handleSubmit(handleLookup)} className="space-y-4">
                <FormField
                  control={lookupForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Register Number or Staff ID</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground w-4 h-4" />
                          <Input 
                            {...field} 
                            placeholder="711523ABC123 or 123456"
                            type="text"
                            className="pl-10 pr-4 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl" 
                  disabled={isLoading}
                >
                  {isLoading ? "Searching..." : "Find Account"}
                </Button>
              </form>
            </Form>
          </div>
        );

      case "verify":
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mx-auto mb-2">
                <Phone className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Verify Phone Number</h2>
              <p className="text-sm text-muted-foreground">
                Enter your phone number to verify your identity
              </p>
            </div>

            <Alert className="bg-primary/5 border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Account found for: <strong className="text-foreground">{userData?.name}</strong>
                <br />
                Role: <strong className="text-foreground">{userData?.role}</strong>
              </AlertDescription>
            </Alert>

            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(handleVerify)} className="space-y-4">
                <FormField
                  control={verifyForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-foreground">Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary w-4 h-4 transition-colors" />
                          <Input 
                            {...field} 
                            placeholder="Enter your registered phone number"
                            className="pl-10 pr-4 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm transition-all"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep("lookup")}
                    className="flex-1 h-11 border-border hover:bg-accent rounded-xl transition-all duration-200"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        );

      case "show-email":
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mx-auto mb-2">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Your Email Address</h2>
              <p className="text-sm text-muted-foreground">
                Here's the email associated with your account
              </p>
            </div>

            <Alert className="bg-primary/5 border-primary/20">
              <Mail className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <div className="space-y-2">
                  <div><strong className="text-foreground">Name:</strong> <span className="text-foreground">{userData?.name}</span></div>
                  <div><strong className="text-foreground">Email:</strong> <span className="text-foreground break-all">{userData?.email}</span></div>
                  <div><strong className="text-foreground">Role:</strong> <span className="text-foreground">{userData?.role}</span></div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3 pt-1">
              <Button 
                onClick={onBackToLogin} 
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
              >
                Back to Login
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStep("change-email")}
                className="w-full h-11 border-border hover:bg-accent rounded-xl transition-all duration-200"
              >
                Lost Access to This Email?
              </Button>
            </div>
          </div>
        );

      case "change-email":
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mx-auto mb-2">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Update Email Address</h2>
              <p className="text-sm text-muted-foreground">
                Enter your new email address that you can access
              </p>
            </div>

            <Alert className="bg-accent/50 border-border">
              <AlertCircle className="h-4 w-4 text-foreground" />
              <AlertDescription className="text-sm text-foreground">
                <strong>Important:</strong> After updating your email, you'll need to sign in with your new Google account. Your profile data and order history will remain intact.
              </AlertDescription>
            </Alert>

            <Form {...changeEmailForm}>
              <form onSubmit={changeEmailForm.handleSubmit(handleChangeEmail)} className="space-y-4">
                <FormField
                  control={changeEmailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-foreground">New Email Address</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary w-4 h-4 transition-colors" />
                          <Input 
                            {...field} 
                            placeholder="you@example.com" 
                            type="email"
                            className="pl-10 pr-4 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm transition-all"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep("show-email")}
                    className="flex-1 h-11 border-border hover:bg-accent rounded-xl transition-all duration-200"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      "Update Email"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-card rounded-xl border border-border">
            <img src="/splash_logo.svg" alt="Sillobyte Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Forgot Email?
          </h1>
          <p className="text-sm text-muted-foreground">
            We'll help you recover your account
          </p>
        </div>

        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {step === "lookup" && (
          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={onBackToLogin}
              className="text-sm text-foreground hover:text-foreground/80 h-auto py-2"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}