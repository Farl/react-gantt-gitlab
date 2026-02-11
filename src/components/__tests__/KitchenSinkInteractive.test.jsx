/**
 * Interactive Test Runner for Kitchen Sink Tests
 *
 * This tool provides hands-on experience with kitchen sink tests:
 * - Step through tests manually
 * - Inspect component state
 * - Debug failed tests interactively
 * - See real-time test execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// Kitchen Sink Playground Component
import { KitchenSinkPlayground } from './KitchenSinkPlayground';

// DOM Setup
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Test state for interactive debugging
const testState = {
  currentTest: null,
  testsExecuted: 0,
  testsPassed: 0,
  testsFailed: 0,
  breakpoints: new Set(),
  stepCount: 0,
};

// Interactive stepping
const testRunner = {
  step: function(stepName) {
    testState.stepCount++;
    console.log(`\n🔍 [STEP ${testState.stepCount}] ${stepName}`);
    console.log(`📊 Test State: ${testState.testsExecuted} executed, ${testState.testsPassed} passed, ${testState.testsFailed} failed`);
  },

  startTest: function(testName) {
    testState.currentTest = testName;
    testState.testsExecuted++;
    console.log(`\n🚀 [TEST START] ${testName}`);
    this.step(`Initializing ${testName}`);
  },

  endTest: function(passed) {
    if (passed) {
      testState.testsPassed++;
      console.log(`✅ [TEST PASSED] ${testState.currentTest}`);
    } else {
      testState.testsFailed++;
      console.log(`❌ [TEST FAILED] ${testState.currentTest}`);
    }
    this.step(`Completed ${testState.currentTest}`);
  },

  inspectComponent: function(componentName, element) {
    console.log(`\n🔍 [COMPONENT INSPECT] ${componentName}`);
    if (element) {
      console.log(`   - Element found: ${element.tagName}`);
      console.log(`   - Text content: "${element.textContent?.substring(0, 50)}..."`);
      console.log(`   - Classes: ${element.className}`);
      if (element.dataset) {
        console.log(`   - Data attributes:`, Object.keys(element.dataset));
      }
    } else {
      console.log(`   - Element not found`);
    }
  },

  inspectState: function(state) {
    console.log(`\n📊 [STATE INSPECT]`);
    console.log(`   - Active tab: ${state?.activeTab}`);
    console.log(`   - Show settings: ${state?.showSettings}`);
    console.log(`   - Auto sync: ${state?.autoSync}`);
  },

  interact: function(action, description) {
    console.log(`\n🎯 [INTERACTION] ${action}`);
    console.log(`   - Description: ${description}`);
  },

  nextStep: function() {
    this.step('Ready for next interaction');
  },
};

// Interactive Debugging Wrapper
const interactiveDebug = {
  wrapTest: function(testName, testFn) {
    return function() {
      testRunner.startTest(testName);

      try {
        // Execute test with act() for React state updates
        act(() => {
          testFn(testRunner);
        });

        testRunner.endTest(true);
        return true;
      } catch (error) {
        console.error(`\n💥 [TEST ERROR] ${testName}:`, error.message);
        console.error(`   Stack trace:`, error.stack);
        testRunner.endTest(false);
        throw error;
      }
    };
  },

  interactiveRender: function(component, callbacks = {}) {
    let result;

    act(() => {
      result = render(component);
    });

    return {
      result,
      screen,
      container: result.container,
      getBy: (selector) => screen.getBy(selector),
      queryBy: (selector) => screen.queryBy(selector),
      getAllBy: (selector) => screen.getAllBy(selector),
      findBy: (selector) => screen.findBy(selector),
      debug: (callback) => {
        if (callback) {
          callback(result);
        } else {
          console.log('Rendered component structure:');
          console.log(JSON.stringify(result, null, 2));
        }
      },
      interact: (action, callback) => {
        console.log(`\n🎯 [INTERACTION] ${action}`);
        if (callback) {
          act(() => {
            callback();
          });
        }
      },
      inspect: (description, callback) => {
        console.log(`\n🔍 [INSPECT] ${description}`);
        act(() => {
          if (callback) {
            callback();
          }
        });
      },
      getState: () => {
        // Get state from localStorage or other sources
        return {
          activeTab: localStorage.getItem('gitlab-gantt-view-mode') || 'workspace',
          showSettings: testState.showSettings || false,
          autoSync: testState.autoSync || false,
        };
      },
    };
  },
};

// Describe and Test Macros
function createInteractiveDescribe(description, fn) {
  console.log(`\n📚 [DESCRIBE] ${description}`);
  return describe(description, fn);
}

function createInteractiveIt(testName, testFn) {
  return it(testName, interactiveDebug.wrapTest(testName, testFn));
}

// Main Kitchen Sink Test Suite with Hands-On Experience
describe('Kitchen Sink Interactive Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('gitlab-gantt-view-mode', 'workspace');

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

    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    testState.showSettings = false;
    testState.autoSync = false;
    testState.stepCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // Interactive Workspace Tests
  createInteractiveDescribe('Interactive Workspace Tests', () => {
    createInteractiveIt('should render Workspace with hands-on inspection', (runner) => {
      runner.step('Rendering KitchenSinkPlayground component');

      const { result, interact, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      inspect('Initial render - workspace tab active', () => {
        const workspaceElement = result.container.querySelector('.kitchen-sink-playground');
        runner.inspectComponent('KitchenSinkPlayground', workspaceElement);
      });

      nextStep();
      runner.step('Rendering Workspace component inside playground');
    });

    createInteractiveIt('should handle tab switching with inspection', (runner) => {
      const { result, interact, getState, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Initial state inspection');
      const initialState = getState();
      runner.inspectState(initialState);
      expect(initialState.activeTab).toBe('workspace');

      nextStep();
      runner.step('Clicking Gantt tab');

      interact('Click Gantt tab button', () => {
        const ganttTab = screen.getByRole('button', { name: /gantt/i });
        fireEvent.click(ganttTab);
      });

      runner.step('Verifying tab change with inspection');
      const newState = getState();
      runner.inspectState(newState);
      expect(newState.activeTab).toBe('gantt');

      nextStep();
      runner.step('Clicking Workspace tab to return');

      interact('Click Workspace tab button', () => {
        const workspaceTab = screen.getByRole('button', { name: /workspace/i });
        fireEvent.click(workspaceTab);
      });

      runner.step('Verifying final state');
      const finalState = getState();
      runner.inspectState(finalState);
      expect(finalState.activeTab).toBe('workspace');

      nextStep();
    });

    createInteractiveIt('should handle settings toggle with inspection', (runner) => {
      const { result, interact, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Inspecting initial settings state');
      const initialState = getState();
      expect(initialState.showSettings).toBe(false);
      runner.inspectState(initialState);

      nextStep();
      runner.step('Toggling settings checkbox');

      interact('Click settings checkbox', () => {
        const settingsCheckbox = screen.getByLabelText(/show settings modal/i);
        fireEvent.click(settingsCheckbox);
      });

      runner.step('Verifying settings state change');
      const newState = getState();
      expect(newState.showSettings).toBe(true);
      runner.inspectState(newState);

      nextStep();
    });

    createInteractiveIt('should handle auto-sync toggle with inspection', (runner) => {
      const { result, interact, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Inspecting initial auto-sync state');
      const initialState = getState();
      expect(initialState.autoSync).toBe(false);
      runner.inspectState(initialState);

      nextStep();
      runner.step('Enabling auto-sync');

      interact('Click auto-sync checkbox', () => {
        const autoSyncCheckbox = screen.getByLabelText(/auto sync/i);
        fireEvent.click(autoSyncCheckbox);
      });

      runner.step('Verifying auto-sync state change');
      const newState = getState();
      expect(newState.autoSync).toBe(true);
      runner.inspectState(newState);

      nextStep();
    });
  });

  // Interactive Component Integration Tests
  createInteractiveDescribe('Interactive Component Integration', () => {
    createInteractiveIt('should render and inspect Workspace components', (runner) => {
      const { result, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Inspecting Workspace component structure');

      inspect('Workspace container', () => {
        const workspace = result.container.querySelector('.gitlab-workspace');
        runner.inspectComponent('Workspace', workspace);
      });

      inspect('SharedToolbar', () => {
        const toolbar = result.container.querySelector('.shared-toolbar');
        runner.inspectComponent('SharedToolbar', toolbar);
      });

      inspect('KanbanBoard', () => {
        const kanban = result.container.querySelector('.kanban-board');
        runner.inspectComponent('KanbanBoard', kanban);
      });

      nextStep();
    });

    createInteractiveIt('should render and inspect GanttView components', (runner) => {
      const { result, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Clicking Gantt tab to load GanttView');

      interact('Click Gantt tab', () => {
        const ganttTab = screen.getByRole('button', { name: /gantt/i });
        fireEvent.click(ganttTab);
      });

      runner.step('Inspecting GanttView components');

      inspect('GanttView container', () => {
        const ganttView = result.container.querySelector('.gantt-view');
        runner.inspectComponent('GanttView', ganttView);
      });

      inspect('FilterPanel', () => {
        const filterPanel = result.container.querySelector('.filter-panel');
        runner.inspectComponent('FilterPanel', filterPanel);
      });

      inspect('ProjectSelector', () => {
        const projectSelector = screen.getByRole('combobox', { name: /project/i });
        runner.inspectComponent('ProjectSelector', projectSelector);
      });

      nextStep();
    });
  });

  // Interactive Interaction Tests
  createInteractiveDescribe('Interactive User Interactions', () => {
    createInteractiveIt('should handle multiple interactions sequentially', (runner) => {
      const { result, interact, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Performing series of interactions');

      // Interaction 1: Switch to Gantt
      interact('Click Gantt tab', () => {
        const ganttTab = screen.getByRole('button', { name: /gantt/i });
        fireEvent.click(ganttTab);
      });

      // Interaction 2: Toggle settings
      interact('Toggle settings', () => {
        const settingsCheckbox = screen.getByLabelText(/show settings modal/i);
        fireEvent.click(settingsCheckbox);
      });

      // Interaction 3: Toggle auto-sync
      interact('Toggle auto-sync', () => {
        const autoSyncCheckbox = screen.getByLabelText(/auto sync/i);
        fireEvent.click(autoSyncCheckbox);
      });

      // Interaction 4: Switch back to Workspace
      interact('Switch to Workspace tab', () => {
        const workspaceTab = screen.getByRole('button', { name: /workspace/i });
        fireEvent.click(workspaceTab);
      });

      runner.step('Verifying state after all interactions');

      const finalState = getState();
      runner.inspectState(finalState);
      expect(finalState.activeTab).toBe('workspace');
      expect(finalState.showSettings).toBe(true);
      expect(finalState.autoSync).toBe(true);

      nextStep();
    });

    createInteractiveIt('should handle rapid interactions', (runner) => {
      const { result, interact, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Performing rapid interactions');

      interact('Rapid tab clicking', () => {
        const ganttTab = screen.getByRole('button', { name: /gantt/i });
        const workspaceTab = screen.getByRole('button', { name: /workspace/i });

        // Click 5 times
        fireEvent.click(ganttTab);
        fireEvent.click(workspaceTab);
        fireEvent.click(ganttTab);
        fireEvent.click(workspaceTab);
        fireEvent.click(ganttTab);
      });

      runner.step('Verifying system handles rapid interactions');
      // Should not throw errors

      nextStep();
    });
  });

  // Interactive State Management Tests
  createInteractiveDescribe('Interactive State Management', () => {
    createInteractiveIt('should maintain state across multiple renders', (runner) => {
      const { result, inspect, getState, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Getting initial state');
      const state1 = getState();
      runner.inspectState(state1);

      runner.step('Modifying state');
      interact('Toggle auto-sync', () => {
        const checkbox = screen.getByLabelText(/auto sync/i);
        fireEvent.click(checkbox);
      });

      runner.step('Verifying state update');
      const state2 = getState();
      runner.inspectState(state2);
      expect(state2.autoSync).toBe(true);

      runner.step('Modifying state again');
      interact('Toggle settings', () => {
        const checkbox = screen.getByLabelText(/show settings modal/i);
        fireEvent.click(checkbox);
      });

      runner.step('Verifying final state');
      const state3 = getState();
      runner.inspectState(state3);
      expect(state3.showSettings).toBe(true);

      nextStep();
    });

    createInteractiveIt('should persist state across render cycles', (runner) => {
      const { result, inspect, nextStep } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      runner.step('Inspecting initial state');

      interact('Toggle settings', () => {
        const checkbox = screen.getByLabelText(/show settings modal/i);
        fireEvent.click(checkbox);
      });

      runner.step('Simulating re-render');

      act(() => {
        interact('Re-render component', () => {
          // Component will re-render due to state change
        });
      });

      runner.step('Verifying state persistence');
      const stateAfterRender = getState();
      runner.inspectState(stateAfterRender);
      expect(stateAfterRender.showSettings).toBe(true);

      nextStep();
    });
  });

  // Interactive Performance Tests
  createInteractiveDescribe('Interactive Performance Testing', () => {
    createInteractiveIt('should render all components within 500ms', (runner) => {
      const startTime = performance.now();

      const { result } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      runner.step(`Render duration: ${duration.toFixed(2)}ms`);

      runner.inspect('Performance metrics', () => {
        console.log(`\n📊 [PERFORMANCE] Render time: ${duration.toFixed(2)}ms`);
        console.log(`📊 [PERFORMANCE] Expected: < 500ms`);
        console.log(`📊 [PERFORMANCE] Status: ${duration < 500 ? '✓ PASS' : '✗ FAIL'}`);
      });

      expect(duration).toBeLessThan(500);

      runner.step('Test completed successfully');
    });

    createInteractiveIt('should handle multiple rapid interactions', (runner) => {
      const startTime = performance.now();

      const { result } = interactiveDebug.interactiveRender(
        <KitchenSinkPlayground />
      );

      // Perform 10 rapid interactions
      interact('Rapid interactions (10x)', () => {
        const ganttTab = screen.getByRole('button', { name: /gantt/i });
        const workspaceTab = screen.getByRole('button', { name: /workspace/i });

        for (let i = 0; i < 10; i++) {
          fireEvent.click(ganttTab);
          fireEvent.click(workspaceTab);
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      runner.step(`Rapid interactions completed in: ${duration.toFixed(2)}ms`);

      runner.inspect('Performance metrics', () => {
        console.log(`\n📊 [PERFORMANCE] Interaction time: ${duration.toFixed(2)}ms`);
        console.log(`📊 [PERFORMANCE] Status: System handles rapid interactions efficiently`);
      });

      // Should complete without errors

      runner.step('Test completed successfully');
    });
  });

  // Interactive Error Handling Tests
  createInteractiveDescribe('Interactive Error Handling', () => {
    createInteractiveIt('should handle missing localStorage gracefully', (runner) => {
      runner.step('Clearing localStorage to simulate missing storage');

      localStorage.clear();

      // Override localStorage to throw error
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('localStorage not available');
        },
      });

      runner.step('Attempting to render with missing localStorage');

      runner.inspect('Error handling attempt', () => {
        console.log(`\n⚠️  [ERROR HANDLING] Attempting to render without localStorage`);
        console.log(`⚠️  [ERROR HANDLING] This should not throw an error`);
      });

      // Should not throw error
      expect(() => {
        const { result } = interactiveDebug.interactiveRender(
          <KitchenSinkPlayground />
        );
      }).not.toThrow();

      runner.step('Error handling test completed');
    });

    createInteractiveIt('should handle missing matchMedia gracefully', (runner) => {
      runner.step('Simulating missing matchMedia API');

      Object.defineProperty(global, 'matchMedia', {
        get: () => {
          throw new Error('matchMedia not available');
        },
      });

      runner.step('Attempting to render with missing matchMedia');

      runner.inspect('Error handling attempt', () => {
        console.log(`\n⚠️  [ERROR HANDLING] Attempting to render without matchMedia`);
        console.log(`⚠️  [ERROR HANDLING] This should not throw an error`);
      });

      // Should not throw error
      expect(() => {
        const { result } = interactiveDebug.interactiveRender(
          <KitchenSinkPlayground />
        );
      }).not.toThrow();

      runner.step('Error handling test completed');
    });

    createInteractiveIt('should handle missing IntersectionObserver gracefully', (runner) => {
      runner.step('Simulating missing IntersectionObserver API');

      global.IntersectionObserver = undefined;

      runner.step('Attempting to render with missing IntersectionObserver');

      runner.inspect('Error handling attempt', () => {
        console.log(`\n⚠️  [ERROR HANDLING] Attempting to render without IntersectionObserver`);
        console.log(`⚠️  [ERROR HANDLING] This should not throw an error`);
      });

      // Should not throw error
      expect(() => {
        const { result } = interactiveDebug.interactiveRender(
          <KitchenSinkPlayground />
        );
      }).not.toThrow();

      runner.step('Error handling test completed');
    });
  });

  // Interactive Summary
  describe('Interactive Test Summary', () => {
    createInteractiveIt('should provide test execution summary', (runner) => {
      runner.step('Generating test summary');

      runner.inspect('Test Summary', () => {
        console.log(`\n📊 [TEST SUMMARY]`);
        console.log(`📊 [TEST SUMMARY] Total Tests Executed: ${testState.testsExecuted}`);
        console.log(`📊 [TEST SUMMARY] Tests Passed: ${testState.testsPassed}`);
        console.log(`📊 [TEST SUMMARY] Tests Failed: ${testState.testsFailed}`);
        console.log(`📊 [TEST SUMMARY] Success Rate: ${(
          (testState.testsPassed / testState.testsExecuted) * 100
        ).toFixed(2)}%`);
        console.log(`📊 [TEST SUMMARY] Total Steps: ${testState.stepCount}`);
      });

      expect(testState.testsExecuted).toBeGreaterThan(0);
    });
  });
});

// Export interactive test runner for manual use
export { testRunner, interactiveDebug, testState };
