// Fixer: five checks on JSX, a proposed fix for each, accept or reject, then re-check.
// Kept deliberately simple: plain string and regex work, one rule per function.

var SAMPLE = [
  '// index.html',
  '<html>',
  '  <body><div id="root"></div></body>',
  '</html>',
  '',
  '// NewsletterCard.jsx',
  'function NewsletterCard() {',
  '  return (',
  '    <div className="card">',
  '      <img src="envelope.png" />',
  '      <h2>Weekly accessibility tips</h2>',
  '      <input type="email" placeholder="Email address" />',
  '      <button onClick={subscribe}><SendIcon /></button>',
  '      <a href="/privacy"></a>',
  '    </div>',
  '  );',
  '}'
].join('\n');

// Each rule finds problems and returns objects with a fix function.
var RULES = [
  {
    id: 'html-has-lang',
    title: 'Page has no language',
    wcag: 'WCAG 3.1.1 Language of Page',
    tier: 1,
    find: function (code) {
      var out = [];
      var re = /<html(\s[^>]*)?>/g;
      var m;
      while ((m = re.exec(code)) !== null) {
        if (m[0].indexOf('lang=') === -1) {
          out.push({ start: m.index, text: m[0], fixed: '<html lang="en"' + (m[1] || '') + '>',
            why: 'Without lang, a screen reader guesses the language and may read English words with the wrong voice.' });
        }
      }
      return out;
    }
  },
  {
    id: 'img-alt',
    title: 'Image has no alt text',
    wcag: 'WCAG 1.1.1 Non-text Content',
    tier: 2,
    find: function (code) {
      var out = [];
      var re = /<img\b[^>]*\/?>/g;
      var m;
      while ((m = re.exec(code)) !== null) {
        if (m[0].indexOf('alt=') === -1) {
          var src = (m[0].match(/src="([^"]*)"/) || [])[1] || 'image';
          var guess = src.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ');
          out.push({ start: m.index, text: m[0], fixed: m[0].replace('<img', '<img alt="' + guess + '"'),
            why: 'A screen reader reads the file name, or nothing. Confirm the words: if the image is decoration, use alt="" instead.' });
        }
      }
      return out;
    }
  },
  {
    id: 'input-label',
    title: 'Input has no label',
    wcag: 'WCAG 1.3.1 and 4.1.2',
    tier: 2,
    find: function (code) {
      var out = [];
      var re = /<input\b[^>]*\/?>/g;
      var m;
      while ((m = re.exec(code)) !== null) {
        var tag = m[0];
        if (tag.indexOf('aria-label') === -1 && tag.indexOf('id=') === -1) {
          var ph = (tag.match(/placeholder="([^"]*)"/) || [])[1] || 'Input';
          out.push({ start: m.index, text: tag, fixed: tag.replace('<input', '<input aria-label="' + ph + '"'),
            why: 'Placeholder text disappears when you type and is not a reliable name. The field needs a label of its own.' });
        }
      }
      return out;
    }
  },
  {
    id: 'button-name',
    title: 'Button has no name',
    wcag: 'WCAG 4.1.2 Name, Role, Value',
    tier: 2,
    find: function (code) {
      var out = [];
      var re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
      var m;
      while ((m = re.exec(code)) !== null) {
        var attrs = m[1];
        var inner = m[2].replace(/<[^>]*\/>/g, '').replace(/<[^>]*>/g, '').trim();
        if (inner === '' && attrs.indexOf('aria-label') === -1) {
          var handler = (attrs.match(/onClick=\{(\w+)\}/) || [])[1] || 'Button';
          var name = handler.charAt(0).toUpperCase() + handler.slice(1);
          out.push({ start: m.index, text: m[0], fixed: m[0].replace('<button', '<button aria-label="' + name + '"'),
            why: 'The button only holds an icon, so a screen reader announces just "button". The name here is a guess from the click handler, so check it.' });
        }
      }
      return out;
    }
  },
  {
    id: 'link-name',
    title: 'Link has no text',
    wcag: 'WCAG 2.4.4 Link Purpose',
    tier: 2,
    find: function (code) {
      var out = [];
      var re = /<a\b([^>]*)>\s*<\/a>/g;
      var m;
      while ((m = re.exec(code)) !== null) {
        var href = (m[1].match(/href="\/?([^"]*)"/) || [])[1] || 'link';
        var text = href.charAt(0).toUpperCase() + href.slice(1).replace(/[-_]/g, ' ');
        out.push({ start: m.index, text: m[0], fixed: '<a' + m[1] + '>' + text + '</a>',
          why: 'An empty link is announced as "link" with no destination. Give it text that says where it goes.' });
      }
      return out;
    }
  }
];

// ---------------------------------------------------------------------------
// State machine for the page.
//
//   unchecked --ISSUES--> open      (the check found problems)
//   unchecked --NONE----> clear     (the check found nothing)
//   open/clear --EDIT---> stale     (the code changed, so old results may be wrong)
//   stale --ISSUES/NONE-> open/clear (checked again)
//   any --RESET---------> unchecked
//
// Accept and Reject only work in "open". In "stale" the results are greyed out,
// because a fix computed for old code could land in the wrong place.
// ---------------------------------------------------------------------------
var checker = createMachine('checker', 'unchecked', {
  unchecked: { ISSUES: 'open', NONE: 'clear', EDIT: 'unchecked' },
  open:      { ISSUES: 'open', NONE: 'clear', EDIT: 'stale', RESET: 'unchecked' },
  clear:     { ISSUES: 'open', NONE: 'clear', EDIT: 'stale', RESET: 'unchecked' },
  stale:     { ISSUES: 'open', NONE: 'clear', EDIT: 'stale', RESET: 'unchecked' }
});

