// src/components/SharedEditor/SharedEditor.jsx
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSharedEditor } from '../../contexts/SharedEditorContext';
import { useGitLabData } from '../../contexts/GitLabDataContext';
import { getGitLabUrl } from '../../utils/GitLabLinkUtils';
import { TitleField } from './fields/TitleField';
import { DescriptionField } from './fields/DescriptionField';
import { AssigneeField } from './fields/AssigneeField';
import { LabelField } from './fields/LabelField';
import { DateField } from './fields/DateField';
import { LinkedItemsField } from './fields/LinkedItemsField';
import { WeightField } from './fields/WeightField';
import './SharedEditor.css';

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

/**
 * SharedEditor
 *
 * Overlay sidebar that opens when a task is selected in any view.
 * Renders as a fixed right-side panel on top of the view content.
 *
 * Outside-click-to-close: listens on document mousedown; if the click target
 * is outside the panel, closes (or prompts if dirty). This lets clicks on
 * other tasks pass through and re-open the editor with a different task — but
 * if there are unsaved changes the user is prompted first (pendingOpenRef
 * stores the intended next task so Discard → switch works atomically).
 *
 * Resizable: drag the left resize handle to adjust panel width.
 *
 * Usage: Mount once per view that wants to support editing.
 */
export function SharedEditor() {
  const { activeTaskId, activeTask: contextTask, openEditor, closeEditor, isDirty, pendingOpenRef } = useSharedEditor();
  const { tasks } = useGitLabData();
  const [pendingClose, setPendingClose] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const panelRef = useRef(null);
  // Stable ref for current width — avoids recreating onResizeMouseDown on every drag move
  const widthRef = useRef(DEFAULT_WIDTH);
  const dragStateRef = useRef(null); // { startX, startWidth }

  const activeTask = useMemo(() => {
    // Prefer the live task from the global task list (stays in sync with mutations).
    // Fall back to the snapshot passed via openEditor() for tasks not in the global
    // list (e.g. closed issues stored locally in KanbanView).
    return tasks.find((t) => t.id === activeTaskId) ?? contextTask ?? null;
  }, [tasks, activeTaskId, contextTask]);

  // Keep widthRef in sync with width state so onResizeMouseDown doesn't need width as dep
  useEffect(() => { widthRef.current = width; }, [width]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setPendingClose(true);
    } else {
      closeEditor();
    }
  }, [isDirty, closeEditor]);

  // "Discard" button: close current editor, then open pending task (if any).
  const handleConfirmClose = useCallback(() => {
    setPendingClose(false);
    const pending = pendingOpenRef.current;
    if (pending) {
      // Switch to the task the user was trying to open
      openEditor(pending.taskId, pending.task);
    } else {
      closeEditor();
    }
  }, [closeEditor, openEditor, pendingOpenRef]);

  // Close when clicking outside the panel.
  // We use mousedown (not click) so the handler fires before any task-open
  // handler triggered by the same click — letting task switching work naturally.
  useEffect(() => {
    if (!activeTaskId) return;
    const onMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        handleClose();
      }
    };
    // Use capture so we see the event before any stopPropagation inside the chart
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [activeTaskId, handleClose]);

  // Resize drag logic — stable callback using widthRef instead of width state
  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startWidth: widthRef.current };

    const onMove = (moveEvent) => {
      const delta = dragStateRef.current.startX - moveEvent.clientX; // dragging left → wider
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStateRef.current.startWidth + delta));
      setWidth(newWidth);
    };
    const onUp = () => {
      dragStateRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []); // stable: reads width via widthRef, never stale

  if (!activeTaskId || !activeTask) return null;

  const gitlabUrl = getGitLabUrl(activeTask);

  return (
    <div
      role="complementary"
      aria-label={`Edit issue #${activeTask._gitlab?.iid || activeTask.id}`}
      className="shared-editor-overlay"
      ref={panelRef}
      style={{ width }}
    >
      {/* Resize handle on the left edge */}
      <div className="shared-editor-resize-handle" onMouseDown={onResizeMouseDown} />

      <div className="shared-editor-header">
        <h2 className="shared-editor-header-title">
          #{activeTask._gitlab?.iid || activeTask.id} {activeTask.text}
        </h2>
        {gitlabUrl && (
          <button
            className="shared-editor-header-btn"
            title="Open in GitLab"
            aria-label="Open in GitLab"
            onClick={() => window.open(gitlabUrl, '_blank')}
            type="button"
          >
            <i className="fas fa-external-link-alt" />
          </button>
        )}
        <button
          className="shared-editor-header-btn"
          title="Close editor"
          aria-label="Close editor"
          onClick={handleClose}
          type="button"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="shared-editor-body">
        <TitleField task={activeTask} key={`title-${activeTask.id}`} />
        <DescriptionField task={activeTask} key={`desc-${activeTask.id}`} />
        <AssigneeField task={activeTask} key={`assignee-${activeTask.id}`} />
        <LabelField task={activeTask} key={`labels-${activeTask.id}`} />
        <DateField task={activeTask} key={`dates-${activeTask.id}`} />
        <WeightField task={activeTask} key={`weight-${activeTask.id}`} />
        <LinkedItemsField task={activeTask} key={`links-${activeTask.id}`} />
      </div>

      {/* Unsaved changes confirmation */}
      {pendingClose && (
        <div className="shared-editor-confirm-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-title"
            className="shared-editor-confirm-dialog"
          >
            <div id="confirm-discard-title" className="shared-editor-confirm-title">Discard changes?</div>
            <div className="shared-editor-confirm-body">
              You have unsaved changes to the title or description. Discard them?
            </div>
            <div className="shared-editor-confirm-actions">
              <button
                type="button"
                className="shared-editor-confirm-btn shared-editor-confirm-cancel"
                onClick={() => { setPendingClose(false); pendingOpenRef.current = null; }}
                autoFocus
              >
                Keep editing
              </button>
              <button
                type="button"
                className="shared-editor-confirm-btn shared-editor-confirm-discard"
                onClick={handleConfirmClose}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
