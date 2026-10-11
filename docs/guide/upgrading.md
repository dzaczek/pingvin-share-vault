# Upgrading

- [Before you upgrade](#before-you-upgrade)
- [Back up first](#back-up-first)
- [Upgrade a release image](#upgrade-a-release-image)
- [Upgrade a source build](#upgrade-a-source-build)
- [What happens on start](#what-happens-on-start)
- [Coming from smp46/pingvin-share-x](#coming-from-smp46pingvin-share-x)
- [Going back to an older version](#going-back-to-an-older-version)

## Before you upgrade

Read the release notes of every version between yours and the new one, in [CHANGELOG.md](../../CHANGELOG.md) or on the [releases page](https://github.com/dzaczek/pingvin-share-x/releases). The admin page shows your running version at the bottom and an Update tile when a newer release exists.

## Back up first

Stop the container so the SQLite database is not written to while you copy it:

```bash
docker compose stop pingvin-share-x
cp -a data data-backup-$(date +%Y%m%d)
docker compose start pingvin-share-x
```

What to back up depends on the storage you use:

| Storage | Database | Uploaded files |
|---|---|---|
| Local (default) | `data/pingvin-share.db` | `data/uploads/` |
| S3 | `data/pingvin-share.db` | the bucket, under the configured `bucketPath` |

Also keep `data/images` if you uploaded your own logo, and your `config.yaml` if you use one. With S3, back up the bucket with your provider's tools at the same moment as the database, otherwise the two can disagree about which files exist.

## Upgrade a release image

Change the tag in `docker-compose.yml` to the new release, then:

```bash
docker compose pull
docker compose up -d
```

## Upgrade a source build

```bash
git fetch --tags
git checkout <new release tag>   # or: git pull, to follow main
BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build
```

## What happens on start

Every start runs `prisma migrate deploy` and then updates the default settings, before the backend accepts requests. A migration only runs once. The health check gives the container 90 seconds to come up, so an outside monitor may see a few failed requests during an upgrade with migrations. Check the log for `All migrations have been successfully applied` or `No pending migrations to apply`.

Settings you changed in the admin page are kept. New settings appear with their default values.

## Coming from smp46/pingvin-share-x

Every database migration of upstream up to its 2.0.0 release exists in this fork under the same name, so a database from upstream 2.0.0 or older migrates forward when you start this image on it. This fork adds four migrations of its own:

| Migration | Adds |
|---|---|
| `20260810160000_add_share_scan_status` | the antivirus status per share |
| `20260811090000_add_share_access_log` | the access log |
| `20260820140000_add_share_blocked` | blocking a share |
| `20260823000000_datetime_integer_to_text` | rewrites dates stored by older releases into the text format the current Prisma version uses. Without it, the expiry job misreads old dates and deletes shares that should stay. |

To move over:

1. Back up as described above.
2. Replace the image in your `docker-compose.yml` with `ghcr.io/dzaczek/pingvin-share-x` and a tag, keep the volumes as they are.
3. Start it and check the log for the four migrations above.

A database from an upstream release newer than 2.0.0 may contain migrations this fork does not know. That case is not tested, ask in an [issue](https://github.com/dzaczek/pingvin-share-x/issues) before you try it.

## Going back to an older version

Migrations only go forward. An older image usually starts on a newer database as long as the extra columns are optional, but this is not tested for every pair of versions. Going back from this fork to upstream is not supported.

The supported way back is the backup: stop the container, restore `data` (and the bucket, with S3), and start the older image.
