// src/components/KanbanView/KanbanList.jsx

/**
 * KanbanList
 *
 * A single column/list in the Kanban board.
 * Displays a header with count and contains KanbanCard items.
 * Supports drag-and-drop via @dnd-kit.
 */

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import './KanbanList.css';

/**
 * Sort tasks based on sortBy and sortOrder
 */
function sortTasks(tasks, sortBy, sortOrder, labelPriorityMap) {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'position':
        // Use relative_position from GitLab, fallback to id
        const posA = a._gitlab?.relativePosition ?? a.id;
        const posB = b._gitlab?.relativePosition ?? b.id;
        comparison = posA - posB;
        break;

      case 'due_date':
        // Null/invalid dates go to the end
        const dateA = a.end ? new Date(a.end).getTime() : Infinity;
        const dateB = b.end ? new Date(b.end).getTime() : Infinity;
        // Guard against NaN from invalid date strings
        comparison = (Number.isNaN(dateA) ? Infinity : dateA) - (Number.isNaN(dateB) ? Infinity : dateB);
        break;

      case 'created_at':
        const createdA = a._gitlab?.createdAt
          ? new Date(a._gitlab.createdAt).getTime()
          : 0;
        const createdB = b._gitlab?.createdAt
          ? new Date(b._gitlab.createdAt).getTime()
          : 0;
        comparison = createdA - createdB;
        break;

      case 'label_priority':
        // Use labelPriority computed in parent, fallback to MAX_SAFE_INTEGER
        const priorityA = a.labelPriority ?? Number.MAX_SAFE_INTEGER;
        const priorityB = b.labelPriority ?? Number.MAX_SAFE_INTEGER;
        comparison = priorityA - priorityB;
        break;

      case 'id':
      default:
        const idA = a._gitlab?.iid ?? a.id;
        const idB = b._gitlab?.iid ?? b.id;
        comparison = idA - idB;
        break;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/** Sort options for the list dropdown */
const SORT_OPTIONS = [
  { value: 'position', label: 'Position (Manual)' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'created_at', label: 'Created' },
  { value: 'label_priority', label: 'Label Priority' },
];

export function KanbanList({
  id,
  name,
  tasks,
  sortBy = 'position',
  sortOrder = 'asc',
  labelColorMap,
  labelPriorityMap,
  isSpecial = false, // true for Others and Closed lists
  specialType = null, // 'others' | 'closed'
  onCardDoubleClick,
  onSortChange, // Callback when sort changes: (newSortBy) => void
  activeTaskId = null, // ID of the currently dragged task
  isOver = false, // Whether a dragged item is over this list (from parent)
  isDragEnabled = true, // Whether same-list drag is enabled (false when sortBy !== 'position')
}) {
  // Setup droppable for this list
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id: `list-${id}`,
    data: { listId: id },
  });

  // Use either parent-provided isOver or droppable's isOver
  const isDropTarget = isOver || isOverDroppable;

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

  // Determine list class with drop target highlight
  const listClass = isDropTarget ? 'kanban-list kanban-list-over' : 'kanban-list';

  return (
    <div className={listClass} data-list-id={id} ref={setNodeRef}>
      {/* List Header */}
      <div className={headerClass}>
        <span className="kanban-list-name">{name}</span>
        <span className="kanban-list-count">{tasks.length}</span>
        <select
          className="kanban-list-sort-select"
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Sort by"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* List Content with SortableContext for drag-and-drop ordering */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="kanban-list-content">
          {sortedTasks.length === 0 ? (
            <div className="kanban-list-empty">No issues</div>
          ) : (
            sortedTasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                listId={id}
                labelColorMap={labelColorMap}
                onDoubleClick={onCardDoubleClick}
                isDragging={task.id === activeTaskId}
                isDragDisabled={!isDragEnabled}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
