/**
 * useCtrlWheelZoom Hook
 * Provides Ctrl+Wheel (or Cmd+Wheel on Mac) visual zoom for chart containers.
 * Changes only the visual cell width — does NOT change time granularity (lengthUnit/scales).
 *
 * Usage:
 *   const { zoomedCellWidth, zoomMultiplier, resetZoom, zoomLabel, setContainerRef } = useCtrlWheelZoom({
 *     baseCellWidth: effectiveCellWidth,
 *     storagePrefix: 'gantt',
 *   });
 *   // Then on the container element:
 *   <div ref={setContainerRef} tabIndex={-1}>
 *
 * Uses a callback ref pattern so the wheel listener is attached even when the
 * container element is rendered conditionally (e.g. after data loading).
 *
 * Cursor-anchored zoom: adjusts scrollLeft so the content under the cursor stays fixed.
 * Uses a reference element (marker or bar) to track actual content movement across
 * SVAR's scale transitions (day→week→month), which avoids drift from SVAR's non-linear
 * grid layout. A continuous rAF poll loop keeps scroll anchored against SVAR's delayed
 * re-renders and Chart.jsx's syncScrollToDOM overwrites.
 *
 * Supports Ctrl+0 / Cmd+0 keyboard shortcut to reset zoom.
 * Persists zoom multiplier to localStorage (debounced).
 * Auto-resets to 1.0× when baseCellWidth changes (e.g. lengthUnit switch).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface UseCtrlWheelZoomOptions {
  /** The base cellWidth before zoom (typically effectiveCellWidth) */
  baseCellWidth: number;
  /** Storage key prefix for persistence, e.g. 'gantt' or 'workload' */
  storagePrefix: string;
  /** Whether zoom is enabled (default: true) */
  enabled?: boolean;
  /**
   * CSS selector for the scrollable child inside the container.
   * Used for cursor-anchored scroll adjustment.
   * If not provided, the hook looks for '.wx-chart' (SVAR Gantt) or
   * '.workload-chart-scroll' (WorkloadChart), then falls back to the container itself.
   */
  scrollSelector?: string;
}

export interface UseCtrlWheelZoomReturn {
  /** The cellWidth after zoom multiplier is applied */
  zoomedCellWidth: number;
  /** Current zoom multiplier (1.0 = no zoom) */
  zoomMultiplier: number;
  /** Reset zoom to 1.0× */
  resetZoom: () => void;
  /** Display label, e.g. "125%" */
  zoomLabel: string;
  /**
   * Callback ref — pass this as `ref={setContainerRef}` on the container element.
   * This ensures the wheel listener is attached even for conditionally rendered elements.
   */
  setContainerRef: (node: HTMLElement | null) => void;
}

/** Zoom multiplier bounds */
const MIN_MULTIPLIER = 0.005;
const MAX_MULTIPLIER = 10.0;
/**
 * Resulting cellWidth bounds (px-per-day when lengthUnit='day').
 * Set to 1px to allow deep zoom-out — the adaptive scale system
 * (useAdaptiveScales) ensures SVAR cells remain well-sized via its multiplier.
 */
const MIN_CELL_WIDTH = 1;
const MAX_CELL_WIDTH = 400;
/** Geometric scale factor per wheel tick */
const ZOOM_FACTOR = 1.15;
/** localStorage debounce delay (ms) */
const STORAGE_DEBOUNCE_MS = 300;
/**
 * How long (ms) to keep the scroll anchor alive after the last wheel event.
 * The rAF poll runs continuously during this window to fight SVAR's delayed
 * re-renders and Chart.jsx's syncScrollToDOM overwrites.
 */
const GESTURE_END_DELAY_MS = 500;

/**
 * Clamp the zoom multiplier so that the resulting cellWidth stays within bounds.
 */
function clampMultiplier(multiplier: number, baseCellWidth: number): number {
  if (baseCellWidth <= 0) return 1;
  const minMul = Math.max(MIN_MULTIPLIER, MIN_CELL_WIDTH / baseCellWidth);
  const maxMul = Math.min(MAX_MULTIPLIER, MAX_CELL_WIDTH / baseCellWidth);
  return Math.max(minMul, Math.min(maxMul, multiplier));
}

// ---------------------------------------------------------------------------
// Zoom anchor state — tracks cursor position during a zoom gesture
// ---------------------------------------------------------------------------

