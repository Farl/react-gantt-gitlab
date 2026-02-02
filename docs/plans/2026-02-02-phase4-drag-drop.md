# Phase 4: Drag & Drop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 為 Kanban board 加入拖曳功能，支援同 List 排序、跨 List 移動、特殊 List 行為（Closed/Others），並實作樂觀更新。

**Architecture:** 使用 @dnd-kit/core + @dnd-kit/sortable，建立 DndContext wrapper，各 List 為 Droppable 容器，Card 為 Sortable 項目。

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, React hooks

---

## Task 1: 建立 useDragOperations hook

**Files:**

- Create: `src/hooks/useDragOperations.ts`

**功能:**

- 封裝拖曳相關的 API 操作
- 處理 reorder、label 變更、state 變更
- 提供樂觀更新的 snapshot/rollback 機制

**Step 1: 建立 hook**

```typescript
// src/hooks/useDragOperations.ts

import { useCallback, useRef } from 'react';
import type { ITask, TID } from '../types/gantt';

interface DragSnapshot {
  task: ITask;
  sourceListId: string;
}

interface UseDragOperationsParams {
  tasks: ITask[];
  syncTask: (taskId: TID, updates: Record<string, unknown>) => Promise<void>;
  reorderTask: (
    taskId: TID,
    targetId: TID,
    position: 'before' | 'after',
  ) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  refreshTasks: () => void;
}

export function useDragOperations({
  tasks,
  syncTask,
  reorderTask,
  showToast,
  refreshTasks,
}: UseDragOperationsParams) {
  const snapshotRef = useRef<DragSnapshot | null>(null);

  /**
   * Capture snapshot before drag for potential rollback
   */
  const captureSnapshot = useCallback(
    (taskId: TID, sourceListId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        snapshotRef.current = {
          task: { ...task },
          sourceListId,
        };
      }
    },
    [tasks],
  );

  /**
   * Same-list reorder: update relative position
   */
  const handleSameListReorder = useCallback(
    async (
      taskId: TID,
      targetTaskId: TID,
      position: 'before' | 'after',
    ): Promise<boolean> => {
      try {
        await reorderTask(taskId, targetTaskId, position);
        return true;
      } catch (error) {
        showToast(
          `Failed to reorder: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [reorderTask, showToast, refreshTasks],
  );

  /**
   * Cross-list drag: handle label changes
   */
  const handleCrossListDrag = useCallback(
    async (
      taskId: TID,
      sourceLabels: string[],
      targetLabels: string[],
      targetType: 'regular' | 'others' | 'closed',
    ): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;

      const currentLabels = task.labels
        ? task.labels.split(', ').filter(Boolean)
        : [];

      try {
        // Handle different target types
        if (targetType === 'closed') {
          // Close the issue
          await syncTask(taskId, { state: 'closed' });
        } else if (targetType === 'others') {
          // Remove source labels only
          const newLabels = currentLabels.filter(
            (l) => !sourceLabels.includes(l),
          );
          await syncTask(taskId, {
            labels: newLabels.join(', '),
            // If was closed, reopen
            ...(task.state === 'closed' ? { state: 'opened' } : {}),
          });
        } else {
          // Regular list: swap labels
          const newLabels = currentLabels
            .filter((l) => !sourceLabels.includes(l))
            .concat(targetLabels);
          const uniqueLabels = [...new Set(newLabels)];
          await syncTask(taskId, {
            labels: uniqueLabels.join(', '),
            // If was closed, reopen
            ...(task.state === 'closed' ? { state: 'opened' } : {}),
          });
        }
        return true;
      } catch (error) {
        showToast(
          `Failed to move issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [tasks, syncTask, showToast, refreshTasks],
  );

  /**
   * Clear snapshot after successful operation
   */
  const clearSnapshot = useCallback(() => {
    snapshotRef.current = null;
  }, []);

  return {
    captureSnapshot,
    handleSameListReorder,
    handleCrossListDrag,
    clearSnapshot,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useDragOperations.ts
git commit -m "feat(kanban): add useDragOperations hook for drag API operations

- Handles same-list reorder via reorder API
- Handles cross-list drag with label changes
- Handles close/reopen for Closed list
- Provides snapshot capture for rollback

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立 KanbanBoardDnd wrapper 元件

**Files:**

- Create: `src/components/KanbanView/KanbanBoardDnd.jsx`
- Create: `src/components/KanbanView/KanbanBoardDnd.css`

**功能:**

- 提供 DndContext
- 處理 onDragStart, onDragOver, onDragEnd
- 渲染 DragOverlay（拖曳預覽）

**Step 1: 建立 KanbanBoardDnd.jsx**

```jsx
// src/components/KanbanView/KanbanBoardDnd.jsx

/**
 * KanbanBoardDnd
 *
 * Wrapper component that provides DnD context for the Kanban board.
 * Handles drag events and coordinates with API operations.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { KanbanBoard } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';
import './KanbanBoardDnd.css';

/**
 * Custom collision detection that prefers pointerWithin for containers
 * and closestCorners for cards
 */
function customCollisionDetection(args) {
  // First check if pointer is within a droppable
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  // Fallback to closestCorners
  return closestCorners(args);
}

/**
 * Get list info from list ID
 */
function getListInfo(listId, board) {
  if (listId === '__others__') {
    return { type: 'others', labels: [] };
  }
  if (listId === '__closed__') {
    return { type: 'closed', labels: [] };
  }
  const list = board?.lists?.find((l) => l.id === listId);
  return { type: 'regular', labels: list?.labels || [] };
}

/**
 * Find which list a task belongs to
 */
function findTaskListId(taskId, board, tasks) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  // Check if closed
  if (task.state === 'closed' || task._gitlab?.state === 'closed') {
    return '__closed__';
  }

  const taskLabels = task.labels ? task.labels.split(', ').filter(Boolean) : [];

  // Check each regular list
  for (const list of board?.lists || []) {
    if (list.labels.every((label) => taskLabels.includes(label))) {
      return list.id;
    }
  }

  // Default to Others
  return '__others__';
}

export function KanbanBoardDnd({
  board,
  tasks,
  labelColorMap,
  labelPriorityMap,
  onCardDoubleClick,
  onSameListReorder,
  onCrossListDrag,
}) {
  // Drag state
  const [activeTask, setActiveTask] = useState(null);
  const [activeListId, setActiveListId] = useState(null);
  const [overListId, setOverListId] = useState(null);

  // Handle drag start
  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      const task = tasks.find((t) => t.id === active.id);
      if (task) {
        setActiveTask(task);
        const listId = findTaskListId(active.id, board, tasks);
        setActiveListId(listId);
      }
    },
    [tasks, board],
  );

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event) => {
    const { over } = event;
    if (over) {
      // Get the list ID from the over element
      const listId = over.data?.current?.listId || over.id;
      setOverListId(listId);
    } else {
      setOverListId(null);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;

      // Reset visual state
      setActiveTask(null);
      setActiveListId(null);
      setOverListId(null);

      if (!over || !activeListId) return;

      // Get target list ID
      const targetListId = over.data?.current?.listId || over.id;
      const targetTaskId = over.data?.current?.taskId || null;

      // Get list info
      const sourceList = getListInfo(activeListId, board);
      const targetList = getListInfo(targetListId, board);

      // Same list reorder
      if (activeListId === targetListId && targetTaskId) {
        await onSameListReorder(active.id, targetTaskId, 'after');
        return;
      }

      // Cross-list drag
      if (activeListId !== targetListId) {
        await onCrossListDrag(
          active.id,
          sourceList.labels,
          targetList.labels,
          targetList.type,
        );
      }
    },
    [activeListId, board, onSameListReorder, onCrossListDrag],
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setActiveListId(null);
    setOverListId(null);
  }, []);

  return (
    <DndContext
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <KanbanBoard
        board={board}
        tasks={tasks}
        labelColorMap={labelColorMap}
        labelPriorityMap={labelPriorityMap}
        onCardDoubleClick={onCardDoubleClick}
        activeTaskId={activeTask?.id}
        overListId={overListId}
      />

      {/* Drag overlay - shows card preview during drag */}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <KanbanCard
            task={activeTask}
            labelColorMap={labelColorMap}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

**Step 2: 建立 KanbanBoardDnd.css**

```css
/* src/components/KanbanView/KanbanBoardDnd.css */

/* Drag overlay card styling */
.kanban-card.drag-overlay {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  transform: rotate(2deg);
  cursor: grabbing;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanBoardDnd.jsx src/components/KanbanView/KanbanBoardDnd.css
git commit -m "feat(kanban): add KanbanBoardDnd wrapper with DndContext

- Provides DndContext for drag and drop
- Custom collision detection for multi-container
- Handles drag start/over/end events
- DragOverlay for card preview during drag

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 更新 KanbanList 支援 Droppable

**Files:**

- Modify: `src/components/KanbanView/KanbanList.jsx`
- Modify: `src/components/KanbanView/KanbanList.css`

**功能:**

- 加入 useDroppable 讓 List 成為放置目標
- 加入 SortableContext 包裹 cards
- 加入視覺回饋（hover 高亮）

**Step 1: 更新 KanbanList.jsx**

```jsx
// 在現有 imports 之後加入：
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// 更新 component props
export function KanbanList({
  id,
  name,
  tasks,
  sortBy = 'position',
  sortOrder = 'asc',
  labelColorMap,
  labelPriorityMap,
  isSpecial = false,
  specialType = null,
  onCardDoubleClick,
  activeTaskId, // 新增：正在拖曳的 task ID
  isOver, // 新增：是否有 card 在此 list 上方
}) {
  // Make this list a droppable container
  const { setNodeRef } = useDroppable({
    id,
    data: { listId: id },
  });

  // Sort tasks
  const sortedTasks = useMemo(
    () => sortTasks(tasks, sortBy, sortOrder, labelPriorityMap),
    [tasks, sortBy, sortOrder, labelPriorityMap],
  );

  // Get task IDs for SortableContext
  const taskIds = useMemo(
    () => sortedTasks.map((task) => task.id),
    [sortedTasks],
  );

  // Determine header class based on special type
  const headerClass = specialType
    ? `kanban-list-header kanban-list-header-${specialType}`
    : 'kanban-list-header';

  // List container class with drop indicator
  const listClass = `kanban-list ${isOver ? 'kanban-list-over' : ''}`;

  return (
    <div className={listClass} data-list-id={id} ref={setNodeRef}>
      {/* List Header */}
      <div className={headerClass}>
        <span className="kanban-list-name">{name}</span>
        <span className="kanban-list-count">{tasks.length}</span>
      </div>

      {/* List Content with SortableContext */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="kanban-list-content">
          {sortedTasks.length === 0 ? (
            <div className="kanban-list-empty">No issues</div>
          ) : (
            sortedTasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                labelColorMap={labelColorMap}
                onDoubleClick={onCardDoubleClick}
                listId={id}
                isDragging={task.id === activeTaskId}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
```

**Step 2: 更新 KanbanList.css**

```css
/* 在 KanbanList.css 末尾加入 */

/* Drop target highlight */
.kanban-list-over {
  background: #dbeafe;
}

.kanban-list-over .kanban-list-content {
  background: #eff6ff;
}

/* Drop indicator for empty lists */
.kanban-list-over .kanban-list-empty {
  border: 2px dashed #3b82f6;
  background: #eff6ff;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanList.jsx src/components/KanbanView/KanbanList.css
git commit -m "feat(kanban): add drag-drop support to KanbanList

- useDroppable makes list a drop target
- SortableContext enables card reordering
- Visual feedback when dragging over list

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 更新 KanbanCard 支援 Sortable

**Files:**

- Modify: `src/components/KanbanView/KanbanCard.jsx`
- Modify: `src/components/KanbanView/KanbanCard.css`

**功能:**

- 加入 useSortable hook
- 套用 transform/transition 樣式
- 拖曳時的視覺效果

**Step 1: 更新 KanbanCard.jsx**

```jsx
// 在現有 imports 之後加入：
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 更新 component
export function KanbanCard({
  task,
  labelColorMap,
  onDoubleClick,
  maxLabels = 3,
  maxAssignees = 2,
  listId, // 新增：所屬 list ID（用於 drag data）
  isDragging = false, // 新增：是否正在被拖曳
  isDragOverlay = false, // 新增：是否為 DragOverlay 中的預覽
}) {
  // Make card sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: {
      taskId: task.id,
      listId,
    },
  });

  // Apply transform styles
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // ... existing code ...

  // Determine class names
  const cardClass = [
    'kanban-card',
    (isDragging || isSortableDragging) && 'kanban-card-dragging',
    isDragOverlay && 'drag-overlay',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClass}
      onDoubleClick={handleDoubleClick}
      data-task-id={task.id}
      {...attributes}
      {...listeners}
    >
      {/* ... existing card content ... */}
    </div>
  );
}
```

**Step 2: 更新 KanbanCard.css**

```css
/* 在 KanbanCard.css 末尾加入 */

/* Dragging state - original card in list */
.kanban-card-dragging {
  opacity: 0.4;
  border-style: dashed;
}

/* Drag overlay - floating preview card */
.kanban-card.drag-overlay {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  transform: rotate(2deg);
  cursor: grabbing;
  opacity: 1;
}

/* Cursor for draggable cards */
.kanban-card {
  cursor: grab;
}

.kanban-card:active {
  cursor: grabbing;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanCard.jsx src/components/KanbanView/KanbanCard.css
git commit -m "feat(kanban): add sortable drag support to KanbanCard

- useSortable hook for drag functionality
- Transform/transition styles for smooth animation
- Visual states for dragging and drag overlay

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 更新 KanbanBoard 傳遞 drag props

**Files:**

- Modify: `src/components/KanbanView/KanbanBoard.jsx`

**功能:**

- 接收並傳遞 activeTaskId, overListId 到各 List

**Step 1: 更新 KanbanBoard.jsx**

```jsx
// 更新 component props
export function KanbanBoard({
  board,
  tasks,
  labelColorMap,
  labelPriorityMap,
  onCardDoubleClick,
  activeTaskId, // 新增
  overListId, // 新增
}) {
  // ... existing distributedLists logic ...

  return (
    <div className="kanban-board">
      {distributedLists.map((list) => (
        <KanbanList
          key={list.id}
          id={list.id}
          name={list.name}
          tasks={list.tasks}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          labelColorMap={labelColorMap}
          labelPriorityMap={labelPriorityMap}
          isSpecial={list.isSpecial}
          specialType={list.specialType}
          onCardDoubleClick={onCardDoubleClick}
          activeTaskId={activeTaskId}
          isOver={overListId === list.id}
        />
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/KanbanView/KanbanBoard.jsx
git commit -m "feat(kanban): pass drag state props through KanbanBoard

- activeTaskId for tracking dragged card
- overListId for drop target highlight

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 整合 DnD 到 KanbanView

**Files:**

- Modify: `src/components/KanbanView/KanbanView.jsx`
- Modify: `src/components/KanbanView/index.js`

**功能:**

- 使用 KanbanBoardDnd 取代 KanbanBoard
- 連接 useDragOperations hook
- 處理 API 呼叫

**Step 1: 更新 KanbanView.jsx**

```jsx
// 替換 import
import { KanbanBoardDnd } from './KanbanBoardDnd';
import { useDragOperations } from '../../hooks/useDragOperations';

// 在 component 內加入：
const { handleSameListReorder, handleCrossListDrag } = useDragOperations({
  tasks: filteredTasks,
  syncTask: async (taskId, updates) => {
    // 使用 context 的 syncTask
    await syncTask(taskId, updates);
  },
  reorderTask: async (taskId, targetId, position) => {
    // 使用 provider 的 reorder API
    const task = filteredTasks.find((t) => t.id === taskId);
    const targetTask = filteredTasks.find((t) => t.id === targetId);
    if (task && targetTask) {
      await provider.reorderWorkItem(
        task._gitlab.iid,
        targetTask._gitlab.iid,
        position,
      );
      // Refresh to get updated positions
      // (或者 optimistic update)
    }
  },
  showToast,
  refreshTasks: sync,
});

// 在 render 中替換：
<KanbanBoardDnd
  board={currentBoard}
  tasks={filteredTasks}
  labelColorMap={labelColorMap}
  labelPriorityMap={labelPriorityMap}
  onCardDoubleClick={handleCardDoubleClick}
  onSameListReorder={handleSameListReorder}
  onCrossListDrag={handleCrossListDrag}
/>;
```

**Step 2: 更新 index.js**

```javascript
// 加入 export
export { KanbanBoardDnd } from './KanbanBoardDnd';
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanView.jsx src/components/KanbanView/index.js
git commit -m "feat(kanban): integrate drag-drop into KanbanView

- Use KanbanBoardDnd instead of KanbanBoard
- Connect useDragOperations for API calls
- Wire up reorder and cross-list handlers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 驗證 build 和手動測試

**Step 1: 驗證 build**

```bash
npm run build
```

**Step 2: 測試清單**

1. **同 List 排序**

   - [ ] 向上拖曳卡片
   - [ ] 向下拖曳卡片
   - [ ] 拖到 list 頂部
   - [ ] 拖到 list 底部

2. **跨 List 拖曳**

   - [ ] Regular → Regular（labels 切換）
   - [ ] Regular → Others（移除 source labels）
   - [ ] Others → Regular（加入 target labels）
   - [ ] Regular → Closed（關閉 issue）
   - [ ] Closed → Regular（重新開啟 + 加入 labels）
   - [ ] Closed → Others（重新開啟）

3. **視覺回饋**

   - [ ] 拖曳時卡片變半透明
   - [ ] 放置目標 list 高亮
   - [ ] 拖曳預覽顯示正確

4. **錯誤處理**
   - [ ] API 失敗時顯示 toast
   - [ ] 失敗後資料刷新

---

## Task 8: 最終 commit

```bash
git add -A
git commit -m "feat(kanban): complete Phase 4 drag-drop implementation

Phase 4 完成摘要：
- useDragOperations hook 處理 API 操作
- KanbanBoardDnd 提供 DndContext
- KanbanList 支援 Droppable + SortableContext
- KanbanCard 支援 Sortable
- 同 List 排序、跨 List 拖曳、Closed 特殊行為
- 視覺回饋（拖曳狀態、放置高亮）

下一步: Phase 5 - 排序功能

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 風險與注意事項

1. **@dnd-kit 版本相容性** - 確保 core 和 sortable 版本相容
2. **API 併發** - 跨 List 拖曳需要先更新 labels 再 reorder，注意順序
3. **樂觀更新** - 若 API 失敗需要刷新資料恢復正確狀態
4. **Others List** - 拖曳到 Others 時只移除 source list 的 labels，保留其他
5. **Closed List** - 從 Closed 拖出時需要 reopen + 加入 target labels

---

## 執行選項

Plan complete and saved to `docs/plans/2026-02-02-phase4-drag-drop.md`.

**兩個執行選項：**

**1. Subagent-Driven (this session)** - 在此 session 中逐個 task 執行，每個 task 由 fresh subagent 處理，中間有 code review

**2. Parallel Session (separate)** - 開啟新 session 在 worktree 中，使用 executing-plans skill 批次執行

**你要選擇哪個方式？**
