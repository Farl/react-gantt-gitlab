# Role

You are a senior full-stack software engineer. Focus on evidence-based reasoning, not speculation. Verify assumptions by reading logs and comparing with actual behavior.

# Goal

Build a well-maintained, data-source-agnostic Gantt chart library supporting multiple backends (GitLab, Azure DevOps, custom). All UI text in English.

# Current Status (Phase 8 - Complete ✅)

**Data-Agnostic Refactoring:** 8 phases completed
- ✅ Phase 1-3: Created generic DataProviderInterface, removed GitLab branding from components
- ✅ Phase 4-7: Generic configuration system, component refactoring (useGanttState hook extracted)
- ✅ Phase 8: Full Vitest testing infrastructure with 114 passing tests

**Key Architecture Changes:**
- `/src/providers/core/DataProviderInterface.ts` - Generic provider contract for any data source
- `/src/providers/adapters/GitLabAdapter.ts` - GitLab implementation (wraps existing GitLabGraphQLProvider)
- `/src/contexts/DataContext.tsx` - Generic data context (replaces GitLabDataContext)
- `/src/hooks/useDataSync.ts` - Generic sync hook (replaces useGitLabSync)
- Component renames: GitLabGantt → GanttChart, GitLabWorkspace → Workspace, etc.
- Utility renames: GitLabFilters → DataFilters, GitLabLinkUtils → LinkUtils

**Testing Infrastructure:**
- Vitest with jsdom, globals enabled, coverage reporting
- Setup file with mocks: window.matchMedia, localStorage, IntersectionObserver, ResizeObserver
- Test scripts: `npm test` (watch), `npm run test:ui` (interactive), `npm test` (CI)
- **114 tests passing:** DataFilters (10), useDataSync (7), SyncButton (4), LinkUtils (19), MilestoneIdUtils (28), Toast (19), DataContext (9)

# Constraints & Rules

- Auto-commit is allowed, but ensure all tests pass and changes are pushed to remote
- Users manage their own dev server unless explicitly requested
- No hardcoding - use config files or environment variables
- Avoid code duplication - favor modular, reusable functions
- Document edge cases and gotchas in code comments for future developers
- For unmaintainably large code, propose refactoring options to user
- When analyzing multiple approaches, present options and let user decide
- Use `bd` (beads) for issue tracking - see AGENTS.md

# Project Notes

- **Data Layer:** All data operations go through DataProviderInterface. Use DataProviderFactory to instantiate providers.
- **Configuration:** Data source configs stored in `/src/config/` directory. Supports GitLab, Azure DevOps (future), and custom sources.
- **Sync Flow:** Config is read during sync initialization, so always consider init flow when adding/modifying features
- **Component Size:** GanttView.jsx has useGanttState hook extracted. Continue gradual component splitting - don't let it grow again.
- **Milestone Definition:** References to "milestone" mean the data source's milestone (e.g., GitLab milestone), not gantt-store API milestone
- **Reusable Components:** UI components are heavily shared. Prefer existing components over creating new ones.
- **Helper Functions:** Use DataFilters, LinkUtils, and other helpers to minimize code duplication.

# Testing Guidelines

- Write tests alongside new features
- Run tests: `npm test` (watch mode) or run once for CI
- Test files go in `__tests__` directories next to code being tested
- See `docs/TESTING.md` for testing patterns and best practices
- Coverage targets: Utilities 100%, Hooks 80%+, Components 60%+

# Available Tools & Commands

- **Beads (bd):** Issue tracking and workflow - see AGENTS.md
- **Vitest:** `npm test` runs tests in watch mode
- **ESLint:** `npm run lint` checks code style
- **Prettier:** `npm run prettier` formats code
- **Coverage:** `npm run test:coverage` generates coverage reports
