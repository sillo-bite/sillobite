import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { User, CheckCircle, School, Briefcase, Calendar, Phone, Hash, Building, Check, X, AlertCircle, ChevronLeft, ChevronRight, ArrowRight, GraduationCap, Building2, Loader2, Search } from "lucide-react";
import { securelyUpdateUserData } from "@/utils/sessionConflictResolver";
import { getDepartmentFullName, calculateCurrentStudyYear, isStudentPassed, validateRegisterNumber, validateStaffId } from "@shared/utils";
import { useActiveDepartments } from "@/hooks/useDepartments";
import { useActiveColleges, useDepartmentsByCollege } from "@/hooks/useColleges";
import { 
  useInstitutionsByType, 
  useDepartmentsByInstitution, 
  useRegistrationFormatsByInstitutionAndDepartment,
  useRegistrationFormatsNoYear
} from "@/hooks/useProfileSetup";
import { useCanteensByInstitution } from "@/hooks/useCanteensByInstitution";
import { useTheme } from "@/contexts/ThemeContext";
import { useReducedMotion } from "@/utils/dropdownAnimations";

const profileSetupSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name can only contain letters, spaces, periods, hyphens, and apostrophes"),
  phoneNumber: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be less than 15 digits")
    .regex(/^[+]?[0-9\s\-()]+$/, "Phone number can only contain numbers, spaces, hyphens, parentheses, and plus sign"),
  role: z.enum(["student", "staff", "employee", "guest", "contractor", "visitor"], { required_error: "Please select your role" }),
  
  // Student fields
  registerNumber: z.string().optional(),
  college: z.string().optional(),
  department: z.string().optional(),
  passingOutYear: z.number().optional(),
  
  // Staff/Employee/Contractor fields
  staffId: z.string().optional(),
  joiningYear: z.number().optional(),
}).refine((data) => {
  if (data.role === "student") {
    if (!data.registerNumber || !data.college || !data.department || !data.passingOutYear) {
      return false;
    }
    // Dynamic validation will be handled in the component, not in schema
    return true;
  }
  if (data.role === "staff") {
    if (!data.staffId || !data.college || !data.joiningYear) {
      return false;
    }
    const validation = validateStaffId(data.staffId);
    return validation.isValid;
  }
  if (data.role === "employee" || data.role === "contractor") {
    if (!data.registerNumber || !data.college || !data.department || !data.joiningYear) {
      return false;
    }
    // Dynamic validation will be handled in the component, not in schema
    return true;
  }
  if (data.role === "visitor" || data.role === "guest") {
    if (!data.registerNumber || !data.college || !data.department) {
      return false;
    }
    // Dynamic validation will be handled in the component, not in schema
    return true;
  }
  return true;
}, {
  message: "Please fill all required fields correctly for your role (including college for all roles)",
});

type ProfileSetupForm = z.infer<typeof profileSetupSchema>;

interface ProfileSetupScreenProps {
  userEmail: string;
  userName: string;
  onComplete: (userData: any) => void;
  onBackToLogin: () => void;
}

// Wrapper component that handles URL parameters
function ProfileSetupScreenWrapper() {
  const [, setLocation] = useLocation();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const hasCheckedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple checks and redirects
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    // Extract email and name from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || '';
    const name = urlParams.get('name') || '';
    
    setUserEmail(email);
    setUserName(name);
    
    // If no email is provided, redirect to login (only once)
    if (!email && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      setLocation('/login');
      return; // Exit early to prevent further execution
    }
  }, []); // Empty dependency array - only run once on mount

  const handleComplete = (userData: any) => {
    // Store user data and redirect to home
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('session_timestamp', Date.now().toString());
    setLocation('/app');
  };

  const handleBackToLogin = () => {
    setLocation('/login');
  };

  // Show loading while extracting URL parameters
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading...</h2>
          <p className="text-muted-foreground">Preparing your profile setup</p>
        </div>
      </div>
    );
  }

  return (
    <ProfileSetupScreen 
      userEmail={userEmail}
      userName={userName}
      onComplete={handleComplete}
      onBackToLogin={handleBackToLogin}
    />
  );
}

