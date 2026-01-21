/**
 * useBlueprint Hook
 *
 * 管理 Blueprint 的載入、儲存、刪除、重命名等操作。
 * 支援 localStorage 和 GitLab Snippet 兩種儲存方式。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GitLabProxyConfig } from '../providers/GitLabApiUtils';
import type { Blueprint } from '../types/blueprint';
import {
  loadAllBlueprints,
  addBlueprint as apiAddBlueprint,
  deleteBlueprint as apiDeleteBlueprint,
  updateBlueprintName as apiUpdateBlueprintName,
  canUseSnippetStorage,
} from '../providers/GitLabBlueprintApi';

export interface UseBlueprintOptions {
  /** Project/Group 的完整路徑 */
  fullPath: string | null;
  /** GitLab API 配置 */
  proxyConfig: GitLabProxyConfig | null;
  /** 配置類型 */
  configType: 'project' | 'group';
  /** Project/Group ID */
  id: string | number | null;
}

export interface UseBlueprintResult {
  /** Blueprint 列表 (合併 localStorage 和 Snippet) */
  blueprints: Blueprint[];
  /** 是否正在載入 */
  loading: boolean;
  /** 錯誤訊息 */
  error: string | null;
  /** 是否可以使用 Snippet 儲存 */
  canUseSnippet: boolean;

  /** 新增 Blueprint */
  addBlueprint: (blueprint: Blueprint) => Promise<void>;
  /** 刪除 Blueprint */
  deleteBlueprint: (
    blueprintId: string,
    storageType: 'snippet' | 'localStorage',
  ) => Promise<void>;
  /** 重命名 Blueprint */
  renameBlueprint: (
    blueprintId: string,
    newName: string,
    storageType: 'snippet' | 'localStorage',
  ) => Promise<void>;
  /** 重新載入 */
  reload: () => Promise<void>;
}

/**
 * Blueprint 管理 Hook
 */
export function useBlueprint(options: UseBlueprintOptions): UseBlueprintResult {
  const { fullPath, proxyConfig, configType, id } = options;

  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 避免 stale closure
  const fullPathRef = useRef(fullPath);
  fullPathRef.current = fullPath;

  const proxyConfigRef = useRef(proxyConfig);
  proxyConfigRef.current = proxyConfig;

  const configTypeRef = useRef(configType);
  configTypeRef.current = configType;

  const idRef = useRef(id);
  idRef.current = id;

  // 是否可以使用 Snippet 儲存
  const canUseSnippet = canUseSnippetStorage(configType);

  // 載入 Blueprints
  const loadBlueprints = useCallback(async () => {
    const currentFullPath = fullPathRef.current;
    const currentProxyConfig = proxyConfigRef.current;
    const currentConfigType = configTypeRef.current;
    const currentId = idRef.current;

    if (!currentFullPath || !currentId) {
      setBlueprints([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loaded = await loadAllBlueprints(
        currentFullPath,
        currentProxyConfig,
        currentConfigType,
        currentId,
      );

      // 按建立時間排序 (新的在前)
      loaded.sort((a, b) => {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      setBlueprints(loaded);
    } catch (err) {
      console.error('[useBlueprint] Failed to load blueprints:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load blueprints',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadBlueprints();
  }, [loadBlueprints, fullPath, configType, id]);

  // 新增 Blueprint
  const addBlueprint = useCallback(
    async (blueprint: Blueprint) => {
      const currentFullPath = fullPathRef.current;
      const currentProxyConfig = proxyConfigRef.current;
      const currentConfigType = configTypeRef.current;
      const currentId = idRef.current;

      if (!currentFullPath || !currentId) {
        throw new Error('Configuration not ready');
      }

      try {
        await apiAddBlueprint(
          blueprint,
          currentFullPath,
          currentProxyConfig,
          currentConfigType,
          currentId,
        );

        // 重新載入
        await loadBlueprints();
      } catch (err) {
        console.error('[useBlueprint] Failed to add blueprint:', err);
        throw err;
      }
    },
    [loadBlueprints],
  );

  // 刪除 Blueprint
  const deleteBlueprint = useCallback(
    async (blueprintId: string, storageType: 'snippet' | 'localStorage') => {
      const currentFullPath = fullPathRef.current;
      const currentProxyConfig = proxyConfigRef.current;
      const currentConfigType = configTypeRef.current;
      const currentId = idRef.current;

      if (!currentFullPath || !currentId) {
        throw new Error('Configuration not ready');
      }

      try {
        await apiDeleteBlueprint(
          blueprintId,
          storageType,
          currentFullPath,
          currentProxyConfig,
          currentConfigType,
          currentId,
        );

        // 重新載入
        await loadBlueprints();
      } catch (err) {
        console.error('[useBlueprint] Failed to delete blueprint:', err);
        throw err;
      }
    },
    [loadBlueprints],
  );

  // 重命名 Blueprint
  const renameBlueprint = useCallback(
    async (
      blueprintId: string,
      newName: string,
      storageType: 'snippet' | 'localStorage',
    ) => {
      const currentFullPath = fullPathRef.current;
      const currentProxyConfig = proxyConfigRef.current;
      const currentConfigType = configTypeRef.current;
      const currentId = idRef.current;

      if (!currentFullPath || !currentId) {
        throw new Error('Configuration not ready');
      }

      try {
        await apiUpdateBlueprintName(
          blueprintId,
          newName,
          storageType,
          currentFullPath,
          currentProxyConfig,
          currentConfigType,
          currentId,
        );

        // 重新載入
        await loadBlueprints();
      } catch (err) {
        console.error('[useBlueprint] Failed to rename blueprint:', err);
        throw err;
      }
    },
    [loadBlueprints],
  );

  return {
    blueprints,
    loading,
    error,
    canUseSnippet,
    addBlueprint,
    deleteBlueprint,
    renameBlueprint,
    reload: loadBlueprints,
  };
}