interface ZoomAnchor {
  /** Cursor position as fraction of scrollWidth (fallback when no ref element) */
  timeFraction: number;
  /** Cursor distance from scrollEl's left edge (px) */
  cursorOffset: number;
  /** The scrollable element (.wx-chart) */
  scrollEl: HTMLElement;
  /** scrollWidth from last poll cycle — used to detect SVAR re-renders */
  lastScrollWidth: number;
  /** Reference element (marker or bar) for tracking content movement */
  refEl: HTMLElement | null;
  /** refEl.style.left from last poll cycle */
  oldRefLeft: number;
  /** Cursor's content-space X from last poll cycle */
  oldContentX: number;
}

export function useCtrlWheelZoom({
  baseCellWidth,
  storagePrefix,
  enabled = true,
  scrollSelector,
}: UseCtrlWheelZoomOptions): UseCtrlWheelZoomReturn {
  const storageKey = `${storagePrefix}-zoom-multiplier`;

  // Callback ref state — triggers re-render (and thus re-run of useEffect) when element appears
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const setContainerRef = useCallback((node: HTMLElement | null) => {
    setContainer(node);
  }, []);

  // Load initial multiplier from localStorage
  const [zoomMultiplier, setZoomMultiplier] = useState(() => {
    if (!enabled) return 1;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseFloat(saved);
      if (Number.isFinite(parsed) && parsed > 0) {
        return clampMultiplier(parsed, baseCellWidth);
      }
    }
    return 1;
  });

  // Track previous baseCellWidth to detect lengthUnit changes → reset zoom
  const prevBaseCellWidthRef = useRef(baseCellWidth);
  useEffect(() => {
    if (prevBaseCellWidthRef.current !== baseCellWidth) {
      prevBaseCellWidthRef.current = baseCellWidth;
      setZoomMultiplier(1);
      localStorage.setItem(storageKey, '1');
    }
  }, [baseCellWidth, storageKey]);

  // Debounced localStorage persistence
  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (storageTimerRef.current) {
      clearTimeout(storageTimerRef.current);
    }
    storageTimerRef.current = setTimeout(() => {
      localStorage.setItem(storageKey, zoomMultiplier.toString());
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (storageTimerRef.current) {
        clearTimeout(storageTimerRef.current);
      }
    };
  }, [zoomMultiplier, storageKey]);

  // Find the scrollable element inside the container
  const findScrollElement = useCallback((): HTMLElement | null => {
    if (!container) return null;

    if (scrollSelector) {
      return container.querySelector(scrollSelector);
    }
    // Auto-detect: SVAR Gantt's chart scroll container or WorkloadChart's scroll container
    return (
      (container.querySelector('.wx-chart') as HTMLElement) ||
      (container.querySelector('.workload-chart-scroll') as HTMLElement) ||
      container
    );
  }, [container, scrollSelector]);

  // Keep a ref to zoomMultiplier for use in the wheel handler (avoids stale closures)
  const zoomMultiplierRef = useRef(zoomMultiplier);
  zoomMultiplierRef.current = zoomMultiplier;

  const baseCellWidthRef = useRef(baseCellWidth);
  baseCellWidthRef.current = baseCellWidth;

  // Zoom anchor and gesture-end timer refs
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const zoomEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wheel event handler — depends on `container` state so it re-runs when element appears
  useEffect(() => {
    if (!enabled || !container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();

      const dir = -Math.sign(e.deltaY); // +1 = zoom in, -1 = zoom out
      if (dir === 0) return;

      const oldMultiplier = zoomMultiplierRef.current;
      const base = baseCellWidthRef.current;
      let newMultiplier =
        dir > 0 ? oldMultiplier * ZOOM_FACTOR : oldMultiplier / ZOOM_FACTOR;
      newMultiplier = clampMultiplier(newMultiplier, base);

      // Snap to 1.0 if close enough (within 3%)
      if (Math.abs(newMultiplier - 1) < 0.03) {
        newMultiplier = 1;
      }

      if (newMultiplier === oldMultiplier) return;

      // Reset gesture-end timer on every wheel event. The rAF poll loop runs
      // continuously until this timer fires, keeping scroll anchored against
      // SVAR's delayed re-renders and Chart.jsx's syncScrollToDOM overwrites.
      if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
      zoomEndTimerRef.current = setTimeout(() => {
        zoomAnchorRef.current = null;
      }, GESTURE_END_DELAY_MS);

      // --- Cursor-anchored scroll adjustment ---
      //
      // Uses a reference element (marker or bar) to track how content actually
      // moves across zoom/scale transitions. The ref element's ratio
      // (newRefLeft / oldRefLeft) captures SVAR's actual content scaling,
      // including non-linear shifts at scale boundaries (day→week→month).
      //
      // The cursor's content position is scaled by the same ratio, then
      // scrollLeft is set so the cursor stays at the same screen position.
      const scrollEl = findScrollElement();
      if (scrollEl) {
        // Use scrollEl's rect (not container's) because the container includes
        // the left grid/table panel whose width would corrupt cursorOffset.
        const scrollRect = scrollEl.getBoundingClientRect();
        const cursorOffset = e.clientX - scrollRect.left;

        // Find a reference element to track content movement.
        const refEl = (scrollEl.querySelector('.wx-marker') ||
          scrollEl.querySelector('.wx-bar')) as HTMLElement | null;
        const oldRefLeft = refEl ? parseFloat(refEl.style.left) || 0 : 0;
        const oldScrollLeft = scrollEl.scrollLeft;
        const oldScrollWidth = scrollEl.scrollWidth;

        // Compute cursor's content-space X from the ref element's screen
        // position, not scrollLeft + cursorOffset. When SVAR re-renders between
        // gesture end and next wheel event, scrollLeft is stale but the ref
        // element's position is already updated. This keeps oldContentX and
        // oldRefLeft consistent (same layout frame).
        let oldContentX: number;
        if (refEl) {
          const refScreenX = scrollRect.left + (oldRefLeft - oldScrollLeft);
          oldContentX = oldRefLeft + (e.clientX - refScreenX);
        } else {
          oldContentX = oldScrollLeft + cursorOffset;
        }

        const timeFraction =
          oldScrollWidth > 0 ? oldContentX / oldScrollWidth : 0;

        const anchor = zoomAnchorRef.current;
        if (anchor) {
          // Gesture in progress — update only cursorOffset and lastScrollWidth.
          // oldRefLeft/oldContentX must stay from the last successful poll
          // resolution, not the current DOM (which SVAR hasn't updated yet).
          anchor.lastScrollWidth = scrollEl.scrollWidth;
          anchor.cursorOffset = cursorOffset;
        } else {
          // Start new gesture
          zoomAnchorRef.current = {
            timeFraction,
            cursorOffset,
            scrollEl,
            lastScrollWidth: oldScrollWidth,
            refEl,
            oldRefLeft,
            oldContentX,
          };

          // Start rAF poll loop — runs until gesture-end timer clears the anchor
          let targetScrollLeft = -1;
          const poll = () => {
            const a = zoomAnchorRef.current;
            if (!a) return; // gesture ended

            const newScrollWidth = a.scrollEl.scrollWidth;
            if (newScrollWidth !== a.lastScrollWidth) {
              // SVAR re-rendered — compute new scroll position
              if (a.refEl && a.refEl.isConnected) {
                const newRefLeft = parseFloat(a.refEl.style.left) || 0;
                const ratio = a.oldRefLeft > 0 ? newRefLeft / a.oldRefLeft : 1;
                const newContentX = a.oldContentX * ratio;
                targetScrollLeft = Math.max(0, newContentX - a.cursorOffset);
              } else {
                // Fallback: no ref element, use scrollWidth ratio
                const newContentX = a.timeFraction * newScrollWidth;
                targetScrollLeft = Math.max(0, newContentX - a.cursorOffset);
              }
              a.scrollEl.scrollLeft = targetScrollLeft;

              // Update state for next poll cycle
              a.lastScrollWidth = a.scrollEl.scrollWidth;
              a.oldRefLeft = a.refEl ? parseFloat(a.refEl.style.left) || 0 : 0;
              a.oldContentX = a.scrollEl.scrollLeft + a.cursorOffset;
              requestAnimationFrame(poll);
            } else {
              // Idle frame: re-apply target if Chart.jsx's syncScrollToDOM
              // overwrote it with a stale SVAR store value
              if (
                targetScrollLeft >= 0 &&
                Math.abs(a.scrollEl.scrollLeft - targetScrollLeft) > 1
              ) {
                a.scrollEl.scrollLeft = targetScrollLeft;
              }
              requestAnimationFrame(poll);
            }
          };
          requestAnimationFrame(poll);
        }
      }

      setZoomMultiplier(newMultiplier);
    };

    // passive: false is required to call preventDefault and suppress browser zoom
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, container, findScrollElement]);

  // Ctrl+0 / Cmd+0 keyboard shortcut to reset zoom
  useEffect(() => {
    if (!enabled || !container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoomMultiplier(1);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, container]);

  const resetZoom = useCallback(() => {
    setZoomMultiplier(1);
  }, []);

  const zoomedCellWidth = useMemo(() => {
    return Math.round(baseCellWidth * zoomMultiplier);
  }, [baseCellWidth, zoomMultiplier]);

  const zoomLabel = useMemo(() => {
    return `${Math.round(zoomMultiplier * 100)}%`;
  }, [zoomMultiplier]);

  return {
    zoomedCellWidth,
    zoomMultiplier,
    resetZoom,
    zoomLabel,
    setContainerRef,
  };
}
