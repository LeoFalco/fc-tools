# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PR dashboard for Field Control teams. Next.js 15 App Router deployed on Vercel, authenticated via Google OAuth (NextAuth v5 beta). Displays open and merged pull requests per team with readiness indicators.

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build (also serves as the lint/type check gate)
npm start         # Start production server
```

There are no test or lint scripts configured for this sub-project. The parent monorepo (`fc-tools`) has its own lint/test setup.

## Architecture

This is a sub-project inside the `fc-tools` monorepo, living in the `dashboard/` directory. It imports shared modules from the parent via relative paths (e.g., `../../../../src/modules/`), enabled by `transpilePackages: ['fc-tools']` and `experimental.externalDir` in `next.config.js`.

### Key Files

- **`auth.js`** — NextAuth v5 config. Google provider restricted to `@fieldcontrol.com.br` domain.
- **`app/page.js`** — Single-page client component. Tabs for "Abertos" (open) and "Publicados" (merged) PRs, team selector dropdown.
- **`app/providers.js`** — NextAuth `SessionProvider` wrapper.
- **`app/api/opened/route.js`** — Calls `fetchOpenedPRs()` from parent's `src/modules/opened-data.js`. Returns PR list with readiness checks (CI, approvals, conflicts, quality).
- **`app/api/merged/route.js`** — Calls `fetchMergedPRs()` from parent's `src/modules/merged-data.js`. Returns merged PRs with duration stats.
- **`app/api/auth/[...nextauth]/route.js`** — NextAuth route handler, re-exports `handlers` from `auth.js`.

### Data Flow

API routes authenticate via `auth()`, then delegate to shared modules in `src/modules/` which use `githubFacade` (Octokit) to query GitHub's GraphQL API. Team member lists come from `src/core/constants.js` (TEAMS map). The client fetches `/api/opened?team=X` or `/api/merged?team=X&from=Y&to=Z`.

## Environment Variables

Required in `.env.local` (gitignored):

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth credentials
- `AUTH_SECRET` — NextAuth session encryption key
- `GITHUB_TOKEN` — Used by the parent's `githubFacade` for GitHub API access

## Stack

- Next.js 15.5, React 19, Tailwind CSS v4 (via `@tailwindcss/postcss`)
- NextAuth v5 beta (`next-auth@5.0.0-beta.25`)
- Deployed to Vercel (`vercel.json` present)
