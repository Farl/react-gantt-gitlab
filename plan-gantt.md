# The Perfect Gantt Chart — Feature Plan

> A comprehensive wishlist for turning Story Flow's Gantt into a world-class project management tool. Organized by what we have, what's available, and what we dream about.

---

## Table of Contents

1. [Current State Inventory](#1-current-state-inventory)
2. [Free SVAR Features We're Not Using](#2-free-svar-features-were-not-using)
3. [SVAR Pro Features](#3-svar-pro-features)
4. [Azure DevOps Integration Gaps](#4-azure-devops-integration-gaps)
5. [Task Dependencies & Scheduling](#5-task-dependencies--scheduling)
6. [Visual & Display Enhancements](#6-visual--display-enhancements)
7. [Interaction & UX Patterns](#7-interaction--ux-patterns)
8. [Resource Management](#8-resource-management)
9. [Sprint & Capacity Planning](#9-sprint--capacity-planning)
10. [Export & Reporting](#10-export--reporting)
11. [AI & Automation](#11-ai--automation)
12. [Developer-Specific Features](#12-developer-specific-features)
13. [Priority Tiers](#13-priority-tiers)

---

## 1. Current State Inventory

What we've built so far with SVAR Gantt free edition + Azure DevOps integration.

### Core Chart (SvarGantt.tsx)

- [x] Theme auto-switching (Willow light / WillowDark)
- [x] 5-level zoom (Year > Quarter > Month > Week > Day)
- [x] Today marker (red vertical line)
- [x] Weekend highlighting (chart columns + day-level scale headers)
- [x] Task type color coding (New=gray, Active=blue, Resolved=purple, Closed=green, Overdue=red pulse)
- [x] 4 grid columns: Story, Assignee (with initials), State, SP — all sortable
- [x] Double-click editor (Story Title, Start/End Date, Duration counter, Progress slider)
- [x] Controlled selection via `selected` prop
- [x] Date drag handling (on 'update-task' with recalculated dates)
- [x] Date validation (block end-before-start)
- [x] Destructive action blocking (delete, add, copy, indent, move)
- [x] Timescale bounds auto-computed from task data (1 week before / 2 weeks after)
- [x] Cell borders "full", length unit "day" (snap to day)
- [x] Event handler cleanup via `detach(tag)` pattern
- [x] Empty state message

### Container (StoryGanttView.tsx)

- [x] Story-to-task transformation (scheduled vs unscheduled separation)
- [x] Search with 200ms debounce (by title, assignee, ID)
- [x] Auto-scroll to first search match
- [x] Multi-select assignee filter
- [x] Overdue count badge (animated)
- [x] Zoom in/out buttons
- [x] Go to Today button
- [x] Selection state tracking
- [x] Assignee assignment via popover (when task selected)
- [x] Scheduled/unscheduled stats display
- [x] Color legend

### Toolbar (GanttToolbar.tsx)

- [x] Title + overdue badge
- [x] Search input with match count (X/Y)
- [x] Zoom controls (grouped buttons)
- [x] Today button
- [x] Fullscreen toggle (native browser Fullscreen API)
- [x] Assign button (conditional on selection)
- [x] Assignee filter popover with avatars/initials

### Unscheduled Stories

- [x] Card list of stories without dates
- [x] Quick schedule (today + 3 days)
- [x] Custom date editor with validation
- [x] Loading state during scheduling

### Azure DevOps Integration

- [x] Fetch stories from epic (WIQL + batch)
- [x] Update story dates (Start Date + Custom.EndDate)
- [x] Update story assignee
- [x] Batch date assignment
- [x] Team members fetch
- [x] File-based caching with Zod validation

---

## 2. Free SVAR Features We're Not Using

These are available in the MIT/free edition but not yet implemented.

### 2.1 Task Dependencies (Links)

**Impact: HIGH** — This is the single biggest gap.

- SVAR supports `links` array with types: `e2s` (finish-to-start), `s2s`, `e2e`, `s2e`
- Links render as arrows between task bars on the chart
- Users can draw links by dragging from one task connector to another
- `add-link`, `update-link`, `delete-link` actions available
- Azure DevOps stores predecessor/successor relationships — we just don't fetch them

```ts
// Link data format
links: [
  { id: 1, source: 101, target: 102, type: 'e2s' },
  { id: 2, source: 102, target: 105, type: 's2s', lag: 2 },
];
```

### 2.2 Hierarchy (Summary Tasks / Parent-Child)

**Impact: HIGH** — Stories are flat right now but ADO has Epic > Feature > Story.

- SVAR supports `parent` field on tasks for tree nesting
- Summary tasks auto-span their children's date range
- Collapsible branches via `open-task` action
- Could group by: Feature, Epic, Assignee, Sprint, Area Path

### 2.3 Custom Task Bar Templates

**Impact: MEDIUM** — Make bars richer than plain colored rectangles.

- `taskTemplate` prop accepts a React component rendered inside each bar
- Could show: assignee avatar, story point badge, work item type icon, priority indicator
- Full access to task data and API

```tsx
function StoryBar({ data }: { data: ITask }) {
  return (
    <div className="flex items-center gap-1 px-1 h-full text-white text-xs">
      <img src={data.assignedToAvatar} className="w-4 h-4 rounded-full" />
      <span className="truncate">{data.text}</span>
      {data.storyPoints && (
        <span className="ml-auto opacity-70">{data.storyPoints}sp</span>
      )}
    </div>
  );
}
```

### 2.4 Tooltip on Hover

**Impact: MEDIUM** — Quick info without clicking.

- SVAR exports a `Tooltip` component (confirmed in runtime exports)
- Wraps `<Gantt>` and shows on bar hover
- Shows rich task metadata: ID, title, assignee, state, SP, dates, description
- **Note**: Previous attempt crashed (`Cannot read properties of null (reading 'id')`) — needs API ref passed as state, not ref, so Tooltip re-renders when API is available

```tsx
// Fix: use state instead of ref for API
const [api, setApi] = useState<IApi | null>(null);
// Conditionally pass: api={api ?? undefined}
```

### 2.5 Native Row Filtering (filter-rows)

**Impact: MEDIUM** — Better performance for large datasets.

- Currently filtering in React (creating new array, full Gantt re-render)
- SVAR's `filter-rows` action filters the grid natively with animation
- Accessible via `api.getTable()` → table API → `exec('filter-rows', { filter })`
- Could eliminate the `filteredScheduled` useMemo entirely

### 2.6 Readonly Mode

**Impact: LOW** — Simplification.

- `readonly={true}` prop blocks ALL modifications globally
- Could replace our 5 separate intercepts for destructive actions
- Useful for stakeholder/view-only mode toggle

### 2.7 Context Menu

**Impact: MEDIUM** — Right-click actions.

- SVAR exports `ContextMenu` component (confirmed in runtime)
- Default options: Add, Edit, Delete, Copy, Cut, Paste
- Customizable via `getMenuOptions`
- Could add: "Open in Azure DevOps", "Change State", "Assign To"

### 2.8 Keyboard Shortcuts (Hotkeys)

**Impact: MEDIUM** — Power user productivity.

- `hotkey` action fires on keyboard events
- Could map: Enter=open editor, Escape=deselect, Delete=blocked message
- Arrow key navigation between tasks

### 2.9 Lazy Loading

**Impact: LOW (for now)** — Important at scale.

- `lazy` prop enables dynamic child loading
- `request-data` / `provide-data` actions for async branch loading
- Needed when backlog exceeds ~500 items

### 2.10 Inline Column Editors

**Impact: LOW** — Edit fields directly in the grid.

- Column `editor` config can specify text/date/select/combo editors
- Double-click a cell to edit inline (vs. opening the full editor dialog)
- Could enable quick date or assignee changes without the editor modal

---

## 3. SVAR Pro Features

Commercial license required. Early Bird pricing: $524 (1 dev) to $4,759 (20 devs). All perpetual.

### 3.1 Auto-Scheduling

**Impact: CRITICAL** — The killer PM feature.

- `schedule: { auto: true }` enables forward-only cascading
- Moving a predecessor automatically shifts all successors
- Respects `lag` property on links (delays between tasks)
- Enforces end-to-start dependencies at all times
- Supports `projectStart` boundary
- Invalid/circular links auto-removed

> This alone justifies the Pro license. Currently, moving one story requires manually adjusting every downstream story.

### 3.2 Critical Path Analysis

**Impact: HIGH** — Know where risk lives.

- `criticalPath: { type: "strict" | "flexible" }`
- Identifies the task chain that determines minimum project duration
- Any delay on a critical path task delays the entire project
- **Strict**: classical CPM with zero-slack analysis
- **Flexible**: greedy forward traversal for near-critical path
- Visual: critical path tasks highlighted in a distinct color

### 3.3 Working Days Calendar

**Impact: HIGH** — Fix the weekend duration problem.

- `calendar` prop: define working hours per weekday
- Mon-Fri 8h, Sat-Sun 0h — task durations calculated in real working time
- A "5-day" task spanning a weekend actually takes 7 calendar days
- Non-linear timescales that skip non-working days
- Tasks automatically respect working day constraints
- Integrates with holidays (custom non-working dates)

### 3.4 Baselines

**Impact: HIGH** — Planned vs. actual comparison.

- `baselines: true` toggle
- Tasks need `base_start`, `base_end`, `base_duration` fields
- Shows ghost bars behind actual bars showing the original plan
- Essential for tracking schedule drift
- Foundation for earned value management
- Could snapshot baselines on sprint start

### 3.5 Undo/Redo

**Impact: MEDIUM** — Safety net for drag operations.

- `undo: true` toggle
- Full history tracking for all Gantt changes
- `api.exec("undo")` / `api.exec("redo")`
- Ctrl+Z / Ctrl+Y keyboard shortcuts
- Critical for drag-heavy workflows where accidental drops happen

### 3.6 Export

**Impact: HIGH** — Stakeholder reporting.

- `api.exec("export-data", { type, ... })`
- **PDF**: multi-page, configurable headers/footers/margins/orientation
- **PNG**: high-res with custom dimensions
- **Excel/XLSX**: tabular data or visual timeline
- **MS Project XML**: full Microsoft Project compatibility
- Requires export service (Docker container or `export.svar.dev`)

### 3.7 Import (MS Project)

**Impact: MEDIUM** — PMO interop.

- `api.exec("import-data", { data: xmlString })`
- Client-side, no backend needed
- FileReader → XML string → import
- Enables migrating schedules from MS Project

### 3.8 Split Tasks

**Impact: LOW** — Interrupted work across sprints.

- `splitTasks: true` toggle
- Tasks can have `segments` array with individual start/end per segment
- Represents paused/phased work on a single row
- `api.exec("split-task", { id, segmentIndex })` for programmatic splitting

### 3.9 Unscheduled Tasks (Native)

**Impact: LOW** — We already have a custom implementation.

- `unscheduledTasks: true` shows tasks without dates in the grid tree (no bar on chart)
- Could replace our custom `UnscheduledStoriesList` component
- Advantage: integrated in the same grid, same sorting/filtering
- Disadvantage: less customizable than our current card-based UI

### 3.10 Summary Task Automation

**Impact: MEDIUM** (if we add hierarchy)

- `summary: { autoProgress: true, autoConvert: true }`
- **autoProgress**: parent progress = weighted average of children
- **autoConvert**: adding children auto-converts task to summary type

### 3.11 Markers (Today Line)

**Impact: NOTE** — We're already using this.

- `markers` is listed as a Pro feature in SVAR pricing
- We're already passing it and it renders — may indicate we have Pro access, or it may be silently included in free edition
- Worth verifying: if we're on free edition and markers render, great; if not, this is the first Pro feature to prioritize

---

## 4. Azure DevOps Integration Gaps

Data we have access to but aren't leveraging in the Gantt.

### 4.1 Unused Story Fields

| Field                | ADO API                                    | Currently                 | Opportunity                                                             |
| -------------------- | ------------------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| `description`        | `System.Description`                       | Not shown                 | Tooltip detail, editor textarea, detail panel                           |
| `acceptanceCriteria` | `Microsoft.VSTS.Common.AcceptanceCriteria` | Not shown                 | Editor textarea, detail panel                                           |
| `priority`           | `Microsoft.VSTS.Common.Priority`           | Not shown                 | Column, sort, visual indicator (P1=red border, P2=orange, etc.), filter |
| `createdDate`        | `System.CreatedDate`                       | Not shown                 | Age indicator ("created 45 days ago"), staleness alerts                 |
| `changedDate`        | `System.ChangedDate`                       | Not shown                 | "Last updated" indicator, freshness column                              |
| `workItemType`       | `System.WorkItemType`                      | Hardcoded to "User Story" | Show actual type (Bug, Task, Feature), type-specific icons              |
| `assignedToAvatar`   | `System.AssignedTo.imageUrl`               | Only in unscheduled list  | Show in task bar template, Gantt column avatars                         |

### 4.2 ADO Relationship Data Not Fetched

| Relationship              | ADO API                                       | Value                                                                         |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| **Predecessor/Successor** | `System.LinkTypes.Dependency-Forward/Reverse` | Render as dependency arrows on the Gantt — this is the #1 missing data source |
| **Parent hierarchy**      | `System.LinkTypes.Hierarchy-Forward`          | Epic > Feature > Story nesting in the Gantt                                   |
| **Related items**         | `System.LinkTypes.Related`                    | Could show as grouped tasks or info in tooltip                                |
| **Tested By**             | `Microsoft.VSTS.Common.TestedBy-Forward`      | QA dependency visualization                                                   |

### 4.3 Sprint/Iteration Data Not Fetched

| Data                        | ADO API                                                | Value                                   |
| --------------------------- | ------------------------------------------------------ | --------------------------------------- |
| **Iteration paths + dates** | `/_apis/work/teamsettings/iterations`                  | Sprint boundary overlays on timeline    |
| **Sprint capacity**         | `/_apis/work/teamsettings/iterations/{id}/capacities`  | Per-person capacity vs. load comparison |
| **Team days off**           | `/_apis/work/teamsettings/iterations/{id}/teamdaysoff` | PTO visualization on timeline           |
| **Sprint backlog**          | `/_apis/work/iterations/{id}/workitems`                | Which stories belong to which sprint    |

### 4.4 Dream ADO Integration Features

| Feature                              | Description                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| **Real-time sync via Service Hooks** | ADO pushes work item changes via webhooks instead of polling                |
| **Conflict resolution UI**           | When dates change in both ADO and Gantt, show diff and let user choose      |
| **Sync status indicators**           | Per-task icon: synced / pending / error / conflict                          |
| **State transition on Gantt**        | Right-click → Change State with valid transitions from ADO process template |
| **Create work items from Gantt**     | Add task bar → fill details → creates work item in ADO                      |
| **Area path grouping**               | Group Gantt rows by ADO Area Path (team/component ownership)                |
| **Tags as filter chips**             | ADO tags available as quick-filter buttons                                  |
| **Query-based views**                | Load any saved ADO WIQL query as a Gantt view                               |
| **Cross-project dependencies**       | Show links between work items in different ADO projects                     |
| **Bulk date push**                   | "Push all changes to ADO" button with preview of what will change           |

---

## 5. Task Dependencies & Scheduling

The foundation of real project management.

### 5.1 Four Dependency Types

| Type             | Code  | Meaning                         | Example                                     |
| ---------------- | ----- | ------------------------------- | ------------------------------------------- |
| Finish-to-Start  | `e2s` | B starts after A finishes       | "Testing starts after coding is done"       |
| Start-to-Start   | `s2s` | B starts when A starts          | "QA environment setup starts with dev"      |
| Finish-to-Finish | `e2e` | B finishes when A finishes      | "Documentation finishes with feature"       |
| Start-to-Finish  | `s2e` | B finishes when A starts (rare) | "Old system retires when new system starts" |

### 5.2 Lag/Lead Time

- Positive lag: "Start testing 2 days after coding finishes" (`lag: 2`)
- Negative lag (lead): "Start testing 1 day before coding finishes" (`lag: -1`)

### 5.3 Constraint Types (MS Project-style)

| Constraint             | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| As Soon As Possible    | Default — schedule at earliest opportunity |
| As Late As Possible    | Defer to latest possible date              |
| Start No Earlier Than  | Hard constraint on start date              |
| Start No Later Than    | Deadline for starting                      |
| Finish No Earlier Than | Minimum finish date                        |
| Finish No Later Than   | Hard deadline                              |
| Must Start On          | Fixed start date                           |
| Must Finish On         | Fixed finish date                          |

### 5.4 Slack/Float Display

- Show how much each non-critical task can slip before it becomes critical
- Visual: grey extension of the task bar showing available float
- Helps managers decide where to add buffer vs. where to reallocate

### 5.5 Dependency Chain Health

- Color-code chains: green (on track), yellow (at risk), red (already delayed)
- Show blast radius: "If this task slips 3 days, 12 downstream tasks are affected"

---

## 6. Visual & Display Enhancements

Making the chart more informative at a glance.

### 6.1 Sprint/Iteration Overlays

- Shaded vertical bands showing sprint boundaries
- Sprint name in the band header
- Sprint capacity bar at the top of each band
- Fetch iteration dates from ADO API

### 6.2 Row Grouping & Swimlanes

- Group by: Assignee, Epic, Feature, Sprint, State, Priority, Area Path
- Collapsible group headers
- Summary bar per group showing aggregate timeline span
- Alternating background colors per group

### 6.3 Mini-Map / Overview Bar

- Small thumbnail of the entire chart at the top or bottom
- Shows current viewport position as a highlighted rectangle
- Click-to-navigate for large projects (100+ tasks)

### 6.4 Milestone Markers

- Zero-duration tasks displayed as diamond markers
- For: release dates, deadlines, reviews, demos
- Could auto-create from ADO milestones or iteration end dates

### 6.5 Task Bar Enrichments

| Element             | Description                                       |
| ------------------- | ------------------------------------------------- |
| Assignee avatar     | Small circular photo inside/above the bar         |
| Priority flag       | P1=red, P2=orange, P3=yellow on bar edge          |
| Story point badge   | Number in corner of bar                           |
| Work item type icon | User Story/Bug/Task icon                          |
| Blocked indicator   | Red lock icon when task has unresolved blockers   |
| PR status dot       | Green/yellow/red dot showing associated PR status |
| Progress fill       | Partially filled bar showing completion %         |

### 6.6 Today Line Enhancements

- Pulsing or animated today line (not just static)
- "Days overdue" count on overdue task bars
- Auto-scroll-to-today on chart load

### 6.7 Dark Mode Improvements

- Proper contrast for all bar types in dark mode
- Scale header contrast
- Weekend highlighting visible but not overpowering
- Link arrow visibility

### 6.8 Zoom-to-Fit

- Button that calculates the zoom level showing all tasks in the viewport
- Useful for "show me everything" overview

### 6.9 Zoom-to-Selection

- Zoom in to show only the selected task(s) with comfortable padding
- Useful after searching for a specific task

---

## 7. Interaction & UX Patterns

### 7.1 Keyboard Shortcuts

| Shortcut                   | Action                        |
| -------------------------- | ----------------------------- |
| `Arrow Up/Down`            | Navigate between tasks        |
| `Arrow Left/Right`         | Scroll timeline               |
| `Enter`                    | Open task editor              |
| `Space`                    | Toggle task selection         |
| `Escape`                   | Close editor / deselect       |
| `Ctrl+Z` / `Ctrl+Y`        | Undo / redo                   |
| `Ctrl+F`                   | Focus search input            |
| `Ctrl+G`                   | Go to today                   |
| `+` / `-` or `Ctrl+Scroll` | Zoom in / out                 |
| `Ctrl+1` through `Ctrl+5`  | Switch zoom level directly    |
| `Home` / `End`             | Jump to first / last task     |
| `Tab` / `Shift+Tab`        | Move between grid columns     |
| `Delete`                   | Show "managed in ADO" message |
| `Ctrl+Shift+E`             | Toggle fullscreen             |

### 7.2 Drag Interactions

| Interaction                  | Behavior                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Bar drag**                 | Move task dates, maintaining duration. Date tooltip during drag. Snap to day. |
| **Left-edge resize**         | Change start date, end stays fixed. `col-resize` cursor. Min 1 day.           |
| **Right-edge resize**        | Change end date, start stays fixed.                                           |
| **Progress drag**            | Small handle at progress boundary. Drag to set completion %.                  |
| **Link drawing**             | Drag from connector point on bar to another bar. Four connector points.       |
| **Multi-select drag**        | Shift+click multiple tasks, drag to move all together.                        |
| **Backlog-to-timeline drag** | Drag unscheduled item from list onto timeline. Snap to drop date.             |
| **Rubber-band select**       | Click+drag on empty timeline to select all tasks in region.                   |
| **Pinch-to-zoom**            | Two-finger pinch on trackpad/touch. Zoom centered on midpoint.                |

### 7.3 Quick Filter Bar

- Pill-style filter chips above the chart
- One-click presets: "Active only", "My tasks", "This sprint", "Overdue", "Critical path"
- Custom filter composition with AND/OR logic
- Saved filter presets per user

### 7.4 Column-Level Filters

- Click column header → filter by values (Excel auto-filter style)
- Multi-select checkboxes for categorical columns (State, Assignee)
- Date range picker for date columns
- Number range for story points

### 7.5 Context Menu (Right-Click)

| Action               | Description                               |
| -------------------- | ----------------------------------------- |
| Open in Azure DevOps | Link to ADO work item                     |
| Edit                 | Open editor dialog                        |
| Change State         | Submenu: New → Active → Resolved → Closed |
| Assign To            | Submenu: team members                     |
| Set Priority         | P1 / P2 / P3 / P4                         |
| Add Dependency       | Draw link to another task                 |
| Scroll to Date       | Jump to a specific date on the timeline   |
| Copy Link            | Copy task URL to clipboard                |

### 7.6 Inline Grid Editing

- Double-click any cell to edit directly
- Supports: text (title), date (start/end), select (state, assignee, priority)
- Tab to move between cells
- Auto-save on blur or Enter

### 7.7 Multi-Select Operations

- Shift+click for range select
- Ctrl+click for individual multi-select
- Bulk actions on selection: assign, change state, set dates, delete
- "Select all matching filter" button

---

## 8. Resource Management

People-centric views of the schedule.

### 8.1 Resource Assignment

- Assign one or more people per task with allocation percentage
- Visual: assignee avatars on/near task bars
- Overload detection: highlight when someone has >100% allocation

### 8.2 Team Member Timeline View

- Rotate view: one row per person instead of one per task
- Shows all tasks assigned to each person on their row
- Instantly answers "what is Person X working on this week?"
- Toggle between task view and resource view

### 8.3 Workload Heatmap

- Per-person row with color intensity showing utilization
- Green = 50-80%, Yellow = 80-100%, Red = >100%
- By day or by week granularity
- Aggregate team utilization bar

### 8.4 Resource Leveling

- Automatically reschedule tasks to eliminate over-allocation
- No person at >100% capacity at any point
- Respects dependencies and constraints
- Shows before/after comparison

### 8.5 Capacity Planning

- Define available hours per person per day
- Account for PTO, meetings, part-time schedules
- Import days off from ADO Capacity API
- Show capacity vs. demand gap

### 8.6 Drag-to-Assign

- Team member panel on the side
- Drag an avatar onto a task bar to assign
- Visual feedback during drag

---

## 9. Sprint & Capacity Planning

Agile-specific views overlaid on the Gantt.

### 9.1 Sprint Boundaries

- Fetch iteration paths + dates from ADO API
- Render as shaded vertical columns with sprint names
- Sprint number in header: "Sprint 14 (Feb 10 - Feb 21)"
- Current sprint highlighted

### 9.2 Sprint Capacity Bars

- Total team capacity (from ADO settings) shown at top of each sprint column
- Allocated story points shown as a fill bar
- Color: green (under), yellow (near), red (over) capacity

### 9.3 Per-Person Sprint Capacity

- For each team member: small capacity bar per sprint
- Shows individual load vs. availability
- Highlights who is overloaded and who has slack

### 9.4 Velocity Trend

- Line chart overlaid on the timeline showing historical velocity
- Completed story points per sprint
- Average velocity line for forecasting

### 9.5 Sprint Goal Markers

- Sprint goal text as a tooltip or header on each sprint column
- Connects tasks to the "why" of each sprint

### 9.6 WIP Limit Visualization

- Highlight when a developer has too many concurrent tasks
- Configurable WIP limit per person or per team
- Visual: red border on excess tasks

### 9.7 Burndown Overlay

- Sprint burndown line overlaid on the Gantt timeline
- Ideal vs. actual burndown
- Combines two views teams constantly switch between

---

## 10. Export & Reporting

Getting data out of the Gantt.

### 10.1 PDF Export

- Multi-page PDF with configurable layout
- Header: project name, date range, filter state
- Options: include/exclude grid, custom page size, orientation
- SVAR Pro provides this via export service

### 10.2 PNG/SVG Screenshot

- High-resolution image capture of current view
- Custom dimensions, not limited to viewport
- Useful for embedding in presentations

### 10.3 Excel Export

- Tabular data: all task fields in columns
- Or visual timeline: bars rendered in cells
- Filterable, sortable in Excel

### 10.4 MS Project XML

- Full bidirectional MS Project compatibility
- Import existing MS Project plans
- Export for PMOs that require MS Project format

### 10.5 Shareable Link with Filters

- URL encodes current filter/zoom/selection state
- Share "show me sprint 14 active tasks" as a link
- Useful for Slack/Teams discussions

### 10.6 Automated Status Reports

- Weekly digest: completed, in progress, overdue, upcoming
- Schedule drift summary (baseline vs. actual)
- Risk items and blockers
- Auto-generated from Gantt data, no manual writing

---

## 11. AI & Automation

Intelligence that makes the Gantt chart a thinking partner, not just a display.

### 11.1 Auto-Schedule from Backlog

- Input: prioritized backlog with story points and dependencies
- Output: optimal start/end dates for every item
- Factors: team capacity, velocity, PTO, dependencies, priority
- "Schedule Sprint 15" button that allocates the top N stories

### 11.2 What-If Scenario Simulation

- "What happens if we add 2 developers?"
- "What if Story X slips 2 weeks?"
- "What if we cut Feature Y?"
- Shows impact on project end date, resource utilization, critical path
- Side-by-side comparison of scenarios

### 11.3 Smart Resource Assignment

- Suggest which developer should work on each story
- Factors: skills, availability, historical completion speed, current load
- "Person A is 3x faster at frontend tasks" — learns from data

### 11.4 Dependency Inference

- Analyze story titles and descriptions to suggest likely dependencies
- "Story B needs the API from Story A" detected automatically
- Suggest links that the team forgot to create

### 11.5 Duration Estimation

- Predict task duration from story points, complexity, and history
- Better than "1 SP = 1 day" — learns from actual team data
- Confidence interval: "3-5 days (80% confidence)"

### 11.6 Risk Scoring

- Each task gets a risk score (0-100)
- Factors: remaining work, velocity trend, dependency health, historical slip rate
- Visual: color-coded risk badges on task bars
- Sorted view: highest risk first

### 11.7 Bottleneck Identification

- Detect when a single person or task is on the critical path of multiple items
- "If Person X gets sick, 12 tasks are delayed"
- Suggest mitigations: cross-training, task reassignment

### 11.8 Scope Creep Detection

- Track when new tasks are added mid-sprint without removing others
- Alert when sprint capacity is exceeded
- Show sprint scope changes over time

### 11.9 Stale Task Alerts

- Flag tasks "In Progress" longer than 2x estimated duration
- Flag tasks with no ADO activity (no state change, no commits) in N days
- "Story #1234 has been Active for 14 days with no updates"

### 11.10 Natural Language Scheduling

- "Schedule the authentication epic for Sprint 14-16, assign to the Platform team"
- "Move all of Alice's tasks to next sprint"
- "Show me what's blocking the release"
- Eliminates 15 minutes of clicking for common operations

### 11.11 Completion Date Forecasting

- Monte Carlo simulation using historical velocity data
- Output: "We will finish between March 15 and April 2 with 85% confidence"
- Updates as tasks complete and velocity data changes
- Way better than "we'll be done March 20" false certainty

### 11.12 Auto-Rebalance on Slip

- When a task slips, AI proposes a new schedule minimizing impact
- May reassign tasks, adjust scope, or extend sprints
- Shows before/after comparison for approval

### 11.13 Retrospective Insights

- After each sprint: estimated vs. actual analysis
- "We consistently underestimate API integration stories by 40%"
- Per-person estimation accuracy trends
- Actionable data for improving future estimates

---

## 12. Developer-Specific Features

What engineering teams need that generic PM tools miss.

### 12.1 Git/PR Integration

- Show commit activity as indicators on task bars
- Green dot = PR merged, Yellow = PR open, Red = no code activity
- Distinguish "in progress with code" from "in progress but abandoned"
- Auto-associate branches named `feature/STORY-123`

### 12.2 CI/CD Pipeline Status

- Overlay build/deploy status on task bars
- A story is not "done" if the pipeline is broken
- Deployment markers as vertical lines on the timeline

### 12.3 Pull Request Review Queue

- Show pending code reviews as tasks assigned to reviewers
- Review bottlenecks are the #1 hidden cause of schedule slip
- "Person X has 5 PRs waiting for review" alert

### 12.4 Technical Debt Lane

- Separate swimlane for unplanned/tech-debt work
- Different visual treatment from planned stories
- Makes planned vs. unplanned ratio visible to leadership

### 12.5 Definition of Done Indicators

- Badges showing which DoD criteria are met
- [ ] Code complete, [ ] PR reviewed, [ ] QA passed, [ ] Docs updated
- Prevents "90% done" syndrome

### 12.6 Dependency Graph Toggle

- Switch from timeline view to a DAG showing dependency chains
- Sometimes the critical insight is the structure, not the dates
- Network diagram / flow chart visualization

### 12.7 Bug/Blocker Overlay

- Red flag icons on tasks that are blocked
- Blocker details on hover
- Filter to show only blocked/blocking tasks

---

## 13. Priority Tiers

Organized by impact and feasibility.

### Tier 1 — High Impact, Free/Low Cost

_Foundational features that make the Gantt actually useful for planning._

| #   | Feature                                                 | Source       | Effort                                            |
| --- | ------------------------------------------------------- | ------------ | ------------------------------------------------- |
| 1   | Task dependencies (links) with arrow rendering          | SVAR Free    | Medium — need ADO predecessor data + `links` prop |
| 2   | Epic > Feature > Story hierarchy (collapsible)          | SVAR Free    | Medium — need ADO hierarchy data + `parent` field |
| 3   | Priority column + filter + visual indicator             | ADO data gap | Small — field exists, just not displayed          |
| 4   | Custom task bar template (avatars, SP badge, type icon) | SVAR Free    | Small — implement `taskTemplate`                  |
| 5   | Tooltip on hover (with API state fix)                   | SVAR Free    | Small — fix API ref → state pattern               |
| 6   | Context menu (right-click actions)                      | SVAR Free    | Small — configure `ContextMenu` component         |
| 7   | Keyboard shortcuts                                      | SVAR Free    | Small — intercept `hotkey` action                 |
| 8   | Description/acceptance criteria in editor               | ADO data gap | Small — add textarea fields to `editorShape`      |
| 9   | Work item type icons (Bug vs Story vs Task)             | ADO data gap | Small — use actual `workItemType` field           |
| 10  | Readonly toggle for viewer mode                         | SVAR Free    | Tiny — single prop                                |

### Tier 2 — High Impact, Requires Pro or Significant Work

_Features that differentiate us from a basic chart._

| #   | Feature                                             | Source           | Effort                                     |
| --- | --------------------------------------------------- | ---------------- | ------------------------------------------ |
| 11  | Auto-scheduling (cascade date changes through deps) | SVAR Pro ($524+) | Small once licensed                        |
| 12  | Critical path visualization                         | SVAR Pro         | Small once licensed                        |
| 13  | Working days calendar (skip weekends in durations)  | SVAR Pro         | Small once licensed                        |
| 14  | Baseline snapshots (planned vs actual)              | SVAR Pro         | Medium — need baseline data capture flow   |
| 15  | Undo/redo for drag operations                       | SVAR Pro         | Tiny once licensed                         |
| 16  | Sprint overlays from ADO iteration paths            | ADO integration  | Medium — new API calls + rendering         |
| 17  | Row grouping (by assignee, epic, sprint, area)      | Custom build     | Medium                                     |
| 18  | Multi-select + bulk operations                      | Custom build     | Medium                                     |
| 19  | Export to PDF/PNG                                   | SVAR Pro         | Small once licensed (needs export service) |
| 20  | Native SVAR row filtering (replace React filtering) | SVAR Free        | Small — table API integration              |

### Tier 3 — Differentiating Features

_What makes this tool special vs. generic alternatives._

| #   | Feature                                    | Source            | Effort              |
| --- | ------------------------------------------ | ----------------- | ------------------- |
| 21  | Team member timeline view (row per person) | Custom build      | Large               |
| 22  | Workload heatmap                           | Custom build      | Large               |
| 23  | Sprint capacity bars                       | ADO integration   | Medium              |
| 24  | Quick filter bar with saved presets        | Custom build      | Medium              |
| 25  | Real-time ADO sync via webhooks            | ADO Service Hooks | Large               |
| 26  | Zoom-to-fit / zoom-to-selection buttons    | Custom build      | Small               |
| 27  | Mini-map overview                          | Custom build      | Large               |
| 28  | Shareable filtered links                   | Custom build      | Small               |
| 29  | MS Project XML import/export               | SVAR Pro          | Small once licensed |
| 30  | State transitions from right-click menu    | ADO integration   | Medium              |

### Tier 4 — AI-Powered Advanced

_Intelligence layer that makes scheduling proactive rather than reactive._

| #   | Feature                                      | Source          | Effort |
| --- | -------------------------------------------- | --------------- | ------ |
| 31  | AI auto-schedule from backlog                | Custom AI       | Large  |
| 32  | What-if scenario simulation                  | Custom AI       | Large  |
| 33  | Completion date forecasting (Monte Carlo)    | Custom build    | Medium |
| 34  | Dependency inference from story descriptions | LLM integration | Medium |
| 35  | Risk scoring per task                        | Custom build    | Medium |
| 36  | Bottleneck identification                    | Custom build    | Medium |
| 37  | Natural language scheduling commands         | LLM integration | Medium |
| 38  | Scope creep detection                        | Custom build    | Small  |
| 39  | Stale task alerts                            | Custom build    | Small  |
| 40  | Retrospective estimation analysis            | Custom build    | Medium |

### Tier 5 — Polish & Delight

_Nice-to-haves that make the experience feel premium._

| #   | Feature                                | Source               | Effort |
| --- | -------------------------------------- | -------------------- | ------ |
| 41  | Git/PR activity indicators on bars     | Git integration      | Large  |
| 42  | CI/CD pipeline status overlay          | CI integration       | Large  |
| 43  | Drag-to-assign from team panel         | Custom build         | Medium |
| 44  | Backlog-to-timeline drag               | Custom build         | Medium |
| 45  | Burndown overlay on timeline           | Custom build         | Medium |
| 46  | Meeting-aware scheduling               | Calendar integration | Large  |
| 47  | Auto status report generation          | LLM integration      | Medium |
| 48  | Dependency graph toggle view           | Custom build         | Large  |
| 49  | Cost/budget tracking                   | Custom build         | Large  |
| 50  | Cross-project dependency visualization | ADO integration      | Large  |

---

## SVAR Pro License Recommendation

If pursuing Pro features, the **Application license ($1,329 early bird)** covers:

- 5 developers
- 1 project (SaaS allowed)
- Priority support (24h response)
- All Pro features: auto-scheduling, critical path, calendar, baselines, undo/redo, export/import, split tasks, summary automation

The three highest-value Pro features for our use case:

1. **Auto-scheduling** — eliminates manual cascading, the biggest PM time sink
2. **Working days calendar** — fixes the fundamental duration calculation problem
3. **Export to PDF** — stakeholder reporting without screenshots

---

_This document is a living wishlist. Features should be pulled from these tiers based on user needs, not implemented top-to-bottom._
