/**
 * Folder Label Utilities
 *
 * Handles parsing and tree building for GitLab scoped labels with the format:
 *   folder::segment1/segment2/segment3
 *
 * Folder labels create a virtual tree structure in the Gantt chart.
 *
 * Key concept: Milestone titles can contain "/" (e.g., "小活動範本/生日").
 * When they do, the milestone is placed INSIDE the folder tree based on its
 * title path. For example, milestone "小活動範本/生日" becomes a child of
 * folder "小活動範本".
 *
 * Rules:
 * - Only GitLab Issues are affected (Tasks ignore folder labels)
 * - GitLab scoped labels ensure at most one folder:: label per issue
 * - Case-sensitive, exact match for milestone name comparison
 * - Milestone titles with "/" are split into folder segments + milestone leaf
 * - If issue has a milestone but folder path doesn't start with that milestone's
 *   full title → conflict → ignore folder label
 *
 * Examples:
 *   Milestone "小活動範本/生日" + folder::小活動範本/生日/taskgroup
 *   → folder "小活動範本" > milestone "生日" > folder "taskgroup" > issue
 *
 *   No milestone + folder::groupA/groupB
 *   → folder "groupA" > folder "groupB" > issue
 */

import type { ITask } from '@svar-ui/gantt-store';
import { createMilestoneTaskId, isMilestoneTask } from './MilestoneIdUtils';
import { compareMilestones, compareByDisplayOrder } from './TaskSortUtils';

const FOLDER_LABEL_PREFIX = 'folder::';
const FOLDER_ID_PREFIX = 'f-';

/**
 * Parse folder label from a comma-separated labels string.
 * Returns the path segments array, or null if no folder label found.
 *
 * @example
 * parseFolderLabel("bug, folder::小活動範本/生日/taskgroup, urgent")
 * // → ["小活動範本", "生日", "taskgroup"]
 */
export function parseFolderLabel(labels: string): string[] | null {
  if (!labels) return null;

  const labelList = labels.split(',').map((l) => l.trim());
  const folderLabel = labelList.find((l) => l.startsWith(FOLDER_LABEL_PREFIX));

  if (!folderLabel) return null;

  const path = folderLabel.slice(FOLDER_LABEL_PREFIX.length);
  if (!path) return null;

  const segments = path.split('/').filter((s) => s.length > 0);
  return segments.length > 0 ? segments : null;
}

/**
 * Create a deterministic folder task ID from path segments.
 * Format: "f-segment1/segment2"
 *
 * @example
 * createFolderTaskId(["小活動範本", "taskgroup"]) // → "f-小活動範本/taskgroup"
 */
export function createFolderTaskId(pathSegments: string[]): string {
  return `${FOLDER_ID_PREFIX}${pathSegments.join('/')}`;
}

/**
 * Check if a task ID is a folder ID.
 */
export function isFolderTaskId(id: number | string): boolean {
  return typeof id === 'string' && id.startsWith(FOLDER_ID_PREFIX);
}

/**
 * Check if an ITask is a folder node.
 * Use this instead of repeating `task.$isFolder || task._gitlab?.type === 'folder'` everywhere.
 */
export function isFolderTask(task: ITask): boolean {
  return !!(task.$isFolder || task._gitlab?.type === 'folder');
}

/**
 * Create a virtual folder node for the Gantt chart.
 * Folder nodes have no time bar and act as expandable parent rows.
 */
function createFolderNode(
  folderPath: string[],
  parentId: number | string,
): ITask {
  const segmentName = folderPath[folderPath.length - 1];

  return {
    id: createFolderTaskId(folderPath),
    text: segmentName,
    start: new Date(),
    end: undefined,
    duration: 0,
    type: 'task', // Use 'task' type like milestones do
    parent: parentId,
    progress: 0,
    labels: '',
    displayOrder: 0,
    issueId: 0,
    iteration: '',
    epic: '',
    assigned: '',
    weight: 0,
    $isFolder: true,
    _gitlab: {
      type: 'folder',
    },
  };
}

