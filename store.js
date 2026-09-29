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
  const skins = [
    { id: 'ivory', name: '아이보리', description: '기본 세라믹 키캡', price: 0, light: '#fffef8', base: '#e9e6db', dark: '#807d75', ink: '#65665e' },
    { id: 'rose', name: '로즈 밀크', description: '부드러운 딸기 우유빛', price: 60, light: '#ffe8ef', base: '#efa3bd', dark: '#975269', ink: '#72374d' },
    { id: 'mint', name: '민트', description: '차분하고 산뜻한 민트빛', price: 80, light: '#e0fff1', base: '#8edbc3', dark: '#40796c', ink: '#265c50' },
    { id: 'ocean', name: '오션 블루', description: '깊은 바다를 닮은 파랑', price: 100, light: '#ceeaff', base: '#659ddc', dark: '#294774', ink: '#16385f' },
    { id: 'lavender', name: '라벤더', description: '은은한 보랏빛 세라믹', price: 120, light: '#f3e9ff', base: '#b9a0e5', dark: '#655080', ink: '#4d386e' },
    { id: 'gold', name: '샴페인 골드', description: '따뜻하게 빛나는 금빛', price: 180, light: '#fff1bf', base: '#d7b35d', dark: '#82602b', ink: '#604317' },
    { id: 'midnight', name: '미드나이트', description: '밝은 각인이 돋보이는 짙은 키캡', price: 150, light: '#747b8c', base: '#373d4c', dark: '#151922', ink: '#e1e7f5' },
  ];
  function create(storage, now = Date.now, random = Math.random) {
    let state = { coins: 0, owned: ['basic'], equipped: 'basic', offers: [], refreshAt: 0, ownedSkins: ['ivory'], equippedSkin: 'ivory', skinOffers: [] };
    const validCoins = n => Number.isSafeInteger(n) && n >= 0;
    try {
      const saved = JSON.parse(storage.getItem(storageKey));
      if (saved && validCoins(saved.coins)) {
        state.coins = saved.coins;
        state.owned = [...new Set(['basic', ...(Array.isArray(saved.owned) ? saved.owned : []).filter(id => catalog.some(item => item.id === id))])];
        if (state.owned.includes(saved.equipped)) state.equipped = saved.equipped;
        state.ownedSkins = [...new Set(['ivory', ...(Array.isArray(saved.ownedSkins) ? saved.ownedSkins : []).filter(id => skins.some(item => item.id === id))])];
        if (state.ownedSkins.includes(saved.equippedSkin)) state.equippedSkin = saved.equippedSkin;
        if (Array.isArray(saved.skinOffers) && saved.skinOffers.length === 3 && new Set(saved.skinOffers).size === 3 && saved.skinOffers.every(id => skins.some(item => item.id === id && item.price > 0))) state.skinOffers = saved.skinOffers;
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
    function roll(items, previous) {
      const pool = items.filter(item => item.price > 0).map(item => item.id);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const offers = pool.slice(0, 3);
      if (offers.every(id => previous.includes(id))) offers[2] = pool[3];
      return offers;
    }
    function refresh() {
      if (state.offers.length === 3 && now() < state.refreshAt) {
        if (state.skinOffers.length !== 3) { state.skinOffers = roll(skins, []); save(); return true; }
        return false;
      }
      state.offers = roll(catalog, state.offers);
      state.skinOffers = roll(skins, state.skinOffers);
      state.refreshAt = now() + interval;
      save();
      return true;
    }
    refresh();
    return {
      state, refresh,
      earn() { state.coins = Math.min(state.coins + 1, Number.MAX_SAFE_INTEGER); save(); },
      buy(id, kind = 'sound') {
        refresh();
        const isSkin = kind === 'skin';
        const item = (isSkin ? skins : catalog).find(item => item.id === id);
        const owned = isSkin ? state.ownedSkins : state.owned;
        if (!item || !(isSkin ? state.skinOffers : state.offers).includes(id)) return '이 상품의 판매가 종료됐습니다.';
        if (owned.includes(id)) return '이미 보유한 상품입니다.';
        if (state.coins < item.price) return '코인이 부족합니다.';
        state.coins -= item.price;
        owned.push(id);
        save();
        return `${item.name} 구매 완료! 인벤토리에서 장착하세요.`;
      },
      equip(id, kind = 'sound') {
        const isSkin = kind === 'skin';
        if (!(isSkin ? state.ownedSkins : state.owned).includes(id)) return false;
        state[isSkin ? 'equippedSkin' : 'equipped'] = id;
        save(); return true;
      },
    };
  }
  const api = { create, catalog, skins, interval };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KeycapStore = api;
})();
