/**
 * Kitchen Sink Playground Component
 *
 * A hands-on interactive demo of all kitchen sink components.
 * Perfect for learning how the components work together.
 */

import { useState, useCallback } from 'react';
import { Workspace } from '../Workspace/Workspace';
import { GanttView } from '../GanttView/GanttView';

export function KitchenSinkPlayground() {
  const [activeTab, setActiveTab] = useState('workspace');
  const [showSettings, setShowSettings] = useState(false);
  const [autoSync, setAutoSync] = useState(false);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  return (
    <div className="kitchen-sink-playground">
      <div className="kitchen-sink-header">
        <h1>Kitchen Sink Playground</h1>
        <p className="subtitle">
          Interactive demo of all kitchen sink components. Click tabs to explore.
        </p>
      </div>

      <div className="kitchen-sink-tabs">
        <button
          className={`tab ${activeTab === 'workspace' ? 'active' : ''}`}
          onClick={() => handleTabChange('workspace')}
        >
          🏠 Workspace
        </button>
        <button
          className={`tab ${activeTab === 'gantt' ? 'active' : ''}`}
          onClick={() => handleTabChange('gantt')}
        >
          📊 GanttView
        </button>
      </div>

      <div className="kitchen-sink-controls">
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
            Auto Sync
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showSettings}
              onChange={handleToggleSettings}
            />
            Show Settings Modal
          </label>
        </div>
      </div>

      <div className="kitchen-sink-content">
        {activeTab === 'workspace' && (
          <div className="playground-container">
            <div className="playground-header">
              <h2>Workspace Integration</h2>
              <p className="description">
                The main container that wraps GanttView and KanbanView.
              </p>
            </div>
            <div className="playground-hint">
              Try switching between Gantt and Kanban views using the toolbar!
            </div>
            <Workspace autoSync={autoSync} />
          </div>
        )}

        {activeTab === 'gantt' && (
          <div className="playground-container">
            <div className="playground-header">
              <h2>GanttView Integration</h2>
              <p className="description">
                Gantt chart view with filter panel and project selector.
              </p>
            </div>
            <div className="playground-hint">
              Try interacting with the filter panel and project selector!
            </div>
            <GanttView hideSharedToolbar={true} showSettings={showSettings} />
          </div>
        )}
      </div>

      <div className="kitchen-sink-info">
        <h3>Hands-On Guide</h3>
        <ol>
          <li>Click on tabs to switch between Workspace and GanttView</li>
          <li>Use the toolbar to switch views (Gantt ↔ Kanban)</li>
          <li>Try the filter dropdown to filter tasks</li>
          <li>Toggle the settings modal to see component props</li>
          <li>Enable Auto Sync to see synchronization behavior</li>
        </ol>
      </div>
    </div>
  );
}
