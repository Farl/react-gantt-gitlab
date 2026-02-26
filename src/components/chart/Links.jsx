import { useCallback, useContext, useEffect, useMemo } from 'react';
import storeContext from '../../context';
import { useStore } from '@svar-ui/lib-react';
import { isFolderTask, isMilestoneTask } from '../../utils/TaskTypeUtils';
import './Links.css';

/**
 * ====================================================================
 * Library Hardcoded Constants (@svar-ui/gantt-store)
 * ====================================================================
 * 來源：node_modules/@svar-ui/gantt-store/dist/index.js
 * 注意：如果 library 更新這些值，這裡也需要同步更新
 */

/** `const gt = 20` - link 水平偏移距離上限 */
const LIBRARY_LINK_OFFSET_MAX = 20;

/** `u = s ? e.$y - 7 : e.$y` - baseline 啟用時的 Y 座標偏移 */
const LIBRARY_BASELINE_Y_OFFSET = 7;

/** `const r = Math.round(a / 2) - 3` - bar 中心垂直位置的微調值 */
const LIBRARY_BAR_CENTER_ADJUST = 3;

/** `ha` function - 箭頭水平尺寸 (±5) */
const LIBRARY_ARROW_WIDTH = 5;

/** `ha` function - 箭頭垂直尺寸 (±3) */
const LIBRARY_ARROW_HEIGHT = 3;

/**
 * ====================================================================
 * Custom Constants
 * ====================================================================
 */

/** 繞過 bar 時，路徑與 bar 之間的間距 */
const DETOUR_PADDING = 10;

/**
 * ====================================================================
 * Helper Functions
 * ====================================================================
 */

/**
 * 根據 link type 判斷起點/終點位置
 * @param {string} linkType - 'e2s' | 's2s' | 'e2e' | 's2e'
 */
function getLinkEndpoints(linkType) {
  const isFromStart = linkType === 's2s' || linkType === 's2e';
  const isToStart = linkType === 'e2s' || linkType === 's2s';
  return { isFromStart, isToStart };
}

/**
 * 計算任務的連接點 X 座標
 */
function getTaskConnectionX(task, isStart) {
  return isStart ? task.$x : task.$x + task.$w;
}

/**
 * 生成箭頭的 polyline points（與 library 的 ha 函數一致）
 */
function generateArrowPoints(endX, endY, isToStart) {
  const w = LIBRARY_ARROW_WIDTH;
  const h = LIBRARY_ARROW_HEIGHT;

  return isToStart
    ? `${endX - w},${endY - h},${endX - w},${endY + h},${endX},${endY}`
    : `${endX + w},${endY + h},${endX + w},${endY - h},${endX},${endY}`;
}

/**
 * 生成路徑的 polyline points
 */
function generatePathPoints(points) {
  return points.map(([x, y]) => `${x},${y}`).join(',');
}

/**
 * 檢查任務是否有可見的 bar
 *
 * 判斷邏輯（與 OffscreenArrows.jsx 一致）：
 * 1. 必須有座標資訊 ($x, $y, $w, $h)
 * 2. GitLab milestone：檢查 $isMilestone 或 _gitlab.type === 'milestone'
 * 3. 普通任務：需要有 _gitlab.dueDate
 *    - 沒有 dueDate 的任務可能有 fallback bar（用 created_at），但不應該顯示 link
 */
function hasVisibleBar(task) {
  if (!task) return false;

  // 基本座標檢查（$x, $y 可能為 0，所以用 != null）
  if (task.$x == null || task.$y == null || task.$w == null || task.$h == null) {
    return false;
  }
  if (task.$w <= 0 || task.$h <= 0) {
    return false;
  }

  // Folders have no bar — no link connections
  if (isFolderTask(task)) {
    return false;
  }

  // GitLab milestone 特殊處理：日期存在 task.start/end，不在 _gitlab
  const isGitLabMilestone = isMilestoneTask(task);
  if (isGitLabMilestone) {
    return true;
  }

  // Gantt summary 類型：如果有座標就算有 bar
  if (task.type === 'summary') {
    return true;
  }

  // 普通任務：必須有 _gitlab.dueDate 才算有真正的 bar
  // 沒有 dueDate 的任務 bar 是 fallback（用 created_at），不應該顯示 link
  return !!task._gitlab?.dueDate;
}

/**
 * ====================================================================
 * Link Path Calculation
 * ====================================================================
 */

/**
 * 計算 link 路徑
 *
 * 改進 library 的行為：
 * 1. 使用動態水平偏移量（cellWidth / 2，最大 20px），在不同 zoom level 下更自然
 * 2. 「下往上」的 link 從目標下方繞過，而非上方（修正 library 的 ㄇ 字形問題）
 *
 * @returns {{ points: string, midX: number, midY: number }}
 */
