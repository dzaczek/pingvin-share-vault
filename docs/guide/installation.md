# Installation

Pingvin Share X runs as a single container. Inside it, a small Caddy server on port `3000` routes `/api` to the backend and everything else to the web app. ClamAV and an external reverse proxy are optional.

- [Choose an installation method](#choose-an-installation-method)
- [Run a release image](#run-a-release-image)
- [Build from source](#build-from-source)
- [First start](#first-start)
- [Data and volumes](#data-and-volumes)
- [Environment variables](#environment-variables)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [ClamAV](#clamav)
- [Podman and SELinux](#podman-and-selinux)

## Choose an installation method

| | Release image | Build from source |
|---|---|---|
| What you run | A published release, as tested and tagged | Whatever is on the branch you check out, including unreleased changes |
| Needs | Docker or Podman | Docker or Podman, the repository, and some minutes and memory for the build |
| Update | Pull a newer tag | `git pull` and rebuild |

Use the release image unless you want unreleased changes or need to patch the code.

## Run a release image

Images are published to the GitHub Container Registry as `ghcr.io/dzaczek/pingvin-share-x` when a release is published. The [package list](https://github.com/dzaczek?tab=packages&repo_name=pingvin-share-x) shows the image and its tags once one has been published. If it shows none yet, [build from source](#build-from-source) instead.

Each release gets these tags. Release `2026.10.1` is used as an example:

| Tag | Points to |
|---|---|
| `v2026.10.1` | exactly that release |
| `v2026.10` | the newest release of October 2026 |
| `v2026` | the newest release of 2026 |
| `latest` | the newest release that is not marked as a prerelease |
| `beta` | the newest prerelease, if there ever is one |

Images are built for `linux/amd64` and `linux/arm64`. Pin an exact tag in production, so an update happens when you decide.

Create a `docker-compose.yml`:

```yaml
services:
  pingvin-share-x:
    image: ghcr.io/dzaczek/pingvin-share-x:latest # pin an exact tag in production
    container_name: pingvin-share-x
    restart: unless-stopped
    ports:
      - 3000:3000
    environment:
      - TRUST_PROXY=false # see "Behind a reverse proxy" before changing this
    volumes:
      - "./data:/opt/app/backend/data:rw,z"
      - "./data/images:/opt/app/frontend/public/img:rw,z"
```

Start it:

```bash
docker compose up -d
```

## Build from source

The `docker-compose.yml` in the repository builds the image from the checked out source. It does not pull an image, so the file is not useful on its own.

```bash
git clone https://github.com/dzaczek/pingvin-share-x.git
cd pingvin-share-x
git checkout v2026.10.0   # example: any release tag, or stay on main for unreleased changes
BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build
```

`BUILD_COMMIT` is optional. When set, the admin page shows the first seven characters of that commit next to the version, which tells two builds of the same version apart.

The build needs a few minutes and a couple of GB of free disk space for the intermediate stages.

## First start

1. Wait for the container to report healthy (`docker compose ps`). On every start it runs the database migrations and updates the default settings before the backend answers, the health check allows 90 seconds for that.
2. Open `http://localhost:3000`.
3. Create an account. **The first account created on an empty database becomes the administrator.**

Registration is open by default (`security.allowRegistration`). Close it in the admin page under Configuration if only invited users should get accounts.

## Data and volumes

| Path in the container | Holds | Keep it |
|---|---|---|
| `/opt/app/backend/data` | the SQLite database `pingvin-share.db`, and the uploaded files under `uploads/` when local storage is used | yes, this is all your data |
| `/opt/app/frontend/public/img` | the logo and icons uploaded in the admin page | yes, or the default logo returns |

With S3 storage, uploaded files live in the bucket, but the database stays in `/opt/app/backend/data`. Back up both, see [Upgrading](upgrading.md#back-up-first).

On start the container changes the owner of both paths to `PUID:PGID`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `TRUST_PROXY` | `false` | Trust the `X-Forwarded-For` header to find the client address. See below. |
| `PUID`, `PGID` | `1000` | User and group the app runs as, and that own the data paths. |
| `CADDY_DISABLED` | `false` | Skip the built in Caddy. Your own proxy must then route `/api/*` to port `8080` and everything else to port `3333`, like [reverse-proxy/Caddyfile](../../reverse-proxy/Caddyfile). |
| `CLAMAV_HOST` | `clamav` in Docker | Host name of the ClamAV daemon. |
| `CLAMAV_PORT` | `3310` | Port of the ClamAV daemon. |
| `CONFIG_FILE` | `../config.yaml`, which is `/opt/app/config.yaml` in the container | Optional settings file, see [Configuration](configuration.md#configyaml). |
| `DISABLE_RATE_LIMIT` | `false` | Turns off the request rate limits. Only for running the integration tests on a local instance, never on an instance others can reach. |

`BUILD_COMMIT` is a build argument, not a runtime variable, see [Build from source](#build-from-source).

## Behind a reverse proxy

Put Pingvin Share X behind your own proxy (Caddy, nginx, Traefik and so on) to serve it over HTTPS. Then:

- Set `general.appUrl` in the admin page to the public address. Links in mails and the OAuth redirect addresses are built from it.
- Set `TRUST_PROXY=true`. Without it, the access log records the address of your proxy for every visitor.
- **Only set `TRUST_PROXY=true` when port `3000` is reachable from your proxy alone.** The built in Caddy then trusts `X-Forwarded-For` from any sender, so a client that reaches the port directly could write any address into the access log.
- Allow large request bodies and long timeouts on the proxy if you share large files.

## ClamAV

ClamAV scans every completed share. To run it next to the app, add a service and let the app wait for it:

```yaml
services:
  pingvin-share-x:
    # ... as above
    depends_on:
      clamav:
        condition: service_healthy

  clamav:
    image: clamav/clamav-debian:latest
    restart: unless-stopped
    environment:
      # clamd rejects streams above about 25 MB by default, raise the limits
      # to at least the largest share you allow
      - CLAMD_CONF_StreamMaxLength=2000M
      - CLAMD_CONF_MaxFileSize=2000M
      - CLAMD_CONF_MaxScanSize=2000M
    volumes:
      - "clamav-db:/var/lib/clamav"

volumes:
  clamav-db:
```

ClamAV needs a lot of memory, see its [requirements](https://docs.clamav.net/manual/Installing/Docker.html#memory-ram-requirements). The app log shows `ClamAV is active` once it is connected. If ClamAV runs elsewhere, set `CLAMAV_HOST` and `CLAMAV_PORT` instead.

How scanning behaves, including its limits, is described in [Administration](administration.md#antivirus-scanning).

## Podman and SELinux

The image runs under Podman as well. Keep the `:z` suffix on the volumes on systems with SELinux, without it the container cannot read or write its data and stops with permission errors.
