import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { X } from 'lucide-react';

interface TimePickerProps {
  value: string; // Format: "HH:MM" (24-hour) or "HH:MM AM/PM" (12-hour)
  onChange: (time: string) => void;
  onClose: () => void;
  use12Hour?: boolean;
}

export function TimePicker({ value, onChange, onClose, use12Hour = true }: TimePickerProps) {
  const [hours, setHours] = useState(9);
  const [minutes, setMinutes] = useState(0);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const amPmRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [time, period] = value.split(' ');
      const [h, m] = time.split(':').map(Number);
      
      if (use12Hour && period) {
        setAmPm(period as 'AM' | 'PM');
        setHours(h === 12 ? 12 : h % 12);
      } else {
        setHours(h);
        setAmPm(h >= 12 ? 'PM' : 'AM');
      }
      setMinutes(m || 0);
    }
  }, [value, use12Hour]);

  // Generate hour options
  const hourOptions = use12Hour 
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : Array.from({ length: 24 }, (_, i) => i);

  // Generate minute options (in 5-minute intervals)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  const handleScroll = (ref: React.RefObject<HTMLDivElement>, setter: (value: number) => void, options: number[]) => {
    if (!ref.current) return;
    
    const scrollTop = ref.current.scrollTop;
    const itemHeight = 40; // Height of each item
    const selectedIndex = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));
    
    setter(options[clampedIndex]);
  };

  const handleWheelScroll = (e: React.WheelEvent, ref: React.RefObject<HTMLDivElement>, setter: (value: number) => void, options: number[]) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    if (!ref.current) return;
    
    const delta = e.deltaY > 0 ? 1 : -1;
    const currentValue = setter === setHours ? hours : setter === setMinutes ? minutes : 0;
    const currentIndex = options.indexOf(currentValue);
    const newIndex = Math.max(0, Math.min(currentIndex + delta, options.length - 1));
    
    setter(options[newIndex]);
    ref.current.scrollTop = newIndex * 40;
  };

  const handleOk = () => {
    let finalHours = hours;
    
    if (use12Hour) {
      if (amPm === 'AM' && hours === 12) {
        finalHours = 0;
      } else if (amPm === 'PM' && hours !== 12) {
        finalHours = hours + 12;
      }
    }
    
    const timeString = `${finalHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onChange(timeString);
    onClose();
  };

  const scrollToValue = (ref: React.RefObject<HTMLDivElement>, value: number, options: number[]) => {
    if (!ref.current) return;
    const index = options.indexOf(value);
    if (index !== -1) {
      ref.current.scrollTop = index * 40;
    }
  };

  useEffect(() => {
    scrollToValue(hoursRef, hours, hourOptions);
  }, [hours, hourOptions]);

  useEffect(() => {
    scrollToValue(minutesRef, minutes, minuteOptions);
  }, [minutes, minuteOptions]);

  return createPortal(
    <div 
      data-time-picker="true"
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        className="bg-gray-900 rounded-2xl shadow-2xl p-6 w-80 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Select Time</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="h-8 w-8 p-0 text-white hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Time Picker */}
        <div className="flex justify-center items-center mb-6">
          <div className="flex items-center space-x-2">
            {/* Hours */}
            <div className="relative">
              <div
                ref={hoursRef}
                className="w-16 h-40 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                onScroll={() => handleScroll(hoursRef, setHours, hourOptions)}
                onWheel={(e) => handleWheelScroll(e, hoursRef, setHours, hourOptions)}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-16"></div>
                {hourOptions.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 flex items-center justify-center text-lg font-medium snap-center cursor-pointer hover:bg-gray-700 rounded text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHours(hour);
                      if (hoursRef.current) {
                        hoursRef.current.scrollTop = hourOptions.indexOf(hour) * 40;
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {hour}
                  </div>
                ))}
                <div className="h-16"></div>
              </div>
              {/* Selection indicator */}
              <div className="absolute top-1/2 left-0 right-0 h-10 bg-gray-600 bg-opacity-50 rounded transform -translate-y-1/2 pointer-events-none"></div>
            </div>

            <span className="text-2xl font-bold text-gray-300">:</span>

            {/* Minutes */}
            <div className="relative">
              <div
                ref={minutesRef}
                className="w-16 h-40 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                onScroll={() => handleScroll(minutesRef, setMinutes, minuteOptions)}
                onWheel={(e) => handleWheelScroll(e, minutesRef, setMinutes, minuteOptions)}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-16"></div>
                {minuteOptions.map((minute) => (
                  <div
                    key={minute}
                    className="h-10 flex items-center justify-center text-lg font-medium snap-center cursor-pointer hover:bg-gray-700 rounded text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMinutes(minute);
                      if (minutesRef.current) {
                        minutesRef.current.scrollTop = minuteOptions.indexOf(minute) * 40;
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {minute.toString().padStart(2, '0')}
                  </div>
                ))}
                <div className="h-16"></div>
              </div>
              {/* Selection indicator */}
              <div className="absolute top-1/2 left-0 right-0 h-10 bg-gray-600 bg-opacity-50 rounded transform -translate-y-1/2 pointer-events-none"></div>
            </div>

            {/* AM/PM */}
            {use12Hour && (
              <div className="relative">
                <div
                  ref={amPmRef}
                  className="w-12 h-40 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                  onScroll={() => {
                    if (!amPmRef.current) return;
                    const scrollTop = amPmRef.current.scrollTop;
                    const itemHeight = 40;
                    const selectedIndex = Math.round(scrollTop / itemHeight);
                    setAmPm(selectedIndex === 0 ? 'AM' : 'PM');
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    if (!amPmRef.current) return;
                    const delta = e.deltaY > 0 ? 1 : -1;
                    const currentIndex = amPm === 'AM' ? 0 : 1;
                    const newIndex = Math.max(0, Math.min(currentIndex + delta, 1));
                    setAmPm(newIndex === 0 ? 'AM' : 'PM');
                    amPmRef.current.scrollTop = newIndex * 40;
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => e.stopPropagation()}
                  onMouseLeave={(e) => e.stopPropagation()}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div className="h-16"></div>
                  <div 
                    className="h-10 flex items-center justify-center text-lg font-medium snap-center cursor-pointer hover:bg-gray-700 rounded text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAmPm('AM');
                      if (amPmRef.current) {
                        amPmRef.current.scrollTop = 0;
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    AM
                  </div>
                  <div 
                    className="h-10 flex items-center justify-center text-lg font-medium snap-center cursor-pointer hover:bg-gray-700 rounded text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAmPm('PM');
                      if (amPmRef.current) {
                        amPmRef.current.scrollTop = 40;
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    PM
                  </div>
                  <div className="h-16"></div>
                </div>
                {/* Selection indicator */}
                <div className="absolute top-1/2 left-0 right-0 h-10 bg-gray-600 bg-opacity-50 rounded transform -translate-y-1/2 pointer-events-none"></div>
              </div>
            )}
          </div>
        </div>

        {/* Current Selection Display */}
        <div className="text-center mb-6">
          <div className="text-2xl font-mono font-bold text-blue-400">
            {use12Hour 
              ? `${hours}:${minutes.toString().padStart(2, '0')} ${amPm}`
              : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
            }
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-6 border-gray-600 text-white hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOk();
            }}
            className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
          >
            OK
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