// Simplified schema for QR code users
// Name is required but can be pre-filled from Google Sign-In
const qrProfileSetupSchema = z.object({
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

type QRProfileSetupForm = z.infer<typeof qrProfileSetupSchema>;

interface QRTableData {
  restaurantId: string;
  restaurantName: string;
  tableNumber: string;
  hash?: string;
  timestamp: number;
}

interface OrganizationQRData {
  organizationId: string;
  address: string;
  hash: string;
  timestamp: number;
}

// Original component (exported for use in LoginScreen)
export function ProfileSetupScreen({ userEmail, userName, onComplete, onBackToLogin }: ProfileSetupScreenProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableFormats, setAvailableFormats] = useState<any[]>([]);
  const [isLoadingFormats, setIsLoadingFormats] = useState(false);
  const [institutionType, setInstitutionType] = useState<'college' | 'organization' | null>(null);
  const [isCheckingRegisterNumber, setIsCheckingRegisterNumber] = useState(false);
  const [registerNumberCheckResult, setRegisterNumberCheckResult] = useState<{ exists: boolean; message: string } | null>(null);
  const [hasCheckedRegisterNumber, setHasCheckedRegisterNumber] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Check for QR code context - check synchronously on mount
  const orgContextData = typeof window !== 'undefined' ? sessionStorage.getItem('orgContext') : null;
  const initialOrgContext = orgContextData ? (() => {
    try {
      return JSON.parse(orgContextData) as { organizationId: string; organizationName: string; fullAddress?: any };
    } catch {
      return null;
    }
  })() : null;
  
  const [orgContext, setOrgContext] = useState<{ organizationId: string; organizationName: string; fullAddress?: any } | null>(initialOrgContext);
  const [isOrgGuestUser, setIsOrgGuestUser] = useState(!!initialOrgContext);
  
  const pendingQRData = typeof window !== 'undefined' ? sessionStorage.getItem('pendingQRTableData') : null;
  const initialQRData = pendingQRData ? (() => {
    try {
      const data = JSON.parse(pendingQRData) as QRTableData;
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      if (data.timestamp > tenMinutesAgo) {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  })() : null;
  
  const [qrTableData, setQrTableData] = useState<QRTableData | null>(initialQRData);
  const [isQRUser, setIsQRUser] = useState(!!(initialOrgContext || initialQRData));
  
  // Helper function to clear React Query cache
  const clearProfileSetupCache = () => {
    queryClient.removeQueries({ queryKey: ['institutions'] });
    queryClient.removeQueries({ queryKey: ['departments'] });
    queryClient.removeQueries({ queryKey: ['registrationFormats'] });
    queryClient.removeQueries({ queryKey: ['registration-formats'] });
  };

  // Helper function to reset register number check state
  const resetRegisterNumberCheckState = () => {
    setRegisterNumberCheckResult(null);
    setHasCheckedRegisterNumber(false);
    setValidationError(null);
  };

  // Helper function to reset form to default values
  const resetFormToDefaults = () => {
    form.reset({
      name: userName || "",
      phoneNumber: "",
      role: undefined,
      registerNumber: "",
      college: "",
      department: "",
      passingOutYear: undefined,
      staffId: "",
      joiningYear: undefined,
    });
  };

  // Helper function to reset all component state
  const resetAllState = () => {
    setCurrentStep(1);
    setInstitutionType(null);
    setAvailableFormats([]);
    setIsLoadingFormats(false);
    setIsCheckingRegisterNumber(false);
    resetRegisterNumberCheckState();
    setApiCallsEnabled({
      institutions: false,
      departments: false,
      registrationFormats: false
    });
  };

  // Clear all state and cache on component mount to prevent caching issues
  useEffect(() => {
    resetAllState();
    clearProfileSetupCache();
    console.log('🧹 Cleared all state and cache on component mount');
    
    // Log organization context detection
    if (initialOrgContext) {
      console.log('🏢 Organization context detected in profile setup (synchronous):', initialOrgContext);
    }
  }, []); // Only run on mount
  
  // Reset form when component mounts (after form is initialized)
  useEffect(() => {
    resetFormToDefaults();
  }, [userName]); // Reset when userName changes or on mount

  // Simplified form for QR users
  // Pre-fill name from Google Sign-In (userName prop) for all QR users
  const qrForm = useForm<QRProfileSetupForm>({
    resolver: zodResolver(qrProfileSetupSchema),
    mode: "onChange",
    defaultValues: {
      name: userName || "", // Pre-fill with name from Google Sign-In
      phoneNumber: "",
    },
  });

  // Watch QR form values to enable/disable button (different names to avoid conflict with regular form)
  const qrWatchedName = qrForm.watch("name");
  const qrWatchedPhoneNumber = qrForm.watch("phoneNumber");
  
  // Check if QR form is valid based on field values
  const isFormValid = useMemo(() => {
    const nameValid = qrWatchedName && qrWatchedName.trim().length >= 2 && /^[a-zA-Z\s.'-]+$/.test(qrWatchedName);
    const phoneValid = qrWatchedPhoneNumber && qrWatchedPhoneNumber.replace(/[\s\-()]/g, '').length >= 10 && qrWatchedPhoneNumber.replace(/[\s\-()]/g, '').length <= 15 && /^[+]?[0-9\s\-()]+$/.test(qrWatchedPhoneNumber);
    return nameValid && phoneValid;
  }, [qrWatchedName, qrWatchedPhoneNumber]);

  // Regular form for normal users
  const form = useForm<ProfileSetupForm>({
    resolver: zodResolver(profileSetupSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      name: userName || "",
      phoneNumber: "",
      role: undefined,
      registerNumber: "",
      college: "",
      department: "",
      passingOutYear: undefined,
      staffId: "",
      joiningYear: undefined,
    },
  });

  const watchedRole = form.watch("role");
  const watchedRegisterNumber = form.watch("registerNumber");
  const watchedName = form.watch("name");
  const watchedPhoneNumber = form.watch("phoneNumber");
  const watchedCollege = form.watch("college");
  const watchedPassingOutYear = form.watch("passingOutYear");
  const watchedJoiningYear = form.watch("joiningYear");

  // Helper functions for role checking
  const needsRegisterNumber = (role: string | undefined = watchedRole): boolean => {
    return role === "student" || role === "employee" || role === "guest" || role === "contractor" || role === "visitor";
  };

  // Step definitions - Reorganized into 4 steps
  const steps = [
    { id: 1, title: "Institution & Role", description: "Select your institution and role" },
    { id: 2, title: "Department & Year", description: "Choose your department and academic year" },
    { id: 3, title: "Registration Details", description: "Enter your registration number" },
    { id: 4, title: "Complete Profile", description: "Finalize your profile information" }
  ];
  
  // State to control when API calls should be made
  const [apiCallsEnabled, setApiCallsEnabled] = useState({
    institutions: false,
    departments: false,
    registrationFormats: false
  });

  // Enable institutions API call when institution type is selected
  useEffect(() => {
    if (institutionType) {
      console.log('🔌 Enabling institutions API call for institution type:', institutionType);
      setApiCallsEnabled(prev => ({ ...prev, institutions: true }));
    }
  }, [institutionType]);

  // Enable departments API call when college is selected
  useEffect(() => {
    if (watchedCollege) {
      console.log('🔌 Enabling departments API call for college:', watchedCollege);
      setApiCallsEnabled(prev => ({ ...prev, departments: true }));
    }
  }, [watchedCollege]);
  
  // OPTIMIZED: Step-specific API calls with lazy loading
  // Step 2: Get institutions by type (only when institutionType is selected and enabled)
  const { data: institutionsData, isLoading: institutionsLoading } = useInstitutionsByType(institutionType, apiCallsEnabled.institutions);
  
  // Debug logging for institutions data
  useEffect(() => {
    console.log(`🏫 ProfileSetupScreen - Institution type: ${institutionType}`);
    console.log(`🏫 ProfileSetupScreen - API calls enabled:`, apiCallsEnabled);
    console.log(`🏫 ProfileSetupScreen - Institutions loading:`, institutionsLoading);
    console.log(`🏫 ProfileSetupScreen - Institutions data:`, institutionsData);
    if (institutionType && institutionsData) {
      console.log(`🏫 ProfileSetupScreen - Institutions array:`, institutionsData?.institutions);
      console.log(`🏫 ProfileSetupScreen - Institutions count:`, institutionsData?.institutions?.length || 0);
    }
  }, [institutionType, institutionsData, institutionsLoading, apiCallsEnabled]);
  
  // Step 4: Get departments by institution (only when both institutionType and college are selected and enabled)
  const { data: departmentsData, isLoading: departmentsLoading } = useDepartmentsByInstitution(
    institutionType, 
    watchedCollege || null,
    apiCallsEnabled.departments
  );
  
  // Debug logging for departments data
  useEffect(() => {
    if (institutionType && watchedCollege && departmentsData) {
      console.log(`🏫 ProfileSetupScreen - Institution type: ${institutionType}`);
      console.log(`🏫 ProfileSetupScreen - Selected college: ${watchedCollege}`);
      console.log(`🏫 ProfileSetupScreen - Departments data:`, departmentsData);
      console.log(`🏫 ProfileSetupScreen - Departments array:`, departmentsData?.departments);
      console.log(`🏫 ProfileSetupScreen - Departments count:`, departmentsData?.departments?.length || 0);
    }
  }, [institutionType, watchedCollege, departmentsData]);
  
  // Step 6: Get registration formats (only when institution, department, and role are selected and enabled)
  // Use different hooks based on role requirements:
  // - Student roles: use useRegistrationFormatsByInstitutionAndDepartment (with year filtering)
  // - Employee/Staff/Contractor roles: use useRegistrationFormatsNoYear (no year filtering, but still collect joining year)
  // - Guest/Visitor roles: use useRegistrationFormatsNoYear (no year filtering, no year collection)
  
  // Helper functions for role checking (used for API hooks)
  const isStudentRole = watchedRole === 'student';
  const isEmployeeRole = watchedRole === 'employee' || watchedRole === 'staff' || watchedRole === 'contractor';
  const isGuestRole = watchedRole === 'guest' || watchedRole === 'visitor';
  
  // Hook for student roles (with year filtering) - only for colleges
  const { data: studentFormatsData, isLoading: studentFormatsLoading } = useRegistrationFormatsByInstitutionAndDepartment(
    institutionType,
    watchedCollege || null,
    form.watch("department") || null,
    institutionType === 'college' ? (watchedPassingOutYear || null) : null, // Organizations don't have students
    watchedRole || null,
    apiCallsEnabled.registrationFormats && isStudentRole && institutionType === 'college'
  );
  
  // Hook for employee/staff/contractor roles (no year filtering, but still collect joining year for storage)
  const { data: employeeFormatsData, isLoading: employeeFormatsLoading } = useRegistrationFormatsNoYear(
    institutionType,
    watchedCollege || null,
    form.watch("department") || null,
    watchedRole || null,
    apiCallsEnabled.registrationFormats && isEmployeeRole
  );
  
  // Hook for guest/visitor roles (no year filtering, no year collection)
  const { data: guestFormatsData, isLoading: guestFormatsLoading } = useRegistrationFormatsNoYear(
    institutionType,
    watchedCollege || null,
    form.watch("department") || null,
    watchedRole || null,
    apiCallsEnabled.registrationFormats && isGuestRole
  );
  
  // Combine the data from all hooks
  const registrationFormatsData = (isStudentRole && institutionType === 'college') ? studentFormatsData : 
                                 isEmployeeRole ? employeeFormatsData : 
                                 guestFormatsData;
  const registrationFormatsLoading = (isStudentRole && institutionType === 'college') ? studentFormatsLoading : 
                                    isEmployeeRole ? employeeFormatsLoading : 
                                    guestFormatsLoading;
  
  // Debug logging for registration formats data
  useEffect(() => {
    // Log based on which hook is being used
    
    if (institutionType && watchedCollege && form.watch("department") && watchedRole && registrationFormatsData) {
      const hookType = (isStudentRole && institutionType === 'college') ? 'STUDENT (with year filtering)' : 
                      isEmployeeRole ? 'EMPLOYEE (no year filtering, but collect joining year)' : 
                      'GUEST (no year filtering, no year collection)';
      
      console.log(`📋 ProfileSetupScreen - Using ${hookType} hook for ${watchedRole} role in ${institutionType}`);
      console.log(`📋 ProfileSetupScreen - Registration formats data:`, registrationFormatsData);
      console.log(`📋 ProfileSetupScreen - Formats count: ${registrationFormatsData?.formats?.length || 0}`);
      console.log(`📋 ProfileSetupScreen - Total formats found: ${registrationFormatsData?.totalFormatsFound || 0}`);
      console.log(`📋 ProfileSetupScreen - Filtered formats count: ${registrationFormatsData?.filteredFormatsCount || 0}`);
      
      if (isStudentRole && institutionType === 'college') {
        console.log(`📋 ProfileSetupScreen - Requested passing out year: ${registrationFormatsData?.passingOutYear}`);
      } else if (isEmployeeRole) {
        console.log(`📋 ProfileSetupScreen - No year filtering for ${watchedRole} role, but joining year collected for storage: ${watchedJoiningYear}`);
      } else {
        console.log(`📋 ProfileSetupScreen - No year filtering for ${watchedRole} role`);
      }
      console.log(`📋 ProfileSetupScreen - Converted ${watchedRole === "student" ? "study year" : "joining year"}: ${registrationFormatsData?.studyYear || registrationFormatsData?.joiningYear}`);
      console.log(`📋 ProfileSetupScreen - Requested role: ${registrationFormatsData?.role}`);
      console.log(`📋 ProfileSetupScreen - Filtering criteria:`, registrationFormatsData?.filteringCriteria);
      
      // Log complete API response structure
      console.log(`📋 ===== PROFILE SETUP SCREEN - COMPLETE API DATA =====`);
      console.log(`📋 Response Success: ${registrationFormatsData?.success}`);
      console.log(`📋 Institution Type: ${registrationFormatsData?.institutionType}`);
      console.log(`📋 Institution ID: ${registrationFormatsData?.institutionId}`);
      console.log(`📋 Department Code: ${registrationFormatsData?.departmentCode}`);
      console.log(`📋 Passing Out Year: ${registrationFormatsData?.passingOutYear}`);
      console.log(`📋 Study Year: ${registrationFormatsData?.studyYear}`);
      console.log(`📋 Role: ${registrationFormatsData?.role}`);
      console.log(`📋 Total Formats Found: ${registrationFormatsData?.totalFormatsFound}`);
      console.log(`📋 Filtered Formats Count: ${registrationFormatsData?.filteredFormatsCount}`);
      console.log(`📋 Filtering Criteria:`, registrationFormatsData?.filteringCriteria);
      console.log(`📋 Complete API Response Object:`, registrationFormatsData);
      
      // Log only the requested role format details
      if (registrationFormatsData?.formats) {
        registrationFormatsData.formats.forEach((format: any, index: number) => {
          console.log(`📋 ProfileSetupScreen - Format ${index + 1}: "${format.name}" (Year: ${format.year})`);
          
          // Only log the requested role format
          const requestedRoleFormat = format.formats?.[watchedRole];
          if (requestedRoleFormat) {
            console.log(`📋 ProfileSetupScreen - Format "${format.name}" - ${watchedRole} role:`, {
              totalLength: requestedRoleFormat.totalLength,
              structureLength: requestedRoleFormat.structure?.length || 0,
              example: requestedRoleFormat.example,
              description: requestedRoleFormat.description
            });
          }
        });
      }
    }
  }, [institutionType, watchedCollege, form.watch("department"), watchedPassingOutYear, watchedJoiningYear, watchedRole, registrationFormatsData]);
  
  
  // REMOVED: Old API calls replaced with optimized step-specific APIs
  
  // REMOVED: Old organization departments API call
  
  // OPTIMIZED: Use the new optimized departments data
  const currentDepartmentsData = departmentsData;
  const currentDepartmentsLoading = departmentsLoading;
  const watchedStaffId = form.watch("staffId");
  const watchedDepartment = form.watch("department");
  
  // Calculate progress based on filled fields
  // Only count fields that user has actively filled, not pre-filled values
  const progressPercentage = useMemo(() => {
    let progress = 0;
    const stepWeight = 100 / steps.length; // 25% per step
    
    // Step 1: Institution & Role (25%)
    if (institutionType) progress += stepWeight / 3; // 8.33%
    if (watchedCollege) progress += stepWeight / 3; // 8.33%
    if (watchedRole) progress += stepWeight / 3; // 8.33%
    
    // Step 2: Department & Year (25%)
    if (watchedDepartment) progress += stepWeight / 2; // 12.5%
    if (watchedRole === "student" && watchedPassingOutYear) {
      progress += stepWeight / 2; // 12.5%
    } else if ((watchedRole === "staff" || watchedRole === "employee" || watchedRole === "contractor") && watchedJoiningYear) {
      progress += stepWeight / 2; // 12.5%
    } else if ((watchedRole === "visitor" || watchedRole === "guest")) {
      // Visitor/Guest don't need year, so department completion gives full step weight
      if (watchedDepartment) progress += stepWeight / 2; // 12.5%
    }
    
    // Step 3: Registration Details (25%)
    if (watchedRole === "staff" && watchedStaffId) {
      progress += stepWeight; // 25%
    } else if (needsRegisterNumber() && watchedRegisterNumber) {
      progress += stepWeight; // 25%
    }
    
    // Step 4: Complete Profile (25%)
    // Only count if user has completed at least Step 1 (institution type selected)
    // This prevents counting pre-filled name from showing progress before user starts
    if (institutionType) {
      // Check if name was changed from the initial value (user actively filled it)
      const initialName = userName || "";
      const nameWasChanged = watchedName && watchedName.trim().length > 0 && watchedName !== initialName;
      if (nameWasChanged || (watchedName && watchedName.trim().length > 0 && !initialName)) {
        progress += stepWeight / 2; // 12.5%
      }
      if (watchedPhoneNumber && watchedPhoneNumber.trim().length > 0) {
        progress += stepWeight / 2; // 12.5%
      }
    }
    
    return Math.min(Math.round(progress), 100);
  }, [
    institutionType,
    watchedCollege,
    watchedRole,
    watchedDepartment,
    watchedPassingOutYear,
    watchedJoiningYear,
    watchedStaffId,
    watchedRegisterNumber,
    watchedName,
    watchedPhoneNumber,
    userName,
    steps.length
  ]);
  
  // Get active roles for the selected institution
  const selectedInstitutionData = institutionsData?.institutions?.find((institution: any) => institution.id === watchedCollege);
  // OPTIMIZED: Use unified institution data
  const activeRoles = institutionType === 'college' 
    ? (selectedInstitutionData?.activeRoles || {
        student: true,
        staff: true,
        employee: true,
        guest: true,
        contractor: true,
        visitor: true
      })
    : (selectedInstitutionData?.activeRoles || {
        employee: true,
        contractor: true,
        visitor: true,
        guest: true
      });
  
  // Debug logging for department loading
  useEffect(() => {
    console.log('🔍 Department Debug Info:', {
      watchedCollege,
      institutionType,
      currentDepartmentsLoading,
      currentDepartmentsData,
      departmentsCount: currentDepartmentsData?.departments?.length || 0
    });
  }, [watchedCollege, institutionType, currentDepartmentsLoading, currentDepartmentsData]);
  
  // Trigger validation when prerequisites change to show errors immediately
  useEffect(() => {
    if (institutionType && !watchedCollege) {
      form.trigger("college");
    }
  }, [institutionType, watchedCollege, form]);
  
  useEffect(() => {
    if (watchedCollege && !watchedDepartment && needsRegisterNumber()) {
      form.trigger("department");
    }
  }, [watchedCollege, watchedDepartment, watchedRole, form]);
  
  useEffect(() => {
    if (watchedDepartment && !watchedPassingOutYear && watchedRole === "student") {
      form.trigger("passingOutYear");
    }
  }, [watchedDepartment, watchedPassingOutYear, watchedRole, form]);
  
  useEffect(() => {
    if (watchedDepartment && !watchedJoiningYear && (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor")) {
      form.trigger("joiningYear");
    }
  }, [watchedDepartment, watchedJoiningYear, watchedRole, form]);
  
  // REMOVED: Old debug logging for college data

  // Helper function to calculate academic year and study year
  const getAcademicYearInfo = (passingOutYear: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    // Test: Log the actual date to verify it's correct
    console.log('Current Date Info:', {
      fullDate: currentDate.toString(),
      year: currentYear,
      month: currentMonth,
      monthName: currentDate.toLocaleString('default', { month: 'long' }),
      day: currentDate.getDate()
    });
    
    // Academic year runs from June to June
    // If current month is June or later, we're in the academic year that started in current year
    // If current month is before June, we're still in the academic year that started in previous year
    const currentAcademicYear = currentMonth >= 5 ? currentYear : currentYear - 1; // 5 = June (0-indexed)
    
    // Calculate study year based on academic year
    // For 4-year degree: 
    // - Year 1 students pass out in 4 years (currentAcademicYear + 3)
    // - Year 2 students pass out in 3 years (currentAcademicYear + 2)  
    // - Year 3 students pass out in 2 years (currentAcademicYear + 1)
    // - Year 4 students pass out in 1 year (currentAcademicYear)
    // 
    // If passing out in 2027 and current academic year is 2025:
    // Years remaining = 2027 - 2025 = 2 years
    // Study year = 4 - years remaining = 4 - 2 = Year 2
    // 
    // But you said it should be Year 3, so let me try: studyYear = years remaining + 1
    const yearsRemaining = passingOutYear - currentAcademicYear;
    const studyYear = yearsRemaining + 1;
    
    // Debug logging
    console.log('Academic Year Calculation:', {
      currentYear,
      currentMonth,
      currentMonthName: currentDate.toLocaleString('default', { month: 'long' }),
      currentAcademicYear,
      passingOutYear,
      yearsRemaining,
      studyYear,
      calculation: `${yearsRemaining} + 1 = ${studyYear}`,
      isJuneOrLater: currentMonth >= 5,
      academicYearLogic: currentMonth >= 5 ? `${currentYear} (June or later)` : `${currentYear - 1} (before June)`
    });
    
    return {
      currentAcademicYear,
      studyYear
    };
  };

  // Step navigation functions
  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= steps.length) {
      setCurrentStep(step);
    }
  };

  // OPTIMIZED: Use the new optimized registration formats API
  const fetchAvailableFormats = async (institutionId: string, deptCode: string, year: number) => {
    console.log('🔍 Using optimized formats API for:', { institutionType, institutionId, deptCode, year, role: watchedRole });
    
    // Use the optimized API data that's already being fetched
    if (registrationFormatsData?.formats) {
      console.log('📋 Using cached format data:', registrationFormatsData.formats);
      
      // API now returns an array of relevant formats
      setAvailableFormats(registrationFormatsData.formats);
    } else {
      console.log('❌ No format data available yet');
      setAvailableFormats([]);
    }
  };

  // OPTIMIZED: Auto-fetch formats when department, year, and role are selected using optimized API
  useEffect(() => {
    if (watchedCollege && watchedDepartment && watchedRole && institutionType && registrationFormatsData?.formats) {
      if (watchedRole === "student" && watchedPassingOutYear) {
        const { studyYear } = getAcademicYearInfo(watchedPassingOutYear);
        fetchAvailableFormats(watchedCollege, watchedDepartment, studyYear);
      } else if (watchedRole === "staff" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor") {
        // For staff/employee/guest/contractor/visitor, we don't need year, but we still need to fetch formats
        fetchAvailableFormats(watchedCollege, watchedDepartment, 0);
      } else {
        setAvailableFormats([]);
      }
    } else {
      setAvailableFormats([]);
    }
  }, [watchedCollege, watchedDepartment, watchedPassingOutYear, watchedRole, institutionType, registrationFormatsData]);

  // Re-validate registration number when available formats change
  useEffect(() => {
    if (watchedRegisterNumber && availableFormats.length > 0) {
      // Trigger form validation to re-evaluate the registration number
      form.trigger('registerNumber');
    }
  }, [availableFormats, watchedRegisterNumber, form]);

  // Real-time validation helpers
  const getNameValidation = (name: string) => {
    if (!name) return { isValid: false, message: "Name is required" };
    if (name.length < 2) return { isValid: false, message: "Name must be at least 2 characters" };
    if (name.length > 50) return { isValid: false, message: "Name must be less than 50 characters" };
    if (!/^[a-zA-Z\s.'-]+$/.test(name)) return { isValid: false, message: "Name can only contain letters, spaces, periods, hyphens, and apostrophes" };
    return { isValid: true, message: "" };
  };

  const getPhoneValidation = (phone: string) => {
    if (!phone) return { isValid: false, message: "Phone number is required" };
    if (phone.length < 10) return { isValid: false, message: "Phone number must be at least 10 digits" };
    if (phone.length > 15) return { isValid: false, message: "Phone number must be less than 15 digits" };
    if (!/^[+]?[0-9\s\-()]+$/.test(phone)) return { isValid: false, message: "Phone number can only contain numbers, spaces, hyphens, parentheses, and plus sign" };
    return { isValid: true, message: "" };
  };

  // Helper function to validate complex types like number ranges and years
  const validateComplexTypes = (registerNumber: string, structure: any[]) => {
    console.log('🔍 validateComplexTypes called for:', registerNumber);
    console.log('📋 Structure:', structure);
    
    for (const position of structure) {
      if (position.type === 'numbers_range' && position.range) {
        // Validate number range
        const startPos = position.range.positions[0];
        const endPos = position.range.positions[position.range.positions.length - 1];
        const rangeValue = registerNumber.slice(startPos - 1, endPos);
        
        // Create dynamic pattern based on expected digit count
        const expectedDigitCount = position.range.positions.length;
        const digitPattern = new RegExp(`^\\d{${expectedDigitCount}}$`);
        
        if (!digitPattern.test(rangeValue)) {
          return {
            isValid: false,
            error: `Position ${startPos}-${endPos} should be a ${expectedDigitCount}-digit number but got "${rangeValue}"`
          };
        }
        
        const numValue = parseInt(rangeValue);
        if (numValue < position.range.min || numValue > position.range.max) {
          return {
            isValid: false,
            error: `Position ${startPos}-${endPos} should be between ${position.range.min} and ${position.range.max} but got "${rangeValue}"`
          };
        }
      } else if (position.type === 'year' && position.range?.positions) {
        // Validate year format
        const startPos = position.range.positions[0];
        const endPos = position.range.positions[position.range.positions.length - 1];
        const yearValue = registerNumber.slice(startPos - 1, endPos);
        
        // Create dynamic pattern based on expected digit count
        const expectedDigitCount = position.range.positions.length;
        const digitPattern = new RegExp(`^\\d{${expectedDigitCount}}$`);
        
        if (!digitPattern.test(yearValue)) {
          return {
            isValid: false,
            error: `Position ${startPos}-${endPos} should be a ${expectedDigitCount}-digit year but got "${yearValue}"`
          };
        }
        // The dynamic pattern above already handles all digit counts, so remove this redundant check
      } else if (position.type === 'fixed' && position.range?.positions && position.range.positions.length > 1) {
        // Validate merged fixed positions
        const startPos = position.range.positions[0];
        const endPos = position.range.positions[position.range.positions.length - 1];
        const actualValue = registerNumber.slice(startPos - 1, endPos);
        const expectedValue = position.value || '';
        
        if (actualValue !== expectedValue) {
          return {
            isValid: false,
            error: `Position ${startPos}-${endPos} should be "${expectedValue}" but got "${actualValue}"`
          };
        }
      }
    }
    
    return { isValid: true, message: "" };
  };

  // Helper function to calculate year based on yearType and current date
  const calculateYearValue = (position: any, yearValue: number, yearType: 'passingOutYear' | 'joiningYear') => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    // Calculate current academic year (starts in June)
    const currentAcademicYear = currentMonth >= 5 ? currentYear : currentYear - 1;
    
    console.log(`🔍 calculateYearValue: positionYearType=${position.yearType}, userYearValue=${yearValue}, yearType=${yearType}`);
    
    // Handle college year types (starting, passing_out)
    if (position.yearType === 'starting') {
      // For colleges: Calculate starting year based on passing out year and study duration
      if (yearType === 'passingOutYear') {
        const yearsRemaining = yearValue - currentAcademicYear;
        const studyYear = yearsRemaining + 1;
        const startingYear = currentAcademicYear - (studyYear - 1);
        console.log(`🔍 College starting year calculation: passingOutYear=${yearValue}, studyYear=${studyYear}, startingYear=${startingYear}`);
        return startingYear;
      } else {
        // This shouldn't happen - organizations don't use 'starting' year type
        console.log(`🔍 ERROR: Organization format has 'starting' year type - this shouldn't happen`);
        return yearValue;
      }
    } else if (position.yearType === 'passing_out') {
      // For colleges: passing out year
      if (yearType === 'passingOutYear') {
        console.log(`🔍 College passing out year: ${yearValue}`);
        return yearValue;
      } else {
        // This shouldn't happen - organizations don't use 'passing_out' year type
        console.log(`🔍 ERROR: Organization format has 'passing_out' year type - this shouldn't happen`);
        return yearValue;
      }
    }
    
    // Handle organization year types (joining, current)
    else if (position.yearType === 'joining') {
      // For organizations: joining year
      if (yearType === 'joiningYear') {
        console.log(`🔍 Organization joining year: ${yearValue}`);
        return yearValue;
      } else {
        // This shouldn't happen - colleges don't use 'joining' year type
        console.log(`🔍 ERROR: College format has 'joining' year type - this shouldn't happen`);
        return yearValue;
      }
    } else if (position.yearType === 'current') {
      // Current year (for organizations)
      console.log(`🔍 Organization current year: ${currentYear}`);
      return currentYear;
    } else {
      // Fallback to current year
      console.log(`🔍 Fallback to current year: ${currentYear}`);
      return currentYear;
    }
  };

  // Helper function to get position length from range data
  const getPositionLength = (position: any) => {
    if (position.range?.positions?.length) {
      return position.range.positions.length;
    }
    if (position.value) {
      return position.value.length;
    }
    return 1; // Default fallback
  };

  const getRegisterNumberValidation = (registerNumber: string) => {
    if (!registerNumber && needsRegisterNumber()) return { isValid: false, message: "Registration number is required" };
    if (!registerNumber) return { isValid: null, message: "" };
    
    // If we have available formats, validate against them dynamically
    if (availableFormats.length > 0) {
      console.log(`🔍 ===== VALIDATION START =====`);
      console.log(`🔍 Validating: "${registerNumber}"`);
      console.log(`🔍 Institution Type: ${institutionType}`);
      console.log(`🔍 Role: ${watchedRole}`);
      console.log(`🔍 Available formats:`, availableFormats.map(f => ({
        name: f.name,
        year: f.year,
        totalLength: f.formats?.[watchedRole]?.totalLength,
        example: f.formats?.[watchedRole]?.example
      })));
      
      // For employee roles in organizations, we need to validate against ALL formats
      // For student roles in colleges, we validate against year-filtered formats
      const isEmployeeRole = institutionType === 'organization' && (watchedRole === 'employee' || watchedRole === 'staff' || watchedRole === 'contractor');
      const isStudentRole = institutionType === 'college' && watchedRole === 'student';
      
      console.log(`🔍 Validation approach: ${isEmployeeRole ? 'EMPLOYEE (validate against all formats)' : isStudentRole ? 'STUDENT (validate against year-filtered formats)' : 'OTHER'}`);
      
      const normalizedRegisterNumber = registerNumber.toUpperCase();
      
      // Check if the registration number matches any of the available formats
      let lastError = '';
      
      for (const format of availableFormats) {
        console.log(`🔍 ===== VALIDATING AGAINST FORMAT: ${format.name} (Year: ${format.year}) =====`);
        
        // Get the role-specific format structure
        const roleFormat = format.formats?.[watchedRole];
        if (!roleFormat || !roleFormat.structure) {
          console.log(`🔍 ❌ No ${watchedRole} format structure found`);
          continue;
        }
        
        // For employee roles, we validate against ALL formats (no year filtering)
        // The API already returns all formats for the role, so we don't need to filter by year
        if (isEmployeeRole) {
          console.log(`🔍 ✅ Validating employee format "${format.name}" - no year filtering needed`);
        }
        
        // For student roles in colleges, the API already filters by year, so we validate all returned formats
        if (isStudentRole) {
          console.log(`🔍 ✅ Validating student format "${format.name}" - year ${format.year} matches expected year`);
        }
        
        console.log(`🔍 Role format structure:`, roleFormat.structure);
        console.log(`🔍 Expected total length: ${roleFormat.totalLength}`);
        console.log(`🔍 Actual input length: ${normalizedRegisterNumber.length}`);
        
        // Check total length first
        if (normalizedRegisterNumber.length !== roleFormat.totalLength) {
          console.log(`🔍 ❌ Length mismatch: expected ${roleFormat.totalLength}, got ${normalizedRegisterNumber.length}`);
          lastError = `Registration number length should be ${roleFormat.totalLength} characters (format: ${format.name})`;
          continue;
        }
        
        // Validate against structure
        const sortedStructure = roleFormat.structure.sort((a: any, b: any) => a.position - b.position);
        let currentPosition = 0;
        let isValid = true;
        let validationDetails: any[] = [];
        
        console.log(`🔍 ===== POSITION-BY-POSITION VALIDATION =====`);
        
        for (const position of sortedStructure) {
          const positionLength = getPositionLength(position);
          const startPos = currentPosition;
          const endPos = currentPosition + positionLength;
          const extractedValue = normalizedRegisterNumber.substring(startPos, endPos);
          
          console.log(`🔍 Position ${position.position}: type="${position.type}", length=${positionLength}, extracted="${extractedValue}"`);
          
          let positionValid = true;
          let positionError = '';
          
          switch (position.type) {
            case 'fixed':
              if (extractedValue !== position.value) {
                positionValid = false;
                positionError = `Expected "${position.value}", got "${extractedValue}"`;
              }
              break;
              
            case 'year':
              // Calculate expected year value based on institution type and role
              let expectedYear: number;
              let yearType: 'passingOutYear' | 'joiningYear';
              
              if (institutionType === 'college') {
                // Colleges use passing out year for students
                expectedYear = calculateYearValue(position, watchedPassingOutYear || 2027, 'passingOutYear');
                yearType = 'passingOutYear';
              } else if (institutionType === 'organization') {
                // Organizations use joining year for employees, staff, contractors
                if (watchedRole === 'employee' || watchedRole === 'staff' || watchedRole === 'contractor') {
                  expectedYear = calculateYearValue(position, watchedJoiningYear || 2020, 'joiningYear');
                  yearType = 'joiningYear';
                } else {
                  // Guest/visitor roles shouldn't have year positions, but fallback to current year
                  expectedYear = calculateYearValue(position, new Date().getFullYear(), 'joiningYear');
                  yearType = 'joiningYear';
                }
              } else {
                // Fallback
                expectedYear = calculateYearValue(position, new Date().getFullYear(), 'passingOutYear');
                yearType = 'passingOutYear';
              }
              
              const isTwoDigit = positionLength === 2;
              const expectedYearStr = isTwoDigit ? expectedYear.toString().slice(-2) : expectedYear.toString();
              
              console.log(`🔍 Year validation: institutionType="${institutionType}", role="${watchedRole}", positionYearType="${position.yearType}", userYearValue="${yearType === 'passingOutYear' ? watchedPassingOutYear : watchedJoiningYear}", expectedYear=${expectedYear}, expectedStr="${expectedYearStr}"`);
              
              if (extractedValue !== expectedYearStr) {
                positionValid = false;
                positionError = `Expected year "${expectedYearStr}" (${position.yearType}), got "${extractedValue}"`;
              }
              break;
              
            case 'numbers_range':
              if (position.range) {
                const number = parseInt(extractedValue, 10);
                if (isNaN(number) || number < position.range.min || number > position.range.max) {
                  positionValid = false;
                  positionError = `Number ${number} is outside range ${position.range.min}-${position.range.max}`;
                }
              }
              break;
              
            case 'digit':
              if (!/^\d$/.test(extractedValue)) {
                positionValid = false;
                positionError = `Expected single digit, got "${extractedValue}"`;
              }
              break;
              
            case 'alphabet':
              if (!/^[A-Z]$/.test(extractedValue)) {
                positionValid = false;
                positionError = `Expected single letter, got "${extractedValue}"`;
              }
              break;
              
            case 'alphanumeric':
              if (!/^[A-Z0-9]$/.test(extractedValue)) {
                positionValid = false;
                positionError = `Expected letter or digit, got "${extractedValue}"`;
              }
              break;
              
            case 'department':
              // Department validation - could be enhanced with actual department codes
              if (!/^[A-Z0-9]+$/.test(extractedValue)) {
                positionValid = false;
                positionError = `Invalid department code format: "${extractedValue}"`;
              }
              break;
              
            default:
              console.log(`🔍 ⚠️ Unknown position type: ${position.type}`);
              break;
          }
          
          validationDetails.push({
            position: position.position,
            type: position.type,
            extracted: extractedValue,
            valid: positionValid,
            error: positionError
          });
          
          if (!positionValid) {
            isValid = false;
            console.log(`🔍 ❌ Position ${position.position} failed: ${positionError}`);
            break;
          } else {
            console.log(`🔍 ✅ Position ${position.position} passed`);
          }
          
          currentPosition += positionLength;
        }
        
        console.log(`🔍 ===== VALIDATION RESULT FOR ${format.name} =====`);
        console.log(`🔍 Overall valid: ${isValid}`);
        console.log(`🔍 Validation details:`, validationDetails);
        
        if (isValid) {
          console.log(`🔍 ✅ VALIDATION SUCCESS: Registration number matches format "${format.name}"`);
          return { isValid: true, message: "" };
        } else {
          const failedPosition = validationDetails.find(d => !d.valid);
          lastError = `Registration number doesn't match format "${format.name}": ${failedPosition?.error || 'Invalid format'}`;
        }
      }
      
      console.log(`🔍 ===== VALIDATION COMPLETE =====`);
      console.log(`🔍 Final result: ${lastError ? 'FAILED' : 'SUCCESS'}`);
      
      // If we get here, no format matched
      return {
        isValid: false,
        message: lastError || `Registration number doesn't match any available format for this department/year. Available formats: ${availableFormats.map(f => f.name).join(', ')}`
      };
    }
    
    // No fallback - require dynamic format validation
    return {
      isValid: false,
      message: "Please complete your profile setup to validate registration number"
    };
  };

  const getStaffIdValidation = (staffId: string) => {
    if (!staffId && watchedRole === "staff") return { isValid: false, message: "Staff ID is required" };
    if (!staffId) return { isValid: null, message: "" };
    const validation = validateStaffId(staffId);
    return {
      isValid: validation.isValid,
      message: validation.isValid ? "" : validation.error || "Invalid format"
    };
  };

  const getCollegeValidation = (college: string) => {
    // If institution type is selected but college is not, show error
    if (institutionType && !college) {
      return { isValid: false, message: `Please select a ${institutionType === 'college' ? 'college' : 'organization'}` };
    }
    // If role is selected but college is not, show error
    if (watchedRole && !college) {
      return { isValid: false, message: `Please select a ${institutionType === 'college' ? 'college' : 'organization'}` };
    }
    if (!college && watchedRole === "student") return { isValid: false, message: "College is required" };
    if (!college) return { isValid: null, message: "" };
    
    // Check for special values that are not actual institutions
    if (college === "loading" || college === "no-colleges" || college === "no-organizations") {
      return { isValid: false, message: `Please select a valid ${institutionType === 'college' ? 'college' : 'organization'}` };
    }
    
    // Check if institution exists in the appropriate list
    const isValidInstitution = institutionsData?.institutions?.some((institution: any) => institution.id === college);
    if (isValidInstitution) {
      return { isValid: true, message: "" };
    } else {
      return { isValid: false, message: `Please select a valid ${institutionType === 'college' ? 'college' : 'organization'}` };
    }
  };

  const getDepartmentValidation = (department: string) => {
    // Staff in colleges don't need department
    if (watchedRole === "staff" && institutionType === 'college') {
      return { isValid: null, message: "" };
    }
    
    // If college/organization is selected but department is not, show error
    if (watchedCollege && !department) {
      // Staff in organizations need department
      if (watchedRole === "staff" && institutionType === 'organization') {
        return { isValid: false, message: "Please select a department" };
      }
      // Students, employees, guests, contractors, visitors need department
      if (watchedRole === "student" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor") {
        return { isValid: false, message: "Please select a department" };
      }
    }
    if (!department && watchedRole === "student") return { isValid: false, message: "Department is required" };
    if (!department) return { isValid: null, message: "" };
    
    // Check for special values that are not actual departments
    if (department === "select-college-first" || department === "loading-departments" || department === "no-departments") {
      return { isValid: false, message: "Please select a valid department" };
    }
    
    // Check if department exists in the selected institution's departments
    const isValidDepartment = currentDepartmentsData?.departments?.some((dept: any) => dept.code === department);
    if (isValidDepartment) {
      return { isValid: true, message: "" };
    } else {
      return { isValid: false, message: "Please select a valid department" };
    }
  };

  const getPassingOutYearValidation = (year: number | undefined) => {
    // If department is selected but year is not, show error
    if (watchedDepartment && !year && watchedRole === "student") {
      return { isValid: false, message: "Please select a passing out year" };
    }
    if (!year && watchedRole === "student") return { isValid: false, message: "Passing out year is required" };
    if (!year) return { isValid: null, message: "" };
    return { isValid: true, message: "" };
  };

  const getJoiningYearValidation = (year: number | undefined) => {
    // If department is selected but year is not, show error
    if (watchedDepartment && !year && (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor")) {
      return { isValid: false, message: "Please select a joining year" };
    }
    if (!year && (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor")) return { isValid: false, message: "Joining year is required" };
    if (!year) return { isValid: null, message: "" };
    return { isValid: true, message: "" };
  };

  // Get validation status for each field
  const nameValidation = getNameValidation(watchedName || "");
  const phoneValidation = getPhoneValidation(watchedPhoneNumber || "");
  const registerNumberValidation = getRegisterNumberValidation(watchedRegisterNumber || "");
  const staffIdValidation = getStaffIdValidation(watchedStaffId || "");
  const collegeValidation = getCollegeValidation(watchedCollege || "");
  const departmentValidation = getDepartmentValidation(watchedDepartment || "");
  const passingOutYearValidation = getPassingOutYearValidation(watchedPassingOutYear);
  const joiningYearValidation = getJoiningYearValidation(watchedJoiningYear);

  // Debug validation states
  console.log('🔍 Current validation states:', {
    registerNumberValidation,
    nameValidation,
    phoneValidation,
    staffIdValidation,
    collegeValidation,
    departmentValidation,
    passingOutYearValidation,
    joiningYearValidation
  });

  // Clear validation error when step becomes valid
  useEffect(() => {
    if (validationError) {
      const isValid = isStepValid(currentStep);
      // Check additional step 3 requirements
      if (currentStep === 3) {
        const needsRegisterNumber = watchedRole === "student" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor";
        if (needsRegisterNumber && watchedRegisterNumber && watchedRegisterNumber.trim().length > 0) {
          if (!hasCheckedRegisterNumber || registerNumberCheckResult?.exists === true) {
            return; // Don't clear error yet
          }
        }
      }
      if (isValid) {
        setValidationError(null);
      }
    }
  }, [validationError, currentStep, institutionType, watchedCollege, watchedRole, watchedDepartment, watchedPassingOutYear, watchedJoiningYear, watchedRegisterNumber, watchedStaffId, watchedName, watchedPhoneNumber, hasCheckedRegisterNumber, registerNumberCheckResult]);

  // Step validation functions - Updated for 4-step structure
  const isStepValid = (step: number) => {
    switch (step) {
      case 1: // Institution & Role
        // Must have: institution type, college/organization, and role
        if (!institutionType) return false;
        if (collegeValidation.isValid !== true) return false;
        if (!watchedRole) return false;
        return true;
        
      case 2: // Department & Year
        // For staff in colleges: no department/year needed, can proceed
        if (watchedRole === "staff" && institutionType === 'college') return true;
        
        // Department requirements
        if (institutionType === 'organization') {
          // Staff in organizations need department
          if (watchedRole === "staff") {
            if (departmentValidation.isValid !== true) return false;
          } else {
            // Students, employees, guests, contractors, visitors in organizations need department
            if (needsRegisterNumber()) {
              if (departmentValidation.isValid !== true) return false;
            }
          }
        } else if (institutionType === 'college') {
          // Students, employees, guests, contractors, visitors in colleges need department
          if (needsRegisterNumber()) {
            if (departmentValidation.isValid !== true) return false;
          }
        }
        
        // Year requirements based on role and institution type
        if (institutionType === 'college') {
          // Students need passing out year
          if (watchedRole === "student") {
            if (passingOutYearValidation.isValid !== true) return false;
          }
          // Other roles in colleges don't need year (staff already handled above)
        } else if (institutionType === 'organization') {
          // Employees, staff, and contractors need joining year
          if (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor") {
            if (joiningYearValidation.isValid !== true) return false;
          }
          // Guests and visitors in organizations don't need year
        }
        return true;
        
      case 3: // Registration Details
        // For students, employees, guests, contractors, visitors: need register number
        if (needsRegisterNumber()) {
          return registerNumberValidation.isValid === true;
        }
        // For staff: need staff ID
        if (watchedRole === "staff") {
          return staffIdValidation.isValid === true;
        }
        return false;
        
      case 4: // Complete Profile
        // Must have both name and phone number
        return nameValidation.isValid === true && phoneValidation.isValid === true;
        
      default:
        return false;
    }
  };

  // Get validation error message for current step
  const getValidationErrorMessage = (): string | null => {
    switch (currentStep) {
      case 1: // Institution & Role
        if (!institutionType) {
          return "Please select an institution type (College or Organization)";
        }
        if (collegeValidation.isValid !== true) {
          return collegeValidation.message || `Please select a ${institutionType === 'college' ? 'college' : 'organization'}`;
        }
        if (!watchedRole) {
          return "Please select your role";
        }
        return null;
        
      case 2: // Department & Year
        // For staff in colleges: no department/year needed
        if (watchedRole === "staff" && institutionType === 'college') {
          return null;
        }
        
        // Department requirements
        if (institutionType === 'organization') {
          if (watchedRole === "staff" && departmentValidation.isValid !== true) {
            return departmentValidation.message || "Please select a department";
          }
          if (needsRegisterNumber() && departmentValidation.isValid !== true) {
            return departmentValidation.message || "Please select a department";
          }
        } else if (institutionType === 'college') {
          if (needsRegisterNumber() && departmentValidation.isValid !== true) {
            return departmentValidation.message || "Please select a department";
          }
        }
        
        // Year requirements
        if (institutionType === 'college' && watchedRole === "student") {
          if (passingOutYearValidation.isValid !== true) {
            return passingOutYearValidation.message || "Please select a passing out year";
          }
        } else if (institutionType === 'organization') {
          if ((watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor") && joiningYearValidation.isValid !== true) {
            return joiningYearValidation.message || "Please select a joining year";
          }
        }
        return null;
        
      case 3: // Registration Details
        if (watchedRole === "student" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor") {
          if (!watchedRegisterNumber || watchedRegisterNumber.trim().length === 0) {
            return "Please enter your registration number";
          }
          if (registerNumberValidation.isValid !== true) {
            return registerNumberValidation.message || "Please enter a valid registration number";
          }
          if (!hasCheckedRegisterNumber) {
            return "Please click the 'Check' button to verify your registration number";
          }
          // Don't show "already registered" error here - it's shown inline when check button is clicked
        } else if (watchedRole === "staff") {
          if (!watchedStaffId || watchedStaffId.trim().length === 0) {
            return "Please enter your staff ID";
          }
          if (staffIdValidation.isValid !== true) {
            return staffIdValidation.message || "Please enter a valid staff ID";
          }
        }
        return null;
        
      case 4: // Complete Profile
        if (nameValidation.isValid !== true) {
          return nameValidation.message || "Please enter a valid name";
        }
        if (phoneValidation.isValid !== true) {
          return phoneValidation.message || "Please enter a valid phone number";
        }
        return null;
        
      default:
        return "Please complete all required fields";
    }
  };

  const canProceedToNextStep = () => {
    const isValid = isStepValid(currentStep);
    
    // On step 3 (Registration Details), require register number check if register number is needed
    if (currentStep === 3) {
      if (needsRegisterNumber() && watchedRegisterNumber && watchedRegisterNumber.trim().length > 0) {
        // Must have checked the register number before proceeding
        if (!hasCheckedRegisterNumber) {
          console.log('🔍 Step validation check: Register number check required', { 
            currentStep, 
            hasCheckedRegisterNumber,
            watchedRegisterNumber
          });
          return false;
        }
        // Cannot proceed if register number is already registered (error shown inline, not in alert)
        if (registerNumberCheckResult?.exists === true) {
          console.log('🔍 Step validation check: Register number already registered', { 
            currentStep, 
            registerNumberCheckResult
          });
          return false;
        }
      }
    }
    
    console.log('🔍 Step validation check:', { 
      currentStep, 
      isValid, 
      watchedRole, 
      registerNumberValidation: registerNumberValidation.isValid,
      nameValidation: nameValidation.isValid,
      phoneValidation: phoneValidation.isValid,
      institutionType,
      watchedCollege,
      watchedDepartment,
      hasCheckedRegisterNumber,
      registerNumberCheckResult
    });
    return isValid;
  };

  // Auto-fill department and joining year when register number is entered
  const handleRegisterNumberChange = (value: string) => {
    // Normalize to uppercase for consistency
    const normalizedValue = value.toUpperCase();
    form.setValue("registerNumber", normalizedValue);
    
    // Reset check result and check status when register number changes
    resetRegisterNumberCheckState();
    
    // Auto-fill logic will be handled by dynamic validation
    // No longer using old hardcoded validation for auto-fill
  };

  // Check if register number exists in database
  const checkRegisterNumberExists = async () => {
    const registerNumber = watchedRegisterNumber?.trim().toUpperCase();
    if (!registerNumber) {
      setRegisterNumberCheckResult({ exists: false, message: "Please enter a registration number first" });
      return;
    }

    setIsCheckingRegisterNumber(true);
    setRegisterNumberCheckResult(null);

    try {
      const response = await fetch(`/api/users/by-register/${encodeURIComponent(registerNumber)}`);
      
      if (response.ok) {
        // User exists - don't reveal personal information
        setRegisterNumberCheckResult({ 
          exists: true, 
          message: "This registration number is already registered." 
        });
      } else if (response.status === 404) {
        setRegisterNumberCheckResult({ 
          exists: false, 
          message: "This registration number is available. You can proceed with registration." 
        });
      } else {
        setRegisterNumberCheckResult({ 
          exists: false, 
          message: "Unable to check registration number. Please try again." 
        });
      }
    } catch (error) {
      console.error("Error checking register number:", error);
      setRegisterNumberCheckResult({ 
        exists: false, 
        message: "Error checking registration number. Please try again." 
      });
    } finally {
      setIsCheckingRegisterNumber(false);
      // Mark that check has been performed
      setHasCheckedRegisterNumber(true);
    }
  };

  // Handle staff ID changes with normalization
  const handleStaffIdChange = (value: string) => {
    // Normalize to uppercase for consistency
    const normalizedValue = value.toUpperCase();
    form.setValue("staffId", normalizedValue);
  };

  // Handle college changes - reset department when college changes
  const handleCollegeChange = (value: string) => {
    form.setValue("college", value);
    form.setValue("role", "" as any); // Reset role when college changes
    form.setValue("department", ""); // Reset department when college changes
    
    // Clear cached data when college changes
    queryClient.removeQueries({ queryKey: ['departments'] });
    queryClient.removeQueries({ queryKey: ['registrationFormats'] });
    queryClient.removeQueries({ queryKey: ['registration-formats'] });
    
    // Reset related state
    setAvailableFormats([]);
    resetRegisterNumberCheckState();
  };

  const handleStepNext = () => {
    console.log('🔄 handleStepNext called:', { currentStep, watchedRole, canProceed: canProceedToNextStep() });
    if (canProceedToNextStep()) {
      // Clear any validation errors
      setValidationError(null);
      
      // Enable registration formats API when moving to step 3
      if (currentStep === 2) {
        console.log('🔌 Enabling registration formats API call');
        setApiCallsEnabled(prev => ({ ...prev, registrationFormats: true }));
      }
      
      console.log('➡️ Moving to next step');
      nextStep();
    } else {
      // Show validation error message
      const errorMessage = getValidationErrorMessage();
      console.log('❌ Validation failed - Error message:', errorMessage);
      setValidationError(errorMessage || "Please complete all required fields correctly before proceeding.");
      console.log('✅ Validation error state set:', errorMessage || "Please complete all required fields correctly before proceeding.");
      
      // Scroll to top to show the error message
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      console.log('❌ Cannot proceed to next step - validation failed');
    }
  };

  const handleStepBack = () => {
    prevStep();
  };

  // Simplified submit handler for QR users
  const onSubmitQR = async (data: QRProfileSetupForm) => {
    console.log('🚀 QR Profile setup submission started:', data);
    console.log('📧 User email from props:', userEmail);
    console.log('👤 User name from props (Google):', userName);
    console.log('🏢 Is org guest user:', isOrgGuestUser);
    console.log('🏢 Org context:', orgContext);
    setIsSubmitting(true);

    try {
      // Check if this is an organization guest user
      if (isOrgGuestUser && orgContext) {
        console.log('✅ Processing organization guest user profile completion');
        
        if (!userEmail) {
          console.error('❌ No user email found');
          alert("Email not found. Please try logging in again.");
          setIsSubmitting(false);
          return;
        }
        
        // User was already created in LoginScreen/OAuthCallback with name and email from Google
        // Just update with phone number
        console.log('🔍 Fetching user by email:', userEmail);
        const userResponse = await fetch(`/api/users/by-email/${encodeURIComponent(userEmail)}`);
        
        if (userResponse.ok) {
          const existingUser = await userResponse.json();
          console.log('✅ User found:', existingUser);
          
          // Use name from form (user can edit it), fallback to Google name if empty
          const finalName = (data.name && data.name.trim()) || userName || existingUser.name;
          console.log('👤 Final name to use:', finalName, '(from form:', data.name, ', from Google:', userName, ', from DB:', existingUser.name, ')');
          
          // Update user with phone number, name, and organizationId, mark profile as complete (guest users don't need registerNumber, department, joiningYear)
          console.log('📝 Updating user with phone number:', data.phoneNumber, 'name:', finalName, 'organizationId:', orgContext.organizationId);
          const updateResponse = await fetch(`/api/users/${existingUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: data.phoneNumber,
              name: finalName, // Use name from form (pre-filled from Google, but user can edit)
              organizationId: orgContext.organizationId, // Store organization ID in database
              isProfileComplete: true, // Guest users are complete after phone number
            })
          });

          if (updateResponse.ok) {
            const updatedUser = await updateResponse.json();
            console.log('✅ User updated successfully:', updatedUser);

            // Store user data with organization context (organizationId now stored in database)
            const userDisplayData = {
              id: updatedUser.id,
              name: updatedUser.name, // Name from Google Sign-In
              email: updatedUser.email, // Email from Google Sign-In
              role: updatedUser.role,
              phoneNumber: updatedUser.phoneNumber,
              organizationId: updatedUser.organizationId || orgContext.organizationId, // Use from database, fallback to orgContext
              organization: updatedUser.organizationId || orgContext.organizationId, // Store in organization field for CanteenContext
            };

            // Store user data in localStorage FIRST (before login overwrites it)
            // This ensures organization field is preserved
            console.log('💾 Storing user data with organization:', userDisplayData);
            console.log('💾 Organization ID from orgContext:', orgContext.organizationId);
            console.log('💾 Organization field in userDisplayData:', userDisplayData.organization);
            
            // Explicitly verify organization field is set
            if (!userDisplayData.organization) {
              console.error('❌ ERROR: Organization field is missing from userDisplayData!');
              console.error('❌ orgContext:', orgContext);
              console.error('❌ userDisplayData:', userDisplayData);
            }
            
            localStorage.setItem('user', JSON.stringify(userDisplayData));
            localStorage.setItem('session_timestamp', Date.now().toString());

            // Verify it was stored correctly
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              try {
                const parsed = JSON.parse(storedUser);
                console.log('✅ Verification - Stored user organization:', parsed.organization);
                console.log('✅ Verification - Stored user organizationId:', parsed.organizationId);
                if (!parsed.organization) {
                  console.error('❌ ERROR: Organization field not found in stored user data!');
                  // Force re-store with organization
                  const fixedUser = { ...parsed, organization: orgContext.organizationId, organizationId: orgContext.organizationId };
                  localStorage.setItem('user', JSON.stringify(fixedUser));
                  console.log('🔧 Fixed: Re-stored user with organization field');
                }
              } catch (e) {
                console.error('Error verifying stored user:', e);
              }
            }

            // Automatically add QR code address to user's addresses if fullAddress is available
            if (orgContext?.fullAddress) {
              try {
                console.log('🏠 Adding QR code address to user addresses:', orgContext.fullAddress);
                const addressResponse = await fetch('/api/addresses', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: updatedUser.id,
                    label: orgContext.fullAddress.label || `${orgContext.organizationName} - QR Code`,
                    fullName: orgContext.fullAddress.fullName || updatedUser.name,
                    phoneNumber: orgContext.fullAddress.phoneNumber || updatedUser.phoneNumber,
                    addressLine1: orgContext.fullAddress.addressLine1,
                    addressLine2: orgContext.fullAddress.addressLine2,
                    city: orgContext.fullAddress.city,
                    state: orgContext.fullAddress.state,
                    pincode: orgContext.fullAddress.pincode,
                    landmark: orgContext.fullAddress.landmark,
                    isDefault: false, // Don't set as default automatically
                  }),
                });

                if (addressResponse.ok) {
                  console.log('✅ QR code address added to user addresses successfully');
                } else {
                  const errorData = await addressResponse.json().catch(() => ({ message: 'Unknown error' }));
                  console.warn('⚠️ Failed to add QR code address:', errorData);
                  // Don't block the flow if address creation fails
                }
              } catch (error) {
                console.error('❌ Error adding QR code address:', error);
                // Don't block the flow if address creation fails
              }
            }

            // Remove organization context from sessionStorage (but keep it for a bit in case we need to repair)
            // We'll remove it after a delay to allow for repair if needed
            setTimeout(() => {
              sessionStorage.removeItem('orgContext');
            }, 5000);

            // Store user details in cache
            console.log('💾 Organization guest profile completed');
            console.log('💾 User data stored:', userDisplayData);
            console.log('💾 Organization ID:', userDisplayData.organization);
            console.log('💾 Organization field:', userDisplayData.organization);
            queryClient.setQueryData(['user'], userDisplayData);

            // Use login function to properly set auth state (including PWA auth)
            // This ensures the user data is properly available to all components
            // IMPORTANT: Pass the full userDisplayData including organization field
            login(userDisplayData as any);
            
            // After login, verify again that organization is still there
            setTimeout(() => {
              const afterLoginUser = localStorage.getItem('user');
              if (afterLoginUser) {
                try {
                  const parsed = JSON.parse(afterLoginUser);
                  console.log('🔍 After login - Organization field:', parsed.organization);
                  if (!parsed.organization && orgContext.organizationId) {
                    console.error('❌ ERROR: Organization field lost after login! Restoring...');
                    const restoredUser = { ...parsed, organization: orgContext.organizationId, organizationId: orgContext.organizationId };
                    localStorage.setItem('user', JSON.stringify(restoredUser));
                    window.dispatchEvent(new CustomEvent('userAuthChange'));
                    console.log('🔧 Restored organization field after login');
                  }
                } catch (e) {
                  console.error('Error checking user after login:', e);
                }
              }
            }, 200);
            
            // Ensure organization field is preserved after login
            // setPWAAuth should preserve it now, but double-check
            setTimeout(() => {
              const currentUser = localStorage.getItem('user');
              if (currentUser) {
                try {
                  const parsed = JSON.parse(currentUser);
                  console.log('🔍 Verifying stored user data after login:', {
                    hasOrganization: !!parsed.organization,
                    organization: parsed.organization,
                    hasOrganizationId: !!parsed.organizationId,
                    organizationId: parsed.organizationId,
                    college: parsed.college
                  });
                  if (!parsed.organization && userDisplayData.organization) {
                    console.log('🔧 Restoring organization field after login');
                    const restoredUser = { ...parsed, organization: userDisplayData.organization, organizationId: userDisplayData.organizationId };
                    localStorage.setItem('user', JSON.stringify(restoredUser));
                    window.dispatchEvent(new CustomEvent('userAuthChange'));
                  }
                } catch (e) {
                  console.error('Error verifying/restoring organization field:', e);
                }
              }
            }, 100);
            
            // Dispatch custom event to notify other components of user change
            window.dispatchEvent(new CustomEvent('userAuthChange'));

            onComplete(userDisplayData);
            
            // Redirect to /app
            console.log('🔄 Redirecting to /app');
            window.location.href = '/app';
          } else {
            const errorData = await updateResponse.json().catch(() => ({ message: 'Unknown error' }));
            console.error('❌ Failed to update user:', errorData);
            alert(errorData.message || "Failed to update profile. Please try again.");
            setIsSubmitting(false);
          }
        } else {
          const errorText = await userResponse.text();
          console.error('❌ User not found:', errorText);
          alert("User not found. Please try logging in again.");
          setIsSubmitting(false);
        }
        return;
      }

      // Handle restaurant QR code (table access)
      if (!qrTableData) {
        console.error('No QR table data available');
        setIsSubmitting(false);
        return;
      }

      const restaurantContext = {
        restaurantId: qrTableData.restaurantId,
        restaurantName: qrTableData.restaurantName,
        tableNumber: qrTableData.tableNumber
      };

      // Create user with minimal data (guest role for QR users)
      const userData: any = {
        email: userEmail,
        name: data.name,
        phoneNumber: data.phoneNumber,
        role: 'guest', // QR users are guests
        isProfileComplete: true,
      };

      // Create user in database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const newUser = await response.json();

        // Store user data with restaurant context
        const userDisplayData = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          phoneNumber: newUser.phoneNumber,
          ...restaurantContext,
          hasRestaurantContext: true
        };

        // Securely update user data with restaurant context
        securelyUpdateUserData(userDisplayData, false);

        localStorage.setItem('session_timestamp', Date.now().toString());

        // Remove pending QR data
        sessionStorage.removeItem('pendingQRTableData');

        // Store user details in cache
        console.log('💾 QR Profile completed - storing user details with restaurant context');
        queryClient.setQueryData(['user'], userDisplayData);

        onComplete(userDisplayData);
        
        // Redirect to home
        window.location.href = '/app';
      } else {
        const error = await response.json();
        let errorMessage = error.message || "Failed to complete profile setup. Please try again.";
        
        if (error.message === "Email is already registered") {
          errorMessage = "This email is already registered with another account. Please use 'Back to Login' to sign in.";
        }
        
        alert(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('❌ QR Profile setup error:', error);
      alert("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: ProfileSetupForm) => {
    console.log('🚀 Form submission started:', data);
    setIsSubmitting(true);
    
    try {
      // Check if register number or staff ID already exists (case-insensitive)
      if ((data.role === "student" || data.role === "employee" || data.role === "guest" || data.role === "contractor" || data.role === "visitor") && data.registerNumber) {
        const normalizedRegisterNumber = data.registerNumber.toUpperCase();
        console.log('🔍 Checking for existing user with register number:', normalizedRegisterNumber);
        const existingUser = await fetch(`/api/users/by-register/${normalizedRegisterNumber}`);
        if (existingUser.ok) {
          console.log('❌ User already exists with this register number');
          alert("This register number is already registered with another account. Please check your register number or use 'Back to Login' to sign in.");
          setIsSubmitting(false);
          return;
        }
      }
      
      if (data.role === "staff" && data.staffId) {
        const normalizedStaffId = data.staffId.toUpperCase();
        console.log('🔍 Checking for existing user with staff ID:', normalizedStaffId);
        const existingUser = await fetch(`/api/users/by-staff/${normalizedStaffId}`);
        if (existingUser.ok) {
          console.log('❌ User already exists with this staff ID');
          alert("This staff ID is already registered with another account. Please check your staff ID or use 'Back to Login' to sign in.");
          setIsSubmitting(false);
          return;
        }
      }

      // Calculate academic data for students
      let userData: any = {
        email: userEmail,
        name: data.name,
        phoneNumber: data.phoneNumber,
        role: data.role,
        isProfileComplete: true,
      };

      // Handle student data (with passing out year)
      if (data.role === "student" && data.registerNumber && data.college && data.department && data.passingOutYear && 
          data.college !== "loading" && data.college !== "no-colleges" &&
          data.department !== "select-college-first" && data.department !== "loading-departments" && data.department !== "no-departments") {
        // Calculate joining year from passing out year and study year
        const { currentAcademicYear, studyYear } = getAcademicYearInfo(data.passingOutYear);
        const joiningYear = currentAcademicYear - (studyYear - 1);
        const currentStudyYear = calculateCurrentStudyYear(joiningYear, data.passingOutYear);
        const isPassed = isStudentPassed(joiningYear, data.passingOutYear);
          
        userData = {
          ...userData,
          registerNumber: data.registerNumber,
          college: data.college,
          department: data.department,
          joiningYear,
          passingOutYear: data.passingOutYear,
          currentStudyYear,
          isPassed,
        };
      }
      
      // Handle organization employee/contractor/visitor/guest data
      if ((data.role === "employee" || data.role === "contractor" || data.role === "visitor" || data.role === "guest") && 
          data.registerNumber && data.college && data.department &&
          data.college !== "loading" && data.college !== "no-colleges" &&
          data.department !== "select-college-first" && data.department !== "loading-departments" && data.department !== "no-departments") {
        userData = {
          ...userData,
          registerNumber: data.registerNumber,
          college: data.college, // This will be the organization ID for organization users
          department: data.department,
        };
        
        // Add joining year for employee and contractor roles
        if ((data.role === "employee" || data.role === "contractor") && data.joiningYear) {
          userData.joiningYear = data.joiningYear;
        }
      }

      if (data.role === "staff" && data.staffId) {
        userData.staffId = data.staffId;
        // Include college for staff users as well
        if (data.college && data.college !== "loading" && data.college !== "no-colleges") {
          userData.college = data.college;
        }
        // Add joining year for staff role
        if (data.joiningYear) {
          userData.joiningYear = data.joiningYear;
        }
      }

      // Create user in database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const newUser = await response.json();
        
        // Store user data in localStorage
        const userDisplayData = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          phoneNumber: newUser.phoneNumber,
          ...(newUser.role === "student" && {
            registerNumber: newUser.registerNumber,
            college: newUser.college,
            department: newUser.department,
            currentStudyYear: newUser.currentStudyYear,
            isPassed: newUser.isPassed,
          }),
          ...(newUser.role === "staff" && {
            staffId: newUser.staffId,
            college: newUser.college,
          }),
          ...((newUser.role === "employee" || newUser.role === "contractor" || newUser.role === "visitor" || newUser.role === "guest") && {
            registerNumber: newUser.registerNumber,
            college: newUser.college, // This will be the organization ID
            department: newUser.department,
          }),
        };
        
        localStorage.setItem('user', JSON.stringify(userDisplayData));
        localStorage.setItem('session_timestamp', Date.now().toString());
        
        // Store user details in cache for home screen to use
        console.log('💾 Profile completed - storing user details in cache for home screen');
        queryClient.setQueryData(['user'], userData);
        console.log('💾 User details stored in cache:', userData);
        
        onComplete(userDisplayData);
        setLocation("/app");
      } else {
        const error = await response.json();
        let errorMessage = error.message || "Failed to complete profile setup. Please try again.";
        
        // Handle specific duplicate errors with better messaging
        if (error.message === "Register number is already registered") {
          errorMessage = "This register number is already registered with another account. Please check your register number or use 'Back to Login' to sign in.";
        } else if (error.message === "Staff ID is already registered") {
          errorMessage = "This staff ID is already registered with another account. Please check your staff ID or use 'Back to Login' to sign in.";
        } else if (error.message === "Email is already registered") {
          errorMessage = "This email is already registered with another account. Please use 'Back to Login' to sign in.";
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('❌ Form submission error:', error);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const passingOutYears = Array.from({ length: 4 }, (_, i) => currentYear + i);

  // Render simplified form for QR users (restaurant QR or organization QR)
  if (isQRUser && (qrTableData || isOrgGuestUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md mx-auto w-full">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold mb-2 text-foreground">
              Complete Your Profile
            </h1>
            {isOrgGuestUser && orgContext ? (
              <p className="text-sm text-muted-foreground">
                🏢 Welcome to <strong>{orgContext.organizationName}</strong>
              </p>
            ) : qrTableData ? (
              <p className="text-sm text-muted-foreground">
                📱 You're ordering from <strong>{qrTableData.restaurantName}</strong> - Table {qrTableData.tableNumber}
              </p>
            ) : null}
          </div>

          <Card className="shadow-lg border border-border bg-card">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <User className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-bold mb-1 text-foreground">
                Quick Profile Setup
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your name and phone number to get started
              </p>
            </CardHeader>

            <CardContent>
              <Form {...qrForm}>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    console.log('📝 Form submit event triggered');
                    const isValid = await qrForm.trigger();
                    console.log('✅ Form validation result:', isValid);
                    if (isValid) {
                      qrForm.handleSubmit(onSubmitQR)(e);
                    } else {
                      console.error('❌ Form validation failed:', qrForm.formState.errors);
                    }
                  }} 
                  className="space-y-4"
                >
                  {/* Name Field - Show for all QR users, pre-filled from Google for org guest users */}
                  <FormField
                    control={qrForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">
                          Full Name
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder={isOrgGuestUser ? "Your name from Google" : "Enter your full name"}
                              className="pl-9 bg-background border-border text-foreground"
                              disabled={isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number Field */}
                  <FormField
                    control={qrForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="Enter your phone number"
                              className="pl-9 bg-background border-border text-foreground"
                              disabled={isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isSubmitting || !isFormValid}
                    onClick={async (e) => {
                      e.preventDefault();
                      console.log('🔘 Complete Setup button clicked');
                      console.log('📋 Form values:', qrForm.getValues());
                      console.log('✅ Form valid (manual check):', isFormValid);
                      console.log('✅ Form valid (formState):', qrForm.formState.isValid);
                      console.log('❌ Form errors:', qrForm.formState.errors);
                      
                      // Trigger validation
                      const isValid = await qrForm.trigger();
                      console.log('🔍 Validation result:', isValid);
                      
                      if (isValid) {
                        console.log('✅ Form is valid, submitting...');
                        qrForm.handleSubmit(onSubmitQR)();
                      } else {
                        console.error('❌ Form validation failed:', qrForm.formState.errors);
                        // Show first error
                        const firstError = Object.values(qrForm.formState.errors)[0];
                        if (firstError) {
                          alert(firstError.message || 'Please fix the errors in the form');
                        }
                      }
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isOrgGuestUser ? 'Updating Profile...' : 'Creating Account...'}
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {/* Back to Login */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onBackToLogin}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Back to Login
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Regular form for non-QR users
  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col items-center justify-center text-center space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
              <User className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Complete Your Profile</h1>
            <p className="text-xs text-muted-foreground max-w-md">
              Let's set up your account with a few quick details
            </p>
          </div>
        </div>

        <Card className="shadow-xl border border-border/50 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-4 pt-4 px-4 sm:px-6 space-y-3">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Step {currentStep} of {steps.length}</span>
                <span className="font-bold text-primary text-sm">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2 shadow-sm" />
            </div>
            
            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto shadow-md ring-2 ring-primary/10">
              {currentStep === 1 && <Building className="w-6 h-6 text-primary" />}
              {currentStep === 2 && <School className="w-6 h-6 text-primary" />}
              {currentStep === 3 && <Hash className="w-6 h-6 text-primary" />}
              {currentStep === 4 && <CheckCircle className="w-6 h-6 text-primary" />}
            </div>
            <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
              {steps[currentStep - 1].title}
            </CardTitle>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {steps[currentStep - 1].description}
            </p>
          </CardHeader>
          
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <Form {...form}>
              <form onSubmit={(e) => {
                console.log('🚀 Form submit event triggered');
                e.preventDefault();
                form.handleSubmit(onSubmit)(e);
              }} className="space-y-4">
                {/* Validation Error Alert */}
                {validationError && (
                  <Alert variant="destructive" className="mb-4 animate-in fade-in slide-in-from-top-2 border-l-4 border-l-destructive shadow-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-semibold text-sm">Please Complete Required Fields</AlertTitle>
                    <AlertDescription className="mt-1.5 text-xs leading-relaxed">{validationError}</AlertDescription>
                  </Alert>
                )}
                
                {/* Step 1: Institution & Role Selection (combines old steps 1, 2, and 3) */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                      <div
                        className={`group p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 min-h-[110px] flex items-center justify-center ${
                          institutionType === "college"
                            ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg ring-2 ring-primary/20"
                            : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-md hover:ring-1 hover:ring-primary/10"
                        }`}
                        onClick={() => {
                          console.log('🏫 User clicked College - setting institutionType to college');
                          setInstitutionType("college");
                          form.setValue("college", "");
                          form.setValue("role", "" as any);
                        }}
                      >
                        <div className="text-center space-y-2">
                          <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center transition-all ${
                            institutionType === "college" 
                              ? "bg-primary/20 ring-2 ring-primary/30" 
                              : "bg-primary/5 group-hover:bg-primary/10"
                          }`}>
                            <GraduationCap className={`w-6 h-6 transition-all ${
                              institutionType === "college" ? "text-primary" : "text-primary/70 group-hover:text-primary"
                            }`} />
                          </div>
                          <h4 className="font-bold text-sm text-foreground">College</h4>
                          <p className="text-[10px] text-muted-foreground">Academic institution</p>
                        </div>
                      </div>
                      
                      <div
                        className={`group p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 min-h-[110px] flex items-center justify-center ${
                          institutionType === "organization"
                            ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg ring-2 ring-primary/20"
                            : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-md hover:ring-1 hover:ring-primary/10"
                        }`}
                        onClick={() => {
                          console.log('🏢 User clicked Organization - setting institutionType to organization');
                          setInstitutionType("organization");
                          form.setValue("college", "");
                          form.setValue("role", "" as any);
                        }}
                      >
                        <div className="text-center space-y-2">
                          <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center transition-all ${
                            institutionType === "organization" 
                              ? "bg-primary/20 ring-2 ring-primary/30" 
                              : "bg-primary/5 group-hover:bg-primary/10"
                          }`}>
                            <Building2 className={`w-6 h-6 transition-all ${
                              institutionType === "organization" ? "text-primary" : "text-primary/70 group-hover:text-primary"
                            }`} />
                          </div>
                          <h4 className="font-bold text-sm text-foreground">Organization</h4>
                          <p className="text-[10px] text-muted-foreground">Corporate/Company</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Institution Selection (shown in step 1) */}
                {currentStep === 1 && institutionType && (
                  <div className="space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="college"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground font-semibold text-base flex items-center gap-2">
                            <Building className="w-4 h-4 text-primary" />
                            {institutionType === 'college' ? 'Select Your College' : 'Select Your Organization'}
                          </FormLabel>
                          <div className="relative">
                            <Select 
                              onValueChange={handleCollegeChange} 
                              value={field.value}
                              onOpenChange={(open) => {
                                // Trigger validation when dropdown opens if not selected
                                if (!open && !field.value && institutionType) {
                                  form.trigger("college");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className={`h-12 text-base pr-10 shadow-sm ${collegeValidation.isValid === false ? "border-destructive focus:border-destructive ring-destructive/20" : collegeValidation.isValid === true ? "border-primary focus:border-primary ring-primary/20" : "hover:border-primary/50"}`} data-testid="select-college">
                                  <SelectValue placeholder="Choose your institution" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className={`dropdown-container ${prefersReducedMotion ? '' : 'animate-dropdown-enter'}`}>
                                {institutionsLoading ? (
                                  <SelectItem value="loading" disabled>
                                    Loading...
                                  </SelectItem>
                                ) : institutionsData?.institutions?.length ? (
                                  institutionsData.institutions.map((institution: any, index: number) => (
                                    <SelectItem 
                                      key={institution.id} 
                                      value={institution.id}
                                      className={`dropdown-item ${
                                        prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                                      }`}
                                      style={{
                                        animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
                                      }}
                                    >
                                      {institution.code} - {institution.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value={`no-${institutionType}s`} disabled>
                                    No {institutionType === 'college' ? 'colleges' : 'organizations'} available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            {collegeValidation.isValid !== null && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                {collegeValidation.isValid ? (
                                  <Check className="w-4 h-4 text-primary" data-testid="icon-college-valid" />
                                ) : (
                                  <X className="w-4 h-4 text-destructive" data-testid="icon-college-invalid" />
                                )}
                              </div>
                            )}
                          </div>
                          {collegeValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {collegeValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                )}

                {/* Role Selection (shown in step 1) */}
                {currentStep === 1 && watchedCollege && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {institutionType === 'college' ? (
                        <>
                          {activeRoles.student && (
                            <div
                              className={`group p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                watchedRole === "student"
                                  ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                                  : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-sm hover:ring-1 hover:ring-primary/10"
                              }`}
                              onClick={() => form.setValue("role", "student")}
                            >
                              <div className="text-center space-y-1.5">
                                <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                  watchedRole === "student" 
                                    ? "bg-primary/20 ring-2 ring-primary/30" 
                                    : "bg-primary/5 group-hover:bg-primary/10"
                                }`}>
                                  <School className={`w-5 h-5 ${watchedRole === "student" ? "text-primary" : "text-primary/70 group-hover:text-primary"}`} />
                                </div>
                                <h4 className="font-bold text-sm text-foreground">Student</h4>
                                <p className="text-[10px] text-muted-foreground">Academic learner</p>
                              </div>
                            </div>
                          )}
                          
                          {activeRoles.staff && (
                            <div
                              className={`group p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                watchedRole === "staff"
                                  ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                                  : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-sm hover:ring-1 hover:ring-primary/10"
                              }`}
                              onClick={() => form.setValue("role", "staff")}
                            >
                              <div className="text-center space-y-1.5">
                                <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                  watchedRole === "staff" 
                                    ? "bg-primary/20 ring-2 ring-primary/30" 
                                    : "bg-primary/5 group-hover:bg-primary/10"
                                }`}>
                                  <Briefcase className={`w-5 h-5 ${watchedRole === "staff" ? "text-primary" : "text-primary/70 group-hover:text-primary"}`} />
                                </div>
                                <h4 className="font-bold text-sm text-foreground">Staff</h4>
                                <p className="text-[10px] text-muted-foreground">Faculty member</p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {activeRoles.employee && (
                            <div
                              className={`group p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                watchedRole === "employee"
                                  ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                                  : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-sm hover:ring-1 hover:ring-primary/10"
                              }`}
                              onClick={() => form.setValue("role", "employee")}
                            >
                              <div className="text-center space-y-1.5">
                                <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                  watchedRole === "employee" 
                                    ? "bg-primary/20 ring-2 ring-primary/30" 
                                    : "bg-primary/5 group-hover:bg-primary/10"
                                }`}>
                                  <User className={`w-5 h-5 ${watchedRole === "employee" ? "text-primary" : "text-primary/70 group-hover:text-primary"}`} />
                                </div>
                                <h4 className="font-bold text-sm text-foreground">Employee</h4>
                                <p className="text-[10px] text-muted-foreground">Full-time staff</p>
                              </div>
                            </div>
                          )}
                          
                          {activeRoles.contractor && (
                            <div
                              className={`group p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                watchedRole === "contractor"
                                  ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                                  : "border-border/60 hover:border-primary/60 hover:bg-accent/50 hover:shadow-sm hover:ring-1 hover:ring-primary/10"
                              }`}
                              onClick={() => form.setValue("role", "contractor")}
                            >
                              <div className="text-center space-y-1.5">
                                <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                  watchedRole === "contractor" 
                                    ? "bg-primary/20 ring-2 ring-primary/30" 
                                    : "bg-primary/5 group-hover:bg-primary/10"
                                }`}>
                                  <Briefcase className={`w-5 h-5 ${watchedRole === "contractor" ? "text-primary" : "text-primary/70 group-hover:text-primary"}`} />
                                </div>
                                <h4 className="font-bold text-sm text-foreground">Contractor</h4>
                                <p className="text-[10px] text-muted-foreground">Contract worker</p>
                              </div>
                            </div>
                            )}
                          
                          {activeRoles.visitor && (
                            <div
                              className={`p-2 border-2 rounded-lg cursor-pointer transition-all ${
                                watchedRole === "visitor"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50 hover:bg-accent"
                              }`}
                              onClick={() => form.setValue("role", "visitor")}
                            >
                              <div className="text-center">
                                <User className="w-8 h-8 mx-auto mb-2 text-primary" />
                                <h4 className="font-semibold text-base mb-1 text-foreground">Visitor</h4>
                          </div>
                          </div>
                          )}
                        </>
                      )}
                      
                      {activeRoles.guest && (
                        <div
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            watchedRole === "guest"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                          onClick={() => form.setValue("role", "guest")}
                        >
                          <div className="text-center">
                            <User className="w-8 h-8 mx-auto mb-2 text-primary" />
                            <h4 className="font-semibold text-base mb-1 text-foreground">Guest</h4>
                          </div>
                        </div>
                      )}
                    </div>
                    
                  </div>
                )}

                {/* Step 2: Department & Year Selection (combines old steps 4 and 5) */}
                {currentStep === 2 && (watchedRole === "student" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor") && (
                  <div className="space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Department
                          </FormLabel>
                          <div className="relative">
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              onOpenChange={(open) => {
                                // Trigger validation when dropdown opens if not selected
                                if (!open && !field.value && watchedCollege) {
                                  form.trigger("department");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className={`pr-10 ${departmentValidation.isValid === false ? "border-destructive focus:border-destructive" : departmentValidation.isValid === true ? "border-primary focus:border-primary" : ""}`} data-testid="select-department">
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className={`dropdown-container ${prefersReducedMotion ? '' : 'animate-dropdown-enter'}`}>
                                {!watchedCollege ? (
                                  <SelectItem value="select-college-first" disabled>
                                    Select institution first
                                  </SelectItem>
                                ) : currentDepartmentsLoading ? (
                                  <SelectItem value="loading-departments" disabled>
                                    Loading...
                                  </SelectItem>
                                ) : currentDepartmentsData?.departments?.length ? (
                                  currentDepartmentsData.departments.map((dept: any, index: number) => (
                                    <SelectItem 
                                      key={dept.code} 
                                      value={dept.code}
                                      className={`dropdown-item ${
                                        prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                                      }`}
                                      style={{
                                        animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
                                      }}
                                    >
                                      {dept.code} - {dept.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-departments" disabled>
                                    No options available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            {departmentValidation.isValid === true && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Check className="w-4 h-4 text-primary" data-testid="icon-department-valid" />
                              </div>
                            )}
                          </div>
                          {departmentValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {departmentValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Year Selection for Students (shown in step 2) */}
                {currentStep === 2 && watchedRole === "student" && (
                  <div className="space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="passingOutYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Passing Out Year
                          </FormLabel>
                          <div className="relative">
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                              onOpenChange={(open) => {
                                // Trigger validation when dropdown opens if not selected
                                if (!open && !field.value && watchedDepartment && watchedRole === "student") {
                                  form.trigger("passingOutYear");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className={`pr-10 ${passingOutYearValidation.isValid === false ? "border-destructive focus:border-destructive" : passingOutYearValidation.isValid === true ? "border-primary focus:border-primary" : ""}`} data-testid="select-passing-year">
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className={`dropdown-container ${prefersReducedMotion ? '' : 'animate-dropdown-enter'}`}>
                                {passingOutYears.map((year, index) => (
                                  <SelectItem 
                                    key={year} 
                                    value={year.toString()}
                                    className={`dropdown-item ${
                                      prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                                    }`}
                                    style={{
                                      animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
                                    }}
                                  >
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {passingOutYearValidation.isValid === true && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Check className="w-4 h-4 text-primary" data-testid="icon-passing-year-valid" />
                              </div>
                            )}
                          </div>
                          {passingOutYearValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {passingOutYearValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Show available formats for this department/year */}
                    {false && availableFormats.length > 0 && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">
                          Available Registration Formats for {watchedDepartment} - Year {watchedPassingOutYear ? getAcademicYearInfo(watchedPassingOutYear || 0)?.studyYear || 'N/A' : 'N/A'}
                        </h4>
                        <div className="space-y-2">
                          {availableFormats.map((format, index) => {
                            // Get the correct format type based on role
                            const formatType = (() => {
                              switch (watchedRole as string) {
                                case "student": return "student";
                                case "staff": return "staff";
                                case "employee": return "employee";
                                case "contractor": return "contractor";
                                case "visitor": return "visitor";
                                case "guest": return "guest";
                                default: return "student";
                              }
                            })();
                            
                            // Generate dynamic example from format structure
                            const generateExample = (format: any) => {
                              
                              if (!format.formats?.[formatType]?.structure) {
                                return format.formats?.[formatType]?.example || 'No example available';
                              }

                              // Debug logging for format structure
                              console.log('Format structure debug:', {
                                formatName: format.name,
                                formatType: formatType,
                                structure: format.formats[formatType].structure,
                                structureLength: format.formats[formatType].structure?.length,
                                specialCharacters: format.formats[formatType].specialCharacters
                              });

                              const structure = format.formats[formatType].structure;
                              const specialCharacters = format.formats[formatType].specialCharacters || [];
                              
                              // Check if structure is empty or undefined
                              if (!structure || structure.length === 0) {
                                console.log('Structure is empty or undefined, falling back to original example');
                                return format.formats?.[formatType]?.example || 'No example available';
                              }
                              let example = '';
                              let currentPosition = 0;

                              // Sort positions by position number
                              const sortedPositions = [...structure].sort((a, b) => a.position - b.position);

                              // Debug: Log all positions to see what types we have
                              console.log('All positions in structure:', sortedPositions.map(p => ({
                                type: p.type,
                                position: p.position,
                                hasRange: 'range' in p,
                                range: p.range,
                                fullPosition: p
                              })));
                              
                              console.log('Raw structure array:', structure);

                              for (const position of sortedPositions) {
                                // Add any special characters that come before this position
                              const specialCharsBefore = specialCharacters.filter((sc: any) => 
                                sc.positions.some((pos: any) => pos < position.position && pos > currentPosition)
                              );

                                for (const sc of specialCharsBefore) {
                                  example += sc.character;
                                }

                                // Add the position value
                                console.log(`Processing position type: ${position.type}`, position);
                                switch (position.type) {
                                  case 'digit':
                                    example += '1';
                                    break;
                                  case 'alphabet':
                                    example += 'A';
                                    break;
                                  case 'alphanumeric':
                                    example += 'A';
                                    break;
                                  case 'fixed':
                                    example += position.value || '';
                                    break;
                                  case 'year':
                                    // Determine format based on number of positions (2 = 2-digit, 4 = 4-digit)
                                    const isTwoDigit = position.range?.positions?.length === 2;
                                    
                                    if (position.yearType === 'starting') {
                                      const { currentAcademicYear, studyYear } = getAcademicYearInfo(watchedPassingOutYear || 2027);
                                      const expectedYear = currentAcademicYear - (studyYear - 1);
                                      example += isTwoDigit ? expectedYear.toString().slice(-2) : expectedYear.toString();
                                    } else if (position.yearType === 'passing_out') {
                                      const year = watchedPassingOutYear || 2027;
                                      example += isTwoDigit ? year.toString().slice(-2) : year.toString();
                                    } else {
                                      example += isTwoDigit ? '24' : '2024';
                                    }
                                    break;
                                  case 'numbers_range':
                                    if (position.range) {
                                      let value = position.range.min.toString();
                                      // Check for explicit digits property first, then fall back to range max digits
                                      let digits = position.digits || position.length || position.positions;
                                      
                                      // If no explicit digits, try to determine from position span or use range max digits
                                      if (!digits) {
                                        // Check if there's a position span or end position
                                        if (position.endPosition && position.position) {
                                          digits = position.endPosition - position.position + 1;
                                        } else if (position.span) {
                                          digits = position.span;
                                        } else if (position.range?.positions?.length) {
                                          // Use the number of positions in the range (this is how the format builder stores it)
                                          digits = position.range.positions.length;
                                        } else {
                                          // Fallback to range max digits
                                          digits = position.range.max.toString().length;
                                        }
                                      }
                                      
                                      // Debug logging for number range
                                      console.log('Number range debug:', {
                                        position,
                                        range: position.range,
                                        min: position.range.min,
                                        max: position.range.max,
                                        explicitDigits: position.digits,
                                        explicitLength: position.length,
                                        explicitPositions: position.positions,
                                        calculatedDigits: digits,
                                        originalValue: value,
                                        paddedValue: value.padStart(digits, '0'),
                                        positionKeys: Object.keys(position),
                                        fullPosition: JSON.stringify(position, null, 2)
                                      });
                                      
                                      value = value.padStart(digits, '0');
                                      example += value;
                                    } else {
                                      example += '1';
                                    }
                                    break;
                                  default:
                                    example += '1';
                                }

                                currentPosition = position.position;
                              }

                              // Add any remaining special characters
                              const remainingSpecialChars = specialCharacters.filter((sc: any) => 
                                sc.positions.some((pos: any) => pos > currentPosition)
                              );

                              for (const sc of remainingSpecialChars) {
                                example += sc.character;
                              }

                              return example;
                            };

                            const dynamicExample = generateExample(format);

                            return (
                              <div key={index} className="text-sm text-foreground">
                                <div className="font-medium">{format.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Example: {dynamicExample}
                                </div>
                                {format.formats?.[formatType]?.description && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {format.formats[formatType].description}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          💡 Your registration number must match one of these formats exactly.
                        </div>
                  </div>
                )}

                  </div>
                )}

                {/* Joining Year for Employees (shown in step 2) */}
                {currentStep === 2 && (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor") && (
                  <div className="space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="joiningYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Joining Year
                          </FormLabel>
                          <div className="relative">
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                              onOpenChange={(open) => {
                                // Trigger validation when dropdown opens if not selected
                                if (!open && !field.value && watchedDepartment && (watchedRole === "employee" || watchedRole === "staff" || watchedRole === "contractor")) {
                                  form.trigger("joiningYear");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className={`pr-10 ${joiningYearValidation.isValid === false ? "border-destructive focus:border-destructive" : joiningYearValidation.isValid === true ? "border-primary focus:border-primary" : ""}`} data-testid="select-joining-year">
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className={`dropdown-container ${prefersReducedMotion ? '' : 'animate-dropdown-enter'}`}>
                                {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map((year, index) => (
                                  <SelectItem 
                                    key={year} 
                                    value={year.toString()}
                                    className={`dropdown-item ${
                                      prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                                    }`}
                                    style={{
                                      animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
                                    }}
                                  >
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {joiningYearValidation.isValid === true && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Check className="w-4 h-4 text-primary" data-testid="icon-joining-year-valid" />
                              </div>
                            )}
                          </div>
                          {joiningYearValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {joiningYearValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Show available formats for this department/year */}
                    {false && availableFormats.length > 0 && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">
                          Available Registration Formats for {watchedDepartment} - Joining Year {watchedJoiningYear}
                        </h4>
                        <div className="space-y-2">
                          {availableFormats.map((format, index) => {
                            // Get the correct format type based on role
                            const formatType = (() => {
                              switch (watchedRole as string) {
                                case "employee": return "employee";
                                case "staff": return "staff";
                                case "contractor": return "contractor";
                                default: return "employee";
                              }
                            })();
                            
                            // Generate dynamic example from format structure
                            const generateExample = (format: any) => {
                              if (!format.formats?.[formatType]?.structure) {
                                return format.formats?.[formatType]?.example || 'No example available';
                              }
                              
                              const structure = format.formats[formatType].structure;
                              const totalLength = format.formats[formatType].totalLength;
                              const example = new Array(totalLength).fill('_');
                              
                              structure.forEach((position: any) => {
                                if (position.range?.positions?.length > 0) {
                                  position.range.positions.forEach((pos: number) => {
                                    if (pos <= totalLength) {
                                      if (position.type === 'fixed' && position.value) {
                                        const charIndex = position.range.positions.indexOf(pos);
                                        example[pos - 1] = position.value[charIndex] || 'X';
                                      } else if (position.type === 'year') {
                                        if (position.yearType === 'joining') {
                                          const year = watchedJoiningYear || 2020;
                                          const isTwoDigit = position.range.positions.length === 2;
                                          example[pos - 1] = isTwoDigit ? year.toString().slice(-2) : year.toString();
                                        } else if (position.yearType === 'current') {
                                          const currentYear = new Date().getFullYear();
                                          const isTwoDigit = position.range.positions.length === 2;
                                          example[pos - 1] = isTwoDigit ? currentYear.toString().slice(-2) : currentYear.toString();
                                        }
                                      } else if (position.type === 'digit') {
                                        example[pos - 1] = '0';
                                      } else if (position.type === 'alphabet') {
                                        example[pos - 1] = 'A';
                                      } else if (position.type === 'alphanumeric') {
                                        example[pos - 1] = 'A';
                                      } else if (position.type === 'numbers_range') {
                                        example[pos - 1] = '1';
                                      }
                                    }
                                  });
                                } else {
                                  if (position.position <= totalLength) {
                                    if (position.type === 'fixed' && position.value) {
                                      example[position.position - 1] = position.value;
                                    } else if (position.type === 'year') {
                                      if (position.yearType === 'joining') {
                                        const year = watchedJoiningYear || 2020;
                                        example[position.position - 1] = year.toString().slice(-2);
                                      } else if (position.yearType === 'current') {
                                        const currentYear = new Date().getFullYear();
                                        example[position.position - 1] = currentYear.toString().slice(-2);
                                      }
                                    } else if (position.type === 'digit') {
                                      example[position.position - 1] = '0';
                                    } else if (position.type === 'alphabet') {
                                      example[position.position - 1] = 'A';
                                    } else if (position.type === 'alphanumeric') {
                                      example[position.position - 1] = 'A';
                                    } else if (position.type === 'numbers_range') {
                                      example[position.position - 1] = '1';
                                    }
                                  }
                                }
                              });
                              
                              return example.join('');
                            };
                            
                            return (
                              <div key={index} className="p-3 bg-card rounded border border-border">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="font-medium text-foreground">{format.name}</h5>
                                    <p className="text-sm text-muted-foreground">
                                      Example: <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                        {generateExample(format)}
                                      </code>
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm text-muted-foreground">
                                      Length: {format.formats?.[formatType]?.totalLength || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Step 3: Registration Details (old step 6) */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    
                    {(watchedRole === "student" || watchedRole === "employee" || watchedRole === "guest" || watchedRole === "contractor" || watchedRole === "visitor") ? (
                      <FormField
                        control={form.control}
                        name="registerNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">
                              Register Number
                            </FormLabel>
                            <div className="relative">
                               <FormControl>
                                 <Input 
                                   {...field} 
                                   placeholder={
                                     availableFormats.length > 0 
                                       ? (() => {
                                           // Generate dynamic example for placeholder
                                           const format = availableFormats[0];
                                           // Get the correct format type based on role
                                           const formatType = (() => {
                                             switch (watchedRole as string) {
                                               case "student": return "student";
                                               case "staff": return "staff";
                                               case "employee": return "employee";
                                               case "contractor": return "contractor";
                                               case "visitor": return "visitor";
                                               case "guest": return "guest";
                                               default: return "student";
                                             }
                                           })();
                                           
                                           if (!format.formats?.[formatType]?.structure) {
                                             return format.formats?.[formatType]?.example || "Enter your ID";
                                           }

                                           const structure = format.formats[formatType].structure;
                                           const specialCharacters = format.formats[formatType].specialCharacters || [];
                                           let example = '';
                                           let currentPosition = 0;

                                           const sortedPositions = [...structure].sort((a, b) => a.position - b.position);

                                           for (const position of sortedPositions) {
                              const specialCharsBefore = specialCharacters.filter((sc: any) => 
                                sc.positions.some((pos: any) => pos < position.position && pos > currentPosition)
                              );

                                             for (const sc of specialCharsBefore) {
                                               example += sc.character;
                                             }

                                             switch (position.type) {
                                               case 'digit':
                                                 example += '1';
                                                 break;
                                               case 'alphabet':
                                                 example += 'A';
                                                 break;
                                               case 'alphanumeric':
                                                 example += 'A';
                                                 break;
                                               case 'fixed':
                                                 example += position.value || '';
                                                 break;
                                               case 'year':
                                                 // Determine format based on number of positions (2 = 2-digit, 4 = 4-digit)
                                                 const isTwoDigitYear = position.range?.positions?.length === 2;
                                                 
                                                 if (position.yearType === 'starting') {
                                                   const { currentAcademicYear, studyYear } = getAcademicYearInfo(watchedPassingOutYear || 2027);
                                                   const expectedYear = currentAcademicYear - (studyYear - 1);
                                                   example += isTwoDigitYear ? expectedYear.toString().slice(-2) : expectedYear.toString();
                                                 } else if (position.yearType === 'passing_out') {
                                                   const year = watchedPassingOutYear || 2027;
                                                   example += isTwoDigitYear ? year.toString().slice(-2) : year.toString();
                                                 } else {
                                                   example += isTwoDigitYear ? '24' : '2024';
                                                 }
                                                 break;
                                               case 'numbers_range':
                                                 if (position.range) {
                                                   let value = position.range.min.toString();
                                                   // Check for explicit digits property first, then fall back to range max digits
                                                   let digits = position.digits || position.length || position.positions;
                                                   
                                                   // If no explicit digits, try to determine from position span or use range max digits
                                                   if (!digits) {
                                                     // Check if there's a position span or end position
                                                     if (position.endPosition && position.position) {
                                                       digits = position.endPosition - position.position + 1;
                                                     } else if (position.span) {
                                                       digits = position.span;
                                                     } else if (position.range?.positions?.length) {
                                                       // Use the number of positions in the range (this is how the format builder stores it)
                                                       digits = position.range.positions.length;
                                                     } else {
                                                       // Fallback to range max digits
                                                       digits = position.range.max.toString().length;
                                                     }
                                                   }
                                                   
                                                   // Debug logging for number range
                                                   console.log('Number range debug (placeholder):', {
                                                     position,
                                                     range: position.range,
                                                     min: position.range.min,
                                                     max: position.range.max,
                                                     explicitDigits: position.digits,
                                                     explicitLength: position.length,
                                                     explicitPositions: position.positions,
                                                     calculatedDigits: digits,
                                                     originalValue: value,
                                                     paddedValue: value.padStart(digits, '0')
                                                   });
                                                   
                                                   value = value.padStart(digits, '0');
                                                   example += value;
                                                 } else {
                                                   example += '1';
                                                 }
                                                 break;
                                               default:
                                                 example += '1';
                                             }

                                             currentPosition = position.position;
                                           }

                                           const remainingSpecialChars = specialCharacters.filter((sc: any) => 
                                             sc.positions.some((pos: any) => pos > currentPosition)
                                           );

                                           for (const sc of remainingSpecialChars) {
                                             example += sc.character;
                                           }

                                           return example;
                                         })()
                                       : "e.g., 711523CSE055"
                                   }
                                   onChange={(e) => handleRegisterNumberChange(e.target.value)}
                                   className={`font-mono pr-32 ${registerNumberValidation.isValid === false ? "border-destructive focus:border-destructive" : registerNumberValidation.isValid === true ? "border-primary focus:border-primary" : ""}`}
                                   data-testid="input-register-number"
                                 />
                               </FormControl>
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                                {/* Check button - more prominent */}
                                <button
                                  type="button"
                                  onClick={checkRegisterNumberExists}
                                  disabled={isCheckingRegisterNumber || !watchedRegisterNumber || watchedRegisterNumber.trim().length === 0}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary/10 disabled:hover:border-primary/30"
                                  title="Check if registration number exists in database"
                                >
                                  {isCheckingRegisterNumber ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                                      <span className="text-xs font-medium text-primary">Checking...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Search className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-xs font-medium text-primary">Check</span>
                                    </>
                                  )}
                                </button>
                                {/* Validation icon */}
                                {registerNumberValidation.isValid !== null && (
                                  <>
                                    {registerNumberValidation.isValid ? (
                                      <Check className="w-4 h-4 text-primary" data-testid="icon-register-number-valid" />
                                    ) : (
                                      <X className="w-4 h-4 text-destructive" data-testid="icon-register-number-invalid" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {registerNumberValidation.isValid === false && (
                              <div className="text-xs mt-1 text-destructive">
                                {registerNumberValidation.message}
                              </div>
                            )}
                            {registerNumberCheckResult && (
                              <div className={`text-xs mt-1 ${registerNumberCheckResult.exists ? "text-destructive" : "text-primary"}`}>
                                {registerNumberCheckResult.message}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : watchedRole === "staff" ? (
                    <FormField
                      control={form.control}
                      name="staffId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Staff ID
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="e.g., ABC123"
                                onChange={(e) => handleStaffIdChange(e.target.value)}
                                className={`font-mono pr-10 ${staffIdValidation.isValid === false ? "border-destructive focus:border-destructive" : staffIdValidation.isValid === true ? "border-primary focus:border-primary" : ""}`}
                                maxLength={6}
                                data-testid="input-staff-id"
                              />
                            </FormControl>
                            {staffIdValidation.isValid !== null && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {staffIdValidation.isValid ? (
                                  <Check className="w-4 h-4 text-primary" data-testid="icon-staff-id-valid" />
                                ) : (
                                  <X className="w-4 h-4 text-destructive" data-testid="icon-staff-id-invalid" />
                                )}
                              </div>
                            )}
                          </div>
                          {staffIdValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {staffIdValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    ) : null}
                  </div>
                )}

                {/* Step 4: Complete Profile (old step 7) */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Full Name
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Your name"
                                className={`pr-10 ${nameValidation.isValid === false ? "border-destructive focus:border-destructive" : nameValidation.isValid === true ? "border-primary focus:border-primary" : ""}`}
                                data-testid="input-name"
                              />
                            </FormControl>
                            {nameValidation.isValid !== null && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {nameValidation.isValid ? (
                                  <Check className="w-4 h-4 text-primary" data-testid="icon-name-valid" />
                        ) : (
                                  <X className="w-4 h-4 text-destructive" data-testid="icon-name-invalid" />
                        )}
                      </div>
                        )}
                      </div>
                          {nameValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {nameValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">
                            Phone Number
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Your phone number"
                                className={`pr-10 ${phoneValidation.isValid === false ? "border-destructive focus:border-destructive" : phoneValidation.isValid === true ? "border-primary focus:border-primary" : ""}`}
                                data-testid="input-phone"
                              />
                            </FormControl>
                            {phoneValidation.isValid !== null && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {phoneValidation.isValid ? (
                                  <Check className="w-4 h-4 text-primary" data-testid="icon-phone-valid" />
                                ) : (
                                  <X className="w-4 h-4 text-destructive" data-testid="icon-phone-invalid" />
                            )}
                          </div>
                            )}
                          </div>
                          {phoneValidation.isValid === false && (
                            <div className="text-xs mt-1 text-destructive">
                              {phoneValidation.message}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                          </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-border/50">
                  {currentStep > 1 && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleStepBack}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 text-sm font-medium hover:bg-accent/80 shadow-sm border-2 hover:border-primary/50 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1.5" />
                      Previous
                    </Button>
                  )}
                  
                  {currentStep < steps.length ? (
                    <Button 
                      type="button"
                      onClick={handleStepNext}
                      disabled={isSubmitting}
                      className="px-8 py-2.5 text-sm font-semibold ml-auto bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={!canProceedToNextStep() || isSubmitting}
                      className="px-8 py-2.5 text-sm font-semibold ml-auto bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                      onClick={async (e) => {
                        console.log('🔘 Complete Setup button clicked');
                        console.log('🔘 Button disabled?', !canProceedToNextStep() || isSubmitting);
                        console.log('🔘 canProceedToNextStep():', canProceedToNextStep());
                        console.log('🔘 isSubmitting:', isSubmitting);
                        console.log('🔘 Form data:', form.getValues());
                        
                        // Manual form validation
                        const isValid = await form.trigger();
                        console.log('🔘 Form validation result:', isValid);
                        console.log('🔘 Form errors:', form.formState.errors);
                        console.log('🔘 Form errors detailed:', JSON.stringify(form.formState.errors, null, 2));
                        console.log('🔘 Form field errors:', Object.keys(form.formState.errors));
                        
                        if (isValid) {
                          console.log('🔘 Form is valid, triggering submit');
                          form.handleSubmit(onSubmit)();
                        } else {
                          console.log('🔘 Form is invalid, not submitting');
                        }
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Complete Setup
                          <CheckCircle className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Back to Login Button */}
                <div className="text-center pt-3">
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={onBackToLogin}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/50 px-5 py-1.5 text-sm transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to Login
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Default export for standalone route usage
export default ProfileSetupScreenWrapper;