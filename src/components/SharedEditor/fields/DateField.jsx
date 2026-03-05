// src/components/SharedEditor/fields/DateField.jsx
/**
 * DateField
 *
 * Auto-saving start and due date fields.
 * Reuses NullableDatePicker from the existing editor components.
 *
 * Date save gotchas:
 * - End date must be set to 23:59:59 so Gantt bars draw through the full day
 * - Null means "clear this date in GitLab" — distinct from "not changed"
 * - We save each date independently when changed
 */
import { useState, useCallback, useRef } from 'react';
import NullableDatePicker from '../../editor/NullableDatePicker';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import './DateField.css';

/**
 * Set time to end of day (23:59:59) for end dates.
 * Gantt bars use time diff, so end date at 00:00:00 would show as previous day.
 */
function setEndOfDay(date) {
  if (date instanceof Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 0);
    return d;
  }
  return date;
}

export function DateField({ task }) {
  const { syncTask, showToast, countWorkdays } = useGitLabData();
  const [saving, setSaving] = useState(false);

  // Determine what GitLab actually has for dates
  // (task.start may be auto-filled from createdAt when GitLab has no start date)
  const isGitLabMilestone = task._gitlab?.type === 'milestone';
  const hasGitLabStart = isGitLabMilestone || !!task._gitlab?.startDate;
  const hasGitLabEnd = isGitLabMilestone || !!task._gitlab?.dueDate;

  const startValue = hasGitLabStart ? task.start : null;
  const endValue = hasGitLabEnd ? task.end : null;

  const handleStartChange = useCallback(async ({ value: newDate }) => {
    setSaving(true);
    try {
      // Pass start: newDate (or null to clear). The provider checks undefined vs null.
      await syncTask(task.id, { start: newDate ?? null });
    } catch (err) {
      showToast('Failed to update start date', 'error');
    } finally {
      setSaving(false);
    }
  }, [task.id, syncTask, showToast]);

  const handleEndChange = useCallback(async ({ value: newDate }) => {
    setSaving(true);
    try {
      // End date needs to be end of day for Gantt bar rendering
      const endDate = newDate ? setEndOfDay(newDate) : null;
      await syncTask(task.id, { end: endDate ?? null });
    } catch (err) {
      showToast('Failed to update due date', 'error');
    } finally {
      setSaving(false);
    }
  }, [task.id, syncTask, showToast]);

  // Calculate workdays if both dates present
  const workdays = (startValue && endValue && countWorkdays)
    ? countWorkdays(startValue, endValue)
    : null;

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">
        Dates {saving && <span style={{ fontWeight: 400, textTransform: 'none' }}>— saving…</span>}
      </label>
      <div className="date-field-row">
        <div className="date-field-col">
          <span className="date-field-sublabel">Start</span>
          <NullableDatePicker
            value={startValue}
            onChange={handleStartChange}
            disabled={saving}
          />
        </div>
        <div className="date-field-col">
          <span className="date-field-sublabel">Due</span>
          <NullableDatePicker
            value={endValue}
            onChange={handleEndChange}
            disabled={saving}
          />
        </div>
      </div>
      {workdays !== null && (
        <div className="date-field-workdays">
          {workdays} workday{workdays !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
