/**
 * WorkloadChart Component
 * Custom chart that displays multiple non-overlapping tasks on the same row
 * Reuses Gantt's time scale calculations but renders bars independently
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMiddleMouseDrag } from '../hooks/useMiddleMouseDrag';
import { isMilestoneTask, isFolderTask } from '../utils/TaskTypeUtils';
import './WorkloadChart.css';
import './shared/TodayMarker.css';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get the multiplier to convert day-based positions to the given lengthUnit.
 */
function getUnitMultiplier(lengthUnit) {
  switch (lengthUnit) {
    case 'hour': return 24;
    case 'week': return 1 / 7;
    case 'month': return 1 / 30;
    case 'quarter': return 1 / 90;
    default: return 1;
  }
}

/**
 * Resolve a task's effective end date.
 * Tasks without an explicit end date get a fallback duration:
 * - 7 days if using created date as start (no _gitlab.startDate)
 * - 1 day otherwise
 */
function resolveTaskEnd(task) {
  const taskStart = task.start instanceof Date ? task.start : new Date(task.start);
  if (task.end) {
    const end = task.end instanceof Date ? task.end : new Date(task.end);
    return end >= taskStart ? end : new Date(taskStart.getTime() + MS_PER_DAY);
  }
  const fallbackDays = task._gitlab?.startDate ? 1 : 7;
  return new Date(taskStart.getTime() + fallbackDays * MS_PER_DAY);
}

/**
 * Calculate task position and width based on dates and scale
 */
function calculateTaskPosition(task, startDate, cellWidth, lengthUnit) {
  const taskStart = task.start instanceof Date ? task.start : new Date(task.start);
  const taskEnd = resolveTaskEnd(task);

  const startDiff = (taskStart - startDate) / MS_PER_DAY;
  const duration = Math.max(1, (taskEnd - taskStart) / MS_PER_DAY);

  const m = getUnitMultiplier(lengthUnit);
  const x = startDiff * cellWidth * m;
  const width = Math.max(cellWidth * 0.5, duration * cellWidth * m);

  return { x, width };
}

/**
 * Assign tasks to rows based on overlap detection
 */
function assignTasksToRows(tasks) {
  const rows = [];

  // Sort by start date
  const sorted = [...tasks].sort((a, b) => {
    const aStart = a.start instanceof Date ? a.start : new Date(a.start);
    const bStart = b.start instanceof Date ? b.start : new Date(b.start);
    return aStart.getTime() - bStart.getTime();
  });

  // Track end times for each row
  const rowEndTimes = [];

  for (const task of sorted) {
    const taskStart = task.start instanceof Date ? task.start : new Date(task.start);
    const effectiveEnd = resolveTaskEnd(task);

    // Find first row where this task doesn't overlap
    let rowIndex = -1;
    for (let i = 0; i < rowEndTimes.length; i++) {
      if (rowEndTimes[i] <= taskStart) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      rowIndex = rowEndTimes.length;
      rowEndTimes.push(effectiveEnd);
      rows.push([]);
    } else {
      rowEndTimes[rowIndex] = effectiveEnd;
    }

    rows[rowIndex].push({ ...task, $rowIndex: rowIndex });
  }

  return rows;
}

/**
 * Group tasks by assignee/label
 * @param {Array} allTasks - All tasks
 * @param {Array} selectedAssignees - Selected assignee names
 * @param {Array} selectedLabels - Selected label names
 * @param {boolean} showOthers - Whether to show "Others" category for uncategorized tasks
 */
