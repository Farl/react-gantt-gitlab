/**
 * DataProviderFactory Tests
 * Tests for the factory that creates data provider instances
 */

import { describe, it, expect, vi } from 'vitest';

// Use vi.hoisted for the mock class so it's available in the hoisted vi.mock factory
const { MockGitLabGraphQLProvider } = vi.hoisted(() => {
  class MockGitLabGraphQLProvider {
    constructor(_config: unknown) {}
    getData = vi.fn();
    updateWorkItem = vi.fn();
    createWorkItem = vi.fn();
    deleteWorkItem = vi.fn();
    createIssueLink = vi.fn();
    deleteIssueLink = vi.fn();
    reorderWorkItem = vi.fn();
    getFilterOptions = vi.fn();
    checkCanEdit = vi.fn();
  }
  return { MockGitLabGraphQLProvider };
});

vi.mock('../../GitLabGraphQLProvider', () => ({
  GitLabGraphQLProvider: MockGitLabGraphQLProvider,
}));

import { DataProviderFactory } from '../DataProviderFactory';
import { GitLabAdapter } from '../../adapters/GitLabAdapter';
import type { DataProviderConfig } from '../DataProviderInterface';

describe('DataProviderFactory', () => {
  const validGitLabConfig: DataProviderConfig = {
    type: 'gitlab',
    sourceUrl: 'https://gitlab.example.com',
    credentials: { token: 'test-token-123' },
    projectId: '42',
    metadata: {
      configType: 'project',
      fullPath: 'my-group/my-project',
    },
  };

  it('should create a GitLabAdapter for type "gitlab"', () => {
    const provider = DataProviderFactory.create(validGitLabConfig);

    expect(provider).toBeInstanceOf(GitLabAdapter);
  });

  it('should throw error for azure-devops type (not yet implemented)', () => {
    const config: DataProviderConfig = {
      type: 'azure-devops',
      sourceUrl: 'https://dev.azure.com/org',
      credentials: { token: 'ado-token' },
    };

    expect(() => DataProviderFactory.create(config)).toThrow(
      'Azure DevOps provider not yet implemented',
    );
  });

  it('should throw error for custom type (not yet implemented)', () => {
    const config: DataProviderConfig = {
      type: 'custom',
      sourceUrl: 'https://custom-api.example.com',
    };

    expect(() => DataProviderFactory.create(config)).toThrow(
      'Custom data provider not yet implemented',
    );
  });

  it('should throw error for unknown provider type', () => {
    const config = {
      type: 'jira',
      sourceUrl: 'https://jira.example.com',
    } as unknown as DataProviderConfig;

    expect(() => DataProviderFactory.create(config)).toThrow(
      'Unknown data provider type: jira',
    );
  });

  it('should propagate validation errors from GitLabAdapter constructor', () => {
    // Missing sourceUrl
    const configNoUrl: DataProviderConfig = {
      type: 'gitlab',
      credentials: { token: 'test-token' },
    };

    expect(() => DataProviderFactory.create(configNoUrl)).toThrow(
      'GitLab adapter requires sourceUrl in config',
    );
  });

  it('should pass the full config to the GitLabAdapter', () => {
    const provider = DataProviderFactory.create(validGitLabConfig);
    const returnedConfig = provider.getConfig();

    expect(returnedConfig).toEqual(validGitLabConfig);
  });
});
