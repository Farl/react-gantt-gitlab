import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  useState,
} from 'react';

// core widgets lib
import { Locale } from '@svar-ui/react-core';
import { en } from '@svar-ui/gantt-locales';
import { en as coreEn } from '@svar-ui/core-locales';

// locale helpers
import { locale as createLocale } from '@svar-ui/lib-dom';

// stores
import { EventBusRouter } from '@svar-ui/lib-state';
import { DataStore, defaultColumns, defaultTaskTypes, format as dateFnsFormat, normalizeZoom } from '@svar-ui/gantt-store';

import { WEEK_START_DAY } from '../utils/dateUtils';

// context
import StoreContext from '../context';

// store factory
import { writable } from '@svar-ui/lib-react';

// ui
import Layout from './Layout.jsx';

// config preparation helpers (format string processing, zoom normalization)
import { prepareScales, prepareFormats, prepareZoom } from '../helpers/prepareConfig.js';


const camelize = (s) =>
  s
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join('');

// v2.5 breaking change: scale format strings are no longer processed through date-fns.
// String values are used literally. Must use format functions instead.
const defaultScales = [
  { unit: 'month', step: 1, format: (d) => dateFnsFormat(d, 'MMMM yyyy') },
  { unit: 'day', step: 1, format: (d) => dateFnsFormat(d, 'd') },
];

