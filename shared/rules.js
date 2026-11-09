// The five accessibility rules. Shared by the fixer and the game.
// Loaded as a plain script, so RULES is a global that both can read.

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
