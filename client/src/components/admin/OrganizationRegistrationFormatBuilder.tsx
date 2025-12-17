import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  AlertCircle,
  CheckCircle,
  Info,
  GraduationCap,
  Briefcase,
  User,
  Users,
  Hash,
  Type,
  Shuffle,
  Minus,
  ArrowRight,
  Settings,
  Calendar
} from 'lucide-react';

interface Position {
  position: number;
  type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
  value?: string;
  description?: string;
  range?: {
    min: number;
    max: number;
    positions: number[];
  };
  yearType?: 'joining' | 'current'; // For organization year types
}

interface SpecialCharacter {
  character: string;
  positions: number[];
  description?: string;
}

interface RegistrationFormat {
  employee: {
    totalLength: number;
    structure: Position[];
    specialCharacters: SpecialCharacter[];
    example: string;
    description: string;
  };
  contractor: {
    totalLength: number;
    structure: Position[];
    specialCharacters: SpecialCharacter[];
    example: string;
    description: string;
  };
  visitor: {
    totalLength: number;
    structure: Position[];
    specialCharacters: SpecialCharacter[];
    example: string;
    description: string;
  };
  guest: {
    totalLength: number;
    structure: Position[];
    specialCharacters: SpecialCharacter[];
    example: string;
    description: string;
  };
}

interface OrganizationRegistrationFormatBuilderProps {
  onSave: (format: RegistrationFormat, formatName: string) => void;
  onCancel: () => void;
  initialFormat?: RegistrationFormat;
  initialFormatName?: string;
  isEditing?: boolean;
  existingFormats?: Array<{ name: string }>;
}

