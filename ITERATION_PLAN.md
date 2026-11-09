# Iteration plan: from "Sounds Wrong" to a game you handle and hear

The game becomes the centre, built from the pieces that already exist. Two iterations:

- **Iteration 1, tonight (Nov 8):** flip the card, hear it, make it feel good. One card, same beat.
- **Iteration 2, Refine gate (Nov 29):** levels, a level map, and the fixer as a hint. This becomes the "after" in Refine's before and after.

**Hard rule for tonight:** if Iteration 1 isn't passing its checks by **10:45 pm**, submit the current zip as it is. The current build is complete and opens. Nothing in this plan is allowed to put that at risk.

---

## Iteration 1 · Tonight

### Goal

In "Sounds Wrong", a visitor can turn the card over to see its accessibility tree, hear what each part says, and feel each fix land. It's still one card, three broken parts and no timer, and it can still be played twice.

### Decisions (defaults, change if you disagree)

| Question | Default for tonight | Why |
|---|---|---|
| Voice | Browser speech (`speechSynthesis`), on by default, `M` to mute | Works offline with no files. Your own recorded clips can replace it in Iteration 2. |
| Flip control | A real **Flip card** button, the `F` key, or dragging the card | The button means no one depends on dragging. |
| Camera | Switch the minigame to a perspective camera with a narrow field of view | A flip only reads as 3D with perspective. The card still looks flat when face-on. |
| Sound effects | Generated with the Web Audio API (a short chime and a soft thud) | No audio files, so it still works from `file://`. |

### Changes, in commit order

Each row is one commit, authored as Lei Singha with no co-author line. `npm run build` runs before any commit that touches `src/`.

**1. `refactor(minigame): group the card so it can turn`**
- `src/minigame.js`: put the card background, its shadow and the five part meshes into one `THREE.Group` called `cardFront`. Put that inside a parent group called `card`, which is the thing that rotates.
- Swap `OrthographicCamera` for `PerspectiveCamera` (FOV about 20°, pulled back so the card fills the same space). Click picking still uses the same `Raycaster` code.
- **Check:** the game looks and plays exactly as before, and the existing test script passes.

**2. `feat(minigame): back of the card shows its accessibility tree`**
- Add a `cardBack` group, rotated 180° so it faces the camera once the card is flipped. Plane meshes are one-sided by default, so the front disappears from behind without extra code.
- On the back, show five spheres in the same layout as the explainer's Stop 3, with role and name labels. Broken parts are hollow red wireframes, fixed parts are solid green, and fine parts are white.
- A `refreshTree()` function updates the spheres from `round.broken` and `round.fixed`. It's called wherever `refreshBadges()` is called now.
- **DOM side:** the inspect panel gets a "Tree view" line for the selected part, for example `role: button, name: ""`. Screen reader users get the same information without the canvas.

**3. `feat(minigame): flip the card with a button, the F key or a drag`**
- A new **side** machine:

  | From | Event | To |
  |---|---|---|
  | front | FLIP | turning-to-back |
  | turning-to-back | DONE | back |
  | back | FLIP | turning-to-front |
  | turning-to-front | DONE | front |

  FLIP is ignored while the card is turning, so mashing F can't break it.
- In the render loop, ease `card.rotation.y` toward 0 or π. With reduced motion it jumps straight there and sends DONE immediately.
- Drag: on pointerdown on the canvas, remember the x position. On pointerup, a drag of more than 40px sends FLIP. A short click still selects a part, as now.
- The **Flip card** button sits under the canvas. Its label says "Show accessibility tree" or "Show the screen", and it has `aria-pressed`.
- The game keeps working on either side: list selection, fixes and the win state are the same.

**4. `feat(minigame): speak what a screen reader would say`**
- A new **voice** machine, `on ↔ muted`, toggled with the `M` key or a **Sound** checkbox.
- `speak(text)` cancels anything already speaking, then says the part's `badSays` or `okSays` text. After a correct fix, it says the new `okSays`, so "button" becomes "Subscribe, button".
- If `speechSynthesis` doesn't exist, the voice machine starts in `muted` and the checkbox is disabled, with a note.
- **Known clash:** a visitor who already uses a screen reader will hear two voices. The Sound checkbox sits at the top of the game panel, and the lede tells them to press `M`.

