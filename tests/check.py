# Run from anywhere:  python3 tests/check.py
# Opens every page from file:// and checks the flows. Extended as the game grows.
import os, sys
from playwright.sync_api import sync_playwright

ROOT = "file://" + os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
failures = []

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (" | " + str(detail) if detail and not ok else ""))
    if not ok:
        failures.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(args=GL)
    page = browser.new_page(viewport={"width": 1280, "height": 820})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    # Fixer
    page.goto(ROOT + "01_Fixer/index.html")
    page.click("#run")
    check("fixer: check finds 5 issues", "5 open" in page.text_content("#summary"), page.text_content("#summary"))
    page.locator("#code").press("Control+Home"); page.keyboard.type("// hi\n")
    check("fixer: edit makes results stale", page.get_attribute("body", "data-checker") == "stale")
    page.click("button[aria-label='Accept fix: Button has no name']")
    check("fixer: accept while stale checks again first", "checked again first" in page.text_content("#summary"))
    page.click("button[aria-label='Accept fix: Button has no name']")
    check("fixer: button fix applied", 'aria-label="Subscribe" onClick' in page.input_value("#code"))

    # Explainer
    page.goto(ROOT + "02_Explainer/index.html")
    page.wait_for_selector("body[data-view=ready]")
    while int(page.get_attribute("body", "data-step")) < 9:
        page.click("#next")
    page.wait_for_selector("body[data-travel=resting]")
    check("explainer: reaches step 10", page.get_attribute("body", "data-phase") == "done")

    # Start page and minigame load
    page.goto(ROOT + "START_HERE.html")
    check("start page: has three path links", page.locator(".path a").count() == 3)
    page.goto(ROOT + "03_Minigame/index.html")
    page.wait_for_timeout(800)
    check("minigame: loads", page.get_attribute("body", "data-game") == "intro")

    # Flip: button, F key, drag
    side = lambda: page.get_attribute("body", "data-side")
    page.click("#flip")
    page.wait_for_timeout(900)
    check("flip: button turns to the back", side() == "back" and page.is_visible("#tree"), side())
    check("flip: tree has one row per part", page.locator("#tree li").count() == 5)
    page.keyboard.press("f")
    page.wait_for_timeout(900)
    check("flip: F key turns to the front", side() == "front" and not page.is_visible("#tree"), side())
    box = page.locator("#stage canvas").bounding_box()
    page.mouse.move(box["x"] + 200, box["y"] + 200); page.mouse.down()
    page.mouse.move(box["x"] + 300, box["y"] + 200, steps=5); page.mouse.up()
    page.wait_for_timeout(900)
    check("flip: drag turns the card", side() == "back", side())
    check("flip: drag did not select a part", page.locator("#parts [aria-pressed=true]").count() == 0)

    # Play all three cards to the end using the answers in the level data
    def solve_card():
        parts = page.evaluate("window.A11yFixPath.levels[%d].parts.map(p => [p.id, p.options.find(o => o.ok).code, !!window.A11yFixPath.round.broken[p.id]])" % (int(page.get_attribute("body", "data-card")) - 1))
        for pid, ok_code, broken in parts:
            if page.get_attribute("body", "data-game") == "won": break
            page.click("#parts button[data-part=%s]" % pid)
            if broken:
                page.locator(".opts button").filter(has_text=ok_code).first.click()
    solve_card()
    check("levels: card 1 clears", page.get_attribute("body", "data-level") == "cleared" and page.get_attribute("body", "data-card") == "1")
    page.click("#next")
    check("map: tile travels", page.get_attribute("body", "data-travel") == "traveling")
    page.wait_for_function("document.body.dataset.card === '2'", timeout=4000)
    check("map: card 2 is the current stop", page.get_attribute("#map li:nth-child(2)", "aria-current") == "step" and "passed" in page.text_content("#map li:nth-child(1)"))
    check("levels: Next card loads card 2", page.get_attribute("body", "data-card") == "2" and page.get_attribute("body", "data-level") == "playing" and page.get_attribute("body", "data-game") == "intro")
    solve_card()
    page.click("#next")
    page.wait_for_function("document.body.dataset.card === '3'", timeout=4000)
    check("levels: card 3 loads", page.get_attribute("body", "data-card") == "3")
    solve_card()
    check("levels: card 3 finishes the game", page.get_attribute("body", "data-level") == "finished")
    page.click("#again")
    page.wait_for_function("document.body.dataset.card === '1' && document.body.dataset.travel === 'resting'", timeout=4000)
    check("levels: Play again starts at card 1", page.get_attribute("body", "data-card") == "1" and page.get_attribute("body", "data-level") == "playing")

    # Hint: a broken part with a rule gets the checker's words, then its own nudge
    page.evaluate("window.A11yFixPath.round.broken.button = true")  # force the button broken for this check
    page.click("#parts button[data-part=button]")
    page.click("#hintBtn")
    hint = page.text_content("#hintText")
    check("hint: button hint mentions the checker and the nudge", "checker from step 1" in hint and "role and a name" in hint, hint)
    check("hint: counted once", page.evaluate("window.A11yFixPath.round.hints") == 1)
    page.click("#hintBtn")
    check("hint: second press not counted again", page.evaluate("window.A11yFixPath.round.hints") == 1)

    # Voice: selecting a part queues its words; M mutes the sound
    page.click("#parts button >> nth=0")
    spoken = page.evaluate("window.A11yFixPath.spoken")
    check("voice: selecting a part speaks its words", "Envelope image" in spoken[-1], spoken[-1:])
    page.keyboard.press("m")
    check("voice: M mutes", page.get_attribute("body", "data-voice") == "muted" and page.get_attribute("#mute", "aria-pressed") == "true")
    page.keyboard.press("m")
    check("voice: M unmutes", page.get_attribute("body", "data-voice") == "on")

    check("no console errors", not errors, errors)
    browser.close()

    # Reduced motion: the flip lands at once
    browser = p.chromium.launch(args=GL)
    page = browser.new_page(reduced_motion="reduce")
    page.goto(ROOT + "03_Minigame/index.html")
    page.wait_for_timeout(500)
    page.click("#flip")
    check("reduced motion: flip is instant", page.get_attribute("body", "data-side") == "back")
    browser.close()

print("\n%d failure(s)" % len(failures))
sys.exit(1 if failures else 0)
