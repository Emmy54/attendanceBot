/**
 * src/engine/oneshot.js
 *
 * AttendanceBot — Serverless (one-shot) execution engine.
 *
 * Unlike src/engine/worker.js (which drives a persistent discord.js-selfbot
 * gateway client), this module talks to Discord's HTTP API directly so a
 * GitHub Actions run can: wake up, perform ONE attendance action, and exit —
 * without ever opening a gateway websocket.
 *
 * Nothing here imports the selfbot library; only Node's built-in `https`.
 * The Discord token only ever leaves this process inside the Authorization
 * header, and is scrubbed from any error text via redact().
 */

const https = require('https');

const DISCORD_API = 'discord.com';
const API_VERSION = 'v9';
// Discord user tokens authorize as the account itself (no "Bot " prefix).
const USER_AGENT = 'AttendanceBot-serverless (https://github.com/IamAdedo/attendanceBot)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Removes any occurrence of the Discord token from a string so it can never
 * reach logs or webhook embeds, even inside a third-party error message.
 * @param {string} text
 * @param {string} token
 * @returns {string}
 */
function redact(text, token) {
    if (text === undefined || text === null) return text;
    let out = String(text);
    if (token) out = out.split(token).join('***REDACTED***');
    return out;
}

/**
 * Low-level Discord REST call.
 * Resolves { status, data } on 2xx; rejects with a token-scrubbed Error
 * otherwise. Retries exactly once on HTTP 429 using the returned retry_after.
 *
 * @param {string} method
 * @param {string} apiPath  path after /api/<version>, e.g. "/channels/123/messages"
 * @param {string} token
 * @param {object} [body]
 * @param {boolean} [_retried]  internal guard for the single 429 retry
 * @returns {Promise<{status:number, data:any}>}
 */
function discordRequest(method, apiPath, token, body, _retried = false) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;

        const req = https.request(
            {
                hostname: DISCORD_API,
                path: `/api/${API_VERSION}${apiPath}`,
                method,
                headers: {
                    Authorization: token,
                    'User-Agent': USER_AGENT,
                    Accept: 'application/json',
                    ...(payload
                        ? {
                              'Content-Type': 'application/json',
                              'Content-Length': Buffer.byteLength(payload),
                          }
                        : {}),
                },
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => (raw += chunk));
                res.on('end', async () => {
                    const status = res.statusCode || 0;
                    let data;
                    try {
                        data = raw ? JSON.parse(raw) : {};
                    } catch {
                        data = raw;
                    }

                    // Rate limited: honor retry_after once, then give up.
                    if (status === 429 && !_retried) {
                        const retryAfterSec = (data && (data.retry_after || data.retryAfter)) || 1;
                        await sleep(Math.ceil(retryAfterSec * 1000) + 250);
                        try {
                            resolve(await discordRequest(method, apiPath, token, body, true));
                        } catch (err) {
                            reject(err);
                        }
                        return;
                    }

                    if (status >= 200 && status < 300) {
                        resolve({ status, data });
                    } else {
                        const detail = data && data.message ? data.message : `HTTP ${status}`;
                        reject(new Error(redact(`Discord API ${status}: ${detail}`, token)));
                    }
                });
            }
        );

        req.on('error', (err) => reject(new Error(redact(`Network error: ${err.message}`, token))));
        if (payload) req.write(payload);
        req.end();
    });
}

// --- Discord actions -------------------------------------------------------

/** GET a channel object (best-effort; used for a friendly #name in webhooks). */
function fetchChannel(token, channelId) {
    return discordRequest('GET', `/channels/${channelId}`, token).then((r) => r.data);
}

/** POST a typing indicator (returns 204; used to mimic the daemon's behavior). */
function triggerTyping(token, channelId) {
    return discordRequest('POST', `/channels/${channelId}/typing`, token);
}

/** POST a message. Resolves the created message object. */
function sendMessage(token, channelId, content) {
    return discordRequest('POST', `/channels/${channelId}/messages`, token, { content }).then(
        (r) => r.data
    );
}

/** GET the single most recent message in a channel (reaction fallback). */
function fetchRecentMessage(token, channelId) {
    return discordRequest('GET', `/channels/${channelId}/messages?limit=1`, token).then((r) =>
        Array.isArray(r.data) ? r.data[0] : null
    );
}

/**
 * Encodes an emoji for the reactions endpoint path segment.
 * - Custom:  <:name:id> / <a:name:id>  ->  name:id
 * - Unicode: percent-encoded (e.g. 👍 -> %F0%9F%91%8D)
 */
function encodeReactionEmoji(emoji) {
    const custom = String(emoji).match(/^<a?:(\w+):(\d+)>$/);
    if (custom) return `${custom[1]}:${custom[2]}`;
    if (/^\w+:\d+$/.test(emoji)) return emoji; // already name:id
    return encodeURIComponent(emoji);
}

/** PUT a reaction as the current user (@me). */
function addReaction(token, channelId, messageId, emoji) {
    const enc = encodeReactionEmoji(emoji);
    return discordRequest(
        'PUT',
        `/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`,
        token
    );
}

// --- Webhook (awaitable) ---------------------------------------------------

/**
 * Posts a Discord webhook embed and RESOLVES ONLY WHEN THE REQUEST COMPLETES.
 *
 * worker.js's sendWebhookNotification() is fire-and-forget — fine for a
 * long-lived daemon, but a one-shot process exits the instant main() returns,
 * truncating any un-awaited socket. Callers MUST `await` this before exiting.
 * It never rejects: a broken webhook must not mask the real success/failure
 * of the attendance action itself.
 *
 * The embed shape mirrors worker.js so notifications look identical.
 * @returns {Promise<boolean>} true if delivered, false otherwise
 */
function postWebhook(webhookUrl, embedData) {
    return new Promise((resolve) => {
        if (!webhookUrl) return resolve(false);

        let url;
        try {
            url = new URL(webhookUrl);
        } catch {
            return resolve(false);
        }

        const payload = JSON.stringify({
            embeds: [
                {
                    ...embedData,
                    footer: { text: 'AttendanceBot by IamAdedo, dlazyHNTR' },
                    timestamp: new Date().toISOString(),
                },
            ],
        });

        const req = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            },
            (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve(true));
            }
        );

        req.on('error', () => resolve(false));
        req.write(payload);
        req.end();
    });
}

module.exports = {
    sleep,
    redact,
    fetchChannel,
    triggerTyping,
    sendMessage,
    fetchRecentMessage,
    addReaction,
    encodeReactionEmoji,
    postWebhook,
};
