/**
 * WorkloadUtils Tests
 * Comprehensive tests for workload view utility functions:
 * - generateWorkloadTasks: grouping by assignee/label, filtering, structure
 * - assignTasksToRows (tested indirectly through generateWorkloadTasks)
 * - findOriginalTask: direct ID match, workload ID extraction
 * - getUniqueAssignees / getUniqueLabels: extraction and deduplication
 */

import { describe, it, expect } from 'vitest';
import {
  generateWorkloadTasks,
  getUniqueAssignees,
  getUniqueLabels,
  findOriginalTask,
} from '../WorkloadUtils';
import type { ITask } from '@svar-ui/gantt-store';

// ============================================================================
// Test Helpers
// ============================================================================

function makeTask(overrides: Partial<ITask> & { id: number }): ITask {
  return {
    text: `Task ${overrides.id}`,
    start: new Date('2024-03-01'),
    end: new Date('2024-03-05'),
    type: 'task',
    parent: 0,
    ...overrides,
  } as ITask;
}

// ============================================================================
// generateWorkloadTasks
// ============================================================================

describe('generateWorkloadTasks', () => {
  describe('filtering', () => {
    it('should filter out milestone tasks', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice', $isMilestone: true }),
        makeTask({ id: 2, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      // Only the non-milestone task should appear as an actual task child
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].$originalId).toBe(2);
    });

    it('should filter out tasks with _gitlab.type milestone', () => {
      const tasks: ITask[] = [
        makeTask({
          id: 1,
          assigned: 'Alice',
          _gitlab: { type: 'milestone' },
        }),
        makeTask({ id: 2, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].$originalId).toBe(2);
    });

    it('should filter out summary tasks', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice', type: 'summary' }),
        makeTask({ id: 2, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].$originalId).toBe(2);
    });

    it('should filter out tasks without a start date', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice', start: undefined }),
        makeTask({ id: 2, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].$originalId).toBe(2);
    });
  });

  describe('assignee groups', () => {
    it('should create a group header for each selected assignee', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice' }),
        makeTask({ id: 2, assigned: 'Bob' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice', 'Bob'], []);
      const groups = result.filter((t) => t.$isWorkloadGroup);
      expect(groups).toHaveLength(2);
      expect(groups[0].text).toBe('Alice');
      expect(groups[0].$groupType).toBe('assignee');
      expect(groups[1].text).toBe('Bob');
      expect(groups[1].$groupType).toBe('assignee');
    });

    it('should assign tasks to the correct assignee group', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice' }),
        makeTask({ id: 2, assigned: 'Bob' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice', 'Bob'], []);
      const aliceGroup = result.find(
        (t) => t.$isWorkloadGroup && t.text === 'Alice',
      );
      // Find work tasks under Alice's group
      const aliceRows = result.filter(
        (t) => t.$isWorkloadRow && t.$workloadGroupId === aliceGroup!.id,
      );
      const aliceTasks = result.filter(
        (t) =>
          !t.$isWorkloadGroup &&
          !t.$isWorkloadRow &&
          t.$workloadGroupId === aliceGroup!.id,
      );
      expect(aliceTasks).toHaveLength(1);
      expect(aliceTasks[0].$originalId).toBe(1);
    });

    it('should handle comma-separated assignees', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice, Bob' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice', 'Bob'], []);
      // Task should appear in both Alice and Bob groups
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(2);
      expect(workTasks[0].$originalId).toBe(1);
      expect(workTasks[1].$originalId).toBe(1);
    });

    it('should show empty row indicator when assignee has no tasks', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice', 'Bob'], []);
      // Bob has no tasks, should get a "(No tasks)" placeholder
      const bobGroup = result.find(
        (t) => t.$isWorkloadGroup && t.text === 'Bob',
      );
      const bobChildren = result.filter(
        (t) =>
          !t.$isWorkloadGroup &&
          t.$workloadGroupId === bobGroup!.id,
      );
      expect(bobChildren).toHaveLength(1);
      expect(bobChildren[0].text).toBe('(No tasks)');
      expect(bobChildren[0].$isWorkloadRow).toBe(true);
    });
  });

  describe('label groups', () => {
    it('should create a group header for each selected label', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, labels: 'bug' }),
        makeTask({ id: 2, labels: 'feature' }),
      ];

      const result = generateWorkloadTasks(tasks, [], ['bug', 'feature']);
      const groups = result.filter((t) => t.$isWorkloadGroup);
      expect(groups).toHaveLength(2);
      expect(groups[0].text).toBe('bug');
      expect(groups[0].$groupType).toBe('label');
      expect(groups[1].text).toBe('feature');
      expect(groups[1].$groupType).toBe('label');
    });

    it('should handle array-type labels', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, labels: ['bug', 'urgent'] }),
      ];

      const result = generateWorkloadTasks(tasks, [], ['bug']);
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].$originalId).toBe(1);
    });

    it('should show empty row indicator when label has no tasks', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, labels: 'bug' }),
      ];

      const result = generateWorkloadTasks(tasks, [], ['bug', 'feature']);
      const featureGroup = result.find(
        (t) => t.$isWorkloadGroup && t.text === 'feature',
      );
      const featureChildren = result.filter(
        (t) =>
          !t.$isWorkloadGroup &&
          t.$workloadGroupId === featureGroup!.id,
      );
      expect(featureChildren).toHaveLength(1);
      expect(featureChildren[0].text).toBe('(No tasks)');
    });
  });

  describe('unique IDs', () => {
    it('should generate unique IDs for all workload items', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice' }),
        makeTask({ id: 2, assigned: 'Alice' }),
        makeTask({ id: 3, assigned: 'Bob', labels: 'bug' }),
      ];

      const result = generateWorkloadTasks(
        tasks,
        ['Alice', 'Bob'],
        ['bug'],
      );
      const ids = result.map((t) => String(t.id));
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should create workload task IDs in wl-{groupId}-{originalId}-{idx} format', () => {
      const tasks: ITask[] = [
        makeTask({ id: 42, assigned: 'Alice' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTask = result.find(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTask).toBeDefined();
      const idStr = String(workTask!.id);
      expect(idStr).toMatch(/^wl-\d+-42-\d+$/);
    });
  });

  describe('group headers', () => {
    it('should set group headers as summary type with open: true', () => {
      const tasks: ITask[] = [makeTask({ id: 1, assigned: 'Alice' })];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const group = result.find((t) => t.$isWorkloadGroup);
      expect(group).toBeDefined();
      expect(group!.type).toBe('summary');
      expect(group!.open).toBe(true);
      expect(group!.parent).toBe(0);
    });

    it('should include $rowCount on group headers', () => {
      const tasks: ITask[] = [
        makeTask({
          id: 1,
          assigned: 'Alice',
          start: new Date('2024-03-01'),
          end: new Date('2024-03-10'),
        }),
        makeTask({
          id: 2,
          assigned: 'Alice',
          start: new Date('2024-03-05'),
          end: new Date('2024-03-15'),
        }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const group = result.find((t) => t.$isWorkloadGroup);
      // Two overlapping tasks should require 2 rows
      expect(group!.$rowCount).toBe(2);
    });
  });

  describe('row summaries', () => {
    it('should create row summaries as children of group headers', () => {
      const tasks: ITask[] = [makeTask({ id: 1, assigned: 'Alice' })];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const group = result.find((t) => t.$isWorkloadGroup);
      const rows = result.filter(
        (t) => t.$isWorkloadRow && t.parent === group!.id,
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].type).toBe('summary');
      expect(rows[0].$workloadGroupId).toBe(group!.id);
    });
  });

  describe('task assignment to rows based on overlap', () => {
    it('should place non-overlapping tasks in the same row', () => {
      const tasks: ITask[] = [
        makeTask({
          id: 1,
          assigned: 'Alice',
          start: new Date('2024-03-01'),
          end: new Date('2024-03-05'),
        }),
        makeTask({
          id: 2,
          assigned: 'Alice',
          start: new Date('2024-03-06'),
          end: new Date('2024-03-10'),
        }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const group = result.find((t) => t.$isWorkloadGroup);
      // Non-overlapping tasks should fit in 1 row
      expect(group!.$rowCount).toBe(1);
    });

    it('should place overlapping tasks in different rows', () => {
      const tasks: ITask[] = [
        makeTask({
          id: 1,
          assigned: 'Alice',
          start: new Date('2024-03-01'),
          end: new Date('2024-03-10'),
        }),
        makeTask({
          id: 2,
          assigned: 'Alice',
          start: new Date('2024-03-05'),
          end: new Date('2024-03-15'),
        }),
        makeTask({
          id: 3,
          assigned: 'Alice',
          start: new Date('2024-03-08'),
          end: new Date('2024-03-20'),
        }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const group = result.find((t) => t.$isWorkloadGroup);
      // All three overlap, so need 3 rows
      expect(group!.$rowCount).toBe(3);
    });

    it('should handle tasks with string dates', () => {
      const tasks: ITask[] = [
        makeTask({
          id: 1,
          assigned: 'Alice',
          start: '2024-03-01' as unknown as Date,
          end: '2024-03-05' as unknown as Date,
        }),
        makeTask({
          id: 2,
          assigned: 'Alice',
          start: '2024-03-10' as unknown as Date,
          end: '2024-03-15' as unknown as Date,
        }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTasks = result.filter(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTasks).toHaveLength(2);
    });

    it('should force task type to "task" for workload items', () => {
      const tasks: ITask[] = [makeTask({ id: 1, assigned: 'Alice' })];

      const result = generateWorkloadTasks(tasks, ['Alice'], []);
      const workTask = result.find(
        (t) => !t.$isWorkloadGroup && !t.$isWorkloadRow,
      );
      expect(workTask!.type).toBe('task');
    });
  });

  describe('combined assignee and label groups', () => {
    it('should create both assignee and label groups', () => {
      const tasks: ITask[] = [
        makeTask({ id: 1, assigned: 'Alice', labels: 'bug' }),
      ];

      const result = generateWorkloadTasks(tasks, ['Alice'], ['bug']);
      const groups = result.filter((t) => t.$isWorkloadGroup);
      expect(groups).toHaveLength(2);
      expect(groups[0].$groupType).toBe('assignee');
      expect(groups[1].$groupType).toBe('label');
    });
  });

  describe('empty inputs', () => {
    it('should return empty array when no assignees or labels selected', () => {
      const tasks: ITask[] = [makeTask({ id: 1, assigned: 'Alice' })];
      const result = generateWorkloadTasks(tasks, [], []);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when tasks list is empty', () => {
      const result = generateWorkloadTasks([], ['Alice'], ['bug']);
      // Should still create groups with "(No tasks)" placeholders
      const groups = result.filter((t) => t.$isWorkloadGroup);
      expect(groups).toHaveLength(2);
      const placeholders = result.filter((t) => t.text === '(No tasks)');
      expect(placeholders).toHaveLength(2);
    });
  });
});

// ============================================================================
// findOriginalTask
// ============================================================================

describe('findOriginalTask', () => {
  const allTasks: ITask[] = [
    makeTask({ id: 1, text: 'First task' }),
    makeTask({ id: 2, text: 'Second task' }),
    makeTask({ id: 42, text: 'The answer' }),
  ];

  it('should find a task by direct numeric ID', () => {
    const found = findOriginalTask(1, allTasks);
    expect(found).not.toBeNull();
    expect(found!.text).toBe('First task');
  });

  it('should find a task by direct string ID', () => {
    const found = findOriginalTask('42', allTasks);
    expect(found).not.toBeNull();
    expect(found!.text).toBe('The answer');
  });

  it('should extract original ID from workload task ID format', () => {
    const found = findOriginalTask('wl-100000-2-0', allTasks);
    expect(found).not.toBeNull();
    expect(found!.text).toBe('Second task');
  });

  it('should return null for non-existent direct ID', () => {
    const found = findOriginalTask(999, allTasks);
    expect(found).toBeNull();
  });

  it('should return null for workload ID with non-existent original', () => {
    const found = findOriginalTask('wl-100000-999-0', allTasks);
    expect(found).toBeNull();
  });

  it('should return null for malformed workload ID (less than 4 parts)', () => {
    const found = findOriginalTask('wl-123', allTasks);
    expect(found).toBeNull();
  });

  it('should handle empty task list', () => {
    const found = findOriginalTask(1, []);
    expect(found).toBeNull();
  });
});

// ============================================================================
// getUniqueAssignees
// ============================================================================

describe('getUniqueAssignees', () => {
  it('should extract unique assignees from tasks', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, assigned: 'Alice' }),
      makeTask({ id: 2, assigned: 'Bob' }),
      makeTask({ id: 3, assigned: 'Alice' }),
    ];

    const result = getUniqueAssignees(tasks);
    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('should handle comma-separated assignees', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, assigned: 'Alice, Bob, Charlie' }),
    ];

    const result = getUniqueAssignees(tasks);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('should return sorted array', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, assigned: 'Charlie' }),
      makeTask({ id: 2, assigned: 'Alice' }),
      makeTask({ id: 3, assigned: 'Bob' }),
    ];

    const result = getUniqueAssignees(tasks);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('should handle tasks without assignees', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1 }),
      makeTask({ id: 2, assigned: '' }),
    ];

    const result = getUniqueAssignees(tasks);
    expect(result).toEqual([]);
  });

  it('should handle empty task list', () => {
    expect(getUniqueAssignees([])).toEqual([]);
  });
});

// ============================================================================
// getUniqueLabels
// ============================================================================

describe('getUniqueLabels', () => {
  it('should extract unique labels from string labels', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, labels: 'bug,feature' }),
      makeTask({ id: 2, labels: 'bug' }),
    ];

    const result = getUniqueLabels(tasks);
    expect(result).toEqual(['bug', 'feature']);
  });

  it('should extract unique labels from array labels', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, labels: ['bug', 'urgent'] }),
      makeTask({ id: 2, labels: ['feature'] }),
    ];

    const result = getUniqueLabels(tasks);
    expect(result).toEqual(['bug', 'feature', 'urgent']);
  });

  it('should return sorted array', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1, labels: 'zebra' }),
      makeTask({ id: 2, labels: 'alpha' }),
    ];

    const result = getUniqueLabels(tasks);
    expect(result).toEqual(['alpha', 'zebra']);
  });

  it('should handle tasks without labels', () => {
    const tasks: ITask[] = [
      makeTask({ id: 1 }),
      makeTask({ id: 2, labels: '' }),
    ];

    const result = getUniqueLabels(tasks);
    expect(result).toEqual([]);
  });

  it('should handle empty task list', () => {
    expect(getUniqueLabels([])).toEqual([]);
  });
});
