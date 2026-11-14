<div align="center">

# KeyboardTools

**Keyboard diagnostics for Windows — test every key, catch key chatter.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/quji762/KeyboardTools?style=flat-square)](https://github.com/quji762/KeyboardTools/releases/latest)
[![Release build](https://github.com/quji762/KeyboardTools/actions/workflows/release.yml/badge.svg)](https://github.com/quji762/KeyboardTools/actions/workflows/release.yml)
[![CI](https://github.com/quji762/KeyboardTools/actions/workflows/ci.yml/badge.svg)](https://github.com/quji762/KeyboardTools/actions/workflows/ci.yml)

</div>

---

**KeyboardTools** is an Electron-based desktop utility for Windows that helps you:

- verify that **every key on your keyboard actually works**, and
- diagnose **key chatter** — a worn, oxidized or dirty switch registering a single physical press as multiple keystrokes.

Everything runs locally: the app never goes online, and no keystroke data ever leaves your machine.

Current version: **v1.1.0** — see [CHANGELOG.md](CHANGELOG.md).

## Download

Grab the latest build from [**Releases**](https://github.com/quji762/KeyboardTools/releases/latest):

| File | Type | Notes |
| --- | --- | --- |
| `KeyboardTools-<version>-setup.exe` | Installer | Per-user NSIS install, choose the install folder, desktop / Start-menu shortcuts, uninstaller included |
| `KeyboardTools-<version>-portable.exe` | Portable | Single executable, nothing to install; the first launch unpacks the runtime and may take a few seconds |

Both builds are unsigned, so Windows SmartScreen may warn about an "unknown publisher". If you downloaded the file from this repository's Releases page, choose **More info → Run anyway**.

- Requirements: Windows 10 / 11, x64.
- Single instance: launching it again simply focuses the already-running window.

## Features

### Key test

- Complete ANSI 104-key layout: function row, main cluster, navigation cluster, arrow keys and numpad.
- Keys are identified by physical position (`KeyboardEvent.code`) — unaffected by the OS keyboard layout or IME.
- Keys highlight in real time while held and keep a "tested" marker afterwards, so dead keys stand out.
- Live stats: tested keys and coverage, currently held keys plus session peak (a rough NKRO check), total keystrokes.
- Per-key detail: `event.key`, `event.code`, `keyCode`, modifier side, long-press repeat state and trigger time.
- Last 12 keystrokes, with a one-click reset.

### Chatter test

Detects keys that fire more than once per physical press — typical for worn or oxidized switches and firmware issues.

- Judgment threshold: **20 ms / 30 ms / 50 ms** (default 30 ms), persisted locally.
- Two fault patterns are recognized:
  1. **Bounce after release** — the same key produces a new `keydown` within the threshold after its `keyup`;
  2. **Repeat before release** — a fresh (non-`repeat`) `keydown` arrives while the key is still held.
- OS auto-repeat from long presses (`event.repeat`) is excluded, so holding a key never flags a fault.
- Live readout: current key, press / release state, current gap and this key's fault count.
- Stats: monitored keys and coverage, total faults, number of faulty keys, shortest fault gap.
- "Faulty keys" is sorted by fault count and shows each key's shortest gap and last fault time; "fault events" keeps the latest 12 entries.
- Pause / resume monitoring and clear records; switching thresholds clears old records to avoid mixing standards.
- Pressed states reset on window blur, minimize or tab switch, so a lost `keyup` can never cause a false positive.

## Usage tips

### Diagnosing a chattering key

1. Open the **Chatter** tab and pick a threshold — start with the default 30 ms; use 50 ms to hunt severe jitter, 20 ms to be strict.
2. Tap keys normally, or repeatedly hit the key you suspect.
3. If the key shows up under "Faulty keys" and its event gaps are far below human repeat speed, the switch is chattering.
4. Compare with another keyboard, or clean / replace the switch and retest.

### Rollover (NKRO) check

Hold as many keys as you can on the **Key test** tab and watch the "held keys" peak. The number only reflects what the browser / Electron actually receives — it is not a substitute for hardware-level NKRO testing.

> OS-level shortcuts (Win, Alt+Tab, …) are intercepted by the operating system before the app ever sees those keys.

## Privacy & data

- The app makes no network requests; keystrokes are processed in memory only.
- Chatter threshold, theme and key-sound preferences are stored in the renderer's local storage.
- Window size and position are stored in `%APPDATA%\KeyboardTools\window-state.json`.
- Deleting that folder (or clearing the app's data) restores all defaults.

## Project structure

```text
KeyboardTools/
├── index.html              # Renderer page (key test + chatter test)
├── assets/
│   └── styles.css          # Theme, keyboard, fault panel and responsive styles
├── js/
│   ├── layout.js           # ANSI 104-key layout data
│   ├── keyboard.js         # Key test: highlight, stats, key log
│   ├── chatter.js          # Chatter test: detection, stats, fault lists
│   └── app.js              # Tabs, theme, key sound, desktop info
├── electron/
│   ├── main.js             # Main process: window, single instance, navigation guard
│   ├── preload.js          # Preload: read-only app-info bridge only
│   └── smoke.js            # Headless self-check (--smoke-test)
├── scripts/
│   └── generate_icon.py    # App icon generator (Pillow)
├── build/                  # Icons
├── dist/                   # Build output (git-ignored)
├── .github/
│   └── workflows/          # CI and release pipelines
├── package.json
├── CHANGELOG.md
├── README.md               # This file (primary)
└── README.zh-CN.md         # Chinese version
```

## Development

Requirements: Windows 10 / 11 x64 and Node.js 20+.

```bash
npm install          # install Electron / electron-builder (devDependencies only)
npm start            # run the app in a desktop window
npm run smoke        # headless self-check (24 assertions)
npm run dist         # build BOTH Windows targets into dist/: NSIS installer + portable exe
npm run dist:dir     # build an unpacked directory for quick manual testing
```

The runtime has zero third-party dependencies — Electron and electron-builder are devDependencies only.

### Smoke test coverage

`npm run smoke` runs 24 assertions in a real Electron renderer:

- the 104-key layout renders completely;
- normal tapping never false-positives; bounce and held-key repeats are detected;
- long-press `repeat` events are excluded; different keys do not interfere;
- threshold switching, pause / resume, record clearing and blur protection;
- key-test stats, theme switching, desktop bridge and version info;
- real key events injected through the DevTools protocol to verify the actual input path.

The same suite runs in CI, and the packaged executable is validated with `KeyboardTools.exe --smoke-test`.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and bump `version` in `package.json` (keep `package-lock.json` in sync).
2. Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. GitHub Actions (`release.yml`) runs the smoke test, builds the installer and portable executable on Windows, and publishes a GitHub Release with both artifacts attached.

## Known limitations

- Keys are only detected while the app window has focus; no global hooks are installed, so input in other programs is never recorded.
- Extra keys found on non-ANSI keyboards (JIS-specific or multimedia keys) are not counted in the 104-key coverage or in fault detection.
- The threshold is a guideline: human re-presses (almost always slower than 30 ms) never count as faults, but extreme input devices or macros may produce borderline results.
- Builds are not code-signed, so SmartScreen shows a warning on first run.

## License

For personal learning and everyday diagnostics use.
