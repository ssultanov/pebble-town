// Smoke tests: the town loads, buildings can be built and entered, every room renders, travel/toy box/saving work, and nothing throws.
// The page exposes window.__pt (state + helpers) purely as a test hook.
const { test, expect } = require('@playwright/test');

/** Convert world coordinates (1440×1000 stage) to screen pixels. */
async function toScreen(page, x, y) {
  return page.evaluate(([x, y]) => {
    const m = document.getElementById('cam').getScreenCTM();
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, [x, y]);
}
async function dragTo(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('#splash')).toBeHidden();
});
test.afterEach(() => { if (errors) expect(errors, 'page errors').toEqual([]); });

test('the game starts in town with the hammer and hat', async ({ page }) => {
  expect(await page.evaluate(() => window.__pt.S.room)).toBe('town');
  await expect(page.locator('#bBuild')).toBeVisible();
  await expect(page.locator('#bDress')).toBeVisible();
  await expect(page.locator('#bBack')).toBeHidden();
  await expect(page.locator('[data-room="kitchen"]')).toBeHidden();
});

test('tapping the house goes inside and the back button returns to town', async ({ page }) => {
  const door = await toScreen(page, 720, 700);
  await page.mouse.click(door.x, door.y);
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('kitchen');
  await expect(page.locator('#bBack')).toBeVisible();
  await page.locator('#bBack').click();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('town');
});

test('the town scrolls left and right', async ({ page }) => {
  const a = await toScreen(page, 1200, 300), b = await toScreen(page, 300, 300);
  await dragTo(page, a, b);
  const x = await page.evaluate(() => window.__pt.S.camX);
  expect(x).toBeGreaterThan(500);
  await dragTo(page, await toScreen(page, x + 200, 300), await toScreen(page, x + 1200, 300));
  expect(await page.evaluate(() => window.__pt.S.camX)).toBeLessThan(x);
});

test('the hammer builds a house that can be entered and is saved', async ({ page }) => {
  await page.locator('#bBuild').click();
  await expect(page.locator('#bBuild')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-hot="lot"][data-lot="2"]').click();
  await page.locator('#buildGrid [data-t="shop"][data-c="0"]').click();
  await expect(page.locator('#build')).toBeHidden();
  const b = await page.evaluate(() => window.__pt.S.blds[0]);
  expect(b).toMatchObject({ lot: 2, type: 'shop' });
  await page.locator('#bBuild').click();
  await page.locator(`#bld-${b.id}`).click();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe(b.id);
  const before = await page.evaluate(() => window.__pt.E.length);
  await page.evaluate(() => window.__pt.tapHot('buy'));
  expect(await page.evaluate(() => window.__pt.E.length)).toBe(before + 1);
  await page.waitForTimeout(700);
  await page.reload();
  expect(await page.evaluate(() => [window.__pt.S.room, window.__pt.S.blds.length])).toEqual([b.id, 1]);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('#bBack').click();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('town');
});

test('a building can be changed and taken away', async ({ page }) => {
  await page.evaluate(() => window.__pt.addBld(2, 'home', 0));
  await page.waitForTimeout(800); // let the build animation finish
  await page.locator('#bBuild').click();
  await page.locator('#bld-b1').click();
  await page.locator('#buildGrid [data-t="home"][data-c="2"]').click();
  expect(await page.evaluate(() => window.__pt.S.blds[0].c)).toBe(2);
  await page.locator('#bld-b1').click();
  await page.locator('#buildGrid [data-raze]').click();
  expect(await page.evaluate(() => [window.__pt.S.blds.length, !!window.__pt.ROOMS.b1])).toEqual([0, false]);
});

test('the hat changes skin tone and hair style', async ({ page }) => {
  await page.locator('#bDress').click();
  await expect(page.locator('#dress')).toBeVisible();
  await page.locator('#opts [data-k="skin"]').first().click();
  await page.locator('#opts [data-k="hair"][data-v="braids"]').click();
  const look = await page.evaluate(() => { const S = window.__pt; return S.byId.zia.look; });
  expect(look).toMatchObject({ skin: '#FFE8DA', hair: 'braids' });
});

test('dragging a friend onto the back button brings them to town', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  const mo = await page.evaluate(() => { const e = window.__pt.byId.mo; return [e.x, e.y - 120]; });
  const box = await page.locator('#bBack').boundingBox();
  await dragTo(page, await toScreen(page, ...mo), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect.poll(() => page.evaluate(() => [window.__pt.S.room, window.__pt.byId.mo.room])).toEqual(['town', 'town']);
});

