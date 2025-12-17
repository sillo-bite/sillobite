/**
 * Utility functions for user management and academic calculations
 */

// Generate unique 12-digit order number
export function generateOrderNumber(): string {
  // Use 8 random digits + 4 timestamp-based digits for uniqueness
  const randomPart = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const timestampPart = Date.now().toString().slice(-4);
  return randomPart + timestampPart;
}

// Calculate current study year based on joining year and passing out year
export function calculateCurrentStudyYear(joiningYear: number, passingOutYear: number): number {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
  
  // Academic year runs from June to next June
  let academicYear = currentYear;
  if (currentMonth >= 6) {
    // If current month is June or later, we're in the academic year starting this year
    academicYear = currentYear;
  } else {
    // If current month is before June, we're still in the academic year that started last year
    academicYear = currentYear - 1;
  }
  
  // Calculate study year based on academic year and joining year
  const studyYear = academicYear - joiningYear + 1;
  
  // Ensure study year is within valid range
  return Math.max(1, Math.min(studyYear, passingOutYear - joiningYear + 1));
}

// Check if student has passed out
export function isStudentPassed(joiningYear: number, passingOutYear: number): boolean {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // Academic year runs from June to next June
  let academicYear = currentYear;
  if (currentMonth >= 6) {
    academicYear = currentYear;
  } else {
    academicYear = currentYear - 1;
  }
  
  return academicYear > passingOutYear;
}

// Legacy function - now deprecated. Use dynamic format validation instead.
// This function is kept for backward compatibility but should not be used for new validations.
export function validateRegisterNumber(registerNumber: string): {
  isValid: boolean;
  joiningYear?: number;
  department?: string;
  rollNumber?: string;
  error?: string;
} {
  // Return invalid to force use of dynamic validation
  return {
    isValid: false,
    error: "Please use dynamic format validation based on department and year"
  };
}

// Validate staff ID format
export function validateStaffId(staffId: string): { isValid: boolean; error?: string } {
  // New format: 3 characters (letters) + 3 numbers
  const regex = /^[A-Za-z_]{3}\d{3}$/;
  
  if (!regex.test(staffId)) {
    return {
      isValid: false,
      error: "Staff ID must be 3 letters followed by 3 numbers (e.g., ABC123). If you have only 2 letters, add '_' at the beginning (e.g., _AB123). If you have only 2 numbers, add '0' at the beginning (e.g., ABC012)."
    };
  }
  
  return { isValid: true };
}

// Note: DEPARTMENTS constant has been moved to dynamic database storage
// Use the useDepartments hook in React components to fetch current departments

// Get department full name - now returns the code since departments are managed dynamically
// For full names, use the useDepartments hook in React components
export function getDepartmentFullName(code: string): string {
  return code.toUpperCase();
}

// Get study year display text
export function getStudyYearDisplay(studyYear: number): string {
  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th'];
  return ordinals[studyYear] || `${studyYear}th`;
}

// Format order ID display with highlighted last 4 digits for visual identification
export function formatOrderIdDisplay(orderId: string): { 
  prefix: string; 
  highlighted: string; 
  full: string;
} {
  if (!orderId || orderId.length < 4) {
    return { prefix: orderId || '', highlighted: '', full: orderId || '' };
  }
  
  const prefix = orderId.slice(0, -4);
  const highlighted = orderId.slice(-4);
  
  return {
    prefix,
    highlighted,
    full: orderId
  };
}