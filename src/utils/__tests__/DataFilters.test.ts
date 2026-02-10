/**
 * DataFilters Utility Tests
 * Tests for data filtering and aggregation functions
 */

import { describe, it, expect } from 'vitest';
import { DataFilters } from '../DataFilters';
import type { ITask } from '@svar-ui/gantt-store';

describe('DataFilters', () => {
  const mockTasks: ITask[] = [
    {
      id: 1,
      title: 'Task 1',
      labels: 'bug,urgent',
      start: new Date('2024-01-01'),
      end: new Date('2024-01-05'),
    } as ITask,
    {
      id: 2,
      title: 'Task 2',
      labels: 'feature',
      start: new Date('2024-01-10'),
      end: new Date('2024-01-15'),
    } as ITask,
    {
      id: 3,
      title: 'Task 3',
      labels: '',
      start: new Date('2024-01-20'),
      end: new Date('2024-01-25'),
    } as ITask,
  ];

  describe('filterByLabels', () => {
    it('should filter tasks by single label', () => {
      const result = DataFilters.filterByLabels(mockTasks, ['bug']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should filter tasks by multiple labels (OR)', () => {
      const result = DataFilters.filterByLabels(mockTasks, ['bug', 'feature']);
      expect(result).toHaveLength(2);
    });

    it('should include tasks without labels when NONE is selected', () => {
      const result = DataFilters.filterByLabels(mockTasks, ['NONE']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('should return all tasks when no labels are specified', () => {
      const result = DataFilters.filterByLabels(mockTasks, []);
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getUniqueLabels', () => {
    it('should extract unique labels from tasks', () => {
      const labels = DataFilters.getUniqueLabels(mockTasks);
      expect(labels).toContain('bug');
      expect(labels).toContain('urgent');
      expect(labels).toContain('feature');
    });

    it('should handle tasks with empty labels', () => {
      const labels = DataFilters.getUniqueLabels(mockTasks);
      expect(labels).toBeDefined();
      expect(Array.isArray(labels)).toBe(true);
    });
  });

  describe('getUniqueAssignees', () => {
    it('should extract unique assignees from tasks', () => {
      const tasksWithAssignees: ITask[] = [
        {
          ...mockTasks[0],
          assigned: 'alice, bob',
        } as ITask,
        {
          ...mockTasks[1],
          assigned: 'bob',
        } as ITask,
      ];

      const assignees = DataFilters.getUniqueAssignees(tasksWithAssignees);
      expect(assignees).toContain('alice');
      expect(assignees).toContain('bob');
    });

    it('should handle tasks without assignees', () => {
      const assignees = DataFilters.getUniqueAssignees(mockTasks);
      expect(Array.isArray(assignees)).toBe(true);
    });
  });

  describe('applyFilters', () => {
    it('should apply multiple filters correctly', () => {
      const filterOptions = {
        labels: ['bug'],
      };

      const result = DataFilters.applyFilters(mockTasks, filterOptions);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].labels).toContain('bug');
    });

    it('should return all tasks when no filters applied', () => {
      const result = DataFilters.applyFilters(mockTasks, {});
      expect(result).toEqual(mockTasks);
    });
  });
});
