// src/components/SharedEditor/fields/LinkedItemsField.jsx
/**
 * LinkedItemsField
 *
 * Shows linked issues grouped by relationship type (blocks / is blocked by).
 * Allows removing existing links and searching for new ones to add.
 *
 * Link types in GitLab:
 * - 'blocks': this issue blocks another
 * - 'is_blocked_by': this issue is blocked by another (same as 'blocked_by' in SVAR)
 * - 'relates_to': general relation
 *
 * In SVAR's link model: source=blocker, target=blocked (e2s type maps to 'blocks')
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import './LinkedItemsField.css';

const LINK_TYPE_LABELS = {
  blocks: 'Blocks',
  is_blocked_by: 'Is blocked by',
  relates_to: 'Relates to',
};

const LINK_TYPE_OPTIONS = [
  { value: 'blocks', label: 'blocks' },
  { value: 'is_blocked_by', label: 'is blocked by' },
  { value: 'relates_to', label: 'relates to' },
];

export function LinkedItemsField({ task }) {
  const { links, tasks, createLink, deleteLink, showToast } = useGitLabData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [linkType, setLinkType] = useState('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [removing, setRemoving] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Clear pending search timeout on unmount
  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }, []);

  // Find links for this task (as source or target)
  const taskLinks = useMemo(() => {
    const outgoing = links.filter((l) => l.source == task.id).map((l) => ({
      link: l,
      direction: 'outgoing',
      relatedTask: tasks.find((t) => t.id == l.target),
      type: l._gitlab?.relation || 'blocks',
    }));
    const incoming = links.filter((l) => l.target == task.id).map((l) => ({
      link: l,
      direction: 'incoming',
      relatedTask: tasks.find((t) => t.id == l.source),
      type: l._gitlab?.relation === 'blocks' ? 'is_blocked_by' : (l._gitlab?.relation || 'is_blocked_by'),
    }));
    return [...outgoing, ...incoming];
  }, [links, tasks, task.id]);

  // Group by type
  const groupedLinks = useMemo(() => {
    const groups = {};
    taskLinks.forEach((item) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [taskLinks]);

  const handleRemove = useCallback(async (linkItem) => {
    setRemoving(linkItem.link.id);
    try {
      const gl = linkItem.link._gitlab || {};
      await deleteLink(
        linkItem.link.id,
        gl.apiSourceIid, // always use stored original source IID; direction-derived iid is wrong for incoming links
        gl.linkedWorkItemGlobalId,
        { isNativeLink: gl.isNativeLink, metadataRelation: gl.relation, metadataTargetIid: gl.targetIid }
      );
    } catch (err) {
      showToast('Failed to remove link', 'error');
    } finally {
      setRemoving(null);
    }
  }, [deleteLink, showToast]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Filter local tasks by title or IID (synchronous — no spinner needed)
      const results = tasks
        .filter((t) =>
          t.id !== task.id &&
          !t._gitlab?.type && // Exclude milestones/folders
          (
            String(t._gitlab?.iid || t.id).includes(query) ||
            (t.text || '').toLowerCase().includes(query.toLowerCase())
          )
        )
        .slice(0, 10);
      setSearchResults(results);
    }, 300);
  }, [tasks, task.id]);

  const handleAddLink = useCallback(async (targetTask) => {
    try {
      await createLink({
        source: task.id,
        target: targetTask.id,
        type: 'e2s', // GitLab only supports end-to-start (blocks)
        _gitlab: { relation: linkType },
      });
      setSearchQuery('');
      setSearchResults([]);
      setShowAddForm(false);
    } catch (err) {
      showToast('Failed to add link', 'error');
    }
  }, [task.id, linkType, createLink, showToast]);

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">Linked Issues</label>

      {/* Grouped link list */}
      {Object.entries(groupedLinks).map(([type, items]) => (
        <div key={type} className="linked-items-group">
          <div className="linked-items-group-title">{LINK_TYPE_LABELS[type] || type}</div>
          {items.map((item) => (
            <div key={item.link.id} className="linked-item-row">
              <span className="linked-item-id">
                #{item.relatedTask?._gitlab?.iid || item.relatedTask?.id || '?'}
              </span>
              <span className="linked-item-title">
                {item.relatedTask?.text || '(Unknown)'}
              </span>
              <button
                type="button"
                className="linked-item-remove"
                onClick={() => handleRemove(item)}
                disabled={removing === item.link.id}
                title="Remove link"
              >×</button>
            </div>
          ))}
        </div>
      ))}

      {taskLinks.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--wx-color-font-alt)', marginBottom: 6 }}>
          No linked issues
        </div>
      )}

      {/* Add link form */}
      <div className="linked-items-add">
        {!showAddForm ? (
          <button type="button" className="linked-items-add-toggle" onClick={() => setShowAddForm(true)}>
            + Add linked issue…
          </button>
        ) : (
          <div className="linked-items-add-form">
            <select
              className="linked-items-type-select"
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
            >
              {LINK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              className="linked-items-search-input"
              type="text"
              placeholder="Search by title or #ID…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="linked-items-results">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="linked-items-result-item"
                    onClick={() => handleAddLink(result)}
                  >
                    <span className="linked-items-result-id">#{result._gitlab?.iid || result.id}</span>
                    <span>{result.text}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wx-color-font-alt)', textAlign: 'left', padding: 0 }}
              onClick={() => { setShowAddForm(false); setSearchQuery(''); setSearchResults([]); }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
