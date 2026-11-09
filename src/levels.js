// The levels of "Sounds Wrong". Each level is one interface card with five parts.
// Every round, three of the five parts are broken at random.
//
// Fields on each part:
//   id, label        name used in the list and the panel
//   draw             which picture to draw for it (the drawing code lives in minigame.js)
//   x, y, w, h       position and size in card units. The card is 392 wide and 452 tall, centred on 0,0.
//   role             the part's role in the accessibility tree
//   nameBefore/After what the tree shows as its name when broken / when fixed
//   okSays, badSays  what a screen reader says when the part is fine / broken
//   badCode          the code that causes the problem
//   rule             an id from shared/rules.js, so the hint can run the fixer's check. null if no rule fits.
//   hint             one sentence that nudges without giving the answer away
//   options          three fixes, exactly one with ok: true

export var LEVELS = [
  // ---------------------------------------------------------------- Level 1
  {
    id: 'newsletter',
    title: 'Newsletter card',
    teaches: 'Names for images, buttons and links',
    treeRoot: 'group',
    mustBreak: 'button', // the first play always includes the button from the explainer
    parts: [
      {
        id: 'img', label: 'Envelope image', draw: 'img', y: 110, h: 120, w: 120,
        role: 'image', nameBefore: '"envelope.png"', nameAfter: '(skipped)',
        okSays: 'Nothing (skipped as decoration). The heading already says what the card is.',
        badSays: '"envelope dot png, image"',
        badCode: '<img src="envelope.png" />',
        rule: 'img-alt',
        hint: 'The checker only makes a guess here. Ask yourself: does this picture tell the user anything the heading does not?',
        options: [
          { code: 'alt="image"', ok: false, why: 'The user already knows it is an image. "image" adds a word and no meaning.' },
          { code: 'alt=""', ok: true, why: 'Right. This picture is decoration and the heading says the same thing, so an empty alt tells the screen reader to skip it.' },
          { code: 'title="envelope.png"', ok: false, why: 'title is not read reliably and the file name still means nothing to a listener.' }
        ]
      },
      {
        id: 'heading', label: 'Card title', draw: 'heading', y: 10, h: 44, w: 330,
        role: 'heading', nameBefore: '(plain text)', nameAfter: '"Weekly accessibility tips"',
        okSays: '"Weekly accessibility tips, heading level 2"',
        badSays: '"Weekly accessibility tips" (plain text, not in the headings list)',
        badCode: '<div className="big">Weekly accessibility tips</div>',
        rule: null,
        hint: 'Many screen reader users skim a page by jumping from heading to heading. Would this text show up in that list?',
        options: [
          { code: 'style={{ fontSize: 24 }}', ok: false, why: 'Bigger text is still plain text to a screen reader. Size is only visual.' },
          { code: 'role="title"', ok: false, why: 'There is no "title" role. The browser ignores it.' },
          { code: 'use <h2> instead of <div>', ok: true, why: 'Right. A real heading shows up in the headings list, which is how many screen reader users skim a page.' }
        ]
      },
      {
        id: 'input', label: 'Email field', draw: 'input', y: -70, h: 50, w: 330,
        role: 'textbox', nameBefore: '""', nameAfter: '"Email address"',
        okSays: '"Email address, edit text"',
        badSays: '"edit text, blank"',
        badCode: '<input type="email" placeholder="Email address" />',
        rule: 'input-label',
        hint: 'Placeholder text disappears as soon as you type. What stays on the field afterwards?',
        options: [
          { code: 'name="email"', ok: false, why: 'name is for form submission. It does not give the field an accessible name.' },
          { code: 'aria-label="Email address"', ok: true, why: 'Right. The field now has a name that stays after the user starts typing, unlike the placeholder.' },
          { code: 'a longer placeholder', ok: false, why: 'Placeholder text vanishes when typing starts and many screen readers do not use it as the name.' }
        ]
      },
      {
        id: 'button', label: 'Send button', draw: 'button', y: -145, h: 54, w: 54, x: 138,
        role: 'button', nameBefore: '""', nameAfter: '"Subscribe"',
        okSays: '"Subscribe, button"',
        badSays: '"button"',
        badCode: '<button onClick={subscribe}><SendIcon /></button>',
        rule: 'button-name',
        hint: 'The screen reader reads a role and a name. This part has a role. What is missing?',
        options: [
          { code: 'aria-label="Subscribe"', ok: true, why: 'Right. Same icon on screen, and now the button says what it does.' },
          { code: 'role="button"', ok: false, why: 'It is already a button. The problem is the missing name, and this does not add one.' },
          { code: '<SendIcon aria-hidden="true" />', ok: false, why: 'Hiding the icon is good practice, but the button still has no name. It would still say just "button".' }
        ]
      },
      {
        id: 'link', label: 'Info link', draw: 'link', y: -145, h: 44, w: 44, x: -140,
        role: 'link', nameBefore: '""', nameAfter: '"Privacy policy"',
        okSays: '"Privacy policy, link"',
        badSays: '"link"',
        badCode: '<a href="/privacy"><InfoIcon /></a>',
        rule: null,
        hint: 'Users often pull up a list of every link on a page. What would this one say in that list?',
        options: [
          { code: 'aria-label="Click here"', ok: false, why: 'Users often list all links on a page. "Click here" says nothing about where it goes.' },
          { code: 'href="#privacy"', ok: false, why: 'Changing the address does not change what the link is called.' },
          { code: 'aria-label="Privacy policy"', ok: true, why: 'Right. The link now says where it goes.' }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- Level 2
  {
    id: 'signin',
    title: 'Sign-in form',
    teaches: 'Labels, errors and real buttons',
    treeRoot: 'form',
    mustBreak: null,
    parts: [
      {
        id: 'heading', label: 'Form title', draw: 'signinTitle', y: 140, h: 44, w: 330,
        role: 'heading', nameBefore: '(plain text)', nameAfter: '"Sign in" level 1',
        okSays: '"Sign in, heading level 1"',
        badSays: '"Sign in" (plain text, not in the headings list)',
        badCode: '<div className="title">Sign in</div>',
        rule: null,
        hint: 'Is there any way for a listener to jump straight to this text?',
        options: [
          { code: 'role="banner"', ok: false, why: 'banner marks the site header region. It does not make text a heading.' },
          { code: 'style={{ fontWeight: 700 }}', ok: false, why: 'Bold is only visual. A screen reader still sees plain text.' },
          { code: 'use <h1> instead of <div>', ok: true, why: 'Right. The page now has a heading that a screen reader user can jump to.' }
        ]
      },
      {
        id: 'email', label: 'Email field', draw: 'signinEmail', y: 60, h: 50, w: 330,
        role: 'textbox', nameBefore: '""', nameAfter: '"Email"',
        okSays: '"Email, edit text"',
        badSays: '"edit text, blank"',
        badCode: '<input type="email" placeholder="Email" />',
        rule: 'input-label',
        hint: 'What does a listener hear when focus lands here? A field needs a name of its own.',
        options: [
          { code: 'placeholder="Your email"', ok: false, why: 'A longer placeholder still disappears when typing starts and is not a reliable name.' },
          { code: 'type="text"', ok: false, why: 'type changes the keyboard and the checks. It does not give the field a name.' },
          { code: 'add <label for="email">Email</label>', ok: true, why: 'Right. A real label is read every time, and clicking it also focuses the field.' }
        ]
      },
      {
        id: 'password', label: 'Password field', draw: 'signinPassword', y: -20, h: 50, w: 330,
        role: 'textbox', nameBefore: '""', nameAfter: '"Password"',
        okSays: '"Password, secure edit text"',
        badSays: '"secure edit text, blank"',
        badCode: '<input type="password" placeholder="Password" />',
        rule: 'input-label',
        hint: 'Same question as the email field. What stays on this field after the user starts typing?',
        options: [
          { code: 'autoComplete="off"', ok: false, why: 'That controls the browser\'s saved passwords. It adds no name.' },
          { code: 'placeholder="Enter your password"', ok: false, why: 'Still a placeholder, so it disappears and is not a reliable name.' },
          { code: 'aria-label="Password"', ok: true, why: 'Right. The field now has a name that is read when focus lands on it.' }
        ]
      },
      {
        id: 'error', label: 'Error message', draw: 'signinError', y: -80, h: 28, w: 330,
        role: 'alert', nameBefore: '(not linked to the field)', nameAfter: 'linked to the password field',
        okSays: '"Password, invalid entry, Wrong password"',
        badSays: '"Password, secure edit text" (the error is never read)',
        badCode: '<input id="pw" /> <p className="err">Wrong password</p>',
        rule: null,
        hint: 'When focus lands on the field, what tells the user it has an error?',
        options: [
          { code: 'style={{ color: "red" }}', ok: false, why: 'Colour is only visual, and some users cannot see it either.' },
          { code: 'put the message in a title', ok: false, why: 'title is not read reliably, so many users would never hear it.' },
          { code: 'aria-invalid and aria-describedby', ok: true, why: 'Right. The field is now marked invalid and points to the message, so the message is read with it.' }
        ]
      },
      {
        id: 'submit', label: 'Sign in button', draw: 'signinButton', y: -150, h: 56, w: 330,
        role: 'button', nameBefore: '(no role)', nameAfter: '"Sign in"',
        okSays: '"Sign in, button"',
        badSays: 'Nothing. Tab skips it, so it is never announced.',
        badCode: '<div onClick={signIn}>Sign in</div>',
        rule: null,
        hint: 'Try pressing Tab through this form in your head. Does focus ever land on it?',
        options: [
          { code: 'tabIndex={0}', ok: false, why: 'Tab now reaches it, but it is still announced as plain text and Enter does nothing.' },
          { code: 'role="button"', ok: false, why: 'It is announced as a button, but Tab still skips it and Enter and Space do nothing without more code.' },
          { code: 'use <button> instead of <div>', ok: true, why: 'Right. A real button gets focus, a role and keyboard support for free.' }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- Level 3
  {
    id: 'nav',
    title: 'Nav bar',
    teaches: 'Names, structure and language',
    treeRoot: 'navigation',
    mustBreak: null,
    parts: [
      {
        id: 'logo', label: 'Logo link', draw: 'navLogo', x: -130, y: 150, h: 64, w: 64,
        role: 'link', nameBefore: '"logo dot svg"', nameAfter: '"Home"',
        okSays: '"Home, link"',
        badSays: '"link, logo dot svg"',
        badCode: '<a href="/"><img src="logo.svg" /></a>',
        rule: null,
        hint: 'When an image is the only thing inside a link, its alt text becomes the link\'s name. Where does this link go?',
        options: [
          { code: 'alt="logo"', ok: false, why: 'That says what it looks like, not where the link goes.' },
          { code: 'title="Home"', ok: false, why: 'title is not read reliably, and the image still has no alt.' },
          { code: 'alt="Home"', ok: true, why: 'Right. The link is now announced by where it goes.' }
        ]
      },
      {
        id: 'lang', label: 'Page language', draw: 'navLang', x: 140, y: 150, h: 34, w: 60,
        role: 'document', nameBefore: 'no language', nameAfter: 'lang="en"',
        okSays: 'Read aloud with an English voice.',
        badSays: 'Read aloud with a guessed voice, so English words can sound wrong.',
        badCode: '<html>',
        rule: 'html-has-lang',
        hint: 'The screen reader has to pick a voice. What tells it which language the page is in?',
        options: [
          { code: '<meta charset="utf-8">', ok: false, why: 'That sets the text encoding. It does not say which language the words are in.' },
          { code: 'dir="ltr"', ok: false, why: 'That sets the reading direction, not the language.' },
          { code: 'lang="en" on <html>', ok: true, why: 'Right. The screen reader now picks the English voice.' }
        ]
      },
      {
        id: 'search', label: 'Search button', draw: 'navSearch', x: -130, y: 40, h: 54, w: 54,
        role: 'button', nameBefore: '""', nameAfter: '"Search"',
        okSays: '"Search, button"',
        badSays: '"button"',
        badCode: '<button onClick={search}><SearchIcon /></button>',
        rule: 'button-name',
        hint: 'You have seen this bug before. The screen reader reads a role and a name.',
        options: [
          { code: 'aria-label="Search"', ok: true, why: 'Right. The icon button now says what it does.' },
          { code: 'type="button"', ok: false, why: 'That controls form behaviour. It gives the button no name.' },
          { code: 'title="magnifier"', ok: false, why: 'title is not read reliably, and "magnifier" says what it looks like, not what it does.' }
        ]
      },
      {
        id: 'cart', label: 'Cart link', draw: 'navCart', x: 0, y: 40, h: 54, w: 54,
        role: 'link', nameBefore: '"2"', nameAfter: '"Cart, 2 items"',
        okSays: '"Cart, 2 items, link"',
        badSays: '"2, link" (only the number on the badge is read)',
        badCode: '<a href="/cart"><CartIcon /><span>2</span></a>',
        rule: null,
        hint: 'Listen to what is left once the picture is gone. Does "2, link" tell you where the link goes?',
        options: [
          { code: 'aria-label="Click here"', ok: false, why: 'It says nothing about where the link goes.' },
          { code: 'title="cart"', ok: false, why: 'title is not read reliably, and the number of items would still be lost.' },
          { code: 'aria-label="Cart, 2 items"', ok: true, why: 'Right. The link says where it goes and keeps the number the badge shows.' }
        ]
      },
      {
        id: 'menu', label: 'Menu', draw: 'navMenu', x: 130, y: 40, h: 54, w: 54,
        role: 'button', nameBefore: '(no role)', nameAfter: '"Menu", collapsed',
        okSays: '"Menu, button, collapsed"',
        badSays: 'Nothing. Tab skips it, and it has no name.',
        badCode: '<div className="burger" onClick={open}><BurgerIcon /></div>',
        rule: null,
        hint: 'Could a keyboard user ever open this menu? What would make it reachable and named?',
        options: [
          { code: 'role="menu"', ok: false, why: 'menu is for application menus. It does not make the element focusable or give it a name.' },
          { code: 'tabIndex={0}', ok: false, why: 'Tab now reaches it, but it still has no name or role, and Enter does nothing.' },
          { code: '<button aria-label="Menu" aria-expanded="false">', ok: true, why: 'Right. A real button, with a name and a state that tells the user the menu is closed.' }
        ]
      }
    ]
  }
];
