/**
 * Shared utilities for GitLab API providers
 */

export interface GitLabProxyConfig {
  gitlabUrl: string;
  token: string;
  isDev?: boolean;
}

/**
 * Convert GitLab URL to proxy URL in dev mode or with CORS proxy
 */
export function getProxyUrl(url: string, config: GitLabProxyConfig): string {
  const isDev = config.isDev ?? import.meta.env.DEV;

  // In development, use Vite proxy
  if (isDev) {
    return url.replace(config.gitlabUrl, '/api/gitlab-proxy');
  }

  // In production, check if CORS proxy is configured
  const corsProxy = import.meta.env.VITE_CORS_PROXY;
  if (corsProxy) {
    // Add CORS proxy prefix to the URL
    return `${corsProxy}/${url}`;
  }

  // No proxy, return original URL
  return url;
}

/**
 * Get headers for REST API requests
 */
export function getRestHeaders(config: GitLabProxyConfig): HeadersInit {
  const isDev = config.isDev ?? import.meta.env.DEV;

  if (isDev) {
    // In dev mode, send token via custom header for proxy
    return {
      'X-GitLab-Token': config.token,
      'Content-Type': 'application/json',
    };
  }

  // In production, use standard GitLab private token header
  return {
    'PRIVATE-TOKEN': config.token,
    'Content-Type': 'application/json',
  };
}

/**
 * Make a REST API request to GitLab with proxy support
 *
 * Error handling includes detection of common configuration issues:
 * - 404 on /projects/:id/snippets may indicate the path is a Group, not a Project
 * - 404 on /groups/:id/snippets may indicate the path is a Project, not a Group
 */
export async function gitlabRestRequest<T = any>(
  endpoint: string,
  config: GitLabProxyConfig,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.gitlabUrl}/api/v4${endpoint}`;
  const proxyUrl = getProxyUrl(url, config);

  const response = await fetch(proxyUrl, {
    ...options,
    headers: {
      ...getRestHeaders(config),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || response.statusText;
    }

    // Provide clearer guidance for common 404 errors caused by configuration type mismatch
    // This helps users understand when they've configured a group as a project or vice versa
    if (response.status === 404) {
      if (endpoint.includes('/projects/') && endpoint.includes('/snippets')) {
        // Extract path from endpoint for clearer message
        const pathMatch = endpoint.match(/\/projects\/([^/]+)/);
        const path = pathMatch
          ? decodeURIComponent(pathMatch[1])
          : 'the configured path';
        throw new Error(
          `Project "${path}" not found (404). If this is a GitLab Group (not a Project), ` +
            `please edit the configuration and change Type from "Project" to "Group".`,
        );
      }
      if (endpoint.includes('/groups/') && endpoint.includes('/snippets')) {
        // GitLab does NOT support Group Snippets - this is expected to fail.
        // See: https://gitlab.com/gitlab-org/gitlab/-/issues/15958
        // Group Snippets is a requested feature that has not been implemented.
        // The calling code handles this by disabling Holidays/ColorRules/Presets for groups.
        const pathMatch = endpoint.match(/\/groups\/([^/]+)/);
        const path = pathMatch
          ? decodeURIComponent(pathMatch[1])
          : 'the configured path';

        throw new Error(
          `Group Snippets are not supported by GitLab. ` +
            `Holidays, Color Rules, and Filter Presets are not available for group "${path}".`,
        );
      }
    }

    throw new Error(`GitLab API error: ${errorMessage}`);
  }

  // Handle empty responses (e.g., DELETE requests)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
