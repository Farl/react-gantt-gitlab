# Phase 1: 建立共享資料層 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 從 GitLabGantt.jsx 抽出共享資料層到 GitLabDataContext，建立 GitLabWorkspace 容器，為 Kanban 視圖做準備。

**Architecture:** 建立 React Context 包裝資料層（tasks, links, sync, filters），GitLabWorkspace 作為新入口提供 Context，現有 GitLabGantt 重構為 GanttView 消費 Context。保持向後相容：export GitLabGantt 作為 alias。

**Tech Stack:** React Context API, TypeScript interfaces

---

## Task 1: 建立 Issue Board 類型定義

**Files:**

- Create: `src/types/issueBoard.ts`

**Step 1: 建立類型定義檔案**

```typescript
// src/types/issueBoard.ts

/**
 * Issue Board (Kanban) Type Definitions
 */

/** 單一 Kanban List 的定義 */
export interface IssueBoardList {
  /** UUID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 篩選的 label 名稱（AND 邏輯：issue 必須包含所有 labels） */
  labels: string[];
  /** 排序欄位 */
  sortBy: 'position' | 'due_date' | 'created_at' | 'label_priority' | 'id';
  /** 排序順序 */
  sortOrder: 'asc' | 'desc';
}

/** Issue Board 定義 */
export interface IssueBoard {
  /** UUID */
  id: string;
  /** Board 名稱 */
  name: string;
  /** List 定義（順序即為顯示順序） */
  lists: IssueBoardList[];
  /** 是否顯示 Others list（未分類的 issues） */
  showOthers: boolean;
  /** 是否顯示 Closed list（已關閉的 issues） */
  showClosed: boolean;
  /** 預留擴充的 metadata */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    [key: string]: unknown;
  };
}

/** Snippet 儲存格式 */
export interface IssueBoardStorage {
  version: 1;
  boards: IssueBoard[];
}

/** 預設 Board 模板 */
export const DEFAULT_BOARD_TEMPLATES = {
  kanban: {
    name: 'To Do / In Progress / Done',
    lists: [
      { name: 'To Do', labels: ['todo'], sortBy: 'position', sortOrder: 'asc' },
      {
        name: 'In Progress',
        labels: ['doing'],
        sortBy: 'position',
        sortOrder: 'asc',
      },
      { name: 'Done', labels: ['done'], sortBy: 'position', sortOrder: 'asc' },
    ],
  },
  bugTriage: {
    name: 'Bug Triage',
    lists: [
      { name: 'New', labels: ['bug'], sortBy: 'created_at', sortOrder: 'desc' },
      {
        name: 'Confirmed',
        labels: ['bug', 'confirmed'],
        sortBy: 'label_priority',
        sortOrder: 'asc',
      },
      {
        name: 'In Progress',
        labels: ['bug', 'doing'],
        sortBy: 'due_date',
        sortOrder: 'asc',
      },
    ],
  },
} as const;
```

**Step 2: Commit**

```bash
git add src/types/issueBoard.ts
git commit -m "feat(types): add Issue Board type definitions

- IssueBoardList: single kanban list with label filters and sort settings
- IssueBoard: complete board with lists and special list toggles
- IssueBoardStorage: snippet storage format with version
- DEFAULT_BOARD_TEMPLATES: preset templates for quick board creation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立 GitLabDataContext 類型定義

**Files:**

- Create: `src/contexts/GitLabDataContext.types.ts`

**Step 1: 建立 Context 類型定義**

```typescript
// src/contexts/GitLabDataContext.types.ts

