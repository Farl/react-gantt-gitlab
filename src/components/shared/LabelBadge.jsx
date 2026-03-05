/**
 * LabelBadge
 * Shared component for rendering a GitLab label as a colored badge.
 * Used by: LabelCell (Gantt grid), KanbanCard, LabelField (SharedEditor),
 *          FilterMultiSelect, WorkloadChart.
 *
 * Text color is auto-selected (white or black) based on background luminance
 * via getLabelStyle() for maximum readability.
 */

import { getLabelStyle } from '../../utils/labelColorUtils';

const DEFAULT_COLOR = '#6b7280';

/**
 * @param {object} props
 * @param {string} props.name - Label display text
 * @param {string} [props.color] - Background hex color; falls back to gray
 * @param {string} [props.className] - Additional CSS class
 * @param {React.ReactNode} [props.children] - Optional content appended after name (e.g. remove button)
 */
export function LabelBadge({ name, color, className = '', children }) {
  const bgColor = color || DEFAULT_COLOR;
  return (
    <span
      className={`label-badge${className ? ` ${className}` : ''}`}
      style={{ backgroundColor: bgColor, ...getLabelStyle(bgColor) }}
    >
      {name}
      {children}
    </span>
  );
}
