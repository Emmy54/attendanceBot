# ⚡ AttendanceBot

```text
██╗     ██████╗ ███████╗
██║     ╚════██╗██╔════╝
██║      █████╔╝█████╗
██║     ██╔═══╝ ██╔══╝
███████╗███████╗███████╗
╚══════╝╚══════╝╚══════╝
```

> **AttendanceBot by IamAdedo, dlazyHNTR** \
> *Automatically send attendance messages to Discord servers on schedule. Set it once, let it run in the background forever.*

---

## 🤔 What Does This Do?

**AttendanceBot** automatically sends messages (like "Present" or "Good morning") to Discord channels at times you choose. Perfect for:

- Daily attendance in Work/Study Discord servers
- Automated check-ins for games or communities
- Scheduled greetings or reminders

Once set up, it runs invisibly in the background on your computer. You can add multiple servers and multiple schedules for each server.

---

## ✨ Features

- ✅ **Multiple Servers** — Manage attendance for unlimited Discord servers
- ✅ **Multiple Schedules** — Set different times for each server (e.g., 9 AM weekdays, 8 PM weekends)
- ✅ **Flexible Scheduling** — Everyday, weekdays, weekends, a specific repeating weekday (e.g., every Monday), or a **one-time calendar date** that auto-disables after it fires
- ✅ **Multi-Time / Multi-Day Builder** — Add several times to one day and several days in a single pass
- ✅ **Multi-Line Messages** — Attendance messages can span multiple lines
- ✅ **Anti-Detection** — Adds random delays (1-10 minutes) so messages don't post at the exact same second every day
- ✅ **Message OR Reaction** — Send text messages OR react with emojis to existing messages
- ✅ **Webhook Alerts** — Get notifications on your phone when attendance posts successfully (or if something goes wrong)
- ✅ **Background Service** — Runs 24/7 even when you close the terminal or restart your computer — including **no-root Android (Termux)**
- ✅ **Easy Setup** — Interactive step-by-step wizard—no coding knowledge needed

---

## 📋 What You Need Before Starting

