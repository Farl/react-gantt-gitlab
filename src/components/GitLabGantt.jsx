/**
 * GitLabGantt (Backward Compatibility Wrapper)
 *
 * @deprecated Use GitLabWorkspace instead for new code.
 * This component is kept for backward compatibility.
 */

import { GitLabWorkspace } from './GitLabWorkspace';

export function GitLabGantt(props) {
  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[GitLabGantt] This component is deprecated. ' +
        'Use GitLabWorkspace for new code.',
    );
  }

  return <GitLabWorkspace {...props} />;
}
