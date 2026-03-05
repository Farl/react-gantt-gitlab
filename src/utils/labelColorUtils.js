/**
 * Shared utilities for GitLab label badge color rendering.
 * Used by: LabelBadge (shared component) — all label badge rendering goes through LabelBadge.
 */

/**
 * Returns '#fff' or '#000' based on background color luminance.
 * Ensures label text is readable regardless of label background color.
 * Used internally by getLabelStyle().
 * @param {string} hex - CSS hex color string, e.g. '#a8d1f0'
 * @returns {'#fff'|'#000'}
 */
export function getContrastColor(hex) {
  if (!hex) return '#fff';
  const color = hex.replace('#', '');
  if (color.length !== 6) return '#fff';
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000' : '#fff';
}

/**
 * Returns inline style props for a label badge.
 * Uses WCAG luminance to pick white or black text for maximum contrast.
 * @param {string} bgColor - CSS hex color string
 * @returns {{ color: string }}
 */
export function getLabelStyle(bgColor) {
  return {
    color: getContrastColor(bgColor),
  };
}