import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  GitLabMilestone,
  GitLabEpic,
  GitLabSyncOptions,
} from '../types/gitlab';
import type { SyncState } from '../hooks/useGitLabSync';
import type { FilterPreset } from '../types/filterPreset';
import type { GitLabDataProvider } from '../providers/GitLabDataProvider';
import type { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';

/** Server filter options from GitLab (labels, milestones, members) */
export interface ServerFilterOptions {
  labels?: Array<{ name: string; color: string }>;
  milestones?: Array<{ id: number; title: string; iid: number }>;
  members?: Array<{ id: number; username: string; name: string }>;
}

/** GitLab project/group configuration */
export interface GitLabConfig {
  id: string;
  type: 'project' | 'group';
  projectId?: string;
  groupId?: string;
  credentialId?: string;
}

/** Proxy configuration for API calls */
export interface ProxyConfig {
  gitlabUrl: string;
  token: string;
}

/** Toast notification function type */
export type ShowToastFn = (
  message: string,
  type?: 'info' | 'success' | 'warning' | 'error',
) => void;

/** GitLabDataContext value type */
export interface GitLabDataContextValue {
  // === Core Data ===
  /** All tasks (issues + milestones) from GitLab */
  tasks: ITask[];
  /** Issue links/dependencies */
  links: ILink[];
  /** GitLab milestones */
  milestones: GitLabMilestone[];
  /** GitLab epics (Premium feature) */
  epics: GitLabEpic[];

  // === Sync State & Actions ===
  /** Current sync state (loading, error, etc.) */
  syncState: SyncState;
  /** Trigger a full sync from GitLab */
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  /** Sync a single task update to GitLab */
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  /** Create a new task (issue) */
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  /** Create a new milestone */
  createMilestone: (milestone: Partial<ITask>) => Promise<ITask>;
  /** Delete a task */
  deleteTask: (id: number | string, taskData?: ITask) => Promise<void>;
  /** Create an issue link */
  createLink: (link: Partial<ILink>) => Promise<void>;
  /** Delete an issue link */
  deleteLink: (
    linkId: number | string,
    apiSourceIid: number | string,
    linkedWorkItemGlobalId: string | undefined,
    options?: {
      isNativeLink?: boolean;
      metadataRelation?: 'blocks' | 'blocked_by';
      metadataTargetIid?: number;
    },
  ) => Promise<void>;

  // === Configuration ===
  /** Current project/group configuration */
  currentConfig: GitLabConfig | null;
  /** GitLab data provider instance */
  provider: GitLabDataProvider | GitLabGraphQLProvider | null;
  /** All available configurations */
  configs: GitLabConfig[];
  /** Reload configurations from storage */
  reloadConfigs: () => void;
  /** Change current configuration */
  handleConfigChange: (config: GitLabConfig) => void;
  /** Quick switch between configs */
  handleQuickSwitch: (configId: string) => void;
  /** Current project path (e.g., "group/project") */
  projectPath: string;
  /** Proxy configuration for API calls */
  proxyConfig: ProxyConfig | null;
  /** Configuration version (increments on change) */
  configVersion: number;

  // === Filter State ===
  /** Client-side filter options (milestone, epic, label, assignee, etc.) */
  filterOptions: Record<string, unknown>;
  /** Set filter options */
  setFilterOptions: (options: Record<string, unknown>) => void;
  /** Server filter options (available labels, milestones, members from GitLab) */
  serverFilterOptions: ServerFilterOptions | null;
  /** Whether server filter options are loading */
  serverFilterOptionsLoading: boolean;
  /** Active server filters (applied to API calls) */
  activeServerFilters: GitLabSyncOptions | null;
  /** Set active server filters */
  setActiveServerFilters: (filters: GitLabSyncOptions | null) => void;

  // === Filter Presets ===
  /** Available filter presets */
  filterPresets: FilterPreset[];
  /** Whether presets are loading */
  presetsLoading: boolean;
  /** Whether presets are being saved */
  presetsSaving: boolean;
  /** Create a new filter preset */
  createNewPreset: (name: string, filters: unknown) => Promise<void>;
  /** Update an existing preset */
  updatePreset: (id: string, filters: unknown) => Promise<void>;
  /** Rename a preset */
  renamePreset: (id: string, name: string) => Promise<void>;
  /** Delete a preset */
  deletePreset: (id: string) => Promise<void>;
  /** Currently selected preset ID */
  lastUsedPresetId: string | null;
  /** Whether current filters differ from selected preset */
  filterDirty: boolean;
  /** Handle preset selection */
  handlePresetSelect: (presetId: string | null) => void;
  /** Handle filter change */
  handleFilterChange: (
    newFilters: Record<string, unknown>,
    isUserAction?: boolean,
  ) => void;
  /** Handle server filter apply */
  handleServerFilterApply: (
    serverFilters: unknown,
    isUserAction?: boolean,
  ) => Promise<void>;

  // === Permissions ===
  /** Whether user can edit holidays/snippets */
  canEditHolidays: boolean;

  // === Holidays & Workdays ===
  /** Holiday dates */
  holidays: Date[];
  /** Extra working days (weekends that are workdays) */
  workdays: Date[];
  /** Color rules for task highlighting */
  colorRules: unknown[];
  /** Holidays text (raw input) */
  holidaysText: string;
  /** Workdays text (raw input) */
  workdaysText: string;
  /** Whether holidays are loading */
  holidaysLoading: boolean;
  /** Whether holidays are being saved */
  holidaysSaving: boolean;
  /** Holidays error message */
  holidaysError: string | null;
  /** Set holidays text */
  setHolidaysText: (text: string) => void;
  /** Set workdays text */
  setWorkdaysText: (text: string) => void;
  /** Set color rules */
  setColorRules: (rules: unknown[]) => void;

  // === Utility Functions ===
  /** Show toast notification */
  showToast: ShowToastFn;
  /** Count workdays between two dates */
  countWorkdays: (start: Date, end: Date) => number;
  /** Calculate end date by adding workdays */
  calculateEndDateByWorkdays: (start: Date, workdays: number) => Date;
}
```

**Step 2: Commit**

```bash
git add src/contexts/GitLabDataContext.types.ts
git commit -m "feat(context): add GitLabDataContext type definitions

Comprehensive types for the shared data context including:
- Core data (tasks, links, milestones, epics)
- Sync state and CRUD operations
- Configuration management
- Filter state and presets
- Holidays and workdays
- Utility functions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立 GitLabDataContext 骨架

**Files:**

- Create: `src/contexts/GitLabDataContext.tsx`

**Step 1: 建立 Context 骨架**

```typescript
// src/contexts/GitLabDataContext.tsx

import { createContext, useContext, type ReactNode } from 'react';
import type { GitLabDataContextValue } from './GitLabDataContext.types';

/**
 * GitLabDataContext
 *
 * Shared context for GitLab data between Gantt and Kanban views.
 * Provides access to tasks, links, sync operations, and filter state.
 */
const GitLabDataContext = createContext<GitLabDataContextValue | null>(null);

/**
 * Hook to access GitLab data context
 * @throws Error if used outside of GitLabDataProvider
 */
export function useGitLabData(): GitLabDataContextValue {
  const context = useContext(GitLabDataContext);
  if (!context) {
    throw new Error('useGitLabData must be used within a GitLabDataProvider');
  }
  return context;
}

/**
 * Hook to optionally access GitLab data context
 * Returns null if used outside of GitLabDataProvider (no error)
 */
export function useGitLabDataOptional(): GitLabDataContextValue | null {
  return useContext(GitLabDataContext);
}

export interface GitLabDataProviderProps {
  children: ReactNode;
  /** Initial config ID to load */
  initialConfigId?: string;
  /** Whether to auto-sync on mount */
  autoSync?: boolean;
}

/**
 * GitLabDataProvider
 *
 * Provider component that manages GitLab data state and exposes it via context.
 * This will be implemented in Task 4.
 */
export function GitLabDataProvider({
  children,
  initialConfigId,
  autoSync = false,
}: GitLabDataProviderProps) {
  // TODO: Implementation will be added in Task 4
  // For now, throw to indicate incomplete implementation
  throw new Error(
    'GitLabDataProvider is not yet implemented. ' +
      'This is a placeholder for the shared data layer.',
  );
}

export { GitLabDataContext };
export type { GitLabDataContextValue };
```

**Step 2: Commit**

```bash
git add src/contexts/GitLabDataContext.tsx
git commit -m "feat(context): add GitLabDataContext skeleton

- GitLabDataContext: React context for shared data
- useGitLabData: hook with error if outside provider
- useGitLabDataOptional: hook that returns null outside provider
- GitLabDataProvider: placeholder component (to be implemented)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 實作 GitLabDataProvider（從 GitLabGantt 抽取）

**Files:**

- Modify: `src/contexts/GitLabDataContext.tsx`
- Reference: `src/components/GitLabGantt.jsx` (lines 149-890)

**Step 1: 實作 GitLabDataProvider**

這是一個大型步驟，需要從 GitLabGantt.jsx 抽取以下 hooks 和 state：

- `useProjectConfig` - 配置管理
- `useGitLabSync` - 資料同步
- `useGitLabHolidays` - 假日/工作日
- `useFilterPresets` - 篩選 presets
- `useHighlightTime` - 工作日計算
- `useToast` - 通知
- Filter 相關 state 和 handlers

將以下程式碼加入 `GitLabDataContext.tsx` 的 `GitLabDataProvider` 函數內：

```typescript
// src/contexts/GitLabDataContext.tsx

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { GitLabDataContextValue } from './GitLabDataContext.types';
import { useProjectConfig } from '../hooks/useProjectConfig';
import { useGitLabSync } from '../hooks/useGitLabSync';
import { useGitLabHolidays } from '../hooks/useGitLabHolidays';
import { useFilterPresets } from '../hooks/useFilterPresets';
import { useHighlightTime } from '../hooks/useHighlightTime';
import { useToast, ToastContainer } from '../components/Toast';
import { toGitLabServerFilters } from '../utils/GitLabFilters';
import {
  loadProjectSettings,
  updateProjectFilterSettings,
  createStoredFilters,
  restoreFilterOptions,
  isFilterEmpty,
  hasServerFilters as checkHasServerFilters,
  hasClientFilters as checkHasClientFilters,
} from '../types/projectSettings';

// ... (keep existing context and hooks)

export function GitLabDataProvider({
  children,
  initialConfigId,
  autoSync = false,
}: GitLabDataProviderProps) {
  // === Project Configuration ===
  const {
    currentConfig,
    provider,
    configs,
    reloadConfigs,
    handleConfigChange: baseHandleConfigChange,
    handleQuickSwitch,
    projectPath,
    proxyConfig,
    configVersion,
  } = useProjectConfig(initialConfigId);

  // === Filter State ===
  const [filterOptions, setFilterOptions] = useState<Record<string, unknown>>({});
  const [serverFilterOptions, setServerFilterOptions] = useState<ServerFilterOptions | null>(null);
  const [serverFilterOptionsLoading, setServerFilterOptionsLoading] = useState(false);
  const [activeServerFilters, setActiveServerFilters] = useState<GitLabSyncOptions | null>(null);

  // === Permissions ===
  const [canEditHolidays, setCanEditHolidays] = useState(false);

  // === Toast ===
  const { toasts, showToast, removeToast } = useToast();

  // === Wrap handleConfigChange to clear filter state ===
  const handleConfigChange = useCallback(
    (config: GitLabConfig) => {
      setFilterOptions({});
      setServerFilterOptions(null);
      setActiveServerFilters(null);
      baseHandleConfigChange(config);
    },
    [baseHandleConfigChange]
  );

  // === GitLab Sync ===
  const {
    tasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
  } = useGitLabSync(provider, autoSync, 60000, {
    onWarning: (message) => showToast(message, 'warning'),
  });

  // === Check permissions when provider changes ===
  useEffect(() => {
    if (!provider) {
      setCanEditHolidays(false);
      return;
    }
    provider.checkCanEdit().then((canEdit) => {
      setCanEditHolidays(canEdit);
    });
  }, [provider]);

  // === Load server filter options when provider changes ===
  useEffect(() => {
    if (!provider) {
      setServerFilterOptions(null);
      return;
    }
    const loadFilterOptions = async () => {
      setServerFilterOptionsLoading(true);
      try {
        const options = await provider.getFilterOptions();
        setServerFilterOptions(options);
      } catch (error) {
        console.error('[GitLabDataContext] Failed to load filter options:', error);
        setServerFilterOptions(null);
      } finally {
        setServerFilterOptionsLoading(false);
      }
    };
    loadFilterOptions();
  }, [provider]);

  // === Holidays & Workdays ===
  const {
    holidays,
    workdays,
    colorRules,
    holidaysText,
    workdaysText,
    loading: holidaysLoading,
    saving: holidaysSaving,
    error: holidaysError,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
  } = useGitLabHolidays(
    projectPath,
    proxyConfig,
    canEditHolidays,
    currentConfig?.type || 'project'
  );

  // === Highlight Time (workdays calculation) ===
  const { countWorkdays, calculateEndDateByWorkdays } = useHighlightTime({
    holidays,
    workdays,
  });

  // === Filter Presets ===
  const {
    presets: filterPresets,
    loading: presetsLoading,
    saving: presetsSaving,
    createNewPreset,
    updatePreset,
    renamePreset,
    deletePreset,
  } = useFilterPresets(
    projectPath,
    proxyConfig,
    currentConfig?.type || 'project',
    canEditHolidays
  );

  // === Filter Settings Persistence ===
  const getConfigIdentifier = useCallback(() => {
    if (!currentConfig) return null;
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return { type: 'project' as const, id: currentConfig.projectId };
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return { type: 'group' as const, id: currentConfig.groupId };
    }
    return null;
  }, [currentConfig]);

  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);
  const [filterDirty, setFilterDirty] = useState(false);
  const isApplyingPresetRef = useRef(false);
  const skipFilterSaveRef = useRef(true);

  // Load project settings when config changes
  useEffect(() => {
    const identifier = getConfigIdentifier();
    if (!identifier) {
      setLastUsedPresetId(null);
      setFilterDirty(false);
      return;
    }
    const settings = loadProjectSettings(identifier.type, identifier.id);
    if (settings?.filter) {
      if (settings.filter.mode === 'preset') {
        setLastUsedPresetId(settings.filter.presetId || null);
        setFilterDirty(settings.filter.dirty || false);
      } else {
        setLastUsedPresetId(null);
        setFilterDirty(false);
      }
    } else {
      setLastUsedPresetId(null);
      setFilterDirty(false);
    }
  }, [getConfigIdentifier]);

  // Save filter settings helper
  const saveFilterSettings = useCallback(
    (presetId: string | null, dirty: boolean, filters: unknown) => {
      const identifier = getConfigIdentifier();
      if (!identifier) return;

      if (presetId) {
        const settings = {
          mode: 'preset' as const,
          presetId,
          dirty: dirty || false,
          filters: dirty ? filters : undefined,
        };
        updateProjectFilterSettings(identifier.type, identifier.id, settings);
      } else if (filters && !isFilterEmpty(filters)) {
        const settings = {
          mode: 'custom' as const,
          filters,
        };
        updateProjectFilterSettings(identifier.type, identifier.id, settings);
      } else {
        updateProjectFilterSettings(identifier.type, identifier.id, undefined);
      }
    },
    [getConfigIdentifier]
  );

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (presetId: string | null) => {
      isApplyingPresetRef.current = true;
      setLastUsedPresetId(presetId);
      setFilterDirty(false);
      saveFilterSettings(presetId, false, null);
      queueMicrotask(() => {
        isApplyingPresetRef.current = false;
      });
    },
    [saveFilterSettings]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>, isUserAction = true) => {
      setFilterOptions(newFilters);

      if (skipFilterSaveRef.current) return;
      if (!isUserAction) return;
      if (isApplyingPresetRef.current) return;

      const stored = createStoredFilters(newFilters, null);

      if (lastUsedPresetId) {
        setFilterDirty(true);
        saveFilterSettings(lastUsedPresetId, true, stored);
      } else {
        saveFilterSettings(null, false, stored);
      }
    },
    [lastUsedPresetId, saveFilterSettings]
  );

  // Sync with fold state (merged with active server filters)
  const syncWithFilters = useCallback(
    async (options?: GitLabSyncOptions) => {
      const mergedOptions = {
        ...options,
        serverFilters: options?.serverFilters || activeServerFilters,
      };
      await sync(mergedOptions);
    },
    [sync, activeServerFilters]
  );

  // Handle server filter apply
  const handleServerFilterApply = useCallback(
    async (serverFilters: unknown, isUserAction = true) => {
      const gitlabFilters = toGitLabServerFilters(serverFilters);
      setActiveServerFilters(gitlabFilters);

      if (!isUserAction) {
        await syncWithFilters({ serverFilters: gitlabFilters });
        return;
      }

      if (lastUsedPresetId) {
        setFilterDirty(true);
        const stored = createStoredFilters({}, serverFilters);
        saveFilterSettings(lastUsedPresetId, true, stored);
      } else {
        const stored = createStoredFilters({}, serverFilters);
        saveFilterSettings(null, false, stored);
      }

      await syncWithFilters({ serverFilters: gitlabFilters });
    },
    [lastUsedPresetId, saveFilterSettings, syncWithFilters]
  );

  // === Initial Sync Logic ===
  const initialSyncDoneRef = useRef(false);
  const presetsLoadedForVersionRef = useRef(-1);
  const prevPresetsLoadingRef = useRef(true);

  // Reset sync state when provider changes
  useEffect(() => {
    initialSyncDoneRef.current = false;
    prevPresetsLoadingRef.current = true;
    skipFilterSaveRef.current = true;
  }, [provider]);

  // Track presets loading transition
  useEffect(() => {
    const transitionedToLoaded = prevPresetsLoadingRef.current && !presetsLoading;
    if (transitionedToLoaded && proxyConfig) {
      presetsLoadedForVersionRef.current = configVersion;
    }
    prevPresetsLoadingRef.current = presetsLoading;
  }, [presetsLoading, proxyConfig, configVersion]);

  // Trigger initial sync after presets are loaded
  useEffect(() => {
    if (!provider || presetsLoading || !proxyConfig || initialSyncDoneRef.current) {
      return;
    }
    if (presetsLoadedForVersionRef.current !== configVersion) {
      return;
    }

    initialSyncDoneRef.current = true;

    setTimeout(() => {
      skipFilterSaveRef.current = false;
    }, 100);

    const identifier = getConfigIdentifier();
    if (!identifier) {
      syncWithFilters();
      return;
    }

    const settings = loadProjectSettings(identifier.type, identifier.id);

    if (settings?.filter) {
      const { mode, presetId, dirty, filters } = settings.filter;

      if (mode === 'preset' && presetId) {
        if (dirty && filters) {
          const hasServer = checkHasServerFilters(filters);
          const hasClient = checkHasClientFilters(filters);

          if (hasServer) {
            const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
            setActiveServerFilters(gitlabFilters);
          }
          if (hasClient) {
            setFilterOptions(restoreFilterOptions(filters));
          }

          setLastUsedPresetId(presetId);
          setFilterDirty(true);

          if (hasServer) {
            const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
            syncWithFilters({ serverFilters: gitlabFilters });
          } else {
            syncWithFilters();
          }
        } else {
          const savedPreset = filterPresets.find((p) => p.id === presetId);
          if (savedPreset?.filters) {
            const presetFilters = savedPreset.filters;
            const hasServer =
              presetFilters.serverFilters &&
              ((presetFilters.serverFilters.labelNames?.length ?? 0) > 0 ||
                (presetFilters.serverFilters.milestoneTitles?.length ?? 0) > 0 ||
                (presetFilters.serverFilters.assigneeUsernames?.length ?? 0) > 0 ||
                presetFilters.serverFilters.dateRange?.createdAfter ||
                presetFilters.serverFilters.dateRange?.createdBefore);
            const hasClient =
              (presetFilters.milestoneIds?.length ?? 0) > 0 ||
              (presetFilters.epicIds?.length ?? 0) > 0 ||
              (presetFilters.labels?.length ?? 0) > 0 ||
              (presetFilters.assignees?.length ?? 0) > 0 ||
              (presetFilters.states?.length ?? 0) > 0 ||
              !!presetFilters.search;

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(presetFilters.serverFilters);
              setActiveServerFilters(gitlabFilters);
            }
            if (hasClient) {
              setFilterOptions(presetFilters);
            }

            setLastUsedPresetId(presetId);

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(presetFilters.serverFilters);
              syncWithFilters({ serverFilters: gitlabFilters });
            } else {
              syncWithFilters();
            }
          } else {
            syncWithFilters();
          }
        }
      } else if (mode === 'custom' && filters) {
        const hasServer = checkHasServerFilters(filters);
        const hasClient = checkHasClientFilters(filters);

        if (hasServer) {
          const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
          setActiveServerFilters(gitlabFilters);
        }
        if (hasClient) {
          setFilterOptions(restoreFilterOptions(filters));
        }

        if (hasServer) {
          const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
          syncWithFilters({ serverFilters: gitlabFilters });
        } else {
          syncWithFilters();
        }
      } else {
        syncWithFilters();
      }
    } else {
      syncWithFilters();
    }
  }, [
    provider,
    presetsLoading,
    proxyConfig,
    configVersion,
    getConfigIdentifier,
    filterPresets,
    syncWithFilters,
  ]);

  // === Build Context Value ===
  const contextValue = useMemo<GitLabDataContextValue>(
    () => ({
      // Core Data
      tasks,
      links,
      milestones,
      epics,

      // Sync State & Actions
      syncState,
      sync: syncWithFilters,
      syncTask,
      createTask,
      createMilestone,
      deleteTask,
      createLink,
      deleteLink,

      // Configuration
      currentConfig,
      provider,
      configs,
      reloadConfigs,
      handleConfigChange,
      handleQuickSwitch,
      projectPath,
      proxyConfig,
      configVersion,

      // Filter State
      filterOptions,
      setFilterOptions,
      serverFilterOptions,
      serverFilterOptionsLoading,
      activeServerFilters,
      setActiveServerFilters,

      // Filter Presets
      filterPresets,
      presetsLoading,
      presetsSaving,
      createNewPreset,
      updatePreset,
      renamePreset,
      deletePreset,
      lastUsedPresetId,
      filterDirty,
      handlePresetSelect,
      handleFilterChange,
      handleServerFilterApply,

      // Permissions
      canEditHolidays,

      // Holidays & Workdays
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      holidaysLoading,
      holidaysSaving,
      holidaysError,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,

      // Utility Functions
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
    }),
    [
      tasks,
      links,
      milestones,
      epics,
      syncState,
      syncWithFilters,
      syncTask,
      createTask,
      createMilestone,
      deleteTask,
      createLink,
      deleteLink,
      currentConfig,
      provider,
      configs,
      reloadConfigs,
      handleConfigChange,
      handleQuickSwitch,
      projectPath,
      proxyConfig,
      configVersion,
      filterOptions,
      serverFilterOptions,
      serverFilterOptionsLoading,
      activeServerFilters,
      filterPresets,
      presetsLoading,
      presetsSaving,
      createNewPreset,
      updatePreset,
      renamePreset,
      deletePreset,
      lastUsedPresetId,
      filterDirty,
      handlePresetSelect,
      handleFilterChange,
      handleServerFilterApply,
      canEditHolidays,
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      holidaysLoading,
      holidaysSaving,
      holidaysError,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
    ]
  );

  return (
    <GitLabDataContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </GitLabDataContext.Provider>
  );
}
```

**Step 2: 驗證 build**

Run: `npm run build`
Expected: Build succeeds (may have warnings)

**Step 3: Commit**

```bash
git add src/contexts/GitLabDataContext.tsx
git commit -m "feat(context): implement GitLabDataProvider