// Each issue also has a small lifecycle of its own: open -> fixed, or open -> kept.
// "kept" means the developer rejected the fix on purpose.
var kept = {};      // issue key -> true
var fixedLog = [];  // fixes that passed their re-check

var codeBox = document.getElementById('code');
var issuesBox = document.getElementById('issues');
var summary = document.getElementById('summary');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function findAll(code) {
  var all = [];
  for (var i = 0; i < RULES.length; i++) {
    var hits = RULES[i].find(code);
    for (var j = 0; j < hits.length; j++) {
      hits[j].rule = RULES[i];
      hits[j].key = RULES[i].id + '|' + hits[j].text;
      all.push(hits[j]);
    }
  }
  all.sort(function (a, b) { return a.start - b.start; });
  return all;
}

function countOpen(found) {
  var n = 0;
  for (var i = 0; i < found.length; i++) {
    if (!kept[found[i].key]) n++;
  }
  return n;
}

// Run the five checks and move the machine to "open" or "clear".
function runCheck(message) {
  var found = findAll(codeBox.value);
  checker.send(countOpen(found) > 0 ? 'ISSUES' : 'NONE');
  render(found, message);
}

function render(found, message) {
  issuesBox.innerHTML = '';

  for (var i = 0; i < fixedLog.length; i++) {
    var f = fixedLog[i];
    var done = document.createElement('div');
    done.className = 'issue fixed';
    done.innerHTML = '<h3>✓ Fixed: ' + f.title + '</h3><p style="margin:0">Re-check passed for <code>' + escapeHtml(f.fixed) + '</code></p>';
    issuesBox.appendChild(done);
  }

  found.forEach(function (issue) {
    var isKept = kept[issue.key];
    var box = document.createElement('div');
    box.className = 'issue' + (isKept ? ' rejected' : '');
    box.innerHTML =
      '<h3>' + (isKept ? 'Kept as is: ' : '') + issue.rule.title + ' <span class="tag t' + issue.rule.tier + '">Tier ' + issue.rule.tier + '</span></h3>' +
      '<div style="font-size:14px;color:var(--muted)">' + issue.rule.wcag + '</div>' +
      '<div class="diff"><pre><span class="del">- ' + escapeHtml(issue.text) + '</span>\n<span class="add">+ ' + escapeHtml(issue.fixed) + '</span></pre></div>' +
      '<p style="margin:0 0 8px">' + issue.why + '</p>';
    if (!isKept) {
      var actions = document.createElement('div');
      actions.className = 'actions';
      var accept = document.createElement('button');
      accept.className = 'primary';
      accept.textContent = 'Accept fix';
      accept.setAttribute('aria-label', 'Accept fix: ' + issue.rule.title);
      accept.onclick = function () { applyFix(issue); };
      var reject = document.createElement('button');
      reject.textContent = 'Reject';
      reject.setAttribute('aria-label', 'Reject fix: ' + issue.rule.title);
      reject.onclick = function () { keepIssue(issue); };
      actions.appendChild(accept);
      actions.appendChild(reject);
      if (issue.rule.id === 'button-name') {
        var why = document.createElement('a');
        why.className = 'btn';
        why.href = '../02_Explainer/index.html';
        why.textContent = 'Explain this fix';
        actions.appendChild(why);
      }
      box.appendChild(actions);
    }
    issuesBox.appendChild(box);
  });

  var open = countOpen(found);
  var text;
  if (checker.state === 'clear') {
    text = 'No open issues. All five checks pass or were kept on purpose.';
  } else {
    text = open + ' open issue' + (open === 1 ? '' : 's') + ' found.';
  }
  summary.textContent = (message ? message + ' ' : '') + text;
}

function applyFix(issue) {
  if (checker.state === 'stale') { runCheck('The code changed, so it was checked again first.'); summary.focus(); return; }
  if (checker.state !== 'open') return;
  var code = codeBox.value;
  // Find the exact text again rather than trusting an old position.
  var at = code.indexOf(issue.text);
  if (at === -1) { runCheck('That code has changed. Checked again.'); return; }
  codeBox.value = code.slice(0, at) + issue.fixed + code.slice(at + issue.text.length);
  // Re-check: the same rule must no longer fire on the fixed text.
  var still = issue.rule.find(issue.fixed).length > 0;
  if (!still) {
    fixedLog.push({ title: issue.rule.title, fixed: issue.fixed });
    runCheck('Fix applied and re-checked.');
  } else {
    runCheck('Fix applied but the re-check still fails. Review it by hand.');
  }
  summary.focus(); // the clicked button is gone, so move focus somewhere sensible
}

function keepIssue(issue) {
  if (checker.state === 'stale') { runCheck('The code changed, so it was checked again first.'); summary.focus(); return; }
  if (checker.state !== 'open') return;
  kept[issue.key] = true;
  runCheck('Fix rejected. The code was not changed.');
  summary.focus();
}

// Typing in the editor makes the results stale until the next check.
codeBox.addEventListener('input', function () {
  if (checker.send('EDIT') && checker.state === 'stale') {
    summary.textContent = 'The code changed. Press Check code to see up-to-date results.';
  }
});

document.getElementById('run').onclick = function () { runCheck('Checked.'); };
document.getElementById('reset').onclick = function () {
  codeBox.value = SAMPLE; kept = {}; fixedLog = []; issuesBox.innerHTML = '';
  checker.send('RESET');
  summary.textContent = 'Sample restored. Press Check code.';
};
codeBox.value = SAMPLE;
