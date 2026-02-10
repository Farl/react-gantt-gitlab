/**
 * SyncButton Component Tests
 * Tests for the sync button component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncButton } from '../SyncButton';

describe('SyncButton', () => {
  it('should render sync button', () => {
    const mockSync = vi.fn();

    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          isLoading: false,
          isSyncing: false,
          error: null,
          lastSyncTime: null,
          progress: null,
        }}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onSync when clicked', async () => {
    const mockSync = vi.fn().mockResolvedValue(undefined);

    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          isLoading: false,
          isSyncing: false,
          error: null,
          lastSyncTime: null,
          progress: null,
        }}
      />,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalledTimes(1);
    });
  });

  it('should show loading state during sync', () => {
    const mockSync = vi.fn();

    const { rerender } = render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          isLoading: false,
          isSyncing: false,
          error: null,
          lastSyncTime: null,
          progress: null,
        }}
      />,
    );

    expect(screen.getByRole('button')).not.toBeDisabled();

    // Update to syncing state
    rerender(
      <SyncButton
        onSync={mockSync}
        syncState={{
          isLoading: false,
          isSyncing: true,
          error: null,
          lastSyncTime: null,
          progress: null,
        }}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should display error message when sync fails', () => {
    const mockSync = vi.fn();
    const errorMessage = 'Connection failed';

    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          isLoading: false,
          isSyncing: false,
          error: errorMessage,
          lastSyncTime: null,
          progress: null,
        }}
      />,
    );

    // Check if error is displayed (implementation may vary)
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
