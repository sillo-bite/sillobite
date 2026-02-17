import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, School, Briefcase, Hash, Calendar, GraduationCap, Building } from "lucide-react";
import { getStudyYearDisplay } from "@shared/utils";
import { useDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@shared/schema";
import { useColleges } from "@/hooks/useColleges";

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  college?: string;
  // Student fields
  registerNumber?: string;
  department?: string;
  currentStudyYear?: number;
  isPassed?: boolean;
  // Staff fields
  staffId?: string;
}

interface UserProfileDisplayProps {
  user: UserData;
}

export default function UserProfileDisplay({ user }: UserProfileDisplayProps) {
  // Fetch departments to get full names
  const { data: departmentsData } = useDepartments();
  // Fetch colleges to get full names
  const { data: collegesData } = useColleges();

  const getDepartmentFullName = (departmentCode: string) => {
    const department = departmentsData?.departments?.find(dept => dept.code === departmentCode);
    return department?.name || departmentCode;
  };

  const getCollegeFullName = (collegeId: string) => {
    const college = collegesData?.colleges?.find(college => college.id === collegeId);
    return college?.name || collegeId;
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'student':
        return { label: 'Student', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
      case 'staff':
        return { label: 'Staff', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
      case 'canteen_owner':
        return { label: 'Canteen Owner', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
      default:
        return { label: role, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
    }
  };

  const roleDisplay = getRoleDisplay(user.role);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <User className="w-5 h-5 mr-2 text-gray-600" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Name</span>
            <span className="font-medium text-gray-900">{user.name}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Email</span>
            <span className="font-medium text-sm text-gray-900">{user.email}</span>
          </div>

          {user.phoneNumber && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Phone</span>
              <span className="font-medium text-gray-900">{user.phoneNumber}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Role</span>
            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
              {roleDisplay.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Student/Employee/Contractor/Visitor/Guest Information */}
      {(user.role === UserRole.STUDENT || user.role === UserRole.EMPLOYEE || user.role === UserRole.CONTRACTOR || user.role === UserRole.VISITOR || user.role === UserRole.GUEST) && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
              <School className="w-5 h-5 mr-2 text-gray-600" />
              {user.role === UserRole.STUDENT ? 'Academic Information' :
                user.role === UserRole.EMPLOYEE ? 'Employee Information' :
                  user.role === UserRole.CONTRACTOR ? 'Contractor Information' :
                    user.role === UserRole.VISITOR ? 'Visitor Information' :
                      user.role === UserRole.GUEST ? 'Guest Information' : 'Information'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.college && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">College</span>
                <div className="text-right">
                  <div className="font-medium flex items-center text-gray-900">
                    <Building className="w-4 h-4 mr-1" />
                    {getCollegeFullName(user.college)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {collegesData?.colleges?.find(college => college.id === user.college)?.code || user.college}
                  </div>
                </div>
              </div>
            )}

            {user.registerNumber && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Register Number</span>
                <span className="font-mono font-medium text-gray-900">{user.registerNumber}</span>
              </div>
            )}

            {user.department && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Department</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{user.department}</div>
                  <div className="text-xs text-gray-500">
                    {getDepartmentFullName(user.department)}
                  </div>
                </div>
              </div>
            )}

            {user.currentStudyYear && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Current Year</span>
                <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {getStudyYearDisplay(user.currentStudyYear)} Year
                </Badge>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Status</span>
              <Badge className={user.isPassed
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-blue-100 text-blue-700 border-blue-200"
              }>
                {user.isPassed ? 'Alumni' : 'Active Student'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Information */}
      {user.role === UserRole.STAFF && user.staffId && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
              <Briefcase className="w-5 h-5 mr-2 text-gray-600" />
              Staff Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.college && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">College</span>
                <div className="text-right">
                  <div className="font-medium flex items-center text-gray-900">
                    <Building className="w-4 h-4 mr-1" />
                    {getCollegeFullName(user.college)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {collegesData?.colleges?.find(college => college.id === user.college)?.code || user.college}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Staff ID</span>
              <span className="font-mono font-medium text-gray-900">{user.staffId}</span>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}