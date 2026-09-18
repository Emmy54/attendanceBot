# AttendanceBot

AttendanceBot is a Node.js utility that sends a Discord attendance message, or adds a reaction to a Discord message, from a one-shot GitHub Actions run. This guide explains how to deploy the serverless version and trigger it on a schedule with [cron-job.org](https://cron-job.org/).

> **Important:** The serverless runner in this repository authenticates with a Discord **user token** through `discord.js-selfbot-v13`. Discord prohibits self-bots and may suspend or terminate accounts that use them. Use this project only if you understand and accept that risk, and consider using an official Discord bot account for a compliant implementation.

## How the serverless setup works

The serverless version does not keep a Node.js process running. Each scheduled execution follows this path:

1. **cron-job.org** sends an HTTP `POST` request to GitHub's workflow-dispatch API.
2. GitHub starts the selected Actions workflow on a temporary Ubuntu runner.
3. The workflow checks out the repository and installs dependencies with `npm ci`.
4. `src/run-once.js` reads the required values from GitHub Actions secrets and the selected profile in `profiles.json`.
5. The script waits for the configured random delay, sends one message or reaction through Discord's REST API, optionally posts a result to a Discord webhook, and exits.
6. The temporary runner is discarded when the workflow finishes.

The repository currently includes these serverless workflows:

| Workflow file | Profile | Intended time in the workflow comments |
| --- | --- | --- |
| `.github/workflows/attendance-weekday-morning.yml` | `weekday-morning` | 09:35 WAT, Monday–Friday |
| `.github/workflows/attendance-weekday-afternoon.yml` | `weekday-afternoon` | 15:05 WAT, Monday–Friday |

The workflows use `workflow_dispatch`, so cron-job.org is the external scheduler. GitHub Actions is the execution environment.

## Requirements

You need:

- A GitHub account with access to this repository.
- A Discord channel ID.
- A Discord user token, if you proceed with the self-bot implementation.
- A Discord webhook URL if you want success and failure notifications.
- A [cron-job.org](https://cron-job.org/) account.
- Node.js 18 or newer only if you want to test the runner locally. GitHub Actions uses Node.js 20.

## 1. Create a GitHub token for cron-job.org

cron-job.org needs permission to request a workflow dispatch. Do not put this token in the URL. Send it as an HTTP header instead.

1. Open **GitHub → Settings → Developer settings → Personal access tokens**.
2. Create a **fine-grained personal access token**.
3. Limit the token to this repository only.
4. Grant the minimum repository permission needed to dispatch workflows: **Actions: Read and write**. If GitHub's token form also requires repository metadata, leave the automatically selected metadata permission enabled.
5. Set an expiration date and copy the token immediately. GitHub will not show it again.

Use a short-lived token where practical and rotate it before it expires. If the token is exposed, revoke it immediately and create a replacement.

## 2. Add the GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add the following secrets:

| Secret | Required | Value |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | The Discord user token used by the runner. Never commit this value. |
| `CHANNEL_ID` | Yes | The numeric ID of the Discord channel where the action should run. |
| `WEBHOOK_URL` | No | A Discord webhook URL for success and failure notifications. Leave it unset if notifications are not needed. |

The workflow passes these values to `src/run-once.js` through environment variables. They are not stored in `profiles.json` or printed in the normal logs.

### Finding a channel ID

In Discord, enable **Developer Mode** under **User Settings → Advanced**, then right-click the target channel and choose **Copy Channel ID**. Verify that the account represented by `DISCORD_TOKEN` can access the channel.

## 3. Review the attendance profile

The one-shot runner combines environment variables with a profile from `profiles.json`. Environment variables take precedence over profile values.

The default profiles are:

```json
{
  "weekday-morning": {
    "label": "Weekday 09:35 WAT",
    "attendanceType": "MESSAGE",
    "message": "Present",
    "maxJitterMinutes": 10,
    "type": "RECURRING"
  },
  "weekday-afternoon": {
    "label": "Weekday 15:05 WAT",
    "attendanceType": "MESSAGE",
    "message": "Present",
    "maxJitterMinutes": 10,
    "type": "RECURRING"
  }
}
```

The committed workflows explicitly set `MAX_JITTER_MINUTES` to `5`, so that workflow value overrides the profile's `10` minutes.

To change the text, edit the relevant profile's `message` and commit the change. To create another schedule:

1. Add a new profile to `profiles.json`.
2. Copy one of the existing workflow files.
3. Change the workflow name and the `--profile=...` argument.
4. Commit and push the new workflow.
5. Create a separate cron-job.org job for the new workflow.

### Sending a reaction instead of a message

Set the profile's `attendanceType` to `REACTION` and specify an emoji:

```json
{
  "weekday-reaction": {
    "label": "Weekday reaction",
    "attendanceType": "REACTION",
    "emoji": "✅",
    "maxJitterMinutes": 5,
    "type": "RECURRING"
  }
}
```

If `targetMessageId` is omitted, the runner reacts to the most recent message it can fetch in the channel. To target a specific message, add its ID:

```json
"targetMessageId": "123456789012345678"
```

## 4. Test the workflow manually

Before adding cron-job.org, test the workflow from GitHub:

1. Open the repository's **Actions** tab.
2. Select **Attendance - Weekday Morning** or **Attendance - Weekday Afternoon**.
3. Click **Run workflow**.
4. Select the `main` branch and start the workflow.
5. Open the running job and inspect the logs.

A successful run should install dependencies and end with a message similar to:

```text
✅ Message posted (id ...).
🏁 Done.
```

If the workflow fails, fix the problem before configuring the external scheduler. Common causes are an invalid token, a wrong channel ID, missing channel access, or a missing secret.

### Optional dry run

The runner supports a local dry run. It validates the configuration and reports what it would do without sending the attendance action:

```bash
npm ci
DISCORD_TOKEN='your-token' CHANNEL_ID='your-channel-id' \
  node src/run-once.js --profile=weekday-morning --dry-run
```

Do not paste real tokens into shell history on a shared machine. GitHub Actions is the recommended place for the real secrets.

## 5. Create the cron-job.org request

Create one cron-job.org job per GitHub Actions workflow.

### Request URL

For the morning workflow, use:

```text
https://api.github.com/repos/Emmy54/attendanceBot/actions/workflows/attendance-weekday-morning.yml/dispatches
```

For the afternoon workflow, use:

```text
https://api.github.com/repos/Emmy54/attendanceBot/actions/workflows/attendance-weekday-afternoon.yml/dispatches
```

If you use a fork, replace `Emmy54/attendanceBot` with your own `OWNER/REPOSITORY` value. Keep the workflow filename, including `.yml`, exactly as it appears in `.github/workflows/`.

### HTTP method and headers

Configure the job as follows:

- **Method:** `POST`
- **Header:** `Accept: application/vnd.github+json`
- **Header:** `Authorization: Bearer YOUR_GITHUB_TOKEN`
- **Header:** `X-GitHub-Api-Version: 2022-11-28`
- **Header:** `Content-Type: application/json`
- **Request body:**

```json
{
  "ref": "main"
}
```

Replace `YOUR_GITHUB_TOKEN` with the token created in step 1. If cron-job.org provides a secret-variable feature, store the token there instead of typing it directly into a job definition. Never put the token in the request URL or JSON body.

### Schedule and timezone

The workflow comments use WAT, which is UTC+1. GitHub Actions dispatches are accepted at any time; cron-job.org determines when the request is sent.

For the schedules currently documented in this repository, the corresponding UTC times are:

| Attendance | WAT | UTC | Days |
| --- | ---: | ---: | --- |
| Morning | 09:35 | 08:35 | Monday–Friday |
| Afternoon | 15:05 | 14:05 | Monday–Friday |

Choose the timezone explicitly in cron-job.org. If you choose UTC, schedule the morning job for `08:35` and the afternoon job for `14:05`, Monday through Friday. If you choose a local timezone instead, verify whether daylight-saving changes apply and adjust the schedule as needed.

The workflow itself adds up to five minutes of random delay because it sets `MAX_JITTER_MINUTES: "5"`. The GitHub Actions job timeout is 20 minutes to allow for dependency installation and that delay.

## 6. Verify cron-job.org and GitHub together

After saving the cron-job.org job:

1. Use cron-job.org's **Run now** function once.
2. Confirm that the HTTP response is successful. A successful workflow-dispatch request normally returns HTTP `204 No Content`.
3. Open GitHub **Actions** and confirm that a new run appears for the expected workflow.
4. Confirm that Discord receives the message or reaction.
5. If `WEBHOOK_URL` is configured, check for the success embed.

Do not run several manual tests at once. Each dispatch creates a separate GitHub Actions run, and the workflow concurrency setting prevents overlapping runs from being cancelled while they are sending.

## Configuration reference

`src/run-once.js` supports the following environment variables:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord user token. Kept in GitHub Actions secrets. |
| `CHANNEL_ID` | Yes | Target Discord channel ID. Kept in GitHub Actions secrets. |
| `WEBHOOK_URL` | No | Discord webhook for success and failure embeds. |
| `ATTENDANCE_TYPE` | No | `MESSAGE` or `REACTION`. |
| `MESSAGE` | No | Message text. Defaults to `Present`. |
| `EMOJI` | No | Reaction emoji. Defaults to `👍`. |
| `TARGET_MESSAGE_ID` | No | Message ID for a reaction target. Otherwise the most recent message is used. |
| `MAX_JITTER_MINUTES` | No | Maximum random delay in minutes. |
| `SCHEDULE_TYPE` | No | Use `ONCE` for a date-gated one-time profile, otherwise `RECURRING`. |
| `RUN_DATE` | No | Required for `ONCE`; format is `YYYY-MM-DD` in UTC. |
| `PROFILE` | No | Profile name when no `--profile` argument is supplied. |

The command-line form is:

```bash
node src/run-once.js --profile=PROFILE_NAME
```

The `--dry-run` flag skips the actual message or reaction but still exercises configuration and notification logic.

## One-time schedules

A one-time profile can be triggered by a recurring cron-job.org job without storing state. The runner checks whether `RUN_DATE` matches the current UTC date. If the dates do not match, it exits successfully without sending anything.

Example profile:

```json
{
  "exam-day": {
    "label": "Exam day",
    "attendanceType": "MESSAGE",
    "message": "Present",
    "type": "ONCE",
    "runDate": "2026-10-15"
  }
}
```

For a one-time workflow, pass the profile name and schedule the cron-job.org request on the intended date. Because the date comparison uses UTC, make sure the job runs on the correct UTC calendar date.

## Troubleshooting

### cron-job.org returns `401` or `403`

The GitHub token is missing, expired, malformed, or does not have permission to dispatch workflows. Create a replacement token with access to the correct repository and the required Actions permission.

### cron-job.org returns `404`

Check the repository owner, repository name, workflow filename, and branch. The workflow must exist on the selected branch, and the URL must use the exact filename under `.github/workflows/`.

### cron-job.org returns `422`

The request body is usually missing `ref`, or the referenced branch does not exist. Use:

```json
{
  "ref": "main"
}
```

### GitHub run fails with `DISCORD_TOKEN is not set`

The repository secret name must be exactly `DISCORD_TOKEN`. Confirm that the secret belongs to the same repository where the workflow is running.

### Discord reports unauthorized access

The token may be invalid, expired, or rejected. Rotate it and update the GitHub secret. Remember that using a user token for automation can result in account enforcement by Discord.

### The channel cannot be found

Check `CHANNEL_ID` and verify that the account can access the channel. A channel ID is numeric; do not use the channel name or URL.

### The job runs but the message arrives later than scheduled

The workflow intentionally applies random delay. It also needs time to create a runner and install dependencies. This is expected behavior. If you require exact delivery times, this serverless design is not appropriate.

### No notification appears

`WEBHOOK_URL` is optional. Confirm that it is a valid Discord webhook URL and that the webhook has not been deleted or rotated. Notification failures do not replace the main attendance operation.

## Local daemon alternative

The repository also contains a long-running daemon that reads `config.json` and schedules jobs with `node-cron`. It is not required for the GitHub Actions and cron-job.org setup described above.

To configure and run it locally:

```bash
npm ci
npm start
node src/bot.js
```

The CLI creates `config.json`, which contains sensitive data. It is ignored by Git and must never be committed.

## Security checklist

- Keep `DISCORD_TOKEN` and the GitHub dispatch token private.
- Store secrets in GitHub Actions secrets or cron-job.org's secret-variable facility, not in source files or URLs.
- Rotate tokens when they expire or may have been exposed.
- Limit the GitHub token to this repository and the minimum required permission.
- Review workflow runs for accidental secret exposure before sharing logs.
- Use an official Discord bot account instead of a user token whenever the project can be redesigned to do so.

## License

No license file is currently present in the repository. Add and commit the license that should govern your copy before redistributing it.

## References

[1]: https://docs.github.com/en/rest/actions/workflows "GitHub REST API: Workflows"
[2]: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch "GitHub Actions: workflow_dispatch event"
[3]: https://cron-job.org/en/ "cron-job.org"
[4]: https://discord.com/terms "Discord Terms of Service"
[5]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token "GitHub documentation: Creating a personal access token"

The workflow-dispatch request format is documented by GitHub [1] [2]. Use cron-job.org [3] as the external scheduler, and review Discord's Terms of Service [4] before using user-account automation.

## Acknowledgements

Built by IamAdedo and emmy54. Maintained and adapted by contributors.
