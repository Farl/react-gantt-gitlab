/**
 * LabelTooltip
 * Shared portal-rendered tooltip showing all labels with colored badges.
 * Used by: LabelCell (Gantt grid), KanbanCard.
 *
 * Uses position:fixed with viewport-based flip logic to avoid
 * overflowing the visible area.
 */

import { useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { LabelBadge } from './LabelBadge.jsx';

/**
 * @param {object} props
 * @param {React.RefObject} props.anchorRef - Ref to the anchor element for positioning
 * @param {string[]} props.labels - Array of label titles
 * @param {Map} props.colorMap - Map of label title to hex color
 */
export function LabelTooltip({ anchorRef, labels, colorMap }) {
  const tooltipRef = useRef(null);

  // Position the tooltip after render using requestAnimationFrame
  // to ensure accurate height measurement for flip logic
  useLayoutEffect(() => {
    if (!anchorRef.current || !tooltipRef.current) return;

    const positionTooltip = () => {
      const el = tooltipRef.current;
      const anchor = anchorRef.current;
      if (!el || !anchor) return;

      const rect = anchor.getBoundingClientRect();
      const tooltipRect = el.getBoundingClientRect();
      const tooltipHeight = tooltipRect.height || 0;
      const tooltipWidth = tooltipRect.width || 0;

      // Vertical: flip to above if below space is insufficient
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      if (spaceBelow < tooltipHeight + 4 && spaceAbove >= tooltipHeight + 4) {
        top = rect.top - tooltipHeight - 4;
      } else {
        top = rect.top;
      }

      // Horizontal: clamp to viewport so tooltip doesn't overflow right edge
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      if (left < 8) left = 8;

      el.style.position = 'fixed';
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.zIndex = '99999';
    };

    requestAnimationFrame(positionTooltip);
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      className="label-cell-tooltip-portal"
    >
      {labels.map((title, index) => (
        <LabelBadge key={index} name={title} color={colorMap?.get(title)} />
      ))}
    </div>,
    document.body
  );
}
