# Development Plan

This file is the standing planning checkpoint for RTUT app updates.

Before future agent-driven updates, review this plan first and call out any relevant upcoming maintenance work, deadlines, or conflicts with the requested change.

## 2026 H2

### Upgrade Heroku Stack

- Target window: 2026 H2.
- Current warning: Heroku-22 is deprecated.
- Risk dates:
  - April 30, 2027: Heroku-22 reaches end of life and stops receiving security updates.
  - May 1, 2027: Heroku-22 builds are disabled.
- Proposed target stack: Heroku-24, or the current recommended Heroku stack at execution time.
- Suggested action:
  - Confirm current app name and stack.
  - Run the stack upgrade in a low-risk maintenance window.
  - Trigger a rebuild/deploy.
  - Smoke test admin-web, app console, HR tools, report generation, uploads, MongoDB-backed flows, and scheduled jobs.
- Notes:
  - Check the Node.js version declared in `package.json` before upgrading.
  - Confirm Heroku build logs for both `admin-web` and `backend/client`.
  - Keep rollback notes from the previous successful deploy.
