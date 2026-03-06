// src/components/SharedEditor/fields/LabelField.jsx
/**
 * LabelField
 *
 * Shows current labels as color tags. An "Edit" button opens the
 * FilterMultiSelect picker and shows remove buttons on tags.
 * Saves immediately on any change.
 *
 * `task.labels` is a comma-separated string, e.g., "bug, enhancement".
 * `serverFilterOptions.labels` has `{title, color}` for all project labels.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import FilterMultiSelect from '../../FilterMultiSelect';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import { LabelBadge } from '../../shared/LabelBadge.jsx';
import '../../shared/LabelBadge.css';
import './LabelField.css';

export function LabelField({ task }) {
  const { syncTask, showToast, serverFilterOptions } = useGitLabData();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const lastSavedRef = useRef(task.labels || '');

  // Reset when task changes
  const taskIdRef = useRef(task.id);
  if (taskIdRef.current !== task.id) {
    taskIdRef.current = task.id;
    lastSavedRef.current = task.labels || '';
    setEditing(false);
  }

  const selectedLabels = useMemo(() => {
    if (!task.labels) return [];
    return task.labels.split(', ').filter(Boolean);
  }, [task.labels]);

  // Build options and color lookup in a single pass
  const { labelOptions, colorMap } = useMemo(() => {
    const labels = serverFilterOptions?.labels || [];
    const map = new Map();
    const opts = labels.map((l) => {
      // Provider returns { title, color }; ServerFilterOptions type says { name, color }
      const labelName = l.name ?? l.title ?? '';
      map.set(labelName, l.color);
      return { value: labelName, label: labelName, color: l.color };
    });
    return { labelOptions: opts, colorMap: map };
  }, [serverFilterOptions]);

  const save = useCallback(async (newLabels) => {
    const newLabelsStr = newLabels.join(', ');
    if (newLabelsStr === lastSavedRef.current) return;
    setSaving(true);
    try {
      await syncTask(task.id, { labels: newLabelsStr });
      lastSavedRef.current = newLabelsStr;
    } catch (err) {
      showToast('Failed to update labels', 'error');
    } finally {
      setSaving(false);
    }
  }, [task.id, syncTask, showToast]);

  const handleRemove = useCallback((labelToRemove) => {
    const newLabels = selectedLabels.filter((l) => l !== labelToRemove);
    save(newLabels);
  }, [selectedLabels, save]);

  const handleChange = useCallback((newSelected) => {
    save(newSelected);
  }, [save]);

  return (
    <div className="shared-editor-field">
      <div className="shared-editor-field-label-row">
        <label className="shared-editor-field-label">
          Labels {saving && <span style={{ fontWeight: 400, textTransform: 'none' }}>— saving…</span>}
        </label>
        {labelOptions.length > 0 && (
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
      <div className="label-field-tags">
        {selectedLabels.length === 0 && (
          <span className="label-field-empty">No labels</span>
        )}
        {selectedLabels.map((label) => (
          <LabelBadge key={label} name={label} color={colorMap.get(label)}>
            {editing && (
              <button
                type="button"
                className="label-field-tag-remove"
                onClick={() => handleRemove(label)}
                title={`Remove ${label}`}
                disabled={saving}
              >×</button>
            )}
          </LabelBadge>
        ))}
      </div>
      {editing && labelOptions.length > 0 && (
        <div className="label-field-picker">
          <FilterMultiSelect
            title="Add labels"
            options={labelOptions}
            selected={selectedLabels}
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}