function groupTasks(allTasks, selectedAssignees, selectedLabels, showOthers = false) {
  const groups = [];

  // Filter work items only
  const workItems = allTasks.filter((task) => {
    return !isMilestoneTask(task) && !isFolderTask(task) && task.type !== 'summary' && !!task.start;
  });

  // Track which tasks have been categorized (for "Others" group)
  const categorizedTaskIds = new Set();

  // Group by assignee
  for (const assignee of selectedAssignees) {
    const assigneeTasks = workItems.filter((task) => {
      if (!task.assigned) return false;
      const taskAssignees = typeof task.assigned === 'string'
        ? task.assigned.split(',').map(a => a.trim())
        : [String(task.assigned)];
      return taskAssignees.includes(assignee);
    });

    // Track categorized tasks
    assigneeTasks.forEach(task => categorizedTaskIds.add(task.id));

    const rows = assignTasksToRows(assigneeTasks);
    groups.push({
      id: `assignee-${assignee}`,
      name: assignee,
      type: 'assignee',
      rows,
      taskCount: assigneeTasks.length,
    });
  }

  // Group by label
  for (const label of selectedLabels) {
    const labelTasks = workItems.filter((task) => {
      if (!task.labels) return false;
      const taskLabels = typeof task.labels === 'string'
        ? task.labels.split(',').map(l => l.trim())
        : Array.isArray(task.labels) ? task.labels : [];
      return taskLabels.includes(label);
    });

    // Track categorized tasks
    labelTasks.forEach(task => categorizedTaskIds.add(task.id));

    const rows = assignTasksToRows(labelTasks);
    groups.push({
      id: `label-${label}`,
      name: label,
      type: 'label',
      rows,
      taskCount: labelTasks.length,
    });
  }

  // Add "Others" group for uncategorized tasks
  if (showOthers && (selectedAssignees.length > 0 || selectedLabels.length > 0)) {
    const otherTasks = workItems.filter(task => !categorizedTaskIds.has(task.id));

    if (otherTasks.length > 0) {
      const rows = assignTasksToRows(otherTasks);
      groups.push({
        id: 'others',
        name: 'Others',
        type: 'others',
        rows,
        taskCount: otherTasks.length,
      });
    }
  }

  return groups;
}

