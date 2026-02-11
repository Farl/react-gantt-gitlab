# Enterprise Gantt Chart Feature Plan

> Comprehensive feature roadmap for transforming react-svar-gantt into an enterprise-grade project management solution. Based on current SVAR Gantt implementation, GitLab integration, and research from leading enterprise PM tools.

---

## Table of Contents

1. [Current Feature Inventory](#1-current-feature-inventory)
2. [Core Enterprise Features (Tier 1)](#2-core-enterprise-features-tier-1)
3. [Advanced PM Features (Tier 2)](#3-advanced-pm-features-tier-2)
4. [Portfolio & Resource Management (Tier 3)](#4-portfolio--resource-management-tier-3)
5. [AI-Powered Features (Tier 4)](#5-ai-powered-features-tier-4)
6. [Enterprise Integrations](#6-enterprise-integrations)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Current Feature Inventory

### ✅ Currently Working (GitLab + SVAR Free)

| Feature                         | Status | Source                   |
| ------------------------------- | ------ | ------------------------ |
| GitLab project integration      | ✅     | GitLab API               |
| Milestone CRUD operations       | ✅     | Custom implementation    |
| Issue/Task CRUD operations      | ✅     | Custom implementation    |
| Drag-and-drop timeline          | ✅     | SVAR Gantt               |
| 5-level zoom (Year→Day)         | ✅     | SVAR Gantt               |
| Weekend highlighting            | ✅     | SVAR Gantt               |
| Color rules (Label-based)       | ✅     | Custom + GitLab Snippets |
| Grid column customization       | ✅     | SVAR Gantt               |
| Server/Client filters           | ✅     | Custom implementation    |
| Issue/Task links (dependencies) | ✅     | Custom implementation    |
| Blueprint/Templates             | ✅     | GitLab Snippets + Local  |
| Batch operations                | ✅     | Custom implementation    |
| Workload view                   | ✅     | Custom implementation    |
| Kanban view                     | ✅     | Custom implementation    |
| National holidays               | ✅     | GitLab Snippets          |

### 📊 Data Sources Currently Supported

- **GitLab**: Full API integration (Projects, Milestones, Issues, Tasks, Labels, Snippets)
- **Local Storage**: Blueprints, templates, color rules
- **Planned**: Azure DevOps (mentioned in readme)

---

## 2. Core Enterprise Features (Tier 1)

### 2.1 Task Dependencies & Critical Path

**Description:**
Full dependency management with four dependency types (Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish) and critical path visualization.

**Why It's Enterprise-Critical:**
Microsoft Project's dominance in enterprise PM is largely due to its critical path analysis capabilities. According to ProjectManager.com, "no other Microsoft Project alternative offers four types of dependencies, baseline tracking, real-time workload data, critical path filtering" [1].

**Implementation Requirements:**

- SVAR Pro: `schedule: { auto: true }` for auto-scheduling
- SVAR Pro: `criticalPath: { type: "strict" | "flexible" }`
- Link types: `e2s`, `s2s`, `e2e`, `s2e`
- Lag/Lead time support

**Sources:**

- [1] https://www.projectmanager.com/blog/best-ms-project-alternatives
- [2] https://www.smartsheet.com/content/gantt-chart-critical-path

---

### 2.2 Working Days Calendar

**Description:**
Configure working hours per weekday (Mon-Fri 8h, Sat-Sun 0h) with automatic duration calculation in working time. Tasks spanning weekends show actual calendar days vs. working days.

**Why It's Enterprise-Critical:**
"A '5-day' task spanning a weekend actually takes 7 calendar days" — this fundamental calculation error exists in most basic Gantt tools. Enterprise tools like Microsoft Project and Smartsheet handle this natively [3].

**Implementation Requirements:**

- SVAR Pro: `calendar` prop configuration
- Holiday integration (already stored in GitLab Snippets)
- Non-linear timescales that skip non-working days

**Sources:**

- [3] https://www.zoho.com/blog/projects/critical-path-and-baseline-for-gantt.html

---

### 2.3 Baseline Tracking

**Description:**
Snapshot project schedules at key milestones (sprint start, release planning) and compare planned vs. actual progress. Shows "ghost bars" behind actual bars.

**Why It's Enterprise-Critical:**
"Baseline comparisons: Visual comparisons between the original schedule and current progress help identify variances. These insights are crucial for measuring performance and forecasting delays" [4].

**Implementation Requirements:**

- SVAR Pro: `baselines: true`
- Task fields: `base_start`, `base_end`, `base_duration`
- Variance calculations (slippage tracking)

**Sources:**

- [4] https://smartpm.com/blog/construction-gantt-chart-complete-guide
- [5] https://www.zoho.com/blog/projects/critical-path-and-baseline-for-gantt.html

---

### 2.4 Resource Management & Workload

**Description:**
Team member timeline view, workload heatmaps, and resource leveling to prevent overallocation.

**Why It's Enterprise-Critical:**
Wrike emphasizes "resource leveling in Gantt charts to balance workloads, reduce conflicts, and keep projects on track" [6]. Enterprise PM requires visibility into who is overloaded and who has capacity.

**Key Features:**

- Per-person row view (rotate Gantt: tasks × people vs. time)
- Workload heatmap (Green 50-80%, Yellow 80-100%, Red >100%)
- Resource leveling (auto-reschedule to eliminate over-allocation)
- Capacity planning with PTO/holidays

**Implementation Requirements:**

- Custom build (not in SVAR Pro)
- GitLab assignee data already available
- Workload calculations per person per day

**Sources:**

- [6] https://www.wrike.com/blog/resource-leveling-gantt-charts/

---

### 2.5 Undo/Redo System

**Description:**
Full history tracking for all Gantt changes with Ctrl+Z / Ctrl+Y support.

**Why It's Enterprise-Critical:**
Drag-heavy workflows inevitably have accidental drops. Without undo, users lose trust in the tool.

**Implementation Requirements:**

- SVAR Pro: `undo: true`
- `api.exec("undo")` / `api.exec("redo")`

---

## 3. Advanced PM Features (Tier 2)

### 3.1 Export & Reporting

**Description:**
Professional export capabilities for stakeholder reporting and PMO compliance.

**Formats Required:**

- **PDF**: Multi-page with configurable headers/footers/margins
- **PNG/SVG**: High-res screenshots for presentations
- **Excel/XLSX**: Tabular data or visual timeline
- **MS Project XML**: Full Microsoft Project compatibility

**Implementation Requirements:**

- SVAR Pro: `api.exec("export-data", { type, ... })`
- Export service (Docker container or `export.svar.dev`)

**Sources:**

- [7] https://www.projectmanager.com/blog/microsoft-project-gantt-chart

---

### 3.2 Row Grouping & Swimlanes

**Description:**
Group Gantt rows by Epic, Feature, Assignee, Sprint, State, Priority, or Area Path with collapsible headers.

**Why It's Enterprise-Critical:**
For large projects (100+ tasks), flat lists become unmanageable. Hierarchy is essential for navigation.

**Implementation Requirements:**

- SVAR Free: `parent` field for tree nesting
- Custom grouping logic
- Summary bars per group

---

### 3.3 Sprint & Iteration Overlays

**Description:**
Shaded vertical bands showing sprint boundaries with capacity bars.

**Features:**

- Sprint boundaries from GitLab iterations
- Sprint capacity visualization
- Per-person sprint load
- Velocity trend line

**Implementation Requirements:**

- GitLab Iterations API
- Custom rendering layer
- Capacity calculations

---

### 3.4 Multi-Select & Bulk Operations

**Description:**
Shift+click range select, Ctrl+click multi-select, bulk assign/change state/set dates.

**Implementation Requirements:**

- SVAR Free: Selection API
- Custom bulk action UI
- Batch GitLab API calls

---

### 3.5 Keyboard Shortcuts

**Description:**
Power user productivity with full keyboard navigation.

**Shortcuts:**

- `Arrow Up/Down`: Navigate tasks
- `Enter`: Open editor
- `Ctrl+Z/Y`: Undo/Redo
- `Ctrl+F`: Focus search
- `+/-`: Zoom in/out
- `Delete`: Show "managed in GitLab" message

**Implementation Requirements:**

- SVAR Free: `hotkey` action

---

## 4. Portfolio & Resource Management (Tier 3)

### 4.1 Portfolio Gantt View

**Description:**
Multi-project Gantt showing phases, milestones, and dependencies across projects.

**Why It's Enterprise-Critical:**
"A portfolio Gantt focuses on phases, milestones, and dependencies across projects to support coordination and prioritization" [8].

**Implementation Requirements:**

- Multi-project data aggregation
- Project-level grouping
- Cross-project dependency visualization

**Sources:**

- [8] https://www.wrike.com/blog/how-to-use-a-single-gantt-chart-for-multiple-projects/

---

### 4.2 Resource Leveling

**Description:**
Automatically reschedule tasks to eliminate over-allocation while respecting dependencies.

**Why It's Enterprise-Critical:**
Resource conflicts are the #1 cause of schedule slip in enterprise projects.

**Implementation Requirements:**

- Algorithm: Smooth resource demand by delaying non-critical tasks
- Visual: Before/after comparison
- Constraint: Respect dependencies and deadlines

---

### 4.3 Cost/Budget Tracking

**Description:**
Track planned vs. actual costs, resource rates, and budget variance.

**Features:**

- Resource hourly rates
- Task cost calculations
- Budget variance alerts
- Earned value management (EVM)

**Implementation Requirements:**

- Custom fields for cost data
- GitLab time tracking integration
- Budget baselines

---

### 4.4 Risk Scoring

**Description:**
Each task gets a risk score (0-100) based on remaining work, velocity trend, dependency health, and historical slip rate.

**Implementation Requirements:**

- Risk algorithm
- Color-coded badges
- Sorted risk view

---

## 5. AI-Powered Features (Tier 4)

### 5.1 Auto-Schedule from Backlog

**Description:**
Input prioritized backlog with story points and dependencies → output optimal start/end dates considering capacity, velocity, PTO, and priority.

**Why It's AI-Critical:**
Manual scheduling of large backlogs takes hours. AI can optimize in seconds.

**Implementation Requirements:**

- Monte Carlo simulation
- Historical velocity data
- Constraint solver

---

### 5.2 What-If Scenario Simulation

**Description:**
"What happens if we add 2 developers?" "What if Story X slips 2 weeks?" Side-by-side comparison of scenarios.

**Implementation Requirements:**

- Scenario branching
- Impact calculations
- Visual comparison UI

---

### 5.3 Smart Resource Assignment

**Description:**
AI suggests which developer should work on each task based on skills, availability, historical completion speed, and current load.

**Implementation Requirements:**

- ML model training
- Skill matching
- Performance history analysis

---

### 5.4 Dependency Inference

**Description:**
Analyze story titles and descriptions to suggest likely dependencies automatically.

**Implementation Requirements:**

- LLM integration
- NLP for dependency detection
- Confidence scoring

---

### 5.5 Completion Date Forecasting

**Description:**
Monte Carlo simulation using historical velocity data. Output: "We will finish between March 15 and April 2 with 85% confidence."

**Implementation Requirements:**

- Historical velocity tracking
- Monte Carlo simulation
- Confidence intervals

---

## 6. Enterprise Integrations

### 6.1 Real-Time Sync

**Description:**
GitLab Service Hooks push work item changes via webhooks instead of polling.

**Implementation Requirements:**

- Webhook server
- Real-time UI updates
- Conflict resolution UI

### 6.2 Azure DevOps (Planned)

**Description:**
Full Azure DevOps integration (currently planned per readme).

**Features:**

- Work item fetching
- Predecessor/successor relationships
- Sprint/iteration data
- Capacity planning

### 6.3 Git Integration

**Description:**
Show commit activity and PR status on task bars.

**Features:**

- Green dot = PR merged
- Yellow = PR open
- Red = no code activity
- Auto-associate branches

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)

- [ ] Upgrade to SVAR Pro ($524-1,329)
- [ ] Implement auto-scheduling
- [ ] Implement working days calendar
- [ ] Add critical path visualization
- [ ] Implement baselines

### Phase 2: Resource Management (Months 3-4)

- [ ] Team member timeline view
- [ ] Workload heatmaps
- [ ] Resource leveling
- [ ] Capacity planning

### Phase 3: Enterprise Features (Months 5-6)

- [ ] Export (PDF, Excel, MS Project)
- [ ] Portfolio view
- [ ] Advanced reporting
- [ ] Real-time sync

### Phase 4: AI Features (Months 7-9)

- [ ] Auto-schedule from backlog
- [ ] What-if scenarios
- [ ] Smart resource assignment
- [ ] Completion forecasting

---

## SVAR Pro License Recommendation

**Application License: $1,329 (Early Bird)**

- 5 developers
- 1 project (SaaS allowed)
- Priority support (24h response)
- All Pro features included

**ROI Justification:**
The three highest-value Pro features:

1. **Auto-scheduling** — eliminates manual cascading (biggest PM time sink)
2. **Working days calendar** — fixes fundamental duration calculation
3. **Export to PDF** — stakeholder reporting without screenshots

---

## Sources & References

| Source                             | URL                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| ProjectManager MS Project Analysis | https://www.projectmanager.com/blog/microsoft-project-gantt-chart                            |
| Smartsheet Critical Path Guide     | https://www.smartsheet.com/content/gantt-chart-critical-path                                 |
| Zoho Baseline & Critical Path      | https://www.zoho.com/blog/projects/critical-path-and-baseline-for-gantt.html                 |
| SmartPM Construction Gantt         | https://smartpm.com/blog/construction-gantt-chart-complete-guide                             |
| Wrike Resource Leveling            | https://www.wrike.com/blog/resource-leveling-gantt-charts/                                   |
| Wrike Portfolio Gantt              | https://www.wrike.com/blog/how-to-use-a-single-gantt-chart-for-multiple-projects/            |
| Instagantt MS Project Alternative  | https://www.instagantt.com/microsoft-project-alternative-for-gantt-charts                    |
| Monday.com Critical Path           | https://support.monday.com/hc/en-us/articles/4420037448850-Critical-Path-for-the-Gantt-Chart |

---

_Document Version: 1.0_
_Created: February 11, 2026_
_Based on: SVAR React Gantt 2.3.3, GitLab API, Enterprise PM Research_
