# Build plan (tonight): "Sounds Wrong" becomes a three-level game

One build, implemented tonight, Sun Nov 8. The dropbox closes at **11:59 pm**.

The current build is the fallback. It is complete, it opens, and it is already zipped. Nothing here may break it before the new build passes its checks.

## The result in one paragraph

The minigame becomes the centre of the artifact. A visitor plays three short levels, each one a different interface card: a newsletter card, a sign-in form and a nav bar. Each card is a real 3D object that can be flipped. The front shows what sighted users see, and the back shows the card's accessibility tree, where broken parts are hollow red nodes. Inspecting a part plays what a screen reader would say. A correct fix chimes, snaps into place, and turns the node solid green. Below the card, a track with three stops is the level map: clearing a card sends the blue button tile to the next stop. Stuck players can run the fixer's checker on a part as a hint. After three levels there is an ending screen with stats, and the game is over. There are no points to chase, no streaks and no timer.

## Timeline and safety rules

| Time | Milestone |
|---|---|
| 8:10 | Start commit 1 |
| 9:00 | Commits 1–4 done: the card turns and has a tree on the back |
| 9:40 | Commits 5–7 done: voice, sound, levels |
| 10:25 | Commits 8–10 done: map, hints, Complete screen |
| **10:45** | **Feature freeze.** Whatever isn't working gets cut (see the cut order) |
| 11:15 | Docs, capture video, zip, checks done |
| 11:30 | Upload the zip and the `.mp4` to D2L, click **Submit** |

- **Rule 1:** after every commit, run `npm run build` and the test script. If it fails, fix it before starting the next commit.
- **Rule 2:** if commit 7 (levels) isn't passing by 9:50, stop. Ship commits 1–6 as a one-card version. That is still a big step up.
- **Rule 3:** if nothing new passes by 10:45, upload the existing zip.

**Cut order**, first to go first: drag-to-flip (the button and F key are enough) → auto-flip on win → hints → the level map animation (a plain "Level 2 of 3" line is enough) → level 3.

## Git rules

Follow `CLAUDE.md`. Commit as Lei Singha. Never add a `Co-Authored-By` trailer or any Claude or session line. Make one commit per step below, and push after every three commits.

---

## Files touched

| File | Change |
|---|---|
| `shared/rules.js` | **New.** The fixer's `RULES` array, moved here unchanged, as a plain global script |
| `01_Fixer/index.html` | Load `../shared/rules.js` before `fixer.js` |
| `01_Fixer/fixer.js` | Delete its own `RULES`, since it now comes from `shared/rules.js` |
| `src/levels.js` | **New.** The three levels as data |
| `src/sound.js` | **New.** `speak()`, `playTone()` and the voice machine |
| `src/minigame.js` | Most of the work: the card group, flip, tree back, levels, map, hints and Complete screen |
| `03_Minigame/index.html` | Flip and Sound controls, hint button, level line, load `rules.js` |
| `STATE_MACHINES.md`, `README.md`, `START_HERE.html` | Docs |
| `04_Capture/A11yFixPath_capture.mp4` | Re-recorded |

`src/levels.js` and `src/sound.js` are ES modules imported by `minigame.js`, and esbuild bundles them. `shared/rules.js` is a plain `<script>` that defines a global `RULES`, so the fixer, which isn't bundled, can use it too. Inside the bundle, read it as `window.RULES`.

---

## Commit 1 · `refactor(fixer): move the five rules into shared/rules.js`

- Cut the whole `var RULES = [ ... ];` block out of `01_Fixer/fixer.js` and paste it into the new `shared/rules.js`.
- In `01_Fixer/index.html`, add `<script src="../shared/rules.js"></script>` before `fixer.js`. Keep `machine.js` before both.
- **Check:** the fixer still finds 5 issues, and accepting the button fix still passes its re-check.

## Commit 2 · `refactor(minigame): move the card into its own file as level data`

Create `src/levels.js`. Each level is an object, and each part has everything the game needs: drawing, position, before and after text, tree data, fix options and a hint.

