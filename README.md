# ParlaSoul Frontend

Next.js frontend for **ParlaSoul**, an AI character chat platform with branching
conversations, long-term memory, and real-time voice calls.

This application owns the browser UI, Better Auth login and session handling,
and the BFF routes that talk to the backend API. Business state and generation
live in the companion backend repository.

## Features

- Character discovery, chat, and profile pages
- Branching conversation UI with candidate switching, regeneration, and edits
- Server-sent streaming for chat responses and TTS audio
- Real-time voice call client (WebRTC, barge-in, live subtitles)
- Learning cards, saved items, and growth dashboard
- Subscription and pricing pages backed by Dodo Payments
- Email OTP authentication through Better Auth

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS 4, shadcn/ui, Radix |
| Data fetching | TanStack Query |
| Authentication | Better Auth, PostgreSQL session store |
| Payments | Dodo Payments |
| Cache | Redis |
| Package manager | pnpm 10 |
| Runtime | Node.js 22 |

## Getting started

### Prerequisites

- Node.js 22
- pnpm 10 (`corepack enable`)
- PostgreSQL 17
- Redis 7
- The backend running at `http://localhost:8000`

### Install and configure

```bash
git clone https://github.com/ChasePassion/parlasoul-frontend.git
cd parlasoul-frontend
pnpm install
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_SITE_URL`, and `INTERNAL_BACKEND_BASE_URL`. Payment, SMTP, and
Redis values are required only for the features that use them.

`DATABASE_URL` points at the same PostgreSQL database as the backend. Better
Auth owns the authentication tables; the backend reads the shared `users` table
and verifies the JWT this app issues.

### Run

```bash
pnpm dev
```

The app listens on <http://localhost:3001>. API and media requests are rewritten
to `INTERNAL_BACKEND_BASE_URL`.

On Windows, `pnpm dev:redis` starts a local Redis container on port 6380.

### Build

```bash
pnpm build
pnpm start
```

### Docker

```bash
docker build -t parlasoul-frontend .
docker run --env-file .env.local -p 3001:3001 parlasoul-frontend
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` runs the Node test runner suites defined in `scripts/run-node-tests.mjs`.

## Project layout

```text
src/app/          App Router routes, layouts, and BFF handlers
src/components/   UI components
src/hooks/        Client hooks
src/lib/          API client, auth, formatting, and shared utilities
src/assets/       Build-time assets
scripts/          Sprite build, local Redis, and test runner scripts
public/           Static assets
```

## Related repositories

- Backend: <https://github.com/ChasePassion/parlasoul-backend>

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Report security issues privately as
described in [`SECURITY.md`](SECURITY.md).

## License

Source code is licensed under the **GNU Affero General Public License v3.0**
(AGPL-3.0). See [`LICENSE`](LICENSE).

The ParlaSoul name, logo, character artwork, and brand assets are not covered by
the source-code license and remain the property of the project owner.
