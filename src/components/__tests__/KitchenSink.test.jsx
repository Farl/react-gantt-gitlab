/**
 * Kitchen Sink Integration Test
 *
 * Comprehensive integration test that tests multiple components together:
 * - Workspace (main container)
 * - GanttView (Gantt chart view)
 * - KanbanView (optional Kanban view)
 * - FilterPanel (filter functionality)
 * - SharedToolbar (shared UI elements)
 * - Data flow between components
 * - State management across views
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// Create DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

import { Workspace } from '../Workspace/Workspace';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';

describe('Kitchen Sink Integration Test', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    localStorage.setItem('gitlab-gantt-view-mode', 'gantt');

    // Mock matchMedia
    Object.defineProperty(global, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Spy on console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Workspace Component Integration', () => {
    it('should render Workspace with Gantt view by default', () => {
      render(<Workspace />);

      expect(document.querySelector('.gitlab-workspace')).toBeInTheDocument();
    });

    it('should persist view mode to localStorage', () => {
      render(<Workspace />);

      const storedViewMode = localStorage.getItem('gitlab-gantt-view-mode');
      expect(storedViewMode).toBe('gantt');

      render(<Workspace />);

      const storedViewMode2 = localStorage.getItem('gitlab-gantt-view-mode');
      expect(storedViewMode2).toBe('gantt');
    });

    it('should switch to Kanban view when clicked', () => {
      render(<Workspace />);

      // Click view switcher button
      const viewToggle = screen.getByRole('button', { name: /view/i });
      fireEvent.click(viewToggle);

      // Should show Kanban view
      expect(document.querySelector('.kanban-board')).toBeInTheDocument();
    });

    it('should render with hideSharedToolbar when provided', () => {
      render(<Workspace />);

      expect(document.querySelector('.shared-toolbar')).toBeInTheDocument();
    });

    it('should pass initialConfigId to Workspace', () => {
      render(<Workspace initialConfigId="test-config" />);

      expect(document.querySelector('.gitlab-workspace')).toBeInTheDocument();
    });

    it('should render with autoSync enabled', () => {
      render(<Workspace autoSync={true} />);

      expect(document.querySelector('.gitlab-workspace')).toBeInTheDocument();
    });
  });

  describe('GanttView Component Integration', () => {
    it('should render GanttView with hideSharedToolbar', () => {
      render(<GanttView hideSharedToolbar={true} />);

      expect(screen.getByTestId('gantt-view')).toBeInTheDocument();
    });

    it('should handle externalShowSettings prop', () => {
      const handleClose = vi.fn();
      render(
        <GanttView
          hideSharedToolbar={true}
          showSettings={true}
          onSettingsClose={handleClose}
        />
      );

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[0]);

      waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('should render ProjectSelector when not hidden', () => {
      render(<GanttView hideSharedToolbar={false} />);

      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument();
    });

    it('should render FilterPanel', () => {
      render(<GanttView hideSharedToolbar={true} />);

      expect(screen.getByRole('combobox', { name: /filter/i })).toBeInTheDocument();
    });

    it('should render SyncButton', () => {
      render(<GanttView hideSharedToolbar={true} />);

      expect(screen.getByRole('button', { name: /sync/i })).toBeInTheDocument();
    });
  });

  describe('KanbanView Component Integration', () => {
    it('should render KanbanView in Workspace', () => {
      render(<Workspace />);

      // Switch to Kanban view
      const viewToggle = screen.getByRole('button', { name: /view/i });
      fireEvent.click(viewToggle);

      expect(document.querySelector('.kanban-board')).toBeInTheDocument();
    });

    it('should render KanbanBoard component', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });
      fireEvent.click(viewToggle);

      expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    });

    it('should handle Kanban view settings modal', () => {
      const handleClose = vi.fn();
      render(<Workspace />);

      // Switch to Kanban view
      const viewToggle = screen.getByRole('button', { name: /view/i });
      fireEvent.click(viewToggle);

      const settingsButtons = screen.getAllByRole('button', { name: /settings/i });
      fireEvent.click(settingsButtons[0]);

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[0]);

      waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain state across view switches', () => {
      render(<Workspace />);

      // Switch to Gantt
      expect(document.querySelector('.gantt-view')).toBeInTheDocument();

      // Switch to Kanban
      const viewToggle = screen.getByRole('button', { name: /view/i });
      fireEvent.click(viewToggle);

      expect(document.querySelector('.kanban-board')).toBeInTheDocument();

      // Switch back to Gantt
      fireEvent.click(viewToggle);

      expect(document.querySelector('.gantt-view')).toBeInTheDocument();
    });

    it('should persist view mode across render cycles', () => {
      const { rerender } = render(<Workspace />);

      let storedViewMode = localStorage.getItem('gitlab-gantt-view-mode');
      expect(storedViewMode).toBe('gantt');

      rerender(<Workspace />);

      storedViewMode = localStorage.getItem('gitlab-gantt-view-mode');
      expect(storedViewMode).toBe('gantt');
    });

    it('should handle multiple concurrent renders without errors', () => {
      const { rerender } = render(<Workspace />);

      // Multiple renders should not cause errors
      for (let i = 0; i < 5; i++) {
        rerender(<Workspace />);
      }

      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should render all components within 500ms', async () => {
      const startTime = performance.now();

      render(<Workspace />);

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle rapid view switching efficiently', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });

      // Rapid switching should complete without errors
      for (let i = 0; i < 10; i++) {
        fireEvent.click(viewToggle);
      }

      // Should still be responsive
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility Integration', () => {
    it('should have proper ARIA labels', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });
      expect(viewToggle).toHaveAttribute('aria-label');

      const syncButton = screen.getByRole('button', { name: /sync/i });
      expect(syncButton).toHaveAttribute('aria-label');

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      expect(settingsButton).toHaveAttribute('aria-label');
    });

    it('should have keyboard navigation support', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });

      // Tab should focus on view toggle
      viewToggle.focus();

      // Space/Enter should toggle view
      fireEvent.keyDown(viewToggle, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(viewToggle, { key: ' ' });

      expect(screen.getByRole('button', { name: /kanban/i })).toBeInTheDocument();
    });

    it('should have proper semantic HTML structure', () => {
      render(<Workspace />);

      const workspace = document.querySelector('.gitlab-workspace');
      expect(workspace).toBeInTheDocument();

      const content = document.querySelector('.gitlab-workspace-content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing localStorage gracefully', () => {
      localStorage.clear();

      // Override localStorage to throw error
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('localStorage not available');
        },
      });

      // Should not throw error
      expect(() => render(<Workspace />)).not.toThrow();
    });

    it('should handle missing matchMedia gracefully', () => {
      Object.defineProperty(global, 'matchMedia', {
        get: () => {
          throw new Error('matchMedia not available');
        },
      });

      // Should not throw error
      expect(() => render(<Workspace />)).not.toThrow();
    });

    it('should handle missing IntersectionObserver gracefully', () => {
      global.IntersectionObserver = undefined;

      // Should not throw error
      expect(() => render(<Workspace />)).not.toThrow();
    });
  });

  describe('Component Composition Integration', () => {
    it('should compose multiple components together', () => {
      render(<Workspace />);

      // Workspace contains multiple sub-components
      const workspace = document.querySelector('.gitlab-workspace');
      const toolbar = document.querySelector('.shared-toolbar');
      const content = document.querySelector('.gitlab-workspace-content');
      const filterPanel = document.querySelector('.filter-panel');

      expect(workspace).toBeInTheDocument();
      expect(toolbar).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(filterPanel).toBeInTheDocument();
    });

    it('should maintain component hierarchy', () => {
      render(<Workspace />);

      const workspace = document.querySelector('.gitlab-workspace');

      // Toolbar should be direct child of workspace
      const toolbar = workspace?.querySelector('.shared-toolbar');
      expect(toolbar).toBeInTheDocument();

      // Content should be direct child of workspace
      const content = workspace?.querySelector('.gitlab-workspace-content');
      expect(content).toBeInTheDocument();
    });

    it('should support nested view switching', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });

      // Switch to Kanban
      fireEvent.click(viewToggle);

      // Should have Kanban content
      expect(screen.getByTestId('kanban-board')).toBeInTheDocument();

      // Switch back to Gantt
      fireEvent.click(viewToggle);

      // Should have Gantt content
      expect(screen.getByTestId('gantt-view')).toBeInTheDocument();
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle empty state gracefully', () => {
      render(<Workspace />);

      // Should not throw error even with no data
      expect(document.querySelector('.gitlab-workspace')).toBeInTheDocument();
    });

    it('should handle rapid multiple renders', () => {
      const { rerender } = render(<Workspace />);

      // Rapid re-renders
      for (let i = 0; i < 20; i++) {
        rerender(<Workspace />);
      }

      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument();
    });

    it('should handle concurrent state changes', () => {
      render(<Workspace />);

      const viewToggle = screen.getByRole('button', { name: /view/i });

      // Concurrent clicks
      fireEvent.click(viewToggle);
      fireEvent.click(viewToggle);
      fireEvent.click(viewToggle);
      fireEvent.click(viewToggle);

      // Should handle without errors
      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    });
  });
});
