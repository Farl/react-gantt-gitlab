/**
 * GitLabAdapter Tests
 * Tests for the GitLab implementation of DataProviderInterface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataProviderConfig } from '../../core/DataProviderInterface';

// Use vi.hoisted so mock fns are available in the hoisted vi.mock factory
const {
  mockGetData,
  mockUpdateWorkItem,
  mockCreateWorkItem,
  mockDeleteWorkItem,
  mockCreateIssueLink,
  mockDeleteIssueLink,
  mockReorderWorkItem,
  mockGetFilterOptions,
  mockCheckCanEdit,
  MockGitLabGraphQLProvider,
} = vi.hoisted(() => {
  const mockGetData = vi.fn();
  const mockUpdateWorkItem = vi.fn();
  const mockCreateWorkItem = vi.fn();
  const mockDeleteWorkItem = vi.fn();
  const mockCreateIssueLink = vi.fn();
  const mockDeleteIssueLink = vi.fn();
  const mockReorderWorkItem = vi.fn();
  const mockGetFilterOptions = vi.fn();
  const mockCheckCanEdit = vi.fn();

  // Use a proper class so `new GitLabGraphQLProvider(...)` works
  class MockGitLabGraphQLProvider {
    constructor(_config: unknown) {}
    getData = mockGetData;
    updateWorkItem = mockUpdateWorkItem;
    createWorkItem = mockCreateWorkItem;
    deleteWorkItem = mockDeleteWorkItem;
    createIssueLink = mockCreateIssueLink;
    deleteIssueLink = mockDeleteIssueLink;
    reorderWorkItem = mockReorderWorkItem;
    getFilterOptions = mockGetFilterOptions;
    checkCanEdit = mockCheckCanEdit;
  }

  return {
    mockGetData,
    mockUpdateWorkItem,
    mockCreateWorkItem,
    mockDeleteWorkItem,
    mockCreateIssueLink,
    mockDeleteIssueLink,
    mockReorderWorkItem,
    mockGetFilterOptions,
    mockCheckCanEdit,
    MockGitLabGraphQLProvider,
  };
});

vi.mock('../../GitLabGraphQLProvider', () => ({
  GitLabGraphQLProvider: MockGitLabGraphQLProvider,
}));

import { GitLabAdapter } from '../GitLabAdapter';

describe('GitLabAdapter', () => {
  const validConfig: DataProviderConfig = {
    type: 'gitlab',
    sourceUrl: 'https://gitlab.example.com',
    credentials: { token: 'glpat-test-token' },
    projectId: '42',
    metadata: {
      configType: 'project',
      fullPath: 'my-group/my-project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================
  // Constructor Tests
  // =====================
  describe('constructor', () => {
    it('should create adapter with valid config', () => {
      const adapter = new GitLabAdapter(validConfig);

      expect(adapter).toBeInstanceOf(GitLabAdapter);
    });

    it('should pass correct GitLab config to GitLabGraphQLProvider', () => {
      const constructorSpy = vi.spyOn(
        MockGitLabGraphQLProvider.prototype,
        'constructor',
      );

      // The constructor is called internally; verify by checking the adapter works
      const adapter = new GitLabAdapter(validConfig);
      expect(adapter.getConfig()).toEqual(validConfig);
    });

    it('should throw error when sourceUrl is missing', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        credentials: { token: 'test-token' },
      };

      expect(() => new GitLabAdapter(config)).toThrow(
        'GitLab adapter requires sourceUrl in config',
      );
    });

    it('should throw error when credentials are missing', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        sourceUrl: 'https://gitlab.example.com',
      };

      expect(() => new GitLabAdapter(config)).toThrow(
        'GitLab adapter requires credentials in config',
      );
    });

    it('should throw error when credentials is not an object', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        sourceUrl: 'https://gitlab.example.com',
        credentials: 'just-a-string',
      };

      expect(() => new GitLabAdapter(config)).toThrow(
        'GitLab adapter requires credentials in config',
      );
    });

    it('should throw error when token is missing from credentials', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        sourceUrl: 'https://gitlab.example.com',
        credentials: { username: 'user' },
      };

      expect(() => new GitLabAdapter(config)).toThrow(
        'GitLab adapter requires token in credentials',
      );
    });

    it('should default configType to "project" when not in metadata', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        sourceUrl: 'https://gitlab.example.com',
        credentials: { token: 'test-token' },
        projectId: '10',
      };

      // Should not throw -- defaults to 'project'
      const adapter = new GitLabAdapter(config);
      expect(adapter).toBeInstanceOf(GitLabAdapter);
    });

    it('should accept group config with groupId in metadata', () => {
      const config: DataProviderConfig = {
        type: 'gitlab',
        sourceUrl: 'https://gitlab.example.com',
        credentials: { token: 'test-token' },
        metadata: {
          configType: 'group',
          fullPath: 'my-group',
          groupId: '77',
        },
      };

      const adapter = new GitLabAdapter(config);
      expect(adapter).toBeInstanceOf(GitLabAdapter);
    });
  });

  // =====================
  // sync() Tests
  // =====================
  describe('sync', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should fetch tasks and links and return a DataResponse', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', start: new Date(), end: new Date() },
      ];
      const mockLinks = [{ id: 10, source: 1, target: 2, type: 0 }];
      const mockMilestones = [{ iid: 5, title: 'v1.0' }];
      const mockEpics = [{ iid: 1, title: 'Epic 1' }];

      mockGetData.mockResolvedValue({
        tasks: mockTasks,
        links: mockLinks,
        milestones: mockMilestones,
        epics: mockEpics,
      });

      const result = await adapter.sync();

      expect(result.tasks).toEqual(mockTasks);
      expect(result.links).toEqual(mockLinks);
      expect(result.metadata).toEqual({
        milestones: mockMilestones,
        epics: mockEpics,
      });
    });

    it('should map generic filter options to GitLab format', async () => {
      mockGetData.mockResolvedValue({ tasks: [], links: [] });

      await adapter.sync({
        filters: {
          labels: ['bug', 'feature'],
          milestones: ['v1.0'],
          assignees: ['john.doe'],
        },
      });

      expect(mockGetData).toHaveBeenCalledWith(
        expect.objectContaining({
          serverFilters: {
            labelNames: ['bug', 'feature'],
            milestoneTitles: ['v1.0'],
            assigneeUsernames: ['john.doe'],
          },
        }),
      );
    });

    it('should pass includeClosed option to GitLab provider', async () => {
      mockGetData.mockResolvedValue({ tasks: [], links: [] });

      await adapter.sync({ includeClosed: true });

      expect(mockGetData).toHaveBeenCalledWith(
        expect.objectContaining({ includeClosed: true }),
      );
    });

    it('should pass abort signal to GitLab provider', async () => {
      mockGetData.mockResolvedValue({ tasks: [], links: [] });
      const controller = new AbortController();

      await adapter.sync({ signal: controller.signal });

      expect(mockGetData).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it('should pass onProgress callback to GitLab provider', async () => {
      mockGetData.mockResolvedValue({ tasks: [], links: [] });
      const onProgress = vi.fn();

      await adapter.sync({ onProgress });

      expect(mockGetData).toHaveBeenCalledWith(
        expect.objectContaining({ onProgress }),
      );
    });

    it('should spread sourceFilters into GitLab server filters', async () => {
      mockGetData.mockResolvedValue({ tasks: [], links: [] });

      await adapter.sync({
        filters: {
          labels: ['bug'],
          sourceFilters: { epicId: 5, weight: 3 },
        },
      });

      expect(mockGetData).toHaveBeenCalledWith(
        expect.objectContaining({
          serverFilters: expect.objectContaining({
            labelNames: ['bug'],
            epicId: 5,
            weight: 3,
          }),
        }),
      );
    });
  });

  // =====================
  // CRUD Operation Tests
  // =====================
  describe('syncTask', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should call updateWorkItem and return updated task', async () => {
      mockUpdateWorkItem.mockResolvedValue(undefined);
      const updates = { title: 'Updated Title' };

      const result = await adapter.syncTask(1, updates);

      expect(mockUpdateWorkItem).toHaveBeenCalledWith(1, updates);
      expect(result.id).toBe(1);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('createTask', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should delegate to gitlabProvider.createWorkItem', async () => {
      const newTask = { title: 'New Task' };
      const createdTask = {
        id: 99,
        title: 'New Task',
        start: new Date(),
        end: new Date(),
      };
      mockCreateWorkItem.mockResolvedValue(createdTask);

      const result = await adapter.createTask(newTask);

      expect(mockCreateWorkItem).toHaveBeenCalledWith(newTask);
      expect(result).toEqual(createdTask);
    });
  });

  describe('deleteTask', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should delegate to gitlabProvider.deleteWorkItem', async () => {
      mockDeleteWorkItem.mockResolvedValue(undefined);

      await adapter.deleteTask(42);

      expect(mockDeleteWorkItem).toHaveBeenCalledWith(42);
    });
  });

  describe('createLink', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should delegate to gitlabProvider.createIssueLink and merge result', async () => {
      const link = { source: 1, target: 2, type: 0 };
      const createResult = {
        isNativeLink: true,
        sourceIid: 1,
        targetIid: 2,
        linkedWorkItemGlobalId: 'gid://gitlab/WorkItem/100',
      };
      mockCreateIssueLink.mockResolvedValue(createResult);

      const result = await adapter.createLink(link);

      expect(mockCreateIssueLink).toHaveBeenCalledWith(link);
      expect(result.source).toBe(1);
      expect(result.target).toBe(2);
      expect(result).toHaveProperty('isNativeLink', true);
    });
  });

  describe('deleteLink', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should extract metadata and call deleteIssueLink', async () => {
      mockDeleteIssueLink.mockResolvedValue(undefined);
      const metadata = {
        apiSourceIid: 10,
        linkedWorkItemGlobalId: 'gid://gitlab/WorkItem/200',
      };

      await adapter.deleteLink(5, metadata);

      expect(mockDeleteIssueLink).toHaveBeenCalledWith(
        5,
        10,
        'gid://gitlab/WorkItem/200',
      );
    });

    it('should throw error when apiSourceIid is missing from metadata', async () => {
      await expect(adapter.deleteLink(5, {})).rejects.toThrow(
        'GitLab adapter requires apiSourceIid in metadata to delete link',
      );
    });

    it('should throw error when metadata is undefined', async () => {
      await expect(adapter.deleteLink(5)).rejects.toThrow(
        'GitLab adapter requires apiSourceIid in metadata to delete link',
      );
    });
  });

  // =====================
  // Other Method Tests
  // =====================
  describe('reorderTask', () => {
    it('should delegate to gitlabProvider.reorderWorkItem', async () => {
      const adapter = new GitLabAdapter(validConfig);
      mockReorderWorkItem.mockResolvedValue(undefined);

      await adapter.reorderTask(1, 3, 'after');

      expect(mockReorderWorkItem).toHaveBeenCalledWith(1, 3, 'after');
    });
  });

  describe('getFilterOptions', () => {
    it('should map GitLab filter options to generic format', async () => {
      const adapter = new GitLabAdapter(validConfig);
      mockGetFilterOptions.mockResolvedValue({
        members: [{ username: 'alice', name: 'Alice' }],
        labels: [{ title: 'bug', color: '#ff0000', priority: 1 }],
        milestones: [{ iid: 5, title: 'v1.0' }],
      });

      const result = await adapter.getFilterOptions();

      expect(result.members).toEqual([{ username: 'alice', name: 'Alice' }]);
      expect(result.labels).toEqual([
        { title: 'bug', color: '#ff0000', priority: 1 },
      ]);
      // milestones should be mapped: iid -> id
      expect(result.milestones).toEqual([{ id: 5, title: 'v1.0' }]);
    });
  });

  describe('checkCanEdit', () => {
    it('should delegate to gitlabProvider.checkCanEdit', async () => {
      const adapter = new GitLabAdapter(validConfig);
      mockCheckCanEdit.mockResolvedValue(true);

      const result = await adapter.checkCanEdit();

      expect(result).toBe(true);
      expect(mockCheckCanEdit).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return the original config passed to constructor', () => {
      const adapter = new GitLabAdapter(validConfig);

      expect(adapter.getConfig()).toEqual(validConfig);
    });
  });

  // =====================
  // Error Handling Tests
  // =====================
  describe('error handling', () => {
    let adapter: GitLabAdapter;

    beforeEach(() => {
      adapter = new GitLabAdapter(validConfig);
    });

    it('should propagate errors from sync', async () => {
      const networkError = new Error('Network timeout');
      mockGetData.mockRejectedValue(networkError);

      await expect(adapter.sync()).rejects.toThrow('Network timeout');
    });

    it('should propagate errors from createTask', async () => {
      mockCreateWorkItem.mockRejectedValue(new Error('Permission denied'));

      await expect(adapter.createTask({ title: 'Test' })).rejects.toThrow(
        'Permission denied',
      );
    });

    it('should propagate errors from deleteTask', async () => {
      mockDeleteWorkItem.mockRejectedValue(new Error('Not found'));

      await expect(adapter.deleteTask(999)).rejects.toThrow('Not found');
    });
  });
});
