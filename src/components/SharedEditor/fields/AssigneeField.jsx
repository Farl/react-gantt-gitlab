// src/components/SharedEditor/fields/AssigneeField.jsx
/**
 * AssigneeField
 *
 * Auto-saving assignee multi-selector. Uses the existing AssigneeSelector component.
 * Saves immediately when selection changes (no explicit save button).
 *
 * `task.assigned` stores assignees as a comma-separated display name string,
 * e.g., "Alice, Bob". `serverFilterOptions.members` provides available members.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { AssigneeSelector } from '../../shared/AssigneeSelector';
import { useGitLabData } from '../../../contexts/GitLabDataContext';

export function AssigneeField({ task }) {
  const { syncTask, showToast, serverFilterOptions } = useGitLabData();
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(task.assigned || '');

  // Reset when task changes
  const taskIdRef = useRef(task.id);
  if (taskIdRef.current !== task.id) {
    taskIdRef.current = task.id;
    lastSavedRef.current = task.assigned || '';
  }

  // Parse comma-separated assigned string to array
  const selectedNames = useMemo(() => {
    if (!task.assigned) return [];
    return task.assigned.split(', ').filter(Boolean);
  }, [task.assigned]);

  // Build options from serverFilterOptions.members
  const options = useMemo(() => {
    const members = serverFilterOptions?.members || [];
    return members.map((m) => ({
      value: m.name,        // We store display name (matches task.assigned format)
      label: m.name,
      subtitle: `@${m.username}`,
      username: m.username,
    }));
  }, [serverFilterOptions]);

  const handleChange = useCallback(async (newSelected) => {
    const newAssigned = newSelected.join(', ');
    if (newAssigned === lastSavedRef.current) return;
    setSaving(true);
    try {
      await syncTask(task.id, { assigned: newAssigned });
      lastSavedRef.current = newAssigned;
    } catch (err) {
      showToast('Failed to update assignees', 'error');
    } finally {
      setSaving(false);
    }
  }, [task.id, syncTask, showToast]);

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">
        Assignees {saving && <span style={{ fontWeight: 400, textTransform: 'none' }}>— saving…</span>}
      </label>
      <AssigneeSelector
        options={options}
        selected={selectedNames}
        onChange={handleChange}
        disabled={saving}
        placeholder="Search members…"
        emptyMessage={options.length === 0 ? 'No members (sync a project first)' : 'No members available'}
        maxHeight={160}
      />
    </div>
  );
}
