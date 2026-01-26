/**
 * Sync Progress Types
 * Provides detailed progress information during GitLab data synchronization
 */

/**
 * Resource types being synced
 */
export type SyncResourceType =
  | 'workItems' // Main work items (issues/tasks)
  | 'milestones' // GitLab milestones
  | 'issues' // Issues query (for relativePosition)
  | 'members' // Project/group members
  | 'labels' // Labels (REST API)
  | 'hierarchy'; // Group fallback: fetching work item hierarchy

/**
 * Sync progress information
 */
export interface SyncProgress {
  /** Current resource being fetched */
  resource: SyncResourceType;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total pages if known */
  totalPages?: number;
  /** Number of items fetched so far */
  itemsFetched: number;
  /** Human-readable progress message */
  message: string;
}

/**
 * Progress callback function type
 */
export type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Display names for each resource type
 */
const RESOURCE_DISPLAY_NAMES: Record<SyncResourceType, string> = {
  workItems: 'Issues',
  milestones: 'Milestones',
  issues: 'Issues',
  members: 'Members',
  labels: 'Labels',
  hierarchy: 'Hierarchy',
};

/**
 * Helper function to create progress message
 */
export function createProgressMessage(
  resource: SyncResourceType,
  currentPage: number,
  totalPages?: number,
): string {
  const resourceName = RESOURCE_DISPLAY_NAMES[resource];

  if (totalPages && totalPages > 1) {
    return `Fetching ${resourceName} (page ${currentPage}/${totalPages})...`;
  } else if (currentPage > 1) {
    return `Fetching ${resourceName} (page ${currentPage})...`;
  } else {
    return `Fetching ${resourceName}...`;
  }
}

/**
 * Check if request has been aborted and throw AbortError if so.
 * Use this before each network request in pagination loops.
 */
export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

/**
 * Helper to report sync progress.
 * Creates a SyncProgress object and calls the callback if provided.
 */
export function reportProgress(
  onProgress: SyncProgressCallback | undefined,
  resource: SyncResourceType,
  currentPage: number,
  itemsFetched: number,
  totalPages?: number,
  customMessage?: string,
): void {
  if (!onProgress) return;

  onProgress({
    resource,
    currentPage,
    totalPages,
    itemsFetched,
    message:
      customMessage ?? createProgressMessage(resource, currentPage, totalPages),
  });
}
