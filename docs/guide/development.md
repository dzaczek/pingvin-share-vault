# Development

- [Running it locally](#running-it-locally)
- [Tests](#tests)
- [Pull requests](#pull-requests)

Please read the [AI Usage Policy](../../AI_USAGE_POLICY.md) before you start. AI tools are welcome here, and the policy explains what is expected in return: a precise change, a test that fails without it, and the full suite run before review.

## Running it locally

You need Node.js 24, the version CI and the container image use.

Backend:

```bash
cd backend
npm install
npx prisma migrate deploy   # creates data/pingvin-share.db from the migrations
npx prisma db seed          # writes the default settings
npm run dev                 # http://localhost:8080
```

Frontend, in a second terminal while the backend runs:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

Create an account in the browser. The first one becomes the administrator.

## Tests

| Command | Run in | Needs |
|---|---|---|
| `npm test` | `backend` | nothing |
| `npm run test:db` | `backend` | nothing, builds a throwaway SQLite database from the migrations |
| `npm run test:integration` | `backend` | a running instance, see [its README](../../backend/test/integration/README.md) |
| `npm run test:system` | `backend` | **resets the local database** (`prisma migrate reset`), then starts the backend and runs the API checks |
| `npm test` | `frontend` | nothing |
| `npm run build` | `frontend` | nothing, also checks the service worker |
| `npm run test:release` | repository root | `npm install` in the repository root |

CI runs lint, the type check and the unit tests of both parts, the database tests of the backend, the frontend build, the release script tests and the system tests. It does not run the integration tests: run them when your change touches a request path, an upload or the antivirus scan.

## Pull requests

- Keep each pull request to one change, and each commit to one logical step.
- Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages and the pull request title, for example `fix(share): keep the zip inside the share directory`. Only `feat`, `fix`, `perf` and `revert` reach the [changelog](releases.md#how-the-changelog-is-written), so pick the type with that in mind.
- Run `npm run format` in the repository root before you push.
- Say in the description what you tested, and, as the AI policy asks, what tools you used.

Releases are made by the maintainer, see [Releases](releases.md).
