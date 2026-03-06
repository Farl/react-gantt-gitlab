// src/components/SharedEditor/fields/WeightField.jsx
/**
 * WeightField — numeric weight input, auto-saves on blur or Enter.
 * GitLab issue weight: integer >= 0.
 */
import { useState, useCallback, useRef } from 'react';
import { useGitLabData } from '../../../contexts/GitLabDataContext';

export function WeightField({ task }) {
  const { syncTask, showToast } = useGitLabData();
  const [value, setValue] = useState(task.weight ?? '');
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(task.weight ?? '');

  const taskIdRef = useRef(task.id);
  if (taskIdRef.current !== task.id) {
    taskIdRef.current = task.id;
    setValue(task.weight ?? '');
    lastSavedRef.current = task.weight ?? '';
  }

  const save = useCallback(async () => {
    const numValue = value === '' ? null : parseInt(value, 10);
    if (numValue === lastSavedRef.current) return;
    setSaving(true);
    try {
      await syncTask(task.id, { weight: numValue });
      lastSavedRef.current = numValue;
    } catch (err) {
      showToast('Failed to update weight', 'error');
    } finally {
      setSaving(false);
    }
  }, [value, task.id, syncTask, showToast]);

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">Weight {saving && '— saving…'}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        disabled={saving}
        style={{
          border: 'var(--wx-border, 1px solid #dcdcde)',
          borderRadius: 4,
          padding: '5px 8px',
          fontSize: 13,
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--wx-background, #fff)',
          color: 'var(--wx-color-font, #303030)',
        }}
      />
    </div>
  );
}