Extract shared data layer from GitLabGantt including:
- Project configuration management (useProjectConfig)
- GitLab sync operations (useGitLabSync)
- Holidays and workdays (useGitLabHolidays)
- Filter presets (useFilterPresets)
- Filter state persistence
- Initial sync with saved filters
- Toast notifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立 GitLabWorkspace 容器元件

**Files:**

- Create: `src/components/GitLabWorkspace/GitLabWorkspace.jsx`
- Create: `src/components/GitLabWorkspace/GitLabWorkspace.css`
- Create: `src/components/GitLabWorkspace/index.js`

**Step 1: 建立 GitLabWorkspace.jsx**

```jsx
// src/components/GitLabWorkspace/GitLabWorkspace.jsx

/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context and view switching.
 */

import { useState } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
// import { KanbanView } from '../KanbanView/KanbanView'; // TODO: Phase 2
import './GitLabWorkspace.css';

export function GitLabWorkspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState('gantt'); // 'gantt' | 'kanban'

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* View Switcher - TODO: Enable when Kanban is ready */}
        {/* <ViewSwitcher activeView={activeView} onViewChange={setActiveView} /> */}

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && <GanttView />}
          {/* {activeView === 'kanban' && <KanbanView />} */}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
```

**Step 2: 建立 GitLabWorkspace.css**

