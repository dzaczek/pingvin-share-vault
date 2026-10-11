<div align="center">
  <img src="https://github.com/user-attachments/assets/b5bc0c1e-5641-4106-b322-a1b0f5448b0f" width="60"/>

  <h1>Pingvin Share X</h1>

  <p align="center">

[![GitHub Release](https://img.shields.io/github/v/release/dzaczek/pingvin-share-x)](https://github.com/dzaczek/pingvin-share-x/releases/latest) [![CI](https://github.com/dzaczek/pingvin-share-x/actions/workflows/ci.yml/badge.svg)](https://github.com/dzaczek/pingvin-share-x/actions/workflows/ci.yml)

  </p>
</div>

A self hosted file sharing platform, an alternative to WeTransfer.

This repository is [dzaczek](https://github.com/dzaczek)'s fork of [smp46/pingvin-share-x](https://github.com/smp46/pingvin-share-x), which is itself a fork of the original [Pingvin Share](https://github.com/stonith404/pingvin-share). It focuses on running the app for an organisation: managing, auditing and cleaning up many shares every day. It is in sync with upstream 2.0.0, see [What this fork adds](#what-this-fork-adds).

## Features

- Share files using a link, with no size limit other than your disk
- Expiration dates, visitor limits and passwords for shares
- Email recipients and reverse shares (upload links for other people)
- OIDC, Microsoft Entra ID and LDAP sign in
- ClamAV virus scanning
- Local storage or S3

## What this fork adds

**Admin panel**
- Share table with sorting, search, date filters, multi select and bulk delete
- Auto refresh with a time range picker, and batched loading for long lists
- ClamAV scan status per share, with a rescan button
- Block a share instead of deleting it, so its files stay for an investigation
- Access log per share: who created and opened it, grouped by IP, with ipinfo.io and VirusTotal lookups
- VirusTotal lookup of a file by its SHA256
- Shows why a share was removed, for example by ClamAV
- Shows the version and the commit the running image was built from, and offers an update when this fork publishes a newer release

**Shares**
- Optional warning before downloading a share created without an account, with a custom message per language
- Anonymous shares are locked once uploaded, so nobody holding the link can reopen them or swap the files

**ClamAV**
- Retries a scan instead of treating a ClamAV error as "file is clean"
- Keeps reconnecting instead of giving up after one failed attempt
- Large files no longer hit a timeout during the scan

**Languages**
- Falls back to English instead of showing blank text
- Can pick the language from the browser
- Complete Polish translation

## Installation

The app runs as one Docker container. ClamAV and a reverse proxy are optional.

### From a release image

Every release is published to the GitHub Container Registry, starting with 2026.10.1. Create a `docker-compose.yml`:

```yaml
services:
  pingvin-share-x:
    image: ghcr.io/dzaczek/pingvin-share-x:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    environment:
      - TRUST_PROXY=false # true if a reverse proxy is in front of the container
    volumes:
      - "./data:/opt/app/backend/data:rw,z"
      - "./data/images:/opt/app/frontend/public/img:rw,z"
```

Then run `docker compose up -d`. The app listens on `http://localhost:3000`, and the first account you create becomes the admin.

To stay on one version, use a tag like `ghcr.io/dzaczek/pingvin-share-x:v2026.10.1` instead of `latest`.

### From source

The `docker-compose.yml` in this repository builds the image from the source:

```bash
git clone https://github.com/dzaczek/pingvin-share-x.git
cd pingvin-share-x
BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build
```

`BUILD_COMMIT` is optional. It lets the admin page show which commit is running.

### ClamAV

To scan uploads for malware, add a ClamAV container as described in the [upstream documentation](https://smp46.github.io/pingvin-share-x/setup/integrations/#clamav-docker-only).

## Updating

1. Back up the `data` folder. It holds the database and all uploaded files.
2. Pull the new image (`docker compose pull`) or the new source (`git pull`, then `docker compose build`).
3. Run `docker compose up -d`. Database migrations run on startup.

The admin page shows an Update tile when a newer release exists here. Each release lists its changes in the [changelog](CHANGELOG.md) and on the [releases page](https://github.com/dzaczek/pingvin-share-x/releases).

### Coming from smp46/pingvin-share-x

Point this image at your existing `data` folder. Data from upstream 2.0.0 and older is migrated on startup. This fork adds its own migrations, so going back to the upstream image afterwards is not supported. Keep the backup from step 1.

### Version numbers

Releases are numbered by date: `2026.10.0` is the first release of October 2026, `2026.10.1` the next one in the same month. Upstream still uses `2.x`, so the numbers never overlap.

## Configuration

Settings live in the admin page under Configuration. You can also set them in a `config.yaml`, see [config.example.yaml](config.example.yaml). Keys left out of the file keep the value set in the admin page.

For details on each setting, OIDC, LDAP, S3 and reverse proxies, see the [upstream documentation](https://smp46.github.io/pingvin-share-x/). Almost all of it applies here. The `docs` folder in this repository is a copy of that site and is not published separately.

## Security

Please do not open a public issue for a vulnerability. Report it privately, see [SECURITY.md](SECURITY.md).

## Contributing

Issues and pull requests are welcome. Please read the [AI Usage Policy](AI_USAGE_POLICY.md) first.

Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org), for example `feat(share): add password protection`. The types used here are `feat`, `fix`, `docs`, `test`, `refactor`, `ci` and `chore`. Only `feat` and `fix` appear in the changelog.

Before you open a pull request, run `npm run format` in the repository root and the tests below.

### Development setup

Backend:

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Frontend, with the backend running:

```bash
cd frontend
npm install
npm run dev
```

### Tests

| Command | Where | What it needs |
|---|---|---|
| `npm test` | `backend` | nothing, unit tests |
| `npm run test:db` | `backend` | nothing, builds a throwaway SQLite database from the migrations |
| `npm run test:integration` | `backend` | a running instance, see [its README](backend/test/integration/README.md) |
| `npm run test:system` | `backend` | runs the API system tests, as CI does |
| `npm test` | `frontend` | nothing |
| `npm run test:release` | root | nothing, checks the release numbering |

### Releasing

From an up to date `main` with no local changes:

```bash
npm run release   # works out the next number, writes the changelog, commits and tags
git push origin HEAD
git push origin v2026.10.1
gh release create v2026.10.1 --repo dzaczek/pingvin-share-x --generate-notes
```

`npm run release -- --dry-run` only prints the next number and the changelog. Publishing the GitHub release builds and pushes the Docker image.

## Translations

Translations come from the upstream [Crowdin project](https://crowdin.com/project/pingvin-share-x).

## Credits

Pingvin Share was created by [stonith404](https://github.com/stonith404/pingvin-share). Pingvin Share X is maintained by [smp46](https://github.com/smp46/pingvin-share-x). This fork builds on both.
