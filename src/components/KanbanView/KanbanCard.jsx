// src/components/KanbanView/KanbanCard.jsx

/**
 * KanbanCard
 *
 * Displays a single Issue or Task as a compact card in the Kanban board.
 * Shows: ID, title, assignees, labels, due date.
 *
 * View mode behavior:
 * - 'issues': Shows Issues with child Task checklists inside each card.
 * - 'tasks': Shows Tasks as independent cards with parent Issue reference.
 * - 'all': Shows both Issues and Tasks with type indicator (color bar + tag).
 *
 * Supports drag-and-drop via @dnd-kit/sortable.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { openGitLabLink } from '../../utils/GitLabLinkUtils';
import { isGitLabTask, TASK_COLORS } from '../../utils/TaskTypeUtils';
import './KanbanCard.css';

/**
 * Format due date for display
 * @param {Date|string|null} dueDate - The due date
 * @returns {{ text: string, isOverdue: boolean }}
 */
function formatDueDate(dueDate) {
  if (!dueDate) return { text: '', isOverdue: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'today', isOverdue: false };
  } else {
    return { text: `${diffDays}d`, isOverdue: false };
  }
}

/**
 * Parse labels string to array
 * @param {string} labelsStr - Comma-separated labels
 * @returns {string[]}
 */
function parseLabels(labelsStr) {
  if (!labelsStr) return [];
  return labelsStr.split(', ').filter(Boolean);
}

/**
 * Parse assignees string to array
 * @param {string} assigneesStr - Comma-separated assignees
 * @returns {string[]}
 */
function parseAssignees(assigneesStr) {
  if (!assigneesStr) return [];
  return assigneesStr.split(', ').filter(Boolean);
}

export function KanbanCard({
  task,
  labelColorMap,
  childTasks = [], // Child tasks (workItemType=Task) to display
  parentTask, // Parent Issue object (for Tasks in 'tasks'/'all' mode)
  viewMode = 'issues', // Current view mode
  maxLabels = 2,
  maxAssignees = 2,
  listId,
  isDragging = false,
  isDragOverlay = false,
}) {
  // Setup sortable hook for drag-and-drop
  // Note: We always enable dragging to support cross-list drag.
  // Same-list reorder restriction is handled in KanbanBoardDnd.handleDragEnd
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: { taskId: task.id, listId },
    // Don't use disabled here - it would block cross-list drag too
  });

  // Build transform style for drag animation
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Build dynamic className
  const classNames = ['kanban-card'];
  if (isDragging || isSortableDragging) {
    classNames.push('kanban-card-dragging');
  }
  if (isDragOverlay) {
    classNames.push('drag-overlay');
  }

  const labels = parseLabels(task.labels);
  const assignees = parseAssignees(task.assigned);
  const dueInfo = formatDueDate(task.end);

  // Determine if this card is a Task (not an Issue)
  const isTaskItem = isGitLabTask(task);

  // Show type indicators in 'tasks' and 'all' modes
  const showTypeIndicator = viewMode !== 'issues';

  // Type bar color: blue for Issues, teal for Tasks
  const typeBarColor = isTaskItem ? TASK_COLORS.task : TASK_COLORS.issue;
  const typeLabel = isTaskItem ? 'Task' : 'Issue';

  // Child tasks (GitLab Tasks with workItemType='Task')
  // Only show in 'issues' mode (in other modes, Tasks are independent cards)
  const hasChildTasks = viewMode === 'issues' && childTasks && childTasks.length > 0;

  // Calculate visible labels and overflow
  const visibleLabels = labels.slice(0, maxLabels);
  const overflowLabels = labels.length - maxLabels;

  // Calculate visible assignees and overflow
  const visibleAssignees = assignees.slice(0, maxAssignees);
  const overflowAssignees = assignees.length - maxAssignees;

  // Handle click on ID to open GitLab link
  // Also handle mouseDown to prevent drag from starting
  const handleIdClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGitLabLink(task);
  };

  const handleIdMouseDown = (e) => {
    // Stop propagation to prevent drag from starting
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(showTypeIndicator ? { borderLeft: `3px solid ${typeBarColor}` } : {}),
      }}
      className={classNames.join(' ')}
      data-task-id={task.id}
      {...attributes}
      {...listeners}
    >
      {/* Issue/Task ID, Type Tag, Due Date, and Title */}
      <div className="kanban-card-header">
        <div className="kanban-card-header-row">
          <span className="kanban-card-id-group">
            <span
              className="kanban-card-id"
              onClick={handleIdClick}
              onMouseDown={handleIdMouseDown}
              onTouchStart={handleIdMouseDown}
              title="Open in GitLab"
            >
              #{task._gitlab?.iid || task.id}
            </span>
            {showTypeIndicator && (
              <span
                className="kanban-card-type-tag"
                style={{ backgroundColor: typeBarColor }}
              >
                {typeLabel}
              </span>
            )}
          </span>
          {dueInfo.text && (
            <span
              className={`kanban-card-due ${dueInfo.isOverdue ? 'kanban-card-due-overdue' : ''}`}
            >
              {dueInfo.isOverdue ? '-' : ''}
              {dueInfo.text}
            </span>
          )}
        </div>
        <span className="kanban-card-title">{task.text}</span>
      </div>

      {/* Parent Issue reference (for Tasks in 'tasks'/'all' modes) */}
      {showTypeIndicator && isTaskItem && parentTask && (
        <div
          className="kanban-card-parent-ref"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openGitLabLink(parentTask);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          title={`Open parent issue #${parentTask._gitlab?.iid || parentTask.id} in GitLab`}
        >
          <i className="fas fa-level-up-alt kanban-card-icon" />
          <span>Parent: #{parentTask._gitlab?.iid || parentTask.id} {parentTask.text}</span>
        </div>
      )}

      {/* Assignees */}
      {assignees.length > 0 && (
        <div className="kanban-card-assignees">
          <i className="fas fa-user kanban-card-icon" />
          <span className="kanban-card-assignees-list">
            {visibleAssignees.join(', ')}
            {overflowAssignees > 0 && (
              <span className="kanban-card-overflow">+{overflowAssignees}</span>
            )}
          </span>
        </div>
      )}

      {/* Labels */}
      {labels.length > 0 && (
        <div className="kanban-card-labels">
          <i className="fas fa-tag kanban-card-icon" />
          <span className="kanban-card-labels-list">
            {visibleLabels.map((label) => (
              <span
                key={label}
                className="kanban-card-label"
                style={{
                  backgroundColor: labelColorMap?.get(label) || '#6b7280',
                }}
              >
                {label}
              </span>
            ))}
            {overflowLabels > 0 && (
              <span className="kanban-card-overflow">+{overflowLabels}</span>
            )}
          </span>
        </div>
      )}

      {/* Child Tasks (GitLab Tasks) */}
      {hasChildTasks && (
        <div className="kanban-card-tasks">
          {childTasks.map((childTask) => (
            <div
              key={childTask.id}
              className={`kanban-card-task-item ${childTask._gitlab?.state === 'closed' ? 'kanban-card-task-done' : ''}`}
            >
              <i className={`fas ${childTask._gitlab?.state === 'closed' ? 'fa-check-square' : 'fa-square'} kanban-card-icon`} />
              <span className="kanban-card-task-title">{childTask.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
