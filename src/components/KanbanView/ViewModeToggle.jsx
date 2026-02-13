/**
 * ViewModeToggle Component
 *
 * Segmented button to switch between Kanban view modes:
 * - Issues: Shows only Issues as cards (default, current behavior)
 * - Tasks: Shows only Tasks as independent cards
 * - All: Shows both Issues and Tasks as cards
 */

import './ViewModeToggle.css';

const VIEW_MODES = [
  { value: 'issues', label: 'Issues', icon: 'fa-clipboard-list' },
  { value: 'tasks', label: 'Tasks', icon: 'fa-tasks' },
  { value: 'all', label: 'All', icon: 'fa-layer-group' },
];

/**
 * @param {Object} props
 * @param {'issues' | 'tasks' | 'all'} props.mode - Current view mode
 * @param {function} props.onChange - Callback when mode changes (mode: string) => void
 */
export function ViewModeToggle({ mode, onChange }) {
  return (
    <div className="view-mode-toggle">
      {VIEW_MODES.map(({ value, label, icon }) => (
        <button
          key={value}
          className={`view-mode-toggle-btn${mode === value ? ' active' : ''}`}
          onClick={() => onChange(value)}
          title={`Show ${label}`}
        >
          <i className={`fas ${icon}`} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
