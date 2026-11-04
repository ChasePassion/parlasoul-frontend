# Contributing

Thanks for taking the time to contribute.

## Before you start

- Search existing issues and pull requests first.
- Open an issue before working on changes that affect authentication, payments,
  the API contract, or the real-time call protocol.
- Report security issues privately as described in [`SECURITY.md`](SECURITY.md).

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The development server runs on <http://localhost:3001> and proxies `/v1` and
`/media` to the backend at `INTERNAL_BACKEND_BASE_URL`.

## Checks

Run these before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Conventions

- Follow the existing App Router structure; route files stay thin and delegate
  behavior to `src/lib` or `src/hooks`.
- Prefer server components unless client state, browser APIs, or real-time
  streams require a client component.
- Keep request logic in the existing API client layer instead of calling
  `fetch` from components.
- User-facing copy is Chinese; keep strings in the existing copy modules rather
  than scattering literals.
- Do not add silent fallbacks for missing configuration. Fail loudly.

## Commit messages

Use the project's conventional style with a scope:

```text
feat(chat): add candidate switcher
fix(auth): refresh session on token expiry
docs: document local setup
```

Keep each commit focused on one topic.

## Pull requests

- Explain the problem and the approach.
- Include the commands you ran and their results.
- Note anything intentionally out of scope.
- Confirm that no secrets, credentials, or production identifiers are included.

By submitting a contribution, you agree that it is licensed under the
AGPL-3.0 license of this repository.
