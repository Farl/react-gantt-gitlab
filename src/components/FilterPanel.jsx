/**
 * Filter Panel Component
 * Provides UI for filtering tasks by milestones, epics, labels, etc.
 * Supports both client-side and server-side filtering with Tab switch.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GitLabFilters } from '../utils/GitLabFilters';
import { FilterPresetSelector } from './FilterPresetSelector';
import { FilterMultiSelect } from './FilterMultiSelect';

// Default empty server filters
const DEFAULT_SERVER_FILTERS = {
  labelNames: [],
  milestoneTitles: [],
  assigneeUsernames: [],
  dateRange: {
    createdAfter: '',
    createdBefore: '',
  },
};

// Default empty client filters
const DEFAULT_CLIENT_FILTERS = {
  milestoneIds: [],
  epicIds: [],
  labels: [],
  assignees: [],
  states: [],
  search: '',
};

/**
 * Parse server filters from preset, ensuring all fields have default values
 */
const parseServerFiltersFromPreset = (presetServerFilters) => ({
  labelNames: presetServerFilters?.labelNames || [],
  milestoneTitles: presetServerFilters?.milestoneTitles || [],
  assigneeUsernames: presetServerFilters?.assigneeUsernames || [],
  dateRange: presetServerFilters?.dateRange || { createdAfter: '', createdBefore: '' },
});

/**
 * Parse client filters from preset, ensuring all fields have default values
 */
const parseClientFiltersFromPreset = (presetFilters) => ({
  milestoneIds: presetFilters?.milestoneIds || [],
  epicIds: presetFilters?.epicIds || [],
  labels: presetFilters?.labels || [],
  assignees: presetFilters?.assignees || [],
  states: presetFilters?.states || [],
  search: presetFilters?.search || '',
});

