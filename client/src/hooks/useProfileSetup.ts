import { useQuery } from '@tanstack/react-query';
import { useAuth } from "./useAuth";
import { UserRole } from "@shared/schema";
import { apiRequest } from '@/lib/queryClient';

// Hook to get institutions by type
export function useInstitutionsByType(institutionType: string | null, enabled: boolean = true) {
  console.log(`🔍 useInstitutionsByType - Called with:`, { institutionType, enabled });

  return useQuery({
    queryKey: ['institutions', institutionType],
    queryFn: async () => {
      if (!institutionType) {
        console.log(`🔍 useInstitutionsByType - No institution type, returning null`);
        return null;
      }

      const url = `/api/system-settings/institutions?type=${encodeURIComponent(institutionType)}`;
      console.log(`🔍 useInstitutionsByType - Fetching from URL: ${url}`);

      try {
        const result = await apiRequest(url);
        console.log(`🔍 useInstitutionsByType - API Response:`, result);
        console.log(`🔍 useInstitutionsByType - Institutions count:`, result?.institutions?.length || 0);
        return result;
      } catch (error) {
        console.error(`🔍 useInstitutionsByType - API Error:`, error);
        throw error;
      }
    },
    enabled: !!institutionType && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get departments by institution
export function useDepartmentsByInstitution(institutionType: string | null, institutionId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['departments', institutionType, institutionId],
    queryFn: async () => {
      if (!institutionType || !institutionId) {
        console.log(`🔍 useDepartmentsByInstitution - Missing params:`, { institutionType, institutionId });
        return null;
      }

      const url = `/api/system-settings/departments?institutionType=${encodeURIComponent(institutionType)}&institutionId=${encodeURIComponent(institutionId)}`;
      console.log(`🔍 useDepartmentsByInstitution - Fetching from URL: ${url}`);

      const result = await apiRequest(url);
      console.log(`🔍 useDepartmentsByInstitution - API Response:`, result);

      return result;
    },
    enabled: !!institutionType && !!institutionId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get registration formats by institution, department, year, and role
export function useRegistrationFormatsByInstitutionAndDepartment(
  institutionType: string | null,
  institutionId: string | null,
  departmentCode: string | null,
  year: number | null, // This can be passingOutYear for colleges or joiningYear for organizations
  role: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['registrationFormats', institutionType, institutionId, departmentCode, year, role],
    queryFn: async () => {
      if (!institutionType || !institutionId || !departmentCode || !year || !role) {
        console.log(`🔍 useRegistrationFormatsByInstitutionAndDepartment - Missing params:`, {
          institutionType, institutionId, departmentCode, year, role
        });
        return null;
      }

      // Build URL based on institution type and role
      let url: string;
      if (institutionType === 'college') {
        url = `/api/system-settings/registration-formats?institutionType=${encodeURIComponent(institutionType)}&institutionId=${encodeURIComponent(institutionId)}&departmentCode=${encodeURIComponent(departmentCode)}&passingOutYear=${encodeURIComponent(year.toString())}&role=${encodeURIComponent(role)}`;
      } else if (institutionType === 'organization') {
        // Organizations don't have students - all roles should use /registration-formats/no-year endpoint
        console.log(`🔍 useRegistrationFormatsByInstitutionAndDepartment - Organizations don't have students, this hook should not be used for organizations`);
        return null;
      } else {
        console.log(`🔍 useRegistrationFormatsByInstitutionAndDepartment - Invalid institution type:`, institutionType);
        return null;
      }

      console.log(`🔍 ===== API REQUEST DETAILS =====`);
      console.log(`🔍 Request URL: ${url}`);
      console.log(`🔍 Institution Type: ${institutionType}`);
      console.log(`🔍 Institution ID: ${institutionId}`);
      console.log(`🔍 Department Code: ${departmentCode}`);
      console.log(`🔍 Year (${institutionType === 'college' ? 'passingOutYear' : 'joiningYear'}): ${year}`);
      console.log(`🔍 Role: ${role}`);
      console.log(`🔍 ===== MAKING API REQUEST =====`);

      const result = await apiRequest(url);
      console.log(`🔍 useRegistrationFormatsByInstitutionAndDepartment - API Response:`, result);
      console.log(`🔍 ===== COMPLETE API RESPONSE RECEIVED =====`);
      console.log(`🔍 Response Success: ${result?.success}`);
      console.log(`🔍 Institution Type: ${result?.institutionType}`);
      console.log(`🔍 Institution ID: ${result?.institutionId}`);
      console.log(`🔍 Department Code: ${result?.departmentCode}`);
      console.log(`🔍 Passing Out Year: ${result?.passingOutYear}`);
      console.log(`🔍 Study Year: ${result?.studyYear}`);
      console.log(`🔍 Role: ${result?.role}`);
      console.log(`🔍 Total Formats Found: ${result?.totalFormatsFound}`);
      console.log(`🔍 Filtered Formats Count: ${result?.filteredFormatsCount}`);
      console.log(`🔍 Filtering Criteria:`, result?.filteringCriteria);
      console.log(`🔍 Complete API Response Object:`, result);

      if (result?.formats) {
        console.log(`🔍 useRegistrationFormatsByInstitutionAndDepartment - Formats details:`,
          result.formats.map((f: any) => ({
            id: f.id,
            name: f.name,
            year: f.year,
            hasStudentFormat: !!f.formats?.student,
            hasStaffFormat: !!f.formats?.staff,
            hasEmployeeFormat: !!f.formats?.employee,
            hasGuestFormat: !!f.formats?.guest
          }))
        );

        // Log complete format data received from server
        console.log(`🔍 CLIENT RECEIVED ${result.formats.length} FORMATS FROM SERVER:`);
        result.formats.forEach((format: any, index: number) => {
          console.log(`🔍 ===== CLIENT FORMAT ${index + 1} =====`);
          console.log(`🔍 Format ID: ${format.id}`);
          console.log(`🔍 Format Name: "${format.name}"`);
          console.log(`🔍 Format Year: ${format.year}`);
          console.log(`🔍 Complete formats object received:`, format.formats);

          // Log all roles available in the received data
          Object.keys(format.formats || {}).forEach(roleKey => {
            console.log(`🔍 Available role: ${roleKey}`);
          });

          // Log the requested role format in detail
          const requestedRoleFormat = format.formats?.[role];
          if (requestedRoleFormat) {
            console.log(`🔍 --- REQUESTED ${role.toUpperCase()} ROLE FORMAT ---`);
            console.log(`🔍   Total Length: ${requestedRoleFormat.totalLength}`);
            console.log(`🔍   Structure Length: ${requestedRoleFormat.structure?.length || 0}`);
            console.log(`🔍   Example: "${requestedRoleFormat.example}"`);
            console.log(`🔍   Description: "${requestedRoleFormat.description}"`);
            console.log(`🔍   Complete Structure Array:`, requestedRoleFormat.structure);

            // Log each position in the structure
            if (requestedRoleFormat.structure) {
              requestedRoleFormat.structure.forEach((position: any, posIndex: number) => {
                const positionData: any = {
                  type: position.type,
                  position: position.position,
                  description: position.description,
                  range: position.range
                };

                // Only include yearType if it's defined and relevant
                if (position.yearType && position.type === 'year') {
                  positionData.yearType = position.yearType;
                }

                // Only include value if it's defined and relevant
                if (position.value && position.type === 'fixed') {
                  positionData.value = position.value;
                }

                console.log(`🔍     Position ${posIndex + 1}:`, positionData);
              });
            }
          } else {
            console.log(`🔍 ❌ No ${role} role format found in received data`);
          }

          console.log(`🔍 ===== END CLIENT FORMAT ${index + 1} =====`);
        });
      }

      return result;
    },
    enabled: !!institutionType && !!institutionId && !!departmentCode && !!role && enabled &&
      (institutionType === 'college' ? (role === UserRole.STUDENT ? !!year : true) : false), // Organizations don't use this hook
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch registration formats for non-student roles (no year filtering)
 * Used for employee, staff, contractor, guest, visitor roles
 */
export function useRegistrationFormatsNoYear(
  institutionType: string | null,
  institutionId: string | null,
  departmentCode: string | null,
  role: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['registration-formats-no-year', institutionType, institutionId, departmentCode, role],
    queryFn: async () => {
      if (!institutionType || !institutionId || !departmentCode || !role) {
        console.log(`🔍 useRegistrationFormatsNoYear - Missing required parameters:`, {
          institutionType,
          institutionId,
          departmentCode,
          role
        });
        return null;
      }

      // Build URL for no-year endpoint
      const url = `/api/system-settings/registration-formats/no-year?institutionType=${encodeURIComponent(institutionType)}&institutionId=${encodeURIComponent(institutionId)}&departmentCode=${encodeURIComponent(departmentCode)}&role=${encodeURIComponent(role)}`;

      console.log(`🔍 ===== API REQUEST DETAILS =====`);
      console.log(`🔍 useRegistrationFormatsNoYear - Institution Type:`, institutionType);
      console.log(`🔍 useRegistrationFormatsNoYear - Institution ID:`, institutionId);
      console.log(`🔍 useRegistrationFormatsNoYear - Department Code:`, departmentCode);
      console.log(`🔍 useRegistrationFormatsNoYear - Role:`, role);
      console.log(`🔍 useRegistrationFormatsNoYear - Full URL:`, url);
      console.log(`🔍 ===== END API REQUEST =====`);

      const result = await apiRequest(url);

      console.log(`🔍 ===== API RESPONSE DETAILS =====`);
      console.log(`🔍 useRegistrationFormatsNoYear - Response Success:`, result?.success);
      console.log(`🔍 useRegistrationFormatsNoYear - Institution Type:`, result?.institutionType);
      console.log(`🔍 useRegistrationFormatsNoYear - Institution ID:`, result?.institutionId);
      console.log(`🔍 useRegistrationFormatsNoYear - Department Code:`, result?.departmentCode);
      console.log(`🔍 useRegistrationFormatsNoYear - Role:`, result?.role);
      console.log(`🔍 useRegistrationFormatsNoYear - Total Formats Found:`, result?.totalFormatsFound);
      console.log(`🔍 useRegistrationFormatsNoYear - Filtered Formats Count:`, result?.filteredFormatsCount);
      console.log(`🔍 useRegistrationFormatsNoYear - Filtering Criteria:`, result?.filteringCriteria);
      console.log(`🔍 useRegistrationFormatsNoYear - Formats Array Length:`, result?.formats?.length || 0);

      // Log each format in detail
      if (result?.formats) {
        result.formats.forEach((format: any, index: number) => {
          console.log(`🔍 Format ${index + 1}: "${format.name}" (Year: ${format.year})`);

          // Only log the requested role format
          const requestedRoleFormat = format.formats?.[role];
          if (requestedRoleFormat) {
            console.log(`🔍   - ${role} format:`, {
              totalLength: requestedRoleFormat.totalLength,
              structureLength: requestedRoleFormat.structure?.length || 0,
              example: requestedRoleFormat.example,
              description: requestedRoleFormat.description
            });
          }
        });
      }

      console.log(`🔍 ===== END API RESPONSE =====`);

      return result;
    },
    enabled: !!institutionType && !!institutionId && !!departmentCode && !!role && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
