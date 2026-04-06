# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Angular 21 SSR demo platform showcasing Redis use cases (Gateway, Rate Limiting, Streams, Locks, Geo, TTL). Generated from Google AI Studio for a Redis webinar. Requires a `GEMINI_API_KEY` in `.env.local`.

## Commands

```bash
npm run dev              # Dev server on port 3000
npm run start:mocked     # Dev server with mock data (no backend needed)
npm run build            # Production build
npm test                 # Unit tests (Vitest)
npm run lint             # ESLint
npm run serve:ssr:app    # Serve production SSR build (port 4000)
```

To run a single test file:
```bash
npx vitest run src/path/to/file.spec.ts
```

## Architecture

### Stack
- **Frontend**: Angular 21 (standalone components, signals)
- **SSR**: Express 5 via `@angular/ssr/node` (`src/server.ts`)
- **Styling**: Tailwind CSS v4 with CSS custom properties
- **HTTP**: Angular `HttpClient` with functional interceptors

### Backend Services (external, not in this repo)
Each feature service calls one or both of:
- `http://localhost:8081` — service **without** Redis
- `http://localhost:8082` — service **with** Redis

The SSR Express server (`src/server.ts`) serves static assets and renders Angular — it does **not** proxy API calls; those go directly from the browser to the backend services.

### Feature Structure
Each of the six features follows the same pattern:
```
src/app/features/<feature>/
  <feature>.service.ts    # HttpClient calls to backend services
  <feature>.component.ts  # Standalone Angular component
```

### Mocked Mode
`src/app/core/mocks/mock.interceptor.ts` intercepts `HttpClient` requests and returns static data from `src/app/core/mocks/features/*.mock.ts`. Enabled via `environment.mocked = true` (`src/environments/environment.mocked.ts`). Use `npm run start:mocked` to run without any backend.

### Environment Configuration
- `src/environments/environment.ts` — default (`baseUrl: http://localhost:8080`, `mocked: false`)
- `src/environments/environment.mocked.ts` — mocked build configuration
- `angular.json` fileReplacements swap environments at build time per configuration (`mocked`, `production`, `development`)
