import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, Trash2, Hash, Type, HelpCircle, Eye, Save, BarChart3, Settings, AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, X, Calendar, Lock
} from "lucide-react";

interface PositionStructure {
  position: number;
  type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
  value?: string;
  description?: string;
  range?: {
    min: number;
    max: number;
    positions: number[]; // Array of positions this range occupies
  };
  yearType?: 'starting' | 'passing_out'; // For year type
}


interface SpecialCharacter {
  character: string;
  positions: number[];
  description?: string;
}

interface UserTypeFormat {
  totalLength: number;
  structure: PositionStructure[];
  specialCharacters: SpecialCharacter[];
  example?: string;
  description?: string;
}

interface RegistrationFormat {
  id?: string;
  name: string;
  year: number;
  formats: {
    student: UserTypeFormat;
    staff: UserTypeFormat;
    employee: UserTypeFormat;
    guest: UserTypeFormat;
  };
}

interface RegistrationFormatBuilderProps {
  year: number;
  departmentCode: string;
  studyDuration?: number;
  onSave: (format: RegistrationFormat) => void;
  onCancel: () => void;
  initialFormat?: RegistrationFormat;
  isEditing?: boolean; // Add explicit edit mode prop
  existingFormats?: RegistrationFormat[]; // Add existing formats for duplicate checking
}