function calculateLinkPath(link, sourceTask, targetTask, cellHeight, cellWidth, baselines) {
  const { isFromStart, isToStart } = getLinkEndpoints(link.type);

  // 動態水平偏移量：cellWidth 的一半，但不超過上限
  const linkOffset = Math.min(cellWidth / 2, LIBRARY_LINK_OFFSET_MAX);

  // bar 中心的垂直偏移（與 library 一致）
  const barCenterOffset = Math.round(cellHeight / 2) - LIBRARY_BAR_CENTER_ADJUST;

  // baseline 啟用時，Y 座標需要減去偏移值
  const sourceY = baselines ? sourceTask.$y - LIBRARY_BASELINE_Y_OFFSET : sourceTask.$y;
  const targetY = baselines ? targetTask.$y - LIBRARY_BASELINE_Y_OFFSET : targetTask.$y;

  // 起點（源任務）
  const startX = getTaskConnectionX(sourceTask, isFromStart);
  const startY = sourceY + barCenterOffset;

  // 終點（目標任務）
  const endX = getTaskConnectionX(targetTask, isToStart);
  const endY = targetY + barCenterOffset;

  // 水平偏移後的轉折點 X 座標
  const turnX1 = startX + (isFromStart ? -linkOffset : linkOffset);
  const turnX2 = endX + (isToStart ? -linkOffset : linkOffset);

  // 判斷是否需要繞開（轉折點會交叉，表示路徑會穿過 bar）
  const needsDetour = turnX1 >= turnX2;

  let pathPoints;
  let midX, midY;

  if (needsDetour) {
    // 需要繞開：決定從哪個 bar 的下方繞過
    const isTargetAbove = targetY < sourceY;
    const detourTask = isTargetAbove ? targetTask : sourceTask;
    const detourBaseY = isTargetAbove ? targetY : sourceY;
    const barHeight = detourTask.$h;
    const detourY = detourBaseY + barHeight + DETOUR_PADDING;

    // Midpoint: center of the horizontal detour segment
    midX = (turnX1 + turnX2) / 2;
    midY = detourY;

    pathPoints = generatePathPoints([
      [startX, startY],
      [turnX1, startY],
      [turnX1, detourY],
      [turnX2, detourY],
      [turnX2, endY],
      [endX, endY],
    ]);
  } else {
    // 不需要繞開：直接連接
    // Midpoint: vertical segment midpoint
    midX = turnX1;
    midY = (startY + endY) / 2;

    pathPoints = generatePathPoints([
      [startX, startY],
      [turnX1, startY],
      [turnX1, endY],
      [endX, endY],
    ]);
  }

  return {
    points: `${pathPoints},${generateArrowPoints(endX, endY, isToStart)}`,
    midX,
    midY,
  };
}

/**
 * ====================================================================
 * Component
 * ====================================================================
 */

export default function Links({ readonly, selectedLinkId, onSelectLink }) {
  const api = useContext(storeContext);
  const links = useStore(api, "_links");
  const tasks = useStore(api, "_tasks");
  const cellHeight = useStore(api, "cellHeight");
  const cellWidth = useStore(api, "cellWidth");
  const baselines = useStore(api, "baselines");

  // task ID -> task 物件的 Map（效能優化）
  const taskMap = useMemo(() => {
    const map = new Map();
    (tasks || []).forEach(task => map.set(task.id, task));
    return map;
  }, [tasks]);

  // 重新計算所有 link 路徑，使用動態水平偏移量
  // 只處理兩端任務都有可見 bar 的 link
  const processedLinks = useMemo(() => {
    return (links || [])
      .map(link => {
        const sourceTask = taskMap.get(link.source);
        const targetTask = taskMap.get(link.target);

        // 只有當兩端任務都有可見的 bar 時才計算路徑
        if (hasVisibleBar(sourceTask) && hasVisibleBar(targetTask)) {
          const { points, midX, midY } = calculateLinkPath(
            link, sourceTask, targetTask, cellHeight, cellWidth, baselines
          );
          return { ...link, $p: points, $midX: midX, $midY: midY };
        }
        // 任一端沒有可見 bar，不顯示此 link
        return null;
      })
      .filter(Boolean);
  }, [links, taskMap, cellHeight, cellWidth, baselines]);

  // Dispatch delete-link action for the given link object
  const deleteLink = useCallback((link) => {
    api.exec('delete-link', {
      id: link.id,
      link: { source: link.source, target: link.target },
    });
    onSelectLink(null);
  }, [api, onSelectLink]);

  // Click on a polyline to select/deselect the link
  const handleLinkClick = useCallback((e, link) => {
    if (readonly) return;
    e.stopPropagation();
    onSelectLink(selectedLinkId === link.id ? null : link.id);
  }, [readonly, selectedLinkId, onSelectLink]);

  // Click delete button to remove the link
  const handleDeleteClick = useCallback((e, link) => {
    e.stopPropagation();
    deleteLink(link);
  }, [deleteLink]);

  // Keyboard: Delete/Backspace to delete selected link, Escape to deselect
  useEffect(() => {
    if (!selectedLinkId || readonly) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't intercept if user is typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        const link = processedLinks.find(l => l.id === selectedLinkId);
        if (link) deleteLink(link);
      }
      if (e.key === 'Escape') {
        onSelectLink(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLinkId, readonly, processedLinks, deleteLink, onSelectLink]);

  // Find the selected link for rendering the delete button
  const selectedLink = selectedLinkId
    ? processedLinks.find(l => l.id === selectedLinkId)
    : null;

  return (
    <div className="wx-dkx3NwEn wx-links-container">
      <svg className="wx-dkx3NwEn wx-links">
        {processedLinks.map(link => (
          <polyline
            className={
              'wx-dkx3NwEn wx-line' +
              (link.id === selectedLinkId ? ' wx-link-selected' : '')
            }
            points={link.$p}
            key={link.id}
            onClick={readonly ? undefined : (e) => handleLinkClick(e, link)}
          />
        ))}
      </svg>
      {!readonly && selectedLink && (
        <div
          className="wx-dkx3NwEn wx-link-delete-btn"
          style={{
            left: `${selectedLink.$midX}px`,
            top: `${selectedLink.$midY}px`,
          }}
          onClick={(e) => handleDeleteClick(e, selectedLink)}
          title="Delete link"
        >
          <svg viewBox="0 0 12 12" width="12" height="12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}
    </div>
  );
}
