> **WORKING REPOSITORY (use henceforth):** `C:\Users\DAVID\Documents\Github\smart-agriculture-system`
> **Branch:** `Ernest` (tracking `origin/Ernest`) — the assistant never commits or pushes; the user commits manually.

# Memory — Change Log (Canary)

**Purpose:** This file records every change made by the assistant in this repository. It acts as a canary: if entries stop appearing, become vague, or contradict the actual files, treat it as a sign that context length has degraded quality — re-read this file and re-verify before continuing.

## Rules

- The assistant **never commits** and **never pushes** — the user commits manually.
- Append one row to the change log after **every** file creation, edit, deletion, or move.
- Record only what actually happened; verify against the filesystem when in doubt.

## How to use as a canary

1. At the start of a task, read this file first.
2. After each change, append a log entry immediately.
3. If the log and the filesystem disagree, stop and reconcile before making further changes.

---

## Change log

| # | Date | Change | Files affected | Notes |
| --- | --- | --- | --- | --- |
| 1 | 2026-11-20 | Created this canary log | `Memory.md` | Setup only. No source files changed. No commit made. |

---

## Prior context (carried over from the old workspace)

Work was originally done in `C:\Users\DAVID\Desktop\smart-agriculture-system`, then the working path was changed to the repository above. The old-path work is **not** automatically present here — verify before assuming it exists.

- Read and distilled two Word documents (proposal + concept paper) into `PROJECT_REQUIREMENTS.md` (requirements, architecture, model design, testing, budget, gap analysis).
- Imported `docs/API_DOCUMENTATION.md` from `origin/Jason` (API contract: 36 endpoints, first 18 scoped for the database).
- Created MySQL files for API endpoints 1–18: `database/schema.sql` (10 tables) and `database/queries.sql` (endpoint-by-endpoint queries).
- Those old-path changes were committed locally on branch `Ernest` but **could not be pushed** — no GitHub credentials in that environment.
- User instruction: from now on use the new path above, and **do not commit anything**.

## Baseline observed at creation (read-only check)

- Branch: `Ernest...origin/Ernest`
- Root entries: `.gitignore`, `README.md`, `schema.sql`, `queries.sql`, `Memory.md`, `backend/`, `frontend/`, `database/`
- Note: both root-level `schema.sql`/`queries.sql` and a `database/` folder exist here. Left untouched pending user direction.
