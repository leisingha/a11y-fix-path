# State machines in A11y Fix Path

Each page used to keep its state in loose variables and in whatever HTML happened to be on screen. Now each page names its states and lists which events move between them. All the pages share one small helper, `shared/machine.js`, which is about 40 lines long.

```js
var light = createMachine('light', 'off', {
  off: { PRESS: 'on' },
  on:  { PRESS: 'off' }
});
light.send('PRESS'); // 'on'. An event that isn't in the table for the current state is ignored.
```

Each machine also writes its state onto the page as `<body data-light="on">`, keeps its last 50 transitions, and can be inspected in the browser console at `A11yFixPath.machines`.

## 1 · Fixer (`01_Fixer/fixer.js`)

**checker**: `unchecked → open | clear → stale → open | clear`

| From | Event | To | When |
|---|---|---|---|
| unchecked, open, clear, stale | ISSUES | open | A check finds problems |
| unchecked, open, clear, stale | NONE | clear | A check finds nothing |
| open, clear | EDIT | stale | You type in the code box |
| open, clear, stale | RESET | unchecked | Reset sample |

Each issue also has a small lifecycle: **open → fixed** or **open → kept** (rejected on purpose).

**Bug this fixed:** a fix used to be applied at a character position worked out from the old code. If you edited the code and then pressed Accept, the fix landed in the wrong place and corrupted the code. Now, in `stale`, Accept checks the code again first, and fixes are matched by their text, not by their position.

## 2 · Explainer (`02_Explainer/explainer.js`)

The tour is a plain list of 10 steps. The step number is the main state, shown as `data-step` and `data-phase` (`intro`, `before`, `fixing`, `after`, `done`). Three machines sit beside it:

| Machine | States | Purpose |
|---|---|---|
| **view** | loading → ready / unavailable | Did WebGL start? If not, the text panel still carries everything. |
| **motion** | animated ↔ reduced | Starts from the system's reduced-motion setting, and follows it if it changes while the page is open. The checkbox also toggles it. |
| **travel** | resting ↔ traveling | Is the 3D button moving between stops? GO starts a trip and ARRIVE ends it. |

**Bug this fixed:** the reduced-motion setting was read only once, when the page loaded.

## 3 · Minigame (`03_Minigame/minigame.js`)

**game**

| From | Event | To |
|---|---|---|
| intro, hearing-fine, hearing-broken | HEAR_FINE | hearing-fine |
| intro, hearing-fine, hearing-broken | HEAR_BROKEN | hearing-broken |
| hearing-broken | WRONG | hearing-broken |
| hearing-broken | FIX | hearing-fine |
| hearing-broken | WIN | won |
| won | NEW_ROUND | intro |

Each part also has a lifecycle for the round. A fine part goes **unheard → heard**. A broken part goes **unheard → heard → fixed**.

**Bugs this fixed:**
- Clicking a part after winning used to replace the "Play again" panel, so the only way to play again was to reload the page. In `won`, selection is now ignored.
- A wrong answer could be counted again if you left a part and came back to it. Wrong answers are now remembered per part.
- Choosing an answer used to delete the focused button, which dropped keyboard and screen reader users back to the top of the page. Focus now moves to the part's heading or to the Play again button. The fixer had the same problem, and focus there now moves to the results summary.

## Why this helps

- **Visitors:** none of the dead ends or lost focus described above.
- **Me as the developer:** every page's behaviour is in one table I can read and explain.
- **Automated agents and tests:** the `data-*` attributes say exactly what the page is doing, so a script can wait for `data-travel="resting"` instead of guessing with timers. The capture video was recorded this way.
