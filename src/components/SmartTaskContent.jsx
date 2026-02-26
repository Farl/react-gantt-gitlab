import './SmartTaskContent.css';

/**
 * Smart Task Content Component
 * Always shows text outside the bar (on the right) for better readability.
 * Hides title for tasks without a due date (tiny 1-day bar from v2.5 normalization)
 * since the title is already visible in the grid column.
 */
function SmartTaskContent({ data }) {
  // v2.5: tasks without dueDate get a tiny bar ($w ≈ 0). Hide the floating title
  // to avoid visual clutter — grid column already shows the task name.
  if (!data.$w) {
    return null;
  }

  return (
    <div className="wx-smart-task wx-text-out">
      {data.text || ''}
    </div>
  );
}

export default SmartTaskContent;
