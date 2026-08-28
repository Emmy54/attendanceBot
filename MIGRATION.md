# Migration: PM2 daemon → GitHub Actions (serverless cron)

This replaces the always-on PM2 daemon ([src/bot.js](src/bot.js)) with
scheduled GitHub Actions that spin up, send **one** attendance action, and
exit. The interactive wizard ([bin/cli.js](bin/cli.js)) and the daemon path are
**left intact** — nothing here breaks the old flow; it just stops being needed.

---

## 1. Repository secrets to add

**Settings → Secrets and variables → Actions → New repository secret.**

| Secret name    | Value                                   | Notes                                                       |
| -------------- | --------------------------------------- | ----------------------------------------------------------- |
| `DISCORD_TOKEN`| Your Discord **user** token             | Never printed to logs; scrubbed from error text.            |
| `CHANNEL_ID`   | Target channel ID                       | The channel attendance posts to.                            |
| `WEBHOOK_URL`  | Discord webhook URL                     | Success **and** failure alerts. Optional but recommended.   |

These are the exact env-var names [src/run-once.js](src/run-once.js) reads. Each
workflow maps them in its `env:` block, so **one script serves every schedule**.

> **One account** → one `DISCORD_TOKEN` secret (your case).
> **Multiple accounts** → make e.g. `DISCORD_TOKEN_WORK`, `DISCORD_TOKEN_GAMING`
> and map the right one into `DISCORD_TOKEN` inside each workflow's `env:` block.
> Same pattern for per-server `CHANNEL_ID_*` / `WEBHOOK_URL_*`.

GitHub automatically masks secret values in logs, and `run-once.js` never prints
the token regardless (it lives only in the `Authorization` header and is
`redact()`-ed out of any error message).

---

## 2. The cron schedules (UTC conversion — shown work)

GitHub Actions cron is **always UTC**. **WAT = UTC+1, no daylight saving**
(fixed offset), so subtract 1 hour to get UTC. Neither time crosses midnight
when shifted, so the Mon–Fri day range is unchanged.

| Profile             | Local (WAT) | UTC   | Cron (`m h dom mon dow`) | Workflow file                                 |
| ------------------- | ----------- | ----- | ------------------------ | --------------------------------------------- |
| `weekday-morning`   | 09:35 Mon–Fri | 08:35 | `35 8 * * 1-5`         | `.github/workflows/attendance-weekday-morning.yml`   |
| `weekday-afternoon` | 15:05 Mon–Fri | 14:05 | `5 14 * * 1-5`         | `.github/workflows/attendance-weekday-afternoon.yml` |

`1-5` = Monday–Friday (`0`=Sun … `6`=Sat).

**DST note:** none for WAT, so these are stable year-round. If you ever move to a
DST-observing zone, a fixed UTC cron would drift ±1 h across DST boundaries;
you'd then keep two cron lines and swap them seasonally, or accept the shift.

Each workflow also has `workflow_dispatch:`, so you can trigger a run by hand
from the **Actions** tab (pick the workflow → **Run workflow**) for testing.

---

## 3. Private vs public repo

**Recommended: keep the repo private.**

- The token/channel/webhook are secrets, so they're masked either way — but on a
  **public** repo your **Actions run history and timing are visible to anyone**,
  which is exactly the kind of pattern data you don't want exposed for a
  ToS-gray automation.
- `profiles.json` **is** committed. Keep it **non-identifying**: it currently
  holds only a label, `MESSAGE`, jitter, and type. `"Present"` is generic. Don't
  put server names, invite links, or unique catchphrases there if you want to
  stay anonymous. Anything identifying can instead be moved into the `MESSAGE`
  **secret** and removed from `profiles.json`.
- Trade-off: **public repos get unlimited Actions minutes**; **private repos get
  2,000 free minutes/month** on the Free plan (see §8). If you need the free
  minutes and are fine with public run history, a public repo with a scrubbed
  `profiles.json` works — but private is the safer default.

---

## 4. One-time (ONCE) date schedules — stateless

There's no daemon to hold "already fired" in memory, so one-time dates are
handled **statelessly**:

1. Add a profile with `"type": "ONCE"` and a `"runDate": "YYYY-MM-DD"`:
   ```json
   "holiday-standup": {
     "label": "Holiday one-off",
     "attendanceType": "MESSAGE",
     "message": "Present",
     "maxJitterMinutes": 10,
     "type": "ONCE",
     "runDate": "2026-12-25"
   }
   ```
2. Give it a workflow whose cron is that exact date, e.g. `30 8 25 12 *`
   (08:30 UTC on Dec 25).

On every run, `run-once.js` compares `runDate` to **today's UTC date**. GitHub
fires a dated cron **every year**, but only the matching year actually sends —
all other years log `Not due — exiting cleanly` and exit 0. **Zero persisted
state.**

