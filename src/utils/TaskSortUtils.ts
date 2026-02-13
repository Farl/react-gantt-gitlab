/**
 * Task Sort Utilities
 *
 * Shared sort comparators for Gantt task ordering.
 * Used by sortTasksByOrder (GitLabGraphQLProvider) and stripFolderNodes (FolderLabelUtils).
 */

import type { ITask } from '@svar-ui/gantt-store';

/**
 * Compare milestones by end date → start date → title.
 */
export function compareMilestones(a: ITask, b: ITask): number {
  if (a.end && b.end) return a.end.getTime() - b.end.getTime();
  if (a.end) return -1;
  if (b.end) return 1;
  if (a.start && b.start) return a.start.getTime() - b.start.getTime();
  if (a.start) return -1;
  if (b.start) return 1;
  return (a.text || '').localeCompare(b.text || '');
}

/**
 * Compare tasks by displayOrder → id.
 */
export function compareByDisplayOrder(a: ITask, b: ITask): number {
  const orderA = a.$custom?.displayOrder;
  const orderB = b.$custom?.displayOrder;
  if (orderA != null && orderB != null) return orderA - orderB;
  if (orderA != null) return -1;
  if (orderB != null) return 1;
  return Number(a.id) - Number(b.id);
}
