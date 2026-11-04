'use strict';
/* Robusthet og kantfall (v1.8): ugyldig lagring, tastatur, horisontterskel, dager med to solnedganger,
   tallrad under diagrammet, kalenderrader og sidens oppbygging. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load, HTML } = require('./load');

const NOON = Date.UTC(2026, 9, 26, 12, 0, 0); // mandag 26. oktober 2026, 13:00 i Oslo
const KEY = 'solmane.loc';
const stored = v => ({ storage: { [KEY]: typeof v === 'string' ? v : JSON.stringify(v) } });
const key = (env, k, extra = {}) => env.document.dispatch('keydown', { key: k, ...extra });

// ---------- Lagret sted ----------
test('Lagret sted med ugyldig tidssone: appen starter og bruker tidssonen til nærmeste by', () => {
  const { env, api } = load({ now: NOON, ...stored({ name: 'Bergenseren', region: '', lat: 60.39, lon: 5.32, tz: 'Foo/Bar' }) });
  assert.match(env.el('clock').textContent, /^\d\d:\d\d:\d\d$/, 'klokka skal gå');
  assert.equal(api.loc.tz, 'Europe/Oslo');
  assert.equal(api.loc.name, 'Bergenseren', 'stedet beholdes');
});

test('Lagret sted uten tidssone får tidssone fra nærmeste by', () => {
  const { api } = load({ now: NOON, ...stored({ name: 'Tokyo-området', region: '', lat: 35.7, lon: 139.7 }) });
  assert.equal(api.loc.tz, 'Asia/Tokyo');
});

test('Lagret sted med ugyldige koordinater forkastes, og appen starter på standardbyen', () => {
  const bad = [
    { name: 'x', lat: 200, lon: 10, tz: 'Europe/Oslo' },
    { name: 'x', lat: 60, lon: 500, tz: 'Europe/Oslo' },
    { name: 'x', lat: null, lon: null, tz: 'Europe/Oslo' },
    { name: 'x', lat: '60', lon: '10', tz: 'Europe/Oslo' },
    { name: 'x', lat: 60 },
    null, 'tekst', 42, [],
  ];
  for (const b of bad) {
    const { api, env } = load({ now: NOON, ...stored(JSON.stringify(b)) });
    assert.equal(api.loc.name, 'Kristiansand', JSON.stringify(b));
    assert.ok(!/NaN|Infinity/.test(env.el('sRows').innerHTML), JSON.stringify(b));
  }
});

test('Stedsnavn fra lagring vises som tekst, ikke som HTML', () => {
  const { env } = load({ now: NOON, ...stored({ name: '<img src=x onerror=1>', region: '"><b>fet</b>', lat: 60, lon: 10, tz: 'Europe/Oslo' }) });
  const h = env.el('coord').innerHTML;
  assert.ok(!/<img|<b>fet/.test(h), h);
  assert.match(h, /&lt;img/);
});

test('Gyldig lagret sted med GPS-felt beholdes uendret', () => {
  const s = { name: 'Min posisjon', region: '3 km fra Bergen', lat: 60.4, lon: 5.3, tz: 'Europe/Oslo', gps: true, acc: 25 };
  const { api } = load({ now: NOON, ...stored(s) });
  assert.deepEqual({ ...api.loc }, s);
});

// ---------- Tastatur ----------
test('Piltaster blar én dag fram og tilbake', () => {
  const { env, api } = load({ now: NOON });
  key(env, 'ArrowRight');
  assert.deepEqual({ ...api.sel }, { y: 2026, m: 10, d: 27 });
  key(env, 'ArrowLeft');
  assert.equal(api.sel, null);
});

test('Piltaster blar ikke dag mens info-vinduet er åpent', () => {
  const { env, api } = load({ now: NOON });
  env.el('infobtn').click();
  assert.equal(env.el('info').hidden, false);
  key(env, 'ArrowRight');
  assert.equal(api.sel, null, 'pil høyre');
  key(env, 'ArrowLeft');
  assert.equal(api.sel, null, 'pil venstre fra i dag ville gitt gårsdagen');
  key(env, 'Escape');
  assert.equal(env.el('info').hidden, true);
  key(env, 'ArrowRight');
  assert.ok(api.sel, 'blar igjen når vinduet er lukket');
});

test('Piltaster blar ikke dag mens kalenderen er åpen', () => {
  const { env, api } = load({ now: NOON });
  api.openCal();
  key(env, 'ArrowRight');
  assert.equal(api.sel, null);
});

test('Piltaster med Alt, Ctrl, Cmd eller Shift blar ikke dag (Alt+← er «tilbake» i nettleseren)', () => {
  for (const m of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    for (const k of ['ArrowLeft', 'ArrowRight']) {
      const { env, api } = load({ now: NOON }); // ny app per tast, så to taster ikke opphever hverandre
      key(env, k, { [m]: true });
      assert.equal(api.sel, null, `${m} + ${k}`);
    }
  }
});

// ---------- «Over/under horisont» skifter ved oppgang og nedgang ----------
test('Sol: «over horisont» skifter akkurat ved soloppgang og solnedgang, ikke minutter før', () => {
  const { env, api } = load({ now: NOON });
  const { rises, sets } = api.day.sun;
  assert.ok(rises.length && sets.length);
  const at = t => { env.setNow(t); api.tick(true); return env.el('sAltN').textContent; };
  assert.equal(at(rises[0] - 120000), 'under horisont', '2 min før soloppgang');
  assert.equal(at(rises[0] + 120000), 'over horisont', '2 min etter soloppgang');
  assert.equal(at(sets[0] - 120000), 'over horisont', '2 min før solnedgang');
  assert.equal(at(sets[0] + 120000), 'under horisont', '2 min etter solnedgang');
});

test('Måne: «over horisont» skifter akkurat ved måneoppgang og månenedgang', () => {
  const { env, api } = load({ now: NOON });
  const { rises, sets } = api.day.moon;
  assert.ok(rises.length && sets.length);
  const at = t => { env.setNow(t); api.tick(true); return env.el('mAltN').textContent; };
  assert.equal(at(rises[0] - 120000), 'under horisont', '2 min før måneoppgang');
  assert.equal(at(rises[0] + 120000), 'over horisont', '2 min etter måneoppgang');
  assert.equal(at(sets[0] - 120000), 'over horisont', '2 min før månenedgang');
  assert.equal(at(sets[0] + 120000), 'under horisont', '2 min etter månenedgang');
});

test('riseAlt: synlig høyde ved oppgang er omtrent −0,2° for sol og måne', () => {
  const { api } = load({ now: NOON });
  for (const moon of [false, true]) {
    const a = api.riseAlt(moon, NOON);
    assert.ok(a > -0.35 && a < -0.1, `${moon ? 'måne' : 'sol'}: ${a}`);
  }
});

// ---------- To solnedganger samme døgn ----------
test('Når midnattssolen tar slutt går sola ned to ganger samme døgn: begge vises, riktig solnedgang først', () => {
  const { env, api } = load({ now: Date.UTC(2026, 6, 27, 10, 0, 0) });
  api.setLoc({ name: 'Tromsø', region: 'Troms', lat: 69.649, lon: 18.955, tz: 'Europe/Oslo' });
  assert.equal(api.day.sun.sets.length, 2, 'forutsetning: to solnedganger 27. juli');
  const h = env.el('sRows').innerHTML;
  assert.match(h, /Soloppgang<\/dt><dd>01:29<\/dd>/);
  assert.match(h, /Solnedgang<\/dt><dd>23:59<\/dd><dd class="n">også 00:13<\/dd>/);
});

test('Vanlig dag: en soloppgang og en solnedgang, uten «også»-merknad', () => {
  const { env } = load({ now: NOON });
  assert.ok(!/også/.test(env.el('sRows').innerHTML));
});

// ---------- Tallrad under diagrammet ----------
test('Maks høyde og daglengde står i en egen rad under diagrammet, ikke som tekst i selve diagrammet', () => {
  const { env } = load({ now: Date.UTC(2026, 9, 28, 12, 0, 0) }); // 28. oktober: månen passerer meridian
  const svg = env.el('chart').innerHTML, r = env.el('chartStats').innerHTML;
  assert.ok(!/↑|Daglengde/.test(svg), 'ingen overlappende tekst i diagrammet');
  assert.match(svg, /horisont/);
  assert.match(r, /Daglengde[\s\S]*\d+ t \d{2} min/);
  assert.match(r, /Sol maks[\s\S]*−?\d+,\d°/);
  assert.match(r, /Måne maks[\s\S]*−?\d+,\d°/);
});

test('Døgn uten meridianpassering for månen (månedøgnet er 24 t 50 min) forklares i stedet for å vise bare en strek', () => {
  const { env, api } = load({ now: NOON }); // 26. oktober 2026 i Kristiansand
  assert.equal(api.day.moon.transits.length, 0, 'forutsetning');
  assert.match(env.el('chartStats').innerHTML, /Måne maks[\s\S]*–[\s\S]*ingen i døgnet/);
});

test('Tallraden viser midnattssol og mørketid i stedet for oppgang og nedgang', () => {
  const sommer = load({ now: Date.UTC(2026, 5, 21, 10, 0, 0) });
  sommer.env.el('city').value = 'Tromsø'; sommer.api.submitCity();
  assert.match(sommer.env.el('chartStats').innerHTML, /24 t 00 min[\s\S]*midnattssol/i);
  const vinter = load({ now: Date.UTC(2026, 11, 21, 10, 0, 0) });
  vinter.env.el('city').value = 'Tromsø'; vinter.api.submitCity();
  assert.match(vinter.env.el('chartStats').innerHTML, /0 t 00 min[\s\S]*mørketid/i);
});

test('Diagrammet tilpasser seg tilgjengelig bredde, så teksten ikke blir for liten på mobil', () => {
  const { env, api } = load({ now: NOON });
  const vb = () => /^0 0 (\d+) (\d+)$/.exec(env.el('chart').getAttribute('viewBox'));
  assert.deepEqual([vb()[1], vb()[2]], ['720', '230'], 'uten målt bredde: full størrelse');
  env.el('chart').parentNode = { clientWidth: 320 };
  api.renderChartBase();
  assert.equal(vb()[1], '320');
  assert.ok(+vb()[2] >= 220);
  const xs = [...env.el('chart').innerHTML.matchAll(/ x="(-?[\d.]+)"/g)].map(m => +m[1]);
  assert.ok(xs.every(x => x >= 0 && x <= 320), 'alt ligger innenfor bredden');
  env.el('chart').parentNode = { clientWidth: 1400 };
  api.renderChartBase();
  assert.equal(vb()[1], '720', 'aldri bredere enn 720');
  env.el('chart').parentNode = { clientWidth: 120 };
  api.renderChartBase();
  assert.equal(vb()[1], '300', 'aldri smalere enn 300');
});

test('Diagrammet tegnes på nytt når vinduet endrer størrelse', () => {
  const { env } = load({ now: NOON });
  env.el('chart').parentNode = { clientWidth: 340 };
  env.winEvents.dispatch('resize');
  env.advance(500);
  assert.equal(env.el('chart').getAttribute('viewBox').split(' ')[2], '340');
});

// ---------- Kalender ----------
test('Kalenderen viser bare de ukene måneden trenger (4, 5 eller 6 rader)', () => {
  const { env, api } = load({ now: NOON });
  const rows = (y, m) => { api.calView = { y, m }; api.renderCal(); return (env.el('grid').innerHTML.match(/class="wk"/g) || []).length; };
  assert.equal(rows(2027, 2), 4, 'feb 2027 starter på mandag og har 28 dager');
  assert.equal(rows(2026, 10), 5);
  assert.equal(rows(2026, 8), 6, 'aug 2026 starter på lørdag og har 31 dager');
  assert.equal(rows(2024, 2), 5, 'skuddår');
});

// ---------- Sidens oppbygging ----------
test('index.html har title, beskrivelse, temafarge og stiler i <head>, og språk satt', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, '');
  assert.match(html, /<html lang="nb">/);
  assert.match(head, /<title>Himmelur<\/title>/);
  assert.match(head, /<meta name="description" content="[^"]{20,}"/);
  assert.match(head, /<meta name="theme-color"/);
  assert.match(head, /<meta name="viewport"[^>]*viewport-fit=cover/);
  assert.match(head, /<style>/);
  assert.ok(!/<title|<style|<link |<meta /.test(body), 'title, style, link og meta skal ikke ligge i <body>');
});