/**
 * Find the longest prefix of folder path segments that matches a milestone title.
 *
 * Since milestone titles can contain "/" (e.g., "小活動範本/生日"),
 * we try joining progressively more segments and check against milestone titles.
 * We return the longest match to handle nested milestone names.
 *
 * @example
 * segments = ["小活動範本", "生日", "taskgroup"]
 * milestones = { "小活動範本/生日": "m-58" }
 * // → { matchedSegments: 2, milestoneId: "m-58" }
 */
function findLongestMilestoneMatch(
  segments: string[],
  milestoneTitleToId: Map<string, string>,
): { matchedSegments: number; milestoneId: string } | null {
  let bestMatch: { matchedSegments: number; milestoneId: string } | null = null;

  // Try joining 1 segment, 2 segments, etc. and check each as a milestone title
  for (let i = 1; i <= segments.length; i++) {
    const candidateTitle = segments.slice(0, i).join('/');
    const milestoneId = milestoneTitleToId.get(candidateTitle);
    if (milestoneId) {
      bestMatch = { matchedSegments: i, milestoneId };
      // Don't break — keep looking for longer matches
    }
  }

  return bestMatch;
}

/**
 * Build folder tree structure from folder:: labels on issues,
 * AND re-parent milestones whose titles contain "/" into folder nodes.
 *
 * This function:
 * 1. Scans milestone titles for "/" and re-parents them under folder nodes
 * 2. Parses folder labels from Issue tasks
 * 3. Finds the longest milestone title match in the folder path
 * 4. Creates virtual folder nodes for non-milestone path segments
 * 5. Re-parents issues under the deepest folder/milestone node
 *
 * @param tasks - All tasks (milestones + work items)
 * @param milestoneTasks - Only milestone tasks (for title matching)
 * @returns Modified tasks array and new folder nodes
 */
export function buildFolderTree(
  tasks: ITask[],
  milestoneTasks: ITask[],
): { tasks: ITask[]; folderNodes: ITask[] } {
  // Build milestone title → task ID map for matching
  const milestoneTitleToId = new Map<string, string>();
  for (const mt of milestoneTasks) {
    if (mt._gitlab?.type === 'milestone' && mt.text) {
      milestoneTitleToId.set(mt.text, mt.id as string);
    }
  }

  // Map to deduplicate folder nodes (keyed by folder ID)
  const folderNodeMap = new Map<string, ITask>();

  // Set of milestone IDs that need re-parenting (their title contains "/")
  const milestoneReparentMap = new Map<string, number | string>();

  // --- Phase 1: Re-parent milestones whose titles contain "/" ---
  // e.g., milestone "小活動範本/生日" → folder "小活動範本" > milestone "生日"
  for (const mt of milestoneTasks) {
    if (mt._gitlab?.type !== 'milestone' || !mt.text) continue;

    const titleSegments = mt.text
      .split('/')
      .filter((s: string) => s.length > 0);
    if (titleSegments.length <= 1) continue; // No "/" in title, skip

    // Build folder nodes for all segments except the last (which is the milestone itself)
    let currentParent: number | string = 0;
    const processedPath: string[] = [];

    for (let i = 0; i < titleSegments.length - 1; i++) {
      processedPath.push(titleSegments[i]);
      const folderId = createFolderTaskId(processedPath);

      if (!folderNodeMap.has(folderId)) {
        folderNodeMap.set(
          folderId,
          createFolderNode(processedPath, currentParent),
        );
      }

      currentParent = folderId;
    }

    // Record that this milestone should be re-parented under the deepest folder
    milestoneReparentMap.set(mt.id as string, currentParent);
  }

  // --- Phase 2: Process issue folder labels ---
  const modifiedTasks = tasks.map((task) => {
    // Re-parent milestones from Phase 1
    if (task._gitlab?.type === 'milestone') {
      const newParent = milestoneReparentMap.get(task.id as string);
      if (newParent !== undefined) {
        return { ...task, parent: newParent };
      }
      return task;
    }

    // Skip folder nodes (shouldn't exist yet, but safety)
    if (task._gitlab?.type === 'folder') return task;

    // Only process GitLab Issues (not Tasks)
    if (!task.$isIssue) return task;

    // Parse folder label
    const segments = parseFolderLabel(task.labels as string);
    if (!segments) return task;

    // Conflict check: if issue has a milestone assigned, the folder path
    // must start with that milestone's full title.
    // Milestone title may contain "/" (e.g., "小活動範本/生日"), so we compare
    // the folder path prefix (joined with "/") against the full milestone title.
    const issueMilestoneTitle = task._gitlab?.milestoneTitle;
    if (issueMilestoneTitle) {
      const msSegments = issueMilestoneTitle
        .split('/')
        .filter((s: string) => s.length > 0);
      // Check that folder path starts with all segments of the milestone title
      const pathPrefix = segments.slice(0, msSegments.length).join('/');
      if (pathPrefix !== issueMilestoneTitle) {
        // Conflict: folder path doesn't start with the issue's milestone title
        // Keep issue under its milestone as-is
        return task;
      }
    }

    // Find the longest prefix of the folder path that matches a milestone title
    const milestoneMatch = findLongestMilestoneMatch(
      segments,
      milestoneTitleToId,
    );

    // Determine where folder creation starts:
    // - If milestone matches, start after the matched segments (milestone is the parent)
    // - Otherwise, start from segment 0 (root is the parent)
    let currentParent: number | string = milestoneMatch
      ? milestoneMatch.milestoneId
      : 0;
    const startIdx = milestoneMatch ? milestoneMatch.matchedSegments : 0;
    const processedPath = segments.slice(0, startIdx);

    // Create folder nodes for remaining segments
    for (let i = startIdx; i < segments.length; i++) {
      processedPath.push(segments[i]);
      const folderId = createFolderTaskId(processedPath);

      if (!folderNodeMap.has(folderId)) {
        folderNodeMap.set(
          folderId,
          createFolderNode(processedPath, currentParent),
        );
      }

      currentParent = folderId;
    }

    // Re-parent the issue under the deepest node
    return { ...task, parent: currentParent };
  });

  return {
    tasks: modifiedTasks,
    folderNodes: Array.from(folderNodeMap.values()),
  };
}

