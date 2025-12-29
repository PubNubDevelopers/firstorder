# CLAUDE.md (Project Rules)

## ALWAYS
- ALWAYS start by restating the goal, current state, and the smallest next deliverable.
- ALWAYS ask for or locate existing conventions in the repo before adding new patterns (naming, folder structure, linting, testing, config).
- ALWAYS work in small, reviewable steps. Prefer multiple small commits over one large change.
- ALWAYS keep changes scoped to the requested feature/fix. Avoid unrelated refactors unless necessary.
- ALWAYS write or update project docs when behavior, setup, or architecture changes:
  - README.md setup steps
  - /docs/* planning notes (if present)
- ALWAYS add clear, actionable TODOs in README under a "Future Improvements" section for non-launch-critical enhancements.

## PLANNING WORKFLOW
- ALWAYS use a planning-first approach:
  - Identify user story / requirement
  - Identify affected modules
  - Propose an implementation plan (bulleted steps)
  - Confirm constraints (stack, hosting, DB, deployment)
  - Then implement
- ALWAYS write plans to markdown when asked (root or /docs):
  - USER_STORIES.md
  - DATA_MODELS.md
  - TECH_STACK.md
  - DEVELOPMENT_PLAN.md
  - SECURITY_PLAN.md

## AVOID PREMATURE OPTIMIZATION
- ALWAYS prioritize “make it work correctly” over performance features.
- NEVER add caching, retries, rate limiting, queues, or complex abstractions unless:
  - The feature is working end-to-end, AND
  - There is a stated requirement or demonstrated need.
- If optimization/security hardening is suggested but not required for launch, move it to:
  - README → Future Improvements / TODO.

## QUALITY CHECKS
- ALWAYS do a quick internal code review before finishing:
  - DRY: no copy/paste logic repeated 3+ times (extract utilities)
  - SRP: avoid “god files” and “god functions”
  - Consistency with repo conventions
- ALWAYS run available linters/tests (or provide exact commands to run).
- When asked for an “extra QC layer,” provide:
  1) Findings
  2) Risk level
  3) Recommended fixes (smallest first)
  4) Follow-up checklist

## DEBUGGING EXPECTATIONS
- ALWAYS request or use these artifacts when debugging:
  - Server logs (terminal output)
  - Browser console errors
  - Network tab request/response details
- ALWAYS add targeted, temporary logs (and remove/guard them before finalizing).
- ALWAYS include reproduction steps and expected vs actual behavior in your analysis.

## GIT HYGIENE
- ALWAYS assume feature work happens on a branch.
- ALWAYS keep commit messages descriptive and scoped.
- If asked to set up a repo:
  - git init
  - set remote (SSH)
  - first commit
  - push main
- ALWAYS avoid committing generated files or secrets.

## SECURITY BASICS (NON-NEGOTIABLE)
- NEVER commit secrets, API keys, tokens, credentials, or private URLs.
- ALWAYS use environment variables (.env) and add secrets files to .gitignore.
- If user uploads are involved:
  - ALWAYS lock down object storage buckets (no public write; least-privilege access).
  - ALWAYS strip EXIF metadata from user-uploaded images.
- If handling sensitive domains (finance/medical/PII-heavy):
  - ALWAYS warn that “vibe coding” is risky and recommend stronger review/security posture.

## MCP / DOC ACCURACY
- If MCPs are available, ALWAYS use them for accuracy on framework/library behavior.
- When unsure about a library API, ALWAYS prefer authoritative docs over guessing.
- If you don’t have access to docs/tools, say so and propose a verification step.

## SESSION MANAGEMENT
- ALWAYS keep context clean:
  - Prefer separate sessions for research vs implementation.
- NEVER “compact” if it can be avoided; when context is getting large:
  - Summarize the current state into a markdown note
  - Start a fresh session and continue from that note

## COMMUNICATION STYLE
- ALWAYS be direct, opinionated, and practical.
- ALWAYS call out risks, tradeoffs, and assumptions.
- NEVER hide uncertainty; if something is unclear, say what you’d check next.

