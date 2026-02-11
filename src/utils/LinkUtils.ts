/**
 * Link Utilities
 * Helper functions for data source URL handling and link display
 */

import type { ITask } from '@svar-ui/gantt-store';

export interface LinkInfo {
  url: string | null;
  displayId: string | null;
  title: string;
  isMilestone: boolean;
}

/**
 * Get web URL from a task
 * @param task - Gantt task with source metadata (can be null)
 * @returns The web URL or null
 */
export function getSourceUrl(task: ITask | null | undefined): string | null {
  if (!task) return null;
  return task.web_url || null;
}

/**
 * Check if a task is a milestone
 * @param task - Gantt task (can be null)
 * @returns true if task is a milestone
 */
export function isMilestoneTask(task: ITask | null | undefined): boolean {
  if (!task) return false;
  return task.$isMilestone || task.type === 'milestone';
}

/**
 * Extract link information from a task
 * @param task - Gantt task with source metadata (can be null)
 * @returns Link info including URL, display ID, and type
 */
export function getLinkInfo(task: ITask | null | undefined): LinkInfo {
  if (!task) {
    return { url: null, displayId: null, title: '', isMilestone: false };
  }

  const isMilestone = isMilestoneTask(task);
  const url = getSourceUrl(task);

  if (isMilestone) {
    const milestoneId = task.id;
    return {
      url,
      displayId: milestoneId ? `M#${milestoneId}` : null,
      title: 'Open milestone',
      isMilestone: true,
    };
  }

  return {
    url,
    displayId: task.issueId ? `#${task.issueId}` : null,
    title: 'Open in source',
    isMilestone: false,
  };
}

/**
 * Open source URL in new tab
 * @param task - Gantt task with source metadata (can be null)
 * @returns true if URL was opened, false otherwise
 */
export function openSourceLink(task: ITask | null | undefined): boolean {
  const url = getSourceUrl(task);
  if (url) {
    window.open(url, '_blank');
    return true;
  }
  return false;
}

// ============================================================================
// Link (Dependency) Utilities
// ============================================================================

export interface ILink {
  id: number | string;
  source: number | string;
  target: number | string;
  type?: string;
  metadata?: {
    apiSourceIid: number;
    linkedWorkItemGlobalId: string | undefined;
    /** Whether this is a native link (true) or description metadata link (false) */
    isNativeLink?: boolean;
    /** For metadata links: the relationship type */
    metadataRelation?: 'blocks' | 'blocked_by';
    /** For metadata links: the target IID of the related issue */
    metadataTargetIid?: number;
  };
}

export interface LinkValidationResult {
  valid: boolean;
  apiSourceIid?: number;
  linkedWorkItemGlobalId?: string;
  /** Whether this is a native link or metadata link */
  isNativeLink?: boolean;
  /** For metadata links: the relationship type */
  metadataRelation?: 'blocks' | 'blocked_by';
  /** For metadata links: the target IID */
  metadataTargetIid?: number;
  error?: string;
}

/**
 * Find a link by source and target IDs from a links array.
 * Handles bidirectional matching (source/target can be swapped).
 * Prefers links with metadata over local-only links.
 *
 * @param links - Array of link objects
 * @param sourceId - Source task ID
 * @param targetId - Target task ID
 * @returns The matching link object, or null if not found
 */
export function findLinkBySourceTarget(
  links: ILink[] | null | undefined,
  sourceId: number | string | null | undefined,
  targetId: number | string | null | undefined,
): ILink | null {
  if (!links || !sourceId || !targetId) return null;

  const matchingLinks = links.filter(
    (l) =>
      (l.source === sourceId && l.target === targetId) ||
      (l.source === targetId && l.target === sourceId),
  );

  // Prefer link with metadata (synced from API), fall back to any match
  return matchingLinks.find((l) => l.metadata) || matchingLinks[0] || null;
}

/**
 * Validate that a link has the required metadata for API operations.
 *
 * Supports both native links and description metadata links:
 * - Native links: require apiSourceIid and linkedWorkItemGlobalId
 * - Metadata links: require apiSourceIid, metadataRelation, and metadataTargetIid
 *
 * @param link - Link object to validate
 * @returns Validation result with metadata if valid, error message if not
 */
export function validateLinkMetadata(
  link: ILink | null | undefined,
): LinkValidationResult {
  if (!link) {
    return { valid: false, error: 'Link is null or undefined' };
  }

  if (!link.metadata) {
    return {
      valid: false,
      error: 'Link missing metadata - may be newly created and not yet synced',
    };
  }

  const {
    apiSourceIid,
    linkedWorkItemGlobalId,
    isNativeLink,
    metadataRelation,
    metadataTargetIid,
  } = link.metadata;

  // Check if we have apiSourceIid (required for both link types)
  if (!apiSourceIid) {
    return {
      valid: false,
      error:
        'Cannot delete link: missing apiSourceIid. ' +
        'Please refresh the page to reload links with proper metadata.',
    };
  }

  // Determine link type and validate accordingly
  const effectiveIsNativeLink = isNativeLink ?? !!linkedWorkItemGlobalId;

  if (effectiveIsNativeLink) {
    // Native link validation
    if (!linkedWorkItemGlobalId) {
      return {
        valid: false,
        error:
          'Cannot delete native link: missing linkedWorkItemGlobalId. ' +
          'Please refresh the page to reload links with proper metadata.',
      };
    }
    return {
      valid: true,
      apiSourceIid,
      linkedWorkItemGlobalId,
      isNativeLink: true,
    };
  } else {
    // Metadata link validation
    if (metadataRelation === undefined || metadataTargetIid === undefined) {
      return {
        valid: false,
        error:
          'Cannot delete metadata link: missing metadataRelation or metadataTargetIid. ' +
          'Please refresh the page to reload links with proper metadata.',
      };
    }
    return {
      valid: true,
      apiSourceIid,
      isNativeLink: false,
      metadataRelation,
      metadataTargetIid,
    };
  }
}
