# Troubleshooting

Check the container log first, most problems name themselves there:

```bash
docker compose logs --tail 200 pingvin-share-x
```

## The site answers 502 for a moment after a restart

On every start the container applies database migrations before the backend listens. During that time the built in proxy answers `502`, and an outside monitor may report the instance as down once. It is over when the log shows `Nest application successfully started`. If it never gets there, the error above that line is the cause.

## Every entry in the access log has the same IP address

That address is your reverse proxy. Set `TRUST_PROXY=true`, see [Installation](installation.md#behind-a-reverse-proxy), including when not to.

## Shares show "Failed" in the scan column

- **No ClamAV configured:** every share ends as failed, because no scan could run. Add ClamAV or ignore the column.
- **ClamAV was unreachable:** look for `ClamAV is active` in the log. The app retries the connection on the next scan, at most once a minute. Use the rescan button once ClamAV is back.
- **Large files:** clamd rejects streams above its size limits, about 25 MB by default. Raise `StreamMaxLength`, `MaxFileSize` and `MaxScanSize`, see [Installation](installation.md#clamav).

A failed scan leaves the files available, see [Administration](administration.md#antivirus-scanning).

## The Update tile does not appear

The admin page compares the running version with the newest published release of this repository on GitHub.

- No release newer than yours has been published, or it is marked as a prerelease.
- The browser cannot reach `api.github.com`, or GitHub's limit for anonymous requests was reached.

## The configuration page is read only

A `config.yaml` is mounted. Change the file and restart, or remove it to edit in the page again. See [Configuration](configuration.md#configyaml).

## Permission denied on the data folder

- Under Podman or Docker on a system with SELinux, keep the `:z` suffix on the volumes.
- The app runs as `PUID:PGID`, `1000:1000` by default, and takes ownership of the data folder on start. Set both to the owner you want.

## `docker compose up` with the repository's compose file builds for minutes

That file builds the image from source on purpose. To run a published release instead, use the image based example in [Installation](installation.md#run-a-release-image).

## Pulling the image fails with "denied" or "not found"

Check the [package list](https://github.com/dzaczek?tab=packages&repo_name=pingvin-share-x) for the image and its tags. If it shows none, no release image has been published yet, [build from source](installation.md#build-from-source). If the image is listed but pulling is denied, the package is still private, which is the default for a new package on GitHub.

## Still stuck

Search the [issues](https://github.com/dzaczek/pingvin-share-x/issues) or open one with the version from the bottom of the admin page, your installation method and the relevant log lines. For security problems, follow [SECURITY.md](../../SECURITY.md) instead.