export function WorkloadChart({
  tasks = [],
  selectedAssignees = [],
  selectedLabels = [],
  startDate,
  endDate,
  cellWidth = 40,
  cellHeight = 38,
  lengthUnit = 'day',
  highlightTime,
  onTaskClick,
  onTaskDrag,
  onGroupChange,
  showOthers = false,
  scaleLevelName = 'day',
}) {
  const containerRef = useRef(null);
  const chartScrollRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  // Middle mouse drag to scroll
  const { isDragging: isMiddleMouseDragging, onMouseDown: onMiddleMouseDown } = useMiddleMouseDrag(chartScrollRef);
  const [dropTargetGroup, setDropTargetGroup] = useState(null);

  // Optimistic updates - store local date overrides until server confirms
  const [localUpdates, setLocalUpdates] = useState({});

  // Apply local updates to tasks
  const tasksWithLocalUpdates = useMemo(() => {
    if (Object.keys(localUpdates).length === 0) return tasks;

    return tasks.map(task => {
      const update = localUpdates[task.id];
      if (update) {
        return { ...task, start: update.start, end: update.end };
      }
      return task;
    });
  }, [tasks, localUpdates]);

  // Clear local updates when server data changes (task dates match our updates)
  useEffect(() => {
    if (Object.keys(localUpdates).length === 0) return;

    const newLocalUpdates = { ...localUpdates };
    let hasChanges = false;

    for (const [taskId, update] of Object.entries(localUpdates)) {
      const task = tasks.find(t => String(t.id) === String(taskId));
      if (task) {
        const taskStart = task.start instanceof Date ? task.start : new Date(task.start);
        const taskEnd = task.end instanceof Date ? task.end : new Date(task.end);

        // If server data now matches our update, remove the local override
        if (Math.abs(taskStart.getTime() - update.start.getTime()) < 86400000 &&
            Math.abs(taskEnd.getTime() - update.end.getTime()) < 86400000) {
          delete newLocalUpdates[taskId];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setLocalUpdates(newLocalUpdates);
    }
  }, [tasks, localUpdates]);

  // Group tasks (use tasks with local updates)
  const groups = useMemo(() => {
    return groupTasks(tasksWithLocalUpdates, selectedAssignees, selectedLabels, showOthers);
  }, [tasksWithLocalUpdates, selectedAssignees, selectedLabels, showOthers]);

  // Spacing between groups
  const groupSpacing = 8;

  // Calculate group boundaries for drop target detection
  const groupBoundaries = useMemo(() => {
    const boundaries = [];
    let currentY = 0;

    for (const group of groups) {
      const rowCount = Math.max(1, group.rows.length);
      const groupHeight = rowCount * cellHeight;
      boundaries.push({
        group,
        startY: currentY,
        endY: currentY + groupHeight,
      });
      currentY += groupHeight + groupSpacing;
    }

    return boundaries;
  }, [groups, cellHeight, groupSpacing]);

  // Find group at Y position (relative to chart content)
  const findGroupAtY = useCallback((y) => {
    for (const boundary of groupBoundaries) {
      if (y >= boundary.startY && y < boundary.endY) {
        return boundary.group;
      }
    }
    return null;
  }, [groupBoundaries]);

  // Calculate chart dimensions
  const chartDimensions = useMemo(() => {
    const totalDays = Math.ceil((endDate - startDate) / MS_PER_DAY);
    const m = getUnitMultiplier(lengthUnit);
    const width = totalDays * cellWidth * m;

    // Calculate total height (task rows + spacing between groups)
    let totalRows = 0;
    for (const group of groups) {
      totalRows += Math.max(1, group.rows.length); // Task rows only
    }
    // Add spacing between groups (n-1 spacings for n groups)
    const totalSpacing = groups.length > 1 ? (groups.length - 1) * groupSpacing : 0;

    const height = totalRows * cellHeight + totalSpacing;

    return { width, height, totalDays };
  }, [startDate, endDate, cellWidth, cellHeight, lengthUnit, groups, groupSpacing]);


  // Handle task mouse down for dragging
  const handleTaskMouseDown = useCallback((e, task, group) => {
    if (e.button !== 0) return; // Only left click

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const taskWidth = rect.width;

    // Determine drag mode based on click position
    let mode = 'move';
    if (offsetX < 8) {
      mode = 'start';
    } else if (offsetX > taskWidth - 8) {
      mode = 'end';
    }

    // Get chart scroll container for Y position calculations
    const chartRect = chartScrollRef.current?.getBoundingClientRect();
    const scrollTop = chartScrollRef.current?.scrollTop || 0;

    setDragState({
      task,
      group,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      chartTop: chartRect?.top || 0,
      scrollTop,
      originalStart: task.start instanceof Date ? task.start : new Date(task.start),
      originalEnd: task.end instanceof Date ? task.end : new Date(task.end || task.start),
    });

    e.preventDefault();
  }, []);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragState.startX;
      const m = getUnitMultiplier(lengthUnit);

      const daysDelta = Math.round(dx / (cellWidth * m));
      const msDelta = daysDelta * MS_PER_DAY;

      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;

      if (dragState.mode === 'move') {
        newStart = new Date(dragState.originalStart.getTime() + msDelta);
        newEnd = new Date(dragState.originalEnd.getTime() + msDelta);

        // For move mode, also check for group change (vertical drag)
        const scrollTop = chartScrollRef.current?.scrollTop || 0;
        const relativeY = e.clientY - dragState.chartTop + scrollTop;
        const targetGroup = findGroupAtY(relativeY);

        // Update drop target if hovering over a different group
        if (targetGroup && targetGroup.id !== dragState.group.id) {
          // Allow dropping on "Others" group - this removes assignee/label from task
          // But only if dragging FROM an assignee or label group (not from Others itself)
          if (targetGroup.type === 'others' && dragState.group.type === 'others') {
            setDropTargetGroup(null);
          } else {
            setDropTargetGroup(targetGroup);
          }
        } else {
          setDropTargetGroup(null);
        }
      } else if (dragState.mode === 'start') {
        newStart = new Date(dragState.originalStart.getTime() + msDelta);
        if (newStart >= newEnd) {
          newStart = new Date(newEnd.getTime() - MS_PER_DAY);
        }
      } else if (dragState.mode === 'end') {
        newEnd = new Date(dragState.originalEnd.getTime() + msDelta);
        if (newEnd <= newStart) {
          newEnd = new Date(newStart.getTime() + MS_PER_DAY);
        }
      }

      setDragState(prev => ({
        ...prev,
        currentStart: newStart,
        currentEnd: newEnd,
      }));
    };

    const handleMouseUp = () => {
      // Use current values if dragged, otherwise use original values
      const finalStart = dragState.currentStart || dragState.originalStart;
      const finalEnd = dragState.currentEnd || dragState.originalEnd;

      const dateChanged =
        finalStart.getTime() !== dragState.originalStart.getTime() ||
        finalEnd.getTime() !== dragState.originalEnd.getTime();

      // Check if group changed (cross-group drag)
      const groupChanged = dropTargetGroup && dropTargetGroup.id !== dragState.group.id;

      if (dateChanged) {
        // Apply optimistic update immediately so UI doesn't snap back
        setLocalUpdates(prev => ({
          ...prev,
          [dragState.task.id]: { start: finalStart, end: finalEnd },
        }));

        // Notify parent to sync with server
        if (onTaskDrag) {
          onTaskDrag(dragState.task, {
            start: finalStart,
            end: finalEnd,
          });
        }
      }

      // Handle group change
      if (groupChanged && onGroupChange) {
        onGroupChange(dragState.task, {
          fromGroup: dragState.group,
          toGroup: dropTargetGroup,
        });
      }

      setDragState(null);
      setDropTargetGroup(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, cellWidth, lengthUnit, onTaskDrag, onGroupChange, findGroupAtY, dropTargetGroup]);

  // Render a single task bar
  const renderTaskBar = (task, group, rowIndex) => {
    // Check if this task is being dragged
    const isDragging = dragState && dragState.task.id === task.id;
    const displayStart = isDragging && dragState.currentStart ? dragState.currentStart : task.start;
    const displayEnd = isDragging && dragState.currentEnd ? dragState.currentEnd : task.end;

    const { x, width } = calculateTaskPosition(
      { ...task, start: displayStart, end: displayEnd },
      startDate,
      cellWidth,
      lengthUnit
    );

    const isTask = task._gitlab?.workItemType === 'Task';
    const barColor = isTask ? '#00ba94' : '#428fdc';

    // Generate tooltip text with proper date handling
    const startDateStr = displayStart?.toLocaleDateString?.() || 'No start date';
    let endDateStr;
    let dateRangeNote = '';

    if (displayEnd) {
      endDateStr = displayEnd.toLocaleDateString();
    } else {
      // Handle tasks without end dates
      const isUsingCreatedDate = !task._gitlab?.startDate;
      if (isUsingCreatedDate) {
        endDateStr = '(estimated +7 days)';
        dateRangeNote = '\n[Using created date as start]';
      } else {
        endDateStr = '(estimated +1 day)';
        dateRangeNote = '\n[No due date set]';
      }
    }

    // Build comprehensive tooltip
    const tooltipParts = [
      task.text,
      `${startDateStr} - ${endDateStr}${dateRangeNote}`
    ];

    // Add assignee info if present
    if (task.assigned) {
      tooltipParts.push(`Assignee: ${task.assigned}`);
    }

    // Add labels if present
    if (task.labels) {
      const labelStr = Array.isArray(task.labels) ? task.labels.join(', ') : task.labels;
      tooltipParts.push(`Labels: ${labelStr}`);
    }

    // Add type info
    tooltipParts.push(`Type: ${task._gitlab?.workItemType || 'Issue'}`);

    const tooltipText = tooltipParts.join('\n');

    return (
      <div
        key={task.id}
        className={`workload-task-bar ${isDragging ? 'dragging' : ''}`}
        style={{
          left: `${x}px`,
          width: `${width}px`,
          height: `${Math.max(16, cellHeight - 14)}px`,
          backgroundColor: barColor,
        }}
        onMouseDown={(e) => handleTaskMouseDown(e, task, group)}
        onClick={() => onTaskClick && onTaskClick(task)}
        title={tooltipText}
      >
        <span className="task-bar-text">{task.text}</span>
        <div className="resize-handle resize-handle-left" />
        <div className="resize-handle resize-handle-right" />
      </div>
    );
  };

  // Generate time scale cells and multi-level header data.
  // Day-level cells are always computed (for bar positioning accuracy).
  // Additional headers (week, year, quarter) are derived for adaptive scale display.
  const { timeScaleCells, monthHeaders, weekHeaders, yearHeaders, quarterHeaders } = useMemo(() => {
    const cells = [];
    const months = [];
    const current = new Date(startDate);
    let currentMonth = null;
    let monthStartIdx = 0;
    let lastYear = null;

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      const isHolidayDay = highlightTime ? highlightTime(current, 'day') === 'wx-weekend' : false;

      // Track month changes
      const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          const monthDate = new Date(cells[monthStartIdx].date);
          const isJanuary = monthDate.getMonth() === 0;
          const year = monthDate.getFullYear();
          const showYear = isJanuary || (months.length === 0 && year !== lastYear);
          months.push({
            key: currentMonth,
            label: showYear
              ? monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
              : monthDate.toLocaleDateString('en-US', { month: 'short' }),
            startIdx: monthStartIdx,
            days: cells.length - monthStartIdx,
          });
          lastYear = year;
        }
        currentMonth = monthKey;
        monthStartIdx = cells.length;
      }

      cells.push({
        date: new Date(current),
        isWeekend: isWeekendDay || isHolidayDay,
        label: current.getDate(),
      });

      current.setDate(current.getDate() + 1);
    }

    // Push last month
    if (currentMonth !== null && cells.length > monthStartIdx) {
      const monthDate = new Date(cells[monthStartIdx].date);
      const isJanuary = monthDate.getMonth() === 0;
      const year = monthDate.getFullYear();
      const showYear = isJanuary || (months.length === 0) || (year !== lastYear);
      months.push({
        key: currentMonth,
        label: showYear
          ? monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          : monthDate.toLocaleDateString('en-US', { month: 'short' }),
        startIdx: monthStartIdx,
        days: cells.length - monthStartIdx,
      });
    }

    // --- Build week headers (7-day chunks from timeline start) ---
    // Matches SVAR Gantt's { unit: 'day', step: 7 } behavior:
    // groups every 7 days starting from the timeline start date,
    // NOT aligned to any particular weekday (ISO Monday etc.).
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      const chunkEnd = Math.min(i + 7, cells.length);
      const firstCell = cells[i].date;
      const lastCell = cells[chunkEnd - 1].date;
      weeks.push({
        key: `week-${i}`,
        label: `${firstCell.getDate()}-${lastCell.getDate()}`,
        startIdx: i,
        days: chunkEnd - i,
      });
    }

    // --- Build year headers ---
    const years = [];
    let yearStartIdx = 0;
    let currentYearKey = null;
    for (let i = 0; i < cells.length; i++) {
      const yearKey = String(cells[i].date.getFullYear());
      if (yearKey !== currentYearKey) {
        if (currentYearKey !== null) {
          years.push({
            key: currentYearKey,
            label: currentYearKey,
            startIdx: yearStartIdx,
            days: i - yearStartIdx,
          });
        }
        currentYearKey = yearKey;
        yearStartIdx = i;
      }
    }
    if (currentYearKey !== null && cells.length > yearStartIdx) {
      years.push({
        key: currentYearKey,
        label: currentYearKey,
        startIdx: yearStartIdx,
        days: cells.length - yearStartIdx,
      });
    }

    // --- Build quarter headers ---
    const quarters = [];
    let qStartIdx = 0;
    let currentQKey = null;
    for (let i = 0; i < cells.length; i++) {
      const d = cells[i].date;
      const q = Math.floor(d.getMonth() / 3) + 1;
      const qKey = `${d.getFullYear()}-Q${q}`;
      if (qKey !== currentQKey) {
        if (currentQKey !== null) {
          quarters.push({
            key: currentQKey,
            label: `Q${currentQKey.split('-Q')[1]}`,
            startIdx: qStartIdx,
            days: i - qStartIdx,
          });
        }
        currentQKey = qKey;
        qStartIdx = i;
      }
    }
    if (currentQKey !== null && cells.length > qStartIdx) {
      quarters.push({
        key: currentQKey,
        label: `Q${currentQKey.split('-Q')[1]}`,
        startIdx: qStartIdx,
        days: cells.length - qStartIdx,
      });
    }

    return {
      timeScaleCells: cells,
      monthHeaders: months,
      weekHeaders: weeks,
      yearHeaders: years,
      quarterHeaders: quarters,
    };
  }, [startDate, endDate, highlightTime]);

  // Refs for syncing scroll (must be declared before any conditional returns)
  const timeScaleTopRef = useRef(null);
  const timeScaleBottomRef = useRef(null);
  const sidebarRef = useRef(null);
  // Note: chartScrollRef is declared earlier in the component

  // Handle chart scroll - sync with time scale and sidebar
  const handleChartScroll = useCallback((e) => {
    // Sync time scale horizontal scrolls
    if (timeScaleTopRef.current) {
      timeScaleTopRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (timeScaleBottomRef.current) {
      timeScaleBottomRef.current.scrollLeft = e.target.scrollLeft;
    }
    // Sync sidebar vertical scroll
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Handle sidebar scroll - sync with chart
  const handleSidebarScroll = useCallback((e) => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Scroll to today on initial load
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today >= startDate && today <= endDate && chartScrollRef.current) {
      const daysDiff = (today - startDate) / MS_PER_DAY;
      const todayPosition = daysDiff * cellWidth * getUnitMultiplier(lengthUnit);
      // Scroll to position today at the left edge of the view
      const scrollLeft = Math.max(0, todayPosition);

      chartScrollRef.current.scrollLeft = scrollLeft;
      // Also sync time scale
      if (timeScaleTopRef.current) {
        timeScaleTopRef.current.scrollLeft = scrollLeft;
      }
      if (timeScaleBottomRef.current) {
        timeScaleBottomRef.current.scrollLeft = scrollLeft;
      }
    }
  }, [startDate, endDate, cellWidth, lengthUnit]); // Run once when dates/scale change

  // Early return for empty state (after all hooks)
  if (groups.length === 0) {
    return (
      <div className="workload-chart-empty">
        <i className="fas fa-hand-pointer"></i>
        <p>Select assignees or labels to view workload</p>
      </div>
    );
  }

  return (
    <div className="workload-chart-container" ref={containerRef}>
      {/* Time scale header — adapts to scaleLevelName (day/week/month/quarter) */}
      <div className="workload-time-scale">
        {/* Top row */}
        <div className="time-scale-row">
          <div className="time-scale-spacer">
            {scaleLevelName === 'day' ? 'Year / Month'
              : scaleLevelName === 'week' ? 'Month'
              : 'Year'}
          </div>
          <div className="time-scale-scroll" ref={timeScaleTopRef}>
            <div className="time-scale-months" style={{ width: `${chartDimensions.width}px` }}>
              {(scaleLevelName === 'day' || scaleLevelName === 'week'
                ? monthHeaders
                : yearHeaders
              ).map((header) => (
                <div
                  key={header.key}
                  className="time-scale-month"
                  style={{ width: `${header.days * cellWidth}px` }}
                >
                  {header.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Bottom row */}
        <div className="time-scale-row">
          <div className="time-scale-spacer">
            {scaleLevelName === 'day' ? 'Day'
              : scaleLevelName === 'week' ? 'Week'
              : scaleLevelName === 'month' ? 'Month'
              : 'Quarter'}
          </div>
          <div className="time-scale-scroll" ref={timeScaleBottomRef}>
            <div className="time-scale-content" style={{ width: `${chartDimensions.width}px` }}>
              {scaleLevelName === 'day' ? (
                // Day-level: individual day cells
                timeScaleCells.map((cell, idx) => (
                  <div
                    key={idx}
                    className={`time-scale-cell ${cell.isWeekend ? 'weekend' : ''}`}
                    style={{ width: `${cellWidth}px` }}
                  >
                    {cell.label}
                  </div>
                ))
              ) : (
                // Week / Month / Quarter: grouped cells
                (scaleLevelName === 'week' ? weekHeaders
                  : scaleLevelName === 'month' ? monthHeaders
                  : quarterHeaders
                ).map((header) => (
                  <div
                    key={header.key}
                    className="time-scale-cell time-scale-grouped-cell"
                    style={{ width: `${header.days * cellWidth}px` }}
                  >
                    {header.label}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart body */}
      <div className="workload-chart-body">
        {/* Left sidebar (group labels) */}
        <div className="workload-sidebar-column" ref={sidebarRef} onScroll={handleSidebarScroll}>
          {groups.map((group, groupIdx) => {
            const rowCount = Math.max(1, group.rows.length);
            const isLastGroup = groupIdx === groups.length - 1;
            // Add spacing after each group except the last one
            const groupHeight = rowCount * cellHeight + (isLastGroup ? 0 : groupSpacing);
            const isDropTarget = dropTargetGroup && dropTargetGroup.id === group.id;
            return (
              <div
                key={group.id}
                className={`sidebar-group ${isDropTarget ? 'drop-target' : ''}`}
                style={{ height: `${groupHeight}px` }}
              >
                {Array.from({ length: rowCount }).map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={`sidebar-row ${rowIdx === 0 ? 'first-row' : ''}`}
                    style={{ height: `${cellHeight}px` }}
                  >
                    {rowIdx === 0 ? (
                      <>
                        <span className="group-icon">
                          {group.type === 'assignee' ? (
                            <i className="fas fa-user" style={{ color: '#6b4fbb' }}></i>
                          ) : group.type === 'label' ? (
                            <i className="fas fa-tag" style={{ color: '#fc6d26' }}></i>
                          ) : (
                            <i className="fas fa-folder-open" style={{ color: '#6c757d' }}></i>
                          )}
                        </span>
                        <span className="group-name">{group.name}</span>
                        <span className="group-task-count">({group.taskCount})</span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div
          className={`workload-chart-scroll${isMiddleMouseDragging ? ' wx-dragging' : ''}`}
          ref={chartScrollRef}
          onScroll={handleChartScroll}
          onMouseDown={onMiddleMouseDown}
        >
          <div
            className="workload-chart-content"
            style={{
              width: `${chartDimensions.width}px`,
              height: `${chartDimensions.height}px`,
            }}
          >
            {/* Grid background — at coarser scale levels, only boundary lines are visible */}
            <div className={`workload-grid-bg scale-${scaleLevelName}`}>
              {timeScaleCells.map((cell, idx) => {
                // Determine if this cell is a grid-line boundary at the current scale level.
                // Since grid lines use border-right, the boundary must be on the LAST day
                // before each header group starts, so the right edge aligns with the header.
                const nextCell = timeScaleCells[idx + 1];
                let isBoundary = true; // default: every cell is a boundary (day level)
                if (scaleLevelName === 'week') {
                  // Last day of each 7-day chunk
                  isBoundary = idx % 7 === 6;
                } else if (scaleLevelName === 'month') {
                  // Last day before the 1st of next month
                  isBoundary = nextCell ? nextCell.date.getDate() === 1 : true;
                } else if (scaleLevelName === 'quarter') {
                  // Last day before the 1st of a quarter-start month (Jan/Apr/Jul/Oct)
                  isBoundary = nextCell
                    ? (nextCell.date.getDate() === 1 && nextCell.date.getMonth() % 3 === 0)
                    : true;
                }
                return (
                  <div
                    key={idx}
                    className={`grid-column ${cell.isWeekend ? 'weekend' : ''} ${isBoundary ? 'grid-boundary' : 'grid-minor'}`}
                    style={{
                      left: `${idx * cellWidth}px`,
                      width: `${cellWidth}px`,
                      height: `${chartDimensions.height}px`,
                    }}
                  />
                );
              })}
            </div>

            {/* Task bars */}
            {groups.map((group, groupIdx) => {
              // Calculate start Y with spacing between groups
              let groupStartY = 0;
              for (let i = 0; i < groupIdx; i++) {
                groupStartY += Math.max(1, groups[i].rows.length) * cellHeight;
                groupStartY += groupSpacing; // Add spacing after each group
              }

              const rowCount = Math.max(1, group.rows.length);
              return (
                <div key={group.id} className="chart-group">
                  {Array.from({ length: rowCount }).map((_, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="chart-row"
                      style={{
                        top: `${groupStartY + rowIdx * cellHeight}px`,
                        height: `${cellHeight}px`,
                      }}
                    >
                      {(group.rows[rowIdx] || []).map(task => renderTaskBar(task, group, rowIdx))}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Today marker */}
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (today >= startDate && today <= endDate) {
                const daysDiff = (today - startDate) / MS_PER_DAY;
                return (
                  <div
                    className="today-marker"
                    style={{ left: `${daysDiff * cellWidth}px` }}
                  />
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkloadChart;
