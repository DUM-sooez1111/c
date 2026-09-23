(() => {
  'use strict';
  const interval = 5 * 60 * 1000;
  const storageKey = 'keycap-clicker.save.v2';
  const catalog = [
    { id: 'basic', name: '세라믹', description: '익숙하고 단정한 기본 타건음', price: 0, frequency: 230, filter: 1100, wave: 'sine', duration: .16 },
    { id: 'wood', name: '우드', description: '낮고 포근한 나무 울림', price: 30, frequency: 150, filter: 650, wave: 'sine', duration: .2 },
    { id: 'glass', name: '크리스탈', description: '맑고 높은 유리 울림', price: 60, frequency: 1400, filter: 3200, wave: 'sine', duration: .32 },
    { id: 'retro', name: '레트로', description: '짧고 경쾌한 전자음', price: 80, frequency: 620, filter: 1800, wave: 'square', duration: .12 },
    { id: 'deep', name: '딥 토크', description: '묵직하게 내려앉는 저음', price: 100, frequency: 95, filter: 400, wave: 'sine', duration: .26 },
    { id: 'bubble', name: '버블', description: '통통 튀는 물방울 소리', price: 120, frequency: 850, filter: 900, wave: 'sine', duration: .22 },
    { id: 'metal', name: '메탈', description: '선명하고 날카로운 금속음', price: 150, frequency: 1900, filter: 4200, wave: 'triangle', duration: .24 },
  ];
  function create(storage, now = Date.now, random = Math.random) {
    let state = { coins: 0, owned: ['basic'], equipped: 'basic', offers: [], refreshAt: 0 };
    const validCoins = n => Number.isSafeInteger(n) && n >= 0;
    try {
      const saved = JSON.parse(storage.getItem(storageKey));
      if (saved && validCoins(saved.coins)) {
        state.coins = saved.coins;
        state.owned = [...new Set(['basic', ...(Array.isArray(saved.owned) ? saved.owned : []).filter(id => catalog.some(item => item.id === id))])];
        if (state.owned.includes(saved.equipped)) state.equipped = saved.equipped;
        if (Array.isArray(saved.offers) && saved.offers.length === 3 && new Set(saved.offers).size === 3 && saved.offers.every(id => catalog.some(item => item.id === id && item.price > 0)) && Number.isFinite(saved.refreshAt) && saved.refreshAt <= now() + interval) {
          state.offers = saved.offers;
          state.refreshAt = saved.refreshAt;
        }
      } else {
        const legacy = storage.getItem('keycap-clicker.coins.v1');
        if (legacy !== null && /^\d+$/.test(legacy) && validCoins(Number(legacy))) state.coins = Number(legacy);
      }
    } catch { /* Continue in memory if browser storage is unavailable. */ }
    function save() { try { storage.setItem(storageKey, JSON.stringify(state)); } catch {} }
    function refresh() {
      if (state.offers.length === 3 && now() < state.refreshAt) return false;
      const pool = catalog.filter(item => item.price > 0).map(item => item.id);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const offers = pool.slice(0, 3);
      if (offers.every(id => state.offers.includes(id))) offers[2] = pool[3];
      state.offers = offers;
      state.refreshAt = now() + interval;
      save();
      return true;
    }
    refresh();
    return {
      state, refresh,
      earn() { state.coins = Math.min(state.coins + 1, Number.MAX_SAFE_INTEGER); save(); },
      buy(id) {
        refresh();
        const item = catalog.find(item => item.id === id);
        if (!item || !state.offers.includes(id)) return '이 상품의 판매가 종료됐습니다.';
        if (state.owned.includes(id)) return '이미 보유한 소리입니다.';
        if (state.coins < item.price) return '코인이 부족합니다.';
        state.coins -= item.price;
        state.owned.push(id);
        save();
        return `${item.name} 구매 완료! 인벤토리에서 장착하세요.`;
      },
      equip(id) { if (!state.owned.includes(id)) return false; state.equipped = id; save(); return true; },
    };
  }
  const api = { create, catalog, interval };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KeycapStore = api;
})();