1. **Node.js** installed on your computer ([Download here](https://nodejs.org/))
   - Check if you have it: Open Terminal/PowerShell and type `node -v`
   - You need version 18 or higher

2. **Your Discord User Token** ([How to get it](#-how-to-get-your-discord-token))

3. **Discord Channel ID** where you want to send attendance ([How to get it](#-how-to-get-a-channel-id))

---

## 🚀 Installation Guide (Step-by-Step)

### Step 1: Download and Install Dependencies

Open your **Terminal** (Mac/Linux) or **PowerShell** (Windows) and run these commands one by one:

##### Navigate to where you want to save the bot (e.g., Desktop)

```bash
cd Desktop
```

##### Download the project (or download and extract the ZIP from GitHub)

> 📱 **On Android?** No root required — see [Android (Termux, no root needed)](#android-termux-no-root-needed) for the mobile setup.

```bash
git clone https://github.com/IamAdedo/attendanceBot.git
```

##### Enter the project folder
```bash
cd attendanceBot
```

##### Install required packages (this may take 1-2 minutes)
```bash
npm install
```

---

### Step 2: Set Up Your First Server

Now let's configure AttendanceBot! Run this command:

```bash
npm start
```

You'll see a menu like this:

```
██╗     ██████╗ ███████╗
██║     ╚════██╗██╔════╝
██║      █████╔╝█████╗
██║     ██╔═══╝ ██╔══╝
███████╗███████╗███████╗
╚══════╝╚══════╝╚══════╝

⚡ AttendanceBot by IamAdedo, dlazyHNTR
══════════════════════════════════════════════════

  [1] Add New Server Profile
  [2] View All Configurations
  [3] Manage / Pause / Delete Server
  [4] Update Global Webhook URL
  [5] Exit
```

**Choose option 1** to add your first server. The wizard will ask you:

1. **Discord User Token**: Paste your token (see below for how to get it)
2. **Webhook URL** (optional): Skip this for now by pressing Enter
3. **Profile Name**: Give it a nickname like "Work Server" or "Game Guild"
4. **Channel ID**: Paste the channel ID where attendance should post
5. **Schedule**:
   - Choose **1** for Everyday, **2** for Weekdays only, **3** for Weekends only, or **4** for **Specific day(s)**
   - **Option 4** lets you pick either:
     - **(a) A repeating weekday** — e.g. every Monday, by number (`0`–`6`) or name (`Monday`)
     - **(b) A one-time date** — e.g. `2026-08-10`; it sends once on that day and then disables itself automatically
   - For a specific day you can add **multiple times to the same day**, and then **add more days** — all in one go
   - Enter the time (e.g., `09:00 AM` or `21:30`)
   - Type the message to send. Messages can span **multiple lines** — type each line and press **Enter on an empty line** to finish (leave the first line blank to use the default `Present`)
   - Set max random delay in minutes (recommended: `10` minutes)

After adding schedules, you'll be asked if you want to add more. Type `n` when you're done.

✅ **Your configuration is now saved!** The wizard creates a file called `config.json` that stores all your settings.

> 💡 When you exit the menu (option **5**), AttendanceBot offers to **install and start the background daemon for you automatically** — so you can skip Step 3 below if you accept.

---

### Step 3: Start the Background Service

Now let's make the bot run continuously in the background:

```bash
npm run service:install
```

You'll see:

```
✅ Background Daemon "attendanceBot-daemon" installed and running!
📌 Commands:
  - Status : npm run service:status
  - Logs   : npm run service:logs
  - Stop   : npm run service:uninstall
```

**That's it!** AttendanceBot is now running in the background. You can close the terminal—it will keep running.

---

## 🔑 How to Get Your Discord Token

> ⚠️ **IMPORTANT**: Your token is like a password to your Discord account. NEVER share it with anyone. If someone gets your token, they can control your Discord account.

### Desktop App or Browser (Works on both):

1. Open Discord
2. Press **F12** (or `Ctrl + Shift + I` on Windows, `Cmd + Option + I` on Mac)
3. Click the **Console** tab at the top
4. Copy and paste this code, then press **Enter**:

![script image](img)

<!--
```javascript
let m;
webpackChunkdiscord_app.push([
    [Math.random()],
    {},
    runtime => {
        for (const id in runtime.c) {
            const module = runtime.c[id];
            if (module?.exports?.getToken) {
                m = module;
                break;
            }
        }
    }
]);


if (m) {
    console.log("Token:", m.exports.getToken());
} else {
    console.warn("token not found")
}
```
-->


5. Your token will appear in the console (a long string of letters and numbers)
6. **Right-click** it and select **Copy**
7. Close Developer Tools

---

## 📍 How to Get a Channel ID

1. Open Discord and go to **User Settings** (gear icon)
2. Go to **Advanced** (under "APP SETTINGS")
3. Turn on **Developer Mode**
4. Go back to Discord, **right-click** any channel, and click **Copy Channel ID**

---

## 💻 Managing the Bot

### Check if the Bot is Running

```bash
npm run service:status
```

You'll see:

```
┌─────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                 │ status  │ uptime  │ memory   │
├─────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ attendanceBot-daemon │ online  │ 2h 15m  │ 45.2 MB  │
└─────┴──────────────────────┴─────────┴─────────┴──────────┘
```

### View Live Logs (What's Happening Right Now)

```bash
npm run service:logs
```

Press **Ctrl + C** to stop watching logs.

### Add More Servers or Edit Schedules

```bash
npm start
```

Choose option **1** to add more servers, or option **3** to pause/resume/delete existing ones.

### Stop the Bot Completely

```bash
npm run service:uninstall
```

---

## 🔄 Make It Start Automatically When Your Computer Boots

### Windows

Open **PowerShell as Administrator** and run:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
```

### macOS

Open **Terminal** and run:

```bash
npx pm2 startup launchd
```

Then follow the command it shows you (copy-paste it and press Enter).

### Linux

Open **Terminal** and run:

```bash
npx pm2 startup systemd
```

### Android (Termux, **no root needed**)

AttendanceBot now runs natively in Termux without root. Install [Termux](https://f-droid.org/en/packages/com.termux/) (F-Droid version is recommended):

#### 1. Update packages & install Node

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts termux-api -y
```

#### 2. Install the project (same as Step 1 above)

```bash
git clone https://github.com/IamAdedo/attendanceBot.git
cd attendanceBot
npm install
```

#### 3. Configure and start

```bash
npm start
```

Set up your server (Step 2 above). When you exit, accept the offer to install the daemon — or run:

```bash
npm run service:install
```

The installer detects Termux automatically and:
- Keeps the daemon alive with a **wake lock** (install the [Termux:API](https://f-droid.org/en/packages/com.termux.api/) app for this) so Android doesn't suspend it
- Creates a **Termux:Boot** startup script so the daemon resurrects after a reboot

#### 4. (Optional) Auto-start after reboot

Install the [Termux:Boot](https://f-droid.org/en/packages/com.termux.boot/) app from F-Droid, open it once, and the daemon will start automatically on device boot — no root required.

> ⚠️ **Older alternative (root emulation):** If you previously used the `proot-distro` + Ubuntu approach below, you can keep using it — but the native Termux path above is simpler and needs[...]

---

## 🔔 Get Notifications on Your Phone (Optional)

You can get Discord notifications on your phone whenever attendance posts successfully or if there's an error.

### How to Set Up Webhook Notifications:

1. Open Discord (desktop or browser)
2. Go to the channel where you want to receive notifications
3. Click the **gear icon** next to the channel name → **Integrations** → **Webhooks**
4. Click **New Webhook** → **Copy Webhook URL**
5. Run `npm start` → Choose **[4] Update Global Webhook URL**
6. Paste the webhook URL and press Enter
7. You'll get a test notification immediately!

Now whenever attendance posts, you'll get a notification like this:

```
✅ Attendance Posted Successfully
Server Profile : Work Server
Channel        : #daily-checkin
Schedule       : 09:00 AM (Weekdays)
Message Sent   : "Present"
Timestamp      : Tuesday, August 5, 2026 9:07 AM

AttendanceBot by IamAdedo, dlazyHNTR
```

---

## 📁 Project Files Explained

```
attendanceBot/
├── bin/
│   ├── cli.js               ← The interactive menu you see when you run npm start
│   ├── install-service.js   ← Installs the background service
│   └── uninstall-service.js ← Removes the background service
├── src/
│   ├── bot.js               ← Main bot that connects to Discord
│   ├── logger.js            ← Handles log messages
│   └── engine/
│       └── worker.js        ← Sends messages and reactions
├── config.json              ← YOUR SETTINGS (created after first setup)
├── package.json             ← Project info and dependencies
└── README.md                ← This file!
```

**Important:** `config.json` contains your Discord token. Never share this file or commit it to GitHub!

---

## ⚠️ Important Warnings

### 1. Discord's Rules

Using "self-bots" (bots that control your personal Discord account) **violates Discord's Terms of Service**. While many people use them without issues, Discord *can* ban your account if they detect it[...] 

**How to stay safer:**
- ✅ Always keep "Anti-Detection Jitter" enabled (10+ minutes recommended)
- ✅ Don't use this bot on your main Discord account
- ✅ Use it sparingly (1-2 messages per day max)
- ❌ Never post in rapid succession or across many servers

### 2. Keep Your Token Secret

Your Discord token is like your password. If someone gets it, they can:
- Read all your messages
- Send messages as you
- Join/leave servers
- Change your settings

**Never:**
- Share your token with anyone
- Post it online
- Commit `config.json` to GitHub

### 3. This is For Personal/Educational Use Only

Use this responsibly. Don't spam, don't harass, and respect the communities you're in.

---

## ❓ Troubleshooting

### "npm: command not found"

You need to install Node.js first: https://nodejs.org/

### "Failed to log into Discord: Unauthorized"

Your Discord token is wrong or expired. Get a fresh token using the steps above.

### "Channel not found" or "Missing Permissions"

Make sure:
1. The Channel ID is correct
2. Your Discord account has permission to send messages in that channel
3. The channel still exists

### Bot stops working after a few days

Check logs with `npm run service:logs`. Common causes:
- Discord token expired (get a new one)
- Channel was deleted
- You got rate-limited (reduce frequency or increase jitter)

### How do I update the bot?

```bash
cd attendanceBot
git pull
npm install
npm run service:uninstall
npm run service:install
```

---

## 🛠️ Advanced: Reaction-Based Attendance

Some servers require you to react with an emoji instead of sending a message.

When setting up a schedule, you can:
1. Set `attendanceType` to `REACTION` in `config.json`
2. Add `"emoji": "👍"` (or any emoji)
3. Optionally add `"targetMessageId": "1234567890"` to react to a specific message

Example in `config.json`:

```json
{
  "id": "1234567891",
  "label": "09:00 AM (Weekdays)",
  "cron": "0 9 * * 1-5",
  "attendanceType": "REACTION",
  "emoji": "✅",
  "targetMessageId": "1234567890123456789",
  "maxJitterMinutes": 10,
  "active": true
}
```

If `targetMessageId` is not provided, the bot will react to the most recent message in the channel.

---

## 📞 Support & Contact

**Created by:** IamAdedo, dlazyHNTR

For bugs, suggestions, or questions, open an issue on GitHub.

---

## 📄 License

This project is licensed under the **MIT License** — you're free to use, modify, and distribute it.

**Use at your own risk.** The authors are not responsible for Discord account bans or any consequences of using this tool.

---

## 🎉 You're All Set!

AttendanceBot is now running in the background. It will automatically send your attendance messages at the times you configured.

**Quick command reference:**
```bash
npm start                     # Open the menu to add/edit servers
npm run service:status        # Check if bot is running
npm run service:logs          # See what the bot is doing
npm run service:uninstall     # Stop the bot
```

Enjoy your automated attendance! 🚀


...with love by The !Lazy Hunter <||>
