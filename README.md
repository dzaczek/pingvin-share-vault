<div align="center">
  <img src="https://github.com/user-attachments/assets/b5bc0c1e-5641-4106-b322-a1b0f5448b0f" width="60"/>

  <h1>Pingvin Share X</h1>

  <p>Self hosted file sharing with the admin tools to run it for an organisation.</p>

[![Release](https://img.shields.io/github/v/release/dzaczek/pingvin-share-x)](https://github.com/dzaczek/pingvin-share-x/releases/latest)
[![CI](https://github.com/dzaczek/pingvin-share-x/actions/workflows/ci.yml/badge.svg)](https://github.com/dzaczek/pingvin-share-x/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dzaczek/pingvin-share-x)](LICENSE)

</div>

Pingvin Share X lets people share files through a link, and lets outside people send files in through an upload link. It is an alternative to services like WeTransfer that you run on your own server.

This repository is a fork that focuses on running such an instance day to day: finding and cleaning up shares, seeing who opened what, keeping a suspicious share for investigation instead of deleting it, and knowing what the antivirus scan actually found.

**Lineage:** [stonith404/pingvin-share](https://github.com/stonith404/pingvin-share), the original project → [smp46/pingvin-share-x](https://github.com/smp46/pingvin-share-x), which continued it → **dzaczek/pingvin-share-x**, this fork. Changes from smp46/pingvin-share-x up to its release 2.0.0 have been reviewed and ported where they fit. The few left out are listed in the [sync commit](https://github.com/dzaczek/pingvin-share-x/commit/4c61e8f4).

## Features

Shared with the projects it comes from:

- Share files and folders through a link, with expiry dates, visitor limits, passwords and email recipients
- Reverse shares: upload links for people without an account
- Size limits per share and storage quotas per user, both configurable
- Sign in with a password, OpenID Connect, Microsoft Entra ID, Google, GitHub, Discord or LDAP
- Files on local disk or in S3
- Virus scanning with ClamAV
- 34 languages

## What this fork adds

| | smp46/pingvin-share-x 2.0.0 | This fork |
|---|---|---|
| Admin share list | plain list | search, date filters, sorting, bulk delete, auto refresh |
| Suspicious share | delete it | block it: hidden from everyone but admins, files kept |
| Who opened a share | not recorded | access log per share, grouped by IP address |
| Antivirus result | infected files are removed | status per share (clean, infected, failed), rescan, retries when ClamAV restarts |
| Checking a file or an address | not available | one click lookups on VirusTotal and ipinfo.io, without uploading anything |
| Shares without an owner | no warning, editable after upload | download warning, editable per language, and locked once uploaded |
| Admin page | version, update notice for upstream releases | version and build commit, update notice for this fork's releases |
| Language | set per user or by default | optional detection from the browser, Polish translation maintained here |
| Version numbers | `2.x` | by date, `2026.10.1` and so on |

How each of these works, and their limits, is described in [Administration](docs/guide/administration.md).

## Quick start

You need Docker with Compose, or Podman. There are two ways to run it:

- **A release image**, if the [package list](https://github.com/dzaczek?tab=packages&repo_name=pingvin-share-x) shows `pingvin-share-x`. Images are published there with each release.
- **A build from source**, if no image is listed yet or you want unreleased changes.

**Release image.** Create a `docker-compose.yml`:

```yaml
services:
  pingvin-share-x:
    image: ghcr.io/dzaczek/pingvin-share-x:latest # pin an exact tag in production
    container_name: pingvin-share-x
    restart: unless-stopped
    ports:
      - 3000:3000
    volumes:
      - "./data:/opt/app/backend/data:rw,z"
      - "./data/images:/opt/app/frontend/public/img:rw,z"
```

```bash
docker compose up -d
```

**Build from source.** The repository's own `docker-compose.yml` builds the image:

```bash
git clone https://github.com/dzaczek/pingvin-share-x.git
cd pingvin-share-x
BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build
```

Either way, open `http://localhost:3000` once the container is healthy and create an account. **The first account becomes the administrator.**

The database and, with local storage, the uploaded files live in `./data`. Back it up before every upgrade, see [Upgrading](docs/guide/upgrading.md).

Next steps: [run it behind a reverse proxy](docs/guide/installation.md#behind-a-reverse-proxy), [add ClamAV](docs/guide/installation.md#clamav), [configure it](docs/guide/configuration.md).

## Documentation

| | |
|---|---|
| [Installation](docs/guide/installation.md) | release image or source build, volumes, environment variables, reverse proxy, ClamAV |
| [Upgrading](docs/guide/upgrading.md) | backups for local and S3 storage, migrations, moving over from smp46/pingvin-share-x |
| [Configuration](docs/guide/configuration.md) | `config.yaml`, the settings this fork adds, which upstream pages still apply |
| [Administration](docs/guide/administration.md) | share list, blocking, access log, lookups, antivirus scanning, anonymous shares |
| [Releases](docs/guide/releases.md) | version numbers, release process, container image tags |
| [Troubleshooting](docs/guide/troubleshooting.md) | common problems and what to check |
| [Development](docs/guide/development.md) | local setup, tests, pull requests |

For OAuth, S3 and other features both projects share, the [upstream documentation](https://smp46.github.io/pingvin-share-x/) still applies, with the differences noted in [Configuration](docs/guide/configuration.md#upstream-documentation-that-still-applies).

## Versions

Releases are numbered `YEAR.MONTH.N`: `2026.10.0` is the first release of October 2026, `2026.10.1` the next one that month. The admin page shows the running version and offers an update when a newer release of this repository is published. The [changelog](CHANGELOG.md) lists what changed. Details are in [Releases](docs/guide/releases.md).

## Contributing

Issues and pull requests are welcome. The [development guide](docs/guide/development.md) covers the local setup and the tests. AI tools are allowed, see the [AI Usage Policy](AI_USAGE_POLICY.md) for what that asks of you.

Translations come from the upstream [Crowdin project](https://crowdin.com/project/pingvin-share-x). The Polish translation is maintained in this repository.

## Security

Please report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Credits and license

Pingvin Share was created by [Elias Schneider (stonith404)](https://github.com/stonith404/pingvin-share). Pingvin Share X is maintained by [smp46](https://github.com/smp46/pingvin-share-x). This fork builds on both, and their history is kept in this repository.

Released under the [BSD 2-Clause License](LICENSE), copyright (c) 2022 Elias Schneider.
