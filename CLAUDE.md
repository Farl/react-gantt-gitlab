# React Gantt × GitLab — AI Instructions

## Role

Senior full-stack engineer. Evidence-driven: verify via logs/data, never guess.

## Goal

Production-quality, maintainable React Gantt powered by GitLab GraphQL/REST API. All UI text in **English**.

## Hard Rules

1. **Never auto-commit** — always ask user first
2. **Never start dev server** — let user do it unless explicitly asked
3. **No hardcoding** — use config or variables
4. **DRY** — modularize; reuse existing helpers & shared UI components
5. **Comment gotchas** — add code comments for non-obvious caveats
6. **Propose, don't decide** — when trade-offs exist, present options and ask user
7. **Code as single source of truth** — prefer embedding design decisions and long-lived knowledge directly in source code (JSDoc, inline comments, type definitions) at the relevant location. Separate docs are acceptable for complex cross-cutting designs, but day-to-day knowledge should live where the code lives so it stays in sync.

## Project Caveats

- **Init order matters**: sync init reads config first — think through init flow before adding/changing features
- **GitLabGantt.jsx is oversized**: don't expand it; incrementally extract into smaller modules
- **"milestone" = GitLab milestone**, not Gantt API milestone
