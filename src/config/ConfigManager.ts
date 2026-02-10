/**
 * Generic Configuration Manager
 *
 * Provides a data-source-agnostic interface for managing configurations.
 * Currently wraps GitLab implementation but can be extended for other sources.
 */

import type { DataSourceConfig } from '../contexts/DataContext.types';
import type { GitLabConfigV2 } from '../types/credential';
import { gitlabConfigManager } from './DataSourceConfigManager';

/**
 * Generic config manager that works with any data source
 * Currently routes to GitLab implementation based on config type
 */
export class ConfigManager {
  /**
   * Get all configurations
   */
  static getAllConfigs(): DataSourceConfig[] {
    const gitlabConfigs = gitlabConfigManager.getAllConfigs();
    return gitlabConfigs.map((config) => this.convertToGeneric(config));
  }

  /**
   * Get configuration by ID
   */
  static getConfig(id: string): DataSourceConfig | null {
    const gitlabConfig = gitlabConfigManager.getConfig(id);
    return gitlabConfig ? this.convertToGeneric(gitlabConfig) : null;
  }

  /**
   * Save or update a configuration
   */
  static saveConfig(config: DataSourceConfig): void {
    if (config.type !== 'gitlab') {
      throw new Error(`Config type '${config.type}' not yet supported`);
    }
    // Convert generic config back to GitLab format and save
    const gitlabConfig = this.convertFromGeneric(config);
    gitlabConfigManager.updateConfig(gitlabConfig);
  }

  /**
   * Delete a configuration
   */
  static deleteConfig(id: string): void {
    gitlabConfigManager.deleteConfig(id);
  }

  /**
   * Get active/default configuration
   */
  static getActiveConfig(): DataSourceConfig | null {
    const gitlabConfig = gitlabConfigManager.getActiveConfig();
    return gitlabConfig ? this.convertToGeneric(gitlabConfig) : null;
  }

  /**
   * Set active/default configuration
   */
  static setActiveConfig(id: string): void {
    gitlabConfigManager.setActiveConfigId(id);
  }

  /**
   * Convert GitLab config to generic format
   */
  private static convertToGeneric(config: GitLabConfigV2): DataSourceConfig {
    return {
      id: config.id,
      type: 'gitlab',
      credentialId: config.credentialId,
      projectId: config.projectId,
      metadata: {
        name: config.name,
        configType: config.type,
        fullPath: config.fullPath,
        groupId: config.groupId,
        isDefault: config.isDefault,
      },
    };
  }

  /**
   * Convert generic config back to GitLab format
   */
  private static convertFromGeneric(config: DataSourceConfig): GitLabConfigV2 {
    const metadata = config.metadata || {};
    return {
      id: config.id,
      name: (metadata.name as string) || 'Unnamed Config',
      credentialId: config.credentialId || '',
      type: (metadata.configType as 'project' | 'group') || 'project',
      projectId: config.projectId,
      groupId: metadata.groupId as string | undefined,
      fullPath: metadata.fullPath as string | undefined,
      isDefault: metadata.isDefault as boolean | undefined,
    };
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
