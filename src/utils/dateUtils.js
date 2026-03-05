/**
 * Date utility functions shared across components
 */

// ---------------------------------------------------------------------------
// Week start day config
// ---------------------------------------------------------------------------

/**
 * Day the week starts on (0=Sunday, 1=Monday, ..., 6=Saturday).
 * Used by Workload grid boundaries, week headers, and Gantt adaptive scales.
 * Change this single value to switch the whole app's week alignment.
 */
export const WEEK_START_DAY = 0; // Sunday

/**
 * The last day of the week (the day before WEEK_START_DAY).
 * Grid boundary lines should appear on the right edge of this day.
 */
export const WEEK_END_DAY = (WEEK_START_DAY + 6) % 7;

/**
 * Check if a date is the first day of a week (i.e. getDay() === WEEK_START_DAY).
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekStart(date) {
  return date.getDay() === WEEK_START_DAY;
}

/**
 * Check if a date is the last day of a week (i.e. getDay() === WEEK_END_DAY).
 * Useful for grid boundary placement (border-right on this day aligns with week header).
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekEnd(date) {
  return date.getDay() === WEEK_END_DAY;
}

/**
 * Return the preceding WEEK_START_DAY (inclusive).
 * If `date` already falls on WEEK_START_DAY, returns `date` unchanged.
 * @param {Date} date
 * @returns {Date}
 */
export function snapToWeekStart(date) {
  const offset = (date.getDay() - WEEK_START_DAY + 7) % 7;
  if (offset === 0) return date;
  const d = new Date(date);
  d.setDate(d.getDate() - offset);
  return d;
}

/**
 * Format date for display in YY/MM/DD format
 * @param {Date|null} d - Date to format
 * @returns {string} Formatted date string or 'None' if invalid/null
 */
export function formatDateDisplay(d) {
  if (!d) return 'None';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return 'None';
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

/**
 * Format date to YYYY-MM-DD string using LOCAL timezone
 * This is important for GitLab API which expects local dates, not UTC.
 * Using toISOString() would convert to UTC and cause off-by-one errors
 * for users in positive UTC offset timezones (e.g., GMT+8).
 *
 * @param {Date|null} d - Date to format
 * @returns {string|null} Date string in YYYY-MM-DD format or null if invalid
 */
export function formatDateToLocalString(d) {
  if (!d) return null;
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const yyyy = String(dateObj.getFullYear());
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create a Date object for start date (00:00:00 local time)
 * @param {Date|string|null} d - Date input
 * @returns {Date|null} Date set to 00:00:00 local time or null if invalid
 */
export function createStartDate(d) {
  if (!d) return null;
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    0,
    0,
    0,
  );
}

/**
 * Create a Date object for due/end date (23:59:59 local time)
 * Due dates should use end-of-day time so tasks appear to end at the end of that day.
 * @param {Date|string|null} d - Date input
 * @returns {Date|null} Date set to 23:59:59 local time or null if invalid
 */
export function createEndDate(d) {
  if (!d) return null;
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    23,
    59,
    59,
  );
}
