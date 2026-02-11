# Milestone Implementation - Complete Documentation

## Goal

Support milestones as top-level tasks in the Gantt Chart, implementing a hierarchical structure:

```
Milestone (Top-level)
  └─ Issue (Child of Milestone)
      └─ Task/Subtask (Child of Issue)
```

## Implementation Status

### Completed Features

1. **Milestone Data Fetching and Conversion**
   - Query milestones from the data source (project/group level)
   - Convert milestones to Gantt task format
   - Timezone handling for milestones (T00:00:00 and T23:59:59)
   - Handle milestones without dates (default +30 days)

2. **Milestone CRUD Operations**
   - Create: via data source REST API
   - Update: via data source REST API
   - Delete: Not supported (API limitation, can only close)
   - Timezone handling: unified via `formatDateForProvider()` method

3. **Hierarchical Structure**
   - Milestones as root level tasks (parent = 0)
   - Issues belong to milestones (via milestoneWidget)
   - Subtasks belong to issues (via hierarchyWidget)
   - Correct 3-level structure handling

4. **Sorting Logic**
   - Root level: Milestones first (by dueDate > startDate > title)
   - Root level: Standalone issues second (by displayOrder > id)
   - Issues within milestones: by displayOrder > id
   - Subtasks within issues: by displayOrder > id

5. **UI Integration**
   - Create milestones via the Toolbar "Add Task" button
   - Edit milestone properties via the Editor
   - Drag to adjust milestone dates on the timeline
   - Milestone updates sync correctly to the data source

6. **Guard Logic**
   - Prevent creating subtasks directly under milestones
   - Prevent creating hierarchies deeper than 3 levels
   - Milestone updates correctly route to `updateMilestone` method

## Technical Implementation Details

### 1. Data Fetching and Conversion

#### Querying Milestones (GraphQL)

```typescript
const milestonesQuery = `
  query getMilestones($fullPath: ID!) {
    ${this.config.type}(fullPath: $fullPath) {
      milestones(state: active, first: 100) {
        nodes {
          id
          iid
          title
          description
          state
          dueDate
          startDate
          webPath
          createdAt
          updatedAt
        }
      }
    }
  }
`;
```

#### Converting Milestones to Tasks

```typescript
import { createMilestoneTaskId } from '../utils/MilestoneIdUtils';

private convertMilestoneToTask(milestone: any): ITask {
  // Use string ID format to avoid collision with work item IIDs
  // Format: "m-{iid}" (e.g., "m-1", "m-8")
  const milestoneTaskId = createMilestoneTaskId(milestone.iid);

  // Timezone handling: ensure local timezone is used
  const startDate = milestone.startDate
    ? new Date(milestone.startDate + 'T00:00:00')
    : milestone.createdAt
      ? new Date(milestone.createdAt)
      : new Date();

  // Default to +30 days if no due date
  const endDate = milestone.dueDate
    ? new Date(milestone.dueDate + 'T23:59:59')
    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: milestoneTaskId,  // String format: "m-1"
    text: milestone.title,
    start: startDate,
    end: endDate,
    duration: Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))),
    type: 'task', // Use 'task' not 'summary' to support baseline
    parent: 0,
    details: milestone.description || '',
    $isMilestone: true, // Custom flag for CSS styling
    _provider: {
      type: 'milestone',
      id: milestone.iid,        // For UI identification
      globalId: milestone.id,   // For REST API calls
      web_url: webUrl,
    },
  };
}
```

**Key Decisions:**

- **ID Format**: Milestone task ID = `"m-{iid}"` (string format) to avoid collision with work item IIDs
  - Old format `10000 + iid` is deprecated because projects with 10000+ issues would cause collisions
  - Utility functions in `src/utils/MilestoneIdUtils.ts`
- **Type**: Use `'task'` instead of `'summary'` to support baseline functionality
- **Timezone**: Append `T00:00:00` and `T23:59:59` to ensure local timezone parsing
- **Global ID**: Store the full global ID (e.g., `gid://gitlab/Milestone/1130`) for REST API use

### 2. Milestone Update Logic

#### Key Finding: REST API Uses Internal IDs

The data source REST API `milestone_id` parameter requires the **internal ID** (extracted from globalId), not the iid:

- Wrong: Using iid (e.g., 1) results in 404 Not Found
- Correct: Using internal ID (e.g., 1130, extracted from global ID)

#### Updating Milestones

```typescript
import { extractMilestoneIid } from '../utils/MilestoneIdUtils';

async updateMilestone(id: TID, milestone: Partial<ITask>): Promise<void> {
  // Extract internal ID from globalId or task ID
  let milestoneId: string;

  if (milestone._provider?.globalId) {
    const match = milestone._provider.globalId.match(/\/Milestone\/(\d+)$/);
    if (match) {
      milestoneId = match[1]; // Extract "1130"
    } else {
      const extractedIid = extractMilestoneIid(id);
      milestoneId = String(milestone._provider.id || extractedIid);
    }
  } else if (milestone._provider?.id) {
    milestoneId = String(milestone._provider.id);
  } else {
    const extractedIid = extractMilestoneIid(id);
    if (extractedIid !== null) {
      milestoneId = String(extractedIid);
    } else {
      throw new Error(`Cannot determine milestone ID from task ID: ${id}`);
    }
  }

  // Build payload
  const payload: any = {};
  if (milestone.text !== undefined) payload.title = milestone.text;
  if (milestone.details !== undefined) payload.description = milestone.details;
  if (milestone.start !== undefined) {
    payload.start_date = milestone.start ? this.formatDateForProvider(milestone.start) : null;
  }
  if (milestone.end !== undefined) {
    payload.due_date = milestone.end ? this.formatDateForProvider(milestone.end) : null;
  }

  // Use REST API
  const updatedMilestone = await restRequest(
    `/projects/${encodedProjectId}/milestones/${milestoneId}`,
    {
      url: this.config.url,
      token: this.config.token,
      isDev: this.isDev,
    },
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}
```

