// Sound for the minigame: the browser's own speech voice plus a few short tones.
// Nothing is downloaded. If the browser has no voice or no audio, every function here quietly does nothing,
// because the same words are always in the page as text.
//
// The voice machine:
//   on --MUTE--> muted --UNMUTE--> on
// While muted, nothing is spoken and no tone plays. M toggles it.

var voice = createMachine('voice', 'on', {
  'on':    { MUTE: 'muted' },
  'muted': { UNMUTE: 'on' }
});

// Tests read what would have been spoken from here, since a test can't listen.
window.A11yFixPath = window.A11yFixPath || {};
window.A11yFixPath.spoken = [];

var audio = null; // created on the first tone, because browsers want a click before sound

export function toggleVoice() {
  voice.send(voice.state === 'on' ? 'MUTE' : 'UNMUTE');
  if (voice.state === 'muted' && window.speechSynthesis) window.speechSynthesis.cancel();
}

export function onVoiceChange(fn) { voice.onChange(fn); }
export function voiceState() { return voice.state; }

export function speak(text) {
  window.A11yFixPath.spoken.push(text);
  if (voice.state !== 'on') return;
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
}

// One short tone: frequency in Hz, start time offset and length in seconds.
export function playTone(freq, start, length, type) {
  if (voice.state !== 'on') return;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audio) audio = new Ctx();
  if (audio.state === 'suspended') audio.resume();
  var osc = audio.createOscillator();
  var gain = audio.createGain();
  var t0 = audio.currentTime + start;
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}

// Two rising notes: a good result.
export function chime() {
  playTone(660, 0, 0.18);
  playTone(880, 0.12, 0.3);
}

// One low, short note: a wrong try or a broken part.
export function thud() {
  playTone(130, 0, 0.25, 'triangle');
}
