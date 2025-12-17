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

export interface DepartmentsResponse {
  departments: Department[];
}

// Legacy hook for backward compatibility - returns all departments from all colleges
export function useDepartments() {
  return useQuery<DepartmentsResponse>({
    queryKey: ['/api/system-settings/departments'],
    queryFn: async () => apiRequest('/api/system-settings/departments'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// Legacy hook for backward compatibility - returns all active departments from all colleges
export function useActiveDepartments() {
  const { data, ...rest } = useDepartments();
  
  return {
    ...rest,
    data: data ? {
      departments: data.departments.filter(dept => dept.isActive)
    } : undefined
  };
}
