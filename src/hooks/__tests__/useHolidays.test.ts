/**
 * useHolidays Hook Tests
 * Tests for holiday management: loading, saving, debounced save,
 * holiday/workday CRUD, color rules, and cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHolidays } from '../useHolidays';

// Mock the GitLabSnippetApi module
vi.mock('../../providers/GitLabSnippetApi', () => ({
  loadGanttConfig: vi.fn(),
  saveGanttConfig: vi.fn(),
  parseConfigText: vi.fn(),
  formatConfigText: vi.fn(),
}));

// Import the mocked functions for assertions
import {
  loadGanttConfig,
  saveGanttConfig,
} from '../../providers/GitLabSnippetApi';

const mockLoadGanttConfig = loadGanttConfig as ReturnType<typeof vi.fn>;
const mockSaveGanttConfig = saveGanttConfig as ReturnType<typeof vi.fn>;

const MOCK_PROXY_CONFIG = {
  gitlabUrl: 'https://gitlab.example.com',
  token: 'test-token',
};

const MOCK_FULL_PATH = 'group/project';

describe('useHolidays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadGanttConfig.mockResolvedValue(null);
    mockSaveGanttConfig.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Loading holidays from snippet
  // =========================================================================

  describe('loading holidays from snippet', () => {
    it('should load holidays and workdays from config', async () => {
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [
          { date: '2025-01-01', name: 'New Year' },
          { date: '2025-12-25', name: 'Christmas' },
        ],
        workdays: [{ date: '2025-01-04', name: 'Make-up Day' }],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.holidays).toHaveLength(2);
      expect(result.current.holidays[0].date).toBe('2025-01-01');
      expect(result.current.holidays[0].name).toBe('New Year');
      expect(result.current.workdays).toHaveLength(1);
      expect(result.current.workdays[0].date).toBe('2025-01-04');
    });

    it('should set loading state while fetching config', async () => {
      let resolveLoad!: Function;
      mockLoadGanttConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      );

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      // Should be loading
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveLoad(null);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should set error state when loading fails', async () => {
      mockLoadGanttConfig.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should return empty data when no config exists', async () => {
      mockLoadGanttConfig.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.holidays).toEqual([]);
      expect(result.current.workdays).toEqual([]);
      expect(result.current.colorRules).toEqual([]);
      expect(result.current.holidaysText).toBe('');
      expect(result.current.workdaysText).toBe('');
    });

    it('should skip loading for group configType', async () => {
      mockLoadGanttConfig.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true, 'group'),
      );

      // For group mode, loadGanttConfig should NOT be called
      // The hook early-returns before calling loadGanttConfig
      // Wait a tick for the effect to run
      await act(async () => {});

      expect(mockLoadGanttConfig).not.toHaveBeenCalled();
      expect(result.current.holidays).toEqual([]);
      expect(result.current.workdays).toEqual([]);
    });

    it('should not load when fullPath is null', async () => {
      const { result } = renderHook(() =>
        useHolidays(null, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {});

      expect(mockLoadGanttConfig).not.toHaveBeenCalled();
    });

    it('should not load when proxyConfig is null', async () => {
      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, null, true),
      );

      await act(async () => {});

      expect(mockLoadGanttConfig).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Saving holidays with debounce
  // =========================================================================

  describe('saving holidays with debounce', () => {
    it('should debounce save when setting holidays text', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      // Flush the initial load (resolve the mocked promise)
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setHolidaysText('2025-01-01 New Year');
      });

      // Save should NOT have been called yet (debounced 500ms)
      expect(mockSaveGanttConfig).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('should not save when canEdit is false', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, false),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setHolidaysText('2025-01-01 New Year');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should cancel previous debounce when called again quickly', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Call setHolidaysText rapidly
      act(() => {
        result.current.setHolidaysText('2025-01-01');
      });

      // 200ms in - not yet saved
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      act(() => {
        result.current.setHolidaysText('2025-01-01 New Year');
      });

      // Advance another 500ms - only the last call should trigger save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).toHaveBeenCalledTimes(1);
      // The save should contain the parsed entry from the last call
      const savedConfig = mockSaveGanttConfig.mock.calls[0][1];
      expect(savedConfig.holidays).toEqual([
        { date: '2025-01-01', name: 'New Year' },
      ]);
      vi.useRealTimers();
    });

    it('should set saving state during save', async () => {
      vi.useFakeTimers();
      let resolveSave!: Function;
      mockSaveGanttConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          }),
      );

      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setHolidaysText('2025-01-01');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Should be saving now
      expect(result.current.saving).toBe(true);

      await act(async () => {
        resolveSave();
      });

      expect(result.current.saving).toBe(false);
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Holiday CRUD via text input
  // =========================================================================

  describe('holiday CRUD via text input', () => {
    /**
     * Helper: render hook with loaded config and wait for loading to finish.
     */
    async function renderWithLoadedConfig(canEdit = true) {
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const hookResult = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, canEdit),
      );

      await waitFor(() => {
        expect(hookResult.result.current.loading).toBe(false);
      });

      return hookResult;
    }

    it('should parse single date entry from text', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText('2025-06-15');
      });

      expect(result.current.holidays).toEqual([{ date: '2025-06-15' }]);
    });

    it('should parse date with name from text', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText('2025-12-25 Christmas Day');
      });

      expect(result.current.holidays).toEqual([
        { date: '2025-12-25', name: 'Christmas Day' },
      ]);
    });

    it('should parse multiple entries from multiline text', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText(
          '2025-01-01 New Year\n2025-12-25 Christmas\n2025-07-04 Independence Day',
        );
      });

      expect(result.current.holidays).toHaveLength(3);
      expect(result.current.holidays[0]).toEqual({
        date: '2025-01-01',
        name: 'New Year',
      });
      expect(result.current.holidays[2]).toEqual({
        date: '2025-07-04',
        name: 'Independence Day',
      });
    });

    it('should ignore comment lines starting with #', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText(
          '# Company holidays\n2025-01-01 New Year\n# End of list',
        );
      });

      expect(result.current.holidays).toHaveLength(1);
      expect(result.current.holidays[0].name).toBe('New Year');
    });

    it('should ignore empty lines', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText('2025-01-01\n\n\n2025-12-25');
      });

      expect(result.current.holidays).toHaveLength(2);
    });

    it('should ignore lines with invalid date format', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText(
          'not-a-date\n2025-01-01 Valid\nJanuary 1st',
        );
      });

      expect(result.current.holidays).toHaveLength(1);
      expect(result.current.holidays[0].date).toBe('2025-01-01');
    });

    it('should update holidaysText state immediately', async () => {
      const { result } = await renderWithLoadedConfig();

      act(() => {
        result.current.setHolidaysText('2025-06-15 Summer');
      });

      expect(result.current.holidaysText).toBe('2025-06-15 Summer');
    });
  });

  // =========================================================================
  // Workdays and color rules loading/saving
  // =========================================================================

  describe('workdays and color rules', () => {
    it('should update workdays from text input', async () => {
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setWorkdaysText('2025-01-04 Make-up Saturday');
      });

      expect(result.current.workdays).toEqual([
        { date: '2025-01-04', name: 'Make-up Saturday' },
      ]);
      expect(result.current.workdaysText).toBe('2025-01-04 Make-up Saturday');
    });

    it('should trigger debounced save when workdays text changes', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [{ date: '2025-01-01', name: 'New Year' }],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setWorkdaysText('2025-01-04');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).toHaveBeenCalledTimes(1);
      // The saved config should include existing holidays and the new workday
      const savedConfig = mockSaveGanttConfig.mock.calls[0][1];
      expect(savedConfig.workdays).toEqual([{ date: '2025-01-04' }]);
      // holidays should come from the ref (current state)
      expect(savedConfig.holidays).toEqual([
        { date: '2025-01-01', name: 'New Year' },
      ]);
      vi.useRealTimers();
    });

    it('should load color rules from config', async () => {
      const colorRules = [
        {
          id: 'rule-1',
          name: 'Bug',
          pattern: 'bug',
          matchType: 'contains' as const,
          color: '#FF0000',
          priority: 1,
          enabled: true,
        },
      ];

      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules,
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.colorRules).toHaveLength(1);
      expect(result.current.colorRules[0].name).toBe('Bug');
      expect(result.current.colorRules[0].color).toBe('#FF0000');
    });

    it('should save color rules with debounce', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const newRules = [
        {
          id: 'rule-1',
          name: 'Feature',
          pattern: 'feat',
          matchType: 'contains' as const,
          color: '#00FF00',
          priority: 1,
          enabled: true,
        },
      ];

      act(() => {
        result.current.setColorRules(newRules);
      });

      // Not yet saved
      expect(mockSaveGanttConfig).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).toHaveBeenCalledTimes(1);
      const savedConfig = mockSaveGanttConfig.mock.calls[0][1];
      expect(savedConfig.colorRules).toEqual(newRules);
      vi.useRealTimers();
    });

    it('should not save color rules when canEdit is false', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, false),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setColorRules([
          {
            id: 'r1',
            name: 'Test',
            pattern: 'x',
            matchType: 'contains',
            color: '#000',
            priority: 1,
            enabled: true,
          },
        ]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Cleanup on unmount
  // =========================================================================

  describe('cleanup on unmount', () => {
    it('should clear debounce timer on unmount', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      const { result, unmount } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger a debounced save
      act(() => {
        result.current.setHolidaysText('2025-01-01');
      });

      // Unmount before debounce fires
      unmount();

      // Advance past debounce - save should NOT be called
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockSaveGanttConfig).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Reload
  // =========================================================================

  describe('reload', () => {
    it('should reload config from provider', async () => {
      mockLoadGanttConfig
        .mockResolvedValueOnce({
          holidays: [{ date: '2025-01-01' }],
          workdays: [],
          colorRules: [],
        })
        .mockResolvedValueOnce({
          holidays: [
            { date: '2025-01-01' },
            { date: '2025-06-15', name: 'New Holiday' },
          ],
          workdays: [],
          colorRules: [],
        });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.holidays).toHaveLength(1);

      await act(async () => {
        await result.current.reload();
      });

      expect(result.current.holidays).toHaveLength(2);
      expect(mockLoadGanttConfig).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Holiday text formatting
  // =========================================================================

  describe('holiday text formatting', () => {
    it('should format loaded holidays into text with date and name', async () => {
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [
          { date: '2025-01-01', name: 'New Year' },
          { date: '2025-12-25' },
        ],
        workdays: [],
        colorRules: [],
      });

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // entriesToText joins with \n, includes name when present
      expect(result.current.holidaysText).toBe(
        '2025-01-01 New Year\n2025-12-25',
      );
    });
  });

  // =========================================================================
  // Save error handling
  // =========================================================================

  describe('save error handling', () => {
    it('should set error state when save fails', async () => {
      vi.useFakeTimers();
      mockLoadGanttConfig.mockResolvedValue({
        holidays: [],
        workdays: [],
        colorRules: [],
      });

      mockSaveGanttConfig.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useHolidays(MOCK_FULL_PATH, MOCK_PROXY_CONFIG, true),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.setHolidaysText('2025-01-01');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(result.current.error).toBe('Save failed');
      expect(result.current.saving).toBe(false);
      vi.useRealTimers();
    });
  });
});
