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

    check("no console errors", not errors, errors)
    browser.close()

print("\n%d failure(s)" % len(failures))
sys.exit(1 if failures else 0)
