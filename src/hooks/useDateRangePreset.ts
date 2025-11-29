/**
 * useDateRangePreset Hook
 * Shared hook for date range preset management with localStorage persistence
 */

import { useState, useEffect, useMemo } from 'react';

export type DateRangePreset = '1m' | '3m' | '6m' | '1y' | '2y' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

interface UseDateRangePresetOptions {
  /** Storage key prefix for localStorage */
  storagePrefix: string;
  /** Default preset value */
  defaultPreset?: DateRangePreset;
}

interface UseDateRangePresetReturn {
  dateRangePreset: DateRangePreset;
  setDateRangePreset: (preset: DateRangePreset) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  dateRange: DateRange;
}

/**
 * Calculate date range based on preset
 */
function calculateDateRange(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string,
): DateRange {
  const now = new Date();
  let start: Date;
  let end: Date;

  // Handle custom range
  if (preset === 'custom') {
    if (customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else {
      // Default to 6 months if custom dates not set
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    }
    return { start, end };
  }

  // Calculate based on preset
  // All presets use fixed 1 month in the past, variable future
  // Use custom for different past range
  const pastMonths = 1; // Fixed: 1 month in the past
  start = new Date(now.getFullYear(), now.getMonth() - pastMonths, 1);

  switch (preset) {
    case '1m':
      // 1 month past + 1 month future = ~2 months total
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case '3m':
      // 1 month past + 3 months future
      end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      break;
    case '6m':
      // 1 month past + 6 months future
      end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
      break;
    case '1y':
      // 1 month past + 12 months future
      end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
      break;
    case '2y':
      // 1 month past + 24 months future
      end = new Date(now.getFullYear(), now.getMonth() + 24, 0);
      break;
    default:
      // 6m as default (1 month past + 6 months future)
      end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
  }

  return { start, end };
}

export function useDateRangePreset({
  storagePrefix,
  defaultPreset = '6m',
}: UseDateRangePresetOptions): UseDateRangePresetReturn {
  // Date range preset state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    () => {
      const saved = localStorage.getItem(`${storagePrefix}-date-range-preset`);
      return (saved as DateRangePreset) || defaultPreset;
    },
  );

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const saved = localStorage.getItem(`${storagePrefix}-custom-start`);
    return saved || '';
  });

  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const saved = localStorage.getItem(`${storagePrefix}-custom-end`);
    return saved || '';
  });

  // Persist preset to localStorage
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-date-range-preset`, dateRangePreset);
  }, [storagePrefix, dateRangePreset]);

  // Persist custom start date to localStorage
  useEffect(() => {
    if (customStartDate) {
      localStorage.setItem(`${storagePrefix}-custom-start`, customStartDate);
    }
  }, [storagePrefix, customStartDate]);

  // Persist custom end date to localStorage
  useEffect(() => {
    if (customEndDate) {
      localStorage.setItem(`${storagePrefix}-custom-end`, customEndDate);
    }
  }, [storagePrefix, customEndDate]);

  // Calculate date range based on preset
  const dateRange = useMemo(
    () => calculateDateRange(dateRangePreset, customStartDate, customEndDate),
    [dateRangePreset, customStartDate, customEndDate],
  );

  return {
    dateRangePreset,
    setDateRangePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  };
}