export default function RegistrationFormatBuilder({
  year,
  departmentCode,
  studyDuration = 4,
  onSave,
  onCancel,
  initialFormat,
  isEditing = false,
  existingFormats = []
}: RegistrationFormatBuilderProps) {
  // Determine if we're in edit mode (use explicit prop or detect from format data)
  // Use explicit isEditing prop if provided, otherwise detect from format data
  const isEditMode = isEditing || !!(initialFormat?.id && initialFormat?.name);
  
  // Generate default name for create mode only
  const generateDefaultName = () => {
    const yearText = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`;
    return `${departmentCode} ${yearText} Standard Format`;
  };
  
  // Initialize format name: use existing name for edit mode, generate default for create mode
  const [formatName, setFormatName] = useState(() => {
    if (isEditMode && initialFormat?.name) {
      return initialFormat.name;
    }
    return generateDefaultName();
  });
  
  
  // Migration function to handle existing formats with old yearFormat field
  const migrateFormatStructure = (formats: RegistrationFormat['formats']): RegistrationFormat['formats'] => {
    const migrateStructure = (structure: any[]) => {
      return structure.map(position => {
        if (position.type === 'year' && 'yearFormat' in position) {
          // Remove the old yearFormat field - format is now determined by position count
          const { yearFormat, ...cleanPosition } = position;
          return cleanPosition;
        }
        return position;
      });
    };

    return {
      student: {
        ...formats.student,
        structure: migrateStructure(formats.student.structure)
      },
      staff: {
        ...formats.staff,
        structure: migrateStructure(formats.staff.structure)
      },
      employee: {
        ...formats.employee,
        structure: migrateStructure(formats.employee.structure)
      },
      guest: {
        ...formats.guest,
        structure: migrateStructure(formats.guest.structure)
      }
    };
  };

  const getYearPlaceholder = (yearType: 'starting' | 'passing_out' | undefined, positionsLength?: number) => {
    // Return placeholder text instead of fixed year values
    if (positionsLength === 2) {
      return yearType === 'starting' ? 'YY' : 'YY'; // 2-digit placeholder
    } else {
      return yearType === 'starting' ? 'YYYY' : 'YYYY'; // 4-digit placeholder
    }
  };

  const getNumbersRangeDisplay = (range: { min: number; max: number } | undefined, positionsLength?: number) => {
    if (!range) return '00-99';
    
    // Use the number of merged positions to determine padding length
    const paddingLength = positionsLength || Math.max(String(range.min).length, String(range.max).length);
    
    const paddedMin = String(range.min).padStart(paddingLength, '0');
    const paddedMax = String(range.max).padStart(paddingLength, '0');
    
    return `${paddedMin}-${paddedMax}`;
  };
  const [activeTab, setActiveTab] = useState("student");
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [isDragging, setIsDragging] = useState(false);
  
  // Validate current tab when it changes
  React.useEffect(() => {
    validateFormat(activeTab as keyof RegistrationFormat['formats']);
  }, [activeTab]);
  
  
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [positionPopup, setPositionPopup] = useState<{
    isOpen: boolean;
    userType: keyof RegistrationFormat['formats'];
    position: number;
    existingPosition?: PositionStructure;
  }>({
    isOpen: false,
    userType: 'student',
    position: 1
  });
  
  const [formats, setFormats] = useState<RegistrationFormat['formats']>(() => {
    if (initialFormat?.formats) {
      // Migrate existing format to remove old yearFormat fields
      return migrateFormatStructure(initialFormat.formats);
    }
    return {
       student: {
         totalLength: 10,
         structure: [
           { 
             position: 1, 
             type: 'fixed', 
             value: 'INST', 
             description: 'Institution prefix',
             range: { min: 0, max: 0, positions: [1, 2, 3] }
           },
           { 
             position: 4, 
             type: 'digit', 
             description: 'Year digits',
             range: { min: 0, max: 0, positions: [4, 5] }
           },
           { 
             position: 6, 
             type: 'alphabet', 
             description: 'Department code',
             range: { min: 0, max: 0, positions: [6, 7, 8] }
           },
           { 
             position: 9, 
             type: 'numbers_range', 
             description: 'Serial number range',
             range: { min: 1, max: 99, positions: [9, 10] }
           }
         ],
         specialCharacters: [],
         example: 'INST24CSE01',
         description: 'Student registration number format'
       },
       staff: {
         totalLength: 12,
         structure: [
           { 
             position: 1, 
             type: 'fixed', 
             value: 'INST', 
             description: 'Institution prefix',
             range: { min: 0, max: 0, positions: [1, 2, 3] }
           },
           { 
             position: 4, 
             type: 'alphabet', 
             description: 'Department code',
             range: { min: 0, max: 0, positions: [4, 5, 6] }
           },
           { 
             position: 7, 
             type: 'fixed', 
             value: 'STA', 
             description: 'Staff identifier',
             range: { min: 0, max: 0, positions: [7, 8, 9] }
           },
           { 
             position: 10, 
             type: 'fixed', 
             value: 'FF', 
             description: 'Staff suffix',
             range: { min: 0, max: 0, positions: [10, 11] }
           },
           { 
             position: 12, 
             type: 'numbers_range', 
             description: 'Serial number range',
             range: { min: 1, max: 999, positions: [12] }
           }
         ],
         specialCharacters: [],
         example: 'INSTCSESTAFF001',
         description: 'Staff registration number format'
       },
       employee: {
         totalLength: 12,
         structure: [
           { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
           { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
           { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
           { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
           { position: 4, type: 'alphabet', description: 'Department code - first letter' },
           { position: 5, type: 'alphabet', description: 'Department code - second letter' },
           { position: 6, type: 'alphabet', description: 'Department code - third letter' },
           { position: 7, type: 'fixed', value: 'E', description: 'Employee identifier - E' },
           { position: 8, type: 'fixed', value: 'M', description: 'Employee identifier - M' },
           { position: 9, type: 'fixed', value: 'P', description: 'Employee identifier - P' },
           { 
             position: 10, 
             type: 'numbers_range', 
             description: 'Serial number range',
             range: { min: 1, max: 999, positions: [10, 11, 12] }
           }
         ],
         specialCharacters: [],
         example: 'INSTCSEEMP001',
         description: 'Employee registration number format'
       },
       guest: {
         totalLength: 8,
         structure: [
           { position: 1, type: 'fixed', value: 'I', description: 'Institution prefix - I' },
           { position: 2, type: 'fixed', value: 'N', description: 'Institution prefix - N' },
           { position: 3, type: 'fixed', value: 'S', description: 'Institution prefix - S' },
           { position: 4, type: 'fixed', value: 'T', description: 'Institution prefix - T' },
           { position: 4, type: 'fixed', value: 'G', description: 'Guest identifier - G' },
           { position: 5, type: 'fixed', value: 'S', description: 'Guest identifier - S' },
           { position: 6, type: 'fixed', value: 'T', description: 'Guest identifier - T' },
           { 
             position: 7, 
             type: 'numbers_range', 
             description: 'Serial number range',
             range: { min: 1, max: 99, positions: [7, 8] }
           }
         ],
         specialCharacters: [],
         example: 'INSTGST01',
         description: 'Guest registration number format'
       }
    };
  });

  const updateUserTypeFormat = (userType: keyof RegistrationFormat['formats'], updates: Partial<UserTypeFormat>) => {
    setFormats(prev => ({
      ...prev,
      [userType]: { ...prev[userType], ...updates }
    }));
    
    // Clear validation errors when user makes changes
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      // Remove errors for this user type
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`${userType}_`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  const validatePosition = (userType: keyof RegistrationFormat['formats'], position: PositionStructure, index: number): string | null => {
    const errorKey = `${userType}_position_${index}`;
    
    // Check for duplicate positions
    const currentFormat = formats[userType];
    const duplicatePositions = currentFormat.structure.filter(p => p.position === position.position && p !== position);
    if (duplicatePositions.length > 0) {
      return `Position ${position.position} is already used`;
    }
    
    // Check position bounds
    if (position.position < 1 || position.position > currentFormat.totalLength) {
      return `Position must be between 1 and ${currentFormat.totalLength}`;
    }
    
    // Validate fixed value
    if (position.type === 'fixed') {
      if (!position.value || position.value.length === 0) {
        return 'Fixed value is required';
      }
      // For merged cells, allow multiple characters based on range positions
      const expectedLength = position.range?.positions?.length || 1;
      if (position.value.length !== expectedLength) {
        return `Fixed value must be ${expectedLength} character${expectedLength > 1 ? 's' : ''} for merged cell`;
      }
    }
    
    // Validate numbers range
    if (position.type === 'numbers_range') {
      if (!position.range) {
        return 'Range configuration is required';
      }
      if (position.range.min < 0) {
        return 'Minimum value must be 0 or greater';
      }
      if (position.range.max <= position.range.min) {
        return 'Maximum value must be greater than minimum';
      }
      if (!position.range.positions || position.range.positions.length === 0) {
        return 'Range positions are required';
      }
      
      // Check if range positions are valid
      const invalidPositions = position.range.positions.filter(pos => 
        pos < 1 || pos > currentFormat.totalLength
      );
      if (invalidPositions.length > 0) {
        return `Invalid range positions: ${invalidPositions.join(', ')}`;
      }
      
      // Check for overlapping ranges
      const overlappingRanges = currentFormat.structure.filter(p => 
        p.type === 'numbers_range' && 
        p !== position &&
        p.range?.positions?.some(pos => position.range?.positions?.includes(pos))
      );
      if (overlappingRanges.length > 0) {
        return 'Range positions overlap with existing range';
      }
    }
    
    return null;
  };

  const validateFormat = (userType: keyof RegistrationFormat['formats']): boolean => {
    const currentFormat = formats[userType];
    const errors: {[key: string]: string} = {};
    
    // Check total length
    if (currentFormat.totalLength < 1 || currentFormat.totalLength > 20) {
      errors[`${userType}_totalLength`] = 'Total length must be between 1 and 20';
    }
    
    // Validate all positions
    currentFormat.structure.forEach((position, index) => {
      const error = validatePosition(userType, position, index);
      if (error) {
        errors[`${userType}_position_${index}`] = error;
      }
    });
    
    // Check for gaps in positions (accounting for merged ranges)
    const usedPositions = new Set<number>();
    
    currentFormat.structure.forEach(p => {
      if (p.range?.positions && p.range.positions.length > 0) {
        // For any merged position (all types), add all positions in the range
        p.range.positions.forEach(pos => usedPositions.add(pos));
      } else {
        // For individual positions, add just the position
        usedPositions.add(p.position);
      }
    });
    
    const expectedPositions = Array.from({ length: currentFormat.totalLength }, (_, i) => i + 1);
    const missingPositions = expectedPositions.filter(pos => !usedPositions.has(pos));
    
    if (missingPositions.length > 0) {
      errors[`${userType}_gaps`] = `Missing positions: ${missingPositions.join(', ')}`;
    }
    
    // Update validation errors state
    setValidationErrors(prev => ({
      ...prev,
      ...errors
    }));
    
    return Object.keys(errors).length === 0;
  };

  const addPosition = (userType: keyof RegistrationFormat['formats']) => {
    const currentFormat = formats[userType];
    const newPosition = currentFormat.structure.length + 1;
    
    updateUserTypeFormat(userType, {
      structure: [
        ...currentFormat.structure,
        { position: newPosition, type: 'digit', description: '' }
      ]
    });
  };

  const removePosition = (userType: keyof RegistrationFormat['formats'], positionIndex: number) => {
    const currentFormat = formats[userType];
    const newStructure = currentFormat.structure.filter((_, index) => index !== positionIndex);
    
    // Reorder positions
    const reorderedStructure = newStructure.map((item, index) => ({
      ...item,
      position: index + 1
    }));
    
    updateUserTypeFormat(userType, {
      structure: reorderedStructure
    });
  };

  const updatePosition = (userType: keyof RegistrationFormat['formats'], positionIndex: number, updates: Partial<PositionStructure>) => {
    const currentFormat = formats[userType];
    const newStructure = [...currentFormat.structure];
    const currentPosition = newStructure[positionIndex];
    
    // If changing to numbers_range, auto-populate positions based on remaining positions
    if (updates.type === 'numbers_range' && !currentPosition.range) {
      const remainingPositions = [];
      for (let i = currentPosition.position; i <= currentFormat.totalLength; i++) {
        const existingPosition = newStructure.find(p => p.position === i && p.type !== 'numbers_range');
        if (!existingPosition) {
          remainingPositions.push(i);
        }
      }
      updates.range = {
        min: 1,
        max: Math.pow(10, remainingPositions.length) - 1,
        positions: remainingPositions // Auto-calculated positions
      };
    }
    
    newStructure[positionIndex] = { ...currentPosition, ...updates };
    
    updateUserTypeFormat(userType, {
      structure: newStructure
    });
  };

  const addSpecialCharacter = (userType: keyof RegistrationFormat['formats']) => {
    const currentFormat = formats[userType];
    updateUserTypeFormat(userType, {
      specialCharacters: [
        ...currentFormat.specialCharacters,
        { character: '', positions: [], description: '' }
      ]
    });
  };

  const removeSpecialCharacter = (userType: keyof RegistrationFormat['formats'], index: number) => {
    const currentFormat = formats[userType];
    const newSpecialChars = currentFormat.specialCharacters.filter((_, i) => i !== index);
    updateUserTypeFormat(userType, {
      specialCharacters: newSpecialChars
    });
  };

  const updateSpecialCharacter = (userType: keyof RegistrationFormat['formats'], index: number, updates: Partial<SpecialCharacter>) => {
    const currentFormat = formats[userType];
    const newSpecialChars = [...currentFormat.specialCharacters];
    newSpecialChars[index] = { ...newSpecialChars[index], ...updates };
    updateUserTypeFormat(userType, {
      specialCharacters: newSpecialChars
    });
  };

  const generateExample = (userType: keyof RegistrationFormat['formats']): string => {
    const format = formats[userType];
    let example = '';
    
    for (let i = 1; i <= format.totalLength; i++) {
      // First check if this position is part of any range (merged positions)
      const rangePosition = format.structure.find(p => 
        p.range?.positions?.includes(i)
      );
      
      if (rangePosition?.range) {
        // Handle merged positions based on type
        const currentPosInRange = rangePosition.range.positions.indexOf(i);
        
        if (rangePosition.type === 'numbers_range') {
          // For numbers range, show padded min value
          const paddingLength = rangePosition.range.positions.length;
          const minStr = rangePosition.range.min.toString().padStart(paddingLength, '0');
          example += minStr[currentPosInRange] || '0';
        } else if (rangePosition.type === 'year') {
          // For year, show the calculated year value
          const yearValue = getYearPlaceholder(rangePosition.yearType, rangePosition.range.positions.length);
          example += yearValue[currentPosInRange] || '0';
        } else if (rangePosition.type === 'fixed') {
          // For fixed, show the fixed value
          const fixedValue = rangePosition.value || 'X'.repeat(rangePosition.range.positions.length);
          example += fixedValue[currentPosInRange] || 'X';
        } else if (rangePosition.type === 'digit') {
          // For digit, show '0'
          example += '0';
        } else if (rangePosition.type === 'alphabet') {
          // For alphabet, show 'A'
          example += 'A';
        } else if (rangePosition.type === 'alphanumeric') {
          // For alphanumeric, alternate between 'A' and '0'
          example += currentPosInRange % 2 === 0 ? 'A' : '0';
        } else {
          example += 'X';
        }
      } else {
        // Handle individual positions (not part of any range)
        const position = format.structure.find(p => p.position === i);
        
        if (position) {
          switch (position.type) {
            case 'fixed':
              example += position.value || 'X';
              break;
            case 'digit':
              example += '0';
              break;
            case 'alphabet':
              example += 'A';
              break;
            case 'alphanumeric':
              example += 'A';
              break;
            case 'numbers_range':
              // This should not happen as ranges are handled above
              example += '0';
              break;
            default:
              example += 'X';
          }
        } else {
          example += 'X';
        }
      }
    }
    
    return example;
  };

  const handlePositionClick = (position: number, userType: keyof RegistrationFormat['formats']) => {
    if (isMerging) {
      // Check if this position is part of any existing merged range
      const rangePosition = formats[userType].structure.find(p => 
        p.range?.positions?.includes(position)
      );
      
      if (rangePosition && rangePosition.range?.positions) {
        // If clicking on a range, select/deselect all positions in that range
        const rangePositions = rangePosition.range.positions;
        const hasAllRangePositions = rangePositions.every(pos => selectedPositions.includes(pos));
        
        setSelectedPositions(prev => {
          if (hasAllRangePositions) {
            // Remove all range positions
            return prev.filter(p => !rangePositions.includes(p));
          } else {
            // Add all range positions
            return [...prev, ...rangePositions].sort((a, b) => a - b);
          }
        });
      } else {
        // Normal single position selection
        setSelectedPositions(prev => {
          if (prev.includes(position)) {
            return prev.filter(p => p !== position);
          } else {
            return [...prev, position].sort((a, b) => a - b);
          }
        });
      }
    } else {
      // Open position configuration popup
      const existingPosition = formats[userType].structure.find(p => p.position === position);
      
      // Check if this position is part of any existing merged range
      const rangePosition = formats[userType].structure.find(p => 
        p.range?.positions?.includes(position)
      );
      
      setPositionPopup({
        isOpen: true,
        userType,
        position,
        existingPosition: existingPosition || rangePosition
      });
    }
  };

  // Simple canvas-based drag selection
  const handleGridMouseDown = (event: React.MouseEvent, userType: keyof RegistrationFormat['formats']) => {
    if (!isMerging) return;
    
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cellWidth = rect.width / formats[userType].totalLength;
    const position = Math.min(Math.max(1, Math.ceil(x / cellWidth)), formats[userType].totalLength);
    
    // Check if this position is part of an existing range
    const rangePosition = formats[userType].structure.find(p => 
      p.type === 'numbers_range' && 
      p.range?.positions?.includes(position)
    );
    
    setIsSelecting(true);
    setDragStart(position);
    setDragEnd(position);
    
    if (rangePosition && rangePosition.range?.positions) {
      // If clicking on a range, start with all positions in that range
      setSelectedPositions(rangePosition.range.positions);
    } else {
      // Normal single position selection
      setSelectedPositions([position]);
    }
  };

  const handleGridMouseMove = (event: React.MouseEvent, userType: keyof RegistrationFormat['formats']) => {
    if (!isSelecting || !isMerging) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cellWidth = rect.width / formats[userType].totalLength;
    const position = Math.min(Math.max(1, Math.ceil(x / cellWidth)), formats[userType].totalLength);
    
    if (position !== dragEnd) {
      setDragEnd(position);
      
      // Calculate range from start to current position
      const start = Math.min(dragStart!, position);
      const end = Math.max(dragStart!, position);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedPositions(range);
    }
  };

  const handleGridMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      setDragStart(null);
      setDragEnd(null);
    }
  };

  // Global mouse up handler
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        setDragStart(null);
        setDragEnd(null);
      }
    };

    if (isSelecting) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelecting]);

  const handleMergePositions = (userType: keyof RegistrationFormat['formats'], mergeType: 'numbers_range' | 'fixed_text' | 'digit' | 'alphabet' | 'alphanumeric' | 'year') => {
    if (selectedPositions.length < 2) return;
    
    const currentFormat = formats[userType];
    const newStructure = [...currentFormat.structure];
    
    // Remove existing positions that are being merged (including any existing ranges)
    const filteredStructure = newStructure.filter(p => {
      // Remove individual positions that match selected positions
      if (selectedPositions.includes(p.position)) {
        return false;
      }
      // Remove ranges that overlap with selected positions
      if (p.type === 'numbers_range' && p.range?.positions?.some(pos => selectedPositions.includes(pos))) {
        return false;
      }
      return true;
    });
    
    if (mergeType === 'numbers_range') {
      // Add new merged range with auto-calculated positions
      const mergedRange = {
        position: selectedPositions[0],
        type: 'numbers_range' as const,
        description: 'Merged range',
        range: {
          min: 1,
          max: Math.pow(10, selectedPositions.length) - 1,
          positions: selectedPositions // Auto-calculated from selected positions
        }
      };
      
      filteredStructure.push(mergedRange);
    } else if (mergeType === 'fixed_text') {
      // Create a single merged fixed text position
      const fixedValue = selectedPositions.map((pos, index) => {
        const existingPos = newStructure.find(p => p.position === pos);
        return existingPos?.value || 'X';
      }).join('');
      
      filteredStructure.push({
        position: selectedPositions[0],
        type: 'fixed' as const,
        value: fixedValue,
        description: 'Merged fixed text',
        range: {
          min: 0,
          max: 0,
          positions: selectedPositions // Store the merged positions
        }
      });
    } else if (mergeType === 'year') {
      // Add year position with validation for 2 or 4 cells only
      if (selectedPositions.length !== 2 && selectedPositions.length !== 4) {
        alert('Year type can only be merged with 2 or 4 cells');
        return;
      }
      
      filteredStructure.push({
        position: selectedPositions[0],
        type: 'year' as const,
        description: `Year position (${selectedPositions.length === 2 ? '2-digit' : '4-digit'})`,
        yearType: 'starting',
        range: {
          min: 0,
          max: 0,
          positions: selectedPositions // Set the range positions for year type
        }
      });
    } else {
      // Create a single merged position for digit, alphabet, or alphanumeric types
      filteredStructure.push({
        position: selectedPositions[0],
        type: mergeType as 'digit' | 'alphabet' | 'alphanumeric',
        description: `Merged ${mergeType} positions`,
        range: {
          min: 0,
          max: 0,
          positions: selectedPositions // Store the merged positions
        }
      });
    }
    
    filteredStructure.sort((a, b) => a.position - b.position);
    
    updateUserTypeFormat(userType, {
      structure: filteredStructure
    });
    
    setSelectedPositions([]);
    setIsMerging(false);
  };

  // Helper function to check if selected positions contain merged cells
  const hasMergedPositions = (userType: keyof RegistrationFormat['formats']) => {
    const currentFormat = formats[userType];
    
    // Check if any selected position is part of any merged range
    return selectedPositions.some(pos => {
      return currentFormat.structure.some(p => 
        p.range?.positions?.includes(pos)
      );
    });
  };

  // Helper function to check if selected positions are all individual (not merged)
  const hasOnlyIndividualPositions = (userType: keyof RegistrationFormat['formats']) => {
    const currentFormat = formats[userType];
    
    // Check if all selected positions are individual (not part of any range)
    return selectedPositions.every(pos => {
      return !currentFormat.structure.some(p => 
        p.range?.positions?.includes(pos)
      );
    });
  };

  const handleUnmergePositions = (userType: keyof RegistrationFormat['formats']) => {
    if (selectedPositions.length === 0) return;
    
    const currentFormat = formats[userType];
    const newStructure = [...currentFormat.structure];
    
    // Find and unmerge selected positions
    const filteredStructure = newStructure.filter(p => {
      // Check if this position is part of any merged range that includes selected positions
      if (p.range?.positions) {
        const hasSelectedPositions = p.range.positions.some(pos => selectedPositions.includes(pos));
        if (hasSelectedPositions) {
          // For numbers_range, we can partially unmerge
          if (p.type === 'numbers_range') {
            const remainingPositions = p.range.positions.filter(pos => !selectedPositions.includes(pos));
            if (remainingPositions.length > 0) {
              // Keep the range but remove selected positions
              p.range.positions = remainingPositions;
              p.range.max = Math.pow(10, remainingPositions.length) - 1;
              return true;
            } else {
              // Remove the entire range
              return false;
            }
          } else {
            // For all other types (year, fixed, digit, alphabet, alphanumeric), remove the entire merged position
            return false;
          }
        }
      }
      
      // Remove individual positions that are selected
      if (selectedPositions.includes(p.position)) {
        return false;
      }
      
      return true;
    });
    
    // Add individual positions for the selected positions
    selectedPositions.forEach(pos => {
      filteredStructure.push({
        position: pos,
        type: 'digit' as const,
        description: 'Unmerged position'
      });
    });
    
    filteredStructure.sort((a, b) => a.position - b.position);
    
    updateUserTypeFormat(userType, {
      structure: filteredStructure
    });
    
    setSelectedPositions([]);
    setIsMerging(false);
  };

  const handlePositionSave = (positionData: PositionStructure) => {
    const { userType, position } = positionPopup;
    const currentFormat = formats[userType];
    const newStructure = [...currentFormat.structure];
    
    // Remove existing position if it exists
    const existingIndex = newStructure.findIndex(p => p.position === position);
    if (existingIndex !== -1) {
      newStructure.splice(existingIndex, 1);
    }
    
    // Add new position
    newStructure.push(positionData);
    
    updateUserTypeFormat(userType, {
      structure: newStructure
    });
    
    setPositionPopup({ isOpen: false, userType: 'student', position: 1 });
  };

  const handlePositionDelete = () => {
    const { userType, position } = positionPopup;
    const currentFormat = formats[userType];
    const newStructure = currentFormat.structure.filter(p => p.position !== position);
    
    updateUserTypeFormat(userType, {
      structure: newStructure
    });
    
    setPositionPopup({ isOpen: false, userType: 'student', position: 1 });
  };

  const handleSave = () => {
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate format name (only for create mode)
    if (!isEditMode && (!formatName || !formatName.trim())) {
      alert('Please enter a name for the registration format. This field is required and cannot be empty.');
      return;
    }
    
    // For edit mode, ensure we have a name (should already exist)
    if (isEditMode && (!formatName || !formatName.trim())) {
      alert('Error: This format appears to be missing a name. Please contact support.');
      return;
    }
    
    // Check for duplicate names (only for create mode or when name is changed in edit mode)
    if (!isEditMode || (isEditMode && formatName.trim() !== initialFormat?.name)) {
      const trimmedName = formatName.trim();
      const duplicateFormat = existingFormats.find(format => 
        format.name && format.name.toLowerCase().trim() === trimmedName.toLowerCase() &&
        (!isEditMode || format.id !== initialFormat?.id) // Exclude current format when editing
      );
      
      if (duplicateFormat) {
        alert(`A registration format with the name "${trimmedName}" already exists for year ${duplicateFormat.year} in this department. Please choose a different name.`);
        return;
      }
    }
    
    // Validate all formats before saving
    const userTypes = ['student', 'staff', 'employee', 'guest'] as const;
    let hasErrors = false;
    
    userTypes.forEach(userType => {
      if (!validateFormat(userType)) {
        hasErrors = true;
      }
    });
    
    if (hasErrors) {
      // Don't save if there are validation errors
      alert('Please fix validation errors before saving. Check the format configuration for issues.');
      return;
    }
    
    // Ensure any remaining old yearFormat fields are cleaned up before saving
    const cleanedFormats = migrateFormatStructure(formats);
    
    const registrationFormat: RegistrationFormat = {
      id: initialFormat?.id,
      name: formatName.trim(),
      year,
      formats: cleanedFormats
    };
    onSave(registrationFormat);
  };

  const userTypes = [
    { key: 'student', label: 'Student', icon: '🎓' },
    { key: 'staff', label: 'Staff', icon: '👨‍🏫' },
    { key: 'employee', label: 'Employee', icon: '👷' },
    { key: 'guest', label: 'Guest', icon: '👤' }
  ] as const;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Registration Format Builder
            {isEditMode && <span className="text-sm font-normal text-muted-foreground ml-2">(Edit Mode)</span>}
          </h2>
          <p className="text-muted-foreground">
            {isEditMode 
              ? `Editing registration format for ${departmentCode} - ${year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`}`
              : `Configure detailed registration number formats for ${departmentCode} - ${year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year`}`
            }
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Year format: Dynamic</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            {isEditMode ? 'Update Format' : 'Create Format'}
          </Button>
        </div>
      </div>

      {/* Format Name Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Format Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="format-name" className="flex items-center gap-2">
              Format Name *
              {isEditMode && initialFormat?.name && <Lock className="w-3 h-3 text-muted-foreground" />}
            </Label>
            <Input
              id="format-name"
              value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              placeholder={isEditMode && initialFormat?.name ? "Format name cannot be changed" : "Enter a descriptive name for this format (e.g., 'Standard Format', 'Special Program Format')"}
              className={`w-full ${isEditMode && initialFormat?.name ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
              disabled={isEditMode && initialFormat?.name}
              readOnly={isEditMode && initialFormat?.name}
            />
            <p className="text-xs text-muted-foreground">
              {isEditMode && initialFormat?.name
                ? "Format name cannot be changed once created. This ensures consistency and prevents conflicts."
                : `A default name has been provided, but you can customize it. Choose a unique name to identify this registration format for year ${year}. This name cannot be changed later.`
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors Display - Only show errors for current tab */}
      {(() => {
        const currentTabErrors = Object.entries(validationErrors).filter(([key]) => 
          key.startsWith(`${activeTab}_`)
        );
        return currentTabErrors.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Validation Errors
              </h3>
            </div>
            <div className="space-y-1">
              {currentTabErrors.map(([key, error]) => (
                <p key={key} className="text-sm text-red-700 dark:text-red-300">
                  • {error}
                </p>
              ))}
            </div>
          </div>
        );
      })()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {userTypes.map(({ key, label, icon }) => (
            <TabsTrigger key={key} value={key} className="flex items-center space-x-2">
              <span>{icon}</span>
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {userTypes.map(({ key }) => {
          const format = formats[key];
          
          return (
            <TabsContent key={key} value={key} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{userTypes.find(t => t.key === key)?.icon}</span>
                    <span>{userTypes.find(t => t.key === key)?.label} Format</span>
                    <Badge variant="outline">{format.totalLength} characters</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-totalLength`}>Total Length</Label>
                      <Input
                        id={`${key}-totalLength`}
                        type="number"
                        min="1"
                        max="20"
                        value={format.totalLength}
                        onChange={(e) => updateUserTypeFormat(key, { totalLength: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-description`}>Description</Label>
                      <Input
                        id={`${key}-description`}
                        value={format.description || ''}
                        onChange={(e) => updateUserTypeFormat(key, { description: e.target.value })}
                        placeholder="Brief description of this format"
                      />
                    </div>
                  </div>


                  {/* Position Structure */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Position Structure</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPosition(key)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Position
                      </Button>
                    </div>
                    
                    {/* Visual Position Boxes */}
                    <div className="space-y-4">
                      {/* Example boxes showing what each type looks like */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Type Examples:</Label>
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                            <div className="w-12 h-12 border-2 border-blue-500 rounded flex items-center justify-center text-sm font-mono">0</div>
                            <span className="text-xs">Digit</span>
                          </div>
                          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div className="w-12 h-12 border-2 border-green-500 rounded flex items-center justify-center text-sm font-mono">A</div>
                            <span className="text-xs">Alphabet</span>
                          </div>
                          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                            <div className="w-12 h-12 border-2 border-purple-500 rounded flex items-center justify-center text-sm font-mono">A</div>
                            <span className="text-xs">Alphanumeric</span>
                          </div>
                          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                            <div className="w-12 h-12 border-2 border-orange-500 rounded flex items-center justify-center text-sm font-mono">00</div>
                            <span className="text-xs">Numbers Range</span>
                          </div>
                          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-gray-50 dark:bg-gray-900/20">
                            <div className="w-12 h-12 border-2 border-gray-500 rounded flex items-center justify-center text-sm font-mono">K</div>
                            <span className="text-xs">Fixed</span>
                          </div>
                        </div>
                      </div>

                       {/* Current format visualization */}
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                           <Label className="text-sm font-medium">Current Format:</Label>
                           <Button
                             variant={isMerging ? "default" : "outline"}
                             size="sm"
                             onClick={() => {
                               setIsMerging(!isMerging);
                               setSelectedPositions([]);
                             }}
                           >
                             {isMerging ? 'Cancel Merge' : 'Merge Positions'}
                           </Button>
                         </div>
                         <div className="w-full p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                           <div 
                             className="grid gap-1 select-none pb-8" 
                             style={{ gridTemplateColumns: `repeat(${format.totalLength}, 1fr)` }}
                             onMouseDown={(e) => handleGridMouseDown(e, key)}
                             onMouseMove={(e) => handleGridMouseMove(e, key)}
                             onMouseUp={handleGridMouseUp}
                             onMouseLeave={handleGridMouseUp}
                           >
                             {Array.from({ length: format.totalLength }, (_, i) => {
                               const position = format.structure.find(p => p.position === i + 1);
                               
                               // Check if this position is part of any merged range (all types can be merged now)
                               const rangePosition = format.structure.find(p => 
                                 p.range?.positions?.includes(i + 1)
                               );
                               
                               const isRangePosition = !!rangePosition;
                               const rangeStart = rangePosition?.range?.positions?.[0] === i + 1;
                               const isSelected = selectedPositions.includes(i + 1);
                               
                               // Always render collapsed ranges (don't render subsequent range positions)
                               if (isRangePosition && !rangeStart) {
                                 return null;
                               }
                               
                               // Calculate grid span for range positions
                               // Always show collapsed ranges with their full span
                               const gridSpan = isRangePosition ? rangePosition.range.positions.length : 1;
                               
                               return (
                                 <div key={i} className="relative" style={{ gridColumn: `span ${gridSpan}` }}>
                                   <div 
                                     className={`
                                       h-16 w-full border-2 rounded flex flex-col items-center justify-center text-sm font-mono transition-all
                                       ${!position && !isRangePosition ? 'border-dashed border-gray-300 bg-gray-100 dark:bg-gray-700' : ''}
                                       ${position?.type === 'digit' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
                                       ${position?.type === 'alphabet' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                                       ${position?.type === 'alphanumeric' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''}
                                       ${isRangePosition && rangeStart ? (
                                         rangePosition.type === 'numbers_range' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                                         rangePosition.type === 'year' ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' :
                                         rangePosition.type === 'fixed' ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20' :
                                         rangePosition.type === 'digit' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                                         rangePosition.type === 'alphabet' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                                         rangePosition.type === 'alphanumeric' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' :
                                         'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                       ) : ''}
                                       ${position?.type === 'fixed' ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20' : ''}
                                       ${position?.type === 'year' ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' : ''}
                                       ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-100 dark:bg-blue-900/30' : ''}
                                       ${isMerging ? 'hover:ring-2 hover:ring-blue-300 cursor-crosshair' : 'cursor-pointer'}
                                       ${isSelecting && selectedPositions.includes(i + 1) ? 'bg-blue-200 dark:bg-blue-800/40' : ''}
                                     `}
                                     onClick={() => handlePositionClick(i + 1, key)}
                                   >
                                     <div className="text-center">
                                       <div className="text-lg font-bold">
                                         {!position && !isRangePosition ? '?' : 
                                          isRangePosition && rangeStart ? (
                                            rangePosition.type === 'numbers_range' ? getNumbersRangeDisplay(rangePosition.range, rangePosition.range?.positions?.length) :
                                            rangePosition.type === 'year' ? getYearPlaceholder(rangePosition.yearType, rangePosition.range?.positions?.length) :
                                            rangePosition.type === 'fixed' ? (rangePosition.value || 'X'.repeat(rangePosition.range?.positions?.length || 1)) :
                                            rangePosition.type === 'digit' ? '0'.repeat(rangePosition.range?.positions?.length || 1) :
                                            rangePosition.type === 'alphabet' ? 'A'.repeat(rangePosition.range?.positions?.length || 1) :
                                            rangePosition.type === 'alphanumeric' ? 'A0'.repeat(Math.ceil((rangePosition.range?.positions?.length || 1) / 2)) : 'XX'
                                          ) :
                                          position?.type === 'fixed' ? (position.value?.charAt(0) || 'X') :
                                          position?.type === 'digit' ? '0' :
                                          position?.type === 'alphabet' ? 'A' :
                                          position?.type === 'alphanumeric' ? 'A' :
                                          position?.type === 'year' ? getYearPlaceholder(position.yearType, position.range?.positions?.length) : 'X'}
                                       </div>
                                       <div className="text-xs text-muted-foreground mt-1">
                                         {isRangePosition && rangeStart
                                           ? `${rangePosition.range.positions[0]}-${rangePosition.range.positions[rangePosition.range.positions.length - 1]}`
                                           : i + 1
                                         }
                                       </div>
                                     </div>
                                   </div>
                                   {isSelected && (
                                     <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                       <span className="text-xs text-white font-bold">✓</span>
                                     </div>
                                   )}
                                   {/* Direct unmerge button for merged cells - only in merge mode */}
                                   {isMerging && isRangePosition && rangeStart && (
                                     <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 z-10">
                                       <Button
                                         variant="destructive"
                                         size="sm"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setSelectedPositions(rangePosition.range?.positions || []);
                                           handleUnmergePositions(key);
                                         }}
                                         className="h-6 px-2 text-xs bg-red-600 hover:bg-red-700 shadow-lg"
                                         title={`Unmerge positions ${rangePosition.range?.positions?.join(', ')}`}
                                       >
                                         <ArrowUpDown className="w-3 h-3 mr-1" />
                                         Unmerge
                                       </Button>
                                     </div>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                         
                         {/* Merge buttons - appear when individual positions are selected */}
                         {isMerging && selectedPositions.length >= 2 && hasOnlyIndividualPositions(key) && (
                           <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                             <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                               Selected individual positions: {selectedPositions.join(', ')}
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'numbers_range')}
                                 className="bg-orange-600 hover:bg-orange-700"
                               >
                                 <BarChart3 className="w-4 h-4 mr-1" />
                                 Numbers Range
                               </Button>
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'fixed_text')}
                                 className="bg-gray-600 hover:bg-gray-700"
                               >
                                 <HelpCircle className="w-4 h-4 mr-1" />
                                 Fixed Text
                               </Button>
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'digit')}
                                 className="bg-blue-600 hover:bg-blue-700"
                               >
                                 <Hash className="w-4 h-4 mr-1" />
                                 Digits
                               </Button>
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'alphabet')}
                                 className="bg-green-600 hover:bg-green-700"
                               >
                                 <Type className="w-4 h-4 mr-1" />
                                 Alphabets
                               </Button>
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'alphanumeric')}
                                 className="bg-purple-600 hover:bg-purple-700"
                               >
                                 <Hash className="w-4 h-4 mr-1" />
                                 Alphanumeric
                               </Button>
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'year')}
                                 className="bg-orange-600 hover:bg-orange-700 col-span-2"
                               >
                                 <Calendar className="w-4 h-4 mr-1" />
                                 Year (Auto: 2 or 4 digits)
                               </Button>
                             </div>
                           </div>
                         )}
                         
                         {/* Unmerge button - appears when merged positions are selected */}
                         {isMerging && selectedPositions.length > 0 && hasMergedPositions(key) && (
                           <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                             <div className="text-sm font-medium text-red-600 dark:text-red-400">
                               Selected merged positions: {selectedPositions.join(', ')}
                             </div>
                             <Button
                               variant="destructive"
                               size="sm"
                               onClick={() => handleUnmergePositions(key)}
                               className="bg-red-600 hover:bg-red-700"
                             >
                               <ArrowUpDown className="w-4 h-4 mr-1" />
                               Unmerge Positions
                             </Button>
                             <div className="text-xs text-red-600 dark:text-red-400">
                               This will convert merged positions back to individual digit positions
                             </div>
                           </div>
                         )}
                         
                         {/* Mixed selection - show both options */}
                         {isMerging && selectedPositions.length > 0 && !hasOnlyIndividualPositions(key) && !hasMergedPositions(key) && (
                           <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                             <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                               Mixed selection: {selectedPositions.join(', ')}
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               <Button
                                 variant="default"
                                 size="sm"
                                 onClick={() => handleMergePositions(key, 'numbers_range')}
                                 className="bg-orange-600 hover:bg-orange-700"
                               >
                                 <BarChart3 className="w-4 h-4 mr-1" />
                                 Merge as Range
                               </Button>
                               <Button
                                 variant="destructive"
                                 size="sm"
                                 onClick={() => handleUnmergePositions(key)}
                                 className="bg-red-600 hover:bg-red-700"
                               >
                                 <ArrowUpDown className="w-4 h-4 mr-1" />
                                 Unmerge Selected
                               </Button>
                             </div>
                             <div className="text-xs text-yellow-600 dark:text-yellow-400">
                               You can merge individual positions or unmerge merged positions
                             </div>
                           </div>
                         )}
                         
                         {isMerging && selectedPositions.length === 1 && hasOnlyIndividualPositions(key) && (
                           <div className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                             <div className="text-sm text-yellow-600 dark:text-yellow-400">
                               Select at least 2 individual positions to merge, or select merged positions to unmerge
                             </div>
                           </div>
                         )}
                         
                         {isMerging && (
                           <div className="text-xs text-muted-foreground space-y-1">
                             <p><strong>Selection Methods:</strong></p>
                             <p>• <strong>Click:</strong> Select individual positions or click merged cells to select them</p>
                             <p>• <strong>Drag:</strong> Click and drag across the grid to select a range of positions</p>
                             <p>• <strong>Smart Detection:</strong> The system automatically detects if you've selected merged or individual positions</p>
                             <p><strong>Available Actions:</strong></p>
                             <p>• <strong>Merge Individual:</strong> Select 2+ individual positions to see merge options</p>
                             <p>• <strong>Unmerge Merged:</strong> Click the red "Unmerge" button below merged cells, or select merged positions</p>
                             <p>• <strong>Mixed Selection:</strong> Select both types to see both merge and unmerge options</p>
                             <p><strong>Merge Options:</strong></p>
                             <p>• <strong>Numbers Range:</strong> Creates a numbers range (e.g., 00-99) spanning multiple positions</p>
                             <p>• <strong>Fixed Text:</strong> Creates individual fixed character positions for multi-character text (e.g., K-I-T)</p>
                             <p>• <strong>Digits:</strong> Creates individual digit positions (0-9) for each selected position</p>
                             <p>• <strong>Alphabets:</strong> Creates individual alphabet positions (A-Z) for each selected position</p>
                             <p>• <strong>Alphanumeric:</strong> Creates individual alphanumeric positions (A-Z, 0-9) for each selected position</p>
                             {isSelecting && (
                               <p className="text-blue-600 dark:text-blue-400 font-medium">🖱️ Dragging to select positions...</p>
                             )}
                           </div>
                         )}
                      </div>

                      {/* Click Instructions */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                          <Settings className="w-4 h-4" />
                          <span className="font-medium">Click on any position box to configure it</span>
                        </div>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          Click on position boxes above to set their type, values, and descriptions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Special Characters */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Special Characters</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSpecialCharacter(key)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Character
                      </Button>
                    </div>
                    
                    {format.specialCharacters.length > 0 && (
                      <div className="space-y-2">
                        {format.specialCharacters.map((char, index) => (
                          <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                            <Input
                              value={char.character}
                              onChange={(e) => updateSpecialCharacter(key, index, { character: e.target.value })}
                              placeholder="Character"
                              className="w-16"
                              maxLength={1}
                            />
                            <Input
                              value={char.positions.join(', ')}
                              onChange={(e) => {
                                const positions = e.target.value
                                  .split(',')
                                  .map(p => parseInt(p.trim()))
                                  .filter(p => !isNaN(p));
                                updateSpecialCharacter(key, index, { positions });
                              }}
                              placeholder="Positions (e.g., 3, 7)"
                              className="flex-1"
                            />
                            <Input
                              value={char.description || ''}
                              onChange={(e) => updateSpecialCharacter(key, index, { description: e.target.value })}
                              placeholder="Description"
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSpecialCharacter(key, index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Example Preview */}
                  <div className="space-y-2">
                    <Label>Example Preview</Label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4" />
                        <span className="font-mono text-lg">{generateExample(key)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        This is how a {key} registration number would look with the current format.
                      </p>
                      {format.structure.some(p => p.type === 'numbers_range') && (
                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                          <strong>Numbers Range:</strong> {format.structure
                            .filter(p => p.type === 'numbers_range')
                            .map(p => `${p.range?.min || 0}-${p.range?.max || 999} (positions ${p.range?.positions?.join(', ') || ''})`)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Position Configuration Popup */}
      <Dialog open={positionPopup.isOpen} onOpenChange={(open) => setPositionPopup(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configure Position {positionPopup.position}
            </DialogTitle>
          </DialogHeader>
          
          <PositionConfigForm
            position={positionPopup.position}
            existingPosition={positionPopup.existingPosition}
            onSave={handlePositionSave}
            onDelete={handlePositionDelete}
            onCancel={() => setPositionPopup(prev => ({ ...prev, isOpen: false }))}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Position Configuration Form Component
interface PositionConfigFormProps {
  position: number;
  existingPosition?: PositionStructure;
  onSave: (position: PositionStructure) => void;
  onDelete: () => void;
  onCancel: () => void;
}

function PositionConfigForm({ position, existingPosition, onSave, onDelete, onCancel }: PositionConfigFormProps) {
  const [positionData, setPositionData] = useState<PositionStructure>(
    existingPosition || {
      position,
      type: 'digit',
      description: ''
    }
  );

  const handleSave = () => {
    // Auto-calculate range positions if it's a numbers_range type
    if (positionData.type === 'numbers_range' && !positionData.range?.positions) {
      // Default to single position if no range is specified
      positionData.range = {
        min: positionData.range?.min || 1,
        max: positionData.range?.max || 99,
        positions: [position]
      };
    }
    onSave(positionData);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Position Type</Label>
        <Select
          value={positionData.type}
          onValueChange={(value: any) => setPositionData(prev => ({ ...prev, type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="digit">
              <div className="flex items-center space-x-2">
                <Hash className="w-4 h-4" />
                <span>Digit (0-9)</span>
              </div>
            </SelectItem>
            <SelectItem value="alphabet">
              <div className="flex items-center space-x-2">
                <Type className="w-4 h-4" />
                <span>Alphabet (A-Z)</span>
              </div>
            </SelectItem>
            <SelectItem value="alphanumeric">
              <div className="flex items-center space-x-2">
                <Hash className="w-4 h-4" />
                <span>Alphanumeric (A-Z, 0-9)</span>
              </div>
            </SelectItem>
            <SelectItem value="numbers_range">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Numbers Range</span>
              </div>
            </SelectItem>
            <SelectItem value="fixed">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4" />
                <span>Fixed Character</span>
              </div>
            </SelectItem>
            <SelectItem value="year">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Year (Starting/Passing Out)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {positionData.type === 'fixed' && (
        <div className="space-y-2">
          <Label>Fixed Value</Label>
          <Input
            value={positionData.value || ''}
            onChange={(e) => setPositionData(prev => ({ 
              ...prev, 
              value: e.target.value
            }))}
            placeholder={existingPosition?.range?.positions ? 
              `Enter ${existingPosition.range.positions.length} characters for merged cell` : 
              "Enter single character"
            }
            maxLength={existingPosition?.range?.positions?.length || 1}
          />
          {existingPosition?.range?.positions && (
            <div className="text-xs text-muted-foreground">
              This is a merged cell spanning {existingPosition.range.positions.length} positions
            </div>
          )}
        </div>
      )}

      {positionData.type === 'numbers_range' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum Value</Label>
              <Input
                type="number"
                value={positionData.range?.min || 1}
                onChange={(e) => setPositionData(prev => ({ 
                  ...prev, 
                  range: { 
                    ...prev.range, 
                    min: parseInt(e.target.value) || 1,
                    positions: prev.range?.positions || [position]
                  }
                }))}
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Maximum Value</Label>
              <Input
                type="number"
                value={positionData.range?.max || 99}
                onChange={(e) => setPositionData(prev => ({ 
                  ...prev, 
                  range: { 
                    ...prev.range, 
                    max: parseInt(e.target.value) || 99,
                    positions: prev.range?.positions || [position]
                  }
                }))}
                min="1"
              />
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Range Positions</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Position {position} will be automatically configured as a range. 
              {positionData.range?.positions && positionData.range.positions.length > 1 && 
                ` This range spans positions: ${positionData.range.positions.join(', ')}`
              }
            </p>
          </div>
        </div>
      )}

      {positionData.type === 'year' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Year Type</Label>
            <Select
              value={positionData.yearType || 'starting'}
              onValueChange={(value: 'starting' | 'passing_out') => setPositionData(prev => ({ ...prev, yearType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starting">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Starting Year (Joining Year)</span>
                  </div>
                </SelectItem>
                <SelectItem value="passing_out">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Passing Out Year (Graduation Year)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          

          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Year Configuration</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Format automatically determined by number of cells: 2 cells = 2-digit year (24), 4 cells = 4-digit year (2024)
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {positionData.yearType === 'starting' 
                ? 'This will represent the year students joined the program.'
                : 'This will represent the year students will graduate from the program.'
              }
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {position.range?.positions?.length === 2 
                ? 'Format: 2 digits (e.g., 24 for 2024)'
                : 'Format: 4 digits (e.g., 2024)'
              }
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Note: Year validation will be based on the academic year and department study duration.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={positionData.description || ''}
          onChange={(e) => setPositionData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe this position"
        />
      </div>

      <div className="flex justify-between pt-4">
        <div>
          {existingPosition && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
