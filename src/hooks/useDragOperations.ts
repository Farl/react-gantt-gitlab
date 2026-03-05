/**
 * useDragOperations Hook
 *
 * React hook for managing drag-and-drop operations in the Kanban board.
 * Handles same-list reorder, cross-list drag (label/status changes), and close/reopen for Closed list.
 * Provides snapshot capture for potential rollback on API failures.
 */

import { useCallback, useRef } from 'react';
import type { ITask, TID } from '@svar-ui/gantt-store';

/** Snapshot of task state before drag operation for potential rollback */
interface DragSnapshot {
  /** Copy of task data before drag */
  task: ITask;
  /** Source list ID where drag started */
  sourceListId: string;
}

/** List info passed from KanbanBoardDnd */
export interface DragListInfo {
  /** Special list type: 'regular', 'others', 'closed' */
  type: 'regular' | 'others' | 'closed';
  /** Labels for label-type lists */
  labels: string[];
  /** List grouping dimension: 'label' or 'status' */
  listType: string;
  /** Status GID for status-type lists */
  statusId?: string | null;
  /** Status display name for status-type lists */
  statusName?: string | null;
}

/** Status definition from GitLab namespace */
export interface StatusDefinition {
  id: string;
  name: string;
  color: string;
  position: number;
  category: string;
}

/** Parameters for useDragOperations hook */
export interface UseDragOperationsParams {
  /** Current tasks array */
  tasks: ITask[];
  /**
   * Function to sync task updates to GitLab
   * @param taskId - The task ID to update
   * @param updates - The updates to apply (labels, state, status, etc.)
   */
  syncTask: (taskId: TID, updates: Record<string, unknown>) => Promise<void>;
  /**
   * Function to reorder a task relative to another task
   * @param taskId - The task ID to reorder
   * @param targetId - The target task ID to position relative to
   * @param position - Position relative to target ('before' or 'after')
   */
  reorderTask: (
    taskId: TID,
    targetId: TID,
    position: 'before' | 'after',
  ) => Promise<void>;
  /**
   * Function to show toast notifications
   * @param message - The message to display
   * @param type - Toast type (success, error, info)
   */
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Function to refresh tasks from GitLab after error */
  refreshTasks: () => void;
  /** Available statuses from the GitLab namespace (for determining default closed status) */
  availableStatuses?: StatusDefinition[];
}

/** Return type of useDragOperations hook */
export interface UseDragOperationsReturn {
  /**
   * Capture a snapshot of task state before drag for potential rollback
   * @param taskId - The task ID being dragged
   * @param sourceListId - The source list ID
   */
  captureSnapshot: (taskId: TID, sourceListId: string) => void;
  /**
   * Handle same-list reorder operation
   * @param taskId - The task ID to reorder
   * @param targetTaskId - The target task ID to position relative to
   * @param position - Position relative to target
   * @returns true if successful, false if failed
   */
  handleSameListReorder: (
    taskId: TID,
    targetTaskId: TID,
    position: 'before' | 'after',
  ) => Promise<boolean>;
  /**
   * Handle cross-list drag operation (label/status changes, close/reopen)
   * @param taskId - The task ID to move
   * @param sourceList - Source list info
   * @param targetList - Target list info
   * @returns true if successful, false if failed
   */
  handleCrossListDrag: (
    taskId: TID,
    sourceList: DragListInfo,
    targetList: DragListInfo,
  ) => Promise<boolean>;
  /** Clear the saved snapshot after successful operation */
  clearSnapshot: () => void;
}

/**
 * Custom hook for managing Kanban drag-and-drop operations
 *
 * This hook encapsulates the API operations for:
 * - Same-list reorder: Updates task position via reorderTask
 * - Cross-list drag (label): Updates labels via syncTask
 * - Cross-list drag (status): Updates status via syncTask
 * - Close/reopen: Updates state for Closed list interactions
 *
 * Provides error handling with toast notifications and automatic refresh on failure.
 *
 * NOTE: syncTask handles optimistic updates (updates local state immediately,
 * then syncs to GitLab, rolls back on failure). This hook triggers the operations
 * and handles error display.
 */
