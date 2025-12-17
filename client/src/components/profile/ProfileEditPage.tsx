import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, ArrowLeft, Save, CheckCircle } from "lucide-react";
import { useActiveDepartments } from "@/hooks/useDepartments";
import { useActiveColleges, useDepartmentsByCollege } from "@/hooks/useColleges";
import { useAuthSync } from "@/hooks/useDataSync";
import { useTheme } from "@/contexts/ThemeContext";

const profileEditSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name can only contain letters, spaces, periods, hyphens, and apostrophes"),
  phoneNumber: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be less than 15 digits")
    .regex(/^[+]?[0-9\s\-()]+$/, "Phone number can only contain numbers, spaces, hyphens, parentheses, and plus sign"),
});

export default function ProfileEditPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuthSync();
  const { resolvedTheme } = useTheme();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserInfo(user);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, setLocation]);

  const { data: departmentsData } = useActiveDepartments();
  const { data: collegesData } = useActiveColleges();
  const { data: departmentsByCollege } = useDepartmentsByCollege(userInfo?.college);

  const ReadOnlyField = ({ label, value, placeholder = "Not specified" }: { label: string; value: any; placeholder?: string }) => (
    <FormItem>
      <FormLabel className={`text-sm font-medium ${
        resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-900'
      }`}>{label}</FormLabel>
      <div className={`flex items-center h-11 px-3 py-2 text-sm border rounded-lg ${
        resolvedTheme === 'dark' 
          ? 'border-gray-700 bg-gray-800/50 text-gray-400' 
          : 'border-gray-300 bg-gray-50 text-gray-700'
      }`}>
        <span>
          {value || placeholder}
        </span>
      </div>
    </FormItem>
  );


  const form = useForm({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
    },
  });

  // Update form when userInfo changes
  useEffect(() => {
    if (userInfo) {
      form.reset({
        name: userInfo.name || "",
        phoneNumber: userInfo.phoneNumber || "",
      });
    }
  }, [userInfo, form]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const updatedUser = {
        ...userInfo,
        ...data,
        role: userInfo.role,
        registerNumber: userInfo.registerNumber,
        college: userInfo.college,
        department: userInfo.department,
        passingOutYear: userInfo.passingOutYear,
        staffId: userInfo.staffId,
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setLocation("/profile");
    } catch (error) {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  if (!userInfo || !collegesData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        'bg-background'
      }`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4 ${
            resolvedTheme === 'dark' ? 'border-red-500' : 'border-red-600'
          }`}></div>
          <p className={`${
            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      'bg-background'
    }`}>
      {/* Header */}
      <div className="bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
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
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">Edit Personal Information</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <div className={`p-2 rounded-lg mr-3 ${
              resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <User className={`w-5 h-5 ${
                resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`} />
            </div>
            <h2 className={`text-lg font-semibold ${
              resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Personal Information
            </h2>
          </div>
          
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border border-gray-800 shadow-lg' 
              : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className={`pb-4 border-b ${
                    resolvedTheme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                  }`}>
                    <h3 className={`text-sm font-medium mb-4 ${
                      resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      EDITABLE FIELDS
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={`text-sm font-medium ${
                              resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                            }`}>Full Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your full name" 
                                {...field} 
                                className={`h-11 text-sm ${
                                  resolvedTheme === 'dark' 
                                    ? 'bg-gray-800/50 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:border-red-500' 
                                    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-red-500'
                                }`} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={`text-sm font-medium ${
                              resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                            }`}>Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your phone number" 
                                {...field} 
                                className={`h-11 text-sm ${
                                  resolvedTheme === 'dark' 
                                    ? 'bg-gray-800/50 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:border-red-500' 
                                    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-red-500'
                                }`} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`pb-4 border-b ${
                    resolvedTheme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                  }`}>
                    <h3 className={`text-sm font-medium mb-4 ${
                      resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      ACCOUNT INFORMATION
                    </h3>
                    
                    <div className="mb-4">
                      <FormItem>
                        <FormLabel className={`text-sm font-medium ${
                          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                        }`}>Role</FormLabel>
                        <div className={`flex items-center h-11 px-3 py-2 text-sm border rounded-lg ${
                          resolvedTheme === 'dark' 
                            ? 'border-gray-700 bg-gray-800/50 text-gray-400' 
                            : 'border-gray-300 bg-gray-50 text-gray-700'
                        }`}>
                          <span className="capitalize">
                            {userInfo?.role || "Not specified"}
                          </span>
                        </div>
                        <p className={`text-sm mt-2 ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Your role cannot be changed. Contact support if you need to update your role.
                        </p>
                      </FormItem>
                    </div>
                  </div>
                </div>

                {(userInfo?.role === "student" || userInfo?.role === "employee" || userInfo?.role === "contractor" || userInfo?.role === "visitor" || userInfo?.role === "guest" || userInfo?.role === "staff") && (
                  <div className="space-y-4">
                    <div className={`pb-4 border-b ${
                      resolvedTheme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                    }`}>
                      <h3 className={`text-sm font-medium mb-4 ${
                        resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {userInfo?.role === "staff" ? "PROFESSIONAL INFORMATION" : "ACADEMIC INFORMATION"}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(userInfo?.role === "student" || userInfo?.role === "employee" || userInfo?.role === "contractor" || userInfo?.role === "visitor" || userInfo?.role === "guest") && (
                          <>
                            <ReadOnlyField 
                              label="Register Number" 
                              value={userInfo?.registerNumber} 
                            />

                            <ReadOnlyField 
                              label="College" 
                              value={collegesData?.colleges?.find(college => college.id === userInfo?.college)?.name} 
                            />

                            <ReadOnlyField 
                              label="Department" 
                              value={departmentsByCollege?.departments?.find(dept => dept.code === userInfo?.department)?.name} 
                            />

                            <ReadOnlyField 
                              label="Passing Out Year" 
                              value={userInfo?.passingOutYear ? String(userInfo.passingOutYear) : undefined} 
                            />
                          </>
                        )}

                        {userInfo?.role === "staff" && (
                          <>
                            <ReadOnlyField 
                              label="Staff ID" 
                              value={userInfo?.staffId} 
                            />

                            <ReadOnlyField 
                              label="College" 
                              value={collegesData?.colleges?.find(college => college.id === userInfo?.college)?.name} 
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/profile")}
                    className={`flex-1 h-12 ${
                      resolvedTheme === 'dark' 
                        ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-gray-200' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
