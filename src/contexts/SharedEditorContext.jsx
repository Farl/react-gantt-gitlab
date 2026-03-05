// src/contexts/SharedEditorContext.jsx
/**
 * SharedEditorContext
 *
 * Provides editor open/close state across Gantt, Kanban, and Workload views.
 * Any view can open the editor for a task; the SharedEditor sidebar renders it.
 *
 * activeTaskId: string|number|null — the task currently open in the editor
 * activeTask: ITask|null — snapshot of the task object at open time (used for
 *   tasks not in the global task list, e.g. closed issues in KanbanView)
 * openEditor(taskId, task?): open editor unconditionally (use when already confirmed)
 * requestOpen(taskId, task?): open editor, prompting if dirty (use for user-initiated opens)
 * closeEditor(): close editor
 * isDirty: boolean — true if unsaved text fields (title/description) have changes
 * setDirty(bool): called by text fields when they have unsaved content
 * pendingOpenRef: holds {taskId, task} when a dirty-guarded open is waiting for user decision
 * discardingRef: set to true synchronously before closeEditor/openEditor-after-discard so that
 *   text field onBlur handlers can skip saving when the user has chosen to discard changes
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const SharedEditorContext = createContext(null);

export function SharedEditorProvider({ children }) {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  // When isDirty and user tries to open another task, we park the request here
  // and show the discard-changes dialog (via SharedEditor's pendingClose mechanism).
  const pendingOpenRef = useRef(null);
  // Set to true synchronously before any confirmed-discard transition so text fields
  // can skip their onBlur save (the user explicitly chose not to save).
  const discardingRef = useRef(false);

  // Open editor unconditionally — clears dirty state without prompting.
  // Use this internally after the user confirms discard.
  const openEditor = useCallback((taskId, task = null) => {
    discardingRef.current = true; // signal text fields to skip onBlur save
    setActiveTaskId(taskId);
    setActiveTask(task);
    setIsDirty(false);
    pendingOpenRef.current = null;
    // Reset after a tick — the synchronous onBlur will have run by then
    setTimeout(() => { discardingRef.current = false; }, 0);
  }, []);

  // User-initiated open: if dirty, park the request so SharedEditor can prompt.
  // Returns true if opened immediately, false if waiting for user confirmation.
  const requestOpen = useCallback((taskId, task = null) => {
    if (!isDirty) {
      setActiveTaskId(taskId);
      setActiveTask(task);
      setIsDirty(false);
      pendingOpenRef.current = null;
      return true;
    }
    // Park the pending open — SharedEditor will pick this up and show the dialog
    pendingOpenRef.current = { taskId, task };
    return false;
  }, [isDirty]);

  const closeEditor = useCallback(() => {
    discardingRef.current = true; // signal text fields to skip onBlur save
    setActiveTaskId(null);
    setActiveTask(null);
    setIsDirty(false);
    pendingOpenRef.current = null;
    setTimeout(() => { discardingRef.current = false; }, 0);
  }, []);

  const setDirty = useCallback((dirty) => {
    setIsDirty(dirty);
  }, []);

  return (
    <SharedEditorContext.Provider value={{
      activeTaskId, activeTask, openEditor, requestOpen, closeEditor, isDirty, setDirty,
      pendingOpenRef, discardingRef,
    }}>
      {children}
    </SharedEditorContext.Provider>
  );
}

export function useSharedEditor() {
  const ctx = useContext(SharedEditorContext);
  if (!ctx) throw new Error('useSharedEditor must be used within SharedEditorProvider');
  return ctx;
}
