const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create, catalog, interval } = require('./store.js');
function fixture(coins = '500') {
  const values = new Map([['keycap-clicker.coins.v1', coins]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let time = 1000000;
  const open = () => create(storage, () => time, () => .4);
  return { open, advance: ms => { time += ms; } };
}
test('legacy balance migrates; purchases, balance and equipment survive reload', () => {
  const f = fixture();
  const game = f.open();
  assert.equal(game.state.coins, 500);
  const id = game.state.offers[0];
  const price = catalog.find(item => item.id === id).price;
  game.buy(id);
  assert.equal(game.state.coins, 500 - price);
  assert.ok(game.equip(id));
  const restored = f.open();
  assert.deepEqual(restored.state, game.state);
  restored.buy(id);
  assert.equal(restored.state.coins, 500 - price);
  restored.earn();
  assert.equal(f.open().state.coins, 501 - price);
});
test('shop is stable before deadline and changes at five minutes, including offline', () => {
  const f = fixture();
  const game = f.open();
  const original = [...game.state.offers];
  f.advance(interval - 1);
  assert.equal(game.refresh(), false);
  assert.deepEqual(f.open().state.offers, original);
  f.advance(1);
  assert.equal(game.refresh(), true);
  assert.equal(new Set(game.state.offers).size, 3);
  assert.notDeepEqual([...game.state.offers].sort(), original.sort());
  const expired = original.find(id => !game.state.offers.includes(id));
  game.buy(expired);
  assert.equal(game.state.coins, 500);
  const deadline = game.state.refreshAt;
  f.advance(interval * 3);
  assert.ok(f.open().state.refreshAt > deadline);
});
test('insufficient funds and unowned equipment are rejected', () => {
  const game = fixture('0').open();
  const id = game.state.offers[0];
  game.buy(id);
  assert.equal(game.state.coins, 0);
  assert.deepEqual(game.state.owned, ['basic']);
  assert.equal(game.equip(id), false);
});
test('storage failure does not prevent playing', () => {
  const game = create(undefined);
  game.earn();
  assert.equal(game.state.coins, 1);
  assert.equal(game.state.offers.length, 3);
});
