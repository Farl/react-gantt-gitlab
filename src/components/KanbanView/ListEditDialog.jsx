/**
 * ListEditDialog Component
 *
 * Dialog for creating or editing a list within a board.
 * Uses BaseDialog for consistent modal behavior.
 * - List type tab: Label or Status
 * - Label mode: multi-select labels (AND logic)
 * - Status mode: single-select from namespace allowed statuses
 * - List name (optional, auto-generated)
 * - Display sort settings
 */

import { useState, useEffect, useMemo } from 'react';
import { BaseDialog } from '../shared/dialogs/BaseDialog';
import { FilterMultiSelect } from '../FilterMultiSelect';
import { SORT_OPTIONS, SORT_ORDER_OPTIONS } from './constants';
import './ListEditDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {import('../../types/issueBoard').IssueBoardList | null} props.list - List to edit (null for new)
 * @param {Array<{title: string, color?: string}>} props.availableLabels - List of available labels with colors
 * @param {Array<{id: string, name: string, color: string, position: number, category: string}>} props.availableStatuses - Allowed statuses from namespace
 * @param {function} props.onClose - Callback to close dialog
 * @param {function} props.onSave - Callback when changes are saved (listData) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function ListEditDialog({
  isOpen,
  list,
  availableLabels = [],
  availableStatuses = [],
  onClose,
  onSave,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [listType, setListType] = useState('label'); // 'label' | 'status'
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [sortBy, setSortBy] = useState('position');
  const [sortOrder, setSortOrder] = useState('asc');

  const isNewList = !list;

  // Sync state with list prop
  useEffect(() => {
    if (list) {
      setName(list.name);
      setListType(list.type || 'label');
      setSelectedLabels([...list.labels]);
      setSelectedStatusId(list.statusId || '');
      setSortBy(list.sortBy);
      setSortOrder(list.sortOrder);
    } else {
      setName('');
      setListType('label');
      setSelectedLabels([]);
      setSelectedStatusId('');
      setSortBy('position');
      setSortOrder('asc');
    }
  }, [list, isOpen]);

  // Convert availableLabels to FilterMultiSelect options format
  const labelOptions = useMemo(() => {
    return availableLabels.map((label) => ({
      value: typeof label === 'string' ? label : label.title || label.name,
      label: typeof label === 'string' ? label : label.title || label.name,
      color: typeof label === 'string' ? undefined : label.color,
    }));
  }, [availableLabels]);

  // Get selected status object for display
  const selectedStatus = useMemo(() => {
    return availableStatuses.find((s) => s.id === selectedStatusId) || null;
  }, [availableStatuses, selectedStatusId]);

  // Generate default name based on list type
  const getDefaultName = () => {
    if (listType === 'status') {
      return selectedStatus?.name || 'Untitled List';
    }
    if (selectedLabels.length === 0) return 'Untitled List';
    if (selectedLabels.length <= 3) return selectedLabels.join(' + ');
    return `${selectedLabels.slice(0, 2).join(' + ')} +${selectedLabels.length - 2}`;
  };

  const handleSave = () => {
    // Use custom name if provided, otherwise generate
    const finalName = name.trim() || getDefaultName();

    const listData = {
      id: list?.id || '', // Will be generated if new
      name: finalName,
      type: listType,
      // Label mode fields
      labels: listType === 'label' ? selectedLabels : [],
      // Status mode fields
      statusId: listType === 'status' ? selectedStatusId : undefined,
      statusName: listType === 'status' ? selectedStatus?.name : undefined,
      statusColor: listType === 'status' ? selectedStatus?.color : undefined,
      sortBy,
      sortOrder,
    };

    onSave(listData);
  };

  const footer = (
    <>
      <button
        className="dialog-btn dialog-btn-secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        className="dialog-btn dialog-btn-primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : isNewList ? 'Add List' : 'Save Changes'}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isNewList ? 'Add New List' : 'Edit List'}
      width={440}
      footer={footer}
      className="list-edit-dialog"
    >
      {/* List type tabs */}
      <div className="list-edit-type-tabs">
        <button
          className={`list-edit-type-tab ${listType === 'label' ? 'active' : ''}`}
          onClick={() => setListType('label')}
          disabled={saving}
        >
          Label
        </button>
        <button
          className={`list-edit-type-tab ${listType === 'status' ? 'active' : ''}`}
          onClick={() => setListType('status')}
          disabled={saving}
        >
          Status
        </button>
      </div>

      {/* Name input (optional - will auto-generate) */}
      <div className="dialog-form-group">
        <label htmlFor="list-name">Name (optional)</label>
        <input
          id="list-name"
          type="text"
          className="dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={getDefaultName()}
          disabled={saving}
        />
        <span className="dialog-hint">
          Leave empty to auto-generate from {listType === 'status' ? 'status' : 'labels'}
        </span>
      </div>

      {/* Label selection (shown when listType === 'label') */}
      {listType === 'label' && (
        <div className="dialog-form-group list-edit-labels-field">
          <label>Labels (issues must have ALL selected)</label>
          <FilterMultiSelect
            title=""
            options={labelOptions}
            selected={selectedLabels}
            onChange={setSelectedLabels}
            placeholder="Search labels..."
            emptyMessage="No labels available"
            showCount={false}
          />
        </div>
      )}

      {/* Status selection (shown when listType === 'status') */}
      {listType === 'status' && (
        <div className="dialog-form-group">
          <label>Status</label>
          <div className="list-edit-status-list">
            {availableStatuses.map((status) => (
              <label
                key={status.id}
                className={`list-edit-status-option ${selectedStatusId === status.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="status-select"
                  value={status.id}
                  checked={selectedStatusId === status.id}
                  onChange={(e) => setSelectedStatusId(e.target.value)}
                  disabled={saving}
                />
                <span
                  className="list-edit-status-dot"
                  style={{ backgroundColor: status.color }}
                />
                <span className="list-edit-status-name">{status.name}</span>
                <span className="list-edit-status-category">{status.category}</span>
              </label>
            ))}
            {availableStatuses.length === 0 && (
              <div className="list-edit-status-empty">
                No statuses available. The current namespace does not have the Status widget enabled.
                Status is available for group-level namespaces with GitLab Premium or Ultimate.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort settings */}
      <div className="dialog-form-group">
        <label>Display Sort (visual only, does not change GitLab order)</label>
        <div className="list-edit-sort">
          <select
            className="dialog-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            disabled={saving}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="dialog-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            disabled={saving}
          >
            {SORT_ORDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </BaseDialog>
  );
}
