# Toolbar 重構計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將 GanttView 內的共用 toolbar 元件（Project selector, Settings, Sync, Filter）抽取到 GitLabWorkspace 層級，讓 Gantt 和 Kanban views 共用。

**Architecture:** 採用最小風險方式 - 將共用 UI 元件從 GanttView 移到 GitLabWorkspace，保持現有 state 和 callbacks 邏輯在 GitLabDataContext 中。GanttView 和 KanbanView 只負責各自的 view-specific toolbar。

**Tech Stack:** React, CSS, GitLabDataContext

---

## 現況分析

目前 toolbar 散落在 GanttView.jsx 中：

- **Header 區域** (lines 2236-2296): project-switcher, SyncButton, stats-panel
- **Settings Panel**: ProjectSelector modal, holidays/workdays/colorRules 設定
- **FilterPanel** (lines 2520-2543): 篩選器面板
- **Gantt Toolbar Row** (lines 2554-2563): ColumnSettings, SVAR Toolbar

## 重構策略

**共用元件** (移到 GitLabWorkspace):

- ViewSwitcher (已完成)
- ProjectSwitcher (project selector dropdown + settings button)
- SyncButton
- FilterPanel toggle
- Stats panel

**View-specific 元件** (保留在各自 View):

- GanttView: ColumnSettings, SVAR Toolbar
- KanbanView: Board selector (Phase 3), Board settings

---

## Task 1: 建立 SharedToolbar 元件

**Files:**

- Create: `src/components/GitLabWorkspace/SharedToolbar.jsx`
- Create: `src/components/GitLabWorkspace/SharedToolbar.css`

**Step 1: 建立 SharedToolbar.jsx**

```jsx
// src/components/GitLabWorkspace/SharedToolbar.jsx

import { useGitLabData } from '../../contexts/GitLabDataContext';
import { SyncButton } from '../SyncButton';
import './SharedToolbar.css';

export function SharedToolbar({
  activeView,
  onViewChange,
  onSettingsClick,
  onFilterToggle,
  showFilter,
}) {
  const {
    currentConfig,
    configs,
    syncState,
    filterOptions,
    sync,
    handleConfigChange,
  } = useGitLabData();

  return (
    <div className="shared-toolbar">
      {/* View Switcher */}
      <div className="shared-toolbar-view-switcher">
        <button
          className={`view-btn ${activeView === 'gantt' ? 'active' : ''}`}
          onClick={() => onViewChange('gantt')}
        >
          <i className="fas fa-bars-staggered" />
          <span>Gantt</span>
        </button>
        <button
          className={`view-btn ${activeView === 'kanban' ? 'active' : ''}`}
          onClick={() => onViewChange('kanban')}
        >
          <i className="fas fa-columns" />
          <span>Kanban</span>
        </button>
      </div>

      {/* Project Switcher */}
      <div className="shared-toolbar-project">
        <select
          className="project-select"
          value={currentConfig?.id || ''}
          onChange={(e) => {
            const config = configs.find((c) => c.id === e.target.value);
            if (config) handleConfigChange(config);
          }}
        >
          {configs.map((config) => (
            <option key={config.id} value={config.id}>
              {config.projectName || config.groupName || 'Untitled'}
            </option>
          ))}
        </select>
        <button
          className="settings-btn"
          onClick={onSettingsClick}
          title="Settings"
        >
          <i className="fas fa-cog" />
        </button>
      </div>

      {/* Sync Button */}
      <SyncButton
        onSync={sync}
        syncState={syncState}
        filterOptions={filterOptions}
      />

      {/* Filter Toggle */}
      <button
        className={`filter-toggle-btn ${showFilter ? 'active' : ''}`}
        onClick={onFilterToggle}
        title="Toggle Filters"
      >
        <i className="fas fa-filter" />
      </button>

      {/* Stats (optional - can move later) */}
      <div className="shared-toolbar-spacer" />
    </div>
  );
}
```

**Step 2: 建立 SharedToolbar.css**

```css
/* src/components/GitLabWorkspace/SharedToolbar.css */

.shared-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.shared-toolbar-view-switcher {
  display: flex;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px;
}

.shared-toolbar-view-switcher .view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  transition: all 0.15s;
}

.shared-toolbar-view-switcher .view-btn:hover {
  color: #374151;
}

.shared-toolbar-view-switcher .view-btn.active {
  background: white;
  color: #1f2937;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shared-toolbar-project {
  display: flex;
  align-items: center;
  gap: 4px;
}

.shared-toolbar-project .project-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  min-width: 150px;
  max-width: 250px;
}

.shared-toolbar-project .settings-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  color: #6b7280;
}

.shared-toolbar-project .settings-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.filter-toggle-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
}

.filter-toggle-btn:hover {
  background: #f3f4f6;
}

.filter-toggle-btn.active {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.shared-toolbar-spacer {
  flex: 1;
}
```

**Step 3: Commit**

```bash
git add src/components/GitLabWorkspace/SharedToolbar.jsx src/components/GitLabWorkspace/SharedToolbar.css
git commit -m "feat(workspace): add SharedToolbar component"
```

---

## Task 2: 擴展 GitLabDataContext 以支援 toolbar

**Files:**

- Modify: `src/contexts/GitLabDataContext.jsx`

需要確保 context 提供以下資料和 callbacks：

- `currentConfig`, `configs` - 已有
- `syncState`, `sync` - 已有
- `filterOptions` - 已有
- `handleConfigChange` - 需確認是否已有

