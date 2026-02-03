import React, { useState, useEffect } from "react";
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
    GraduationCap, Plus, Edit, Trash2, BookOpen, Clock, Hash, Settings, X, ArrowLeft, Save, QrCode, MapPin
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegistrationFormatBuilder from "./RegistrationFormatBuilder";
import CollegeAddressQRManagement from "./CollegeAddressQRManagement";
import { useAuthSync } from "@/hooks/useDataSync";
import { useRoute, useLocation } from "wouter";

// Helper function to generate default formats (copied from original file)
const generateDefaultFormatsForDept = (studyDuration: number, deptCode: string) => {
    const formats = [];
    for (let year = 1; year <= studyDuration; year++) {
        const yearText = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`;
        const formatId = `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const formatName = `${deptCode} ${yearText} Standard Format`;

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
                    example: `INST24${deptCode}01`,
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
                    example: `INST${deptCode}STAFF1`,
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
                    example: `INST${deptCode}EMP01`,
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
                    example: `INST${deptCode}G01`,
                    description: 'Guest registration number format'
                }
            }
        });
    }
    return formats;
};

export default function AdminCollegeDetailsPage() {
    const { user } = useAuthSync();
    const [, setLocation] = useLocation();
    const [match, params] = useRoute("/admin/college-management/:collegeId");
    const collegeId = params?.collegeId;

    // Local State
    const [isEditingCollege, setIsEditingCollege] = useState(false);
    const [collegeForm, setCollegeForm] = useState({ name: '', code: '', adminEmail: '' });

    // Department Management State
    const [showAddDepartment, setShowAddDepartment] = useState(false);
    const [isEditingDepartment, setIsEditingDepartment] = useState<string | null>(null);
    const [newDepartment, setNewDepartment] = useState({
        code: '',
        name: '',
        isActive: true,
        studyDuration: 4,
        registrationFormats: [] as any[]
    });

    // Format Builder State
    const [showRegistrationFormats, setShowRegistrationFormats] = useState<string | null>(null);
    const [showAddRegistrationFormat, setShowAddRegistrationFormat] = useState(false);
    const [showFormatBuilder, setShowFormatBuilder] = useState(false);
    const [showDepartmentFormatBuilder, setShowDepartmentFormatBuilder] = useState(false);
    const [currentFormatYear, setCurrentFormatYear] = useState<number>(1);
    const [formatBuilderYear, setFormatBuilderYear] = useState<number>(1);
    const [formatBuilderDept, setFormatBuilderDept] = useState<string>('');
    const [newFormatYear, setNewFormatYear] = useState<number>(1);
    const [isEditingFormat, setIsEditingFormat] = useState<boolean>(false);
    const [editingFormat, setEditingFormat] = useState<any>(null);

    // Role Management State
    const [showRoleManagement, setShowRoleManagement] = useState(false);
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

    // Fetch all colleges to find the specific one (since we don't have a single GET endpoint yet)
    const { data: collegesData, isLoading: collegesLoading } = useQuery({
        queryKey: ['/api/system-settings/colleges'],
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    const college = React.useMemo(() => {
        if (collegesData && typeof collegesData === 'object' && 'colleges' in collegesData) {
            return (collegesData as any).colleges.find((c: any) => c.id === collegeId);
        }
        return null;
    }, [collegesData, collegeId]);

    // Sync state when college data is loaded
    useEffect(() => {
        if (college) {
            setCollegeForm({
                name: college.name,
                code: college.code,
                adminEmail: college.adminEmail || ''
            });
            if (college.activeRoles) {
                setEditingRoles(college.activeRoles);
            }
        }
    }, [college]);

    // Mutations
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
            setIsEditingCollege(false);
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
            setLocation('/admin/college-management');
        },
        onError: (error: any) => {
            console.error('Error deleting college:', error);
        }
    });

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
            setShowRoleManagement(false);
        },
        onError: (error: any) => {
            console.error('Error updating college roles:', error);
        }
    });

    const addDepartmentToCollegeMutation = useMutation({
        mutationFn: async ({ collegeId, ...departmentData }: { collegeId: string; code: string; name: string; isActive: boolean; studyDuration: number; registrationFormats: any[] }) => {
            const requestData = {
                ...departmentData,
                updatedBy: user?.id
            };
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
            let errorMessage = 'Unknown error';
            if (error.message) errorMessage = error.message;
            else if (error.response?.data?.error) errorMessage = error.response.data.error;
            alert(`Failed to add department: ${errorMessage}`);
        }
    });

    const updateDepartmentInCollegeMutation = useMutation({
        mutationFn: async ({ collegeId, deptCode, ...updateData }: { collegeId: string; deptCode: string; name?: string; isActive?: boolean, studyDuration?: number }) => {
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


    // Handlers
    const handleSaveCollegeDetails = () => {
        if (!collegeId) return;
        updateCollegeMutation.mutate({
            id: collegeId,
            name: collegeForm.name,
            code: collegeForm.code,
            adminEmail: collegeForm.adminEmail
        });
    };

    const handleToggleCollegeStatus = (isActive: boolean) => {
        if (!collegeId) return;
        updateCollegeMutation.mutate({ id: collegeId, isActive });
    };

    const handleDeleteCollege = () => {
        if (!collegeId) return;
        if (window.confirm(`Are you sure you want to delete this college? This will also delete all departments in this college. This action cannot be undone.`)) {
            deleteCollegeMutation.mutate(collegeId);
        }
    };

    const handleRoleToggle = (role: 'student' | 'staff' | 'employee' | 'guest') => {
        setEditingRoles(prev => ({
            ...prev,
            [role]: !prev[role]
        }));
    };

    const handleSaveRoles = () => {
        if (!collegeId) return;
        updateCollegeRolesMutation.mutate({
            collegeId,
            activeRoles: editingRoles
        });
    };

    const handleAddDepartment = () => {
        if (!collegeId) return;
        if (!newDepartment.code.trim() || !newDepartment.name.trim()) {
            alert('Please provide both department code and name.');
            return;
        }
        if (newDepartment.registrationFormats.length !== newDepartment.studyDuration) {
            alert(`Please provide registration formats for all ${newDepartment.studyDuration} years of study. Currently have ${newDepartment.registrationFormats.length} formats.`);
            return;
        }
        addDepartmentToCollegeMutation.mutate({ collegeId, ...newDepartment });
    };

    const generateDefaultFormats = () => {
        const formats = generateDefaultFormatsForDept(newDepartment.studyDuration, newDepartment.code);
        setNewDepartment(prev => ({ ...prev, registrationFormats: formats }));
    };

    const handleFormatSaveForNewDept = (year: number, format: any) => {
        setNewDepartment(prev => {
            const existingFormatIndex = prev.registrationFormats.findIndex(f => f.year === year);
            const newFormats = [...prev.registrationFormats];

            const isRegistrationFormat = format && typeof format === 'object' &&
                ('id' in format || 'name' in format) && 'formats' in format;

            if (existingFormatIndex >= 0) {
                if (isRegistrationFormat) newFormats[existingFormatIndex] = format;
                else newFormats[existingFormatIndex] = { year, formats: format };
            } else {
                if (isRegistrationFormat) newFormats.push(format);
                else newFormats.push({ year, formats: format });
            }
            return { ...prev, registrationFormats: newFormats };
        });
        setShowDepartmentFormatBuilder(false);
    };

    // Shared format save handler (for both new dept and existing dept)
    const handleSaveRegistrationFormat = (format: any) => {
        if (!collegeId) return;

        if (showDepartmentFormatBuilder && !formatBuilderDept) {
            // Used when adding NEW department (formatBuilderDept is empty string usually but check context)
            // Wait, for new department builder we used 'handleFormatSaveForNewDept'
            // This function is for existing departments.
            return;
        }

        if (isEditingFormat && editingFormat && editingFormat.id) {
            updateRegistrationFormatMutation.mutate({
                collegeId,
                deptCode: formatBuilderDept,
                formatId: editingFormat.id,
                formats: format.formats
            });
        } else {
            addRegistrationFormatMutation.mutate({
                collegeId,
                deptCode: formatBuilderDept,
                year: format.year,
                name: format.name,
                formats: format.formats
            });
        }
    };


    if (collegesLoading) {
        return <div className="p-8 text-center">Loading college details...</div>;
    }

    if (!college) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-600">College not found</h2>
                <Button variant="outline" className="mt-4" onClick={() => setLocation('/admin/college-management')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to List
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" onClick={() => setLocation('/admin/college-management')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{college.name}</h1>
                        <p className="text-muted-foreground">
                            Manage details, departments, and roles for {college.code}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={college.isActive}
                        onCheckedChange={handleToggleCollegeStatus}
                    />
                    <span className="text-sm text-muted-foreground mr-4">
                        {college.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteCollege}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete College
                    </Button>
                </div>
            </div>

            {/* Basic Info & Roles Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* College Information */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <GraduationCap className="w-5 h-5 mr-2 text-primary" />
                            College Information
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingCollege(!isEditingCollege)}>
                            <Edit className="w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {isEditingCollege ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>College Name</Label>
                                        <Input
                                            value={collegeForm.name}
                                            onChange={(e) => setCollegeForm(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>College Code</Label>
                                        <Input
                                            value={collegeForm.code}
                                            onChange={(e) => setCollegeForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label>Admin Email</Label>
                                        <Input
                                            value={collegeForm.adminEmail}
                                            onChange={(e) => setCollegeForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button variant="outline" onClick={() => setIsEditingCollege(false)}>Cancel</Button>
                                    <Button onClick={handleSaveCollegeDetails} disabled={updateCollegeMutation.isPending}>Save Changes</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">Name</Label>
                                    <p className="text-lg font-medium">{college.name}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Code</Label>
                                    <p className="text-lg font-medium">{college.code}</p>
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-muted-foreground">Admin Email</Label>
                                    <p className="text-base">{college.adminEmail || 'Not configured'}</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Role Management */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-primary" />
                            Active Roles
                        </CardTitle>
                        {!showRoleManagement ? (
                            <Button variant="ghost" size="sm" onClick={() => setShowRoleManagement(true)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                        ) : (
                            <div className="flex space-x-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowRoleManagement(false)}><X className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={handleSaveRoles}><Save className="w-4 h-4" /></Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {['student', 'staff', 'employee', 'guest'].map((role) => (
                                <div key={role} className="flex items-center justify-between">
                                    <span className="capitalize">{role}</span>
                                    <Switch
                                        checked={editingRoles[role as keyof typeof editingRoles]}
                                        onCheckedChange={() => handleRoleToggle(role as any)}
                                        disabled={!showRoleManagement}
                                    />
                                </div>
                            ))}
                        </div>
                        {showRoleManagement && (
                            <p className="text-xs text-muted-foreground mt-4">
                                Only enabled roles will be available for user registration.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* QR Manager */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium flex items-center">
                        <QrCode className="w-5 h-5 mr-2 text-primary" />
                        QR Manager
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="address" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                            <TabsTrigger value="address">Address QR</TabsTrigger>
                            <TabsTrigger value="location">Location QR</TabsTrigger>
                        </TabsList>
                        <TabsContent value="address" className="p-4 border rounded-md mt-4 bg-muted/20">
                            <CollegeAddressQRManagement collegeId={collegeId || ''} mode="address" />
                        </TabsContent>
                        <TabsContent value="location" className="p-4 border rounded-md mt-4 bg-muted/20">
                            <CollegeAddressQRManagement collegeId={collegeId || ''} mode="location" />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Departments Management */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
                    <Button onClick={() => setShowAddDepartment(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Department
                    </Button>
                </div>

                {/* Add Department Form */}
                {showAddDepartment && (
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Add New Department</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Department Code</Label>
                                    <Input
                                        placeholder="e.g. CSE"
                                        value={newDepartment.code}
                                        onChange={(e) => setNewDepartment(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Department Name</Label>
                                    <Input
                                        placeholder="e.g. Computer Science"
                                        value={newDepartment.name}
                                        onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Study Duration (Years)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="10"
                                        placeholder="4"
                                        value={newDepartment.studyDuration}
                                        onChange={(e) => {
                                            const duration = parseInt(e.target.value) || 4;
                                            setNewDepartment(prev => ({ ...prev, studyDuration: duration, registrationFormats: [] }));
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <div className="flex items-center space-x-2 h-10">
                                        <Switch
                                            checked={newDepartment.isActive}
                                            onCheckedChange={(checked) => setNewDepartment(prev => ({ ...prev, isActive: checked }))}
                                        />
                                        <span>{newDepartment.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Registration Formats for New Dept */}
                            <div className="mt-6 border-t pt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-medium">Registration Formats (Required)</h4>
                                        <p className="text-xs text-muted-foreground">Required for all {newDepartment.studyDuration} years</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={generateDefaultFormats} disabled={!newDepartment.code}>
                                        Generate Defaults
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {Array.from({ length: newDepartment.studyDuration }, (_, i) => i + 1).map(year => {
                                        const hasFormat = newDepartment.registrationFormats.some(f => f.year === year);
                                        return (
                                            <Button
                                                key={year}
                                                variant={hasFormat ? "default" : "outline"}
                                                size="sm"
                                                className={!hasFormat ? "border-dashed" : ""}
                                                onClick={() => {
                                                    setCurrentFormatYear(year);
                                                    // We use DepartmentFormatBuilder state for LOCAL new department building
                                                    setShowDepartmentFormatBuilder(true);
                                                }}
                                            >
                                                Year {year} {hasFormat ? '✓' : ''}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2 mt-4">
                                <Button variant="ghost" onClick={() => setShowAddDepartment(false)}>Cancel</Button>
                                <Button onClick={handleAddDepartment} disabled={addDepartmentToCollegeMutation.isPending}>
                                    {addDepartmentToCollegeMutation.isPending ? 'Adding...' : 'Save Department'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Department List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {college.departments.map((dept: any) => (
                        <Card key={dept.code} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl flex items-center space-x-2">
                                            <span>{dept.code}</span>
                                            <Badge variant={dept.isActive ? "default" : "secondary"}>
                                                {dept.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </CardTitle>
                                        <div className="text-sm text-muted-foreground mt-1">{dept.name}</div>
                                    </div>
                                    <div className="flex space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingDepartment(isEditingDepartment === dept.code ? null : dept.code)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteDepartmentFromCollegeMutation.mutate({ collegeId: college.id, deptCode: dept.code })}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isEditingDepartment === dept.code ? (
                                    <div className="space-y-3 py-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Name</Label>
                                            <Input
                                                defaultValue={dept.name}
                                                onBlur={(e) => updateDepartmentInCollegeMutation.mutate({ collegeId: college.id, deptCode: dept.code, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Duration</Label>
                                            <Input
                                                type="number"
                                                defaultValue={dept.studyDuration}
                                                onBlur={(e) => updateDepartmentInCollegeMutation.mutate({ collegeId: college.id, deptCode: dept.code, studyDuration: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Status</span>
                                            <Switch
                                                checked={dept.isActive}
                                                onCheckedChange={(c) => updateDepartmentInCollegeMutation.mutate({ collegeId: college.id, deptCode: dept.code, isActive: c })}
                                            />
                                        </div>
                                        <Button size="sm" className="w-full" variant="secondary" onClick={() => setIsEditingDepartment(null)}>Done</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center text-sm text-muted-foreground space-x-4">
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-1" />
                                                {dept.studyDuration || 4} Years
                                            </div>
                                            <div className="flex items-center">
                                                <Hash className="w-4 h-4 mr-1" />
                                                {(dept.registrationFormats || []).length} Formats
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full text-xs"
                                            onClick={() => {
                                                setShowRegistrationFormats(showRegistrationFormats === dept.code ? null : dept.code);
                                            }}
                                        >
                                            <Settings className="w-3 h-3 mr-2" />
                                            Manage Registration Formats
                                        </Button>
                                    </div>
                                )}

                                {/* Registration Formats Expanded View */}
                                {showRegistrationFormats === dept.code && (
                                    <div className="mt-4 pt-4 border-t space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-medium">Formats</h4>
                                            <Button size="sm" variant="ghost" onClick={() => {
                                                setFormatBuilderDept(dept.code);
                                                setNewFormatYear(1);
                                                setShowAddRegistrationFormat(true);
                                            }}>
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        {/* Add Format Quick Select */}
                                        {showAddRegistrationFormat && formatBuilderDept === dept.code && (
                                            <div className="p-2 bg-muted rounded-md mb-2">
                                                <Label className="text-xs mb-1 block">Select Year</Label>
                                                <Select onValueChange={(v) => setNewFormatYear(parseInt(v))}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select Year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from({ length: dept.studyDuration || 4 }, (_, i) => i + 1).map(y => (
                                                            <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex justify-end mt-2">
                                                    <Button size="sm" variant="ghost" onClick={() => setShowAddRegistrationFormat(false)}>Cancel</Button>
                                                    <Button size="sm" onClick={() => {
                                                        setFormatBuilderYear(newFormatYear);
                                                        setIsEditingFormat(false);
                                                        setShowFormatBuilder(true);
                                                        setShowAddRegistrationFormat(false);
                                                    }}>Create</Button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {(dept.registrationFormats || []).map((fmt: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                                    <span>Year {fmt.year}</span>
                                                    <div className="flex space-x-1">
                                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                                            setFormatBuilderDept(dept.code);
                                                            setFormatBuilderYear(fmt.year);
                                                            setEditingFormat(fmt);
                                                            setIsEditingFormat(true);
                                                            setShowFormatBuilder(true);
                                                        }}>
                                                            <Edit className="w-3 h-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => {
                                                            if (fmt.id) deleteRegistrationFormatMutation.mutate({ collegeId: college.id, deptCode: dept.code, formatId: fmt.id });
                                                            else alert('Legacy format cannot be deleted via this UI.');
                                                        }}>
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </CardContent>
                        </Card>
                    ))}
                    {college.departments.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg border-dashed">
                            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No departments found. Add one to get started.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {/* Department Builder Modal (New Dept) */}
            {showDepartmentFormatBuilder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <RegistrationFormatBuilder
                            onCancel={() => setShowDepartmentFormatBuilder(false)}
                            onSave={(format) => handleFormatSaveForNewDept(currentFormatYear, format)}
                            initialFormat={undefined}
                            year={currentFormatYear}
                            departmentCode={newDepartment.code}
                            isEditing={false}
                        />
                    </div>
                </div>
            )}

            {/* Existing Dept Format Builder Modal */}
            {showFormatBuilder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <RegistrationFormatBuilder
                            onCancel={() => setShowFormatBuilder(false)}
                            onSave={handleSaveRegistrationFormat}
                            initialFormat={editingFormat}
                            year={formatBuilderYear}
                            departmentCode={formatBuilderDept}
                            isEditing={isEditingFormat}
                        />
                    </div>
                </div>
            )}

        </div>
    );
}
