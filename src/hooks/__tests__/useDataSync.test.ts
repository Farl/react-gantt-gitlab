/**
 * useDataSync Hook Tests
 * Comprehensive tests for data synchronization hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataSync } from '../useDataSync';
import type { DataProviderInterface } from '../../providers/core/DataProviderInterface';

/**
 * Helper: create a mock provider with sensible defaults.
 * All methods are vi.fn() so callers can override or assert individually.
 */
function createMockProvider(
  overrides: Partial<DataProviderInterface> = {},
): DataProviderInterface {
  return {
    sync: vi.fn().mockResolvedValue({
      tasks: [
        { id: 1, title: 'Task 1', start: new Date(), end: new Date() },
      ],
      links: [],
      metadata: {},
    }),
    syncTask: vi.fn().mockImplementation(async (id, updates) => ({
      id,
      title: 'Updated',
      ...updates,
    })),
    createTask: vi.fn().mockImplementation(async (task) => ({
      id: 99,
      ...task,
    })),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    createLink: vi.fn().mockImplementation(async (link) => ({
      id: 100,
      ...link,
    })),
    deleteLink: vi.fn().mockResolvedValue(undefined),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    getFilterOptions: vi.fn().mockResolvedValue({
      members: [],
      labels: [],
      milestones: [],
    }),
    checkCanEdit: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({ type: 'gitlab' }),
    ...overrides,
  } as any;
}

