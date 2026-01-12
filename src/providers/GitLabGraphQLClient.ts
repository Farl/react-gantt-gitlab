/**
 * GitLab GraphQL Client
 * Handles GraphQL API requests for GitLab
 */

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface GitLabGraphQLConfig {
  gitlabUrl: string;
  token: string;
}

export class GitLabGraphQLClient {
  private config: GitLabGraphQLConfig;

  constructor(config: GitLabGraphQLConfig) {
    this.config = config;
  }

  /**
   * Check if running in dev mode
   */
  private get isDev(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * Get GraphQL endpoint URL
   */
  private getEndpoint(): string {
    const endpoint = `${this.config.gitlabUrl}/api/graphql`;

    // In development, use Vite proxy
    if (this.isDev) {
      return endpoint.replace(this.config.gitlabUrl, '/api/gitlab-proxy');
    }

    // In production, check if CORS proxy is configured
    const corsProxy = import.meta.env.VITE_CORS_PROXY;
    if (corsProxy) {
      return `${corsProxy}/${endpoint}`;
    }

    return endpoint;
  }

  /**
   * Get request headers
   */
  private getHeaders(): HeadersInit {
    if (this.isDev) {
      return {
        'X-GitLab-Token': this.config.token,
        'Content-Type': 'application/json',
      };
    }
    return {
      Authorization: `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Execute GraphQL query
   *
   * Error handling includes detection of common configuration issues:
   * - "project not found" may indicate a group was configured as a project
   * - "group not found" may indicate a project was configured as a group
   */
  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const endpoint = this.getEndpoint();
    const headers = this.getHeaders();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map((e) => e.message).join(', ');

      // Check for common configuration type mismatch errors
      // This helps users understand when they've configured a group as a project or vice versa
      const lowerError = errorMessage.toLowerCase();
      if (
        lowerError.includes('project') &&
        (lowerError.includes('not found') ||
          lowerError.includes('does not exist'))
      ) {
        throw new Error(
          `Project not found. If "${variables?.fullPath}" is a GitLab Group (not a Project), ` +
            `please edit the configuration and change Type from "Project" to "Group". ` +
            `Original error: ${errorMessage}`,
        );
      }
      if (
        lowerError.includes('group') &&
        (lowerError.includes('not found') ||
          lowerError.includes('does not exist'))
      ) {
        throw new Error(
          `Group not found. If "${variables?.fullPath}" is a GitLab Project (not a Group), ` +
            `please edit the configuration and change Type from "Group" to "Project". ` +
            `Original error: ${errorMessage}`,
        );
      }

      throw new Error(`GraphQL errors: ${errorMessage}`);
    }

    if (!result.data) {
      throw new Error('GraphQL response has no data');
    }

    return result.data;
  }

  /**
   * Execute GraphQL mutation
   */
  async mutate<T>(
    mutation: string,
    variables?: Record<string, any>,
  ): Promise<T> {
    return this.query<T>(mutation, variables);
  }
}
