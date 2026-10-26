'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { api } = load();
// Verdier fra den simulerte nettleseren har egne Array/Object-prototyper; sammenlign som vanlig JSON
const plain = x => JSON.parse(JSON.stringify(x));

test('tzOffset: Oslo er UTC+1 om vinteren og UTC+2 om sommeren', () => {
  assert.equal(api.tzOffset(Date.UTC(2026, 0, 15), 'Europe/Oslo'), 60);
  assert.equal(api.tzOffset(Date.UTC(2026, 6, 15), 'Europe/Oslo'), 120);
  assert.equal(api.tzOffset(Date.UTC(2026, 6, 15), 'Asia/Kolkata'), 330);
});

test('localMidnight: vanlig døgn er 24 timer, sommertidsskifte gir 23 og 25 timer', () => {
  const len = (y, m, d) => (api.localMidnight(...api.nextDay(y, m, d).slice(0, 3), 'Europe/Oslo') - api.localMidnight(y, m, d, 'Europe/Oslo')) / 3600000;
  assert.equal(len(2026, 6, 10), 24);
  assert.equal(len(2026, 3, 29), 23, 'overgang til sommertid 29. mars 2026');
  assert.equal(len(2026, 10, 25), 25, 'overgang til vintertid 25. oktober 2026');
  assert.equal(api.localMidnight(2026, 10, 25, 'Europe/Oslo'), Date.UTC(2026, 9, 24, 22, 0, 0));
  assert.equal(api.localMidnight(2026, 1, 1, 'Europe/Oslo'), Date.UTC(2025, 11, 31, 23, 0, 0));
});

test('nextDay og prevDay håndterer måneds-, års- og skuddårsskifte', () => {
  assert.deepEqual(plain(api.nextDay(2026, 12, 31)), [2027, 1, 1]);
  assert.deepEqual(plain(api.prevDay(2027, 1, 1)), [2026, 12, 31]);
  assert.deepEqual(plain(api.nextDay(2028, 2, 28)), [2028, 2, 29]);
  assert.deepEqual(plain(api.nextDay(2026, 2, 28)), [2026, 3, 1]);
  assert.deepEqual(plain(api.prevDay(2026, 3, 1)), [2026, 2, 28]);
});

test('parts: gir lokale deler for et tidspunkt', () => {
  const p = api.parts(Date.UTC(2026, 9, 26, 23, 30, 15), 'Europe/Oslo');
  assert.deepEqual({ ...p }, { y: 2026, m: 10, d: 27, h: 0, mi: 30, s: 15 });
});

test('isoWeek følger ISO 8601', () => {
  assert.equal(api.isoWeek(2026, 1, 1), 1);
  assert.equal(api.isoWeek(2020, 12, 31), 53);
  assert.equal(api.isoWeek(2021, 1, 3), 53);
  assert.equal(api.isoWeek(2021, 1, 4), 1);
  assert.equal(api.isoWeek(2024, 12, 30), 1);
  assert.equal(api.isoWeek(2026, 10, 26), 44);
});

test('Formatering: dec, dur, compass, hm', () => {
  assert.equal(api.dec(1.25, 1), '1,3');
  assert.equal(api.dec(-0.46, 1), '−0,5');
  assert.equal(api.dec(59.9133, 3), '59,913');
  assert.equal(api.dur(12 * 3600000 + 7 * 60000), '12 t 07 min');
  assert.equal(api.dur(0), '0 t 00 min');
  assert.equal(api.dur(24 * 3600000), '24 t 00 min');
  const dirs = { 0: 'N', 45: 'NØ', 90: 'Ø', 135: 'SØ', 180: 'S', 225: 'SV', 270: 'V', 315: 'NV', 359: 'N' };
  for (const [az, d] of Object.entries(dirs)) assert.equal(api.compass(+az), d, `retning ${az}`);
  assert.equal(api.hm(Date.UTC(2026, 9, 26, 12, 0, 0), 'Europe/Oslo'), '13:00');
  assert.equal(api.hm(Date.UTC(2026, 9, 26, 12, 0, 40), 'Europe/Oslo'), '13:01', 'avrundes til nærmeste minutt');
});

