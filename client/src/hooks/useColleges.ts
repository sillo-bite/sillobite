import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Department {
  code: string;
  name: string;
  isActive: boolean;
  studyDuration: number; // Duration in years (required)
  registrationFormats: Array<{
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
  }>; // Required for all years
  createdAt: Date;
  updatedAt: Date;
}

export interface College {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  adminEmail?: string;
  activeRoles: {
    student: boolean;
    staff: boolean;
    employee: boolean;
    guest: boolean;
  };
  departments: Department[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CollegesResponse {
  colleges: College[];
}

export function useColleges() {
  return useQuery<CollegesResponse>({
    queryKey: ['/api/system-settings/colleges'],
    queryFn: async () => apiRequest('/api/system-settings/colleges'),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });
}

export function useActiveColleges() {
  const { data, ...rest } = useColleges();

  return {
    ...rest,
    data: data ? {
      colleges: data.colleges.filter(college => college.isActive)
    } : undefined
  };
}

export function useDepartmentsByCollege(collegeId?: string) {
  const { data: collegesData, ...rest } = useColleges();

  return {
    ...rest,
    data: collegeId && collegesData ? {
      departments: collegesData.colleges
        .find(college => college.id === collegeId)
        ?.departments.filter(dept => dept.isActive) || []
    } : undefined
  };
}

