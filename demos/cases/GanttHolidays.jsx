import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';

function GanttHolidays({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const scales = useMemo(
    () => [
      { unit: 'year', step: 1, format: '%Y' },
      { unit: 'month', step: 2, format: '%F %Y' },
      { unit: 'week', step: 1, format: '%w' },
      { unit: 'day', step: 1, format: '%j, %l' /* , css: dayStyle */ }
    ],
    [],
  );

  function isDayOff(date) {
    const d = date.getDay();
    return d == 0 || d == 6;
  }

  function isHourOff(date) {
    const h = date.getHours();
    return h < 8 || h == 12 || h > 17;
  }

  function highlightTime(d, u) {
    if (u == 'day' && isDayOff(d)) return 'wx-weekend';
    if (u == 'hour' && (isDayOff(d) || isHourOff(d))) return 'wx-weekend';
    return '';
  }

  return (
    <Gantt
      {...skinSettings}
      tasks={data.tasks}
      links={data.links}
      scales={scales}
      highlightTime={highlightTime}
      zoom
    />
  );
}

export default GanttHolidays;
