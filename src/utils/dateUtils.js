/**
 * Date utility functions shared across components
 */

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