const Gantt = forwardRef(function Gantt(
  {
    taskTemplate = null,
    markers = [],
    taskTypes = defaultTaskTypes,
    tasks = [],
    selected = [],
    activeTask = null,
    links = [],
    scales = defaultScales,
    columns = defaultColumns,
    start = null,
    end = null,
    lengthUnit = 'day',
    durationUnit = 'day',
    cellWidth = 100,
    cellHeight = 38,
    scaleHeight = 36,
    readonly = false,
    cellBorders = 'full',
    zoom = false,
    baselines = false,
    highlightTime = null,
    countWorkdays = null,
    init = null,
    autoScale = true,
    unscheduledTasks = false,
    colorRules = [],
    ...restProps
  },
  ref,
) {
  // keep latest rest props for event routing
  const restPropsRef = useRef();
  restPropsRef.current = restProps;

  // init stores
  const dataStore = useMemo(() => new DataStore(writable), []);

  // Build locale and extract calendar for format string processing.
  // This enables %-style format strings (e.g. '%F %Y') in scale/zoom configs
  // to be converted to formatter functions via dateToString.
  const calendarLocale = useMemo(() => {
    const words = { ...coreEn, ...en };
    const l = createLocale(words);
    return l.getRaw().calendar;
  }, []);

  // Translation helper for unit format labels (e.g. "Week", "Q")
  const ganttTranslate = useMemo(() => {
    const ganttWords = en.gantt || {};
    return (key) => ganttWords[key] || key;
  }, []);

  // Normalize config: process format strings in scales/zoom, run normalizeZoom
  const normalizedConfig = useMemo(() => {
    const config = {
      zoom: prepareZoom(zoom, calendarLocale),
      scales: prepareScales(scales, calendarLocale),
      cellWidth,
    };
    // normalizeZoom generates auto zoom levels when zoom=true (no custom levels),
    // and validates/enhances custom zoom configs
    if (config.zoom) {
      const unitFormats = prepareFormats(calendarLocale, ganttTranslate);
      const normalized = normalizeZoom(
        config.zoom,
        unitFormats,
        config.scales,
        cellWidth,
      );
      return { ...config, ...normalized };
    }
    return config;
  }, [zoom, scales, cellWidth, calendarLocale, ganttTranslate]);
  const firstInRoute = useMemo(() => dataStore.in, [dataStore]);

  const lastInRouteRef = useRef(null);
  if (lastInRouteRef.current === null) {
    lastInRouteRef.current = new EventBusRouter((a, b) => {
      const name = 'on' + camelize(a);
      if (restPropsRef.current && restPropsRef.current[name]) {
        restPropsRef.current[name](b);
      }
    });
    firstInRoute.setNext(lastInRouteRef.current);
  }


  // writable prop for two-way binding tableAPI
  const [tableAPI, setTableAPI] = useState(null);
  const tableAPIRef = useRef(null);
  tableAPIRef.current = tableAPI;

  // public API
  const api = useMemo(
    () => ({
      getState: dataStore.getState.bind(dataStore),
      getReactiveState: dataStore.getReactive.bind(dataStore),
      getStores: () => ({ data: dataStore }),
      exec: firstInRoute.exec,
      setNext: (ev) => {
        lastInRouteRef.current = lastInRouteRef.current.setNext(ev);
        return lastInRouteRef.current;
      },
      intercept: firstInRoute.intercept.bind(firstInRoute),
      on: firstInRoute.on.bind(firstInRoute),
      detach: firstInRoute.detach.bind(firstInRoute),
      getTask: dataStore.getTask.bind(dataStore),
      serialize: dataStore.serialize.bind(dataStore),
      getTable: (waitRender) =>
        waitRender
          ? new Promise((res) => setTimeout(() => res(tableAPIRef.current), 1))
          : tableAPIRef.current,
    }),
    [dataStore, firstInRoute],
  );


  // expose API via ref
  useImperativeHandle(
    ref,
    () => ({
      ...api,
    }),
    [api],
  );

  const initOnceRef = useRef(0);
  useEffect(() => {
    if (!initOnceRef.current) {
      if (init) init(api);
    } else {
      // Preserve sort state before re-init (dataStore.init resets it)
      const currentSort = dataStore.getState()._sort;

      dataStore.init({
        tasks,
        links,
        start,
        columns,
        end,
        lengthUnit,
        cellWidth: normalizedConfig.cellWidth,
        cellHeight,
        scaleHeight,
        scales: normalizedConfig.scales,
        taskTypes,
        zoom: normalizedConfig.zoom,
        selected,
        activeTask,
        baselines,
        autoScale,
        unscheduledTasks,
        markers,
        durationUnit,
      });
      // v2.5: DataStore.init() forcefully disables pro features (baselines, markers,
      // unscheduledTasks). Re-apply them via setState after init.
      dataStore.setState({ baselines, markers, unscheduledTasks });

      // Restore sort state (use setTimeout to avoid re-triggering this effect)
      if (currentSort?.length > 0) {
        setTimeout(() => {
          currentSort.forEach((sortItem, index) => {
            api.exec('sort-tasks', {
              key: sortItem.key,
              order: sortItem.order,
              add: index > 0,
            });
          });
        }, 0);
      }
    }
    initOnceRef.current++;
  }, [
    tasks,
    links,
    start,
    columns,
    end,
    lengthUnit,
    normalizedConfig,
    cellHeight,
    scaleHeight,
    taskTypes,
    selected,
    activeTask,
    baselines,
    autoScale,
    unscheduledTasks,
    markers,
    durationUnit,
  ]);

  if (initOnceRef.current === 0) {
    dataStore.init({
      tasks,
      links,
      start,
      columns,
      end,
      lengthUnit,
      cellWidth: normalizedConfig.cellWidth,
      cellHeight,
      scaleHeight,
      scales: normalizedConfig.scales,
      taskTypes,
      zoom: normalizedConfig.zoom,
      selected,
      activeTask,
      baselines,
      autoScale,
      unscheduledTasks,
      markers,
      durationUnit,
      // Tells SVAR which day starts a week (0=Sun). Affects unit:'week' header
      // alignment and the static "Week" unit dropdown scales.
      _weekStart: WEEK_START_DAY,
    });
    // v2.5: DataStore.init() forcefully disables pro features. Re-apply via setState.
    dataStore.setState({ baselines, markers, unscheduledTasks });
  }

  // Custom locale with YY/MM/DD date format
  const customLocale = useMemo(() => ({
    ...en,
    gantt: {
      ...en.gantt,
      dateFormat: 'yy/MM/dd',
    },
    formats: {
      ...en.formats,
      dateFormat: 'yy/MM/dd',
    },
  }), []);

  return (
    <Locale words={customLocale} optional={true}>
      <StoreContext.Provider value={api}>
        <Layout
          taskTemplate={taskTemplate}
          readonly={readonly}
          cellBorders={cellBorders}
          highlightTime={highlightTime}
          countWorkdays={countWorkdays}
          onTableAPIChange={setTableAPI}
          colorRules={colorRules}
        />
      </StoreContext.Provider>
    </Locale>
  );
});

export default Gantt;
