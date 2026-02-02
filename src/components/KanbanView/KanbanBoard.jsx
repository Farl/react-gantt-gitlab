// src/components/KanbanView/KanbanBoard.jsx

/**
 * KanbanBoard
 *
 * Container for all KanbanLists. Handles issue distribution to lists
 * based on label matching (AND logic).
 */

import { useMemo } from 'react';
import { KanbanList } from './KanbanList';
import './KanbanBoard.css';

/**
 * Check if an issue matches a list's label criteria (AND logic)
 * @param {Object} task - The task/issue
 * @param {string[]} listLabels - Labels the issue must have (all of them)
 * @returns {boolean}
 */
function issueMatchesList(task, listLabels) {
  if (!listLabels || listLabels.length === 0) return false;

  const taskLabels = task.labels ? task.labels.split(', ').filter(Boolean) : [];
  return listLabels.every((label) => taskLabels.includes(label));
}

/**
 * Check if an issue is "Others" (doesn't match any list)
 */
function isOthersIssue(task, lists) {
  return !lists.some((list) => issueMatchesList(task, list.labels));
}

/**
 * Check if an issue is closed
 */
function isClosedIssue(task) {
  return task.state === 'closed' || task._gitlab?.state === 'closed';
}

export function KanbanBoard({
  board,
  tasks,
  labelColorMap,
  labelPriorityMap,
  onCardDoubleClick,
}) {
  // Distribute tasks to lists
  const distributedLists = useMemo(() => {
    if (!board || !tasks) return [];

    const result = [];

    // Filter out closed issues first (they go to Closed list)
    const openTasks = tasks.filter((t) => !isClosedIssue(t));
    const closedTasks = tasks.filter((t) => isClosedIssue(t));

    // Others list (first position if enabled)
    if (board.showOthers) {
      const othersTasks = openTasks.filter((task) =>
        isOthersIssue(task, board.lists),
      );
      result.push({
        id: '__others__',
        name: 'Others',
        tasks: othersTasks,
        sortBy: 'position',
        sortOrder: 'asc',
        isSpecial: true,
        specialType: 'others',
      });
    }

    // Regular lists
    for (const list of board.lists) {
      const listTasks = openTasks.filter((task) =>
        issueMatchesList(task, list.labels),
      );
      result.push({
        ...list,
        tasks: listTasks,
        isSpecial: false,
        specialType: null,
      });
    }

    // Closed list (last position if enabled)
    if (board.showClosed) {
      result.push({
        id: '__closed__',
        name: 'Closed',
        tasks: closedTasks,
        sortBy: 'position',
        sortOrder: 'asc',
        isSpecial: true,
        specialType: 'closed',
      });
    }

    return result;
  }, [board, tasks]);

  if (!board) {
    return (
      <div className="kanban-board-empty">
        <i className="fas fa-columns" />
        <p>No board selected</p>
        <p className="kanban-board-empty-hint">
          Create a new board or select an existing one
        </p>
      </div>
    );
  }

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
        />
      ))}
    </div>
  );
}
