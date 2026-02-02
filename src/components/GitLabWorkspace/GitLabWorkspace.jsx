// src/components/GitLabWorkspace/GitLabWorkspace.jsx

/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context, toolbar, and view switching.
 *
 * NOTE: SharedToolbar contains view switcher, project selector, sync button,
 * settings button, and filter toggle. These are shared between Gantt and Kanban.
 */

import { useState } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';
import { SharedToolbar } from './SharedToolbar';
import './GitLabWorkspace.css';

export function GitLabWorkspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState('gantt'); // 'gantt' | 'kanban'
  const [showSettings, setShowSettings] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* Shared Toolbar */}
        <SharedToolbar
          activeView={activeView}
          onViewChange={setActiveView}
          onSettingsClick={() => setShowSettings(true)}
          onFilterToggle={() => setShowFilter((prev) => !prev)}
          showFilter={showFilter}
        />

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && (
            <GanttView
              hideSharedToolbar={true}
              showSettings={showSettings}
              onSettingsClose={() => setShowSettings(false)}
              showFilter={showFilter}
            />
          )}
          {activeView === 'kanban' && <KanbanView />}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
