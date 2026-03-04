/**
 * useAdaptiveScales Hook
 *
 * Dynamically selects the time scale header configuration based on the current
 * zoomed cell width. As the user zooms out (cellWidth shrinks), the headers
 * seamlessly switch to coarser granularity:
 *
 *   Day (≥22px) → Week (12–22px) → Month (4–12px) → Quarter (<4px)
 *
 * This is a purely visual change — `lengthUnit` is never modified, so bar
 * positioning accuracy stays the same.
 *
 * Only applies when `lengthUnit='day'`. For other units the hook returns the
 * same static scales that the views already use.
 *
 * Includes a hysteresis band (2px) to prevent flickering at threshold boundaries.
 *
 * Returns a reference-stable result: the same object is reused when the computed
 * level hasn't changed, so downstream SVAR DataStore.init() only fires on actual
 * level transitions (not on every wheel tick).
 *
 * NOTE: Custom registerScaleUnit('monthWeek') was removed because SVAR's internal
 * diff-counting function map (`lt`) is not updated by registerScaleUnit, causing
 * "lt[i] is not a function" crashes. Instead we use the built-in 'week' unit with
 * a custom format function that shows date ranges (e.g. "3-9 Mar").
 */

import { useMemo, useRef } from 'react';
import { format as dateFnsFormat } from '@svar-ui/gantt-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScaleConfig {
  unit: string;
  step: number;
  format: ((d: Date, next?: Date) => string) | string;
  css?: (d: Date) => string;
}

export interface AdaptiveScaleInfo {
  /** Numeric level 0-3 (day/week/month/quarter), or -1 for non-day units */
  level: number;
  /** Human-readable level name */
  levelName: string;
  /** SVAR-compatible scales array to pass to <Gantt scales={...}> */
  svarScales: ScaleConfig[];
}

// ---------------------------------------------------------------------------
// Thresholds (zoomedCellWidth in px, when lengthUnit='day')
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  DAY_TO_WEEK: 22,
  WEEK_TO_MONTH: 12,
  MONTH_TO_QUARTER: 4,
};

/** Hysteresis band — going UP (finer) requires exceeding threshold + this */
const HYSTERESIS_PX = 2;

// ---------------------------------------------------------------------------
// Scale builders
// ---------------------------------------------------------------------------

function fmt(pattern: string): (d: Date) => string {
  return (d: Date) => dateFnsFormat(d, pattern);
}

function buildDayScales(): ScaleConfig[] {
  return [
    { unit: 'year', step: 1, format: fmt('yyyy') },
    { unit: 'month', step: 1, format: fmt('MMMM') },
    { unit: 'day', step: 1, format: fmt('d') },
  ];
}

/**
 * Week-level header using unit:'day' step:7.
 *
 * IMPORTANT: We use unit:'day' (not 'week') so SVAR's minUnit stays 'day'.
 * This keeps cellWidth = px-per-day, month gridlines aligned to actual dates,
 * and bar positioning unchanged. Only the header labels change.
 *
 * SVAR passes (cellStart, nextCellStart) to the format function.
 */
function weekRangeFormat(d: Date, next?: Date): string {
  const startDay = d.getDate();
  if (next) {
    const endDate = new Date(next);
    endDate.setDate(endDate.getDate() - 1);
    return `${startDay}-${endDate.getDate()}`;
  }
  return String(startDay);
}

function buildWeekScales(): ScaleConfig[] {
  return [
    { unit: 'month', step: 1, format: fmt('MMM yyyy') },
    { unit: 'day', step: 7, format: weekRangeFormat },
  ];
}

function buildMonthScales(): ScaleConfig[] {
  return [
    { unit: 'year', step: 1, format: fmt('yyyy') },
    { unit: 'month', step: 1, format: fmt('MMM') },
  ];
}

function buildQuarterScales(): ScaleConfig[] {
  return [
    { unit: 'year', step: 1, format: fmt('yyyy') },
    {
      unit: 'quarter',
      step: 1,
      format: (d: Date) => 'Q' + (Math.floor(d.getMonth() / 3) + 1),
    },
  ];
}

