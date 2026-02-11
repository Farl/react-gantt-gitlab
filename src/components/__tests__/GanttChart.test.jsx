/**
 * GanttChart (Backward Compatibility Wrapper) Tests
 * Tests for the deprecated GitLabGantt component that wraps Workspace.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Workspace component to isolate the wrapper behavior
vi.mock('../Workspace', () => ({
  Workspace: (props) => (
    <div data-testid="workspace" data-props={JSON.stringify(props)} />
  ),
}));

import { GitLabGantt } from '../GanttChart';

describe('GanttChart (GitLabGantt wrapper)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should render the underlying Workspace component', () => {
    render(<GitLabGantt />);

    expect(screen.getByTestId('workspace')).toBeInTheDocument();
  });

  it('should pass all props through to Workspace', () => {
    render(<GitLabGantt initialConfigId="test-config" autoSync={true} />);

    const workspace = screen.getByTestId('workspace');
    const passedProps = JSON.parse(workspace.getAttribute('data-props'));
    expect(passedProps.initialConfigId).toBe('test-config');
    expect(passedProps.autoSync).toBe(true);
  });

  it('should export GitLabGantt as a function component', () => {
    expect(typeof GitLabGantt).toBe('function');
  });

  it('should render Workspace with no props when none provided', () => {
    render(<GitLabGantt />);

    const workspace = screen.getByTestId('workspace');
    const passedProps = JSON.parse(workspace.getAttribute('data-props'));
    expect(passedProps).toEqual({});
  });
});
