# Phase 3: Board 管理 UI 實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作 Board 管理功能，讓使用者可以建立、編輯、刪除 Boards 和 Lists，並將設定儲存到 GitLab Snippet。

**Architecture:**

- `useIssueBoard` hook 管理 Board state 和 CRUD 操作
- `GitLabIssueBoardApi` 處理 Snippet 讀寫
- `BoardSelector` 選擇/建立 Board
- `BoardSettingsModal` 編輯 Board 設定
- `ListEditDialog` 編輯 List 設定

**Tech Stack:** React, TypeScript, GitLab Snippet API

---

## Task 1: 建立 GitLabIssueBoardApi

**Files:**

- Create: `src/providers/GitLabIssueBoardApi.ts`

**功能:**

- 讀取 Board Snippet
- 建立/更新 Board Snippet
- Snippet 命名：`gantt-issue-boards-{projectId}` 或 `gantt-issue-boards-group-{groupId}`

**Step 1: 建立 API 類別**

```typescript
// src/providers/GitLabIssueBoardApi.ts

import type { IssueBoard, IssueBoardStorage } from '../types/issueBoard';

const SNIPPET_TITLE_PREFIX = 'gantt-issue-boards';

export class GitLabIssueBoardApi {
  private provider: any; // GitLabProvider
  private projectPath: string;
  private isGroup: boolean;

  constructor(provider: any, projectPath: string, isGroup: boolean = false) {
    this.provider = provider;
    this.projectPath = projectPath;
    this.isGroup = isGroup;
  }

  private getSnippetTitle(): string {
    return this.isGroup
      ? `${SNIPPET_TITLE_PREFIX}-group`
      : SNIPPET_TITLE_PREFIX;
  }

  async loadBoards(): Promise<IssueBoard[]> {
    // Find snippet by title
    // Parse content as IssueBoardStorage
    // Return boards array
  }

  async saveBoards(boards: IssueBoard[]): Promise<void> {
    // Create IssueBoardStorage
    // Find or create snippet
    // Update snippet content
  }

  async createBoard(board: Omit<IssueBoard, 'id'>): Promise<IssueBoard> {
    // Generate UUID
    // Add to boards
    // Save
  }

  async updateBoard(board: IssueBoard): Promise<void> {
    // Find board by id
    // Update
    // Save
  }

  async deleteBoard(boardId: string): Promise<void> {
    // Remove board
    // Save
  }
}
```

**Step 2: Commit**

```bash
git add src/providers/GitLabIssueBoardApi.ts
git commit -m "feat(kanban): add GitLabIssueBoardApi for board snippet CRUD"
```

---

## Task 2: 建立 useIssueBoard hook

**Files:**

- Create: `src/hooks/useIssueBoard.ts`

**功能:**

- 管理 boards state
- 管理 currentBoard state
- 提供 CRUD callbacks
- 處理 loading/error states

**Step 1: 建立 hook**

```typescript
// src/hooks/useIssueBoard.ts

import { useState, useEffect, useCallback } from 'react';
import { GitLabIssueBoardApi } from '../providers/GitLabIssueBoardApi';
import type { IssueBoard, IssueBoardList } from '../types/issueBoard';

export function useIssueBoard(
  provider: any,
  projectPath: string,
  isGroup: boolean = false
) {
  const [boards, setBoards] = useState<IssueBoard[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current board getter
  const currentBoard = boards.find(b => b.id === currentBoardId) || null;

  // Load boards on mount
  useEffect(() => { ... }, [provider, projectPath, isGroup]);

  // CRUD operations
  const createBoard = useCallback(...);
  const updateBoard = useCallback(...);
  const deleteBoard = useCallback(...);
  const selectBoard = useCallback(...);

  // List operations
  const addList = useCallback(...);
  const updateList = useCallback(...);
  const deleteList = useCallback(...);
  const reorderLists = useCallback(...);

  return {
    boards,
    currentBoard,
    loading,
    saving,
    error,
    createBoard,
    updateBoard,
    deleteBoard,
    selectBoard,
    addList,
    updateList,
    deleteList,
    reorderLists,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useIssueBoard.ts
git commit -m "feat(kanban): add useIssueBoard hook for board state management"
```

---

## Task 3: 建立 BoardSelector 元件

**Files:**

- Create: `src/components/KanbanView/BoardSelector.jsx`
- Create: `src/components/KanbanView/BoardSelector.css`

**功能:**

- 下拉選單顯示所有 boards
- 建立新 board 按鈕
- 設定按鈕（開啟 BoardSettingsModal）

**UI:**

```
┌──────────────────────────────────────────────────────┐
│ Board: [My Sprint Board ▼]  [+ New]  [⚙ Settings]   │
└──────────────────────────────────────────────────────┘
```

**Step 1: 建立 BoardSelector**

**Step 2: 建立 CSS**

**Step 3: Commit**

```bash
git add src/components/KanbanView/BoardSelector.jsx src/components/KanbanView/BoardSelector.css
git commit -m "feat(kanban): add BoardSelector component"
```

---

## Task 4: 建立 CreateBoardDialog 元件

**Files:**

- Create: `src/components/KanbanView/CreateBoardDialog.jsx`
- Create: `src/components/KanbanView/CreateBoardDialog.css`

**功能:**

- 輸入 board 名稱
- 選擇初始 template 或空白
- 建立 board

**UI:**