export function useDragOperations({
  tasks,
  syncTask,
  reorderTask,
  showToast,
  refreshTasks,
  availableStatuses = [],
}: UseDragOperationsParams): UseDragOperationsReturn {
  // Snapshot reference for potential rollback
  const snapshotRef = useRef<DragSnapshot | null>(null);

  /**
   * Capture snapshot before drag for potential rollback
   */
  const captureSnapshot = useCallback(
    (taskId: TID, sourceListId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        snapshotRef.current = {
          task: { ...task },
          sourceListId,
        };
      }
    },
    [tasks],
  );

  /**
   * Same-list reorder: update relative position
   *
   * Calls the reorderTask function to update the task's position
   * relative to the target task.
   */
  const handleSameListReorder = useCallback(
    async (
      taskId: TID,
      targetTaskId: TID,
      position: 'before' | 'after',
    ): Promise<boolean> => {
      try {
        await reorderTask(taskId, targetTaskId, position);
        return true;
      } catch (error) {
        showToast(
          `Failed to reorder: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [reorderTask, showToast, refreshTasks],
  );

  /**
   * Cross-list drag: handle label changes, status changes, and state changes
   *
   * Different behaviors based on source/target list types:
   * - To closed: Close the issue
   * - To others: Remove source labels only (and reopen if was closed)
   * - Label → Label: Swap labels (remove source, add target)
   * - Label → Status: Remove source labels, set target status
   * - Status → Label: Add target labels (status unchanged by label drag)
   * - Status → Status: Set target status
   * - Status → Others: No-op for status (status stays, just not in any status list)
   */
  const handleCrossListDrag = useCallback(
    async (
      taskId: TID,
      sourceList: DragListInfo,
      targetList: DragListInfo,
    ): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;

      // Extract _gitlab metadata once — used for optimistic state/status updates.
      // Must update _gitlab alongside top-level fields because findTaskListId
      // in KanbanBoardDnd checks both (e.g., task.state AND task._gitlab.state).
      const gitlab = (task as any)._gitlab || {};
      const isClosed = task.state === 'closed' || gitlab.state === 'closed';

      // Parse current labels from task
      // NOTE: task.labels is a comma-separated string in this codebase
      const currentLabels = task.labels
        ? String(task.labels).split(', ').filter(Boolean)
        : [];

      try {
        // Handle target = Closed list: close the issue and set default closed status.
        // GitLab requires state and status to be consistent — a closed issue should
        // have a status in the "done" or "canceled" category.
        if (targetList.type === 'closed') {
          const gitlabUpdates: Record<string, unknown> = {
            ...gitlab,
            state: 'closed',
          };
          const closedUpdates: Record<string, unknown> = {
            state: 'closed',
          };
          // Find default closed status (first status with "done" category, or "canceled")
          const defaultClosedStatus =
            availableStatuses.find((s) => s.category === 'done') ||
            availableStatuses.find((s) => s.category === 'canceled');
          if (defaultClosedStatus) {
            closedUpdates._statusId = defaultClosedStatus.id;
            gitlabUpdates.status = {
              ...gitlab.status,
              id: defaultClosedStatus.id,
              name: defaultClosedStatus.name,
            };
          }
          closedUpdates._gitlab = gitlabUpdates;
          await syncTask(taskId, closedUpdates);
          return true;
        }

        const updates: Record<string, unknown> = {};
        // Accumulate _gitlab field overrides; merged into updates._gitlab at the end
        let gitlabOverrides: Record<string, unknown> | null = null;

        // If was closed, reopen
        if (isClosed) {
          updates.state = 'opened';
          gitlabOverrides = { state: 'opened' };
        }

        // Handle label changes — only when source or target is a label list
        // Status-only drags (Status → Status) don't touch labels at all
        if (sourceList.listType === 'label' && sourceList.labels.length > 0) {
          if (targetList.type === 'others') {
            // Label → Others: remove source labels
            const newLabels = currentLabels.filter(
              (l) => !sourceList.labels.includes(l),
            );
            updates.labels = newLabels.join(', ');
          } else if (targetList.listType === 'label') {
            // Label → Label: remove source labels, add target labels
            const newLabels = currentLabels
              .filter((l) => !sourceList.labels.includes(l))
              .concat(targetList.labels);
            updates.labels = [...new Set(newLabels)].join(', ');
          }
          // Label → Status: only update status, don't touch labels
        } else if (
          sourceList.type === 'others' ||
          sourceList.type === 'closed' ||
          (sourceList.type === 'regular' && sourceList.listType !== 'label')
        ) {
          if (targetList.listType === 'label') {
            // Others/Closed/Status → Label: add target labels
            const newLabels = currentLabels.concat(targetList.labels);
            updates.labels = [...new Set(newLabels)].join(', ');
          }
        }

        // Handle status changes
        if (targetList.listType === 'status' && targetList.statusId) {
          updates._statusId = targetList.statusId;
          gitlabOverrides = {
            ...gitlabOverrides,
            status: {
              ...gitlab.status,
              id: targetList.statusId,
              name: targetList.statusName || '',
            },
          };
        }

        // Merge _gitlab overrides into updates
        if (gitlabOverrides) {
          updates._gitlab = { ...gitlab, ...gitlabOverrides };
        }

        // Only sync if there are actual updates
        if (Object.keys(updates).length > 0) {
          await syncTask(taskId, updates);
        }

        return true;
      } catch (error) {
        showToast(
          `Failed to move issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [tasks, syncTask, showToast, refreshTasks, availableStatuses],
  );

  /**
   * Clear snapshot after successful operation
   */
  const clearSnapshot = useCallback(() => {
    snapshotRef.current = null;
  }, []);

  return {
    captureSnapshot,
    handleSameListReorder,
    handleCrossListDrag,
    clearSnapshot,
  };
}
