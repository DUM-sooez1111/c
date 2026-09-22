(() => {
  'use strict';
  const key = document.querySelector('.key');
  const output = document.querySelector('output');
  const held = new Set();
  let count = 0;
  let audio;
  let announceTimer;

  // Audio is synthesized locally; no sound files or network requests are needed.
  function sound(release = false) {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
      const now = audio.currentTime;
      const duration = release ? .035 : .065;
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * .009));
      const noise = audio.createBufferSource();
      noise.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = release ? 2100 : 1100;
      filter.Q.value = .7;
      const gain = audio.createGain();
      gain.gain.value = release ? .12 : .24;
      noise.connect(filter).connect(gain).connect(audio.destination);
      noise.start(now);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };

      const tone = audio.createOscillator();
      const envelope = audio.createGain();
      tone.frequency.setValueAtTime(release ? 420 : 230, now);
      tone.frequency.exponentialRampToValueAtTime(85, now + duration);
      envelope.gain.setValueAtTime(release ? .025 : .075, now);
      envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
      tone.connect(envelope).connect(audio.destination);
      tone.start(now);
      tone.stop(now + duration);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
    } catch { /* The button remains usable when browser audio is unavailable. */ }
  }

  function press(source) {
    if (held.has(source)) return;
    const wasPressed = held.size > 0;
    held.add(source);
    if (wasPressed) return;
    key.classList.add('is-pressed');
    count++;
    key.dataset.clicks = String(count);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { output.textContent = `${count}회 클릭`; }, 250);
    sound();
  }

  function release(source) {
    if (!held.delete(source) || held.size) return;
    key.classList.remove('is-pressed');
    sound(true);
  }

  key.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    key.setPointerCapture(event.pointerId);
    press(`pointer-${event.pointerId}`);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    key.addEventListener(type, event => release(`pointer-${event.pointerId}`));
  }
  window.addEventListener('keydown', event => {
    if (!['Space', 'Enter'].includes(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) press(event.code);
  });
  window.addEventListener('keyup', event => {
    if (!['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault();
    release(event.code);
  });
  // Support assistive technologies that activate buttons with a synthetic click.
  key.addEventListener('click', event => {
    if (event.detail === 0 && !held.size) {
      press('assistive');
      setTimeout(() => release('assistive'), 90);
    }
  });
  function reset() { held.clear(); key.classList.remove('is-pressed'); }
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
