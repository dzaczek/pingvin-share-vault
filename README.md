<div align="center">
  <img src="frontend/public/img/logo.svg" width="60" alt="Pingvin Share Vault logo"/>

  <h1>Pingvin Share Vault</h1>

  <p align="center">

[![GitHub Release](https://img.shields.io/github/v/release/dzaczek/pingvin-share-vault)](https://github.com/dzaczek/pingvin-share-vault/releases/latest) [![CI](https://github.com/dzaczek/pingvin-share-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/dzaczek/pingvin-share-vault/actions/workflows/ci.yml) [![Demo](https://github.com/dzaczek/pingvin-share-vault/actions/workflows/demo.yml/badge.svg)](https://pingvin-share-vault-demo.fly.dev/)

  </p>

  <p><b><a href="https://pingvin-share-vault-demo.fly.dev/">Try the live demo</a></b></p>
</div>

A self hosted file sharing platform, an alternative to WeTransfer.

This repository is [dzaczek](https://github.com/dzaczek)'s fork of [smp46/pingvin-share-x](https://github.com/smp46/pingvin-share-x), which is itself a fork of the original [Pingvin Share](https://github.com/stonith404/pingvin-share). It focuses on running the app for an organisation: managing, auditing and cleaning up many shares every day. It is in sync with upstream 2.0.0, see [What this fork adds](#what-this-fork-adds).

## Contents

- [Try the demo](#try-the-demo)
- [Features](#features)
- [What this fork adds](#what-this-fork-adds)
- [Installation](#installation)
- [Updating](#updating)
- [Configuration](#configuration)
- [Security](#security)
- [Contributing](#contributing)
- [Translations](#translations) and [Credits](#credits)

## Try the demo

A public demo runs at **https://pingvin-share-vault-demo.fly.dev/**, always on the latest `main`.

| Account | Password | What you can do |
|---|---|---|
| `demo` | `demo1234` | a normal user with about 60 shares |
| `demoadmin` | shown in the banner at the top of every page, new at every reset | look around the whole admin panel |
| none | | share files without an account |

- Everything is reset every 15 minutes, and when the demo wakes up after being idle. Whatever you upload is gone after that.
- A share can hold at most 1 MB.
- About 300 shares with lorem ipsum files are already there. A few are protected with the password `demo`.
- Upload the [EICAR test file](https://www.eicar.org/download-anti-malware-testfile/) to see the virus scan remove a share.
- The demo runs with `DEMO_MODE=true`, so the admin cannot change settings, the logo, passwords or accounts. With `ANONYMIZE_IP=mask`, logs only show addresses like `203.*.*.57`.
- The admin page shows the commit the demo was built from, next to the version.

The demo setup itself lives in [dzaczek/pingvin-share-vault-demo](https://github.com/dzaczek/pingvin-share-vault-demo).

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

**Audit log**
- An append only log of logins (including failed ones), uploads, downloads, previews and share views, for users and anonymous visitors
- Follows one visitor across requests through a browser fingerprint, even without an account
- Admin page with a live timeline, the trail of one user, visitor or IP, and traffic per shard
- Passwords and tokens are redacted, entries older than `AUDIT_LOG_RETENTION_DAYS` are deleted every night

**Shares**
- Optional warning before downloading a share created without an account, with a custom message per language
- Anonymous shares are locked once uploaded, so nobody holding the link can reopen them or swap the files
- Download all in one of four ways, chosen by the admin: off, a zip built after upload, a zip built while it downloads (no extra disk space), or every file on its own

**Look**
- A second style, Glass, modeled on Apple's [Liquid Glass guidelines](https://developer.apple.com/documentation/technologyoverviews/liquid-glass): a floating header, translucent buttons, menus and dialogs, and separate cards for uploading files and folders
- The admin sets the default style, glass variant, blur, background and tint under Appearance, and every user can pick their own style on the account page
- Glass sits on a gradient, an aurora, one color of your choice, or a photo or video wallpaper, like a desktop wallpaper on macOS. Wallpapers come from a gallery under Appearance: four built in vector wallpapers four living Alpine scenes (lake, flight, voyage, balloons) that fade from day through dusk into night and back in about three minutes, and a calm space scene, your own uploads (JPG, PNG, WebP up to 20 MB, MP4 and WebM up to 60 MB, stored in `data/wallpapers`) or any address, each marked with how well it covers a large screen
- Glass can also use the one panel upload and download from Precision (Appearance, Upload like WeTransfer), off by default
- Glass turns solid when the system asks for less transparency or more contrast, and the press animation stops when it asks for less motion
- A third style, Precision, for people who work with a lot of data: crisp 1px borders, small radii, compact tables with a pinned header, monospace IPs and IDs, a red accent and colors that pass WCAG AA in light and dark mode

**Privacy**
- `ANONYMIZE_IP` keeps only a shortened (`203.0.113.0`) or masked (`203.*.*.57`) address of every visitor, in every log

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
  pingvin-share-vault:
    image: ghcr.io/dzaczek/pingvin-share-vault:latest
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

To stay on one version, use a version tag instead of `latest`.

This fork was called Pingvin Share X until 2026.10.2, and those releases are still at `ghcr.io/dzaczek/pingvin-share-x`. Later releases go to `ghcr.io/dzaczek/pingvin-share-vault`. To move over, change the image name and keep the same `data` folder: the database, the settings and the shares carry over unchanged.

### From source

The `docker-compose.yml` in this repository builds the image from the source:

```bash
git clone https://github.com/dzaczek/pingvin-share-vault.git
cd pingvin-share-vault
BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build
```

`BUILD_COMMIT` is optional. It lets the admin page show which commit is running.

### ClamAV

To scan uploads for malware, add a ClamAV container as described in the [upstream documentation](https://smp46.github.io/pingvin-share-x/setup/integrations/#clamav-docker-only).

## Updating

1. Back up the `data` folder. It holds the database and all uploaded files.
2. Pull the new image (`docker compose pull`) or the new source (`git pull`, then `docker compose build`).
3. Run `docker compose up -d`. Database migrations run on startup.

The admin page shows an Update tile when a newer release exists here. Each release lists its changes in the [changelog](CHANGELOG.md) and on the [releases page](https://github.com/dzaczek/pingvin-share-vault/releases).

### Coming from smp46/pingvin-share-x

Point this image at your existing `data` folder. Data from upstream 2.0.0 and older is migrated on startup. This fork adds its own migrations, so going back to the upstream image afterwards is not supported. Keep the backup from step 1.

### Version numbers

Releases are numbered by date: `2026.10.0` is the first release of October 2026, `2026.10.1` the next one in the same month. Upstream still uses `2.x`, so the numbers never overlap.

## Configuration

Settings live in the admin page under Configuration. You can also set them in a `config.yaml`, see [config.example.yaml](config.example.yaml). Keys left out of the file keep the value set in the admin page.

### Environment variables

The ones this fork adds or relies on most. All of them are optional.

| Variable | Default | Meaning |
|---|---|---|
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy, otherwise every IP in the logs is the proxy's |
| `TRUST_PROXY_FROM` | private networks | Addresses of the proxies to trust when `TRUST_PROXY` is on |
| `ANONYMIZE_IP` | off | `true` keeps a shortened address (`203.0.113.0`), `mask` a masked one (`203.*.*.57`) |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | Days the audit log is kept, `0` keeps it forever |
| `SHARD_ID` | `main-node` | Name of this instance in the audit log, when several share one database |
| `DEMO_MODE` | off | `true` for a public demo: the admin cannot change settings, the logo, passwords or accounts |
| `BUILD_COMMIT` | none | Commit shown next to the version on the admin page, set at build time |

For the rest, and for details on each setting, OIDC, LDAP, S3 and reverse proxies, see the [upstream documentation](https://smp46.github.io/pingvin-share-x/). Almost all of it applies here. The `docs` folder in this repository is a copy of that site and is not published separately, but it does describe the variables above.

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

### The demo

Every merge to `main` is merged into the `demo` branch and deployed to the [demo](https://pingvin-share-vault-demo.fly.dev/) by [demo.yml](.github/workflows/demo.yml). A conflict or a failed build stops the run, and the demo keeps the version before. To try something on the demo before it is in `main`, push it to `demo`.

The demo never builds a release and never touches the published images.

### Releasing

From an up to date `main` with no local changes:

```bash
npm run release   # works out the next number, writes the changelog, commits and tags
git push origin HEAD
git push origin v2026.10.1
gh release create v2026.10.1 --repo dzaczek/pingvin-share-vault --generate-notes
```

`npm run release -- --dry-run` only prints the next number and the changelog. Publishing the GitHub release builds and pushes the Docker image.

## Translations

Translations come from the upstream [Crowdin project](https://crowdin.com/project/pingvin-share-x).

## Credits

Pingvin Share was created by [stonith404](https://github.com/stonith404/pingvin-share). Pingvin Share X is maintained by [smp46](https://github.com/smp46/pingvin-share-x). This fork builds on both.
