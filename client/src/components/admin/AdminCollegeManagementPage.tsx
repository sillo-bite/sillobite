import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, Plus, Edit, Trash2, BookOpen, Clock, Hash, Settings, X
} from "lucide-react";
import RegistrationFormatBuilder from "./RegistrationFormatBuilder";
import { useAuthSync } from "@/hooks/useDataSync";

export default function AdminCollegeManagementPage() {
  const { user } = useAuthSync();

  // College management state
  const [colleges, setColleges] = useState<Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    departments: Array<{
      code: string;
      name: string;
      isActive: boolean;
      studyDuration?: number;
      registrationFormats?: Array<{
        year: number;
        formats: {
          student: {
            totalLength: number;
            structure: Array<{
              position: number;
              type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
              value?: string;
              description?: string;
              range?: {
                min: number;
                max: number;
                positions: number[];
              };
              yearType?: 'starting' | 'passing_out';
            }>;
            specialCharacters: Array<{
              character: string;
              positions: number[];
              description?: string;
            }>;
            example?: string;
            description?: string;
          };
          staff: {
            totalLength: number;
            structure: Array<{
              position: number;
              type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
              value?: string;
              description?: string;
              range?: {
                min: number;
                max: number;
                positions: number[];
              };
              yearType?: 'starting' | 'passing_out';
            }>;
            specialCharacters: Array<{
              character: string;
              positions: number[];
              description?: string;
            }>;
            example?: string;
            description?: string;
          };
          employee: {
            totalLength: number;
            structure: Array<{
              position: number;
              type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
              value?: string;
              description?: string;
              range?: {
                min: number;
                max: number;
                positions: number[];
              };
              yearType?: 'starting' | 'passing_out';
            }>;
            specialCharacters: Array<{
              character: string;
              positions: number[];
              description?: string;
            }>;
            example?: string;
            description?: string;
          };
          guest: {
            totalLength: number;
            structure: Array<{
              position: number;
              type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
              value?: string;
              description?: string;
              range?: {
                min: number;
                max: number;
                positions: number[];
              };
              yearType?: 'starting' | 'passing_out';
            }>;
            specialCharacters: Array<{
              character: string;
              positions: number[];
              description?: string;
            }>;
            example?: string;
            description?: string;
          };
        };
        createdAt: Date;
        updatedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    createdAt: Date;
    createdAt: Date;
    updatedAt: Date;
    adminEmail?: string;
  }>>([]);
  const [isEditingCollege, setIsEditingCollege] = useState<string | null>(null);
  const [newCollege, setNewCollege] = useState({ name: '', code: '', isActive: true, adminEmail: '' });
  const [showAddCollege, setShowAddCollege] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [isEditingDepartment, setIsEditingDepartment] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState({
    code: '',
    name: '',
    isActive: true,
    studyDuration: 4,
    registrationFormats: [] as Array<{
      year: number;
      formats: {
        student: any;
        staff: any;
        employee: any;
        guest: any;
      };
    }>
  });
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showRegistrationFormats, setShowRegistrationFormats] = useState<string | null>(null);
  const [showAddRegistrationFormat, setShowAddRegistrationFormat] = useState(false);
  const [showFormatBuilder, setShowFormatBuilder] = useState(false);
  const [showDepartmentFormatBuilder, setShowDepartmentFormatBuilder] = useState(false);
  const [currentFormatYear, setCurrentFormatYear] = useState<number>(1);
  const [formatBuilderYear, setFormatBuilderYear] = useState<number>(1);
  const [formatBuilderDept, setFormatBuilderDept] = useState<string>('');
  const [formatBuilderCollege, setFormatBuilderCollege] = useState<string>('');
  const [newFormatYear, setNewFormatYear] = useState<number>(1);
  const [isEditingFormat, setIsEditingFormat] = useState<boolean>(false);
  const [editingFormat, setEditingFormat] = useState<any>(null);
  const [showRoleManagement, setShowRoleManagement] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<{
    student: boolean;
    staff: boolean;
    employee: boolean;
    guest: boolean;
  }>({
    student: true,
    staff: true,
    employee: true,
    guest: true
  });

  // Fetch colleges
  const { data: collegesData, isLoading: collegesLoading } = useQuery({
    queryKey: ['/api/system-settings/colleges'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Update colleges when data loads
  React.useEffect(() => {
    if (collegesData && typeof collegesData === 'object' && collegesData !== null && 'colleges' in collegesData) {
      const collegeData = collegesData as {
        colleges: Array<{
          id: string;
          name: string;
          code: string;
          isActive: boolean;
          departments: Array<{
            code: string;
            name: string;
            isActive: boolean;
            studyDuration?: number;
            registrationFormats?: Array<{
              year: number;
              formats: {
                student: {
                  totalLength: number;
                  structure: Array<{
                    position: number;
                    type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                    value?: string;
                    description?: string;
                    range?: {
                      min: number;
                      max: number;
                      positions: number[];
                    };
                  }>;
                  specialCharacters: Array<{
                    character: string;
                    positions: number[];
                    description?: string;
                  }>;
                  example?: string;
                  description?: string;
                };
                staff: {
                  totalLength: number;
                  structure: Array<{
                    position: number;
                    type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                    value?: string;
                    description?: string;
                    range?: {
                      min: number;
                      max: number;
                      positions: number[];
                    };
                  }>;
                  specialCharacters: Array<{
                    character: string;
                    positions: number[];
                    description?: string;
                  }>;
                  example?: string;
                  description?: string;
                };
                employee: {
                  totalLength: number;
                  structure: Array<{
                    position: number;
                    type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                    value?: string;
                    description?: string;
                    range?: {
                      min: number;
                      max: number;
                      positions: number[];
                    };
                  }>;
                  specialCharacters: Array<{
                    character: string;
                    positions: number[];
                    description?: string;
                  }>;
                  example?: string;
                  description?: string;
                };
                guest: {
                  totalLength: number;
                  structure: Array<{
                    position: number;
                    type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                    value?: string;
                    description?: string;
                    range?: {
                      min: number;
                      max: number;
                      positions: number[];
                    };
                  }>;
                  specialCharacters: Array<{
                    character: string;
                    positions: number[];
                    description?: string;
                  }>;
                  example?: string;
                  description?: string;
                };
              };
              createdAt: Date;
              updatedAt: Date;
            }>;
            createdAt: Date;
            updatedAt: Date;
          }>;
          createdAt: Date;
          updatedAt: Date;
        }>
      };
      console.log('🏫 Colleges data loaded:', collegeData.colleges?.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        activeRoles: c.activeRoles
      })));
      setColleges(collegeData.colleges || []);
    }
  }, [collegesData]);

  // College management mutations
  const addCollegeMutation = useMutation({
    mutationFn: async (collegeData: { name: string; code: string; isActive: boolean; adminEmail?: string }) => {
      return apiRequest('/api/system-settings/colleges', {
        method: 'POST',
        body: JSON.stringify({
          ...collegeData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setNewCollege({ name: '', code: '', isActive: true, adminEmail: '' });
      setShowAddCollege(false);
    },
    onError: (error: any) => {
      console.error('Error adding college:', error);
    }
  });

  const updateCollegeMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; name?: string; code?: string; isActive?: boolean; adminEmail?: string }) => {
      return apiRequest(`/api/system-settings/colleges/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setIsEditingCollege(null);
    },
    onError: (error: any) => {
      console.error('Error updating college:', error);
    }
  });

  const deleteCollegeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/system-settings/colleges/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
    },
    onError: (error: any) => {
      console.error('Error deleting college:', error);
    }
  });

  const addDepartmentToCollegeMutation = useMutation({
    mutationFn: async ({ collegeId, ...departmentData }: { collegeId: string; code: string; name: string; isActive: boolean; studyDuration: number; registrationFormats: any[] }) => {
      const requestData = {
        ...departmentData,
        updatedBy: user?.id
      };

      console.log('Sending department data:', {
        collegeId,
        requestData,
        registrationFormats: requestData.registrationFormats
      });

      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments`, {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setNewDepartment({ code: '', name: '', isActive: true, studyDuration: 4, registrationFormats: [] });
      setShowAddDepartment(false);
    },
    onError: (error: any) => {
      console.error('Error adding department to college:', error);

      // Try to extract the actual error message from the response
      let errorMessage = 'Unknown error';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.data?.error) {
        errorMessage = error.data.error;
      }

      alert(`Failed to add department: ${errorMessage}`);
    }
  });

  const updateDepartmentInCollegeMutation = useMutation({
    mutationFn: async ({ collegeId, deptCode, ...updateData }: { collegeId: string; deptCode: string; name?: string; isActive?: boolean }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments/${deptCode}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setIsEditingDepartment(null);
    },
    onError: (error: any) => {
      console.error('Error updating department in college:', error);
    }
  });

  const deleteDepartmentFromCollegeMutation = useMutation({
    mutationFn: async ({ collegeId, deptCode }: { collegeId: string; deptCode: string }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments/${deptCode}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
    },
    onError: (error: any) => {
      console.error('Error deleting department from college:', error);
    }
  });

  // Registration format management mutations
  const addRegistrationFormatMutation = useMutation({
    mutationFn: async ({ collegeId, deptCode, year, formats, name }: { collegeId: string; deptCode: string; year: number; formats: any; name: string }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments/${deptCode}/registration-formats`, {
        method: 'POST',
        body: JSON.stringify({
          year,
          formats,
          name,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setShowFormatBuilder(false);
      setShowAddRegistrationFormat(false);
      setEditingFormat(null);
    },
    onError: (error: any) => {
      console.error('Error adding registration format:', error);
    }
  });

  const updateRegistrationFormatMutation = useMutation({
    mutationFn: async ({ collegeId, deptCode, formatId, formats }: { collegeId: string; deptCode: string; formatId: string; formats: any }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments/${deptCode}/registration-formats/${formatId}`, {
        method: 'PUT',
        body: JSON.stringify({
          formats,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setShowFormatBuilder(false);
      setIsEditingFormat(false);
      setEditingFormat(null);
    },
    onError: (error: any) => {
      console.error('Error updating registration format:', error);
    }
  });

  const deleteRegistrationFormatMutation = useMutation({
    mutationFn: async ({ collegeId, deptCode, formatId }: { collegeId: string; deptCode: string; formatId: string }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/departments/${deptCode}/registration-formats/${formatId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
    },
    onError: (error: any) => {
      console.error('Error deleting registration format:', error);
    }
  });

  // Role management mutation
  const updateCollegeRolesMutation = useMutation({
    mutationFn: async ({ collegeId, activeRoles }: { collegeId: string; activeRoles: { student: boolean; staff: boolean; employee: boolean; guest: boolean } }) => {
      return apiRequest(`/api/system-settings/colleges/${collegeId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({
          activeRoles,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setShowRoleManagement(null);
    },
    onError: (error: any) => {
      console.error('Error updating college roles:', error);
    }
  });

  // College management handlers
  const handleAddCollege = () => {
    if (!newCollege.name.trim() || !newCollege.code.trim()) {
      return;
    }
    addCollegeMutation.mutate(newCollege);
  };

  const handleUpdateCollege = (id: string, updates: { name?: string; code?: string; isActive?: boolean; adminEmail?: string }) => {
    updateCollegeMutation.mutate({ id, ...updates });
  };

  const handleDeleteCollege = (id: string) => {
    if (window.confirm(`Are you sure you want to delete this college? This will also delete all departments in this college. This action cannot be undone.`)) {
      deleteCollegeMutation.mutate(id);
    }
  };

  const handleToggleCollegeStatus = (id: string, isActive: boolean) => {
    handleUpdateCollege(id, { isActive });
  };

  const handleAddDepartmentToCollege = (collegeId: string) => {
    console.log('Attempting to add department:', { collegeId, newDepartment });

    if (!newDepartment.code.trim() || !newDepartment.name.trim()) {
      alert('Please provide both department code and name.');
      return;
    }

    // Validate that registration formats are provided for all years
    if (newDepartment.registrationFormats.length !== newDepartment.studyDuration) {
      alert(`Please provide registration formats for all ${newDepartment.studyDuration} years of study. Currently have ${newDepartment.registrationFormats.length} formats.`);
      return;
    }

    console.log('Validation passed, calling mutation...');
    addDepartmentToCollegeMutation.mutate({ collegeId, ...newDepartment });
  };

  const handleFormatSave = (year: number, format: any) => {
    setNewDepartment(prev => {
      const existingFormatIndex = prev.registrationFormats.findIndex(f => f.year === year);
      const newFormats = [...prev.registrationFormats];

      // Check if format is a RegistrationFormat object (has id, name, year, formats properties)
      // or just the formats object (has student, staff, employee, guest properties)
      const isRegistrationFormat = format && typeof format === 'object' &&
        ('id' in format || 'name' in format) && 'formats' in format;

      if (existingFormatIndex >= 0) {
        if (isRegistrationFormat) {
          // format is a RegistrationFormat object, use it directly
          newFormats[existingFormatIndex] = format;
        } else {
          // format is just the formats object, wrap it
          newFormats[existingFormatIndex] = { year, formats: format };
        }
      } else {
        if (isRegistrationFormat) {
          // format is a RegistrationFormat object, use it directly
          newFormats.push(format);
        } else {
          // format is just the formats object, wrap it
          newFormats.push({ year, formats: format });
        }
      }

      return { ...prev, registrationFormats: newFormats };
    });
    setShowDepartmentFormatBuilder(false);
  };

  const generateDefaultFormats = () => {
    const formats = [];
    for (let year = 1; year <= newDepartment.studyDuration; year++) {
      const yearText = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`;
      const formatId = `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const formatName = `${newDepartment.code} ${yearText} Standard Format`;

      formats.push({
        id: formatId,
        name: formatName,
        year,
        formats: {
          student: {
            totalLength: 10,
            structure: [
              { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
              { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
              { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
              { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
              { position: 4, type: 'digit', description: 'Year - first digit' },
              { position: 5, type: 'digit', description: 'Year - second digit' },
              { position: 6, type: 'alphabet', description: 'Department code - first letter' },
              { position: 7, type: 'alphabet', description: 'Department code - second letter' },
              { position: 8, type: 'alphabet', description: 'Department code - third letter' },
              {
                position: 9,
                type: 'numbers_range',
                description: 'Serial number range',
                range: { min: 1, max: 99, positions: [9, 10] }
              }
            ],
            specialCharacters: [],
            example: `INST24${newDepartment.code}01`,
            description: 'Student registration number format'
          },
          staff: {
            totalLength: 12,
            structure: [
              { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
              { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
              { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
              { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
              { position: 4, type: 'alphabet', description: 'Department code - first letter' },
              { position: 5, type: 'alphabet', description: 'Department code - second letter' },
              { position: 6, type: 'alphabet', description: 'Department code - third letter' },
              { position: 7, type: 'fixed', value: 'S', description: 'Staff identifier' },
              { position: 8, type: 'fixed', value: 'T', description: 'Staff identifier' },
              { position: 9, type: 'fixed', value: 'A', description: 'Staff identifier' },
              { position: 10, type: 'fixed', value: 'F', description: 'Staff identifier' },
              { position: 11, type: 'fixed', value: 'F', description: 'Staff identifier' },
              {
                position: 12,
                type: 'numbers_range',
                description: 'Serial number range',
                range: { min: 1, max: 999, positions: [12] }
              }
            ],
            specialCharacters: [],
            example: `INST${newDepartment.code}STAFF1`,
            description: 'Staff registration number format'
          },
          employee: {
            totalLength: 11,
            structure: [
              { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
              { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
              { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
              { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
              { position: 4, type: 'alphabet', description: 'Department code - first letter' },
              { position: 5, type: 'alphabet', description: 'Department code - second letter' },
              { position: 6, type: 'alphabet', description: 'Department code - third letter' },
              { position: 7, type: 'fixed', value: 'E', description: 'Employee identifier' },
              { position: 8, type: 'fixed', value: 'M', description: 'Employee identifier' },
              { position: 9, type: 'fixed', value: 'P', description: 'Employee identifier' },
              {
                position: 10,
                type: 'numbers_range',
                description: 'Serial number range',
                range: { min: 1, max: 99, positions: [10, 11] }
              }
            ],
            specialCharacters: [],
            example: `INST${newDepartment.code}EMP01`,
            description: 'Employee registration number format'
          },
          guest: {
            totalLength: 9,
            structure: [
              { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
              { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
              { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
              { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
              { position: 4, type: 'alphabet', description: 'Department code - first letter' },
              { position: 5, type: 'alphabet', description: 'Department code - second letter' },
              { position: 6, type: 'alphabet', description: 'Department code - third letter' },
              { position: 7, type: 'fixed', value: 'G', description: 'Guest identifier' },
              {
                position: 8,
                type: 'numbers_range',
                description: 'Serial number range',
                range: { min: 1, max: 99, positions: [8, 9] }
              }
            ],
            specialCharacters: [],
            example: `INST${newDepartment.code}G01`,
            description: 'Guest registration number format'
          }
        }
      });
    }
    setNewDepartment(prev => ({ ...prev, registrationFormats: formats }));
  };

  const handleUpdateDepartmentInCollege = (collegeId: string, deptCode: string, updates: { name?: string; isActive?: boolean }) => {
    updateDepartmentInCollegeMutation.mutate({ collegeId, deptCode, ...updates });
  };

  const handleDeleteDepartmentFromCollege = (collegeId: string, deptCode: string) => {
    if (window.confirm(`Are you sure you want to delete department ${deptCode}? This action cannot be undone.`)) {
      deleteDepartmentFromCollegeMutation.mutate({ collegeId, deptCode });
    }
  };

  const handleToggleDepartmentStatusInCollege = (collegeId: string, deptCode: string, isActive: boolean) => {
    handleUpdateDepartmentInCollege(collegeId, deptCode, { isActive });
  };

  const handleUpdateDepartmentStudyDuration = (collegeId: string, deptCode: string, studyDuration: number) => {
    handleUpdateDepartmentInCollege(collegeId, deptCode, { studyDuration });
  };

  const handleAddRegistrationFormat = (collegeId: string, deptCode: string) => {
    setFormatBuilderCollege(collegeId);
    setFormatBuilderDept(deptCode);
    setFormatBuilderYear(new Date().getFullYear());
    setShowFormatBuilder(true);
  };

  const handleSaveRegistrationFormat = (format: any) => {
    if (isEditingFormat && editingFormat && editingFormat.id) {
      // Update existing format (only if it has an ID)
      updateRegistrationFormatMutation.mutate({
        collegeId: formatBuilderCollege,
        deptCode: formatBuilderDept,
        formatId: editingFormat.id,
        formats: format.formats
      });
    } else {
      // Create new format (either new format or legacy format without ID)
      addRegistrationFormatMutation.mutate({
        collegeId: formatBuilderCollege,
        deptCode: formatBuilderDept,
        year: format.year,
        name: format.name,
        formats: format.formats
      });
    }
  };

  const handleUpdateRegistrationFormat = (collegeId: string, deptCode: string, formatId: string, formats: any) => {
    updateRegistrationFormatMutation.mutate({ collegeId, deptCode, formatId, formats });
  };

  const handleDeleteRegistrationFormat = (collegeId: string, deptCode: string, formatId: string, formatName: string) => {
    if (!formatId) {
      alert('This is a legacy format that cannot be deleted. Please contact support to remove it.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the registration format "${formatName}"? This action cannot be undone.`)) {
      deleteRegistrationFormatMutation.mutate({ collegeId, deptCode, formatId });
    }
  };

  // Role management handlers
  const handleOpenRoleManagement = (collegeId: string) => {
    const college = colleges.find(c => c.id === collegeId);
    console.log('🔧 Opening role management for college:', {
      collegeId,
      college: college ? { id: college.id, name: college.name, activeRoles: college.activeRoles } : 'Not found'
    });
    if (college && college.activeRoles) {
      setEditingRoles(college.activeRoles);
    } else {
      // Set default roles if college doesn't have activeRoles
      setEditingRoles({
        student: true,
        staff: true,
        employee: true,
        guest: true
      });
    }
    setShowRoleManagement(collegeId);
  };

  const handleCloseRoleManagement = () => {
    setShowRoleManagement(null);
    setEditingRoles({
      student: true,
      staff: true,
      employee: true,
      guest: true
    });
  };

  const handleSaveRoleManagement = (collegeId: string) => {
    console.log('💾 Saving role management:', { collegeId, activeRoles: editingRoles });
    updateCollegeRolesMutation.mutate({ collegeId, activeRoles: editingRoles });
  };

  const handleRoleToggle = (role: 'student' | 'staff' | 'employee' | 'guest') => {
    setEditingRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">College Management</h1>
          <p className="text-muted-foreground">
            Manage colleges and their departments
          </p>
        </div>
      </div>

      {/* College Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5" />
            <span>College Management</span>
            <Badge variant="outline" className="text-xs">
              {colleges.filter(c => c.isActive).length} Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Add New College */}
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Add New College</span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCollege(!showAddCollege)}
                >
                  {showAddCollege ? 'Cancel' : 'Add College'}
                </Button>
              </div>

              {showAddCollege && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collegeCode">College Code</Label>
                    <Input
                      id="collegeCode"
                      placeholder="e.g., INST, MIT, IIT"
                      value={newCollege.code}
                      onChange={(e) => setNewCollege(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collegeName">College Name</Label>
                    <Input
                      id="collegeName"
                      placeholder="e.g., Institution College of Technology"
                      value={newCollege.name}
                      onChange={(e) => setNewCollege(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="e.g., admin@college.edu"
                      value={newCollege.adminEmail}
                      onChange={(e) => setNewCollege(prev => ({ ...prev, adminEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newCollege.isActive}
                        onCheckedChange={(checked) => setNewCollege(prev => ({ ...prev, isActive: checked }))}
                      />
                      <span className="text-sm">{newCollege.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              )}

              {showAddCollege && (
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleAddCollege}
                    disabled={addCollegeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {addCollegeMutation.isPending ? 'Adding...' : 'Add College'}
                  </Button>
                </div>
              )}
            </div>

            {/* Colleges List */}
            <div className="space-y-4">
              <h3 className="font-medium">Current Colleges</h3>
              {collegesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Loading colleges...</p>
                </div>
              ) : colleges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No colleges found. Add your first college above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {colleges.map((college) => (
                    <div key={college.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* College Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-lg">{college.code}</h4>
                            <Badge variant={college.isActive ? "default" : "secondary"}>
                              {college.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {college.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {college.departments.filter(d => d.isActive).length} active departments
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingCollege(isEditingCollege === college.id ? null : college.id)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCollege(college.id)}
                            disabled={deleteCollegeMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* College Controls */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={college.isActive}
                            onCheckedChange={(checked) => handleToggleCollegeStatus(college.id, checked)}
                            disabled={updateCollegeMutation.isPending}
                          />
                          <span className="text-xs text-muted-foreground">
                            {college.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRoleManagement(college.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Manage Roles
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCollege(selectedCollege === college.id ? null : college.id)}
                          >
                            {selectedCollege === college.id ? 'Hide Departments' : 'Manage Departments'}
                          </Button>
                        </div>
                      </div>

                      {/* Edit College Mode */}
                      {isEditingCollege === college.id && (
                        <div className="mb-4 pt-4 border-t space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-college-name-${college.id}`}>College Name</Label>
                              <Input
                                id={`edit-college-name-${college.id}`}
                                defaultValue={college.name}
                                onBlur={(e) => {
                                  const newName = e.target.value.trim();
                                  if (newName && newName !== college.name) {
                                    handleUpdateCollege(college.id, { name: newName });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newName = e.currentTarget.value.trim();
                                    if (newName && newName !== college.name) {
                                      handleUpdateCollege(college.id, { name: newName });
                                    }
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-college-code-${college.id}`}>College Code</Label>
                              <Input
                                id={`edit-college-code-${college.id}`}
                                defaultValue={college.code}
                                onBlur={(e) => {
                                  const newCode = e.target.value.trim().toUpperCase();
                                  if (newCode && newCode !== college.code) {
                                    handleUpdateCollege(college.id, { code: newCode });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newCode = e.currentTarget.value.trim().toUpperCase();
                                    if (newCode && newCode !== college.code) {
                                      handleUpdateCollege(college.id, { code: newCode });
                                    }
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-dept-email-${college.id}`}>Admin Email</Label>
                              <Input
                                id={`edit-dept-email-${college.id}`}
                                type="email"
                                defaultValue={college.adminEmail || ''}
                                onBlur={(e) => {
                                  const newEmail = e.target.value.trim();
                                  if (newEmail !== (college.adminEmail || '')) {
                                    handleUpdateCollege(college.id, { adminEmail: newEmail });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newEmail = e.currentTarget.value.trim();
                                    if (newEmail !== (college.adminEmail || '')) {
                                      handleUpdateCollege(college.id, { adminEmail: newEmail });
                                    }
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingCollege(null)}
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Role Management Section */}
                      {showRoleManagement === college.id && (
                        <div className="mb-4 pt-4 border-t space-y-4">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium text-sm">Manage Active Roles</h5>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCloseRoleManagement}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveRoleManagement(college.id)}
                                disabled={updateCollegeRolesMutation.isPending}
                              >
                                {updateCollegeRolesMutation.isPending ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={editingRoles.student}
                                onCheckedChange={() => handleRoleToggle('student')}
                              />
                              <Label className="text-sm">Student</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={editingRoles.staff}
                                onCheckedChange={() => handleRoleToggle('staff')}
                              />
                              <Label className="text-sm">Staff</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={editingRoles.employee}
                                onCheckedChange={() => handleRoleToggle('employee')}
                              />
                              <Label className="text-sm">Employee</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={editingRoles.guest}
                                onCheckedChange={() => handleRoleToggle('guest')}
                              />
                              <Label className="text-sm">Guest</Label>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Only enabled roles will be available for selection during user registration.
                          </div>
                        </div>
                      )}

                      {/* Departments Section */}
                      {selectedCollege === college.id && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium flex items-center space-x-2">
                              <BookOpen className="w-4 h-4" />
                              <span>Departments in {college.code}</span>
                              <Badge variant="outline" className="text-xs">
                                {college.departments.filter(d => d.isActive).length} Active
                              </Badge>
                            </h5>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddDepartment(!showAddDepartment)}
                            >
                              {showAddDepartment ? 'Cancel' : 'Add Department'}
                            </Button>
                          </div>

                          {/* Add Department Form */}
                          {showAddDepartment && (
                            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="deptCode">Department Code</Label>
                                  <Input
                                    id="deptCode"
                                    placeholder="e.g., CSE, ECE, MECH"
                                    value={newDepartment.code}
                                    onChange={(e) => setNewDepartment(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    maxLength={10}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="deptName">Department Name</Label>
                                  <Input
                                    id="deptName"
                                    placeholder="e.g., Computer Science and Engineering"
                                    value={newDepartment.name}
                                    onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="studyDuration">Study Duration (Years)</Label>
                                  <Input
                                    id="studyDuration"
                                    type="number"
                                    min="1"
                                    max="10"
                                    placeholder="4"
                                    value={newDepartment.studyDuration}
                                    onChange={(e) => {
                                      const duration = parseInt(e.target.value) || 4;
                                      setNewDepartment(prev => ({
                                        ...prev,
                                        studyDuration: duration,
                                        registrationFormats: [] // Reset formats when duration changes
                                      }));
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={newDepartment.isActive}
                                      onCheckedChange={(checked) => setNewDepartment(prev => ({ ...prev, isActive: checked }))}
                                    />
                                    <span className="text-sm">{newDepartment.isActive ? 'Active' : 'Inactive'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Registration Formats Section */}
                              <div className="mt-6 border-t pt-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h4 className="text-sm font-medium">Registration Formats (Required)</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Formats must be provided for all {newDepartment.studyDuration} years of study
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={generateDefaultFormats}
                                      disabled={!newDepartment.code.trim()}
                                    >
                                      Generate Default Formats
                                    </Button>
                                  </div>
                                </div>

                                {/* Format Status */}
                                <div className="mb-4">
                                  <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: newDepartment.studyDuration }, (_, i) => i + 1).map(year => {
                                      const hasFormat = newDepartment.registrationFormats.some(f => f.year === year);
                                      return (
                                        <Badge
                                          key={year}
                                          variant={hasFormat ? "default" : "destructive"}
                                          className="text-xs"
                                        >
                                          Year {year} {hasFormat ? '✓' : '✗'}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Format Builder Buttons */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {Array.from({ length: newDepartment.studyDuration }, (_, i) => i + 1).map(year => (
                                    <Button
                                      key={year}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setCurrentFormatYear(year);
                                        setShowDepartmentFormatBuilder(true);
                                      }}
                                      className="text-xs"
                                    >
                                      {newDepartment.registrationFormats.some(f => f.year === year) ? 'Edit' : 'Add'} Year {year}
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex justify-end mt-4">
                                <div className="flex flex-col items-end space-y-2">
                                  {newDepartment.registrationFormats.length !== newDepartment.studyDuration && (
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                      Missing {newDepartment.studyDuration - newDepartment.registrationFormats.length} registration format(s)
                                    </div>
                                  )}
                                  <Button
                                    onClick={() => handleAddDepartmentToCollege(college.id)}
                                    disabled={addDepartmentToCollegeMutation.isPending || newDepartment.registrationFormats.length !== newDepartment.studyDuration}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    {addDepartmentToCollegeMutation.isPending ? 'Adding...' : 'Add Department'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Departments List */}
                          {college.departments.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No departments in this college yet.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {college.departments.map((dept) => (
                                <div key={dept.code} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <h6 className="font-medium text-sm">{dept.code}</h6>
                                        <Badge variant={dept.isActive ? "default" : "secondary"} className="text-xs">
                                          {dept.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {dept.name}
                                      </p>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                          <Clock className="w-3 h-3" />
                                          <span>{dept.studyDuration || 4} years</span>
                                        </div>
                                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                          <Hash className="w-3 h-3" />
                                          <span>{(dept.registrationFormats || []).length} formats</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowRegistrationFormats(showRegistrationFormats === `${college.id}-${dept.code}` ? null : `${college.id}-${dept.code}`)}
                                        title="Manage Registration Formats"
                                      >
                                        <Settings className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditingDepartment(isEditingDepartment === `${college.id}-${dept.code}` ? null : `${college.id}-${dept.code}`)}
                                        title="Edit Department"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteDepartmentFromCollege(college.id, dept.code)}
                                        disabled={deleteDepartmentFromCollegeMutation.isPending}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Delete Department"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={dept.isActive}
                                        onCheckedChange={(checked) => handleToggleDepartmentStatusInCollege(college.id, dept.code, checked)}
                                        disabled={updateDepartmentInCollegeMutation.isPending}
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {dept.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Edit Department Mode */}
                                  {isEditingDepartment === `${college.id}-${dept.code}` && (
                                    <div className="mt-3 pt-3 border-t space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                          <Label htmlFor={`edit-dept-name-${college.id}-${dept.code}`} className="text-xs">Department Name</Label>
                                          <Input
                                            id={`edit-dept-name-${college.id}-${dept.code}`}
                                            defaultValue={dept.name}
                                            onBlur={(e) => {
                                              const newName = e.target.value.trim();
                                              if (newName && newName !== dept.name) {
                                                handleUpdateDepartmentInCollege(college.id, dept.code, { name: newName });
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const newName = e.currentTarget.value.trim();
                                                if (newName && newName !== dept.name) {
                                                  handleUpdateDepartmentInCollege(college.id, dept.code, { name: newName });
                                                }
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            className="text-sm"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor={`edit-dept-duration-${college.id}-${dept.code}`} className="text-xs">Study Duration (Years)</Label>
                                          <Input
                                            id={`edit-dept-duration-${college.id}-${dept.code}`}
                                            type="number"
                                            min="1"
                                            max="10"
                                            defaultValue={dept.studyDuration || 4}
                                            onBlur={(e) => {
                                              const newDuration = parseInt(e.target.value);
                                              if (newDuration && newDuration !== (dept.studyDuration || 4)) {
                                                handleUpdateDepartmentStudyDuration(college.id, dept.code, newDuration);
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const newDuration = parseInt(e.currentTarget.value);
                                                if (newDuration && newDuration !== (dept.studyDuration || 4)) {
                                                  handleUpdateDepartmentStudyDuration(college.id, dept.code, newDuration);
                                                }
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            className="text-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex justify-end">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setIsEditingDepartment(null)}
                                        >
                                          Done
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Registration Format Management */}
                                  {showRegistrationFormats === `${college.id}-${dept.code}` && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="flex items-center justify-between mb-3">
                                        <h6 className="font-medium text-sm flex items-center space-x-2">
                                          <Hash className="w-4 h-4" />
                                          <span>Registration Formats for {dept.code}</span>
                                        </h6>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setShowAddRegistrationFormat(!showAddRegistrationFormat)}
                                        >
                                          {showAddRegistrationFormat ? 'Cancel' : 'Add Format'}
                                        </Button>
                                      </div>

                                      {/* Add Registration Format Form */}
                                      {showAddRegistrationFormat && (
                                        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                          <div className="space-y-4">
                                            <div className="text-center">
                                              <p className="text-sm text-muted-foreground mb-3">
                                                Create detailed registration number formats with position-based validation rules
                                              </p>
                                            </div>

                                            <div className="space-y-3">
                                              <div className="space-y-2">
                                                <Label htmlFor={`year-${college.id}-${dept.code}`} className="text-sm font-medium">
                                                  Select Academic Year for Format
                                                </Label>
                                                <Select
                                                  value={newFormatYear.toString()}
                                                  onValueChange={(value) => setNewFormatYear(parseInt(value))}
                                                >
                                                  <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select academic year" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {Array.from({ length: dept.studyDuration || 4 }, (_, i) => i + 1).map((year) => (
                                                      <SelectItem key={year} value={year.toString()}>
                                                        {year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">
                                                  This will create a new format for the selected academic year. Each academic year can have different registration number formats.
                                                </p>
                                              </div>

                                              <div className="flex items-center justify-between pt-2">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setShowAddRegistrationFormat(false);
                                                    setNewFormatYear(1);
                                                  }}
                                                >
                                                  Cancel
                                                </Button>
                                                <Button
                                                  onClick={() => {
                                                    setFormatBuilderCollege(college.id);
                                                    setFormatBuilderDept(dept.code);
                                                    setFormatBuilderYear(newFormatYear);
                                                    setIsEditingFormat(false);
                                                    setShowFormatBuilder(true);
                                                    setShowAddRegistrationFormat(false);
                                                  }}
                                                  className="bg-blue-600 hover:bg-blue-700"
                                                  disabled={!newFormatYear || newFormatYear < 1 || newFormatYear > (dept.studyDuration || 4)}
                                                >
                                                  <Settings className="w-4 h-4 mr-2" />
                                                  Create Format for {newFormatYear === 1 ? '1st Year' : newFormatYear === 2 ? '2nd Year' : newFormatYear === 3 ? '3rd Year' : `${newFormatYear}th Year`}
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Existing Years Quick Access */}
                                      {(dept.registrationFormats || []).length > 0 && (
                                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                          <div className="flex items-center justify-between mb-2">
                                            <h6 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                              Quick Edit Existing Years
                                            </h6>
                                            <Badge variant="outline" className="text-xs">
                                              {(dept.registrationFormats || []).length} years configured
                                            </Badge>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {(dept.registrationFormats || []).map((format, index) => (
                                              <Button
                                                key={format.id || `format-${format.year}-${index}`}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setFormatBuilderCollege(college.id);
                                                  setFormatBuilderDept(dept.code);
                                                  setFormatBuilderYear(format.year);
                                                  setEditingFormat(format);
                                                  setIsEditingFormat(true);
                                                  setShowFormatBuilder(true);
                                                }}
                                                className="text-xs"
                                              >
                                                <Edit className="w-3 h-3 mr-1" />
                                                {format.name || (format.year === 1 ? '1st Year' : format.year === 2 ? '2nd Year' : format.year === 3 ? '3rd Year' : `${format.year}th Year`)}
                                              </Button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Registration Formats List */}
                                      {(dept.registrationFormats || []).length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">
                                          <Hash className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                          <p className="text-xs">No registration formats configured yet.</p>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {(dept.registrationFormats || []).map((format, index) => (
                                            <div key={format.id || `format-${format.year}-${index}`} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                                              <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                  <div className="flex items-center space-x-2 mb-2">
                                                    <h6 className="font-medium text-sm">
                                                      {format.name || `Year ${format.year} Format`}
                                                    </h6>
                                                    <Badge variant="outline" className="text-xs">
                                                      {format.year === 1 ? '1st Year' : format.year === 2 ? '2nd Year' : format.year === 3 ? '3rd Year' : `${format.year}th Year`}
                                                    </Badge>
                                                  </div>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                                    {format.formats && Object.entries(format.formats).map(([userType, userFormat]) => (
                                                      <div key={userType} className="space-y-1">
                                                        <span className="text-muted-foreground capitalize">{userType}:</span>
                                                        <div className="space-y-1">
                                                          <p className="font-mono bg-white dark:bg-gray-700 p-1 rounded text-xs">
                                                            {userFormat.example || 'No example'}
                                                          </p>
                                                          <p className="text-xs text-muted-foreground">
                                                            {userFormat.totalLength} chars
                                                          </p>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      setFormatBuilderCollege(college.id);
                                                      setFormatBuilderDept(dept.code);
                                                      setFormatBuilderYear(format.year);
                                                      setEditingFormat(format);
                                                      setIsEditingFormat(true);
                                                      setShowFormatBuilder(true);
                                                    }}
                                                    title="Edit Format"
                                                  >
                                                    <Edit className="w-3 h-3" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteRegistrationFormat(college.id, dept.code, format.id || '', format.name || `Year ${format.year} Format`)}
                                                    disabled={deleteRegistrationFormatMutation.isPending}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    title="Delete Format"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="text-xs text-gray-600 bg-blue-50 dark:bg-blue-950/20 rounded p-3">
              <p className="mb-2"><strong>🏫 College Management:</strong></p>
              <ul className="space-y-1 text-xs">
                <li>• Colleges contain departments hierarchically - students select college first, then department</li>
                <li>• College codes are used throughout the application for identification</li>
                <li>• Only active colleges and departments will appear in registration forms</li>
                <li>• Changes to colleges and departments will be reflected immediately across the application</li>
                <li>• Deleting a college will also delete all its departments and affect existing users</li>
                <li>• <strong>Study Duration:</strong> Set the number of years for each department's program</li>
                <li>• <strong>Registration Formats:</strong> Configure detailed registration number structures with position-based validation</li>
                <li>• <strong>Format Builder:</strong> Define total length, character types per position, department code placement, and special characters</li>
                <li>• <strong>User Types:</strong> Separate formats for students, staff, employees, and guests</li>
                <li>• <strong>Validation Rules:</strong> Specify digit, alphabet, alphanumeric, or fixed characters for each position</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Format Builder Modal */}
      {showFormatBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Registration Format Builder</h3>
                  <p className="text-sm text-muted-foreground">
                    Department: {formatBuilderDept} | {formatBuilderYear === 1 ? '1st Year' : formatBuilderYear === 2 ? '2nd Year' : formatBuilderYear === 3 ? '3rd Year' : `${formatBuilderYear}th Year`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowFormatBuilder(false);
                    setIsEditingFormat(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <RegistrationFormatBuilder
                year={formatBuilderYear}
                departmentCode={formatBuilderDept}
                studyDuration={colleges.find(c => c.id === formatBuilderCollege)?.departments.find(d => d.code === formatBuilderDept)?.studyDuration || 4}
                onSave={handleSaveRegistrationFormat}
                onCancel={() => {
                  setShowFormatBuilder(false);
                  setIsEditingFormat(false);
                  setEditingFormat(null);
                }}
                initialFormat={isEditingFormat ? editingFormat : undefined}
                isEditing={isEditingFormat}
                existingFormats={colleges.find(c => c.id === formatBuilderCollege)?.departments.find(d => d.code === formatBuilderDept)?.registrationFormats || []}
              />
            </div>
          </div>
        </div>
      )}

      {/* Department Creation Format Builder */}
      {showDepartmentFormatBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Registration Format Builder</h3>
                <p className="text-sm text-muted-foreground">
                  Year {currentFormatYear} - {newDepartment.code} Department
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDepartmentFormatBuilder(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <RegistrationFormatBuilder
                year={currentFormatYear}
                departmentCode={newDepartment.code}
                studyDuration={newDepartment.studyDuration}
                onSave={(format) => handleFormatSave(currentFormatYear, format)}
                onCancel={() => setShowDepartmentFormatBuilder(false)}
                existingFormats={newDepartment.registrationFormats}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




