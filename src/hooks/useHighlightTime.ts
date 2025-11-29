/**
 * useHighlightTime Hook
 * Shared hook for weekend/holiday highlighting logic
 */

import { useCallback, useMemo } from 'react';

interface Holiday {
  date: string;
  name?: string;
}

interface UseHighlightTimeOptions {
  holidays: (string | Holiday)[];
  workdays: (string | Holiday)[];
}

interface UseHighlightTimeReturn {
  isWeekend: (date: Date) => boolean;
  isHoliday: (date: Date) => boolean;
  highlightTime: (date: Date, unit: string) => string;
  formatLocalDate: (date: Date) => string;
  normalizeDateString: (dateStr: string) => string;
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Supports both YYYY-MM-DD and YYYY/M/D formats
 */
function normalizeDateString(dateStr: string): string {
  dateStr = dateStr.trim();

  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useHighlightTime({
  holidays,
  workdays,
}: UseHighlightTimeOptions): UseHighlightTimeReturn {
  // Pre-compute normalized date sets for efficient lookup
  // Use JSON.stringify to create stable dependency
  const holidaysKey = useMemo(
    () =>
      JSON.stringify(holidays.map((h) => (typeof h === 'string' ? h : h.date))),
    [holidays],
  );

  const workdaysKey = useMemo(
    () =>
      JSON.stringify(workdays.map((w) => (typeof w === 'string' ? w : w.date))),
    [workdays],
  );

  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    for (const holiday of holidays) {
      const dateStr = typeof holiday === 'string' ? holiday : holiday.date;
      set.add(normalizeDateString(dateStr));
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidaysKey]);

  const workdaySet = useMemo(() => {
    const set = new Set<string>();
    for (const wd of workdays) {
      const dateStr = typeof wd === 'string' ? wd : wd.date;
      set.add(normalizeDateString(dateStr));
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workdaysKey]);

  // Check if a date is a weekend
  const isWeekend = useCallback(
    (date: Date): boolean => {
      const day = date.getDay();
      const dateStr = formatLocalDate(date);

      // Check if this weekend day is marked as a workday
      if (workdaySet.has(dateStr)) {
        return false; // It's a workday despite being weekend
      }

      return day === 0 || day === 6; // Sunday or Saturday
    },
    [workdaySet],
  );

  // Check if a date is a holiday
  const isHoliday = useCallback(
    (date: Date): boolean => {
      const dateStr = formatLocalDate(date);
      return holidaySet.has(dateStr);
    },
    [holidaySet],
  );

  // Highlight time function for Gantt/Chart components
  const highlightTime = useCallback(
    (date: Date, unit: string): string => {
      if (unit === 'day' && (isWeekend(date) || isHoliday(date))) {
        return 'wx-weekend';
      }
      return '';
    },
    [isWeekend, isHoliday],
  );

  return {
    isWeekend,
    isHoliday,
    highlightTime,
    formatLocalDate,
    normalizeDateString,
  };
}
