/**
 * MilestoneIdUtils Tests
 * Tests for milestone ID format conversion and migration
 */

import { describe, it, expect } from 'vitest';
import {
  createMilestoneTaskId,
  isMilestoneTaskId,
  extractMilestoneIid,
  migrateLegacyMilestoneId,
  isLegacyMilestoneId,
} from '../MilestoneIdUtils';

describe('MilestoneIdUtils', () => {
  describe('createMilestoneTaskId', () => {
    it('should create milestone ID from numeric IID', () => {
      const id = createMilestoneTaskId(1);
      expect(id).toBe('m-1');
    });

    it('should create milestone ID from string IID', () => {
      const id = createMilestoneTaskId('42');
      expect(id).toBe('m-42');
    });

    it('should handle large IID values', () => {
      const id = createMilestoneTaskId(99999);
      expect(id).toBe('m-99999');
    });

    it('should create ID from zero', () => {
      const id = createMilestoneTaskId(0);
      expect(id).toBe('m-0');
    });
  });

  describe('isMilestoneTaskId', () => {
    it('should detect valid milestone ID', () => {
      expect(isMilestoneTaskId('m-1')).toBe(true);
      expect(isMilestoneTaskId('m-42')).toBe(true);
      expect(isMilestoneTaskId('m-0')).toBe(true);
    });

    it('should reject numeric IDs', () => {
      expect(isMilestoneTaskId(1)).toBe(false);
      expect(isMilestoneTaskId(10000)).toBe(false);
    });

    it('should reject non-milestone string IDs', () => {
      expect(isMilestoneTaskId('1')).toBe(false);
      expect(isMilestoneTaskId('issue-1')).toBe(false);
      expect(isMilestoneTaskId('m')).toBe(false);
    });

    it('should reject IDs with wrong prefix', () => {
      expect(isMilestoneTaskId('M-1')).toBe(false);
      expect(isMilestoneTaskId('milestone-1')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isMilestoneTaskId('')).toBe(false);
    });
  });

  describe('extractMilestoneIid', () => {
    it('should extract IID from milestone ID', () => {
      expect(extractMilestoneIid('m-1')).toBe(1);
      expect(extractMilestoneIid('m-42')).toBe(42);
      expect(extractMilestoneIid('m-0')).toBe(0);
    });

    it('should extract large IID values', () => {
      expect(extractMilestoneIid('m-99999')).toBe(99999);
    });

    it('should return null for non-milestone ID', () => {
      expect(extractMilestoneIid('1')).toBeNull();
      expect(extractMilestoneIid('issue-1')).toBeNull();
      expect(extractMilestoneIid('M-1')).toBeNull();
    });

    it('should return null for numeric ID', () => {
      expect(extractMilestoneIid(1)).toBeNull();
      expect(extractMilestoneIid(10000)).toBeNull();
    });

    it('should return null for invalid milestone ID', () => {
      expect(extractMilestoneIid('m-abc')).toBeNull();
      expect(extractMilestoneIid('m-')).toBeNull();
      expect(extractMilestoneIid('m')).toBeNull();
    });
  });

  describe('migrateLegacyMilestoneId', () => {
    it('should convert legacy numeric ID to new format', () => {
      expect(migrateLegacyMilestoneId(10001)).toBe('m-1');
      expect(migrateLegacyMilestoneId(10042)).toBe('m-42');
      expect(migrateLegacyMilestoneId(10000)).toBe('m-0');
    });

    it('should convert legacy string numeric ID to new format', () => {
      expect(migrateLegacyMilestoneId('10001')).toBe('m-1');
      expect(migrateLegacyMilestoneId('10042')).toBe('m-42');
    });

    it('should not convert numeric IDs < 10000', () => {
      expect(migrateLegacyMilestoneId(1)).toBe(1);
      expect(migrateLegacyMilestoneId(9999)).toBe(9999);
    });

    it('should not convert string IDs < 10000', () => {
      expect(migrateLegacyMilestoneId('1')).toBe('1');
      expect(migrateLegacyMilestoneId('9999')).toBe('9999');
    });

    it('should not convert already migrated IDs', () => {
      expect(migrateLegacyMilestoneId('m-1')).toBe('m-1');
      expect(migrateLegacyMilestoneId('m-42')).toBe('m-42');
    });

    it('should not convert non-numeric strings', () => {
      expect(migrateLegacyMilestoneId('issue-10001')).toBe('issue-10001');
      expect(migrateLegacyMilestoneId('abc')).toBe('abc');
    });

    it('should preserve zero ID', () => {
      const result = migrateLegacyMilestoneId(10000);
      expect(result).toBe('m-0');
    });
  });

  describe('isLegacyMilestoneId', () => {
    it('should detect legacy numeric milestone IDs', () => {
      expect(isLegacyMilestoneId(10000)).toBe(true);
      expect(isLegacyMilestoneId(10001)).toBe(true);
      expect(isLegacyMilestoneId(99999)).toBe(true);
    });

    it('should detect legacy string numeric milestone IDs', () => {
      expect(isLegacyMilestoneId('10000')).toBe(true);
      expect(isLegacyMilestoneId('10001')).toBe(true);
      expect(isLegacyMilestoneId('99999')).toBe(true);
    });

    it('should not detect non-legacy numeric IDs', () => {
      expect(isLegacyMilestoneId(1)).toBe(false);
      expect(isLegacyMilestoneId(9999)).toBe(false);
    });

    it('should not detect non-legacy string numeric IDs', () => {
      expect(isLegacyMilestoneId('1')).toBe(false);
      expect(isLegacyMilestoneId('9999')).toBe(false);
    });

    it('should not detect new format milestone IDs', () => {
      expect(isLegacyMilestoneId('m-1')).toBe(false);
      expect(isLegacyMilestoneId('m-10000')).toBe(false);
    });

    it('should not detect non-numeric strings', () => {
      expect(isLegacyMilestoneId('abc')).toBe(false);
      expect(isLegacyMilestoneId('10001abc')).toBe(false);
      expect(isLegacyMilestoneId('issue-1')).toBe(false);
    });

    it('should not detect empty strings', () => {
      expect(isLegacyMilestoneId('')).toBe(false);
    });
  });
});
