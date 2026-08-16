# YouTube Transcript Distiller

> A Firefox add-on that reads YouTube videos so you don't have to.

You open a video. Twelve minutes. You watch. You wait. The one insight you came for arrives at minute nine — buried under filler, recaps, and sponsor breaks.

**YouTube Transcript Distiller** fetches the full transcript and the video description, sends both to Google Gemini AI, and posts a clean summary directly into the YouTube comment field. One click. The important points, right where other viewers can see them.

---

## Which build do I need

This is the Firefox add-on. Chrome, Edge, Brave, Vivaldi and Opera need the [Chrome build](https://github.com/michaelruck/yt-transcript-distiller-chrome), a separate source tree with the same features, rebuilt on Manifest V3.

| Your browser | What to install | Notes |
|---|---|---|
| Firefox on the desktop | this add-on, from [addons.mozilla.org](https://addons.mozilla.org/addon/youtube-transcript-distiller) | version 140 or newer |
| Firefox for Android | this add-on, from [addons.mozilla.org](https://addons.mozilla.org/addon/youtube-transcript-distiller) | version 142 or newer |
| Chrome, Chromium, Edge | [Chrome build](https://github.com/michaelruck/yt-transcript-distiller-chrome) | version 111 or newer |
| Brave, Vivaldi, Opera, other Chromium browsers | [Chrome build](https://github.com/michaelruck/yt-transcript-distiller-chrome) | built on Chromium 111 or newer; those forks number themselves, so check the line labelled Chromium on `brave://version` rather than the browser's own version |
| Chrome or Edge on Android | this add-on, in Firefox for Android | Chrome for Android runs no extensions at all, and Edge for Android only a short list Microsoft picks. That is a limit of those two browsers, not of this add-on: on Android, Firefox is the browser that lets you add anything |
| Safari | nothing available | Safari runs neither Firefox nor Chrome extensions. Every extension has to be rebuilt as a signed Mac app in Xcode and shipped through the App Store, which is a separate product rather than a setting, and I have not built one |

The Chrome build is not in the Chrome Web Store yet, so it installs by hand: download the ZIP from its [latest release](https://github.com/michaelruck/yt-transcript-distiller-chrome/releases/latest) and follow [INSTALL.md](https://github.com/michaelruck/yt-transcript-distiller-chrome/blob/main/INSTALL.md), which walks through it for people who have never loaded an extension that way.

Gecko-based forks such as LibreWolf, Waterfox, Floorp and Zen install add-ons from addons.mozilla.org as well, so this is the build to take there. Untested by me; the Firefox version they are built on still has to be 140 or newer.

---

## Features

- **AI-powered summarization** via Google Gemini (free API key required)
- **Transcript plus video description** — the summary draws on both, so context from the description flows in
- **Silent transcript fetch** — reads the caption track straight from the player, no panel opens, no scrolling
- **Posts directly into the YouTube comment field** — formatted and ready to publish
- **Fully customizable prompt** — change the instruction to anything you want
- **Configurable Gemini model** — pick Flash-Lite (default), Flash, or Pro from a dropdown, or enter any model ID manually
- **11 languages supported:** Arabic, Chinese, English, French, German, Hindi, Japanese, Korean, Portuguese, Russian, Spanish
- **UI adapts to your browser language** automatically
- **Quota countdown** — if you hit the Gemini rate limit, the button shows a live countdown
- **Privacy first** — your API key stays in your browser, anonymous usage stats can be disabled in settings

---

## Installation

### Firefox Add-On Store
The add-on can be installed from [addons.mozilla.org](https://addons.mozilla.org/addon/youtube-transcript-distiller).

### Manual installation (Firefox Developer Edition / Nightly)
1. Download the latest `yt-transcript-distiller.xpi` from [Releases](https://github.com/michaelruck/yt-transcript-distiller/releases)
2. In Firefox: `about:config` → set `xpinstall.signatures.required` to `false`
3. `about:addons` → gear icon → *Install Add-on from File* → select the `.xpi`

---

## Setup

1. Get a free Gemini API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Open any YouTube video
3. Click the gear icon next to the **Transcript Distiller** button
4. Enter your API key and save
5. Click **Transcript Distiller** — the AI summary appears in the comment field

---

## How it works

```
YouTube Video
     │
     ▼
Transcript + description fetch
(player caption track → YouTube Internal API → DOM fallback)
     │
     ▼
Google Gemini API (your API key, your quota)
     │
     ▼
Formatted summary → YouTube comment field
```

The add-on never stores or transmits your transcript data anywhere other than directly to the Gemini API. The API key is stored locally in your browser via `chrome.storage.sync`.

---

## Privacy

- **API key:** stored locally, sent only to `generativelanguage.googleapis.com`
- **Usage statistics:** sent only on button click: add-on name, action and language settings. No personal data.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Saves API key, prompt and language preference locally |
| `clipboardWrite` / `clipboardRead` | Required for text injection into YouTube's comment field |
| `youtube.com/*` | Content script runs on YouTube pages only |
| `generativelanguage.googleapis.com/*` | Gemini API calls |
| `marsgasse.com/*` | Anonymous usage counter |

---

## Customization

The prompt sent to Gemini is fully editable. Click the gear icon → edit the **Prompt** field. The default prompt instructs Gemini to produce a structured YouTube comment with bullet points, bold keywords, and blank lines between items — no raw Markdown, no HTML.

Click **↺ Reset** to restore the default prompt at any time.

### Gemini model

The **Gemini Model** dropdown (add-on settings page in `about:addons`) offers three alias IDs that Google keeps pointing at the newest release of each line:

- `gemini-flash-lite-latest` — the default; fast, and its free-tier quota holds up in daily use
- `gemini-flash-latest` — stronger, but the free tier allows few requests per day
- `gemini-pro-latest` — effectively requires a paid plan

**Custom model ID…** accepts any model ID that supports `generateContent` from the [Gemini model list](https://ai.google.dev/gemini-api/docs/models). If a model answers with 404 (retired), 429 (daily quota used up), or 503 (overloaded), the error message says so — switching the model in the settings is the fix.

---

## Requirements

- Firefox 140+ (Desktop) / Firefox for Android 142+
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A YouTube video that has a transcript, automatically generated ones included
- A Google account (required to post comments)

---

## Built at

[marsgasse.com](https://marsgasse.com) — Just another Basement Lab  
Michael Ruck · michael.ruck@marsgasse.com

---

## License

MIT