test('an older save (before the town) still loads', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('pebble-town.honey-street.v1', JSON.stringify({ v: 2, room: 'bath', night: true, ents: [{ id: 'mo', room: 'garden', x: 400, y: 900, surf: 'floor' }] }));
  });
  await page.reload();
  expect(await page.evaluate(() => [window.__pt.S.room, window.__pt.byId.mo.room, window.__pt.S.night])).toEqual(['bath', 'garden', true]);
});

test('every room renders', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  for (const room of ['kitchen', 'bedroom', 'bath', 'garden']) {
    await page.locator(`[data-room="${room}"]`).click();
    await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe(room);
    await expect(page.locator(`[data-room="${room}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('#ents > g').count()).toBeGreaterThan(0);
  }
});

test('dragging a friend onto a room button takes them there', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  const mo = await page.evaluate(() => { const e = window.__pt.byId.mo; return [e.x, e.y - 120]; });
  const box = await page.locator('[data-room="garden"]').boundingBox();
  await dragTo(page, await toScreen(page, ...mo), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect.poll(() => page.evaluate(() => [window.__pt.S.room, window.__pt.byId.mo.room])).toEqual(['garden', 'garden']);
});

test('toy box drops a new item into the room', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  const before = await page.evaluate(() => window.__pt.E.length);
  await page.getByRole('button', { name: 'Toy box' }).click();
  await page.locator('[data-type="pizza"]').click();
  await expect(page.locator('#box')).toBeHidden();
  expect(await page.evaluate(() => window.__pt.E.length)).toBe(before + 1);
});

test('feeding works and food goes back to the fridge', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  const apple = await page.evaluate(() => { const e = window.__pt.byId.apple1; return [e.x, e.y - 30]; });
  const cat = await page.evaluate(() => { const e = window.__pt.byId.biscuit; return [e.x, e.y - 60]; });
  await dragTo(page, await toScreen(page, ...apple), await toScreen(page, ...cat));
  await expect.poll(() => page.evaluate(() => window.__pt.byId.apple1.surf), { timeout: 4000 }).toMatch(/^fridge/);
});

test('the house is saved and comes back after reload', async ({ page }) => {
  await page.evaluate(() => window.__pt.switchRoom('kitchen'));
  await page.locator('[data-room="bath"]').click();
  await page.evaluate(() => window.__pt.tapHot('window')); // night time
  await page.waitForTimeout(700); // save is debounced
  await page.reload();
  expect(await page.evaluate(() => [window.__pt.S.room, window.__pt.S.night])).toEqual(['bath', true]);
});

async function dragHold(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150); // hold still so it is dropped, not thrown
  await page.mouse.up();
}

test('the school, library and market have floors to visit', async ({ page }) => {
  await page.evaluate(() => { window.__pt.S.camX = 3700; window.__pt.CARS.forEach((c) => { c.x = -3000; }); }); // cars out of the way
  await page.waitForTimeout(100);
  const door = await toScreen(page, 4420, 700);
  await page.mouse.click(door.x, door.y);
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('school1');
  await expect(page.locator('[data-room="school2"]')).toBeVisible();
  await expect(page.locator('[data-room="market1"]')).toBeHidden();
  await page.locator('[data-room="school2"]').click();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('school2');
  await page.locator('#bBack').click();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('town');
  expect(await page.evaluate(() => Math.round(window.__pt.S.camX))).toBe(3700);
  for (const room of ['library1', 'library2', 'market1', 'market2', 'market3']) {
    await page.evaluate((r) => window.__pt.switchRoom(r), room);
    await expect(page.locator(`[data-room="${room}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('#roomL > *').count()).toBeGreaterThan(5);
  }
  await expect(page.locator('[data-room="market3"]')).toBeVisible();
  const before = await page.evaluate(() => window.__pt.E.length);
  await page.evaluate(() => window.__pt.tapHot('coffee'));
  expect(await page.evaluate(() => window.__pt.E.length)).toBe(before + 1);
  // the last floor you were on is where you go back in
  await page.evaluate(() => window.__pt.switchRoom('town'));
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  expect(await page.evaluate(() => window.__pt.S.floor)).toMatchObject({ school: 'school2', library: 'library2', market: 'market3' });
});

test('cars stop for a friend standing in the road', async ({ page }) => {
  const zx = await page.evaluate(() => { const { CARS, byId } = window.__pt, c = CARS[0], z = byId.zia; z.x = c.x + 420; z.y = 980; z.surf = 'floor'; return z.x; });
  await page.waitForTimeout(2500);
  const [v, x] = await page.evaluate(() => [window.__pt.CARS[0].v, window.__pt.CARS[0].x]);
  expect(v).toBe(0);
  expect(x).toBeLessThan(zx);
  await page.evaluate(() => { window.__pt.byId.zia.y = 862; }); // back on the pavement
  await expect.poll(() => page.evaluate(() => window.__pt.CARS[0].v)).toBeGreaterThan(20);
});

test('a friend dropped into a car rides along', async ({ page }) => {
  const seat = await page.evaluate(() => { const c = window.__pt.CARS[0]; c.vmax = 0; c.v = 0; return { x: c.surf.x1 + 50, y: c.surf.y }; });
  const zia = await page.evaluate(() => { const e = window.__pt.byId.zia; return [e.x, e.y - 120]; });
  await dragHold(page, await toScreen(page, ...zia), await toScreen(page, seat.x, seat.y - 150));
  await expect.poll(() => page.evaluate(() => window.__pt.byId.zia.surf)).toBe('car0');
  const x0 = await page.evaluate(() => { window.__pt.CARS[0].vmax = 220; return window.__pt.byId.zia.x; });
  await expect.poll(() => page.evaluate(() => window.__pt.byId.zia.x)).toBeGreaterThan(x0 + 50);
});

test('a traffic light stops the cars', async ({ page }) => {
  await page.evaluate(() => { const { S, CARS } = window.__pt; S.camX = 3200; const c = CARS[0]; c.x = 3300; });
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__pt.tapHot('tlight'));
  expect(await page.evaluate(() => window.__pt.S.red[0])).toBe(true);
  await page.waitForTimeout(3000);
  const c = await page.evaluate(() => { const c = window.__pt.CARS[0]; return { v: c.v, front: c.x + 160 }; });
  expect(c.v).toBe(0);
  expect(c.front).toBeLessThan(3860);
});

test('the street has hydrants and mailboxes that react to taps', async ({ page }) => {
  expect(await page.locator('[data-hot="hydrant"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-hot="mailbox"]').count()).toBeGreaterThan(0);
  for (const h of ['hydrant', 'mailbox']) {
    await page.evaluate((h) => window.__pt.tapHot(h), h);
    expect(await page.locator('#parts > g').count()).toBeGreaterThan(0);
    await page.waitForTimeout(1300);
  }
});

test('the town map shows every building and takes you where you tap', async ({ page }) => {
  await page.evaluate(() => { window.__pt.addBld(0, 'home', 0); window.__pt.addBld(10, 'shop', 1); });
  await page.getByRole('button', { name: 'Town map' }).click();
  await expect(page.locator('#map')).toBeVisible();
  for (const id of ['honey', 'school', 'library', 'market', 'b1', 'b2']) await expect(page.locator(`#mapSvg [data-mb="${id}"]`)).toHaveCount(1);
  expect(await page.locator('#mapSvg [data-ml]').count()).toBe(9);
  // the set pieces around the streets: mall + car park, café, restaurant, hospital and the park
  for (const id of ['mall', 'cafe', 'restaurant', 'hospital', 'park']) await expect(page.locator(`#mapSvg [data-mset="${id}"]`)).toHaveCount(1);
  await page.waitForTimeout(400); // let the map finish popping in
  await page.locator('#mapSvg [data-mb="library"]').click();
  await expect(page.locator('#map')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__pt.S.room)).toBe('library1');
  // an empty lot: back to the street there, with the builder open
  await page.getByRole('button', { name: 'Town map' }).click();
  await page.waitForTimeout(400);
  await page.locator('#mapSvg [data-ml="4"]').click();
  await expect(page.locator('#build')).toBeVisible();
  expect(await page.evaluate(() => [window.__pt.S.room, Math.round(window.__pt.S.camX + 720)])).toEqual(['town', 1920]);
  await page.locator('#bBuildDone').click();
  await page.getByRole('button', { name: 'Town map' }).click();
  await page.getByRole('button', { name: 'Close map' }).click();
  await expect(page.locator('#map')).toBeHidden();
});

test('the town map fills a tall screen with town (no sky gap at the top)', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await page.getByRole('button', { name: 'Town map' }).click();
  await expect(page.locator('#map')).toBeVisible();
  await page.waitForTimeout(400);
  // the ground covers the whole screen, and there are buildings right up at the top edge
  const r = await page.evaluate(() => {
    const g = document.querySelector('#mapSvg rect').getBoundingClientRect();
    const topHits = [100, 350, 600].map(x => document.elementFromPoint(x, 4)?.closest('#mapSvg') ? 1 : 0);
    return { cover: g.top <= 0 && g.bottom >= innerHeight && g.left <= 0 && g.right >= innerWidth, topHits };
  });
  expect(r.cover).toBe(true);
  expect(r.topHits).toEqual([1, 1, 1]);
});