```css
/* src/components/GitLabWorkspace/GitLabWorkspace.css */

.gitlab-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.gitlab-workspace-content {
  flex: 1;
  overflow: hidden;
}
```

**Step 3: 建立 index.js**

```javascript
// src/components/GitLabWorkspace/index.js

export { GitLabWorkspace } from './GitLabWorkspace';
```

**Step 4: Commit**

```bash
git add src/components/GitLabWorkspace/
git commit -m "feat(workspace): add GitLabWorkspace container component

- GitLabWorkspace: main container with GitLabDataProvider
- View switching infrastructure (Gantt only for now)
- CSS layout for workspace

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 建立 GanttView 元件（重構 GitLabGantt）

**Files:**

- Create: `src/components/GanttView/GanttView.jsx`
- Create: `src/components/GanttView/GanttView.css`
- Create: `src/components/GanttView/index.js`
- Reference: `src/components/GitLabGantt.jsx`

**Step 1: 建立 GanttView.jsx**

從 GitLabGantt.jsx 複製所有 UI 邏輯，但改為從 context 取得資料。

這是一個大型步驟。關鍵改變：

1. 移除所有已移到 context 的 hooks/state
2. 使用 `useGitLabData()` 取得資料
3. 保留所有 Gantt 專屬邏輯（Editor, columns, cell rendering 等）

```jsx
// src/components/GanttView/GanttView.jsx

