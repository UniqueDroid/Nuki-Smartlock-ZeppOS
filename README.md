# SmartLock for Zepp OS

Lock, unlock and check the status of your Nuki Smart Lock right from your wrist. A Zepp OS Mini App for the **Amazfit Bip Max** (device code `PikeW`, square display).

<p align="center">
  <img src="screenshots/app-icon.jpg" alt="App icon" width="160">
  <img src="screenshots/home-screen.jpg" alt="Home screen" width="160">
  <img src="screenshots/status-screen.jpg" alt="No lock configured yet" width="160">
</p>

Full architecture concept: [`nuki-zeppos-konzept.md`](nuki-zeppos-konzept.md) (German).

## Status: M1 "walking skeleton" (published, 02.09.2026)

The full round trip works end to end on a real device: watch → Side Service → Nuki Web API → response shown on the watch, including a double-tap confirmation before Lock/Unlock actually fire. Published on the Zepp OS app store as **SmartLock** (App ID 1123926, v1.0.4).

The smartlock ID can be set two ways: via the store-installed app's Settings page in the Zepp app (needs the Nuki Web API token there too), or directly on the watch via **Settings → Set Smartlock ID** (numeric keyboard) - the on-watch path matters for sideloaded/Developer-Mode test builds, which don't get a reachable Settings page in the Zepp app at all (see "Lessons learned" below). The API token itself is phone-Settings-only either way - too long to type on the watch.

## Getting a Nuki Web API token