```js
// src/levels.js
// Each level is one interface card. Each card has five parts.
// Every round, three of the five are broken at random.
// x, y, w, h are in card units: the card is 392 wide and 452 tall, centred on 0,0.
export var LEVELS = [
  {
    id: 'newsletter',
    title: 'Newsletter card',
    teaches: 'Names for images, buttons and links',
    mustBreak: 'button', // the first play always includes the explainer's button
    parts: [
      {
        id: 'img', label: 'Envelope image', draw: 'envelope',
        x: 0, y: 110, w: 120, h: 120,
        role: 'image', nameBefore: '"envelope.png"', nameAfter: '(hidden: decoration)',
        okSays: 'Nothing (skipped as decoration). The heading already says what the card is.',
        badSays: '"envelope dot png, image"',
        badCode: '<img src="envelope.png" />',
        rule: 'img-alt', // matches an id in shared/rules.js, used by the hint
        options: [
          { code: 'alt="image"', ok: false, why: '...' },
          { code: 'alt=""', ok: true, why: '...' },
          { code: 'title="envelope.png"', ok: false, why: '...' }
        ]
      }
      // ...the other four, moved from the PARTS array in minigame.js
    ]
  },
  // Level 2: login, Level 3: nav. Contents are listed below.
];
```

- Move the existing `PARTS` array into level 1. Copy the `why` text exactly as it is. Add `role`, `nameBefore`, `nameAfter`, `rule` and `draw` to each part.
- `rule` is `null` when the fixer has no matching rule. The hint then falls back to the part's `hint` text.
- In `minigame.js`, replace `PARTS` with `var level = 0; function parts() { return LEVELS[level].parts; }`, and use `parts()` everywhere `PARTS` was used.
- Rename the existing `DRAW` keys to the `draw` names above, and look them up with `DRAW[p.draw]`.
- **Check:** the game plays exactly as before.

### Level 2 · Sign-in form (teaches labels and states)

| id | label | draw | broken: badSays | fixed: okSays | right fix | rule |
|---|---|---|---|---|---|---|
| heading | Form title | heading "Sign in" | "Sign in" (plain text) | "Sign in, heading level 1" | use `<h1>` | null |
| email | Email field | input "Email" | "edit text, blank" | "Email, edit text" | `<label for="email">Email</label>` | input-label |
| password | Password field | input "Password" | "secure edit text, blank" | "Password, secure edit text" | `aria-label="Password"` | input-label |
| error | Error message | red text "Wrong password" | "Wrong password" read only if found by chance | "Password, invalid entry, Wrong password" | `aria-describedby="pw-error"` on the input, plus `aria-invalid="true"` | null |
| submit | Sign in button | blue box "Sign in" | not reachable by Tab, so "Sign in" is never announced as a control | "Sign in, button" | use `<button>` instead of `<div onClick>` | null |

Each part gets one right option and two plausible wrong ones, each with a one-sentence `why`. For example, for **submit**: `tabIndex="0"` is wrong because it's focusable but still not announced as a button and Enter does nothing, and `role="button"` is wrong because it's announced but Enter and Space still do nothing without extra code.

### Level 3 · Nav bar (teaches names and structure)

| id | label | draw | broken: badSays | fixed: okSays | right fix | rule |
|---|---|---|---|---|---|---|
| logo | Logo link | circle logo | "link, logo dot svg" | "Home, link" | `alt="Home"` on the image in the link | img-alt |
| search | Search button | magnifier icon | "button" | "Search, button" | `aria-label="Search"` | button-name |
| cart | Cart link | cart icon | "link" | "Cart, 2 items, link" | `aria-label="Cart, 2 items"` | link-name |
| menu | Menu | three lines | not reachable | "Menu, button, collapsed" | `<button aria-expanded="false">` | null |
| lang | Page language | "EN" chip | English words read with the wrong voice | read with the right voice | `<html lang="en">` | html-has-lang |

Keep every part's text to the length of the current ones. Use 5 parts per level and break 3.

## Commit 3 · `refactor(minigame): put the card in a group and switch to a perspective camera`

