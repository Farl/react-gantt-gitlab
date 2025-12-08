/**
 * Custom hook for middle mouse button drag-to-scroll functionality
 * @param {React.RefObject} scrollRef - Reference to the scrollable element
 * @returns {Object} - { isDragging, onMouseDown }
 */

import { useState, useCallback, useEffect } from 'react';

export function useMiddleMouseDrag(scrollRef) {
  const [dragState, setDragState] = useState(null);

  const onMouseDown = useCallback(
    (e) => {
      // Middle mouse button (button === 1)
      if (e.button !== 1) return;

      e.preventDefault();
      const el = scrollRef.current;
      if (!el) return;

      setDragState({
        startX: e.clientX,
        startY: e.clientY,
        scrollLeftStart: el.scrollLeft,
        scrollTopStart: el.scrollTop,
      });
    },
    [scrollRef],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      const el = scrollRef.current;
      if (!el) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      el.scrollLeft = dragState.scrollLeftStart - deltaX;
      el.scrollTop = dragState.scrollTopStart - deltaY;
    };

    const handleMouseUp = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        setDragState(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, scrollRef]);

  return {
    isDragging: !!dragState,
    onMouseDown,
  };
}

export default useMiddleMouseDrag;
