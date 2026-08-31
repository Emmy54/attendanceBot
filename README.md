# AttendanceBot

A lightweight Node.js attendance automation tool that posts messages or reactions to Discord channels on a configurable schedule. It provides an interactive CLI for configuration and a background daemon (managed with PM2) that executes schedules with anti-detection jitter and simple typing simulation.

This README is written for collaborators: it explains the project's purpose, architecture, how to set up and run the code locally, how to contribute, and important security considerations.

Table of contents
- What this is
- Architecture & key files
- Quickstart (developer)
- Configuration (config.json)
- Running locally (daemon & one-shot)
- GitHub Actions / run-once usage
- Development workflow
- Testing
- Troubleshooting
- Contributing
- Security / self-bot warning
- License

What this is
-----------
AttendanceBot automates sending attendance messages (or emoji reactions) to Discord channels on a schedule. It is intended for personal / small-scale use where a user wants to automate periodic check-ins. The app supports recurring schedules, one-time calendar dates (which auto-disable after firing), per-server webhooks for notifications, and randomized jitter to reduce detection risk.

Stack
- Language: JavaScript (Node.js >= 18)
- Libraries: discord.js-selfbot-v13, node-cron, pm2
- CLI entry: `bin/cli.js`
- Daemon entry: `src/bot.js`

Architecture & key files
------------------------
```
attendanceBot/
├── bin/
│   ├── cli.js               # Interactive setup UI (creates config.json)
│   ├── install-service.js   # Installs background service (PM2 wrapper)
│   └── uninstall-service.js # Removes background service
├── src/
│   ├── bot.js               # Daemon: loads config, logs into Discord, registers cron jobs
│   ├── logger.js            # Small timestamped logger
│   ├── run-once.js          # (used by CI/workflows) run a single schedule and exit
│   └── engine/
│       └── worker.js        # Task execution: jitter, typing, send or react, webhooks
├── .github/workflows/      # Example GitHub Action(s) that demonstrate serverless run-once
├── package.json
└── README.md
```

How it fits together
- `bin/cli.js` is used by a human to create and edit `config.json` (profiles, schedules, global webhook).
- `src/bot.js` reads `config.json`, authenticates a Discord client using the saved token, and schedules jobs with `node-cron`.
- When a schedule fires, `src/engine/worker.js` executes the task: applies jitter, optionally simulates typing, sends a message or reacts, and posts a success/failure embed to the configured webhook.

Quickstart (developer)
----------------------
Clone, install, configure, and run the daemon locally:

```bash
# 1. clone
git clone https://github.com/Emmy54/attendanceBot.git
cd attendanceBot

# 2. install
npm install

# 3. configure (interactive)
npm start
# Follow the CLI prompts to provide a Discord token, add a server profile, and create schedules.

# 4. run the daemon locally (for development)
node src/bot.js

# For production background service (recommended):
npm run service:install   # installs and starts PM2-managed daemon
npm run service:status
npm run service:logs
```

Note: The CLI creates `config.json` in the repository root. This file contains your Discord token — never commit it to source control or push it to a public repo.

Configuration (config.json)
---------------------------
The CLI builds and persists `config.json`. Example structure (sensitive values redacted):

```json
{
  "globalToken": "REDACTED_DISCORD_TOKEN",
  "globalWebhookUrl": "https://discord.com/api/webhooks/....",
  "servers": [
    {
      "id": "...",
      "name": "Work Server",
      "channelId": "123456789012345678",
      "webhookUrl": "",
      "active": true,
      "schedules": [
        {
          "id": "...",
          "label": "09:00 AM (Weekdays)",
          "cron": "0 9 * * 1-5",
          "message": "Present",
          "maxJitterMinutes": 10,
          "active": true
        }
      ]
    }
  ]
}
```

Key fields collaborators should know:
- globalToken: the Discord user token used to authenticate the selfbot client
- globalWebhookUrl: optional webhook for success/failure notifications
- servers: array of server profiles (contains channelId and schedule list)
- schedule.type: when present and set to `ONCE`, schedule.runDate holds an ISO date. The daemon disables ONE-TIME schedules after they run.

Running locally and debugging
-----------------------------
- Run in foreground (dev): `node src/bot.js`
  - Useful for debugging; logs printed to stdout.
- Run one-off schedule (CI/workflow): `.github/workflows` contains an example workflow that runs `node src/run-once.js --profile=weekday-morning`. `run-once.js` is a small script (see `src/run-once.js`) that executes a specified profile once using env secrets.
- PM2-managed daemon (recommended for long-running usage):
  - Install / start: `npm run service:install`
  - Status: `npm run service:status`
  - Logs: `npm run service:logs`
  - Uninstall: `npm run service:uninstall`

GitHub Actions / serverless runs
--------------------------------
The repo includes a workflow example (`.github/workflows/attendance-weekday-morning.yml`) that demonstrates running the bot in a serverless environment (GitHub Actions) for a single scheduled message. The workflow uses secrets for `DISCORD_TOKEN`, `CHANNEL_ID`, and `WEBHOOK_URL`. The action runs a `run-once.js` script which should be present under `src/` and accept env vars.

Development workflow
--------------------
- Branching: use feature branches (e.g., `feat/schedule-cron-ui`, `fix/worker-timeout`).
- Pull Requests: open PRs against `main`; include a description, testing steps, and link to any relevant issue.
- Commit messages: use present-tense prefix (feat/fix/docs/chore) — e.g. `feat: add timezone option for schedules`.

Testing
-------
- There are no automated tests in the initial codebase. For contributors adding logic, add unit tests (Jest / Mocha) and document how to run them here.

Troubleshooting
---------------
- If `config.json` is missing: run `npm start` to create it.
- `Failed to log into Discord: Unauthorized`: token invalid/expired — update via CLI.
- `Channel not found` or permission errors: verify channel ID and that the user account has permission to send messages or react.
- `Rate limit` warnings: increase `maxJitterMinutes` or reduce frequency of schedules. Worker logs rate-limit events.

Contributing
------------
Contributions are welcome. Suggested steps:
1. Fork the repo and create a feature branch from `main`.
2. Make changes and include tests where appropriate.
3. Open a PR describing the change and how to test it.

Please avoid committing real Discord tokens or `config.json` files to the repo. Add `.gitignore` entries for local config if you add templates.

Security & ethics
-----------------
- This project uses a self-bot approach (a Discord client authenticated with a user token). Self-bots violate Discord's Terms of Service and may lead to account suspension or banning. This code is provided for educational/personal use — use at your own risk.
- Treat the Discord token like a password. Never share it. Never commit `config.json`.

Notes for maintainers
- Keep the `discord.js-selfbot-v13` dependency and Node engine in package.json up-to-date when required.
- Consider replacing self-bot usage with an official bot token + bot account if you plan public distribution — that will require changing API calls and the way the client logs in.

License
-------
The project is licensed under the MIT License (see LICENSE file).

Acknowledgements
----------------
Built by IamAdedo and dlazyHNTR. Maintained and adapted by contributors.


