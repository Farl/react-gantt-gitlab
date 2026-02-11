/**
 * Task Type Utilities
 *
 * Centralized type-check helpers for Gantt task nodes.
 * Use these instead of repeating `task.$isFolder || task._gitlab?.type === 'folder'` patterns.
 *
 * Node types in this project:
 * - Milestone: GitLab milestone (`_gitlab.type === 'milestone'`, id: `m-{iid}`)
 * - Folder: Virtual folder node (`_gitlab.type === 'folder'`, id: `f-{path}`)
 * - Issue: GitLab Issue (`$isIssue === true`)
 * - Task: GitLab Task (child of Issue, no special flag — identified by exclusion)
 */

import type { ITask } from '@svar-ui/gantt-store';
import { isFolderTask, isFolderTaskId } from './FolderLabelUtils';
import { isMilestoneTask, isMilestoneTaskId } from './MilestoneIdUtils';

// Re-export from existing utils for convenience
export { isFolderTask, isFolderTaskId, isMilestoneTask, isMilestoneTaskId };

/**
 * Check if an ITask is a "structural" node (milestone or folder).
 * Structural nodes cannot be edited, deleted, or reordered like regular work items.
 */
export function isStructuralTask(task: ITask | null | undefined): boolean {
  if (!task) return false;
  return isMilestoneTask(task) || isFolderTask(task);
}

// --- Color constants (single source of truth) ---

export const TASK_COLORS = {
  folder: '#8B8B8B',
  milestone: '#ad44ab',
  issue: '#3983eb',
  task: '#00ba94',
} as const;

/**
 * Get the bar color based on task type.
 * Used by Bars.jsx and OffscreenArrows.jsx.
 */
export function getTaskColor(task: ITask): string {
  if (isFolderTask(task)) return TASK_COLORS.folder;
  if (isMilestoneTask(task) || task.type === 'milestone')
    return TASK_COLORS.milestone;
  if (task.$isIssue) return TASK_COLORS.issue;
  return TASK_COLORS.task;
}