/**
 * Strip folder nodes and restore original parent references.
 * Used when the "Show Folders" display toggle is OFF.
 *
 * Restoration logic:
 * - Milestones: restore parent to 0 (root) — Phase 1 of buildFolderTree moved them under folders
 * - Issues: restore parent to milestone (m-{iid}) or root (0) — _gitlab.milestoneIid is preserved
 * - GitLab Tasks: never re-parented by buildFolderTree, no change needed
 * - Folders: removed entirely
 */
export function stripFolderNodes(tasks: ITask[]): ITask[] {
  // Collect all folder node IDs for quick lookup
  const folderIds = new Set<string | number>();
  for (const task of tasks) {
    if (isFolderTask(task)) {
      folderIds.add(task.id);
    }
  }

  // Fast path: no folders to strip
  if (folderIds.size === 0) return tasks;

  // Remove folder nodes and restore parent references for orphaned children
  const restored = tasks
    .filter((task) => !isFolderTask(task))
    .map((task) => {
      // If task's parent is not a folder, no change needed
      if (!folderIds.has(task.parent as string | number)) {
        return task;
      }

      // Task's parent is a folder — restore original parent
      if (isMilestoneTask(task)) {
        // Milestones were at root (parent: 0) before buildFolderTree Phase 1
        return { ...task, parent: 0 };
      }

      if (task.$isIssue) {
        // Issues: restore to milestone parent or root
        const milestoneIid = task._gitlab?.milestoneIid;
        if (milestoneIid) {
          return { ...task, parent: createMilestoneTaskId(milestoneIid) };
        }
        return { ...task, parent: 0 };
      }

      // Defensive fallback for any other task type
      return { ...task, parent: 0 };
    });

  // Re-sort by parent group to maintain milestones-first ordering.
  // Without this, milestones moved from folder children back to root
  // keep their old array position and end up after issues.
  const tasksByParent = new Map<number | string, ITask[]>();
  for (const task of restored) {
    const pid = task.parent || 0;
    if (!tasksByParent.has(pid)) tasksByParent.set(pid, []);
    tasksByParent.get(pid)!.push(task);
  }

  const sorted: ITask[] = [];
  tasksByParent.forEach((group) => {
    const milestones = group.filter((t) => isMilestoneTask(t));
    const others = group.filter((t) => !isMilestoneTask(t));

    milestones.sort(compareMilestones);
    others.sort(compareByDisplayOrder);

    sorted.push(...milestones, ...others);
  });

  return sorted;
}