#### Routing Logic

```typescript
async updateWorkItem(id: TID, task: Partial<ITask>): Promise<void> {
  // Check if this is a milestone using _provider.type
  if (task._provider?.type === 'milestone') {
    console.log('[Provider] Detected milestone update, routing to updateMilestone');
    return this.updateMilestone(id, task);
  }

  // Normal work item update logic...
}
```

### 3. Timezone Handling Strategy

All date operations use the `formatDateForProvider()` method to ensure local timezone consistency:

```typescript
private formatDateForProvider(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Where it's used:**

1. Creating work items
2. Creating milestones
3. Updating milestones

**Bug fix (already resolved):**

- Wrong: `toISOString().split('T')[0]` converts to UTC, causing date offset
- Correct: `formatDateForProvider(date)` uses local timezone

### 4. UI Interaction Handling

#### Removed Milestone Update Skip Logic

Original code would skip milestone updates:

```typescript
// Removed
if (ev.task._provider?.type === 'milestone') {
  return; // This prevented milestone updates from syncing
}
```

Removing this check allows milestone drag-and-edit operations to sync correctly.

### 5. Sorting Logic

```typescript
private sortTasksByOrder(tasks: ITask[]): ITask[] {
  // Group by parent
  const tasksByParent = new Map<number | string, ITask[]>();
  tasks.forEach((task) => {
    const parentId = task.parent || 0;
    if (!tasksByParent.has(parentId)) {
      tasksByParent.set(parentId, []);
    }
    tasksByParent.get(parentId)!.push(task);
  });

  const sortedTasks: ITask[] = [];
  tasksByParent.forEach((parentTasks, parentId) => {
    if (parentId === 0) {
      // Root level: separate milestones and issues
      const milestones = parentTasks.filter((t) => t._provider?.type === 'milestone');
      const issues = parentTasks.filter((t) => t._provider?.type !== 'milestone');

      // Milestones: sort by due date > start date > title
      milestones.sort((a, b) => {
        if (a.end && b.end) return a.end.getTime() - b.end.getTime();
        if (a.end) return -1;
        if (b.end) return 1;
        if (a.start && b.start) return a.start.getTime() - b.start.getTime();
        if (a.start) return -1;
        if (b.start) return 1;
        return (a.text || '').localeCompare(b.text || '');
      });

      // Issues: sort by displayOrder > id
      issues.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return (a.id as number) - (b.id as number);
      });

      // Merge: milestones first, then issues
      sortedTasks.push(...milestones, ...issues);
    } else {
      // Non-root level: sort by displayOrder > id
      parentTasks.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return (a.id as number) - (b.id as number);
      });
      sortedTasks.push(...parentTasks);
    }
  });

  return sortedTasks;
}
```

## API Usage Summary

### GraphQL API

**Used for:** Querying data

```graphql
query getMilestones($fullPath: ID!) {
  project(fullPath: $fullPath) {
    milestones(state: active, first: 100) {
      nodes {
        id # global ID (e.g., gid://gitlab/Milestone/1130)
        iid # incremental ID (e.g., 1)
        title
        description
        dueDate # "2025-11-25"
        startDate # "2025-11-24"
      }
    }
  }
}
```

### REST API

**Used for:** Creating and updating milestones (GraphQL does not support mutations for milestones)

```
POST /api/v4/projects/:id/milestones
PUT /api/v4/projects/:id/milestones/:milestone_id
```

**Important:** The `milestone_id` parameter uses the internal ID (extracted from globalId), not the iid!

## Test Checklist

### Milestone CRUD

- [x] Create milestone (via UI dialog)
- [x] Edit milestone title (via editor)
- [x] Edit milestone dates (drag bar)
- [x] Dates sync correctly to data source (no timezone offset)

### Hierarchical Structure

- [x] Milestones display at root level
- [x] Issues can belong to milestones (via milestoneWidget)
- [x] Subtasks can belong to issues (via hierarchyWidget)
- [x] 3-level structure displays correctly

### Sorting

- [x] Milestones sorted by due date
- [x] Milestones appear before root-level issues
- [x] Sorting maintained after sync

### Timezone Handling

- [x] Creation uses local timezone
- [x] Updates use local timezone
- [x] Same-day milestones display correctly (00:00:00 to 23:59:59)

## Known Limitations

1. **Delete Milestone**: The API does not support deleting milestones, only closing them
2. **Group Milestone**: Only project-level milestones have been tested
3. **Milestone Assignment**: Drag-to-assign issues to milestones is not yet implemented
4. **Milestone Progress**: Milestones do not have a progress bar

## Future Improvements

1. **Drag-to-Assign**: Implement dragging issues to milestones
2. **Batch Operations**: Support batch milestone updates
3. **Milestone Progress**: Auto-calculate completion rate of issues within a milestone
4. **Group Milestones**: Full testing of group-level milestone support
5. **Milestone Filtering**: Provide milestone filter options in the UI

## References

- [Milestones API Documentation](https://docs.gitlab.com/api/milestones/)
- [GraphQL API Documentation](https://docs.gitlab.com/api/graphql/)

## Change History

### 2025-11-21

- Fixed timezone issue when creating milestones
- Implemented milestone update functionality (using REST API)
- Discovered and fixed: REST API requires internal ID, not iid
- Removed milestone skip logic in update-task event handler
- Unified all timezone handling (using formatDateForProvider)

### Earlier

- Implemented milestone data fetching and conversion
- Implemented milestone creation (using REST API)
- Implemented sorting logic (milestones first)
- Implemented 3-level hierarchical structure
