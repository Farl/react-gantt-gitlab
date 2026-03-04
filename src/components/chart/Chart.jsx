import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useContext,
  useCallback,
} from 'react';
import CellGrid from './CellGrid.jsx';
import Bars from './Bars.jsx';
import Links from './Links.jsx';
import RowHoverOverlay from './RowHoverOverlay.jsx';
import OffscreenArrows from './OffscreenArrows.jsx';
import { hotkeys } from '@svar-ui/grid-store';
import storeContext from '../../context';
import '../shared/TodayMarker.css';
import { useStore, useStoreWithCounter } from '@svar-ui/lib-react';
import { useMiddleMouseDrag } from '../../hooks/useMiddleMouseDrag';
import { useScrollSync } from '../../hooks/useScrollSync';
import './Chart.css';

function Chart(props) {
  const {
    readonly,
    fullWidth,
    fullHeight,
    taskTemplate,
    cellBorders,
    highlightTime,
    countWorkdays,
    colorRules,
  } = props;

  const api = useContext(storeContext);

  const [selected, selectedCounter] = useStoreWithCounter(api, "_selected");
  const rTasksValue = useStore(api, "_tasks");
  const rScrollLeft = useStore(api, "scrollLeft");
  const rScrollTop = useStore(api, "scrollTop");
  const cellHeight = useStore(api, "cellHeight");
  const cellWidth = useStore(api, "cellWidth");
  const scales = useStore(api, "_scales");
  const rawMarkers = useStore(api, "markers");
  const rScrollTask = useStore(api, "_scrollTask");
  const zoom = useStore(api, "zoom");

  const [chartHeight, setChartHeight] = useState();
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const chartRef = useRef(null);
  const areaRef = useRef(null);

  /**
   * 滾動同步 Hook - 防止 Store ↔ DOM 滾動同步時的無限循環
   *
   * 重要：如果你需要新增滾動相關功能，請使用這個 hook 的 API，
   * 不要直接設定 el.scrollTop 後又在 onScroll 裡更新 store！
   *
   * 詳細說明請參考: src/hooks/useScrollSync.js
   */
  const { syncScrollToDOM, createScrollHandler } = useScrollSync();

  // Middle mouse drag to scroll
  const { isDragging, onMouseDown } = useMiddleMouseDrag(chartRef);

  const handleDeselectLink = useCallback(() => {
    setSelectedLinkId(null);
  }, []);

  const extraRows = 1;


  const selectStyle = useMemo(() => {
    const t = [];
    if (selected && selected.length && cellHeight) {
      selected.forEach((obj) => {
        t.push({ height: `${cellHeight}px`, top: `${obj.$y - 3}px` });
      });
    }
    return t;
  }, [selectedCounter, cellHeight]);

  const chartGridHeight = useMemo(
    () => Math.max(chartHeight || 0, fullHeight),
    [chartHeight, fullHeight],
  );

  // Data request function for virtual scrolling
  const dataRequest = useCallback(() => {
    const el = chartRef.current;
    const clientHeightLocal = chartHeight || 0;
    const num = Math.ceil(clientHeightLocal / (cellHeight || 1)) + 1;
    const pos = Math.floor(((el && el.scrollTop) || 0) / (cellHeight || 1));
    const start = Math.max(0, pos - extraRows);
    const end = pos + num + extraRows;
    const from = start * (cellHeight || 0);
    api.exec('render-data', {
      start,
      end,
      from,
    });
  }, [chartHeight, cellHeight, api]);

  useEffect(() => {
    dataRequest();
  }, [dataRequest]);

  /**
   * 同步 Store → DOM 的滾動位置
   *
   * 當 store 的 scrollTop/scrollLeft 變化時，同步到 DOM。
   * syncScrollToDOM 會設定內部 flag，讓 scroll handler 知道這是「程式化滾動」，
   * 從而避免觸發 store 更新造成無限循環。
   */
  useEffect(() => {
    syncScrollToDOM(chartRef.current, { top: rScrollTop, left: rScrollLeft });
  }, [rScrollTop, rScrollLeft, syncScrollToDOM]);

  /**
   * 滾動事件處理器 - 使用 useScrollSync 防止無限循環
   *
   * - onUserScroll: 只在「使用者實際滾動」時呼叫，用於更新 store
   * - onAnyScroll: 不管是程式化還是使用者滾動都會呼叫，用於 virtual scrolling
   * - throttle: 使用 requestAnimationFrame 節流，避免過度頻繁的更新
   */
  const onScroll = useMemo(
    () =>
      createScrollHandler({
        element: chartRef,
        onUserScroll: (scrollPos) => {
          // 只在使用者滾動時更新 store，避免程式化滾動造成循環
          api.exec('scroll-chart', scrollPos);
        },
        onAnyScroll: () => {
          // Virtual scrolling: 更新可見的列，不管滾動來源
          dataRequest();
        },
        throttle: true,
      }),
    [createScrollHandler, api, dataRequest],
  );

  const showTask = useCallback(
    (value) => {
      if (!value) return;

      const { id, mode } = value;

      if (mode.toString().indexOf('x') < 0) return;
      const el = chartRef.current;
      if (!el) return;
      const { clientWidth } = el;
      const task = api.getTask(id);
      const currentScrollLeft = el.scrollLeft;

      if (task.$x + task.$w < currentScrollLeft) {
        api.exec('scroll-chart', { left: task.$x - (cellWidth || 0) });
      } else if (task.$x >= clientWidth + currentScrollLeft) {
        const width = clientWidth < task.$w ? cellWidth || 0 : task.$w;
        api.exec('scroll-chart', { left: task.$x - clientWidth + width });
      }
    },
    [api, cellWidth],
  );

  useEffect(() => {
    showTask(rScrollTask);
  }, [rScrollTask, showTask]);


  function onWheel(e) {
    if (zoom && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const el = chartRef.current;
      const dir = -Math.sign(e.deltaY);
      const offset = e.clientX - (el ? el.getBoundingClientRect().left : 0);
      api.exec('zoom-scale', {
        dir,
        offset,
      });
    }
  }

  function getHoliday(cell) {
    const style = highlightTime(cell.date, cell.unit);
    if (style)
      return {
        css: style,
        width: cell.width,
      };
    return null;
  }

  const holidays = useMemo(() => {
    if (!scales || !highlightTime) return null;
    if (scales.minUnit !== 'hour' && scales.minUnit !== 'day') return null;

    const finestRow = scales.rows[scales.rows.length - 1];
    const finestStep = finestRow.cells.length > 1
      ? Math.round((finestRow.cells[1].date - finestRow.cells[0].date) / (1000 * 60 * 60 * 24))
      : 1;

    // When finest scale cells are individual days (step=1), use them directly
    if (finestStep <= 1) {
      return finestRow.cells.map(getHoliday);
    }

    // When scale cells span multiple days (e.g. week-level with step=7),
    // generate individual day-level holiday cells using cellWidth (px per day).
    // The CellGrid still renders day-level grid lines, so holidays should match.
    const dayWidth = cellWidth;
    const timelineStart = new Date(scales.start);
    const totalDays = Math.ceil(scales.width / dayWidth);
    const result = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(timelineStart);
      date.setDate(date.getDate() + i);
      const style = highlightTime(date, 'day');
      if (style) {
        result.push({ css: style, left: i * dayWidth, width: dayWidth });
      } else {
        result.push(null);
      }
    }
    return result;
  }, [scales, highlightTime, cellWidth]);

  // Compute marker pixel positions from raw markers + _scales
  // SVAR v2.5 moved _markers processing to pro-only, so we calculate it ourselves.
  const markers = useMemo(() => {
    if (!rawMarkers || !rawMarkers.length || !scales || !scales.start) return null;

    const lengthUnit = api?.getState?.().lengthUnit || 'day';
    const unitWidth = scales.lengthUnitWidth || cellWidth;
    const timelineStart = new Date(scales.start);

    return rawMarkers.map((m) => {
      const markerDate = m.start instanceof Date ? m.start : new Date(m.start);
      let unitsDiff;
      switch (lengthUnit) {
        case 'hour': {
          unitsDiff = (markerDate - timelineStart) / (1000 * 60 * 60);
          break;
        }
        case 'day':
        default: {
          unitsDiff = (markerDate - timelineStart) / (1000 * 60 * 60 * 24);
          break;
        }
      }
      return {
        left: unitsDiff * unitWidth,
        css: m.css || '',
        text: m.text || '',
      };
    });
  }, [rawMarkers, scales, cellWidth, api]);

  function handleHotkey(ev) {
    ev.eventSource = 'chart';
    api.exec('hotkey', ev);
  }

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => {
      setChartHeight(el.clientHeight);
      setChartWidth(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [chartRef.current]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const cleanup = hotkeys(el, {
      keys: {
        arrowup: true,
        arrowdown: true,
      },
      exec: (v) => handleHotkey(v),
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [chartRef.current]);
  
  useEffect(() => {
    const node = chartRef.current;
    if (!node) return;

    const handler = onWheel;
    // Use passive: false only when zoom is enabled to allow preventDefault
    node.addEventListener('wheel', handler, { passive: !zoom });
    return () => {
      node.removeEventListener('wheel', handler);
    };
  }, [onWheel, zoom])

  return (
    <div
      className={`wx-mR7v2Xag wx-chart${isDragging ? ' wx-dragging' : ''}`}
      tabIndex={-1}
      ref={chartRef}
      onScroll={onScroll}
      onMouseDown={onMouseDown}
    >
      {markers && markers.length ? (
        <div
          className="wx-mR7v2Xag wx-markers"
          style={{ height: `${chartGridHeight}px` }}
        >
          {markers.map((marker, i) => (
            <div
              key={i}
              className={`wx-mR7v2Xag wx-marker ${marker.css || 'wx-default'}`}
              style={{ left: `${marker.left}px` }}
            >
              <div className="wx-mR7v2Xag wx-content">{marker.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        ref={areaRef}
        className="wx-mR7v2Xag wx-area"
        style={{ width: `${fullWidth}px`, height: `${chartGridHeight}px` }}
      >
        {holidays ? (
          <div
            className="wx-mR7v2Xag wx-gantt-holidays"
            style={{ height: '100%' }}
          >
            {holidays.map((holiday, i) =>
              holiday ? (
                <div
                  key={i}
                  className={'wx-mR7v2Xag ' + holiday.css}
                  style={{
                    width: `${holiday.width}px`,
                    left: `${holiday.left != null ? holiday.left : i * holiday.width}px`,
                  }}
                />
              ) : null,
            )}
          </div>
        ) : null}

        <CellGrid borders={cellBorders} />

        {selected && selected.length
          ? selected.map((obj, index) =>
              obj.$y ? (
                <div
                  key={obj.id}
                  className="wx-mR7v2Xag wx-selected"
                  data-id={obj.id}
                  style={selectStyle[index]}
                ></div>
              ) : null,
            )
          : null}

        <Links
          readonly={readonly}
          selectedLinkId={selectedLinkId}
          onSelectLink={setSelectedLinkId}
        />
        <Bars
          readonly={readonly}
          taskTemplate={taskTemplate}
          colorRules={colorRules}
          onDeselectLink={handleDeselectLink}
        />
      </div>

      {/* Off-screen arrows - placed at chart level to avoid overflow clipping */}
      <OffscreenArrows
        scrollLeft={rScrollLeft}
        viewportWidth={chartWidth}
        cellHeight={cellHeight}
        chartRef={chartRef}
      />

      {/* Row hover overlay - placed at chart level to avoid overflow clipping */}
      <RowHoverOverlay
        tasks={rTasksValue}
        cellHeight={cellHeight}
        cellWidth={cellWidth}
        scrollLeft={rScrollLeft}
        scrollTop={rScrollTop}
        readonly={readonly}
        api={api}
        scales={scales}
        countWorkdays={countWorkdays}
        areaRef={areaRef}
        chartRef={chartRef}
      />
    </div>
  );
}

export default Chart;