**5. `feat(minigame): add chime, snap and a Complete screen`**
- `playTone(freq, length)` uses one oscillator and one gain envelope. The rising two-note chime plays on a correct fix, and a low thud plays on a wrong choice. Both are silent when the voice machine is muted.
- Snap: a fixed part scales down slightly, then springs past full size and settles back. This reuses the existing `pulses` loop.
- Complete screen, in the existing `win()` panel, laid out in the style of The Cube's end screen: three large stats (parts heard, wrong tries, flips used), plus **Play again**. The confetti is kept.
- The card auto-flips to the back on win, so the visitor sees a fully green tree. This is skipped with reduced motion.

**6. `docs: update state machines, README and start page for the flip and voice`**
- `STATE_MACHINES.md`: add tables for **side** and **voice**.
- README and `START_HERE.html`: update the minigame description and add the controls `F` and `M`.
- Leave the "Tool choice" paragraph alone.

**7. `docs: re-record capture video`**
- The capture script flips the card, plays one round with sound captured, then plays a second round.
- Waits on `data-side`, `data-game` and `data-travel` instead of timers.

### Checks before submitting

Each of these is a scripted Playwright check, except where marked.

- [ ] All four pages open from `file://` with no console errors.
- [ ] `data-side` goes front → turning-to-back → back → turning-to-front → front, and FLIP is ignored while turning.
- [ ] A round can be won on either side of the card, and Play again works after winning on the back.
- [ ] With reduced motion forced, the flip is instant and there's no confetti.
- [ ] With voice muted, `speechSynthesis.speak` is never called. Check this by wrapping it in the test.
- [ ] Keyboard only: Tab to the list, Enter on a part, F to flip, M to mute, then choose a fix. Focus is never lost.
- [ ] **Manual:** two minutes with VoiceOver (Cmd+F5) on the minigame.
- [ ] Rebuild the zip, and attach the `.mp4` separately in D2L.

### Time budget

| Step | Estimate |
|---|---|
| 1–3: group, tree back, flip | 70 min |
| 4: voice | 20 min |
| 5: juice and Complete screen | 30 min |
| 6–7: docs, capture, zip, checks | 40 min |
| **Total** | **about 2 h 40 min**, which ends around 10:45 pm if started at 8:05 |

If running late, cut in this order: drag-to-flip (the button and F key are enough), then the auto-flip on win, then the Complete screen layout (keep the old win panel).

---

## Iteration 2 · Refine gate (due Nov 29)

The before is Iteration 1's single card. The after is a short, finite game with three levels.

1. **Shared rules.** Move the fixer's `RULES` into `shared/rules.js`, so the fixer and the game use the same checks. This is one source of truth.
2. **Levels as data.** A `LEVELS` array, where each level is a card (parts, positions, broken options, and which rule it teaches):
   - Newsletter card (current): image alt, button name, link text.
   - Login form: input labels, error message linked to its field, page language.
   - Nav bar: icon-only links, heading order, a `div` used as a button.
3. **Level map.** The explainer's track and tile become the map between levels. Clearing a card sends the tile to the next stop. There are three stops and then an ending. No points and no streaks.
4. **Hints from the fixer.** "Run the checker" shows the fixer's diff for the selected part and costs one hint. Hints used is a Complete-screen stat.
5. **Your own audio.** Replace browser speech with clips you design: before and after lines for each part, plus the chime and thud. Fall back to browser speech if a clip is missing.
6. **Cut one thing, keep one thing.** Candidate cut: the separate explainer page, if the level map and the card's back side now teach the same thing. Candidate keep: the flip.
7. **Outside the code:** the practitioner interview from the Research gate, and one cold playtest with someone who hasn't seen it.

New machines: **level** (`map → playing → cleared → map`, and `→ finished` after the last level) and **hint** (`available → shown`, per part).