/**
 * GanttView
 *
 * Gantt chart view component. Consumes data from GitLabDataContext.
 * This is the refactored version of GitLabGantt.
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import '../LabelCell.css';
import './GanttView.css';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGitLabData } from '../../contexts/GitLabDataContext';
import Gantt from '../Gantt.jsx';
import Editor from '../Editor.jsx';
import Toolbar from '../Toolbar.jsx';
import ContextMenu from '../ContextMenu.jsx';
import SmartTaskContent from '../SmartTaskContent.jsx';
import { ProjectSelector } from '../ProjectSelector.jsx';
import { SyncButton } from '../SyncButton.jsx';
import { FilterPanel } from '../FilterPanel.jsx';
import {
  ColumnSettingsDropdown,
  useColumnSettings,
  buildColumnsFromSettings,
} from '../ColumnSettingsDropdown.jsx';
import DateEditCell from '../grid/DateEditCell.jsx';
import { ColorRulesEditor } from '../ColorRulesEditor.jsx';
import { MoveInModal } from '../MoveInModal.jsx';
import { SaveBlueprintModal } from '../SaveBlueprintModal.jsx';
import { ApplyBlueprintModal } from '../ApplyBlueprintModal.jsx';
import { BlueprintManager } from '../BlueprintManager.jsx';
import { useBlueprint } from '../../hooks/useBlueprint';
import { applyBlueprint as applyBlueprintService } from '../../providers/BlueprintService';
import { defaultMenuOptions } from '@svar-ui/gantt-store';
import { ConfirmDialog } from '../shared/dialogs/ConfirmDialog';
import { CreateItemDialog } from '../shared/dialogs/CreateItemDialog';
import { DeleteDialog } from '../shared/dialogs/DeleteDialog';
import { useDateRangePreset } from '../../hooks/useDateRangePreset';
import { useHighlightTime } from '../../hooks/useHighlightTime';
import {
  formatDateToLocalString,
  createStartDate,
  createEndDate,
} from '../../utils/dateUtils';
import {
  isLegacyMilestoneId,
  migrateLegacyMilestoneId,
} from '../../utils/MilestoneIdUtils';
import {
  findLinkBySourceTarget,
  validateLinkGitLabMetadata,
} from '../../utils/GitLabLinkUtils';

// ... (copy helper functions from GitLabGantt.jsx: getTasksFromState, getChildrenForTask, sortByDeletionOrder)

export function GanttView() {
  // Get shared data from context
  const {
    tasks: allTasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
    currentConfig,
    provider,
    configs,
    reloadConfigs,
    handleConfigChange,
    handleQuickSwitch,
    projectPath,
    proxyConfig,
    configVersion,
    filterOptions,
    setFilterOptions,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    filterPresets,
    presetsLoading,
    presetsSaving,
    createNewPreset,
    updatePreset,
    renamePreset,
    deletePreset,
    lastUsedPresetId,
    filterDirty,
    handlePresetSelect,
    handleFilterChange,
    handleServerFilterApply,
    canEditHolidays,
    holidays,
    workdays,
    colorRules,
    holidaysText,
    workdaysText,
    holidaysLoading,
    holidaysSaving,
    holidaysError,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
    showToast,
    countWorkdays,
    calculateEndDateByWorkdays,
  } = useGitLabData();

  // === Gantt-specific state (keep these in GanttView) ===
  const [api, setApi] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // ... (copy all remaining Gantt-specific state and logic from GitLabGantt.jsx)
  // This includes: Editor state, Blueprint state, Dialog state, column settings,
  // date range, cell dimensions, context menu, event handlers, etc.

  // NOTE: This is a placeholder. The full implementation will copy
  // all UI-related code from GitLabGantt.jsx (lines ~890-3175)
  // but remove the data layer that's now in context.

  return (
    <div className="gantt-view">
      {/* Copy all JSX from GitLabGantt.jsx return statement */}
      {/* Settings modal, ViewOptions, FilterPanel, Gantt chart, etc. */}
    </div>
  );
}
```

**Step 2: 建立 GanttView.css**

複製 GitLabGantt.css 的所有樣式：

```css
/* src/components/GanttView/GanttView.css */

