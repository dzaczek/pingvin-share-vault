# Administration

What this fork adds for the people who run an instance. Everything on this page is for administrators unless it says otherwise.

- [Share list](#share-list)
- [Blocking a share](#blocking-a-share)
- [Access log](#access-log)
- [Looking things up on VirusTotal and ipinfo.io](#looking-things-up-on-virustotal-and-ipinfoio)
- [Antivirus scanning](#antivirus-scanning)
- [Anonymous shares](#anonymous-shares)
- [Languages](#languages)
- [Version and updates](#version-and-updates)

## Share list

Admin page, Shares. The table lists every share on the instance.

| Feature | How it works |
|---|---|
| Search | Matches the share ID, its name and the creator's username. |
| Date filter | Quick ranges from the last 15 minutes to the last 7 days, "older than 7 days", or a custom range by creation date. |
| Sorting | By created, ID, scan status, name, creator, visitors, size or expiry. Newest first by default. |
| Bulk delete | Tick shares and delete them together. They are deleted one after the other. A share that is already gone counts as deleted, any other failure is reported with how many succeeded. |
| Auto refresh | Reloads the list every 10 seconds, 30 seconds, 1 minute or 5 minutes, without resetting your filters. |
| Long lists | The page loads all shares once and shows them 50 at a time as you scroll. Search, filters and sorting run in the browser. |

Each row also shows the scan status, a lock when the share is blocked, and a "removed" badge with the reason when ClamAV deleted its files.

**Limit:** because the whole list is loaded into the browser, very large instances (many thousands of shares) make the first load and every auto refresh heavier.

## Blocking a share

Blocking hides a share without deleting it, so its files stay available for an investigation.

- Use the lock button in the share list, optionally with a reason. The reason is shown on hover.
- For everyone except administrators, a blocked share behaves as if it did not exist: the share page and its files answer "not found", and its owner cannot change or delete it.
- Administrators can still open the share and download the files.
- The expiry job and the cleanup of unfinished uploads skip blocked shares. **A blocked share keeps its files until you unblock or delete it**, so blocked shares keep using disk space.
- Unblocking restores the share as it was. If its expiry date passed in the meantime, the next expiry run removes it.

## Access log

The share information window (the info button in the share list) shows who created the share and who opened it.

- Two events are recorded: `CREATED`, and `VIEWED` when a visitor opens the share or downloads a file directly by its link.
- Entries are grouped by IP address and event, with a count and the first and last time seen. The newest 200 groups are shown, together with the total number of events.
- Only administrators can see the access log.
- The log is deleted together with its share.

**The addresses are only as good as your proxy setup.** Behind a reverse proxy, set `TRUST_PROXY=true`, or every entry shows the proxy's address. See [Installation](installation.md#behind-a-reverse-proxy) for the security side of that setting.

## Looking things up on VirusTotal and ipinfo.io

These are links, not integrations. Nothing is sent anywhere until you click, and then only to your own browser's new tab.

| Where | What happens when you click |
|---|---|
| Access log, next to each IP | Opens `ipinfo.io/<ip>` or the VirusTotal page of that IP address. |
| Share page, next to each file (administrators only) | The server reads the file and calculates its SHA256, then your browser opens the VirusTotal page of that hash. |

**The file itself is never uploaded to VirusTotal.** VirusTotal only shows a result if someone has submitted the same file before. "Not found" there means unknown, not clean. To have a file analysed, you would have to upload it to VirusTotal yourself, which makes it available to VirusTotal's partners, so think about the content first.

Calculating the hash reads the whole file, from disk or from S3. The request is limited to 20 per minute.

## Antivirus scanning

With ClamAV configured (see [Installation](installation.md#clamav)), every share is scanned in the background after its upload completes.

| Status | Meaning |
|---|---|
| Pending | Waiting for the scan, or a rescan was requested. |
| Clean | Every file was scanned and nothing was found. |
| Infected | ClamAV found something. All files of the share were deleted, the share stays in the list with the reason. |
| Failed | At least one file could not be scanned. |

How it copes with problems:

- Each file is tried up to three times, three seconds apart, before it counts as failed. A ClamAV restart during a scan therefore does not end as "clean".
- If ClamAV cannot be reached, the app tries to connect again on the next scan, at most once a minute, instead of giving up.
- A single scan may take up to five minutes before it times out. ClamAV's own size limits still apply, raise them as shown in the installation guide or large files fail.
- The rescan button in the share list scans a share again, for example after ClamAV was down.

**Limits to know:**

- **Files can be downloaded while the scan is pending.** Scanning does not hold back a share.
- **A failed scan does not remove or block anything.** The files stay available. Check failed shares and rescan them.
- **Without ClamAV, every share ends as "Failed"**, because no scan could run. That status is not a sign of a problem with the share.

## Anonymous shares

An anonymous share is one without an owner: created while signed out (if `security.allowUnauthenticatedShares` is on), or uploaded by a guest through a reverse share link.

**Download warning.** The share page shows a warning before download that the sender is not known, and the download button only works after a five second countdown. Settings, under Configuration, Share:

| Setting | Default | Effect |
|---|---|---|
| `share.warnAnonymousShares` | on | Shows the warning. |
| `share.warnAnonymousSharesForLoggedInUsers` | on | Also shows it to signed in visitors. |
| Custom warning message, per language | empty | Replaces the built in text for Polish, English, German, French or Italian. Empty keeps the built in translation. |

The warning is part of the page. A direct file link does not show it, so treat it as guidance for people, not as access control.

**Locked after upload.** While an anonymous share is still uploading, anyone allowed to upload can add or remove its files, as there is no owner to check. Once the upload is complete, nobody can reopen it or remove single files, administrators included. Administrators can still change its settings or delete the whole share.

## Languages

- 34 languages are included, most from the upstream [Crowdin project](https://crowdin.com/project/pingvin-share-x), to different degrees.
- A text missing in a language falls back to English instead of showing an empty space.
- `general.detectLanguageFromBrowser` (off by default) uses the browser's language for visitors who have not picked one. Otherwise the default language applies, and every user can choose their own.
- The Polish translation is maintained in this repository. For release 2026.10.1 it covers every text of the English file, and a test checks that each Polish text keeps the placeholders of the English one.

## Version and updates

The bottom of the admin page shows the running version, and the commit when the image was built with `BUILD_COMMIT`.

When you open the admin page, your browser asks the GitHub API for the newest release of `dzaczek/pingvin-share-x`. If it is newer than the running version, an Update tile links to it.

- Drafts and prereleases are not offered.
- The request goes from your browser to `api.github.com`. If your network blocks that, or GitHub's limit for anonymous requests is reached, no tile appears and nothing else breaks.
- Releases of the original project are not checked. See [Releases](releases.md) for how versions are numbered.