```js
var card = new THREE.Group();      // turns when flipped
var cardFront = new THREE.Group(); // background, shadow and the five parts
var cardBack = new THREE.Group();  // the tree (commit 4)
card.add(cardFront); card.add(cardBack);
scene.add(card);
cardBack.rotation.y = Math.PI;     // faces the camera once the card is flipped
```

- Add the card background, the shadow and every part mesh to `cardFront` instead of `scene`. Badges and the selection ring go in `cardFront` too.
- Camera: `new THREE.PerspectiveCamera(20, aspect, 1, 5000)` at `z = 1500`, looking at 0,0. Tune `z` so the card fills the same space as before. In `resize()`, update `camera.aspect`, and pull `z` back further when the stage is narrow.
- Mesh materials stay `MeshBasicMaterial`, with the default one-sided rendering, so the front hides itself when the card is turned.
- The raycaster code stays the same. `intersectObjects` should list only the front part meshes, and should be skipped when `side.state !== 'front'`.
- Add a function `buildCard(levelIndex)` that empties `cardFront` and `cardBack` and builds them from `LEVELS[levelIndex]`. Levels need this in commit 7.
- **Check:** the game looks and plays the same.

## Commit 4 · `feat(minigame): back of the card shows its accessibility tree`

- In `buildCard`, add to `cardBack`:
  - A title strip at the top: "Accessibility tree".
  - A root sphere (radius 22) labelled with the card type (`group`, `form` or `navigation`).
  - Five child spheres (radius 18), placed at the same x as their front part and in a row at y = −20. Lines join each child to the root.
  - Under each sphere, a label sprite with `role` and the name.
- Each part keeps references: `p.node` (the solid sphere), `p.wire` (a red wireframe sphere at the same position) and `p.nameLabel`.
- Add `refreshTree()`:
  - Broken and not fixed: `wire` visible, `node` hidden, label red, showing `nameBefore`.
  - Fixed: `node` visible and green, label green, showing `nameAfter`.
  - Fine: `node` visible and white, label grey, showing `nameAfter`.
- Call `refreshTree()` wherever `refreshBadges()` is called.
- Rebuilding a label means a new canvas texture. Keep two sprites per part (`labelBad` and `labelGood`) and toggle `visible`, the same pattern the explainer uses.
- **DOM:** the inspect panel shows a "Tree view" line under "A screen reader says", for example `role: button · name: ""`. This keeps the information in real HTML.
- **Check:** temporarily set `card.rotation.y = Math.PI` and take a screenshot. You should see three red hollow nodes and two white ones.

## Commit 5 · `feat(minigame): flip the card with a button, the F key or a drag`

```js
var side = createMachine('side', 'front', {
  'front':            { FLIP: 'turning-to-back' },
  'turning-to-back':  { DONE: 'back' },
  'back':             { FLIP: 'turning-to-front' },
  'turning-to-front': { DONE: 'front' }
});
```

- **Render loop:** a target angle of 0 for front and turning-to-front, and `Math.PI` for back and turning-to-back.
  - `card.rotation.y += (target - card.rotation.y) * 0.12;`
  - When the difference is under 0.01, snap to the target and `side.send('DONE')`.
  - With reduced motion, set the target directly and send DONE in the same frame.
  - Add a small lift while turning, `card.position.z = Math.sin(card.rotation.y) * 60`, which reads as picking the card up.
- **Button:** `<button id="flip" aria-pressed="false">Show accessibility tree</button>` under the stage. Its label switches to "Show the screen" when the card is on the back.
- **Key:** `F` sends FLIP. Ignore it while typing in an input.
- **Drag:** on canvas `pointerdown`, store `startX`. On `pointerup`, if `Math.abs(dx) > 40`, send FLIP. Otherwise treat it as a click and run the existing picking. *(First to cut.)*
- List selection, fixing and winning all work on either side. Only canvas clicks need the front.
- Count `round.flips` for the Complete screen.

## Commit 6 · `feat(minigame): speak each part and add chime and thud sounds`

New file `src/sound.js`:

