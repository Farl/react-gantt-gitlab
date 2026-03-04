/**
 * Configuration preparation helpers for SVAR Gantt.
 *
 * Ported from upstream svar-widgets/react-gantt (v2.5) to support:
 * - Scale format string processing (%-style → formatter functions via dateToString)
 * - Zoom config normalization (process format strings within zoom levels)
 * - Column date format normalization
 *
 * These helpers bridge the gap between user-provided config (which may use
 * %-style format strings like '%F %Y') and what DataStore.init() expects
 * (formatter functions).
 *
 * NOTE: If format values are already functions (as in our adaptive scales),
 * they pass through unchanged.
 */

import { dateToString } from '@svar-ui/lib-dom';

/**
 * Convert a format value to a formatter function.
 * - If already a function, returns it unchanged.
 * - If a %-style string (e.g. '%F %Y'), converts via dateToString with locale.
 * - dateToString requires a calendarLocale object for month/day names.
 */
function normalizeFormatter(value, calendarLocale) {
  return typeof value === 'function'
    ? value
    : dateToString(value, calendarLocale);
}

/**
 * Process scale configs: convert format strings to formatter functions.
 * @param {Array} scales - Array of scale config objects
 * @param {object} calendarLocale - Locale calendar object (for month names etc.)
 * @returns {Array} Processed scales with format functions
 */
export function prepareScales(scales, calendarLocale) {
  if (!scales || !calendarLocale) return scales;
  return scales.map(({ format, ...scale }) => ({
    ...scale,
    format: normalizeFormatter(format, calendarLocale),
  }));
}

/**
 * Build unit format functions for all standard time units.
 * Used by normalizeZoom to provide default formats for auto-generated zoom levels.
 * @param {object} calendarLocale - Locale calendar object
 * @param {function} _ - Translation function (locale.getGroup('gantt'))
 * @returns {object} Map of unit name → formatter function
 */
export function prepareFormats(calendarLocale, _) {
  const formats = {
    year: '%Y',
    quarter: `${_('Q')} %Q`,
    month: '%M',
    week: `${_('Week')} %w`,
    day: '%M %j',
    hour: '%H:%i',
  };
  for (let unit in formats) {
    formats[unit] = dateToString(formats[unit], calendarLocale);
  }
  return formats;
}

/**
 * Process column configs: add date format templates for start/end columns.
 * @param {Array} columns - Array of column config objects
 * @param {object} calendarLocale - Locale calendar object
 * @returns {Array} Processed columns
 */
export function prepareColumns(columns, calendarLocale) {
  if (!columns || !columns.length || !calendarLocale) return columns;
  const format = dateToString('%d-%m-%Y', calendarLocale);

  return columns.map((col) => {
    if (col.template) return col;

    if (col.id === 'start' || col.id === 'end') {
      return {
        ...col,
        _template: (b) => format(b),
        template: (b) => format(b),
      };
    }
    if (col.id === 'duration') {
      return {
        ...col,
        _template: (b) => b,
        template: (b) => b,
      };
    }
    return col;
  });
}

/**
 * Process zoom config: convert format strings within zoom level scales.
 * @param {boolean|object} zoom - Zoom config (true for default, or object with levels)
 * @param {object} calendarLocale - Locale calendar object
 * @returns {boolean|object} Processed zoom config
 */
export function prepareZoom(zoom, calendarLocale) {
  if (!zoom || typeof zoom === 'boolean' || !zoom.levels || !calendarLocale) {
    return zoom;
  }

  return {
    ...zoom,
    levels: zoom.levels.map((level) => ({
      ...level,
      scales: prepareScales(level.scales, calendarLocale),
    })),
  };
}
