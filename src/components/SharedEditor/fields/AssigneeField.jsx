// src/components/SharedEditor/fields/AssigneeField.jsx
/**
 * AssigneeField
 *
 * Shows current assignees as a compact list. An "Edit" button opens the
 * AssigneeSelector for changes. Saves immediately when selection changes.
 *
 * `task.assigned` stores assignees as a comma-separated display name string,
 * e.g., "Alice, Bob". `serverFilterOptions.members` provides available members.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { AssigneeSelector } from '../../shared/AssigneeSelector';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import './AssigneeField.css';

export function AssigneeField({ task }) {
  const { syncTask, showToast, serverFilterOptions } = useGitLabData();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const lastSavedRef = useRef(task.assigned || '');

  // Reset editing state when task changes
  const taskIdRef = useRef(task.id);
  if (taskIdRef.current !== task.id) {
    taskIdRef.current = task.id;
    lastSavedRef.current = task.assigned || '';
    setEditing(false);
  }

  // Parse comma-separated assigned string to array
  const selectedNames = useMemo(() => {
    if (!task.assigned) return [];
    return task.assigned.split(', ').filter(Boolean);
  }, [task.assigned]);

  // Build options and name→username lookup in a single pass
  const { options, memberMap } = useMemo(() => {
    const members = serverFilterOptions?.members || [];
    const map = new Map();
    const opts = members.map((m) => {
      map.set(m.name, m.username);
      return {
        value: m.name,
        label: m.name,
        subtitle: `@${m.username}`,
        username: m.username,
      };
    });
    return { options: opts, memberMap: map };
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

  const handleRemove = useCallback((nameToRemove) => {
    const newSelected = selectedNames.filter((n) => n !== nameToRemove);
    handleChange(newSelected);
  }, [selectedNames, handleChange]);

  return (
    <div className="shared-editor-field">
      <div className="shared-editor-field-label-row">
        <label className="shared-editor-field-label">
          Assignees {saving && <span style={{ fontWeight: 400, textTransform: 'none' }}>— saving…</span>}
        </label>
        {options.length > 0 && (
          <button
            type="button"
            className="field-edit-btn"
            onClick={() => setEditing(!editing)}
            disabled={saving}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      {/* Current assignees list */}
      <div className="assignee-field-tags">
        {selectedNames.length === 0 && (
          <span className="assignee-field-empty">No assignees</span>
        )}
        {selectedNames.map((name) => {
          const username = memberMap.get(name);
          return (
            <span key={name} className="assignee-field-tag" title={username ? `${name} (@${username})` : name}>
              <span className="assignee-field-tag-name">{name}</span>
              {username && <span className="assignee-field-tag-id">@{username}</span>}
              {editing && (
                <button
                  type="button"
                  className="assignee-field-tag-remove"
                  onClick={() => handleRemove(name)}
                  title={`Remove ${name}`}
                  disabled={saving}
                >×</button>
              )}
            </span>
          );
        })}
      </div>
      {/* Selector - only shown when editing */}
      {editing && (
        <AssigneeSelector
          options={options}
          selected={selectedNames}
          onChange={handleChange}
          disabled={saving}
          placeholder="Search members…"
          emptyMessage="No members available"
          maxHeight={160}
        />
      )}
    </div>
  );
}
