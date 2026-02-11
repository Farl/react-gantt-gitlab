/**
 * Blueprint Types
 *
 * Blueprint 是以 Milestone 為單位的範本系統，用於儲存和重複使用 Milestone 結構。
 * 欄位命名沿用 snake_case 慣例。
 *
 * @see Blueprint type definitions
 */

/**
 * Blueprint Item - 代表 Blueprint 中的單一 Issue/Task
 */
export interface BlueprintItem {
  /** 原始 IID (用於追蹤層級和依賴關係) */
  iid: number;
  /** 工作項目類型: Issue 或 Task */
  issue_type: 'Issue' | 'Task';
  /** 標題 */
  title: string;
  /** 描述 */
  description?: string;

  // === 日期相關 (Blueprint 特有欄位) ===
  /**
   * 相對於 Milestone 起始日的工作天偏移
   * 0 = 與 Milestone 同一天開始
   * null = 原本沒有日期，套用時不設定日期
   */
  start_offset: number | null;
  /**
   * 工作天數 (排除假日/週末)
   * null = 原本沒有日期，套用時不設定日期
   */
  workdays: number | null;

  // === 組織資訊 (organization info) ===
  /** 標籤名稱列表 */
  labels?: string[];
  /** 受指派者 username 列表 */
  assignees?: string[];
  /** 權重 */
  weight?: number;

  // === 層級關係 ===
  /**
   * 父項目的 IID
   * 0 = 直接隸屬於 Milestone (沒有父 Issue/Task)
   */
  parent_iid: number;

  // === 依賴關係 ===
  /** 此項目阻擋的其他項目 IID 列表 */
  blocks?: number[];
  /** 阻擋此項目的其他項目 IID 列表 */
  blocked_by?: number[];
}

/**
 * Blueprint Milestone - Milestone 的基本資訊
 */
export interface BlueprintMilestone {
  /** 標題 */
  title: string;
  /** 描述 */
  description?: string;
  /** Milestone 總工作天數 (從 start_date 到 due_date) */
  workdays?: number;
}

/**
 * Blueprint - 完整的 Milestone 範本
 */
export interface Blueprint {
  /** 唯一識別碼 (UUID) */
  id: string;
  /** Blueprint 名稱 */
  name: string;
  /** 建立時間 (ISO 8601) */
  created_at: string;
  /** 最後更新時間 (ISO 8601) */
  updated_at: string;
  /** 版本號 (用於未來升級) */
  version: 1;
  /** 儲存位置 */
  storage_type: 'snippet' | 'localStorage';

  /** Milestone 資訊 */
  milestone: BlueprintMilestone;
  /** 包含的 Issues/Tasks */
  items: BlueprintItem[];
}

/**
 * Blueprint 儲存配置
 */
export interface BlueprintConfig {
  /** 配置版本號 */
  version: 1;
  /** Blueprint 列表 */
  blueprints: Blueprint[];
}

/**
 * 套用 Blueprint 時的選項
 */
export interface ApplyBlueprintOptions {
  /** 新 Milestone 的起始日期 */
  start_date: Date;

  /** Milestone 命名方式 */
  milestone_naming: {
    /** 命名模式: prefix = 前綴 + 原名稱, custom = 完全自訂 */
    mode: 'prefix' | 'custom';
    /** mode='prefix' 時的前綴 */
    prefix?: string;
    /** mode='custom' 時的完整標題 */
    custom_title?: string;
  };

  /** Issue/Task 命名選項 */
  item_naming: {
    /** 是否為 Issues 加上前綴 */
    add_issue_prefix: boolean;
    /** 是否為 Tasks 加上前綴 */
    add_task_prefix: boolean;
    /** 前綴文字 */
    prefix?: string;
  };

  /** 是否套用 Labels */
  apply_labels: boolean;
  /** 是否套用 Assignees */
  apply_assignees: boolean;
}

/**
 * 套用 Blueprint 的結果報告
 */
export interface ApplyBlueprintResult {
  /** 整體是否成功 (無任何錯誤) */
  success: boolean;

  /** 建立的 Milestone 資訊 */
  milestone?: {
    iid: number;
    title: string;
    web_url?: string;
  };

  /** 成功建立的項目 */
  created: Array<{
    original_iid: number;
    new_iid: number;
    title: string;
    issue_type: 'Issue' | 'Task';
  }>;

  /** 建立失敗的項目 */
  failed: Array<{
    original_iid: number;
    title: string;
    error: string;
  }>;

  /** 成功建立的 Link 數量 */
  links_created: number;
  /** 建立失敗的 Link 數量 */
  links_failed: number;
}

// === 常數定義 ===

/**
 * Snippet 設定
 */
export const BLUEPRINT_SNIPPET = {
  TITLE: 'gantt-blueprints',
  FILENAME: 'blueprints.json',
  VISIBILITY: 'private' as const,
} as const;

/**
 * localStorage Key 模板
 * 使用時替換 {type} 為 'project' | 'group'，{id} 為專案/群組 ID
 */
export const BLUEPRINT_STORAGE_KEY_TEMPLATE = 'gantt-blueprints-{type}-{id}';

/**
 * 取得 localStorage Key
 */
export function getBlueprintStorageKey(
  configType: 'project' | 'group',
  id: string | number,
): string {
  return BLUEPRINT_STORAGE_KEY_TEMPLATE.replace('{type}', configType).replace(
    '{id}',
    String(id),
  );
}

/**
 * 預設空配置
 */
export const DEFAULT_BLUEPRINT_CONFIG: BlueprintConfig = {
  version: 1,
  blueprints: [],
};

/**
 * 產生 UUID v4
 */
export function generateBlueprintId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
