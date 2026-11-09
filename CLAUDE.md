# Project notes for Claude

## Git rules (from the owner, permanent)

- Never add Claude as a co-author. No `Co-Authored-By` trailer and no Claude or session attribution line in any commit message.
- Commit as Lei Singha. One logical change per commit, with a message that says what changed and why.
- Commit as you go. Do not batch finished work into one big commit.

## What this is

A course artifact for DG8117 (Introduction to Game Design, TMU Master of Digital Media, Fall 2026). The Create rubric grades whether the thing exists, whether one beat is complete, whether the tool fits the work, and whether the files open for a stranger. Four outputs, one thing a visitor can see, play or walk in under two minutes: fixer, explainer, minigame, capture video.

## How the code is organised

- Static pages. Open `START_HERE.html` directly from disk. No server needed.
- `01_Fixer/fixer.js` is plain JavaScript. The explainer and minigame are written in `src/` and bundled with esbuild into `02_Explainer/explainer.js` and `03_Minigame/minigame.js`. Run `npm run build` after changing anything in `src/`, and commit the rebuilt bundles with the source change.
- Minigame code map: `src/levels.js` holds the three cards as data (parts, what a screen reader says, fix options, hints). `src/sound.js` holds speech, tones and the `voice` machine. `src/minigame.js` holds the round, the card scene, the flip, the level map and the Complete screen. `shared/rules.js` is the fixer's rule list, also read by the game's Hint button. `tests/check.py` is the browser test; run it after every change.
- Every page runs on small named state machines from `shared/machine.js`. Each one writes its state onto `<body>` as a `data-*` attribute. `STATE_MACHINES.md` lists every state and event. Keep that file in sync when a machine changes.

## Rules for changes

- Keep it working from `file://` with no network.
- Every word and control must exist in real HTML. The canvas is `aria-hidden` and only repeats the same content visually.
- Respect `prefers-reduced-motion`. No timers in the game.
- Keep code at an introductory level: plain loops and functions, no clever tricks. The owner has to be able to read it and explain it in class.
- The owner writes their own prose. Do not rewrite the "Tool choice" paragraph in the README.