/** Standard ISO week scales (for when user selects "Week" from the Unit dropdown) */
function buildIsoWeekScales(): ScaleConfig[] {
  return [
    { unit: 'month', step: 1, format: fmt('MMM') },
    { unit: 'week', step: 1, format: fmt('w') },
  ];
}

/** Static scales for non-day lengthUnits (identical to previous GanttView logic) */
function getStaticScales(lengthUnit: string): ScaleConfig[] {
  switch (lengthUnit) {
    case 'hour':
      return [
        { unit: 'day', step: 1, format: fmt('MMM d') },
        { unit: 'hour', step: 2, format: fmt('HH:mm') },
      ];
    case 'week':
      return buildIsoWeekScales();
    case 'month':
      return buildMonthScales();
    case 'quarter':
      return buildQuarterScales();
    default:
      return buildDayScales();
  }
}

// ---------------------------------------------------------------------------
// Level builders & names — indexed by level number
// ---------------------------------------------------------------------------

const LEVEL_BUILDERS = [
  buildDayScales,
  buildWeekScales,
  buildMonthScales,
  buildQuarterScales,
];
const LEVEL_NAMES = ['day', 'week', 'month', 'quarter'];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAdaptiveScales(
  zoomedCellWidth: number,
  lengthUnit: string,
): AdaptiveScaleInfo {
  // Track previous level for hysteresis
  const prevLevelRef = useRef(0);
  // Cache the result object for reference stability
  const cachedRef = useRef<AdaptiveScaleInfo | null>(null);
  const cachedLevelRef = useRef(-99);
  const cachedLengthUnitRef = useRef('');

  return useMemo(() => {
    // Non-day lengthUnits: return static scales, no adaptation
    if (lengthUnit !== 'day') {
      // Only rebuild if lengthUnit changed
      if (cachedLengthUnitRef.current === lengthUnit && cachedRef.current) {
        return cachedRef.current;
      }
      const result: AdaptiveScaleInfo = {
        level: -1,
        levelName: lengthUnit,
        svarScales: getStaticScales(lengthUnit),
      };
      cachedRef.current = result;
      cachedLevelRef.current = -1;
      cachedLengthUnitRef.current = lengthUnit;
      prevLevelRef.current = 0; // reset for when user switches back to day
      return result;
    }

    // --- Day lengthUnit: compute adaptive level with hysteresis ---

    const prev = prevLevelRef.current;
    let newLevel: number;

    // Downward thresholds (zooming out) vs upward thresholds (zooming in)
    if (prev === 0) {
      newLevel = zoomedCellWidth < THRESHOLDS.DAY_TO_WEEK ? 1 : 0;
    } else if (prev === 1) {
      if (zoomedCellWidth >= THRESHOLDS.DAY_TO_WEEK + HYSTERESIS_PX) {
        newLevel = 0;
      } else if (zoomedCellWidth < THRESHOLDS.WEEK_TO_MONTH) {
        newLevel = 2;
      } else {
        newLevel = 1;
      }
    } else if (prev === 2) {
      if (zoomedCellWidth >= THRESHOLDS.WEEK_TO_MONTH + HYSTERESIS_PX) {
        newLevel = 1;
      } else if (zoomedCellWidth < THRESHOLDS.MONTH_TO_QUARTER) {
        newLevel = 3;
      } else {
        newLevel = 2;
      }
    } else {
      // prev === 3
      newLevel =
        zoomedCellWidth >= THRESHOLDS.MONTH_TO_QUARTER + HYSTERESIS_PX ? 2 : 3;
    }

    prevLevelRef.current = newLevel;

    // Return cached result if level and lengthUnit are unchanged (reference stability)
    if (
      newLevel === cachedLevelRef.current &&
      lengthUnit === cachedLengthUnitRef.current &&
      cachedRef.current
    ) {
      return cachedRef.current;
    }

    const result: AdaptiveScaleInfo = {
      level: newLevel,
      levelName: LEVEL_NAMES[newLevel],
      svarScales: LEVEL_BUILDERS[newLevel](),
    };

    cachedRef.current = result;
    cachedLevelRef.current = newLevel;
    cachedLengthUnitRef.current = lengthUnit;
    return result;
  }, [zoomedCellWidth, lengthUnit]);
}