/* Copy all styles from GitLabGantt.css */
/* The class names will be updated from .gitlab-gantt-* to .gantt-view-* */
/* Or keep the same names for now to minimize changes */
```

**Step 3: 建立 index.js**

```javascript
// src/components/GanttView/index.js

export { GanttView } from './GanttView';
```

**Step 4: 驗證 build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/GanttView/
git commit -m "feat(gantt): create GanttView component from GitLabGantt

Refactor GitLabGantt into GanttView that consumes GitLabDataContext:
- All data now comes from useGitLabData() hook
- Gantt-specific UI logic remains in component
- Preserves all existing functionality

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 更新 exports 並保持向後相容

**Files:**

- Modify: `src/index.js`
- Modify: `src/components/GitLabGantt.jsx` (deprecation wrapper)

**Step 1: 更新 src/index.js**

```javascript
// src/index.js

// ... (keep existing exports)

// GitLabWorkspace (new entry point)
export { GitLabWorkspace } from './components/GitLabWorkspace';
export { GanttView } from './components/GanttView';

// Context exports
export {
  GitLabDataProvider,
  useGitLabData,
  useGitLabDataOptional,
} from './contexts/GitLabDataContext';

// Backward compatibility: GitLabGantt now wraps GitLabWorkspace
export { GitLabGantt } from './components/GitLabGantt.jsx';
```

**Step 2: 更新 GitLabGantt.jsx 為 wrapper**

```jsx
// src/components/GitLabGantt.jsx

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
```

**Step 3: 驗證 build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/index.js src/components/GitLabGantt.jsx
git commit -m "feat: update exports with backward compatibility

- Export GitLabWorkspace as new entry point
- Export GanttView for direct use
- Export context (GitLabDataProvider, useGitLabData)
- GitLabGantt now wraps GitLabWorkspace for backward compatibility

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 手動測試

**Step 1: 啟動開發伺服器**

Run: `npm run dev`

**Step 2: 測試清單**

在瀏覽器中測試以下功能：

1. [ ] 頁面載入正常，無 console 錯誤
2. [ ] 可以選擇/切換專案
3. [ ] Gantt 圖表正常顯示
4. [ ] Sync 按鈕正常運作
5. [ ] Filter 功能正常（篩選 labels, milestones 等）
6. [ ] Filter preset 功能正常（儲存/載入）
7. [ ] 拖曳調整任務時間正常
8. [ ] 雙擊開啟 Editor 正常
9. [ ] Settings modal 正常（holidays, workdays, color rules）
10. [ ] Context menu 正常
11. [ ] Toast 通知正常顯示

**Step 3: 記錄測試結果**

如果發現問題，記錄並修復後再繼續。

---

## Task 9: 最終 commit 和總結

**Step 1: 確保所有變更已 commit**

Run: `git status`

**Step 2: 建立 Phase 1 完成的 summary commit（如有需要）**

```bash
git add -A
git commit -m "chore: Phase 1 complete - shared data layer

Phase 1 完成摘要：
- GitLabDataContext: 共享資料 context
- GitLabDataProvider: 資料層 provider
- GitLabWorkspace: 新的主容器元件
- GanttView: 從 GitLabGantt 重構的 Gantt 視圖
- 向後相容: GitLabGantt 作為 wrapper

下一步: Phase 2 - 建立 Kanban 基礎

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 風險與注意事項

1. **Task 4 和 Task 6 是最大的步驟** - 需要仔細複製和修改大量程式碼
2. **保持 import paths 正確** - 重構後的路徑可能改變
3. **測試每個步驟** - 不要等到最後才測試
4. **保留 console.log** - 在開發階段保留偵錯訊息

---

## 執行選項

Plan complete and saved to `docs/plans/2026-01-30-phase1-shared-data-layer.md`.

**兩個執行選項：**

**1. Subagent-Driven (this session)** - 在此 session 中逐個 task 執行，每個 task 由 fresh subagent 處理，中間有 code review

**2. Parallel Session (separate)** - 開啟新 session 在 worktree 中，使用 executing-plans skill 批次執行

**你要選擇哪個方式？**
