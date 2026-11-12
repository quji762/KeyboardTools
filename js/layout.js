/* ==========================================================================
   KeyLab 键盘布局数据（ANSI 104 键位）
   所有键位以 KeyboardEvent.code 标识，与系统键盘布局、输入法无关。
   ========================================================================== */

(function () {
  "use strict";

  const k = (code, label, sub, w) => ({ code, label, sub: sub || "", w: w || 1 });

  const digits = [
    k("Backquote", "`", "~"),
    k("Digit1", "1", "!"),
    k("Digit2", "2", "@"),
    k("Digit3", "3", "#"),
    k("Digit4", "4", "$"),
    k("Digit5", "5", "%"),
    k("Digit6", "6", "^"),
    k("Digit7", "7", "&"),
    k("Digit8", "8", "*"),
    k("Digit9", "9", "("),
    k("Digit0", "0", ")"),
    k("Minus", "-", "_"),
    k("Equal", "=", "+")
  ];

  const letters = {
    KeyQ: "Q", KeyW: "W", KeyE: "E", KeyR: "R", KeyT: "T",
    KeyY: "Y", KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P",
    KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G",
    KeyH: "H", KeyJ: "J", KeyK: "K", KeyL: "L",
    KeyZ: "Z", KeyX: "X", KeyC: "C", KeyV: "V", KeyB: "B",
    KeyN: "N", KeyM: "M"
  };

  const letterKeys = (codes) => codes.map((code) => k(code, letters[code], ""));

  const row0 = digits.concat([k("Backspace", "Backspace", "⌫", 2)]);

  const row1 = [k("Tab", "Tab", "⇥", 1.5)]
    .concat(letterKeys(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"]))
    .concat([k("BracketLeft", "[", "{"), k("BracketRight", "]", "}"), k("Backslash", "\\", "|", 1.5)]);

  const row2 = [k("CapsLock", "Caps", "⇪", 1.75)]
    .concat(letterKeys(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"]))
    .concat([k("Semicolon", ";", ":"), k("Quote", "'", "\""), k("Enter", "Enter", "↵", 2.25)]);

  const row3 = [k("ShiftLeft", "Shift", "⇧", 2.25)]
    .concat(letterKeys(["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"]))
    .concat([k("Comma", ",", "<"), k("Period", ".", ">"), k("Slash", "/", "?"), k("ShiftRight", "Shift", "⇧", 2.75)]);

  const row4 = [
    k("ControlLeft", "Ctrl", "", 1.25),
    k("MetaLeft", "Win", "⌘", 1.25),
    k("AltLeft", "Alt", "", 1.25),
    k("Space", "Space", "", 6.25),
    k("AltRight", "Alt", "", 1.25),
    k("MetaRight", "Win", "⌘", 1.25),
    k("ContextMenu", "Menu", "≣", 1.25),
    k("ControlRight", "Ctrl", "", 1.25)
  ];

  const nav = [
    { code: "Insert", label: "Ins", sub: "Insert", row: 1, col: 1 },
    { code: "Home", label: "Home", sub: "↖", row: 1, col: 2 },
    { code: "PageUp", label: "PgUp", sub: "Page Up", row: 1, col: 3 },
    { code: "Delete", label: "Del", sub: "Delete", row: 2, col: 1 },
    { code: "End", label: "End", sub: "↘", row: 2, col: 2 },
    { code: "PageDown", label: "PgDn", sub: "Page Down", row: 2, col: 3 },
    { code: "ArrowUp", label: "↑", sub: "Up", row: 4, col: 2 },
    { code: "ArrowLeft", label: "←", sub: "Left", row: 5, col: 1 },
    { code: "ArrowDown", label: "↓", sub: "Down", row: 5, col: 2 },
    { code: "ArrowRight", label: "→", sub: "Right", row: 5, col: 3 }
  ];

  const numpad = [
    { code: "NumLock", label: "Num", sub: "Lock", row: 1, col: 1 },
    { code: "NumpadDivide", label: "/", sub: "Div", row: 1, col: 2 },
    { code: "NumpadMultiply", label: "*", sub: "Mul", row: 1, col: 3 },
    { code: "NumpadSubtract", label: "−", sub: "Sub", row: 1, col: 4 },
    { code: "Numpad7", label: "7", sub: "Home", row: 2, col: 1 },
    { code: "Numpad8", label: "8", sub: "↑", row: 2, col: 2 },
    { code: "Numpad9", label: "9", sub: "PgUp", row: 2, col: 3 },
    { code: "NumpadAdd", label: "+", sub: "Add", row: 2, col: 4, h: 2 },
    { code: "Numpad4", label: "4", sub: "←", row: 3, col: 1 },
    { code: "Numpad5", label: "5", sub: "", row: 3, col: 2 },
    { code: "Numpad6", label: "6", sub: "→", row: 3, col: 3 },
    { code: "Numpad1", label: "1", sub: "End", row: 4, col: 1 },
    { code: "Numpad2", label: "2", sub: "↓", row: 4, col: 2 },
    { code: "Numpad3", label: "3", sub: "PgDn", row: 4, col: 3 },
    { code: "NumpadEnter", label: "↵", sub: "Enter", row: 4, col: 4, h: 2 },
    { code: "Numpad0", label: "0", sub: "Ins", row: 5, col: 1, w: 2 },
    { code: "NumpadDecimal", label: ".", sub: "Del", row: 5, col: 3 }
  ];

  window.KB_LAYOUT = {
    fn: {
      groups: [
        [k("Escape", "Esc", "Esc")],
        [k("F1", "F1"), k("F2", "F2"), k("F3", "F3"), k("F4", "F4")],
        [k("F5", "F5"), k("F6", "F6"), k("F7", "F7"), k("F8", "F8")],
        [k("F9", "F9"), k("F10", "F10"), k("F11", "F11"), k("F12", "F12")]
      ],
      tail: [
        k("PrintScreen", "PrtSc", "SysRq"),
        k("ScrollLock", "ScrLk", "Lock"),
        k("Pause", "Pause", "Break")
      ]
    },
    main: [row0, row1, row2, row3, row4],
    nav: nav,
    numpad: numpad
  };
})();