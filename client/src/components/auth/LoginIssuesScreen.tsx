import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const loginIssueSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  phoneNumber: z.string().min(10, "Valid phone number is required").optional().or(z.literal("")),
  registerNumber: z.string().optional().or(z.literal("")),
  staffId: z.string().optional().or(z.literal("")),
  userType: z.enum(["student", "staff"]),
  issueType: z.enum([
    "forgot_email",
    "account_locked", 
    "email_changed",
    "registration_problem",
    "other"
  ]),
  description: z.string().min(10, "Please provide a detailed description (at least 10 characters)"),
});

type LoginIssueForm = z.infer<typeof loginIssueSchema>;

interface LoginIssuesScreenProps {
  onBackToLogin: () => void;
}

export default function LoginIssuesScreen({ onBackToLogin }: LoginIssuesScreenProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<LoginIssueForm>({
    resolver: zodResolver(loginIssueSchema),
    defaultValues: {
      userType: "student",
      issueType: "forgot_email",
    },
  });

  const userType = watch("userType");
  const issueType = watch("issueType");

  const submitIssueMutation = useMutation({
    mutationFn: async (data: LoginIssueForm) => {
      // Remove userType from the data as it's not part of the schema
      const { userType, ...issueData } = data;
      return apiRequest("/api/login-issues", {
        method: "POST",
        body: JSON.stringify(issueData),
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (error) => {
      console.error("Error submitting login issue:", error);
    },
  });

  const onSubmit = (data: LoginIssueForm) => {
    submitIssueMutation.mutate(data);
  };

  const issueTypeOptions = [
    { value: "forgot_email", label: "Forgot Email Address" },
    { value: "account_locked", label: "Account Locked" },
    { value: "email_changed", label: "Email Changed" },
    { value: "registration_problem", label: "Registration Problem" },
    { value: "other", label: "Other Issue" },
  ];

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Report Submitted</h2>
            <p className="text-sm text-muted-foreground">
              Our admin team will review your request and contact you soon.
            </p>
            <Button onClick={onBackToLogin} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex items-center justify-center p-3 overflow-hidden">
      <div className="w-full max-w-[420px] h-full flex flex-col space-y-3">
        <div className="text-center space-y-1.5 flex-shrink-0">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[hsl(0,0%,85%)] dark:bg-card rounded-xl border border-border">
            <img src="/splash_logo.svg" alt="Sillobyte Logo" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Report Login Issue
          </h1>
          <p className="text-xs text-muted-foreground">
            Having trouble logging in? Tell us about it.
          </p>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col min-h-0">
          <CardContent className="p-4 flex-1 overflow-y-auto min-h-0">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 h-full flex flex-col">
              <div className="space-y-2.5 flex-shrink-0">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-foreground">Full Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter your full name"
                    className={`h-9 text-sm transition-all ${errors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "focus:ring-primary/20"}`}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">I am a *</Label>
                  <RadioGroup
                    value={userType}
                    onValueChange={(value) => setValue("userType", value as "student" | "staff")}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="student" id="student" className="border-2 w-4 h-4" />
                      <Label htmlFor="student" className="text-xs font-medium cursor-pointer">Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="staff" id="staff" className="border-2 w-4 h-4" />
                      <Label htmlFor="staff" className="text-xs font-medium cursor-pointer">Staff</Label>
                    </div>
                  </RadioGroup>
                </div>

                {userType === "student" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="registerNumber" className="text-xs font-semibold text-foreground">Register Number</Label>
                    <Input
                      id="registerNumber"
                      {...register("registerNumber")}
                      placeholder="711523ABC123"
                      className="h-9 text-sm transition-all focus:ring-primary/20"
                    />
                    {errors.registerNumber && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.registerNumber.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="staffId" className="text-xs font-semibold text-foreground">Staff ID</Label>
                    <Input
                      id="staffId"
                      {...register("staffId")}
                      placeholder="123456"
                      className="h-9 text-sm transition-all focus:ring-primary/20"
                    />
                    {errors.staffId && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.staffId.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 flex-shrink-0">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email Address</Label>
                  <Input
                    id="email"
                    {...register("email")}
                    type="email"
                    placeholder="your.email@example.com"
                    className={`h-9 text-sm transition-all ${errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "focus:ring-primary/20"}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-xs font-semibold text-foreground">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    {...register("phoneNumber")}
                    type="tel"
                    placeholder="Enter your phone number"
                    className={`h-9 text-sm transition-all ${errors.phoneNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "focus:ring-primary/20"}`}
                  />
                  {errors.phoneNumber && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.phoneNumber.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 flex-1 min-h-0 flex flex-col">
                <div className="space-y-1.5 flex-shrink-0">
                  <Label htmlFor="issueType" className="text-xs font-semibold text-foreground">Type of Issue *</Label>
                  <Select
                    value={issueType}
                    onValueChange={(value) => setValue("issueType", value as any)}
                  >
                    <SelectTrigger className="h-9 text-sm transition-all focus:ring-primary/20">
                      <SelectValue placeholder="Select the type of issue" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <Label htmlFor="description" className="text-xs font-semibold text-foreground">Detailed Description *</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Describe your issue in detail..."
                    rows={3}
                    className={`text-sm transition-all resize-none flex-1 min-h-[60px] ${errors.description ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "focus:ring-primary/20"}`}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-1 flex-shrink-0">
                <Button 
                  type="submit" 
                  disabled={!isValid || submitIssueMutation.isPending}
                  className="w-full h-10 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitIssueMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit Report"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onBackToLogin}
            className="text-xs text-foreground hover:text-primary transition-colors h-auto py-1 px-3"
            disabled={submitIssueMutation.isPending}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
}