export default function OrganizationRegistrationFormatBuilder({
  onSave,
  onCancel,
  initialFormat,
  initialFormatName = '',
  isEditing = false,
  existingFormats = []
}: OrganizationRegistrationFormatBuilderProps) {
  const [formatName, setFormatName] = useState(initialFormatName);
  const [activeRole, setActiveRole] = useState<'employee' | 'contractor' | 'visitor' | 'guest'>('employee');
  const [formats, setFormats] = useState<RegistrationFormat>(initialFormat || {
    employee: {
      totalLength: 10,
      structure: [],
      specialCharacters: [],
      example: '',
      description: ''
    },
    contractor: {
      totalLength: 10,
      structure: [],
      specialCharacters: [],
      example: '',
      description: ''
    },
    visitor: {
      totalLength: 10,
      structure: [],
      specialCharacters: [],
      example: '',
      description: ''
    },
    guest: {
      totalLength: 10,
      structure: [],
      specialCharacters: [],
      example: '',
      description: ''
    }
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [draggedPosition, setDraggedPosition] = useState<number | null>(null);
  const [showPositionPopup, setShowPositionPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<number | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Generate default name if not provided
  useEffect(() => {
    if (!formatName && !isEditing) {
      const timestamp = new Date().toLocaleDateString();
      setFormatName(`Organization Format ${timestamp}`);
    }
  }, [formatName, isEditing]);

  const validateFormat = (role: keyof RegistrationFormat) => {
    const format = formats[role];
    const newErrors: { [key: string]: string } = {};

    if (format.totalLength <= 0) {
      newErrors[`${role}_totalLength`] = 'Total length must be greater than 0';
    }

    if (format.structure.length === 0) {
      newErrors[`${role}_structure`] = 'At least one position is required';
    }

    // Check for position conflicts
    const usedPositions = new Set<number>();
    format.structure.forEach((pos, index) => {
      if (usedPositions.has(pos.position)) {
        newErrors[`${role}_position_${index}`] = `Position ${pos.position} is already used`;
      }
      usedPositions.add(pos.position);

      if (pos.position < 1 || pos.position > format.totalLength) {
        newErrors[`${role}_position_${index}`] = `Position must be between 1 and ${format.totalLength}`;
      }

      if (pos.type === 'fixed' && !pos.value) {
        newErrors[`${role}_position_${index}`] = 'Fixed value is required';
      }

      if (pos.type === 'numbers_range' && (!pos.range || pos.range.min >= pos.range.max)) {
        newErrors[`${role}_position_${index}`] = 'Valid range is required';
      }
    });

    // Check special characters
    format.specialCharacters.forEach((char, index) => {
      if (char.positions.some(p => p < 1 || p > format.totalLength)) {
        newErrors[`${role}_special_${index}`] = 'Special character positions must be within total length';
      }
    });

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const generateExample = (role: keyof RegistrationFormat) => {
    const format = formats[role];
    if (format.structure.length === 0) return '';

    const example = new Array(format.totalLength).fill('_');
    
    // Debug logging
    console.log('🔍 Generating example for role:', role);
    console.log('📋 Format structure:', format.structure);
    
    // Fill in structure
    format.structure.forEach((pos, index) => {
      console.log(`📍 Processing position ${index}:`, pos);
      
      let value = '';
      switch (pos.type) {
        case 'digit':
          value = '0'; // Use consistent example value instead of random
          break;
        case 'alphabet':
          value = 'A'; // Use consistent example value instead of random
          break;
        case 'alphanumeric':
          value = 'A'; // Use consistent example value instead of random
          break;
        case 'fixed':
          value = pos.value || '0'; // Use '0' as default instead of 'X' for better UX
          console.log(`🔧 Fixed value for position ${pos.position}: "${pos.value}" -> "${value}"`);
          // If no value is set for a fixed position, show a warning
          if (!pos.value) {
            console.warn(`⚠️ Fixed position ${pos.position} has no value set! Using default '0'`);
          }
          break;
        case 'numbers_range':
          if (pos.range) {
            // Use the minimum value for consistent example
            const maxDigits = pos.range.max.toString().length;
            value = pos.range.min.toString().padStart(maxDigits, '0');
          }
          break;
        case 'year':
          // Only process year type if it's a valid year position (2 or 4 cells)
          if (pos.range?.positions?.length === 2 || pos.range?.positions?.length === 4) {
            // Show XX as placeholder for year positions
            const isTwoDigit = pos.range.positions.length === 2;
            value = isTwoDigit ? 'XX' : 'XXXX';
          } else {
            // Invalid year position - treat as regular digit
            value = '0';
          }
          break;
      }
      
      // Handle merged positions (ranges)
      if (pos.range?.positions && pos.range.positions.length > 0) {
        console.log(`🔗 Handling merged positions:`, pos.range.positions);
        // For merged positions, fill all positions in the range
        pos.range.positions.forEach((rangePos, rangeIndex) => {
          if (rangePos <= format.totalLength) {
            if (pos.type === 'fixed' && pos.value) {
              // For fixed values, use the character at the corresponding index
              const charValue = pos.value[rangeIndex] || 'X';
              example[rangePos - 1] = charValue;
              console.log(`📝 Set position ${rangePos} to "${charValue}" (from fixed value "${pos.value}" at index ${rangeIndex})`);
            } else if (pos.type === 'numbers_range' && pos.range) {
              // For numbers_range, use the minimum value padded to the range length
              const rangeLength = pos.range.positions.length;
              const paddedValue = String(pos.range.min).padStart(rangeLength, '0');
              const charValue = paddedValue[rangeIndex] || '0';
              example[rangePos - 1] = charValue;
              console.log(`📝 Set position ${rangePos} to "${charValue}" (from numbers_range min="${pos.range.min}" padded="${paddedValue}" at index ${rangeIndex})`);
            } else if (pos.type === 'year' && pos.range) {
              // For year positions, use X for each position in the range
              example[rangePos - 1] = 'X';
              console.log(`📝 Set position ${rangePos} to "X" (from year type)`);
            } else {
              // For other types, use the same value for all positions in range
              example[rangePos - 1] = value;
              console.log(`📝 Set position ${rangePos} to "${value}" (from type ${pos.type})`);
            }
          }
        });
      } else {
        // Handle individual positions (including those with empty range.positions)
        if (pos.position <= format.totalLength) {
          example[pos.position - 1] = value;
          console.log(`📝 Set individual position ${pos.position} to "${value}" (type: ${pos.type})`);
        }
      }
    });

    // Fill in special characters
    format.specialCharacters.forEach(char => {
      char.positions.forEach(pos => {
        if (pos <= format.totalLength && example[pos - 1] === '_') {
          example[pos - 1] = char.character;
        }
      });
    });

    const result = example.join('');
    console.log('✅ Final example:', result);
    return result;
  };

  const getPositionTypeIcon = (type: string) => {
    switch (type) {
      case 'digit': return <Hash className="w-4 h-4" />;
      case 'alphabet': return <Type className="w-4 h-4" />;
      case 'alphanumeric': return <Shuffle className="w-4 h-4" />;
      case 'fixed': return <Type className="w-4 h-4" />;
      case 'numbers_range': return <Hash className="w-4 h-4" />;
      case 'year': return <Calendar className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  const getPositionTypeColor = (type: string) => {
    switch (type) {
      case 'digit': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'alphabet': return 'bg-green-100 border-green-300 text-green-800';
      case 'alphanumeric': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'fixed': return 'bg-gray-100 border-gray-300 text-gray-800';
      case 'numbers_range': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'year': return 'bg-cyan-100 border-cyan-300 text-cyan-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getPositionDisplayValue = (position: Position) => {
    switch (position.type) {
      case 'digit': 
        if (position.range?.positions && position.range.positions.length > 1) {
          return '0'.repeat(position.range.positions.length);
        }
        return '0';
      case 'alphabet': 
        if (position.range?.positions && position.range.positions.length > 1) {
          return 'A'.repeat(position.range.positions.length);
        }
        return 'A';
      case 'alphanumeric': 
        if (position.range?.positions && position.range.positions.length > 1) {
          return 'A'.repeat(position.range.positions.length);
        }
        return 'A';
      case 'fixed': 
        if (position.range?.positions && position.range.positions.length > 1) {
          return position.value || 'X'.repeat(position.range.positions.length);
        }
        return position.value || 'X';
      case 'numbers_range': 
        if (position.range?.positions && position.range.positions.length > 1) {
          const paddingLength = position.range.positions.length;
          const paddedMin = String(position.range.min).padStart(paddingLength, '0');
          const paddedMax = String(position.range.max).padStart(paddingLength, '0');
          return `${paddedMin}-${paddedMax}`;
        }
        return position.range ? `${position.range.min}-${position.range.max}` : '00-99';
      case 'year':
        // Only show year value if it's a valid year position (2 or 4 cells)
        if (position.range?.positions && (position.range.positions.length === 2 || position.range.positions.length === 4)) {
          const yearLength = position.range.positions.length;
          // Show XX as placeholder for year positions
          return yearLength === 2 ? 'XX' : 'XXXX';
        }
        return '0'; // Invalid year position - show as digit
      default: return '?';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'employee': return <User className="w-4 h-4" />;
      case 'contractor': return <Briefcase className="w-4 h-4" />;
      case 'visitor': return <Users className="w-4 h-4" />;
      case 'guest': return <User className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const updateFormat = (role: keyof RegistrationFormat, updates: Partial<RegistrationFormat[keyof RegistrationFormat]>) => {
    setFormats(prev => ({
      ...prev,
      [role]: { ...prev[role], ...updates }
    }));
  };

  const addPosition = (role: keyof RegistrationFormat) => {
    const format = formats[role];
    
    // Find the highest position number in the current structure
    const maxPosition = format.structure.length > 0 
      ? Math.max(...format.structure.map(p => p.position))
      : 0;
    
    const newPosition: Position = {
      position: maxPosition + 1,
      type: 'digit',
      description: ''
    };
    
    updateFormat(role, {
      structure: [...format.structure, newPosition]
    });
  };

  const updatePosition = (role: keyof RegistrationFormat, index: number, updates: Partial<Position>) => {
    const format = formats[role];
    const newStructure = [...format.structure];
    const currentPosition = newStructure[index];
    
    // If changing to fixed type and it's a single position (not merged), ensure it has proper structure
    if (updates.type === 'fixed' && (!currentPosition.range?.positions || currentPosition.range.positions.length === 1)) {
      const position = currentPosition.position;
      updates.range = {
        min: 0,
        max: 0,
        positions: [position] // Single position, not merged
      };
    }
    
    // If changing to year type, set default yearType and ensure proper range
    if (updates.type === 'year' && !updates.yearType) {
      updates.yearType = 'joining'; // Default to joining year for organizations
      
      // If it's a single position (not merged), set up a 2-cell range by default
      if (!currentPosition.range?.positions || currentPosition.range.positions.length === 1) {
        const position = currentPosition.position;
        updates.range = {
          min: 0,
          max: 0,
          positions: [position, position + 1] // Default to 2-cell range for year
        };
      }
    }
    
    newStructure[index] = { ...newStructure[index], ...updates };
    
    // Sort structure by position number to maintain order
    newStructure.sort((a, b) => a.position - b.position);
    
    // Clean up unused positions - remove any positions that are beyond the actual format length
    const cleanedStructure = newStructure.filter(pos => {
      if (pos.range?.positions && pos.range.positions.length > 0) {
        // For merged positions, keep if any position in the range is within the total length
        return pos.range.positions.some(p => p <= format.totalLength);
      } else {
        // For individual positions, keep if within total length
        return pos.position <= format.totalLength;
      }
    });
    
    updateFormat(role, { structure: cleanedStructure });
  };

  const removePosition = (role: keyof RegistrationFormat, index: number) => {
    const format = formats[role];
    const newStructure = format.structure.filter((_, i) => i !== index);
    
    // Don't renumber positions - keep original position numbers
    // This allows for gaps in the position sequence
    
    updateFormat(role, { structure: newStructure });
    setSelectedPosition(null);
  };

  const addSpecialCharacter = (role: keyof RegistrationFormat) => {
    const format = formats[role];
    const newChar: SpecialCharacter = {
      character: '',
      positions: [],
      description: ''
    };
    
    updateFormat(role, {
      specialCharacters: [...format.specialCharacters, newChar]
    });
  };

  const updateSpecialCharacter = (role: keyof RegistrationFormat, index: number, updates: Partial<SpecialCharacter>) => {
    const format = formats[role];
    const newSpecialChars = [...format.specialCharacters];
    newSpecialChars[index] = { ...newSpecialChars[index], ...updates };
    
    updateFormat(role, { specialCharacters: newSpecialChars });
  };

  const removeSpecialCharacter = (role: keyof RegistrationFormat, index: number) => {
    const format = formats[role];
    const newSpecialChars = format.specialCharacters.filter((_, i) => i !== index);
    
    updateFormat(role, { specialCharacters: newSpecialChars });
  };

  // Merge functionality
  const handleMergePositions = (role: keyof RegistrationFormat, mergeType: 'numbers_range' | 'fixed_text' | 'digit' | 'alphabet' | 'alphanumeric') => {
    if (selectedPositions.length < 2) return;
    
    const currentFormat = formats[role];
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
    
    updateFormat(role, { structure: filteredStructure });
    
    setSelectedPositions([]);
    setIsMerging(false);
  };

  // Helper function to check if selected positions contain merged cells
  const hasMergedPositions = (role: keyof RegistrationFormat) => {
    const currentFormat = formats[role];
    
    // Check if any selected position is part of any merged range
    return selectedPositions.some(pos => {
      return currentFormat.structure.some(p => 
        p.range?.positions?.includes(pos)
      );
    });
  };

  // Helper function to check if selected positions are all individual (not merged)
  const hasOnlyIndividualPositions = (role: keyof RegistrationFormat) => {
    const currentFormat = formats[role];
    
    // Check if all selected positions are individual (not part of any range)
    return selectedPositions.every(pos => {
      return !currentFormat.structure.some(p => 
        p.range?.positions?.includes(pos)
      );
    });
  };

  const handleUnmergePositions = (role: keyof RegistrationFormat) => {
    if (selectedPositions.length === 0) return;
    
    const currentFormat = formats[role];
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
              return true;
            } else {
              // Remove the entire range
              return false;
            }
          } else {
            // For all other types (fixed, digit, alphabet, alphanumeric), remove the entire merged position
            return false;
          }
        }
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
    
    updateFormat(role, { structure: filteredStructure });
    
    setSelectedPositions([]);
  };

  // Drag selection functionality
  const handleGridMouseDown = (event: React.MouseEvent) => {
    if (!isMerging) return;
    
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cellWidth = rect.width / currentFormat.totalLength;
    const position = Math.min(Math.max(1, Math.ceil(x / cellWidth)), currentFormat.totalLength);
    
    // Check if this position is part of an existing range
    const rangePosition = currentFormat.structure.find(p => 
      p.type === 'numbers_range' && 
      p.range?.positions?.includes(position)
    );
    
    if (rangePosition && rangePosition.range?.positions) {
      // If clicking on a range, select all positions in that range
      setSelectedPositions(rangePosition.range.positions);
    } else {
      // Start selection with this position
      setIsSelecting(true);
      setDragStart(position);
      setDragEnd(position);
      setSelectedPositions([position]);
    }
  };

  const handleGridMouseMove = (event: React.MouseEvent) => {
    if (!isSelecting || !isMerging) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cellWidth = rect.width / currentFormat.totalLength;
    const position = Math.min(Math.max(1, Math.ceil(x / cellWidth)), currentFormat.totalLength);
    
    if (position !== dragEnd) {
      setDragEnd(position);
      
      // Calculate range from start to current position
      const start = Math.min(dragStart || position, position);
      const end = Math.max(dragStart || position, position);
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

  const handleSave = async () => {
    console.log('handleSave called');
    setIsSaving(true);
    setErrors({}); // Clear previous errors

    try {
      console.log('Starting validation...');
      
      // Validate format name
      if (!formatName.trim()) {
        console.log('Format name validation failed');
        setErrors(prev => ({ ...prev, formatName: 'Format name is required' }));
        return;
      }

      // Check for duplicate names
      if (existingFormats.some(f => f.name === formatName && (!isEditing || f.name !== initialFormatName))) {
        console.log('Duplicate name validation failed');
        setErrors(prev => ({ ...prev, formatName: 'Format name already exists' }));
        return;
      }

      // Check if any role has positions defined
      const roles: (keyof RegistrationFormat)[] = ['employee', 'contractor', 'visitor', 'guest'];
      const hasAnyPositions = roles.some(role => formats[role].structure.length > 0);
      
      console.log('Checking positions for roles:', roles.map(role => ({ role, length: formats[role].structure.length })));
      console.log('hasAnyPositions:', hasAnyPositions);
      
      if (!hasAnyPositions) {
        console.log('No positions validation failed');
        setErrors(prev => ({ 
          ...prev, 
          formatName: 'Please create at least one position for any role before saving' 
        }));
        return;
      }

      // Validate roles that have positions (at least one role must have positions)
      console.log('Validating roles with positions...');
      let isValid = true;
      let hasValidRole = false;

      roles.forEach(role => {
        const format = formats[role];
        console.log(`Checking role ${role}:`, { 
          hasPositions: format.structure.length > 0, 
          totalLength: format.totalLength 
        });
        
        if (format.structure.length > 0) {
          // Only validate roles that have positions
          const roleValid = validateFormat(role);
          console.log(`Role ${role} validation:`, roleValid);
          if (roleValid) {
            hasValidRole = true;
          }
        }
      });

      console.log('Overall validation result:', { isValid, hasValidRole });
      if (!hasValidRole) {
        console.log('No valid roles found, returning early');
        setErrors(prev => ({ 
          ...prev, 
          formatName: 'At least one role must have valid positions' 
        }));
        return;
      }

      // Generate examples for all roles and clean up positions beyond total length
      console.log('Generating examples for all roles...');
      const updatedFormats = { ...formats };
      roles.forEach(role => {
        const format = updatedFormats[role];
        
        // Clean up positions that are beyond the total length
        const cleanedStructure = format.structure.filter(pos => {
          if (pos.range?.positions && pos.range.positions.length > 0) {
            // For merged positions, keep if any position in the range is within the total length
            return pos.range.positions.some(p => p <= format.totalLength);
          } else {
            // For individual positions, keep if within total length
            return pos.position <= format.totalLength;
          }
        });
        
        // Update the format with cleaned structure
        updatedFormats[role] = {
          ...format,
          structure: cleanedStructure
        };
        
        updatedFormats[role].example = generateExample(role);
        console.log(`Generated example for ${role}:`, updatedFormats[role].example);
        console.log(`Cleaned structure for ${role}:`, JSON.stringify(cleanedStructure, null, 2));
      });

      // Call the save function
      console.log('Calling onSave with:', { updatedFormats, formatName });
      console.log('Employee format structure being saved:', JSON.stringify(updatedFormats.employee.structure, null, 2));
      await onSave(updatedFormats, formatName);
      
      // Show success feedback
      console.log('Format saved successfully!');
      
    } catch (error) {
      console.error('Error saving format:', error);
      setErrors(prev => ({ ...prev, formatName: 'Failed to save format. Please try again.' }));
    } finally {
      setIsSaving(false);
    }
  };

  const currentFormat = formats[activeRole];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Registration Format Builder
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure detailed registration number formats for organization departments
            </p>
            <div className="flex items-center mt-2 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Organization format configuration
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                console.log('Create Format button clicked!');
                console.log('Current formats:', formats);
                console.log('Current activeRole:', activeRole);
                console.log('Current formatName:', formatName);
                handleSave();
              }} 
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Format' : 'Create Format'
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Global Error Message */}
          {errors.formatName && errors.formatName.includes('position') && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800 dark:text-red-200">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Cannot Save Format</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                {errors.formatName}
              </p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Create 4 default positions for the current role
                    const defaultPositions: Position[] = [
                      { position: 1, type: 'digit', description: 'Year digits' },
                      { position: 2, type: 'digit', description: 'Year digits' },
                      { position: 3, type: 'alphabet', description: 'Department code' },
                      { position: 4, type: 'digit', description: 'Serial number' }
                    ];
                    updateFormat(activeRole, { structure: defaultPositions });
                    setErrors(prev => ({ ...prev, formatName: '' }));
                  }}
                  className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900/30"
                >
                  Create 4 Default Positions
                </Button>
              </div>
            </div>
          )}

          {/* Format Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Format Details</h3>
            <div className="space-y-2">
              <Label htmlFor="format-name" className="text-sm font-medium">
                Format Name *
              </Label>
              <Input
                id="format-name"
                value={formatName}
                onChange={(e) => {
                  setFormatName(e.target.value);
                  if (errors.formatName) {
                    setErrors(prev => ({ ...prev, formatName: '' }));
                  }
                }}
                placeholder="Enter format name"
                disabled={isEditing}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                A default name has been provided, but you can customize it. Choose a unique name to identify this registration format.
                {isEditing ? ' This name cannot be changed.' : ' This name cannot be changed later.'}
              </p>
              {errors.formatName && (
                <div className="flex items-center space-x-1 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.formatName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Role to Configure</h3>
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              {(['employee', 'contractor', 'visitor', 'guest'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeRole === role
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {getRoleIcon(role)}
                  <span className="capitalize">{role}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current Role Format Configuration */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {activeRole} Format
              </h3>
              <Badge variant="outline" className="text-xs">
                {currentFormat.totalLength} characters
              </Badge>
            </div>

            {/* Total Length and Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total-length" className="text-sm font-medium">Total Length</Label>
                <Input
                  id="total-length"
                  type="number"
                  min="1"
                  max="50"
                  value={currentFormat.totalLength}
                  onChange={(e) => {
                    const length = parseInt(e.target.value) || 1;
                    updateFormat(activeRole, { totalLength: length });
                    if (errors[`${activeRole}_totalLength`]) {
                      setErrors(prev => ({ ...prev, [`${activeRole}_totalLength`]: '' }));
                    }
                  }}
                />
                {errors[`${activeRole}_totalLength`] && (
                  <div className="flex items-center space-x-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors[`${activeRole}_totalLength`]}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input
                  id="description"
                  value={currentFormat.description}
                  onChange={(e) => updateFormat(activeRole, { description: e.target.value })}
                  placeholder={`${activeRole} registration number format`}
                />
              </div>
            </div>

            {/* Position Structure */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">Position Structure</h4>
                <div className="flex items-center space-x-2">
                  {/* Type Examples */}
                  <div className="flex items-center space-x-1">
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-blue-100 border-blue-300 text-blue-800">
                      <Hash className="w-3 h-3 mr-1" />
                      0 Digit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-green-100 border-green-300 text-green-800">
                      <Type className="w-3 h-3 mr-1" />
                      A Alphabet
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-purple-100 border-purple-300 text-purple-800">
                      <Shuffle className="w-3 h-3 mr-1" />
                      A Alphanumeric
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-orange-100 border-orange-300 text-orange-800">
                      <Hash className="w-3 h-3 mr-1" />
                      00 Numbers Range
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-gray-100 border-gray-300 text-gray-800">
                      <Type className="w-3 h-3 mr-1" />
                      K Fixed
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addPosition(activeRole)}
                    className="h-8 px-3"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Position
                  </Button>
                </div>
              </div>

              {/* Current Format Display - Visual Grid */}
              <div className="w-full p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium">Current Format:</Label>
                    {isMerging && (
                      <div className="flex items-center space-x-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        <span>🔗</span>
                        <span>Merge Mode Active</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant={isMerging ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      console.log('Merge button clicked, current isMerging:', isMerging);
                      setIsMerging(!isMerging);
                      setSelectedPositions([]);
                      console.log('Merge mode toggled to:', !isMerging);
                    }}
                  >
                    {isMerging ? 'Cancel Merge' : 'Merge Positions'}
                  </Button>
                </div>
                <div 
                  className="grid gap-1 select-none pb-8" 
                  style={{ gridTemplateColumns: `repeat(${currentFormat.totalLength}, 1fr)` }}
                  onMouseDown={handleGridMouseDown}
                  onMouseMove={handleGridMouseMove}
                  onMouseUp={handleGridMouseUp}
                  onMouseLeave={handleGridMouseUp}
                >
                  {Array.from({ length: currentFormat.totalLength }, (_, i) => {
                    const position = currentFormat.structure.find(p => p.position === i + 1);
                    const isSelected = selectedPosition !== null && currentFormat.structure[selectedPosition]?.position === i + 1;
                    
                    // Check if this position is part of a merged range
                    const rangePosition = currentFormat.structure.find(p => 
                      p.range?.positions?.includes(i + 1)
                    );
                    
                    // If this position is part of a range, only render the first position of the range
                    const isRangeStart = rangePosition && rangePosition.range?.positions?.[0] === i + 1;
                    const isRangePosition = rangePosition && rangePosition.range?.positions?.includes(i + 1);
                    
                    // Skip rendering if this position is part of a range but not the start
                    if (isRangePosition && !isRangeStart) {
                      return null;
                    }
                    
                    // Calculate span for merged cells
                    const span = rangePosition?.range?.positions?.length || 1;
                    
                    return (
                      <div 
                        key={i} 
                        className="relative"
                        style={{ 
                          gridColumn: `span ${span}`,
                          display: span > 1 ? 'flex' : 'block'
                        }}
                      >
                        <div 
                          className={`
                            h-16 w-full border-2 rounded flex flex-col items-center justify-center text-sm font-mono transition-all cursor-pointer hover:shadow-md hover:scale-105
                            ${!position && !isRangePosition ? 'border-dashed border-gray-300 bg-gray-100 dark:bg-gray-700 hover:border-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600' : ''}
                            ${position?.type === 'digit' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : ''}
                            ${position?.type === 'alphabet' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : ''}
                            ${position?.type === 'alphanumeric' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30' : ''}
                            ${position?.type === 'numbers_range' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30' : ''}
                            ${position?.type === 'fixed' ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30' : ''}
                            ${position?.type === 'year' ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30' : ''}
                            ${rangePosition?.type === 'digit' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : ''}
                            ${rangePosition?.type === 'alphabet' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : ''}
                            ${rangePosition?.type === 'alphanumeric' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30' : ''}
                            ${rangePosition?.type === 'numbers_range' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30' : ''}
                            ${rangePosition?.type === 'fixed' ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30' : ''}
                            ${rangePosition?.type === 'year' ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30' : ''}
                            ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                            ${isMerging ? 'hover:ring-2 hover:ring-blue-300 cursor-crosshair' : 'cursor-pointer'}
                            ${selectedPositions.includes(i + 1) ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-100 dark:bg-blue-900/30' : ''}
                            ${span > 1 ? 'border-4 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}
                          `}
                          onClick={() => {
                            console.log('Cell clicked:', i + 1, 'isMerging:', isMerging, 'selectedPositions:', selectedPositions);
                            if (isMerging) {
                              // Check if this position is part of any existing merged range
                              const rangePosition = currentFormat.structure.find(p => 
                                p.range?.positions?.includes(i + 1)
                              );
                              
                              if (rangePosition && rangePosition.range?.positions) {
                                // If clicking on a range, select/deselect all positions in that range
                                const rangePositions = rangePosition.range.positions;
                                const hasAllRangePositions = rangePositions.every(pos => selectedPositions.includes(pos));
                                
                                if (hasAllRangePositions) {
                                  // Deselect all positions in this range
                                  setSelectedPositions(prev => prev.filter(pos => !rangePositions.includes(pos)));
                                } else {
                                  // Select all positions in this range
                                  setSelectedPositions(prev => Array.from(new Set([...prev, ...rangePositions])));
                                }
                              } else {
                                // Toggle individual position selection
                                if (selectedPositions.includes(i + 1)) {
                                  setSelectedPositions(prev => prev.filter(pos => pos !== i + 1));
                                } else {
                                  setSelectedPositions(prev => [...prev, i + 1]);
                                }
                              }
                              console.log('After merge click, selectedPositions:', selectedPositions);
                            } else {
                              // Normal click - open popup
                              // First check if this position is part of a merged range
                              const rangePosition = currentFormat.structure.find(p => 
                                p.range?.positions?.includes(i + 1)
                              );
                              
                              if (rangePosition) {
                                // This is a merged position - find its index in the structure
                                const positionIndex = currentFormat.structure.findIndex(p => p === rangePosition);
                                setSelectedPosition(positionIndex);
                                setPopupPosition(rangePosition.range?.positions?.[0] || i + 1);
                              } else {
                                // This is an individual position
                                const positionIndex = currentFormat.structure.findIndex(p => p.position === i + 1);
                                if (positionIndex >= 0) {
                                  setSelectedPosition(positionIndex);
                                  setPopupPosition(i + 1);
                                } else {
                                  // If no position exists at this index, create a new one
                                  const newPosition: Position = {
                                    position: i + 1,
                                    type: 'digit',
                                    description: ''
                                  };
                                  const newStructure = [...currentFormat.structure, newPosition].sort((a, b) => a.position - b.position);
                                  updateFormat(activeRole, { structure: newStructure });
                                  setSelectedPosition(newStructure.findIndex(p => p.position === i + 1));
                                  setPopupPosition(i + 1);
                                }
                              }
                              setShowPositionPopup(true);
                            }
                          }}
                        >
                          <div className="text-center">
                            <div className="text-lg font-bold">
                              {rangePosition ? getPositionDisplayValue(rangePosition) : (position ? getPositionDisplayValue(position) : '?')}
                            </div>
                            <div className="text-xs opacity-75">
                              {rangePosition ? `${rangePosition.range?.positions?.[0]}-${rangePosition.range?.positions?.[rangePosition.range?.positions?.length - 1]}` : (i + 1)}
                            </div>
                            {(position?.type === 'year' || rangePosition?.type === 'year') && 
                             ((position?.range?.positions?.length === 2 || position?.range?.positions?.length === 4) ||
                              (rangePosition?.range?.positions?.length === 2 || rangePosition?.range?.positions?.length === 4)) && (
                              <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                                {(position || rangePosition)?.yearType === 'joining' ? 'Joining' : 'Current'}
                              </div>
                            )}
                            {!position && !rangePosition && (
                              <div className="text-xs text-gray-500 mt-1">
                                Click to configure
                              </div>
                            )}
                            {span > 1 && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Merged ({span} cells)
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-xs text-white font-bold">✓</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Debug Panel */}
                {isMerging && (
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">Debug Info:</div>
                    <div>isMerging: {isMerging.toString()}</div>
                    <div>selectedPositions: [{selectedPositions.join(', ')}]</div>
                    <div>selectedPositions.length: {selectedPositions.length}</div>
                    <div>hasOnlyIndividualPositions: {hasOnlyIndividualPositions(activeRole).toString()}</div>
                    <div>hasMergedPositions: {hasMergedPositions(activeRole).toString()}</div>
                  </div>
                )}

                {/* No Positions Message */}
                {currentFormat.structure.length === 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">No positions created yet</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Create 4 default positions
                          const defaultPositions: Position[] = [
                            { position: 1, type: 'digit', description: 'Year digits' },
                            { position: 2, type: 'digit', description: 'Year digits' },
                            { position: 3, type: 'alphabet', description: 'Department code' },
                            { position: 4, type: 'digit', description: 'Serial number' }
                          ];
                          updateFormat(activeRole, { structure: defaultPositions });
                        }}
                        className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 dark:text-yellow-300 dark:border-yellow-600 dark:hover:bg-yellow-900/30"
                      >
                        Quick Start (4 positions)
                      </Button>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                      Click on the empty cells (with "?") above to create individual positions, or use "Quick Start" to create 4 default positions.
                    </p>
                  </div>
                )}

                {/* Merge Mode Instructions */}
                {isMerging && currentFormat.structure.length > 0 && selectedPositions.length < 2 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                      <Settings className="w-4 h-4" />
                      <span className="font-medium">Merge Mode Active</span>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                      Click on 2 or more individual positions to merge them together. You can also click on existing merged positions to unmerge them.
                    </p>
                  </div>
                )}

                {/* Merge Options */}
                {(() => {
                  console.log('Merge options check:', {
                    isMerging,
                    selectedPositionsLength: selectedPositions.length,
                    hasOnlyIndividual: hasOnlyIndividualPositions(activeRole),
                    selectedPositions
                  });
                  return isMerging && selectedPositions.length >= 2;
                })() && (
                  <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 mt-4">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Selected individual positions: {selectedPositions.join(', ')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMergePositions(activeRole, 'numbers_range')}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Merge as Number Range
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMergePositions(activeRole, 'fixed_text')}
                        className="bg-gray-600 hover:bg-gray-700"
                      >
                        Merge as Fixed Text
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMergePositions(activeRole, 'digit')}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Merge as Digits
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMergePositions(activeRole, 'alphabet')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Merge as Alphabet
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMergePositions(activeRole, 'alphanumeric')}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Merge as Alphanumeric
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Unmerge button - appears when merged positions are selected */}
                {isMerging && selectedPositions.length > 0 && hasMergedPositions(activeRole) && (
                  <div className="flex flex-col space-y-3 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20 mt-4">
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">
                      Selected merged positions: {selectedPositions.join(', ')}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleUnmergePositions(activeRole)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Unmerge Positions
                    </Button>
                  </div>
                )}
              </div>


              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <Settings className="w-4 h-4" />
                  <span className="font-medium">Click on any position box to configure it</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Click on position boxes above to open a configuration popup. Empty cells (with "?") can be clicked to create new positions. Use "Merge Positions" to combine multiple cells into ranges or fixed text.
                </p>
              </div>
            </div>

            {/* Special Characters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">Special Characters</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSpecialCharacter(activeRole)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Character
                </Button>
              </div>

              {currentFormat.specialCharacters.length > 0 ? (
                <div className="space-y-3">
                  {currentFormat.specialCharacters.map((char, index) => (
                    <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          Special Character {index + 1}
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSpecialCharacter(activeRole, index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Character</Label>
                          <Input
                            value={char.character}
                            onChange={(e) => updateSpecialCharacter(activeRole, index, { 
                              character: e.target.value 
                            })}
                            placeholder="Enter character"
                            maxLength={1}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Positions (comma-separated)</Label>
                          <Input
                            value={char.positions.join(', ')}
                            onChange={(e) => {
                              const positions = e.target.value
                                .split(',')
                                .map(p => parseInt(p.trim()))
                                .filter(p => !isNaN(p));
                              updateSpecialCharacter(activeRole, index, { positions });
                            }}
                            placeholder="e.g., 1, 3, 5"
                          />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label className="text-sm font-medium">Description (Optional)</Label>
                        <Input
                          value={char.description || ''}
                          onChange={(e) => updateSpecialCharacter(activeRole, index, { 
                            description: e.target.value 
                          })}
                          placeholder="Describe this character"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No special characters configured</p>
                </div>
              )}
            </div>

            {/* Example Preview */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 dark:text-white">Example Preview</h4>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <code className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                    {generateExample(activeRole) || 'No example available'}
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  This is how an {activeRole} registration number would look with the current format.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Configuration Popup Modal */}
      {showPositionPopup && selectedPosition !== null && currentFormat.structure[selectedPosition] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configure Position {(() => {
                    const pos = currentFormat.structure[selectedPosition];
                    if (pos.range?.positions && pos.range.positions.length > 1) {
                      return `${pos.range.positions[0]}-${pos.range.positions[pos.range.positions.length - 1]} (Merged)`;
                    }
                    return pos.position;
                  })()}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(() => {
                    const pos = currentFormat.structure[selectedPosition];
                    if (pos.range?.positions && pos.range.positions.length > 1) {
                      return `Set the type and properties for this merged position (${pos.range.positions.length} cells)`;
                    }
                    return 'Set the type and properties for this position';
                  })()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPositionPopup(false);
                  setSelectedPosition(null);
                  setPopupPosition(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Type</Label>
                  <select
                    value={currentFormat.structure[selectedPosition].type}
                    onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                      type: e.target.value as Position['type'] 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="digit">Digit (0-9)</option>
                    <option value="alphabet">Alphabet (A-Z)</option>
                    <option value="alphanumeric">Alphanumeric (A-Z, 0-9)</option>
                    <option value="fixed">Fixed Value</option>
                    <option value="numbers_range">Number Range</option>
                    <option value="year">Year</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {(() => {
                      const pos = currentFormat.structure[selectedPosition];
                      if (pos.range?.positions && pos.range.positions.length > 1) {
                        return `Position Range (${pos.range.positions.length} cells)`;
                      }
                      return 'Position';
                    })()}
                  </Label>
                  {(() => {
                    const pos = currentFormat.structure[selectedPosition];
                    if (pos.range?.positions && pos.range.positions.length > 1) {
                      return (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                          <div className="text-blue-700 dark:text-blue-300">
                            Positions: {pos.range.positions.join(', ')}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            This is a merged position spanning {pos.range.positions.length} cells
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Input
                        type="number"
                        min="1"
                        max={currentFormat.totalLength}
                        value={pos.position}
                        onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                          position: parseInt(e.target.value) || 1 
                        })}
                        className="w-full"
                      />
                    );
                  })()}
                </div>

                {currentFormat.structure[selectedPosition].type === 'fixed' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {(() => {
                        const pos = currentFormat.structure[selectedPosition];
                        if (pos.range?.positions && pos.range.positions.length > 1) {
                          return `Fixed Value (${pos.range.positions.length} characters)`;
                        }
                        return 'Fixed Value';
                      })()}
                    </Label>
                    <Input
                      value={currentFormat.structure[selectedPosition].value || ''}
                      onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                        value: e.target.value 
                      })}
                      placeholder={(() => {
                        const pos = currentFormat.structure[selectedPosition];
                        if (pos.range?.positions && pos.range.positions.length > 1) {
                          return `Enter ${pos.range.positions.length} characters (e.g., "ABCD")`;
                        }
                        return 'Enter fixed character';
                      })()}
                      maxLength={(() => {
                        const pos = currentFormat.structure[selectedPosition];
                        return pos.range?.positions?.length || 1;
                      })()}
                      className="w-full"
                    />
                    {(() => {
                      const pos = currentFormat.structure[selectedPosition];
                      if (pos.range?.positions && pos.range.positions.length > 1) {
                        return (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Enter exactly {pos.range.positions.length} characters for this merged position
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {currentFormat.structure[selectedPosition].type === 'numbers_range' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Min Value</Label>
                      <Input
                        type="number"
                        value={currentFormat.structure[selectedPosition].range?.min || ''}
                        onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                          range: { 
                            min: parseInt(e.target.value) || 0,
                            max: currentFormat.structure[selectedPosition].range?.max || 99,
                            positions: currentFormat.structure[selectedPosition].range?.positions || []
                          } 
                        })}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Max Value</Label>
                      <Input
                        type="number"
                        value={currentFormat.structure[selectedPosition].range?.max || ''}
                        onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                          range: { 
                            min: currentFormat.structure[selectedPosition].range?.min || 0,
                            max: parseInt(e.target.value) || 99,
                            positions: currentFormat.structure[selectedPosition].range?.positions || []
                          } 
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {currentFormat.structure[selectedPosition].type === 'year' && 
                 currentFormat.structure[selectedPosition].range?.positions?.length && 
                 (currentFormat.structure[selectedPosition].range.positions.length === 2 || 
                  currentFormat.structure[selectedPosition].range.positions.length === 4) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Year Type</Label>
                    <select
                      value={currentFormat.structure[selectedPosition].yearType || 'joining'}
                      onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                        yearType: e.target.value as 'joining' | 'current'
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="joining">Joining Year</option>
                      <option value="current">Current Year</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {currentFormat.structure[selectedPosition].yearType === 'joining' 
                        ? 'Year when the employee joined the organization'
                        : 'Current year (updates automatically)'
                      }
                    </p>
                  </div>
                )}
                
                {currentFormat.structure[selectedPosition].type === 'year' && 
                 (!currentFormat.structure[selectedPosition].range?.positions?.length || 
                  (currentFormat.structure[selectedPosition].range.positions.length !== 2 && 
                   currentFormat.structure[selectedPosition].range.positions.length !== 4)) && (
                  <div className="space-y-2">
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <div className="flex items-center">
                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2" />
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Year type is only available for 2 or 4 merged cells
                        </p>
                      </div>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Merge 2 or 4 cells to enable year type selection
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description (Optional)</Label>
                  <Input
                    value={currentFormat.structure[selectedPosition].description || ''}
                    onChange={(e) => updatePosition(activeRole, selectedPosition, { 
                      description: e.target.value 
                    })}
                    placeholder="Describe this position"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  removePosition(activeRole, selectedPosition);
                  setShowPositionPopup(false);
                  setSelectedPosition(null);
                  setPopupPosition(null);
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Position
              </Button>
              <Button
                onClick={() => {
                  setShowPositionPopup(false);
                  setSelectedPosition(null);
                  setPopupPosition(null);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