test('norm fjerner æøå og aksenter og gjør små bokstaver', () => {
  assert.equal(api.norm('Ålesund'), 'alesund');
  assert.equal(api.norm('  Tromsø '), 'tromso');
  assert.equal(api.norm('København'), 'kobenhavn');
  assert.equal(api.norm('Göteborg'), 'goteborg');
  assert.equal(api.norm('Zürich'), 'zurich');
  assert.equal(api.norm('Wrocław') === 'wrocław' || api.norm('Wrocław') === 'wroclaw', true);
});

test('Bylisten: alle har gyldige koordinater og en tidssone Intl kjenner', () => {
  assert.ok(api.CITIES.length > 100);
  const names = new Set();
  for (const [name, region, lat, lon, tz] of api.CITIES) {
    assert.ok(name && region, `navn og region mangler: ${name}`);
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, `${name}: koordinater utenfor gyldig område`);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('nb-NO', { timeZone: tz }), `${name}: ukjent tidssone ${tz}`);
    names.add(`${name}|${region}`);
  }
  assert.equal(names.size, api.CITIES.length, 'duplikate byer');
});

test('matches: prefikssøk uten hensyn til æøå, største treff først, maks 7', () => {
  assert.deepEqual(plain(api.matches('')), []);
  assert.equal(api.matches('kristians')[0][0], 'Kristiansand');
  assert.ok(api.matches('kristians').some(c => c[0] === 'Kristiansund'));
  assert.equal(api.matches('alesund')[0][0], 'Ålesund');
  assert.equal(api.matches('TROMSO')[0][0], 'Tromsø');
  assert.ok(api.matches('s').length <= 7);
  assert.deepEqual(plain(api.matches('xyzxyz')), []);
  assert.ok(api.matches('nordland').length > 0, 'søk på fylke gir treff');
});

test('parseCoord: leser koordinater og avviser alt annet', () => {
  const a = api.parseCoord('62.47, 6.15');
  assert.equal(a.lat, 62.47); assert.equal(a.lon, 6.15); assert.equal(a.tz, 'Europe/Oslo');
  assert.equal(a.name, 'Egendefinert punkt');
  const b = api.parseCoord('62,47 6,15');
  assert.equal(b.lat, 62.47); assert.equal(b.lon, 6.15);
  const c = api.parseCoord('-33.87; 151.21');
  assert.equal(c.lat, -33.87); assert.equal(c.tz, 'Australia/Sydney');
  assert.equal(api.parseCoord('91, 10'), null);
  assert.equal(api.parseCoord('50, 181'), null);
  assert.equal(api.parseCoord('Oslo'), null);
  assert.equal(api.parseCoord(''), null);
  assert.equal(api.parseCoord('59.9'), null);
});

test('distKm: Oslo–Bergen er omtrent 305 km, og null mellom like punkter', () => {
  const d = api.distKm(59.913, 10.752, 60.391, 5.322);
  assert.ok(d > 295 && d < 315, `avstand: ${d}`);
  assert.equal(api.distKm(59.9, 10.7, 59.9, 10.7), 0);
});

test('nearestCity finner nærmeste by', () => {
  const r = api.nearestCity(58.15, 8.0);
  assert.equal(r.c[0], 'Kristiansand');
  assert.ok(r.km < 2);
  assert.equal(api.nearestCity(69.7, 19.0).c[0], 'Tromsø');
});

test('loadLoc: standardby ved første besøk, lagret sted ellers, og tåler skadet lagring', () => {
  const first = load();
  assert.equal(first.api.loadLoc().name, 'Kristiansand');
  assert.equal(first.api.DEFAULT_CITY, 'Kristiansand');
  const saved = load({ storage: { 'solmane.loc': JSON.stringify({ name: 'Bergen', region: 'Vestland', lat: 60.391, lon: 5.322, tz: 'Europe/Oslo' }) } });
  assert.equal(saved.api.loadLoc().name, 'Bergen');
  const broken = load({ storage: { 'solmane.loc': '{ikke json' } });
  assert.equal(broken.api.loadLoc().name, 'Kristiansand');
  const nolat = load({ storage: { 'solmane.loc': JSON.stringify({ name: 'X' }) } });
  assert.equal(nolat.api.loadLoc().name, 'Kristiansand', 'mangler breddegrad → standardby');
});

test('Appen starter selv om lagring er blokkert', () => {
  const r = load({ storageFails: true });
  assert.equal(r.api.loc.name, 'Kristiansand');
});
