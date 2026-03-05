/**
 * useAdaptiveScales Hook
 *
 * Dynamically selects the time scale header configuration based on the current
 * zoomed cell width. As the user zooms out (cellWidth shrinks), the headers
 * seamlessly switch to coarser granularity:
 *
 *   Day (≥22px) → Week (12–22px) → Month (4–12px) → Quarter (1.5–4px) → Year (<1.5px)
 *
 * This is a purely visual change — `lengthUnit` is never modified, so bar
 * positioning accuracy stays the same.
 *
 * Only applies when `lengthUnit='day'`. For other units the hook returns the
 * same static scales that the views already use.
 *
 * Includes a proportional hysteresis band (20%) to prevent flickering at threshold boundaries.
 *
 * Returns a reference-stable result: the same object is reused when the computed
 * level hasn't changed, so downstream SVAR DataStore.init() only fires on actual
 * level transitions (not on every wheel tick).
 *
 * WARNING: Do not use registerScaleUnit() to add custom time units — SVAR's
 * internal diff-counting map (`lt`) is not updated, causing runtime crashes.
 * Also avoid SVAR's built-in unit:'week' for adaptive zoom — see buildWeekScales.
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
  /** Numeric level 0-4 (day/week/month/quarter/year), or -1 for non-day units */
  level: number;
  /** Human-readable level name */
  levelName: string;
  /** SVAR-compatible scales array to pass to <Gantt scales={...}> */
  svarScales: ScaleConfig[];
  /**
   * Multiply zoomedCellWidth by this before passing to SVAR's cellWidth prop.
   * SVAR interprets cellWidth as px-per-minUnit. Day/week levels use 'day' as
   * minUnit so multiplier=1. Month uses ~30×, quarter ~91×, year ~365×.
   */
  cellWidthMultiplier: number;
  /**
   * When true, the caller should snap `dateRange.start` to the preceding
   * WEEK_START_DAY so that unit:'day' step:7 week boundaries align to
   * calendar weeks. Only true at the adaptive week level.
   */
  snapStartToWeek: boolean;
}

// ---------------------------------------------------------------------------
// Thresholds (zoomedCellWidth in px, when lengthUnit='day')
// ---------------------------------------------------------------------------

/**
 * Ordered thresholds: if zoomedCellWidth >= threshold, that level is used.
 * Ordered finest-first (day → quarter). Year (level 4) is the fallback.
 */
const SCALE_LEVELS: Array<{ level: number; threshold: number }> = [
  { level: 0, threshold: 22 }, // day
  { level: 1, threshold: 12 }, // week
  { level: 2, threshold: 4 }, // month
  { level: 3, threshold: 1.5 }, // quarter
  // year (level 4) is the fallback when nothing else matches
];

/**
 * Hysteresis band — when zooming IN (finer), zoomedCellWidth must exceed
 * threshold + HYSTERESIS to transition. Prevents flickering at boundaries.
 * Proportional (20% of threshold) so the band is sensible at both large
 * thresholds (22px → +4.4) and small ones (1.5px → +0.3).
 */
const HYSTERESIS_RATIO = 0.2;

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
 * Week-level header for adaptive zoom.
 *
 * Uses unit:'day' step:7 so that minUnit stays 'day'. This preserves:
 * - Day-accurate month header widths (no misalignment with week cells)
 * - Holiday/weekend rendering capability (day-level grid)
 * - Accurate today-line positioning at all zoom levels
 *
 * Week boundary alignment to calendar weeks (e.g. Sun-Sat) is achieved by
 * snapping dateRange.start to the preceding WEEK_START_DAY in GanttView.
 * The hook signals this via snapStartToWeek=true in the result.
 *
 * WARNING: Do NOT switch to SVAR's built-in unit:'week'. It changes minUnit
 * from 'day' to 'week', which breaks month header proportional widths,
 * today-line positioning, and holiday rendering. Similarly, avoid custom
 * units via registerScaleUnit — SVAR's internal diff-counting map is not
 * updated by it, causing "lt[i] is not a function" crashes.
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

function buildYearScales(): ScaleConfig[] {
  return [
    {
      unit: 'year',
      step: 1,
      format: fmt('yyyy'),
    },
  ];
}

/**
 * Week scales for when user selects "Week" from the Unit dropdown.
 * Uses SVAR's built-in unit:'week' which respects _weekStart (set to
 * WEEK_START_DAY from dateUtils config, currently Sunday).
 */
function buildStaticWeekScales(): ScaleConfig[] {
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
      return buildStaticWeekScales();
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
  buildYearScales,
];
const LEVEL_NAMES = ['day', 'week', 'month', 'quarter', 'year'];
/**
 * SVAR interprets cellWidth as px-per-minUnit. Day/week levels keep minUnit='day'
 * so multiplier=1. Month/quarter levels have minUnit='month'/'quarter', so we must
 * convert from px-per-day to px-per-month (~30.44) or px-per-quarter (~91.31).
 * Year level uses 'year' as minUnit, so ~365.25× to convert px-per-day → px-per-year.
 */
const LEVEL_CELL_WIDTH_MULTIPLIERS = [1, 1, 30.44, 91.31, 365.25];

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
        cellWidthMultiplier: 1,
        snapStartToWeek: false,
      };
      cachedRef.current = result;
      cachedLevelRef.current = -1;
      cachedLengthUnitRef.current = lengthUnit;
      prevLevelRef.current = 0; // reset for when user switches back to day
      return result;
    }

    // --- Day lengthUnit: compute adaptive level with hysteresis ---

    const prev = prevLevelRef.current;

    // Determine target level from raw thresholds.
    // Direct computation (not stepping) so large jumps land correctly.
    let target = SCALE_LEVELS.length; // fallback = year (highest level)
    for (const { level, threshold } of SCALE_LEVELS) {
      if (zoomedCellWidth >= threshold) {
        target = level;
        break;
      }
    }

    // Hysteresis: when zooming IN (finer, target < prev), require exceeding
    // threshold + proportional band to prevent flickering at boundaries.
    if (target < prev) {
      for (const { level, threshold } of SCALE_LEVELS) {
        if (level <= target) continue; // only check boundaries we'd cross
        if (
          prev >= level &&
          zoomedCellWidth < threshold * (1 + HYSTERESIS_RATIO)
        ) {
          target = level;
        }
      }
    }

    const newLevel = target;

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
      cellWidthMultiplier: LEVEL_CELL_WIDTH_MULTIPLIERS[newLevel],
      snapStartToWeek: newLevel === 1, // week level uses unit:'day' step:7
    };

    cachedRef.current = result;
    cachedLevelRef.current = newLevel;
    cachedLengthUnitRef.current = lengthUnit;
    return result;
  }, [zoomedCellWidth, lengthUnit]);
}
