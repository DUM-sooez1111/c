(() => {
  'use strict';
  const key = document.querySelector('.key');
  const output = document.querySelector('output');
  const coins = document.querySelector('#coins');
  const held = new Set();
  let storage;
  try { storage = window.localStorage; } catch {}
  const store = KeycapStore.create(storage);
  const catalog = KeycapStore.catalog;
  const panel = document.querySelector('#collection');
  const list = document.querySelector('#sound-list');
  const info = document.querySelector('#panel-info');
  const message = document.querySelector('#shop-message');
  let mode = 'shop';
  function updateCoins() {
    coins.textContent = store.state.coins.toLocaleString('ko-KR');
    document.querySelector('#panel-coins').textContent = coins.textContent;
    key.dataset.clicks = String(store.state.coins);
  }
  updateCoins();
  let audio;
  const noiseBuffers = new Map();
  let announceTimer;

  // Audio is synthesized locally; no sound files or network requests are needed.
  async function sound(release = false, id = store.state.equipped) {
    try {
      const profile = catalog.find(item => item.id === id) || catalog[0];
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio({ latencyHint: 'interactive' });
      if (audio.state !== 'running') await audio.resume();
      // Independent voices preserve the previous hit's tail during rapid input.
      const now = audio.currentTime + .006;
      const duration = release ? profile.duration * .56 : profile.duration;
      const bufferKey = `${id}-${release}`;
      let buffer = noiseBuffers.get(bufferKey);
      if (!buffer) {
        buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          const t = i / audio.sampleRate;
          const attack = Math.min(1, t / .0015);
          const tail = Math.min(1, (samples.length - 1 - i) / (audio.sampleRate * .015));
          samples[i] = (Math.random() * 2 - 1) * attack * Math.exp(-t / .014) * tail;
        }
        noiseBuffers.set(bufferKey, buffer);
      }
      const noise = audio.createBufferSource();
      noise.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = profile.filter * (release ? 1.7 : 1);
      filter.Q.value = .7;
      const gain = audio.createGain();
      gain.gain.value = release ? .12 : .24;
      noise.connect(filter).connect(gain).connect(audio.destination);
      noise.start(now);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };

      const tone = audio.createOscillator();
      tone.type = profile.wave;
      const envelope = audio.createGain();
      tone.frequency.setValueAtTime(profile.frequency * (release ? 1.6 : 1), now);
      tone.frequency.exponentialRampToValueAtTime(profile.frequency * .37, now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime((release ? .025 : .075) * (profile.wave === 'square' ? .4 : 1), now + .002);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + duration - .015);
      envelope.gain.linearRampToValueAtTime(0, now + duration);
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
    store.earn();
    updateCoins();
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { output.textContent = `${store.state.coins}코인 보유`; }, 250);
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
    if (panel.open || (event.target.closest?.('button') && event.target !== key)) return;
    if (!['Space', 'Enter'].includes(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) press(event.code);
  });
  window.addEventListener('keyup', event => {
    if (!held.has(event.code)) return;
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

  function updateInfo() {
    const seconds = Math.max(0, Math.ceil((store.state.refreshAt - Date.now()) / 1000));
    info.textContent = mode === 'shop'
      ? `다음 상품 변경 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · 5분마다 랜덤 3종`
      : `보유한 소리 ${store.state.owned.length}종 · 장착하면 키캡 소리가 바뀝니다.`;
  }
  function renderPanel() {
    document.querySelector('#panel-title').textContent = mode === 'shop' ? '소리 상점' : '인벤토리';
    updateCoins();
    updateInfo();
    list.replaceChildren();
    const ids = mode === 'shop' ? store.state.offers : store.state.owned;
    for (const id of ids) {
      const item = catalog.find(item => item.id === id);
      const owned = store.state.owned.includes(id);
      const card = document.createElement('article');
      card.className = 'sound-card';
      const name = document.createElement('h2');
      name.textContent = item.name;
      const description = document.createElement('p');
      description.textContent = item.description;
      const actions = document.createElement('div');
      actions.className = 'sound-actions';
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.textContent = '미리듣기';
      preview.setAttribute('aria-label', `${item.name} 미리듣기`);
      preview.addEventListener('click', () => sound(false, id));
      const action = document.createElement('button');
      action.type = 'button';
      if (mode === 'shop') {
        action.textContent = owned ? '보유 중' : `${item.price} 코인 · 구매`;
        action.disabled = owned || store.state.coins < item.price;
        action.addEventListener('click', () => { message.textContent = store.buy(id); renderPanel(); });
      } else {
        action.textContent = store.state.equipped === id ? '장착 중' : '장착';
        action.disabled = store.state.equipped === id;
        action.addEventListener('click', () => {
          if (store.equip(id)) { message.textContent = `${item.name} 장착 완료`; sound(false, id); }
          renderPanel();
        });
      }
      actions.append(preview, action);
      card.append(name, description, actions);
      list.append(card);
    }
  }
  function openPanel(nextMode) {
    reset();
    mode = nextMode;
    store.refresh();
    message.textContent = '';
    renderPanel();
    panel.showModal();
  }
  document.querySelector('#open-shop').addEventListener('click', () => openPanel('shop'));
  document.querySelector('#open-inventory').addEventListener('click', () => openPanel('inventory'));
  document.querySelector('#close-panel').addEventListener('click', () => panel.close());
  setInterval(() => {
    const changed = store.refresh();
    if (!panel.open) return;
    if (changed && mode === 'shop') { message.textContent = '새로운 상품이 도착했습니다.'; renderPanel(); }
    else updateInfo();
  }, 1000);
})();
