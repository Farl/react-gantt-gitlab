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
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 10.0;
/** Resulting cellWidth bounds (px) */
const MIN_CELL_WIDTH = 8;
const MAX_CELL_WIDTH = 400;
/** Geometric scale factor per wheel tick */
const ZOOM_FACTOR = 1.15;
/** localStorage debounce delay (ms) */
const STORAGE_DEBOUNCE_MS = 300;

/**
 * Clamp the zoom multiplier so that the resulting cellWidth stays within bounds.
 */
function clampMultiplier(multiplier: number, baseCellWidth: number): number {
  if (baseCellWidth <= 0) return 1;
  const minMul = Math.max(MIN_MULTIPLIER, MIN_CELL_WIDTH / baseCellWidth);
  const maxMul = Math.min(MAX_MULTIPLIER, MAX_CELL_WIDTH / baseCellWidth);
  return Math.max(minMul, Math.min(maxMul, multiplier));
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

      // Cursor-anchored scroll adjustment
      const scrollEl = findScrollElement();
      if (scrollEl) {
        const containerRect = container.getBoundingClientRect();
        const cursorX = e.clientX;
        const cursorContentX =
          scrollEl.scrollLeft + (cursorX - containerRect.left);
        const ratio = newMultiplier / oldMultiplier;
        const newScrollLeft =
          cursorContentX * ratio - (cursorX - containerRect.left);
        // Apply scroll adjustment after state update (via rAF to let React render)
        requestAnimationFrame(() => {
          scrollEl.scrollLeft = Math.max(0, newScrollLeft);
        });
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