```js
// Speech and simple sounds. No audio files, so it works offline from file://.
var hasSpeech = 'speechSynthesis' in window;
var audio = null; // created on the first user gesture, as browsers require

export function speak(text, voice) {
  if (!hasSpeech || voice.state !== 'on') return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text.replace(/"/g, ''));
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

// One short note: a sine wave that fades out.
export function playTone(freq, seconds, voice) {
  if (voice.state !== 'on') return;
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  var osc = audio.createOscillator();
  var gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.18, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  osc.connect(gain); gain.connect(audio.destination);
  osc.start(); osc.stop(audio.currentTime + seconds);
}

export function chime(voice) { playTone(660, 0.15, voice); setTimeout(function () { playTone(990, 0.25, voice); }, 120); }
export function thud(voice) { playTone(140, 0.2, voice); }
```

- The **voice** machine, `on ↔ muted`, is created in `minigame.js`: `createMachine('voice', hasSpeech ? 'on' : 'muted', { on: { MUTE: 'muted' }, muted: { UNMUTE: 'on' } })`.
- A **Sound** checkbox sits at the top of the game panel, and the `M` key toggles it.
- Calls:
  - `select()` speaks `badSays` or `okSays`.
  - A correct fix plays `chime()`, then speaks the new `okSays` after 300 ms.
  - A wrong fix plays `thud()`.
  - The win plays a three-note rising chime.
- **Lede text:** add "Sound on: press M to mute, for example if you use a screen reader already."
- **Test hook:** `window.A11yFixPath.spoken = []`. `speak()` pushes every line into it, so the test can check speech without listening.

## Commit 7 · `feat(minigame): three levels`

```js
var levelMachine = createMachine('level', 'playing', {
  'playing':  { CLEAR: 'cleared' },
  'cleared':  { NEXT: 'playing', FINISH: 'finished' },
  'finished': { RESTART: 'playing' }
});
```

- When `game` sends WIN:
  - If it isn't the last level, `levelMachine.send('CLEAR')`, and the panel says "Card passes" with a **Next card →** button. Focus moves to that button.
  - If it is the last level, `levelMachine.send('CLEAR')` then `FINISH`, and show the Complete screen (commit 10).
- **Next card:** `level++`, `levelMachine.send('NEXT')`, `game.send('NEW_ROUND')`, then `buildCard(level)` and `newRound()`. If the card is on the back, flip it to the front first.
- **Card swap juice:** the old card scales to 0 over about 15 frames, the new one is built, then it scales back up. With reduced motion, swap instantly.
- `round` stats keep going across levels: the totals of heard, wrong tries, flips and hints. A `newGame()` resets them.
- Score line: "Card 2 of 3 · Sign-in form · 3 of 3 problems left · wrong tries: 0".
- Write `data-level` (0, 1, 2) onto `<body>`.
- **Check:** the test script plays all three levels to `finished`.

## Commit 8 · `feat(minigame): level map track under the card`

- In the same scene, below the card (y about −300), add a white track bar, three round stops and a small blue tile with the paper-plane icon. The tile reuses the explainer's tile texture code; copy the canvas drawing function.
- Under each stop, a label sprite with the level title. Cleared stops turn green.
- **travel** machine, `resting ↔ traveling`, the same as the explainer's. On NEXT, the tile eases from stop `level - 1` to stop `level` over about 1 second, with a small hop. With reduced motion it jumps.
- Fit the camera so both the card and the track are visible. Raise the stage height to 600px.
- **DOM:** the score line already carries "Card 2 of 3", so the track adds no information the text lacks.

## Commit 9 · `feat(minigame): hint from the fixer`

- In the inspect panel for a broken part, add a **Run the checker (hint)** button.
- On click:
  - If `p.rule` matches a rule in `window.RULES`, run `rule.find(p.badCode)` and show the first result as a diff: `- old` in red, `+ fixed` in green, plus the rule's WCAG line. These are the same classes as the fixer.
  - If `p.rule` is null, show `p.hint`, a one-sentence hint written into the level data. Add `hint` to every part.
- **hint** machine per part is overkill. Store `round.hinted[p.id] = true` and disable the button after use. Count `round.hints`.
- The hint never picks the option for the player, because the options use different wording from the diff.

## Commit 10 · `feat(minigame): Complete screen, snap and auto-flip on win`