The app needs a token for the [Nuki Web API](https://developer.nuki.io/) to talk to your lock. Create one with only the scopes this app actually uses - not a full-access token:

1. Log into [web.nuki.io](https://web.nuki.io) with your Nuki account.
2. Open the menu → **API**.
3. Create a new **API Token** (this is the simple "API Tokens" auth type, not OAuth 2 - no client ID/secret needed).
4. Give it a name (e.g. "Zepp watch app") and select **only** these scopes:
   - `smartlock.readOnly` - lets the app read lock/battery status
   - `smartlock.action` - lets the app send lock/unlock/unlatch commands
   Leave everything else (account, notification, smartlock.config, smartlock.auth, smartlock.log, ...) unchecked - the app doesn't need it, and a narrower token limits the blast radius if it ever leaks.
5. Generate the token and copy it immediately - Nuki shows it once, the same way most API providers do.
6. Paste it into the watch app: Zepp app → this app's Settings page → "Nuki Web API Token" (or the on-watch Settings screen once a token already works elsewhere - see below, the watch itself only handles the smartlock ID, not the token).

API tokens don't expire on their own; they're revoked if you change your Nuki Web account password. You can find/manage or delete tokens again under the same menu → API page at any time.

## Project structure

```
app.json                 # Target "PikeW" (Amazfit Bip Max), apiLevel 3.0
app.js                   # MessageBuilder connection watch <-> Side Service
app-side/
  index.js               # Message dispatcher (GET_STATUS/ACTION/LIST_LOCKS)
  nuki-web-backend.js     # Variant A: direct https://api.nuki.io client
page/index.js             # Main screen: status text + Status/Lock/Unlock/Settings buttons,
                           # double-tap-to-confirm on Lock/Unlock
page/settings.js          # On-watch Settings screen: set the smartlock ID directly
setting/index.js          # Token + smartlock ID (Zepp app Settings page)
shared/protocol.js         # Message types + error codes, imported by both sides
shared/message*.js, event.js, defer.js, ...  # Zepp OS messaging scaffolding
                           # (taken from the official "Fetch Api" template)
utils/config/              # Device width/height, color constants
assets/logo.svg            # Source for the app icon (circular, no trademarked colors)
screenshots/                # Real-device screenshots used in this README / the store listing
test-builds/pikew.zip       # Latest sideload-test package (hosted for QR install, see below)
```

## Not implemented yet (upcoming milestones)

- **M2** - proper state machine (SENDING/PENDING/SUCCESS/ERROR), status polling after an action, haptics, buttons disabled while an action is in flight.
- **M3** - originally planned as a "Load locks" picker (`LIST_LOCKS`-driven, pick by name); built instead as direct numeric ID entry on the watch (`page/settings.js`, `createKeyboard`) since a picker needs the API token already in `settingsStorage`, which a sideloaded test build has no way to set. `LIST_LOCKS`/`handleListLocks` is still there in `app-side/index.js`, just unused by any current watch page - could still back a picker for the store-installed instance later.
- **M4** - icons, unlatch confirmation dialog, i18n.
- **M5** - Variant B (own proxy instead of talking to the Nuki Web API directly).

## Building

```
npm install -g @zeppos/zeus-cli   # if not already installed globally
zeus build
```

`zeus preview`/`zeus dev` need a Zepp account connected via `zeus login` plus a simulator or a real device bridge - not set up in this environment (headless VM, no browser for the login callback).

## Sideload-testing via QR code

`zeus login` needs a real browser for its login callback, which a headless environment doesn't have. As a workaround, this repo hosts the latest test build's inner `.zpk` (renamed `.zip`) at `test-builds/pikew.zip`, served publicly via jsDelivr and turned into a `zpkd1://` deep link that the Zepp app's Developer Mode QR scanner accepts directly - no `zeus login`/bridge needed on the build machine.

Current test build - scan with the Zepp app (Profile → Developer Mode → QR scanner):

![QR code for the current sideload test build](test-builds/qr.png)

```
zpkd1://cdn.jsdelivr.net/gh/UniqueDroid/Nuki-Smartlock-ZeppOS@<commit-sha>/test-builds/pikew.zip
```

Pin the URL to a commit SHA, not `@main` - jsDelivr's branch-alias caching lagged behind pushes during testing, while SHA-pinned URLs resolved reliably. Note: since `test-builds/qr.png` and this README are themselves committed to the repo, the SHA baked into the QR image necessarily points at the commit *before* the one that added/updated the image (adding the image is what creates the newer commit) - harmless, since the app package it points to didn't change in between, but don't be surprised the SHA isn't literally `HEAD`.

Important: the `zpkd1://` link must point at the **inner `.zpk`** file (itself a zip of `device.zip` + `app-side.zip`), not the outer `.zab` that `zeus build` produces - the `.zab` is just a container around one `.zpk` per target device, and the Zepp app can't parse the container directly ("Parse mini program package failed").

**Updating the QR code after a new build:** extract the fresh `.zpk` into `test-builds/pikew.zip` (see the loop in project memory / prior commits for the exact `zipfile` snippet), commit+push, take the new commit's SHA, regenerate `test-builds/qr.png` from `zpkd1://cdn.jsdelivr.net/gh/UniqueDroid/Nuki-Smartlock-ZeppOS@<sha>/test-builds/pikew.zip` (e.g. Python's `qrcode` package), and commit that too.

## Lessons learned

- **App Store submission rejects trademarked names.** The first submission (as "ZeppNuki") was rejected for using the protected "Nuki" and "Zepp" names in the app name, plus an icon that too closely echoed Nuki's brand colors. Renamed to "SmartLock" everywhere - including `app.json`'s `i18n.en-US.appName`, which is a **separate field** from the top-level `app.appName` and easy to miss in a find-and-replace (different indentation/no trailing comma made a naive `replace_all` skip it once).
- **Store icons must be a true circle**, 248×248px with a 4px transparent margin, no solid-black background - not just "rounded corners". See `docs.zepp.com/docs/designs/visual/icons/`.
- **QR/Developer-Mode sideloaded apps don't get a Settings page** anywhere in the Zepp app UI - confirmed by testing against a different, properly *published* sideloaded app that still didn't show up under the phone's "More" section (where store-installed apps like Intervals.icu get a settings arrow). Settings access seems tied to a proper store install, not just to publish status.
- **`app.json`'s `permissions` list matters even for basics** - missing `data:os.device.info` silently crashed the whole app before any page could even render (blank screen, no error), since `getDeviceInfo()` is called at module-import time.
- **The Side Service's error responses and success responses use sibling fields**, `{error}` vs `{result}` - never nested inside each other. A page-side bug that checked `result.error` instead of the top-level `error` swallowed every error message and showed "Unknown (undefined)" instead.
