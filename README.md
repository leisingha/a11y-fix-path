# A11y Fix Path

Lei Singha · DG8117 Introduction to Game Design · Create · Make the Thing · Fall 2026

An icon-only button looks fine, but a screen reader user hears only "button". This project walks one visitor through that bug in under two minutes, in three moves.

1. **Find it.** A fixer checks a React component, proposes `aria-label="Subscribe"`, and re-checks after you accept.
2. **See why.** In a 3D scene, the button rides a track through four stops: the JSX code, the DOM as a tree of boxes, the accessibility tree as a tree of spheres, and a speaker that gives off sound rings. It goes once before the fix and once after.
3. **Practice.** In "Sounds Wrong", a card looks finished but three of its five parts are broken for screen reader users. Inspect each part, hear what it says, and pick the fix. There is no timer, and each round breaks a different set.

## How to open it

Clone the repo and double-click **START_HERE.html**. It opens in any current browser from the folder, with no install and no internet needed.

If a page does not open on your machine, watch `04_Capture/A11yFixPath_capture.mp4`.

## Folder map

| Path | What it is |
|---|---|
| `START_HERE.html` | Start page that links the three pieces |
| `01_Fixer/` | Fixer: five WCAG checks, accept or reject, re-check (plain HTML and JavaScript) |
| `02_Explainer/` | 3D explainer (Three.js, built from `src/explainer.js`) |
| `03_Minigame/` | "Sounds Wrong" 2D minigame (Three.js, built from `src/minigame.js`) |
| `04_Capture/` | Capture video of the whole path |
| `shared/` | Shared styles and the state machine helper |
| `src/` | Readable source for the two Three.js pieces |
| `STATE_MACHINES.md` | Every state machine, its events, and the bugs they fixed |

## Build

The built bundles are committed so the pages open straight from the folder. To rebuild them from `src/`:

```
npm install
npm run build
```

## Tool choice

I built everything as static web pages because the people I want to hire me are front-end teams, and they ship accessible interfaces in the browser. Three.js draws the explainer and the game, but every word and control also exists in the page itself, so the pieces work with a keyboard and a screen reader, which is the skill the work is meant to show.

## Accessibility notes

- The 3D canvas is hidden from assistive technology. The step text, the list of card parts and every control are real HTML.
- Everything works by keyboard. The explainer uses the arrow keys, and in the game you Tab to a part and press Enter.
- Camera movement is off when the system asks for reduced motion, and a checkbox can turn it off at any time.
- The game has no timer and no fail state.

## What is not in this build yet

- The fixer runs in the browser, not yet as a VS Code extension. The checking logic is the part that will move into the extension.
- The fixer uses simple pattern matching on the sample code, not a full JSX parser, so unusual code may not be caught.
- The practitioner interview committed to in the Research gate has not happened yet.
