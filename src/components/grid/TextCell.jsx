import { getMatchingRules } from '../../types/colorRule';
import './TextCell.css';

function TextCell({ row, column }) {
  function getStyle(row, col) {
    return {
      justifyContent: col.align,
      paddingLeft: `${(row.$level - 1) * 20}px`,
    };
  }

  const CellComponent = column && column._cell;
  const colorRules = column?.colorRules;
  const matchedRules = colorRules ? getMatchingRules(row.text, colorRules) : [];

  return (
    <div className="wx-pqc08MHU wx-content" style={getStyle(row, column)}>
      {row.data || row.lazy ? (
        <i
          className={`wx-pqc08MHU wx-toggle-icon wxi-menu-${row.open ? 'down' : 'right'}`}
          data-action="open-task"
        />
      ) : (
        <i className="wx-pqc08MHU wx-toggle-placeholder" />
      )}
      <div className="wx-pqc08MHU wx-text">
        {CellComponent ? <CellComponent row={row} column={column} /> : row.text}
      </div>
      {matchedRules.length > 0 && (
        <div className="wx-color-indicators">
          {matchedRules.map((rule) => (
            <span
              key={rule.id}
              className="wx-color-indicator"
              style={{ backgroundColor: rule.color, opacity: rule.opacity ?? 1 }}
              title={rule.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TextCell;
