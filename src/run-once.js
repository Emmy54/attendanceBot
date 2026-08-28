/**
 * src/run-once.js
 *
 * AttendanceBot — serverless one-shot entry point.
 *
 * Invoked by a GitHub Actions scheduled workflow (or manually / locally):
 * reads config from environment variables + a committed profiles.json, waits
 * a random jitter, performs ONE attendance action over Discord's REST API,
 * notifies a webhook on success AND failure, then exits — non-zero on failure
 * so the Actions run is marked red.
 *
 * The Discord token is read from env only and is NEVER logged (scrubbed from
 * error text via redact()).
 *
 * Usage:
 *   node src/run-once.js --profile=weekday-morning
 *   node src/run-once.js --profile=weekday-morning --dry-run
 *
 * Required env:  DISCORD_TOKEN, CHANNEL_ID
 * Optional env:  WEBHOOK_URL, ATTENDANCE_TYPE, MESSAGE, EMOJI,
 *                TARGET_MESSAGE_ID, MAX_JITTER_MINUTES, SCHEDULE_TYPE,
 *                RUN_DATE, PROFILE
 *
 * Precedence for every field:  env var  >  profiles.json[profile]  >  default.
 * DISCORD_TOKEN / CHANNEL_ID / WEBHOOK_URL are env-only (never in the file).
 */

const fs = require('fs');
const path = require('path');

const { calculateJitterMs } = require('./engine/worker'); // reuse daemon jitter logic
const {
    sleep,
    redact,
    fetchChannel,
    triggerTyping,
    sendMessage,
    fetchRecentMessage,
    addReaction,
    postWebhook,
} = require('./engine/oneshot');

const PROFILES_PATH = path.join(__dirname, '..', 'profiles.json');

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** env value if set and non-empty, else undefined. */
function env(key) {
    const v = process.env[key];
    return v !== undefined && v !== '' ? v : undefined;
}

function parseArgs(argv) {
    const rest = argv.slice(2);
    const args = { profile: env('PROFILE'), dryRun: false };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--dry-run') {
            args.dryRun = true;
        } else if (a.startsWith('--profile=')) {
            args.profile = a.slice('--profile='.length);
        } else if (a === '--profile' && rest[i + 1] && !rest[i + 1].startsWith('--')) {
            args.profile = rest[++i];
        }
    }
    return args;
}

function loadProfile(name) {
    if (!name) return {};
    let all;
    try {
        all = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
    } catch (err) {
        log(`⚠️  Could not read profiles.json (${err.message}). Falling back to env only.`);
        return {};
    }
    if (!all[name]) {
        log(`⚠️  Profile "${name}" not found in profiles.json. Falling back to env only.`);
        return {};
    }
    return all[name];
}

function resolveConfig(profileName) {
    const p = loadProfile(profileName);
    return {
        profileName: profileName || '(none)',
        label: p.label || profileName || 'attendance',
        token: env('DISCORD_TOKEN'),
        channelId: env('CHANNEL_ID'),
        webhookUrl: env('WEBHOOK_URL'),
        attendanceType: (env('ATTENDANCE_TYPE') || p.attendanceType || 'MESSAGE').toUpperCase(),
        message: env('MESSAGE') || p.message || 'Present',
        emoji: env('EMOJI') || p.emoji || '👍',
        targetMessageId: env('TARGET_MESSAGE_ID') || p.targetMessageId || null,
        maxJitterMinutes: Number(env('MAX_JITTER_MINUTES') ?? p.maxJitterMinutes ?? 10),
        scheduleType: (env('SCHEDULE_TYPE') || p.type || 'RECURRING').toUpperCase(),
        runDate: env('RUN_DATE') || p.runDate || null,
    };
}

/** Today's date in UTC as YYYY-MM-DD. */
function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}

async function notifySuccess(cfg, channelName, extraFields, dryRun) {
    const base =
        cfg.attendanceType === 'REACTION'
            ? 'Attendance Reaction Posted'
            : 'Attendance Posted';
    await postWebhook(cfg.webhookUrl, {
        title: dryRun ? `🧪 [DRY-RUN] ${base} (no action taken)` : `✅ ${base} Successfully`,
        color: dryRun ? 10181046 : 3066993, // purple for dry-run, green for real
        fields: [
            { name: 'Profile', value: cfg.label, inline: true },
            { name: 'Channel', value: `#${channelName || cfg.channelId}`, inline: true },
            { name: 'Runner', value: 'GitHub Actions (one-shot)', inline: true },
            ...extraFields,
        ],
    });
}

async function notifyFailure(cfg, safeErrorMessage) {
    await postWebhook(cfg.webhookUrl, {
        title: '🚨 Attendance Posting Failed',
        color: 15158332, // red
        fields: [
            { name: 'Profile', value: cfg.label || 'Unknown', inline: true },
            { name: 'Channel ID', value: cfg.channelId || 'Unknown', inline: true },
            { name: 'Runner', value: 'GitHub Actions (one-shot)', inline: true },
            { name: 'Error Details', value: `\`\`\`${safeErrorMessage}\`\`\``, inline: false },
        ],
    });
}