describe('useDataSync', () => {
  let mockProvider: DataProviderInterface;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockProvider = createMockProvider();
  });

  // =========================================================================
  // Original 7 tests (preserved)
  // =========================================================================

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useDataSync(mockProvider));

    expect(result.current.syncState.isLoading).toBe(true);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.links).toEqual([]);
  });

  it('should load data on sync', async () => {
    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.syncState.isLoading).toBe(false);
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Task 1');
    });
  });

  it('should handle sync errors', async () => {
    const error = new Error('Sync failed');
    mockProvider.sync = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.syncState.error).toBeTruthy();
      expect(result.current.syncState.isLoading).toBe(false);
    });
  });

  it('should create tasks', async () => {
    const newTask = { title: 'New Task' };
    const createdTask = {
      ...newTask,
      id: 2,
      start: new Date(),
      end: new Date(),
    };

    mockProvider.createTask = vi.fn().mockResolvedValue(createdTask);

    const { result } = renderHook(() => useDataSync(mockProvider));

    let createdResult: any;
    await act(async () => {
      createdResult = await result.current.createTask(newTask as any);
    });

    expect(mockProvider.createTask).toHaveBeenCalledWith(newTask);
    expect(createdResult.id).toBe(2);
  });

  it('should delete tasks', async () => {
    mockProvider.deleteTask = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.deleteTask(1);
    });

    expect(mockProvider.deleteTask).toHaveBeenCalledWith(1);
  });

  it('should handle provider changes by clearing data', async () => {
    const { result, rerender } = renderHook(
      ({ provider }) => useDataSync(provider),
      { initialProps: { provider: mockProvider as DataProviderInterface | null } },
    );

    // Change provider to null
    rerender({ provider: null });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.links).toEqual([]);
    expect(result.current.syncState.isLoading).toBe(false);
  });

  it('should reorder tasks locally', () => {
    const { result } = renderHook(() =>
      useDataSync(mockProvider, false, 60000, {}),
    );

    // Reorder task - even with empty tasks, rollback should be a function
    const { rollback } = result.current.reorderTaskLocal(1, 3, 'after');

    expect(rollback).toBeDefined();
    expect(typeof rollback).toBe('function');
  });

  // =========================================================================
  // Progress tracking
  // =========================================================================

  describe('progress tracking', () => {
    it('should update progress state during sync via onProgress callback', async () => {
      const progressUpdates: any[] = [];

      mockProvider.sync = vi.fn().mockImplementation(async (options) => {
        // Simulate provider calling onProgress during sync
        if (options?.onProgress) {
          options.onProgress({
            resource: 'workItems',
            currentPage: 1,
            totalPages: 3,
            itemsFetched: 10,
            message: 'Fetching Issues (page 1/3)...',
          });
        }
        return { tasks: [], links: [], metadata: {} };
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      // We need to capture progress mid-sync, so we watch state changes
      const unsubscribe = vi.fn();

      await act(async () => {
        // Start sync - the provider mock will call onProgress synchronously
        // before resolving, so we capture the intermediate state
        const syncPromise = result.current.sync();
        await syncPromise;
      });

      // After sync completes, progress should be cleared
      expect(result.current.syncState.progress).toBeNull();
      expect(result.current.syncState.isSyncing).toBe(false);
    });

    it('should clear progress after sync completes successfully', async () => {
      mockProvider.sync = vi.fn().mockImplementation(async (options) => {
        if (options?.onProgress) {
          options.onProgress({
            resource: 'workItems',
            currentPage: 1,
            itemsFetched: 5,
            message: 'Fetching...',
          });
        }
        return { tasks: [], links: [], metadata: {} };
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.syncState.progress).toBeNull();
      expect(result.current.syncState.isSyncing).toBe(false);
      expect(result.current.syncState.error).toBeNull();
    });

    it('should clear progress after sync fails', async () => {
      mockProvider.sync = vi.fn().mockImplementation(async (options) => {
        if (options?.onProgress) {
          options.onProgress({
            resource: 'milestones',
            currentPage: 2,
            itemsFetched: 20,
            message: 'Fetching Milestones (page 2)...',
          });
        }
        throw new Error('Network failure');
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.syncState.progress).toBeNull();
      expect(result.current.syncState.error).toBe('Network failure');
    });

    it('should pass onProgress callback to the provider sync call', async () => {
      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      // Verify that provider.sync was called with an options object containing onProgress
      expect(mockProvider.sync).toHaveBeenCalledTimes(1);
      const callArgs = (mockProvider.sync as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty('onProgress');
      expect(typeof callArgs.onProgress).toBe('function');
    });
  });

  // =========================================================================
  // Abort / Cancel
  // =========================================================================

  describe('abort and cancellation', () => {
    it('should abort previous sync when a new sync starts', async () => {
      let resolveFirst: Function;
      let firstSignal: AbortSignal | undefined;

      mockProvider.sync = vi
        .fn()
        .mockImplementationOnce(
          (options) =>
            new Promise((resolve) => {
              firstSignal = options?.signal;
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValueOnce({ tasks: [], links: [], metadata: {} });

      const { result } = renderHook(() => useDataSync(mockProvider));

      // Start first sync (will hang)
      await act(async () => {
        result.current.sync();
      });

      // Start second sync - should abort the first
      await act(async () => {
        await result.current.sync();
      });

      // The first sync's signal should have been aborted
      expect(firstSignal?.aborted).toBe(true);
    });

    it('should abort in-flight sync when provider changes', async () => {
      let syncSignal: AbortSignal | undefined;

      mockProvider.sync = vi.fn().mockImplementation(
        (options) =>
          new Promise((resolve) => {
            syncSignal = options?.signal;
            // Never resolves - simulates a long-running request
          }),
      );

      const { result, rerender } = renderHook(
        ({ provider }) => useDataSync(provider),
        { initialProps: { provider: mockProvider as DataProviderInterface | null } },
      );

      // Start a sync that will hang
      await act(async () => {
        result.current.sync();
      });

      expect(syncSignal).toBeDefined();
      expect(syncSignal?.aborted).toBe(false);

      // Change provider - should abort the in-flight sync
      const newProvider = createMockProvider();
      rerender({ provider: newProvider });

      expect(syncSignal?.aborted).toBe(true);
    });

    it('should abort in-flight sync on unmount', async () => {
      let syncSignal: AbortSignal | undefined;

      mockProvider.sync = vi.fn().mockImplementation(
        (options) =>
          new Promise(() => {
            syncSignal = options?.signal;
          }),
      );

      const { result, unmount } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        result.current.sync();
      });

      expect(syncSignal?.aborted).toBe(false);

      unmount();

      expect(syncSignal?.aborted).toBe(true);
    });

    it('should not set error state for aborted syncs', async () => {
      mockProvider.sync = vi.fn().mockImplementation(async (options) => {
        // Simulate an abort error thrown by fetch
        throw new DOMException('The operation was aborted', 'AbortError');
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      // AbortError should not set an error in syncState
      expect(result.current.syncState.error).toBeNull();
    });

    it('should pass abort signal to provider.sync', async () => {
      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      const callArgs = (mockProvider.sync as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty('signal');
      expect(callArgs.signal).toBeInstanceOf(AbortSignal);
    });
  });

  // =========================================================================
  // Concurrent operations & optimistic updates
  // =========================================================================

  describe('concurrent operations and optimistic updates', () => {
    it('should perform optimistic update for syncTask', async () => {
      // First, sync to get initial tasks
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [
          { id: 1, title: 'Original', start: new Date(), end: new Date() },
        ],
        links: [],
        metadata: {},
      });

      // syncTask takes time to resolve
      let resolveSyncTask: Function;
      mockProvider.syncTask = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSyncTask = resolve;
          }),
      );

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.tasks[0].title).toBe('Original');

      // Start syncTask but don't resolve yet
      let syncTaskPromise: Promise<any>;
      await act(async () => {
        syncTaskPromise = result.current.syncTask(1, { title: 'Updated' });
      });

      // Optimistic update should already be applied
      expect(result.current.tasks[0].title).toBe('Updated');

      // Resolve the server-side call
      await act(async () => {
        resolveSyncTask!({ id: 1, title: 'Updated' });
        await syncTaskPromise!;
      });
    });

    it('should rollback optimistic update on syncTask failure', async () => {
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [
          { id: 1, title: 'Original', start: new Date(), end: new Date() },
        ],
        links: [],
        metadata: {},
      });

      mockProvider.syncTask = vi
        .fn()
        .mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.tasks[0].title).toBe('Original');

      // syncTask should throw, and revert the optimistic update
      await act(async () => {
        await expect(
          result.current.syncTask(1, { title: 'Should Revert' }),
        ).rejects.toThrow('Server error');
      });

      // Should have rolled back to original
      expect(result.current.tasks[0].title).toBe('Original');
    });

    it('should throw when syncTask is called for a non-existent task', async () => {
      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      await expect(
        result.current.syncTask(999, { title: 'Nope' }),
      ).rejects.toThrow('Task 999 not found');
    });

    it('should throw when syncTask is called without a provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await expect(
        result.current.syncTask(1, { title: 'Nope' }),
      ).rejects.toThrow('Data provider not initialized');
    });

    it('should add created task to local state', async () => {
      const createdTask = {
        id: 50,
        title: 'Brand New',
        start: new Date(),
        end: new Date(),
      };
      mockProvider.createTask = vi.fn().mockResolvedValue(createdTask);

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      const initialLength = result.current.tasks.length;

      await act(async () => {
        await result.current.createTask({ title: 'Brand New' } as any);
      });

      expect(result.current.tasks.length).toBe(initialLength + 1);
      expect(result.current.tasks.find((t) => t.id === 50)).toBeTruthy();
    });

    it('should optimistically remove deleted task from local state', async () => {
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [
          { id: 1, title: 'Task 1', start: new Date(), end: new Date() },
          { id: 2, title: 'Task 2', start: new Date(), end: new Date() },
        ],
        links: [],
        metadata: {},
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.tasks).toHaveLength(2);

      await act(async () => {
        await result.current.deleteTask(1);
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].id).toBe(2);
    });
  });

  // =========================================================================
  // reorderTaskLocal: midpoint calculation
  // =========================================================================

  describe('reorderTaskLocal', () => {
    /**
     * Helper to set up the hook with pre-populated tasks and return the result.
     * Tasks have numeric ids that are used as default sort values.
     */
    async function setupWithTasks(tasks: any[]) {
      const provider = createMockProvider({
        sync: vi.fn().mockResolvedValue({
          tasks,
          links: [],
          metadata: {},
        }),
      });

      const { result } = renderHook(() => useDataSync(provider));

      await act(async () => {
        await result.current.sync();
      });

      return result;
    }

    it('should calculate midpoint when placing task after target', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
      ];

      const result = await setupWithTasks(tasks);

      act(() => {
        result.current.reorderTaskLocal(1, 2, 'after');
      });

      // Task 1 should now be between task 2 (sortValue=2) and task 3 (sortValue=3)
      // Midpoint = (2 + 3) / 2 = 2.5
      const reorderedTask = result.current.tasks.find((t) => t.id === 1);
      expect(reorderedTask?._localOrder).toBe(2.5);
    });

    it('should calculate midpoint when placing task before target', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
      ];

      const result = await setupWithTasks(tasks);

      act(() => {
        result.current.reorderTaskLocal(3, 2, 'before');
      });

      // Task 3 placed before task 2: between task 1 (sortValue=1) and task 2 (sortValue=2)
      // Midpoint = (1 + 2) / 2 = 1.5
      const reorderedTask = result.current.tasks.find((t) => t.id === 3);
      expect(reorderedTask?._localOrder).toBe(1.5);
    });

    it('should use targetSortValue + 1 when placing after the last task', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ];

      const result = await setupWithTasks(tasks);

      act(() => {
        result.current.reorderTaskLocal(1, 2, 'after');
      });

      // Task 1 placed after task 2: no next task, so newLocalOrder = 2 + 1 = 3
      const reorderedTask = result.current.tasks.find((t) => t.id === 1);
      expect(reorderedTask?._localOrder).toBe(3);
    });

    it('should use targetSortValue - 1 when placing before the first task', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ];

      const result = await setupWithTasks(tasks);

      act(() => {
        result.current.reorderTaskLocal(2, 1, 'before');
      });

      // Task 2 placed before task 1: no previous task, so newLocalOrder = 1 - 1 = 0
      const reorderedTask = result.current.tasks.find((t) => t.id === 2);
      expect(reorderedTask?._localOrder).toBe(0);
    });

    it('should be a no-op when dropping task on itself', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ];

      const result = await setupWithTasks(tasks);

      act(() => {
        result.current.reorderTaskLocal(1, 1, 'after');
      });

      // Task should not have _localOrder set
      const task = result.current.tasks.find((t) => t.id === 1);
      expect(task?._localOrder).toBeUndefined();
    });

    it('should provide a working rollback function', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
      ];

      const result = await setupWithTasks(tasks);

      let rollback: () => void;
      act(() => {
        const reorderResult = result.current.reorderTaskLocal(1, 3, 'after');
        rollback = reorderResult.rollback;
      });

      // Verify the reorder happened
      expect(result.current.tasks.find((t) => t.id === 1)?._localOrder).toBe(
        3 + 1,
      ); // after last: targetSortValue + 1

      // Now rollback
      act(() => {
        rollback();
      });

      // Task should not have _localOrder after rollback
      const restoredTask = result.current.tasks.find((t) => t.id === 1);
      expect(restoredTask?._localOrder).toBeUndefined();
    });

    it('should use _localOrder from previous drag when calculating midpoint', async () => {
      const tasks = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
      ];

      const result = await setupWithTasks(tasks);

      // First drag: move task 1 after task 2
      act(() => {
        result.current.reorderTaskLocal(1, 2, 'after');
      });

      // Task 1 now has _localOrder = 2.5 (midpoint of 2 and 3)
      expect(result.current.tasks.find((t) => t.id === 1)?._localOrder).toBe(
        2.5,
      );

      // Second drag: move task 3 before task 1 (which now has _localOrder 2.5)
      act(() => {
        result.current.reorderTaskLocal(3, 1, 'before');
      });

      // Task 3 should be placed between task 2 (sortValue=2) and task 1 (sortValue=2.5)
      // Midpoint = (2 + 2.5) / 2 = 2.25
      const task3 = result.current.tasks.find((t) => t.id === 3);
      expect(task3?._localOrder).toBe(2.25);
    });
  });

  // =========================================================================
  // Link operations
  // =========================================================================

  describe('link operations', () => {
    it('should create a link and add to local state', async () => {
      const createdLink = { id: 10, source: 1, target: 2, type: 0 };
      mockProvider.createLink = vi.fn().mockResolvedValue(createdLink);

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      await act(async () => {
        await result.current.createLink({
          source: 1,
          target: 2,
          type: 0,
        } as any);
      });

      expect(result.current.links).toHaveLength(1);
      expect(result.current.links[0].id).toBe(10);
    });

    it('should delete a link optimistically', async () => {
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [],
        links: [
          { id: 10, source: 1, target: 2, type: 0 },
          { id: 11, source: 2, target: 3, type: 0 },
        ],
        metadata: {},
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.links).toHaveLength(2);

      await act(async () => {
        await result.current.deleteLink(10);
      });

      expect(result.current.links).toHaveLength(1);
      expect(result.current.links[0].id).toBe(11);
    });
  });

  // =========================================================================
  // Auto-sync
  // =========================================================================

  describe('auto-sync', () => {
    it('should set up interval when autoSync is true', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useDataSync(mockProvider, true, 5000),
      );

      // Initial call count from manual sync is 0 (auto-sync doesn't call immediately)
      const initialCallCount = (mockProvider.sync as any).mock.calls.length;

      // Advance time by the sync interval
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect((mockProvider.sync as any).mock.calls.length).toBeGreaterThan(
        initialCallCount,
      );

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should set error when syncing with null provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.syncState.error).toBe(
        'Data provider not initialized',
      );
    });

    it('should throw when creating a task with null provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await expect(
        result.current.createTask({ title: 'test' } as any),
      ).rejects.toThrow('Data provider not initialized');
    });

    it('should throw when deleting a task with null provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await expect(result.current.deleteTask(1)).rejects.toThrow(
        'Data provider not initialized',
      );
    });

    it('should throw when creating a link with null provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await expect(
        result.current.createLink({ source: 1, target: 2 } as any),
      ).rejects.toThrow('Data provider not initialized');
    });

    it('should throw when deleting a link with null provider', async () => {
      const { result } = renderHook(() => useDataSync(null));

      await expect(result.current.deleteLink(1)).rejects.toThrow(
        'Data provider not initialized',
      );
    });

    it('should handle non-Error sync failures gracefully', async () => {
      mockProvider.sync = vi.fn().mockRejectedValue('string error');

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.syncState.error).toBe('Sync failed');
    });

    it('should store metadata from sync response', async () => {
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [],
        links: [],
        metadata: { projectName: 'Test', version: 2 },
      });

      const { result } = renderHook(() => useDataSync(mockProvider));

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.metadata).toEqual({
        projectName: 'Test',
        version: 2,
      });
    });

    it('should set lastSyncTime after successful sync', async () => {
      const { result } = renderHook(() => useDataSync(mockProvider));

      expect(result.current.syncState.lastSyncTime).toBeNull();

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.syncState.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should reset state when switching to a new provider', async () => {
      const { result, rerender } = renderHook(
        ({ provider }) => useDataSync(provider),
        { initialProps: { provider: mockProvider } },
      );

      // Load some data
      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.tasks).toHaveLength(1);

      // Switch to new provider
      const newProvider = createMockProvider({
        sync: vi.fn().mockResolvedValue({
          tasks: [
            { id: 10, title: 'New Provider Task' },
            { id: 11, title: 'Another Task' },
          ],
          links: [],
          metadata: {},
        }),
      });

      rerender({ provider: newProvider });

      // Data should be cleared, loading should be true
      expect(result.current.tasks).toEqual([]);
      expect(result.current.links).toEqual([]);
      expect(result.current.syncState.isLoading).toBe(true);
    });
  });
});
