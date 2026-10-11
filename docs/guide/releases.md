# Releases

- [Version numbers](#version-numbers)
- [What a release contains](#what-a-release-contains)
- [Making a release](#making-a-release)
- [How the changelog is written](#how-the-changelog-is-written)
- [Container images](#container-images)

## Version numbers

Releases of this fork are numbered by date: `YEAR.MONTH.N`, tagged `vYEAR.MONTH.N`.

| Rule | Example |
|---|---|
| The month has no leading zero, because semantic versioning does not allow one. | January 2027 is `2027.1.0`, never `2027.01.0` |
| `N` starts at `0` for the first release of a month. | `2026.10.0` |
| Each further release in the same month adds one to the highest `N` among the existing tags of that month. | `2026.10.1`, then `2026.10.2` |
| A new month starts at `0` again. | `2026.11.0` |
| The date is the local date of the machine that runs the release. | |

The numbers are still valid semantic versions, so tools that compare versions keep working, and every date based version sorts above the old `2.0.0-beta.1`.

**This fork's versions and upstream's are separate.** The original project keeps numbering `2.x`. Its tags, such as `v2.0.0`, are visible in this repository's history since the [upstream sync](https://github.com/dzaczek/pingvin-share-x/pull/167), but a four digit year tells the two apart and the release tooling ignores upstream's tags.

## What a release contains

A release is a commit `release: v<version>` that:

- sets the version in `package.json` and `package-lock.json` of the repository root, `backend` and `frontend`;
- adds a section to the top of [CHANGELOG.md](../../CHANGELOG.md);

and an annotated tag `v<version>` on that commit. The running app shows the version from `frontend/package.json` at the bottom of the admin page.

A commit on `main` that is not tagged is not a release. An image built from it shows the version of the last release, and the commit if it was built with `BUILD_COMMIT`.

## Making a release

From an up to date `main` with no local changes, and with the `upstream` remote set up (`git remote add upstream https://github.com/smp46/pingvin-share-x.git`):

```bash
npm run release -- --dry-run   # fetches tags, prints the next version and the changelog section, changes no files
npm run release                # writes the version and changelog, commits and tags locally
```

`npm run release`:

1. fetches tags from `origin`, and from `upstream` when that remote exists;
2. works out the next version from the date and the existing tags;
3. stops if the working tree has uncommitted changes;
4. sets the version in the three packages with `npm version`, writes the changelog section, commits and tags.

It does not push and does not publish. When the output looks right:

```bash
git push origin HEAD
git push origin v<version>
gh release create v<version> --repo dzaczek/pingvin-share-x --generate-notes
```

When `main` only accepts pull requests, push the release commit on a branch instead, open a pull request, merge it with a merge commit (not squash or rebase, so the tagged commit ends up on `main`), and then push the tag and publish the release.

Publishing the GitHub release is the step that matters to users: it starts the image build below, and it is what the Update tile in the admin page looks for.

## How the changelog is written

The release script writes the section itself:

- It lists commits since the newest `vYEAR.MONTH.N` tag that is part of the current branch, leaving out merge commits.
- Commits that also exist on the `upstream` remote are left out, so upstream's history does not show up as this fork's. Without that remote, the script warns that upstream commits may appear.
- Only [Conventional Commits](https://www.conventionalcommits.org) of these types are listed: `feat` under Features, `fix` under Bug Fixes, `perf` under Performance Improvements, `revert` under Reverts. A `!` after the type, as in `feat!:`, also lists the commit under Breaking Changes.
- Other types, such as `docs`, `test`, `ci` and `chore`, are left out. A release with only those says "Maintenance only, no user facing changes."

## Container images

Publishing a release runs the `Build and Push Docker Image` workflow. It builds `linux/amd64` and `linux/arm64` images with the release commit stamped in, and pushes them to `ghcr.io/dzaczek/pingvin-share-x` with these tags, for a release `X.Y.Z`:

- `vX.Y.Z`, `vX.Y` and `vX`;
- `latest` for a normal release, or `beta` for a release marked as a prerelease.

The workflow also pushes to Docker Hub as `dzaczek/pingvin-share-x`, but only when the repository has `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets. A manual run of the workflow builds the current branch and tags it `latest`.