export function FilterPanel({
  milestones,
  epics,
  tasks,
  onFilterChange,
  initialFilters = {},
  // Preset-related props
  presets = [],
  presetsLoading = false,
  presetsSaving = false,
  canEditPresets = false,
  onCreatePreset,
  onRenamePreset,
  onDeletePreset,
  onPresetSelect,
  initialPresetId,
  // Server filter props
  filterOptions = null, // { members, labels, milestones } from getFilterOptions()
  filterOptionsLoading = false,
  serverFilters: initialServerFilters = null, // Initial server filters (from parent state)
  onServerFilterApply, // Callback to apply server filters and trigger sync
}) {
  // Tab state: 'client' or 'server'
  const [activeTab, setActiveTab] = useState('client');

  // Client-side filters
  const [filters, setFilters] = useState(() =>
    parseClientFiltersFromPreset(initialFilters)
  );

  // Server-side filters (local state for editing)
  const [serverFilters, setServerFilters] = useState(
    initialServerFilters || DEFAULT_SERVER_FILTERS
  );

  // Track if server filters have unsync'd changes
  const [hasUnsyncedServerChanges, setHasUnsyncedServerChanges] = useState(false);

  // Track currently selected preset ID
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId || null);

  const [isExpanded, setIsExpanded] = useState(false);

  // Track if initial preset has been applied
  const initialPresetAppliedRef = useRef(false);

  // Build label options - merge from tasks (client) and filterOptions (server)
  const labelOptions = useMemo(() => {
    // First, get labels from filterOptions (server source - has colors)
    const serverLabels = filterOptions?.labels || [];
    const serverLabelMap = new Map(serverLabels.map(l => [l.title, l]));

    // Then get labels from tasks (client source)
    const taskLabels = tasks ? GitLabFilters.getUniqueLabels(tasks) : [];

    // Merge: prefer server data for color info
    const merged = new Map();
    taskLabels.forEach(label => {
      const serverLabel = serverLabelMap.get(label);
      merged.set(label, {
        value: label,
        label: label,
        color: serverLabel?.color || null,
      });
    });
    // Add server-only labels
    serverLabels.forEach(sl => {
      if (!merged.has(sl.title)) {
        merged.set(sl.title, {
          value: sl.title,
          label: sl.title,
          color: sl.color || null,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks, filterOptions?.labels]);

  // Build assignee options - merge from tasks (client) and filterOptions (server)
  const assigneeOptions = useMemo(() => {
    // First, get members from filterOptions (server source - has username and name)
    const serverMembers = filterOptions?.members || [];
    const serverMemberMap = new Map(serverMembers.map(m => [m.username, m]));

    // Then get assignees from tasks (client source) - these are display names
    const taskAssignees = tasks ? GitLabFilters.getUniqueAssignees(tasks) : [];

    // Merge: for client we use display name as value, for server we need username
    // Since client filters use assignee display name, we'll create options with name as value
    const merged = new Map();

    // Add task assignees (by display name)
    taskAssignees.forEach(assignee => {
      // Try to find matching server member
      const serverMember = serverMembers.find(m => m.name === assignee || m.username === assignee);
      merged.set(assignee, {
        value: assignee,
        label: assignee,
        subtitle: serverMember ? `@${serverMember.username}` : null,
        username: serverMember?.username || null,
      });
    });

    // Add server members not in tasks
    serverMembers.forEach(member => {
      if (!merged.has(member.name) && !merged.has(member.username)) {
        merged.set(member.name, {
          value: member.name,
          label: member.name,
          subtitle: `@${member.username}`,
          username: member.username,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks, filterOptions?.members]);

  // Build milestone options - merge from milestones prop and filterOptions
  // Use iid as value for client-side filtering (matches _gitlab.milestoneIid)
  const milestoneOptions = useMemo(() => {
    // Milestones from prop (has iid)
    const propMilestones = milestones || [];
    // Milestones from filterOptions (server - has iid and title)
    const serverMilestones = filterOptions?.milestones || [];

    // Create map by title for deduplication
    const merged = new Map();

    propMilestones.forEach(m => {
      merged.set(m.title, {
        value: m.iid, // Use iid for filtering (matches _gitlab.milestoneIid)
        title: m.title,
        label: m.title,
      });
    });

    serverMilestones.forEach(m => {
      if (!merged.has(m.title)) {
        merged.set(m.title, {
          value: m.iid,
          title: m.title,
          label: m.title,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [milestones, filterOptions?.milestones]);

  // Build epic options from epics prop
  const epicOptions = useMemo(() => {
    return (epics || []).map(e => ({
      value: e.id,
      label: e.title,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [epics]);

  // Apply initial preset when presets are loaded
  // NOTE: This only sets the UI state. GitLabGantt handles the initial sync with filters.
  // We don't call onServerFilterApply here to avoid double sync.
  useEffect(() => {
    if (
      initialPresetId &&
      presets &&
      presets.length > 0 &&
      !presetsLoading &&
      !initialPresetAppliedRef.current
    ) {
      const preset = presets.find(p => p.id === initialPresetId);
      if (preset) {
        const presetFilters = preset.filters;
        const isServerPreset = presetFilters.filterType === 'server' && presetFilters.serverFilters;

        if (isServerPreset) {
          setActiveTab('server');
          const parsedServerFilters = parseServerFiltersFromPreset(presetFilters.serverFilters);
          setServerFilters(parsedServerFilters);
          // Don't call onServerFilterApply here - GitLabGantt handles initial sync
        } else {
          setActiveTab('client');
          setFilters(parseClientFiltersFromPreset(presetFilters));
        }
        // Set the selected preset ID to show it's active in the UI
        setSelectedPresetId(initialPresetId);
        initialPresetAppliedRef.current = true;
      }
    }
  }, [initialPresetId, presets, presetsLoading]);

  useEffect(() => {
    // Notify parent of filter changes
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);

  const handleSearchChange = (search) => {
    setFilters((prev) => ({ ...prev, search }));
  };

  // Apply preset filters
  const handleApplyPreset = useCallback((preset) => {
    const presetFilters = preset.filters;
    const isServerPreset = presetFilters.filterType === 'server' && presetFilters.serverFilters;

    if (isServerPreset) {
      setActiveTab('server');
      const parsedServerFilters = parseServerFiltersFromPreset(presetFilters.serverFilters);
      setServerFilters(parsedServerFilters);
      setHasUnsyncedServerChanges(false);
      onServerFilterApply?.(parsedServerFilters);
    } else {
      setActiveTab('client');
      setFilters(parseClientFiltersFromPreset(presetFilters));
    }
    setSelectedPresetId(preset.id); // Update local state
    onPresetSelect?.(preset.id); // Notify parent
  }, [onPresetSelect, onServerFilterApply]);

  // Create preset with current filters
  const handleCreatePreset = useCallback(async (name) => {
    if (onCreatePreset) {
      let newPresetId;
      if (activeTab === 'server') {
        // Save as server filter preset
        newPresetId = await onCreatePreset(name, {
          filterType: 'server',
          serverFilters: serverFilters,
        });
      } else {
        // Save as client filter preset
        newPresetId = await onCreatePreset(name, {
          filterType: 'client',
          ...filters,
        });
      }
      // Select the newly created preset
      if (newPresetId) {
        setSelectedPresetId(newPresetId);
        onPresetSelect?.(newPresetId);
      }
    }
  }, [onCreatePreset, filters, serverFilters, activeTab, onPresetSelect]);

  // Client filter count
  const clientFilterCount =
    filters.milestoneIds.length +
    filters.epicIds.length +
    filters.labels.length +
    filters.assignees.length +
    (filters.search ? 1 : 0);

  // Server filter count
  const serverFilterCount =
    (serverFilters.labelNames?.length || 0) +
    (serverFilters.milestoneTitles?.length || 0) +
    (serverFilters.assigneeUsernames?.length || 0) +
    (serverFilters.dateRange?.createdAfter ? 1 : 0) +
    (serverFilters.dateRange?.createdBefore ? 1 : 0);

  // Total active filter count based on current tab
  const activeFilterCount = activeTab === 'server' ? serverFilterCount : clientFilterCount;

  // Server filter handlers
  const handleServerFilterChange = (field, value) => {
    setServerFilters(prev => ({ ...prev, [field]: value }));
    setHasUnsyncedServerChanges(true);
  };

  const handleServerDateRangeChange = (field, value) => {
    setServerFilters(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value },
    }));
    setHasUnsyncedServerChanges(true);
  };

  const handleApplyServerFilter = () => {
    if (onServerFilterApply) {
      onServerFilterApply(serverFilters);
      setHasUnsyncedServerChanges(false);
    }
  };

  const handleClearServerFilters = () => {
    setServerFilters(DEFAULT_SERVER_FILTERS);
    setHasUnsyncedServerChanges(true);
  };

  return (
    <div className="gitlab-filter-panel">
      <div className="filter-header">
        <div className="filter-header-left">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="filter-toggle"
          >
            <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
            Filters
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>

          <FilterPresetSelector
            presets={presets}
            currentFilters={filters}
            loading={presetsLoading}
            saving={presetsSaving}
            canEdit={canEditPresets}
            onSelectPreset={handleApplyPreset}
            onCreatePreset={handleCreatePreset}
            onRenamePreset={onRenamePreset}
            onDeletePreset={onDeletePreset}
            selectedPresetId={selectedPresetId}
            serverFilterCount={serverFilterCount}
          />

          {/* Clear and Apply buttons - grouped on left side */}
          {clientFilterCount > 0 && (
            <button
              onClick={() => {
                setFilters(DEFAULT_CLIENT_FILTERS);
                setSelectedPresetId(null); // Clear local state
                onPresetSelect?.(null); // Notify parent
              }}
              className="btn-clear"
            >
              Clear Client ({clientFilterCount})
            </button>
          )}
          {serverFilterCount > 0 && (
            <button
              onClick={() => {
                handleClearServerFilters();
                setSelectedPresetId(null); // Clear local state
                onPresetSelect?.(null); // Notify parent
              }}
              className="btn-clear btn-clear-server"
            >
              Clear Server ({serverFilterCount})
            </button>
          )}
          {hasUnsyncedServerChanges && (
            <button
              className="btn-apply-server-header"
              onClick={handleApplyServerFilter}
            >
              Apply Server
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Tab Header Row */}
          <div className="filter-tabs-row">
            {/* Tab Switch */}
            <div className="filter-tabs">
              <button
                className={`filter-tab ${activeTab === 'client' ? 'active' : ''}`}
                onClick={() => setActiveTab('client')}
              >
                Client
                {clientFilterCount > 0 && (
                  <span className="tab-badge">{clientFilterCount}</span>
                )}
              </button>
              <button
                className={`filter-tab ${activeTab === 'server' ? 'active' : ''}`}
                onClick={() => setActiveTab('server')}
              >
                Server
                {serverFilterCount > 0 && (
                  <span className="tab-badge">{serverFilterCount}</span>
                )}
                {hasUnsyncedServerChanges && <span className="unsync-indicator">*</span>}
              </button>
            </div>

            {/* Tab description */}
            <div className="filter-tab-info">
              {activeTab === 'client'
                ? 'Filters applied locally to fetched data. Changes take effect immediately.'
                : 'Filters applied when fetching from GitLab. Changes require re-sync.'}
            </div>
          </div>

          {/* Tab Content Panel */}
          <div className="filter-tab-panel">
            {/* Client Tab Content */}
            {activeTab === 'client' && (
              <>
                {/* Search */}
                <div className="filter-search-section">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search tasks by title, description, labels..."
                    className="filter-search-input"
                  />
                </div>

              {/* Main Filter Grid */}
              <div className="filter-grid">
                {/* Milestones - Client uses OR logic */}
                <FilterMultiSelect
                  title="Milestones (OR)"
                  options={[
                    // Add "None" option for tasks without milestone
                    { value: 0, label: 'None (No Milestone)' },
                    ...milestoneOptions,
                  ]}
                  selected={filters.milestoneIds}
                  onChange={(values) => setFilters(prev => ({ ...prev, milestoneIds: values }))}
                  placeholder="Search milestones..."
                  emptyMessage="No milestones"
                />

                {/* Epics - Client uses OR logic */}
                <FilterMultiSelect
                  title="Epics (OR)"
                  options={[
                    // Add "None" option for tasks without epic
                    { value: 0, label: 'None (No Epic)' },
                    ...epicOptions,
                  ]}
                  selected={filters.epicIds}
                  onChange={(values) => setFilters(prev => ({ ...prev, epicIds: values }))}
                  placeholder="Search epics..."
                  emptyMessage="No epics"
                />

                {/* Labels - Client uses OR logic */}
                <FilterMultiSelect
                  title="Labels (OR)"
                  options={[
                    // Add "None" option for tasks without labels
                    { value: 'NONE', label: 'None (No Labels)' },
                    ...labelOptions,
                  ]}
                  selected={filters.labels}
                  onChange={(values) => setFilters(prev => ({ ...prev, labels: values }))}
                  placeholder="Search labels..."
                  emptyMessage="No labels"
                />

                {/* Assignees - Client uses OR logic */}
                <FilterMultiSelect
                  title="Assignees (OR)"
                  options={[
                    // Add "None" option for unassigned tasks
                    { value: 'NONE', label: 'None (Unassigned)' },
                    ...assigneeOptions,
                  ]}
                  selected={filters.assignees}
                  onChange={(values) => setFilters(prev => ({ ...prev, assignees: values }))}
                  placeholder="Search assignees..."
                  emptyMessage="No assignees"
                />
              </div>
            </>
          )}

          {/* Server Tab Content */}
          {activeTab === 'server' && (
            <>
              {filterOptionsLoading ? (
                <div className="filter-loading">Loading filter options...</div>
              ) : (
                <div className="filter-grid">
                  {/* Labels - GitLab API uses AND logic for multiple labels */}
                  {/* Note: GitLab GraphQL API does not support filtering for "no labels" */}
                  <FilterMultiSelect
                    title="Labels (AND)"
                    options={(filterOptions?.labels || []).map(l => ({
                      value: l.title,
                      label: l.title,
                      color: l.color || null,
                    }))}
                    selected={serverFilters.labelNames || []}
                    onChange={(values) => handleServerFilterChange('labelNames', values)}
                    placeholder="Search labels..."
                    emptyMessage="No labels available"
                  />

                  {/* Milestones - GitLab API uses OR logic for multiple milestones */}
                  <FilterMultiSelect
                    title="Milestones (OR)"
                    options={[
                      // Add "None" option for items without milestone
                      { value: 'NONE', label: 'None (No Milestone)' },
                      // Then all milestones
                      ...(filterOptions?.milestones || []).map(m => ({
                        value: m.title,
                        label: m.title,
                      })),
                    ]}
                    selected={serverFilters.milestoneTitles || []}
                    onChange={(values) => handleServerFilterChange('milestoneTitles', values)}
                    placeholder="Search milestones..."
                    emptyMessage="No milestones available"
                  />

                  {/* Assignees - GitLab API uses AND logic for multiple assignees */}
                  <FilterMultiSelect
                    title="Assignees (AND)"
                    options={[
                      // Add "None" option for unassigned issues
                      { value: 'NONE', label: 'None (Unassigned)', subtitle: 'No assignee' },
                      // Then all members
                      ...(filterOptions?.members || []).map(m => ({
                        value: m.username,
                        label: m.name,
                        subtitle: `@${m.username}`,
                      })),
                    ]}
                    selected={serverFilters.assigneeUsernames || []}
                    onChange={(values) => handleServerFilterChange('assigneeUsernames', values)}
                    placeholder="Search assignees..."
                    emptyMessage="No members available"
                  />

                  {/* Date Range */}
                  <div className="date-range-section">
                    <div className="date-range-header">Created Date Range</div>
                    <div className="date-range-inputs">
                      <div className="date-input-group">
                        <label>From:</label>
                        <input
                          type="date"
                          value={serverFilters.dateRange?.createdAfter || ''}
                          onChange={(e) => handleServerDateRangeChange('createdAfter', e.target.value)}
                          className="filter-date-input"
                        />
                      </div>
                      <div className="date-input-group">
                        <label>To:</label>
                        <input
                          type="date"
                          value={serverFilters.dateRange?.createdBefore || ''}
                          onChange={(e) => handleServerDateRangeChange('createdBefore', e.target.value)}
                          className="filter-date-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <div className="server-filter-actions">
                <button
                  className="btn-apply-server"
                  onClick={handleApplyServerFilter}
                  disabled={!hasUnsyncedServerChanges}
                >
                  {hasUnsyncedServerChanges ? 'Apply Changes' : 'No Changes'}
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      <style>{`
        .gitlab-filter-panel {
          background: var(--wx-gitlab-filter-background);
          border-bottom: 1px solid var(--wx-gitlab-filter-border);
        }

        .filter-header {
          display: flex;
          align-items: center;
          padding: 6px 12px;
        }

        .filter-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .filter-toggle:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .toggle-icon {
          font-size: 10px;
          color: var(--wx-gitlab-control-text);
        }

        .filter-badge {
          background: #1f75cb;
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        .btn-clear {
          padding: 2px 8px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-clear:hover {
          background: #c82333;
        }

        .btn-apply-server-header {
          padding: 2px 8px;
          background: #1f75cb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-apply-server-header:hover {
          background: #1a65b3;
        }

        .filter-content {
          padding: 0 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .filter-search-section {
          margin-bottom: 4px;
        }

        .filter-search-input {
          width: 100%;
          max-width: 400px;
          padding: 6px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 13px;
        }

        .filter-search-input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          align-items: start;
        }

        @media (min-width: 1400px) {
          .filter-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        @media (min-width: 1100px) and (max-width: 1399px) {
          .filter-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        /* Tab row - contains tabs and info */
        .filter-tabs-row {
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 1px solid var(--wx-gitlab-filter-input-border);
          margin-bottom: 12px;
        }

        /* Tab styles */
        .filter-tabs {
          display: flex;
          gap: 0;
          flex-shrink: 0;
        }

        .filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 13px;
          font-weight: 500;
          color: var(--wx-gitlab-control-text);
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -1px;
        }

        .filter-tab:hover {
          color: var(--wx-gitlab-filter-text);
          background: var(--wx-gitlab-filter-hover-background);
        }

        .filter-tab.active {
          color: #1f75cb;
          border-bottom-color: #1f75cb;
          background: transparent;
        }

        .filter-tab-info {
          font-size: 12px;
          color: var(--wx-gitlab-control-text);
          flex: 1;
        }

        .filter-tab-panel {
          /* Content area styling */
        }

        .tab-badge {
          background: var(--wx-gitlab-filter-input-border);
          color: var(--wx-gitlab-filter-text);
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        .filter-tab.active .tab-badge {
          background: #1f75cb;
          color: white;
        }

        .unsync-indicator {
          color: #ffc107;
          font-weight: bold;
          margin-left: 2px;
        }

        .filter-tab.active .unsync-indicator {
          color: #ffc107;
        }

        .filter-loading {
          padding: 20px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
        }

        .date-range-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .date-range-header {
          font-size: 12px;
          font-weight: 600;
          color: var(--wx-gitlab-filter-text);
          margin-bottom: 2px;
        }

        .date-range-inputs {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .date-input-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .date-input-group label {
          font-size: 11px;
          color: var(--wx-gitlab-filter-text);
          min-width: 35px;
        }

        .filter-date-input {
          flex: 1;
          padding: 4px 6px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 3px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 12px;
        }

        .server-filter-actions {
          display: flex;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--wx-gitlab-filter-border);
        }

        .btn-apply-server {
          padding: 6px 16px;
          background: #1f75cb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-apply-server:hover:not(:disabled) {
          background: #1a65b3;
        }

        .btn-apply-server:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
