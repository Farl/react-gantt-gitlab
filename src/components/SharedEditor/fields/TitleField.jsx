// src/components/SharedEditor/fields/TitleField.jsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import { useSharedEditor } from '../../../contexts/SharedEditorContext';
import './TitleField.css';

/**
 * TitleField
 *
 * Editable task title. Saves on Enter or blur.
 * Marks editor dirty while typing so close/switch prompts the user.
 *
 * @param {{ task: ITask }} props
 */
export function TitleField({ task }) {
  const { syncTask, showToast } = useGitLabData();
  const { setDirty, discardingRef } = useSharedEditor();
  const [value, setValue] = useState(task.text || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const lastSavedRef = useRef(task.text || '');
  // Track live value in a ref so save() always sees the current value
  // without needing to be recreated on every keystroke (avoids stale closure in onBlur).
  const valueRef = useRef(value);
  // Set to false when component unmounts so onBlur's async save() exits early
  // instead of calling setState on an unmounted component.
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Keep in sync when task changes externally (e.g., switching tasks)
  // Use a ref to avoid re-running when value changes (that would discard in-progress edits)
  const taskIdRef = useRef(task.id);
  if (taskIdRef.current !== task.id) {
    taskIdRef.current = task.id;
    setValue(task.text || '');
    valueRef.current = task.text || '';
    lastSavedRef.current = task.text || '';
    setError(null);
  }

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setValue(newValue);
    valueRef.current = newValue;
    setDirty(newValue !== lastSavedRef.current);
    setError(null);
  }, [setDirty]);

  const save = useCallback(async () => {
    // Skip save when the user has chosen to discard changes (dialog → Discard button)
    // or when the panel is closing without an explicit save action.
    if (discardingRef.current) return;
    const current = valueRef.current;
    if (current === lastSavedRef.current) {
      setDirty(false);
      return;
    }
    if (!current.trim()) {
      setError('Title cannot be empty');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await syncTask(task.id, { text: current.trim() });
      lastSavedRef.current = current.trim();
      // Guard against setState after unmount (e.g. onBlur fires during close)
      if (isMountedRef.current) {
        setDirty(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to save title');
        showToast('Failed to save title', 'error');
      }
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [task.id, syncTask, showToast, setDirty, discardingRef]); // value read via valueRef (always current)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      setValue(lastSavedRef.current);
      setDirty(false);
      setError(null);
    }
  }, [save, setDirty]);

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">Title</label>
      <textarea
        className="title-field-input"
        value={value}
        onChange={handleChange}
        onBlur={save}
        onKeyDown={handleKeyDown}
        rows={2}
        disabled={saving}
        data-gramm="false"
        data-gramm_editor="false"
        spellCheck={false}
      />
      {saving && <span className="title-field-saving">Saving…</span>}
      {error && <span className="title-field-error">{error}</span>}
      {!saving && !error && value !== lastSavedRef.current && (
        <span className="title-field-hint">Enter to save · Esc to discard</span>
      )}
    </div>
  );
}
