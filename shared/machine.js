// A tiny state machine helper shared by all three pieces.
//
// A machine has a name, a current state, and a table that lists, for each state,
// which events are allowed and which state each one leads to. Any event not in the
// table for the current state is ignored. That is the whole idea.
//
//   var light = createMachine('light', 'off', {
//     off: { PRESS: 'on' },
//     on:  { PRESS: 'off' }
//   });
//   light.send('PRESS');   // light.state is now 'on'
//
// Every machine also:
//   - writes its state onto <body> as data-<name>="<state>", so CSS, tests and
//     automated agents can see it without reading the code;
//   - keeps a short history of transitions, and registers itself on
//     window.A11yFixPath.machines so it can be inspected from the browser console.

function createMachine(name, initial, table) {
  var machine = {
    name: name,
    state: initial,
    history: [],
    listeners: []
  };

  machine.can = function (event) {
    var row = table[machine.state];
    return Boolean(row && row[event]);
  };

  machine.send = function (event) {
    if (!machine.can(event)) {
      return false; // not allowed in this state, so nothing happens
    }
    var from = machine.state;
    var to = table[from][event];
    machine.state = to;
    machine.history.push(from + ' --' + event + '--> ' + to);
    if (machine.history.length > 50) {
      machine.history.shift();
    }
    document.body.setAttribute('data-' + name, to);
    for (var i = 0; i < machine.listeners.length; i++) {
      machine.listeners[i](to, from, event);
    }
    return true;
  };

  machine.onChange = function (fn) {
    machine.listeners.push(fn);
  };

  document.body.setAttribute('data-' + name, initial);
  if (!window.A11yFixPath) {
    window.A11yFixPath = { machines: {} };
  }
  window.A11yFixPath.machines[name] = machine;
  return machine;
}