```
┌─────────────────────────────────────┐
│ Create New Board               ×   │
├─────────────────────────────────────┤
│ Name: [                    ]       │
│                                     │
│ Initial lists:                      │
│ ○ Empty (add lists later)          │
│ ● From template:                    │
│   [To Do / In Progress / Done ▼]   │
│                                     │
│           [Cancel] [Create]         │
└─────────────────────────────────────┘
```

**Step 1: 建立 dialog**

**Step 2: Commit**

```bash
git add src/components/KanbanView/CreateBoardDialog.jsx src/components/KanbanView/CreateBoardDialog.css
git commit -m "feat(kanban): add CreateBoardDialog component"
```

---

## Task 5: 建立 BoardSettingsModal 元件

**Files:**

- Create: `src/components/KanbanView/BoardSettingsModal.jsx`
- Create: `src/components/KanbanView/BoardSettingsModal.css`

**功能:**

- 編輯 board 名稱
- 管理 lists（新增、編輯、刪除、拖曳排序）
- 設定 showOthers / showClosed
- 刪除 board

**UI:**

```
┌─────────────────────────────────────────────────────┐
│ Board Settings: My Sprint Board                 ×  │
├─────────────────────────────────────────────────────┤
│ Name: [My Sprint Board        ]                    │
│                                                     │
│ Lists:                                 [+ Add List]│
│ ┌─────────────────────────────────────────────┐   │
│ │ ≡ To Do        Labels: backlog    [Edit][×] │   │
│ │ ≡ In Progress  Labels: doing      [Edit][×] │   │
│ │ ≡ Done         Labels: done       [Edit][×] │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Special Lists:                                      │
│ [✓] Show "Others" list                             │
│ [✓] Show "Closed" list                             │
│                                                     │
│              [Delete Board] [Save Changes]          │
└─────────────────────────────────────────────────────┘
```

**Step 1: 建立 modal**

**Step 2: Commit**

```bash
git add src/components/KanbanView/BoardSettingsModal.jsx src/components/KanbanView/BoardSettingsModal.css
git commit -m "feat(kanban): add BoardSettingsModal component"
```

---

## Task 6: 建立 ListEditDialog 元件

**Files:**

- Create: `src/components/KanbanView/ListEditDialog.jsx`
- Create: `src/components/KanbanView/ListEditDialog.css`

**功能:**

- 編輯 list 名稱
- 選擇 labels（多選，AND 邏輯）
- 設定預設排序

**UI:**

```
┌─────────────────────────────────────┐
│ Edit List                      ×   │
├─────────────────────────────────────┤
│ Name: [In Progress         ]       │
│                                     │
│ Labels (issues must have ALL):     │
│ [Select labels...          ▼]     │
│  ☑ doing                           │
│  ☐ urgent                          │
│  ☐ bug                             │
│                                     │
│ Default Sort:                       │
│ [Position ▼]  [Ascending ▼]        │
│                                     │
│           [Cancel] [Save]           │
└─────────────────────────────────────┘
```

**Step 1: 建立 dialog**

**Step 2: Commit**

```bash
git add src/components/KanbanView/ListEditDialog.jsx src/components/KanbanView/ListEditDialog.css
git commit -m "feat(kanban): add ListEditDialog component"
```

---

## Task 7: 整合 Board 管理到 KanbanView

**Files:**

- Modify: `src/components/KanbanView/KanbanView.jsx`
- Modify: `src/components/KanbanView/KanbanView.css`
- Modify: `src/components/KanbanView/index.js`

**功能:**

- 使用 useIssueBoard hook
- 渲染 BoardSelector
- 處理 create/edit/delete board dialogs
- 當沒有 board 時顯示建立提示

**Step 1: 整合到 KanbanView**

**Step 2: 更新 exports**

**Step 3: Commit**

```bash
git add src/components/KanbanView/
git commit -m "feat(kanban): integrate board management into KanbanView"
```

---

## Task 8: 擴展 GitLabDataContext 支援 Board 管理

**Files:**

- Modify: `src/contexts/GitLabDataContext.tsx`
- Modify: `src/contexts/GitLabDataContext.types.ts`

**功能:**

- 加入 useIssueBoard 到 context
- 提供 boards, currentBoard, 和 CRUD callbacks

**Step 1: 更新 types**

**Step 2: 更新 context**

**Step 3: Commit**

```bash
git add src/contexts/
git commit -m "feat(context): add board management to GitLabDataContext"
```

---

## Task 9: 手動測試

**測試項目:**

1. 新增 Board（空白 / 從 template）
2. 編輯 Board 名稱
3. 新增 List
4. 編輯 List（名稱、labels、排序）
5. 刪除 List
6. 拖曳排序 Lists
7. Toggle showOthers / showClosed
8. 刪除 Board
9. 切換 Board
10. Board 設定正確儲存到 GitLab Snippet

---

## Task 10: 最終 commit

```bash
git add -A
git commit -m "feat(kanban): complete Phase 3 board management"
```

---

## 風險評估

**低風險:**

- BoardSelector, CreateBoardDialog, ListEditDialog 都是獨立元件

**中風險:**

- GitLabIssueBoardApi 需要正確處理 Snippet API
- useIssueBoard hook 需要正確管理 state

**高風險:**

- 整合到 GitLabDataContext 可能影響現有功能

**緩解措施:**

- 每個 task 後進行手動測試
- 先測試 API 再整合 UI
- 保持向後相容
