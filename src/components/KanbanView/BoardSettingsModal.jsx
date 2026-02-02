/**
 * BoardSettingsModal Component
 *
 * Modal for editing board settings:
 * - Board name
 * - List management (add, edit, delete, reorder)
 * - Special list toggles (Others, Closed)
 * - Delete board
 */

import { useState, useEffect } from 'react';
import './BoardSettingsModal.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {import('../../types/issueBoard').IssueBoard | null} props.board - Board to edit
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onSave - Callback when changes are saved (updatedBoard) => void
 * @param {function} props.onDelete - Callback when board is deleted
 * @param {function} props.onEditList - Callback when edit list is clicked (list) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function BoardSettingsModal({
  isOpen,
  board,
  onClose,
  onSave,
  onDelete,
  onEditList,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [showOthers, setShowOthers] = useState(true);
  const [showClosed, setShowClosed] = useState(true);
  const [lists, setLists] = useState([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state with board prop
  useEffect(() => {
    if (board) {
      setName(board.name);
      setShowOthers(board.showOthers);
      setShowClosed(board.showClosed);
      setLists([...board.lists]);
      setError('');
      setConfirmDelete(false);
    }
  }, [board]);

  if (!isOpen || !board) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a board name');
      return;
    }

    const updatedBoard = {
      ...board,
      name: trimmedName,
      showOthers,
      showClosed,
      lists,
    };

    onSave(updatedBoard);
  };

  const handleDeleteList = (listId) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  };

  const handleMoveList = (listId, direction) => {
    const index = lists.findIndex((l) => l.id === listId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lists.length) return;

    const newLists = [...lists];
    [newLists[index], newLists[newIndex]] = [newLists[newIndex], newLists[index]];
    setLists(newLists);
  };

  const handleDeleteBoard = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  return (
    <div className="board-settings-overlay" onClick={handleClose}>
      <div
        className="board-settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="board-settings-header">
          <h3>Board Settings</h3>
          <button
            className="board-settings-close modal-close-btn"
            onClick={handleClose}
            disabled={saving}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Content */}
        <div className="board-settings-content">
          {/* Name input */}
          <div className="board-settings-field">
            <label htmlFor="board-settings-name">Name</label>
            <input
              id="board-settings-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className={error ? 'error' : ''}
              disabled={saving}
            />
            {error && <span className="board-settings-error">{error}</span>}
          </div>

          {/* Lists section */}
          <div className="board-settings-section">
            <div className="board-settings-section-header">
              <label>Lists</label>
              <button
                className="board-settings-add-btn"
                onClick={() => onEditList(null)}
                disabled={saving}
              >
                <i className="fas fa-plus" />
                Add List
              </button>
            </div>

            {lists.length === 0 ? (
              <div className="board-settings-empty">
                No lists defined. Click "Add List" to create one.
              </div>
            ) : (
              <div className="board-settings-lists">
                {lists.map((list, index) => (
                  <div key={list.id} className="board-settings-list-item">
                    <div className="list-item-drag">
                      <button
                        className="list-move-btn"
                        onClick={() => handleMoveList(list.id, 'up')}
                        disabled={index === 0 || saving}
                        title="Move up"
                      >
                        <i className="fas fa-chevron-up" />
                      </button>
                      <button
                        className="list-move-btn"
                        onClick={() => handleMoveList(list.id, 'down')}
                        disabled={index === lists.length - 1 || saving}
                        title="Move down"
                      >
                        <i className="fas fa-chevron-down" />
                      </button>
                    </div>
                    <div className="list-item-info">
                      <span className="list-item-name">{list.name}</span>
                      <span className="list-item-labels">
                        {list.labels.length > 0
                          ? `Labels: ${list.labels.join(', ')}`
                          : 'No labels'}
                      </span>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="list-action-btn"
                        onClick={() => onEditList(list)}
                        disabled={saving}
                        title="Edit"
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        className="list-action-btn list-action-btn-delete"
                        onClick={() => handleDeleteList(list.id)}
                        disabled={saving}
                        title="Delete"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Special lists */}
          <div className="board-settings-section">
            <label>Special Lists</label>
            <div className="board-settings-checkboxes">
              <label className="board-settings-checkbox">
                <input
                  type="checkbox"
                  checked={showOthers}
                  onChange={(e) => setShowOthers(e.target.checked)}
                  disabled={saving}
                />
                <span>Show "Others" list</span>
                <span className="checkbox-description">
                  Issues that don't match any list
                </span>
              </label>
              <label className="board-settings-checkbox">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                  disabled={saving}
                />
                <span>Show "Closed" list</span>
                <span className="checkbox-description">
                  Issues that are closed
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="board-settings-footer">
          <button
            className={`board-settings-btn board-settings-btn-delete ${
              confirmDelete ? 'confirm' : ''
            }`}
            onClick={handleDeleteBoard}
            disabled={saving}
          >
            {confirmDelete ? (
              <>
                <i className="fas fa-exclamation-triangle" />
                Click again to confirm
              </>
            ) : (
              <>
                <i className="fas fa-trash" />
                Delete Board
              </>
            )}
          </button>
          <div className="board-settings-footer-right">
            <button
              className="board-settings-btn board-settings-btn-cancel"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="board-settings-btn board-settings-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