async function main() {
    const { profile, dryRun } = parseArgs(process.argv);
    const cfg = resolveConfig(profile);

    log(
        `▶️  One-shot starting — profile "${cfg.profileName}" (${cfg.label})` +
            `${dryRun ? ' [DRY-RUN]' : ''}`
    );

    // --- validation (never echoes secret values) ---
    if (!cfg.token) throw new Error('DISCORD_TOKEN is not set.');
    if (!cfg.channelId) throw new Error('CHANNEL_ID is not set.');

    // --- one-time (ONCE) stateless date gate ---
    // GitHub Actions fires a dated cron every year; comparing the profile's
    // runDate against today's UTC date makes the extra firings no-ops without
    // any persisted "already sent" state.
    if (cfg.scheduleType === 'ONCE') {
        if (!cfg.runDate) {
            throw new Error('Schedule type is ONCE but no runDate/RUN_DATE was provided.');
        }
        const today = todayUtc();
        if (cfg.runDate !== today) {
            log(`⏭️  One-time schedule due ${cfg.runDate}; today is ${today} (UTC). Not due — exiting cleanly.`);
            return; // exit 0, nothing sent
        }
        log(`📅 One-time schedule is due today (${today} UTC).`);
    }

    // --- anti-detection jitter ---
    const jitterMs = calculateJitterMs(cfg.maxJitterMinutes);
    const jitterSec = Math.round(jitterMs / 1000);
    if (dryRun) {
        log(`🎲 [dry-run] would apply ${jitterSec}s jitter (max ${cfg.maxJitterMinutes}m) — skipping wait.`);
    } else if (jitterMs > 0) {
        log(`🎲 Applying anti-detection jitter: waiting ${jitterSec}s...`);
        await sleep(jitterMs);
    }

    // --- best-effort channel name for a friendlier webhook ---
    // In a dry-run we let this throw so a bad token / channel fails loudly
    // during local testing; in a real run it stays non-fatal.
    let channelName = null;
    try {
        const ch = await fetchChannel(cfg.token, cfg.channelId);
        channelName = ch && ch.name ? ch.name : null;
    } catch (err) {
        if (dryRun) throw err;
    }

    // --- execute ---
    if (cfg.attendanceType === 'REACTION') {
        let targetId = cfg.targetMessageId;
        if (!targetId) {
            const recent = await fetchRecentMessage(cfg.token, cfg.channelId);
            if (!recent) {
                throw new Error(`No message found in channel ${cfg.channelId} to react to.`);
            }
            targetId = recent.id;
        }

        if (!dryRun) {
            await sleep(1200 + Math.floor(Math.random() * 1800)); // brief "reading" pause
            await addReaction(cfg.token, cfg.channelId, targetId, cfg.emoji);
            log(`✅ Reacted "${cfg.emoji}" to message ${targetId}.`);
        } else {
            log(`✅ [dry-run] would react "${cfg.emoji}" to message ${targetId} in ${cfg.channelId}.`);
        }

        await notifySuccess(
            cfg,
            channelName,
            [
                { name: 'Emoji', value: `\`${cfg.emoji}\``, inline: true },
                { name: 'Target Message', value: String(targetId), inline: true },
                { name: 'Jitter', value: `${jitterSec}s`, inline: true },
            ],
            dryRun
        );
    } else {
        // MESSAGE mode
        const text = cfg.message;

        if (!dryRun) {
            await triggerTyping(cfg.token, cfg.channelId).catch(() => {});
            const typingMs = Math.min(Math.max(text.length * 100, 1500), 7000);
            log(`⌨️  Simulating typing for ${typingMs}ms...`);
            await sleep(typingMs);
            const sent = await sendMessage(cfg.token, cfg.channelId, text);
            log(`✅ Message posted (id ${sent && sent.id ? sent.id : 'unknown'}).`);
        } else {
            log(`✅ [dry-run] would send message "${text}" to ${cfg.channelId}.`);
        }

        await notifySuccess(
            cfg,
            channelName,
            [
                { name: 'Message', value: `\`${text}\``, inline: false },
                { name: 'Jitter', value: `${jitterSec}s`, inline: true },
            ],
            dryRun
        );
    }

    log('🏁 Done.');
}

main().catch(async (err) => {
    // Scrub the token from any error text before it can reach logs or webhook.
    const token = process.env.DISCORD_TOKEN || '';
    const safeMsg = redact(err && err.message ? err.message : String(err), token);

    console.error(`[${new Date().toISOString()}] ❌ Attendance failed: ${safeMsg}`);

    // Best-effort failure alert (uses only non-secret fields).
    try {
        const cfg = resolveConfig(parseArgs(process.argv).profile);
        await notifyFailure(cfg, safeMsg);
    } catch {
        /* ignore secondary failures */
    }

    process.exitCode = 1; // mark the GitHub Actions run as failed
});
