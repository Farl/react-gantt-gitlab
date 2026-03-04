import { useContext } from 'react';
import storeContext from '../context';
import { useStore } from '@svar-ui/lib-react';
import './TimeScale.css';

function TimeScale(props) {
  const { highlightTime } = props;

  const api = useContext(storeContext);
  const scales = useStore(api, "_scales");
  const scrollLeft = useStore(api, "scrollLeft");
  const cellWidth = useStore(api, "cellWidth");

  const containerStyle = {
    width: `${(scales && scales.width) != null ? scales.width : 0}px`,
    left: `${-(scrollLeft != null ? scrollLeft : 0)}px`,
  };

  return (
    <div className="wx-ZkvhDKir wx-scale" style={containerStyle}>
      {(scales?.rows || []).map((row, rowIdx) => (
        <div
          className="wx-ZkvhDKir wx-row"
          style={{ height: `${row.height}px` }}
          key={rowIdx}
        >
          {(row.cells || []).map((cell, cellIdx) => {
            // Only apply day-level highlighting when the cell represents a single day.
            // With adaptive scales (e.g. unit:'day' step:7), a cell may span multiple
            // days — highlighting based on just the start date would be misleading.
            const isMultiDayCell = cellWidth && cell.width > cellWidth * 1.5;
            const extraClass = highlightTime && !isMultiDayCell
              ? highlightTime(cell.date, cell.unit)
              : '';
            const className = ['wx-cell', cell.css, extraClass]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                className={'wx-ZkvhDKir ' + className}
                style={{ width: `${cell.width}px` }}
                key={cellIdx}
              >
                {cell.value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default TimeScale;
