# Changelog

All notable changes to KeyboardTools are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-14

### Added

- Windows **installer** build (NSIS): per-user install with a selectable installation directory, desktop / Start-menu shortcuts and an uninstaller, shipped alongside the existing portable executable. `npm run dist` now builds both targets — `KeyboardTools-<version>-setup.exe` and `KeyboardTools-<version>-portable.exe`.
- GitHub Actions pipelines:
  - `release.yml` — on `v*` tags (or manual dispatch): smoke test → build the installer and portable executable on Windows → publish a GitHub Release with both artifacts attached;
  - `ci.yml` — smoke test on every push to `main` and on pull requests.
- Bilingual documentation: English `README.md` as the primary page with a Chinese version at `README.zh-CN.md`; this changelog now follows the Keep a Changelog format.

### Fixed

- Chatter test: clicking the already-selected threshold button no longer clears all recorded data. Records are reset only when the threshold actually changes (the reset-on-change behavior is unchanged).
- Cleaned up dead code left over from the 1.0 rename:
  - removed the never-applied `unknown` / `is-unknown` CSS classes and their reset logic in the key test;
  - removed CPS-tester-era styles (`.cps-card`, `.score-list`) that no longer had matching elements;
  - removed the unused `.tab-indicator` element and its style;
  - removed an empty `try/catch` block in the chatter panel initialization;
  - removed the `keyboardtools:themechange` event, which had no listener;
  - removed an unused parameter of the chatter fault recorder.
- Removed a theme-button CSS rule that could never match (its selector required the element to be a descendant of itself; the intended styling was already covered by the generic pressed-state rule).

## [1.0.0] - 2026-11-13

First stable release. The project was renamed from KeyLab to KeyboardTools and reworked from a CPS click-speed tester into a keyboard diagnostics tool.

### Desktop app

- Standalone Electron window hosting the key test / chatter test UI, distributed as a portable executable.
- Single-instance running; window size and position are remembered across sessions with multi-monitor visibility checks.
- Page refresh and DevTools shortcuts are blocked in production builds; external navigation and pop-ups are prevented; F11 fullscreen is supported.
- The footer shows the app version; hovering reveals the Electron / Chromium versions.

### Key test

- Complete ANSI 104-key layout identified by physical `KeyboardEvent.code`, independent of OS keyboard layout and IME.
- Real-time highlighting with persistent "tested" markers; stats for coverage, held-key peak and total keystrokes.
- Per-key detail: `event.key`, `event.code`, `keyCode`, modifier side, long-press repeat state and trigger time.
- Last 12 keystrokes with a one-click reset.

### Chatter test

- 20 ms / 30 ms / 50 ms judgment thresholds (default 30 ms), persisted locally.
- Detects bounce-after-release and repeat-before-release patterns; system auto-repeat (`event.repeat`) is excluded.
- Stats for monitored keys, total faults, faulty key count and shortest fault gap.
- Sorted faulty-key list, the latest 12 fault events, pause / resume and clear-records controls; switching thresholds clears old records.
- Pressed states reset on window blur, minimize or tab switch to avoid lost-`keyup` false positives.

### Other

- Dark / light theme, optional key sound (off by default), responsive layout.
- All data is processed locally; the app never makes network requests.

### Fixed

- Prevented the `hidden` attribute from being overridden by component `display` rules.
- Non-layout keys no longer inflate key coverage; coverage can no longer exceed 100%.
- The current-gap readout no longer carries stale values across different keys; fault timestamps display correctly.
- Audio device failures no longer interrupt key handling.
- Unavailable local storage no longer breaks initialization.
- The main-process navigation guard no longer blocks same-file anchor jumps.

### Verification

- 24 automated smoke assertions pass on the dev build and the packaged executable.
- Layout checked for horizontal overflow at 320–1440 px widths.
