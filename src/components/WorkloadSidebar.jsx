/**
 * WorkloadSidebar Component
 * Displays checkboxes for assignees and labels to filter workload view
 */

import { useCallback } from 'react';

export function WorkloadSidebar({
  assignees = [],
  labels = [],
  selectedAssignees = [],
  selectedLabels = [],
  onAssigneesChange,
  onLabelsChange,
}) {
  const toggleAssignee = useCallback(
    (assignee) => {
      if (selectedAssignees.includes(assignee)) {
        onAssigneesChange(selectedAssignees.filter((a) => a !== assignee));
      } else {
        onAssigneesChange([...selectedAssignees, assignee]);
      }
    },
    [selectedAssignees, onAssigneesChange]
  );

  const toggleLabel = useCallback(
    (label) => {
      if (selectedLabels.includes(label)) {
        onLabelsChange(selectedLabels.filter((l) => l !== label));
      } else {
        onLabelsChange([...selectedLabels, label]);
      }
    },
    [selectedLabels, onLabelsChange]
  );

  const selectAllAssignees = useCallback(() => {
    onAssigneesChange([...assignees]);
  }, [assignees, onAssigneesChange]);

  const clearAllAssignees = useCallback(() => {
    onAssigneesChange([]);
  }, [onAssigneesChange]);

  const selectAllLabels = useCallback(() => {
    onLabelsChange([...labels]);
  }, [labels, onLabelsChange]);

  const clearAllLabels = useCallback(() => {
    onLabelsChange([]);
  }, [onLabelsChange]);

  return (
    <div className="workload-sidebar">
      {/* Assignees Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-user"></i>
            Assignees
          </h3>
          <div className="section-actions">
            <button
              onClick={selectAllAssignees}
              className="action-btn"
              title="Select All"
            >
              All
            </button>
            <button
              onClick={clearAllAssignees}
              className="action-btn"
              title="Clear All"
            >
              None
            </button>
          </div>
        </div>
        <div className="checkbox-list">
          {assignees.length === 0 ? (
            <div className="empty-message">No tasks have assignees</div>
          ) : (
            assignees.map((assignee) => (
              <label key={assignee} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedAssignees.includes(assignee)}
                  onChange={() => toggleAssignee(assignee)}
                />
                <span className="checkbox-label">{assignee}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Labels Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-tag"></i>
            Labels
          </h3>
          <div className="section-actions">
            <button
              onClick={selectAllLabels}
              className="action-btn"
              title="Select All"
            >
              All
            </button>
            <button
              onClick={clearAllLabels}
              className="action-btn"
              title="Clear All"
            >
              None
            </button>
          </div>
        </div>
        <div className="checkbox-list">
          {labels.length === 0 ? (
            <div className="empty-message">No tasks have labels assigned</div>
          ) : (
            labels.map((label) => (
              <label key={label} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedLabels.includes(label)}
                  onChange={() => toggleLabel(label)}
                />
                <span className="checkbox-label label-tag">{label}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Selection Summary */}
      <div className="sidebar-section selection-summary">
        <div className="summary-item">
          <span className="summary-label">Selected Assignees:</span>
          <span className="summary-value">{selectedAssignees.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Selected Labels:</span>
          <span className="summary-value">{selectedLabels.length}</span>
        </div>
      </div>
    </div>
  );
}

export default WorkloadSidebar;
