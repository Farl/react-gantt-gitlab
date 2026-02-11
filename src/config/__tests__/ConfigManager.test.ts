/**
 * ConfigManager Tests
 * Tests for the generic configuration manager that wraps GitLab config
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available in the hoisted vi.mock factory
const {
  mockGetAllConfigs,
  mockGetConfig,
  mockUpdateConfig,
  mockDeleteConfig,
  mockGetActiveConfig,
  mockSetActiveConfigId,
} = vi.hoisted(() => ({
  mockGetAllConfigs: vi.fn(),
  mockGetConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockDeleteConfig: vi.fn(),
  mockGetActiveConfig: vi.fn(),
  mockSetActiveConfigId: vi.fn(),
}));

vi.mock('../DataSourceConfigManager', () => ({
  gitlabConfigManager: {
    getAllConfigs: mockGetAllConfigs,
    getConfig: mockGetConfig,
    updateConfig: mockUpdateConfig,
    deleteConfig: mockDeleteConfig,
    getActiveConfig: mockGetActiveConfig,
    setActiveConfigId: mockSetActiveConfigId,
  },
}));

import { ConfigManager } from '../ConfigManager';
import type { DataSourceConfig } from '../../contexts/DataContext.types';

describe('ConfigManager', () => {
  // Sample GitLab config as returned by gitlabConfigManager
  const sampleGitLabConfig = {
    id: 'gitlab_1234_abc',
    name: 'My Project',
    credentialId: 'cred_001',
    type: 'project' as const,
    projectId: '42',
    groupId: undefined,
    fullPath: 'my-group/my-project',
    isDefault: true,
  };

  const sampleGitLabConfig2 = {
    id: 'gitlab_5678_def',
    name: 'Team Group',
    credentialId: 'cred_002',
    type: 'group' as const,
    projectId: undefined,
    groupId: 'group-77',
    fullPath: 'team-group',
    isDefault: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================
  // getAllConfigs
  // =====================
  describe('getAllConfigs', () => {
    it('should return all configs converted to generic format', () => {
      mockGetAllConfigs.mockReturnValue([
        sampleGitLabConfig,
        sampleGitLabConfig2,
      ]);

      const configs = ConfigManager.getAllConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0]).toEqual({
        id: 'gitlab_1234_abc',
        type: 'gitlab',
        credentialId: 'cred_001',
        projectId: '42',
        metadata: {
          name: 'My Project',
          configType: 'project',
          fullPath: 'my-group/my-project',
          groupId: undefined,
          isDefault: true,
        },
      });
    });

    it('should return empty array when no configs exist', () => {
      mockGetAllConfigs.mockReturnValue([]);

      const configs = ConfigManager.getAllConfigs();

      expect(configs).toEqual([]);
    });
  });

  // =====================
  // getConfig
  // =====================
  describe('getConfig', () => {
    it('should return a config by ID in generic format', () => {
      mockGetConfig.mockReturnValue(sampleGitLabConfig);

      const config = ConfigManager.getConfig('gitlab_1234_abc');

      expect(config).not.toBeNull();
      expect(config!.id).toBe('gitlab_1234_abc');
      expect(config!.type).toBe('gitlab');
      expect(config!.projectId).toBe('42');
      expect(config!.metadata?.name).toBe('My Project');
    });

    it('should return null for non-existent config', () => {
      mockGetConfig.mockReturnValue(undefined);

      const config = ConfigManager.getConfig('non-existent-id');

      expect(config).toBeNull();
    });
  });

  // =====================
  // saveConfig
  // =====================
  describe('saveConfig', () => {
    it('should save a gitlab config by converting to GitLab format', () => {
      const genericConfig: DataSourceConfig = {
        id: 'gitlab_1234_abc',
        type: 'gitlab',
        credentialId: 'cred_001',
        projectId: '42',
        metadata: {
          name: 'My Project',
          configType: 'project',
          fullPath: 'my-group/my-project',
          isDefault: true,
        },
      };

      ConfigManager.saveConfig(genericConfig);

      // ConfigManager calls gitlabConfigManager.updateConfig with the converted object
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        id: 'gitlab_1234_abc',
        name: 'My Project',
        credentialId: 'cred_001',
        type: 'project',
        projectId: '42',
        groupId: undefined,
        fullPath: 'my-group/my-project',
        isDefault: true,
      });
    });

    it('should throw error for non-gitlab config types', () => {
      const azureConfig: DataSourceConfig = {
        id: 'ado_001',
        type: 'azure-devops',
        credentialId: 'cred_003',
      };

      expect(() => ConfigManager.saveConfig(azureConfig)).toThrow(
        "Config type 'azure-devops' not yet supported",
      );
    });

    it('should use default values when metadata fields are missing', () => {
      const minimalConfig: DataSourceConfig = {
        id: 'gitlab_minimal',
        type: 'gitlab',
      };

      ConfigManager.saveConfig(minimalConfig);

      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'gitlab_minimal',
          name: 'Unnamed Config',
          credentialId: '',
          type: 'project',
        }),
      );
    });
  });

  // =====================
  // deleteConfig
  // =====================
  describe('deleteConfig', () => {
    it('should delegate deletion to gitlabConfigManager', () => {
      ConfigManager.deleteConfig('gitlab_1234_abc');

      expect(mockDeleteConfig).toHaveBeenCalledWith('gitlab_1234_abc');
    });
  });

  // =====================
  // Active Config
  // =====================
  describe('getActiveConfig', () => {
    it('should return the active config in generic format', () => {
      mockGetActiveConfig.mockReturnValue(sampleGitLabConfig);

      const config = ConfigManager.getActiveConfig();

      expect(config).not.toBeNull();
      expect(config!.id).toBe('gitlab_1234_abc');
      expect(config!.type).toBe('gitlab');
    });

    it('should return null when no active config exists', () => {
      mockGetActiveConfig.mockReturnValue(null);

      const config = ConfigManager.getActiveConfig();

      expect(config).toBeNull();
    });
  });

  describe('setActiveConfig', () => {
    it('should delegate to gitlabConfigManager.setActiveConfigId', () => {
      ConfigManager.setActiveConfig('gitlab_5678_def');

      expect(mockSetActiveConfigId).toHaveBeenCalledWith('gitlab_5678_def');
    });
  });

  // =====================
  // Format Conversion
  // =====================
  describe('format conversion (round-trip)', () => {
    it('should preserve all fields through GitLab-to-generic conversion', () => {
      mockGetConfig.mockReturnValue(sampleGitLabConfig2);

      const generic = ConfigManager.getConfig('gitlab_5678_def');

      expect(generic).toEqual({
        id: 'gitlab_5678_def',
        type: 'gitlab',
        credentialId: 'cred_002',
        projectId: undefined,
        metadata: {
          name: 'Team Group',
          configType: 'group',
          fullPath: 'team-group',
          groupId: 'group-77',
          isDefault: false,
        },
      });
    });
  });
});