- **Snap:** after a correct fix, the part scales to 0.9, then 1.12, then 1.0, through the existing `pulses` loop. Add a `phase` value to each pulse.
- **Auto-flip on win:** if the card is on the front, send FLIP, so the visitor sees the all-green tree before the panel changes. Skip with reduced motion. *(Second to cut.)*
- **Complete screen**, shown when `level.state === 'finished'`, in the right-hand panel:
  - Heading: "Three cards, all passing".
  - Three big stats in a row: parts heard, wrong tries, hints used. Big numbers, small labels.
  - One line of plain text: "On screen, nothing changed. To a screen reader user, every card now makes sense."
  - Buttons: **Play again** (`newGame()`, back to card 1, with new broken parts) and **Back to the start**.
  - Confetti, existing, once.

## Commit 11 · `docs: update state machines, README and start page for levels, flip and sound`

- `STATE_MACHINES.md`: add tables for **side**, **voice**, **level** and **travel** (minigame). Update the game table if any event changed.
- README and `START_HERE.html`:
  - The minigame row now says three levels, flip, sound and hints.
  - Add a "Controls" line: Tab, Enter, F, M.
  - Update the expected play time. Level 1 alone still fits the two-minute beat, and the full game is about four to five minutes.
- Leave the "Tool choice" paragraph alone. Lei rewrites it.
- `CLAUDE.md`: add `src/levels.js` and `src/sound.js` to the code map.

## Commit 12 · `docs: re-record capture video`

Update `capture2.py` (in the session scripts folder) to:
- Run the fixer and the explainer as before, shortened if needed.
- In the minigame, play card 1 with one wrong try. Flip the card once before fixing and once after. Use one hint on card 2. Play card 3 straight through. Hold on the Complete screen for 4 seconds.
- Wait on `data-side`, `data-game`, `data-level` and `data-travel`, never fixed timers, except for short pauses for the viewer.
- Run Chromium with `--autoplay-policy=no-user-gesture-required`. Speech won't be in the recording, because headless speech has no audio output. Add a caption line under the title in the video: "Sound: the game speaks each part aloud."

Then rebuild the zip from the repo: copy the files into `DG8117_Singha_Create/`, leaving out `node_modules/`, `.git/` and `CLAUDE.md`.

---

## Test script (run after every commit)

One Playwright script, extended at each step:

1. All four pages load from `file://` with no console errors.
2. Fixer: check, edit (state goes stale), accept (checks again first), then the button fix passes.
3. Explainer: step to 10, and `data-travel` ends `resting`.
4. Minigame:
   - Flip: `data-side` goes front → turning-to-back → back. Pressing F during turning-to-back changes nothing.
   - Play every level to `data-level` 2 and `data-game` won, then `level` finished.
   - Use one hint. The diff appears and the hint button is disabled.
   - With speech wrapped, `A11yFixPath.spoken` has the bad and good line for the button.
   - Mute with M: no new lines are spoken.
   - Reduced motion (`page.emulate_media(reduced_motion='reduce')`): the flip is instant and there's no confetti.
   - Keyboard only: Tab, Enter, F and Enter on an option. `document.activeElement` is never `body` after an action.
5. Screenshots: card front, card back mid-game, the map after card 1, the Complete screen. Look at all four before committing commit 10.

## Manual checks (Lei, before presenting on Monday)

- Two minutes with VoiceOver (Cmd+F5) on the minigame, with in-game Sound muted.
- Open in Safari once, since speech voices differ.
- Rewrite the "Tool choice" paragraph. Add one sentence on why Three.js for the game: it shares the explainer's scene code, the tree spheres and the tile.

---

## What this means for the Refine gate (Nov 29)

Shipping everything tonight uses up the obvious before and after. For Refine, use this instead:

1. **A cold playtest** with two or three people, recorded. It produces the "next risk".
2. **Cut one thing:** most likely the separate explainer page, if players learn the same thing from flipping the card. Or cut level 3 if playtests show it's too long.
3. **Keep one thing:** the flip.
4. **Before and after:** tonight's build against the build after the playtest changes, plus Lei's own recorded audio replacing browser speech.
