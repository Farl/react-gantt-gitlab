/**
 * LinkUtils Tests
 * Tests for link utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getSourceUrl,
  isMilestoneTask,
  getLinkInfo,
  openSourceLink,
  // Deprecated re-exports (backward compatibility)
  getGitLabUrl,
  getGitLabLinkInfo,
  openGitLabLink,
} from '../LinkUtils';
import type { ITask } from '@svar-ui/gantt-store';

describe('LinkUtils', () => {
  describe('getSourceUrl', () => {
    it('should return web_url from _gitlab metadata', () => {
      const task = {
        id: 1,
        _gitlab: { web_url: 'https://gitlab.com/project/issues/1' },
      } as ITask;

      const url = getSourceUrl(task);
      expect(url).toBe('https://gitlab.com/project/issues/1');
    });

    it('should return web_url from direct property', () => {
      const task = {
        id: 1,
        web_url: 'https://gitlab.com/project/issues/2',
      } as ITask;

      const url = getSourceUrl(task);
      expect(url).toBe('https://gitlab.com/project/issues/2');
    });

    it('should prioritize _gitlab.web_url over direct web_url', () => {
      const task = {
        id: 1,
        _gitlab: { web_url: 'https://gitlab.com/project/issues/1' },
        web_url: 'https://gitlab.com/project/issues/2',
      } as ITask;

      const url = getSourceUrl(task);
      expect(url).toBe('https://gitlab.com/project/issues/1');
    });

    it('should return null for task without URL', () => {
      const task = { id: 1 } as ITask;
      expect(getSourceUrl(task)).toBeNull();
    });

    it('should return null for null task', () => {
      expect(getSourceUrl(null)).toBeNull();
    });

    it('should return null for undefined task', () => {
      expect(getSourceUrl(undefined)).toBeNull();
    });
  });

  describe('isMilestoneTask', () => {
    it('should detect milestone from $isMilestone flag', () => {
      const task = { id: 1, $isMilestone: true } as ITask;
      expect(isMilestoneTask(task)).toBe(true);
    });

    it('should detect milestone from _gitlab.type', () => {
      const task = { id: 1, _gitlab: { type: 'milestone' } } as ITask;
      expect(isMilestoneTask(task)).toBe(true);
    });

    it('should return false for non-milestone tasks', () => {
      const task = { id: 1, title: 'Issue' } as ITask;
      expect(isMilestoneTask(task)).toBe(false);
    });

    it('should return false for null task', () => {
      expect(isMilestoneTask(null)).toBe(false);
    });

    it('should return false for undefined task', () => {
      expect(isMilestoneTask(undefined)).toBe(false);
    });
  });

  describe('getLinkInfo', () => {
    it('should return milestone link info', () => {
      const task = {
        id: 'm-1',
        _gitlab: {
          id: 1,
          type: 'milestone',
          web_url: 'https://gitlab.com/project/-/milestones/1',
        },
      } as ITask;

      const linkInfo = getLinkInfo(task);

      expect(linkInfo.url).toBe('https://gitlab.com/project/-/milestones/1');
      expect(linkInfo.displayId).toBe('M#1');
      expect(linkInfo.isMilestone).toBe(true);
      expect(linkInfo.title).toBe('Open milestone');
    });

    it('should return issue link info', () => {
      const task = {
        id: 1,
        issueId: 42,
        _gitlab: { web_url: 'https://gitlab.com/project/issues/42' },
      } as ITask;

      const linkInfo = getLinkInfo(task);

      expect(linkInfo.url).toBe('https://gitlab.com/project/issues/42');
      expect(linkInfo.displayId).toBe('#42');
      expect(linkInfo.isMilestone).toBe(false);
      expect(linkInfo.title).toBe('Open in source');
    });

    it('should handle task without URL', () => {
      const task = { id: 1, issueId: 42 } as ITask;

      const linkInfo = getLinkInfo(task);

      expect(linkInfo.url).toBeNull();
      expect(linkInfo.displayId).toBe('#42');
      expect(linkInfo.isMilestone).toBe(false);
    });

    it('should return empty info for null task', () => {
      const linkInfo = getLinkInfo(null);

      expect(linkInfo.url).toBeNull();
      expect(linkInfo.displayId).toBeNull();
      expect(linkInfo.title).toBe('');
      expect(linkInfo.isMilestone).toBe(false);
    });

    it('should handle milestone without ID', () => {
      const task = {
        id: 'm-unknown',
        _gitlab: { type: 'milestone' },
      } as ITask;

      const linkInfo = getLinkInfo(task);

      expect(linkInfo.displayId).toBeNull();
      expect(linkInfo.isMilestone).toBe(true);
    });
  });

  describe('openSourceLink', () => {
    it('should open URL in new tab', () => {
      const mockOpen = vi.fn();
      window.open = mockOpen;

      const task = {
        id: 1,
        _gitlab: { web_url: 'https://gitlab.com/project/issues/1' },
      } as ITask;

      const result = openSourceLink(task);

      expect(result).toBe(true);
      expect(mockOpen).toHaveBeenCalledWith(
        'https://gitlab.com/project/issues/1',
        '_blank',
      );
    });

    it('should return false when no URL available', () => {
      const mockOpen = vi.fn();
      window.open = mockOpen;

      const task = { id: 1 } as ITask;

      const result = openSourceLink(task);

      expect(result).toBe(false);
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('should return false for null task', () => {
      const mockOpen = vi.fn();
      window.open = mockOpen;

      const result = openSourceLink(null);

      expect(result).toBe(false);
      expect(mockOpen).not.toHaveBeenCalled();
    });
  });

  describe('deprecated re-exports', () => {
    it('getGitLabUrl should be an alias for getSourceUrl', () => {
      expect(getGitLabUrl).toBe(getSourceUrl);
    });

    it('getGitLabLinkInfo should be an alias for getLinkInfo', () => {
      expect(getGitLabLinkInfo).toBe(getLinkInfo);
    });

    it('openGitLabLink should be an alias for openSourceLink', () => {
      expect(openGitLabLink).toBe(openSourceLink);
    });
  });
});