**Step 1: 檢查 context 是否需要擴展**

閱讀 GitLabDataContext.jsx 確認現有 API。

**Step 2: 如需擴展，增加必要的 state/callbacks**

**Step 3: Commit (如有改動)**

```bash
git add src/contexts/GitLabDataContext.jsx
git commit -m "feat(context): extend GitLabDataContext for shared toolbar"
```

---

## Task 3: 整合 SharedToolbar 到 GitLabWorkspace

**Files:**

- Modify: `src/components/GitLabWorkspace/GitLabWorkspace.jsx`
- Modify: `src/components/GitLabWorkspace/GitLabWorkspace.css`

**Step 1: 移除舊 ViewSwitcher，改用 SharedToolbar**

```jsx
// GitLabWorkspace.jsx 修改

import { SharedToolbar } from './SharedToolbar';

export function GitLabWorkspace(props) {
  const [activeView, setActiveView] = useState('gantt');
  const [showSettings, setShowSettings] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  return (
    <GitLabDataProvider {...dataProviderProps}>
      <div className="gitlab-workspace">
        <SharedToolbar
          activeView={activeView}
          onViewChange={setActiveView}
          onSettingsClick={() => setShowSettings(true)}
          onFilterToggle={() => setShowFilter(prev => !prev)}
          showFilter={showFilter}
        />

        {/* Filter Panel - conditionally rendered */}
        {showFilter && (
          <FilterPanel ... />
        )}

        <div className="gitlab-workspace-content">
          {activeView === 'gantt' ? (
            <GanttView hideToolbar={true} ... />
          ) : (
            <KanbanView />
          )}
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <ProjectSelector ... onClose={() => setShowSettings(false)} />
        )}
      </div>
    </GitLabDataProvider>
  );
}
```

**Step 2: 更新 CSS**

**Step 3: Commit**

```bash
git add src/components/GitLabWorkspace/GitLabWorkspace.jsx src/components/GitLabWorkspace/GitLabWorkspace.css
git commit -m "feat(workspace): integrate SharedToolbar"
```

---

## Task 4: 修改 GanttView 移除重複的 toolbar 元件

**Files:**

- Modify: `src/components/GanttView/GanttView.jsx`
- Modify: `src/components/GanttView/GanttView.css` (if needed)

**Step 1: 新增 `hideSharedToolbar` prop**

當 GanttView 在 GitLabWorkspace 內時，隱藏共用的 toolbar 元件：

- project-switcher
- SyncButton
- FilterPanel

但保留 Gantt-specific toolbar：

- ColumnSettings
- SVAR Toolbar
- 可選：Stats panel

**Step 2: 條件渲染**

```jsx
// GanttView.jsx 修改

export function GanttView({
  hideSharedToolbar = false,
  ...props
}) {
  // ... existing code

  return (
    <div className="gantt-wrapper">
      {/* 只有當 hideSharedToolbar=false 時才顯示這些 */}
      {!hideSharedToolbar && (
        <>
          <div className="gitlab-gantt-header">
            {/* project-switcher, SyncButton, etc. */}
          </div>
          {showFilterPanel && <FilterPanel ... />}
        </>
      )}

      {/* Gantt-specific toolbar - 永遠顯示 */}
      <div className="gantt-toolbar-row">
        <ColumnSettingsDropdown ... />
        <Toolbar api={api} ... />
      </div>

      {/* Gantt chart */}
      <Gantt ... />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/GanttView/GanttView.jsx
git commit -m "refactor(gantt): support hideSharedToolbar prop"
```

---

## Task 5: 移動 FilterPanel 到 GitLabWorkspace

**Files:**

- Modify: `src/components/GitLabWorkspace/GitLabWorkspace.jsx`

FilterPanel 需要從 GanttView 移到 GitLabWorkspace 層級，因為 Kanban 也需要共用篩選功能。

**Step 1: 分析 FilterPanel 依賴**

FilterPanel 需要：

- milestones, epics 列表
- filter state 和 callbacks
- preset 管理

這些應該都在 GitLabDataContext 中可用。

**Step 2: 在 GitLabWorkspace 渲染 FilterPanel**

**Step 3: Commit**

```bash
git add src/components/GitLabWorkspace/GitLabWorkspace.jsx
git commit -m "feat(workspace): move FilterPanel to workspace level"
```

---

## Task 6: 手動測試

**測試項目:**

1. Gantt view 中共用 toolbar 正常顯示
2. 切換到 Kanban view，共用 toolbar 仍然顯示
3. Project selector 可正常切換專案
4. Sync button 可正常同步
5. Filter panel 可正常展開/收合
6. Filter 變更在兩個 view 都生效
7. Settings 可正常開啟

---

## Task 7: 清理和最終 commit

移除：

- ViewSwitcher.jsx/css (已整合到 SharedToolbar)
- 任何不再使用的 code

更新：

- exports in index.js

```bash
git add -A
git commit -m "refactor: complete toolbar extraction to workspace level"
```

---

## 風險評估

**低風險:**

- SharedToolbar 是新元件，不影響現有功能
- 使用 `hideSharedToolbar` prop 漸進式遷移

**中風險:**

- FilterPanel 移動可能影響 filter state 管理
- 需要確保 GitLabDataContext 提供所有必要資料

**緩解措施:**

- 每個 task 後進行手動測試
- 保持 GanttView 獨立運作能力 (hideSharedToolbar=false 時)
