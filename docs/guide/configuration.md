# Configuration

- [Where settings live](#where-settings-live)
- [config.yaml](#configyaml)
- [Settings this fork adds](#settings-this-fork-adds)
- [Upstream documentation that still applies](#upstream-documentation-that-still-applies)

Environment variables, ports and volumes are covered in [Installation](installation.md#environment-variables).

## Where settings live

Settings are stored in the database and edited in the admin page under Configuration. That is the usual way.

Alternatively, a `config.yaml` file can set them. While such a file is mounted, the Configuration page is read only.

## config.yaml

Copy [config.example.yaml](../../config.example.yaml), keep only the keys you want to set, and mount it at `/opt/app/config.yaml`:

```yaml
    volumes:
      - "./config.yaml:/opt/app/config.yaml:ro"
```

The file is read once at startup. How it is applied:

- A key in the file overrides the value in the database.
- A key left out of the file keeps the value stored in the database, from the admin page or the defaults.
- `true`, `false` and numbers work with or without quotes.
- `initUser` creates an administrator on startup when `enabled: true`. Turn it off after the first start. It is only skipped when exactly one administrator exists, so with none or with two or more administrators startup tries to create the account again, and stops with an error if that email or username already exists.

The log line `Config.yaml is not set. Falling back to UI configuration.` means no file was found, which is normal without one.

## Settings this fork adds

All of them are in the admin page. The key is what you would use in `config.yaml`.

| Key | Default | Purpose |
|---|---|---|
| `general.showAuthButtons` | `true` | Shows sign in and sign up in the header on share and reverse share upload pages for visitors who are not signed in. Turn off when links go to people who have no account. |
| `general.detectLanguageFromBrowser` | `false` | Uses the browser's language for visitors who have not chosen one. |
| `share.warnAnonymousShares` | `true` | Warns before downloading a share that has no owner. See [Administration](administration.md#anonymous-shares). |
| `share.warnAnonymousSharesForLoggedInUsers` | `true` | Shows that warning to signed in users too. |
| `share.anonymousWarningMessagePl`, `...En`, `...De`, `...Fr`, `...It` | empty | Replaces the built in warning text for one language. |

## Upstream documentation that still applies

The [upstream documentation](https://smp46.github.io/pingvin-share-x/) describes features both projects share. These pages apply here as written, apart from the notes:

| Topic | Upstream page | Notes for this fork |
|---|---|---|
| General settings and environment variables | [Configuration](https://smp46.github.io/pingvin-share-x/setup/configuration) | Its `config.yaml` section is accurate on the read only page. How missing keys and unquoted values behave is described above. |
| OAuth and OpenID Connect | [OAuth 2 login](https://smp46.github.io/pingvin-share-x/setup/oauth2login) | Applies. The OpenID Connect discovery address may be the issuer URL or the full discovery URL. |
| S3 storage | [S3](https://smp46.github.io/pingvin-share-x/setup/s3) | Applies, including the CORS policy the bucket needs. Download all works with S3 here. |
| ClamAV | [Integrations](https://smp46.github.io/pingvin-share-x/setup/integrations) | Use `ghcr.io/dzaczek/pingvin-share-x` instead of the upstream image, and see [Installation](installation.md#clamav) for the size limits and [Administration](administration.md#antivirus-scanning) for the scan behaviour here. |
| Installation and upgrading | [Installation](https://smp46.github.io/pingvin-share-x/setup/installation) | **Does not apply.** It pulls upstream images. Use [Installation](installation.md) and [Upgrading](upgrading.md). |

The `docs` folder of this repository contains a copy of that upstream site, which is not published from here. The guides in `docs/guide` are the documentation of this fork.
