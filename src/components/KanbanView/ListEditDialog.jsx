/**
 * ListEditDialog Component
 *
 * Dialog for creating or editing a list within a board.
 * - List name
 * - Label selection (multi-select)
 * - Sort settings
 */

import { useState, useEffect } from 'react';
import './ListEditDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {import('../../types/issueBoard').IssueBoardList | null} props.list - List to edit (null for new)
 * @param {string[]} props.availableLabels - List of available labels in the project
 * @param {function} props.onClose - Callback to close dialog
 * @param {function} props.onSave - Callback when changes are saved (listData) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function ListEditDialog({
  isOpen,
  list,
  availableLabels = [],
  onClose,
  onSave,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [sortBy, setSortBy] = useState('position');
  const [sortOrder, setSortOrder] = useState('asc');
  const [labelSearch, setLabelSearch] = useState('');
  const [error, setError] = useState('');

  const isNewList = !list;

  // Sync state with list prop
  useEffect(() => {
    if (list) {
      setName(list.name);
      setSelectedLabels([...list.labels]);
      setSortBy(list.sortBy);
      setSortOrder(list.sortOrder);
    } else {
      setName('');
      setSelectedLabels([]);
      setSortBy('position');
      setSortOrder('asc');
    }
    setLabelSearch('');
    setError('');
  }, [list, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a list name');
      return;
    }

    const listData = {
      id: list?.id || '', // Will be generated if new
      name: trimmedName,
      labels: selectedLabels,
      sortBy,
      sortOrder,
    };

    onSave(listData);
  };

  const handleToggleLabel = (label) => {
    setSelectedLabels((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const handleRemoveLabel = (label) => {
    setSelectedLabels((prev) => prev.filter((l) => l !== label));
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  // Filter labels by search
  const filteredLabels = availableLabels.filter((label) =>
    label.toLowerCase().includes(labelSearch.toLowerCase())
  );

  return (
    <div className="list-edit-overlay" onClick={handleClose}>
      <div className="list-edit-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="list-edit-header">
          <h3>{isNewList ? 'Add New List' : 'Edit List'}</h3>
          <button
            className="list-edit-close modal-close-btn"
            onClick={handleClose}
            disabled={saving}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Content */}
        <div className="list-edit-content">
          {/* Name input */}
          <div className="list-edit-field">
            <label htmlFor="list-name">Name</label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter list name..."
              className={error ? 'error' : ''}
              disabled={saving}
              autoFocus
            />
            {error && <span className="list-edit-error">{error}</span>}
          </div>

          {/* Labels selection */}
          <div className="list-edit-field">
            <label>Labels (issues must have ALL selected)</label>

            {/* Selected labels */}
            {selectedLabels.length > 0 && (
              <div className="list-edit-selected-labels">
                {selectedLabels.map((label) => (
                  <span key={label} className="selected-label">
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(label)}
                      disabled={saving}
                    >
                      <i className="fas fa-times" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Label search */}
            <input
              type="text"
              value={labelSearch}
              onChange={(e) => setLabelSearch(e.target.value)}
              placeholder="Search labels..."
              className="list-edit-label-search"
              disabled={saving}
            />

            {/* Available labels */}
            <div className="list-edit-labels-list">
              {filteredLabels.length === 0 ? (
                <div className="list-edit-no-labels">
                  {labelSearch
                    ? 'No labels match your search'
                    : 'No labels available'}
                </div>
              ) : (
                filteredLabels.map((label) => (
                  <label key={label} className="list-edit-label-option">
                    <input
                      type="checkbox"
                      checked={selectedLabels.includes(label)}
                      onChange={() => handleToggleLabel(label)}
                      disabled={saving}
                    />
                    <span>{label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Sort settings */}
          <div className="list-edit-field">
            <label>Default Sort</label>
            <div className="list-edit-sort">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                disabled={saving}
              >
                <option value="position">Position</option>
                <option value="due_date">Due Date</option>
                <option value="created_at">Created Date</option>
                <option value="label_priority">Label Priority</option>
                <option value="id">ID</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={saving}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="list-edit-footer">
          <button
            className="list-edit-btn list-edit-btn-cancel"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="list-edit-btn list-edit-btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                Saving...
              </>
            ) : isNewList ? (
              'Add List'
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