**Trade-off:** a pure date check does not stop a **manual re-run on the correct
day** from sending twice (the scheduled cron only fires once, so this only
matters if you re-dispatch by hand). If you need a hard "exactly once" guarantee:

> **Opt-in committed marker.** After a successful ONCE send, write a marker file
> (e.g. `.state/fired-<profile>.json`) and have a follow-up workflow step commit
> it back with the built-in `GITHUB_TOKEN` (needs `permissions: contents: write`);
> gate the send on that marker's absence. Cost: an extra commit per one-off, a
> write permission, and a small race window if two runs overlap (rare for cron).
> The stateless date check is simpler and correct for normal use, so it's the
> default — this is the escape hatch if you truly need it.

---

## 5. Deprecating the PM2 daemon

**Stop and remove the running daemon** on whatever box currently hosts it:

```bash
npm run service:uninstall      # removes the pm2 process
npx pm2 kill                   # optional: stop the pm2 core entirely
```

**Commands no longer needed** once you're on Actions:

| Old command                    | Status                                             |
| ------------------------------ | -------------------------------------------------- |
| `npm run service:install`      | ❌ not needed (Actions runs it)                    |
| `npm run service:uninstall`    | ⚠️ run once to tear down, then not needed          |
| `npm run service:status`       | ❌ replaced by the Actions run history             |
| `npm run service:logs`         | ❌ replaced by per-run logs + webhook alerts        |
| `npm run bot:daemon`           | ❌ the persistent daemon is retired                |
| pm2 boot autostart (README §🔄)| ❌ not needed                                       |

**Optional later cleanup (not done yet, to keep this change isolated):**

- Drop `pm2` from `dependencies` in [package.json](package.json) and remove the
  `service:*` / `bot:daemon` scripts.
- Delete [bin/install-service.js](bin/install-service.js) and
  [bin/uninstall-service.js](bin/uninstall-service.js).
- `config.json` is **not used** by the serverless path (it reads env +
  `profiles.json`). The wizard still writes it for the old daemon; leaving it
  alone is harmless. We can teach the wizard to emit workflow files later.

The existing [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
(GitHub Pages docs) is untouched and unrelated.

---

## 6. Known limitation: cron can fire late

GitHub Actions scheduled workflows are **best-effort**, queued on shared
infrastructure. During peak load a run can **start several minutes late**
(occasionally 10–15+), and very rarely be skipped. This is acceptable here
because:

- Attendance doesn't need to-the-second precision.
- The **anti-detection jitter already randomizes** the exact minute on purpose —
  so "posts at a slightly variable time" is a feature, not a regression.

If you ever need tighter timing, schedule the cron a few minutes early and let
jitter absorb the slack. Don't use Actions cron for anything that must be exact.

---

## 7. Local testing (before committing any workflow)

`run-once.js` has **no third-party runtime deps** (built-in `https` only), so you
can test one profile directly. Use `--dry-run` to validate token/channel/webhook
wiring **without posting anything**:

**PowerShell (Windows):**

```powershell
$env:DISCORD_TOKEN = "your-token"
$env:CHANNEL_ID    = "your-channel-id"
$env:WEBHOOK_URL   = "your-webhook-url"
node src/run-once.js --profile=weekday-morning --dry-run
```

**bash (Linux/macOS/Termux):**

```bash
DISCORD_TOKEN="your-token" CHANNEL_ID="your-channel-id" WEBHOOK_URL="your-webhook-url" \
  node src/run-once.js --profile=weekday-morning --dry-run
```

- `--dry-run` does the read-only Discord calls (proving your token + channel
  work) and sends a clearly-labelled **🧪 [DRY-RUN]** webhook, but **posts no
  message/reaction**.
- Remove `--dry-run` to actually post once.
- Non-zero exit + a red **🚨** webhook on any failure.

Only after a dry-run looks right do you need to add the secrets and let the
workflows run.

---

## 8. GitHub Actions minutes / cost

Each run **sleeps up to `MAX_JITTER_MINUTES`** (default 10) before posting, and
billing is by the minute:

```
2 runs/day × ~22 weekdays × ~10 min jitter  ≈  ~440 min/month
```

That's within the **2,000 free minutes/month** for private repos on the Free
plan. To cut usage, lower `MAX_JITTER_MINUTES` in each workflow's `env:` block
(e.g. `"5"`). Public repos bill nothing for Actions.

---

## 9. Honest caveat: cloud IPs and bans

GitHub Actions runs from **datacenter IP ranges**, and Discord flags logins/
actions from cloud IPs **more aggressively** than residential ones. Moving a
self-bot to Actions can *increase* the chance the account is locked — the
opposite of "reliable attendance." If that risk matters to you, a small
always-on residential host (or the Termux path the README already documents)
keeps the same one-shot script on a residential IP. The code is identical; only
where it runs changes.
