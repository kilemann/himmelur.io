'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { api } = load();
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: fikk ${actual}, forventet ${expected} ± ${tol}`);
const MIN = 60000;
const utc = (y, mo, d, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s);
// Meeus bruker dynamisk tid (TD). Appen legger til DELTA_T, så vi trekker den fra for å treffe samme T.
const fromJDE = jde => (jde - 2440587.5) * 86400000 - api.DELTA_T * 1000;

test('Sola: Meeus eksempel 25.a (13. oktober 1992, 0 t TD)', () => {
  const p = api.sunPos(fromJDE(2448908.5));
  near(p.ra, 198.38083, 0.01, 'rektascensjon');
  near(p.dec, -7.78507, 0.01, 'deklinasjon');
  near(p.lon, 199.90895, 0.01, 'tilsynelatende lengde');
  near(p.dist / 149597870.7, 0.99766, 0.0001, 'avstand i AU');
});

test('Månen: Meeus eksempel 47.a (12. april 1992, 0 t TD)', () => {
  const p = api.moonPos(fromJDE(2448724.5));
  near(p.lon, 133.167265, 0.01, 'tilsynelatende lengde');
  near(p.lat, -3.229126, 0.01, 'bredde');
  near(p.ra, 134.688470, 0.01, 'rektascensjon');
  near(p.dec, 13.768368, 0.01, 'deklinasjon');
  near(p.dist, 368409.7, 100, 'avstand i km');
});

test('Solverv: Meeus eksempel 27.a (juni 1962) gir JDE 2437837.39245', () => {
  const t = api.season(1962, 1);
  near((t + api.DELTA_T * 1000) / 86400000 + 2440587.5, 2437837.39245, 60 / 86400, 'JDE');
});

test('Solverv og jevndøgn 2026 ligger på riktig dag og time (UTC)', () => {
  near(api.season(2026, 0), utc(2026, 3, 20, 14, 46), 60 * MIN, 'marsjevndøgn');
  near(api.season(2026, 1), utc(2026, 6, 21, 8, 24), 60 * MIN, 'sommersolverv');
  near(api.season(2026, 2), utc(2026, 9, 23, 0, 5), 60 * MIN, 'høstjevndøgn');
  near(api.season(2026, 3), utc(2026, 12, 21, 20, 50), 60 * MIN, 'vintersolverv');
});

test('nextSeason velger første hendelse av ønsket type fra et tidspunkt', () => {
  const a = api.nextSeason(utc(2026, 10, 26), [1, 3]);
  assert.equal(a.k, 3, 'neste solverv etter 26. okt er vintersolverv');
  const b = api.nextSeason(utc(2026, 10, 26), [0, 2]);
  assert.equal(b.k, 0, 'neste jevndøgn etter 26. okt er marsjevndøgn');
  assert.ok(b.t > utc(2027, 3, 19) && b.t < utc(2027, 3, 22));
  const c = api.nextSeason(utc(2026, 12, 22), [1, 3]);
  assert.equal(c.k, 1, 'etter vintersolverv kommer sommersolverv året etter');
  assert.equal(new Date(c.t).getUTCFullYear(), 2027);
});

test('Månefaser: nymåne 9. nov. 2026 07:02 UTC og fullmåne 24. nov. 2026 14:53 UTC', () => {
  near(api.nextPhase(utc(2026, 11, 1), 0), utc(2026, 11, 9, 7, 2), 20 * MIN, 'nymåne');
  near(api.nextPhase(utc(2026, 11, 10), 180), utc(2026, 11, 24, 14, 53), 20 * MIN, 'fullmåne');
});

test('Månefase ved fullmåne og nymåne: opplysning og elongasjon henger sammen', () => {
  const full = api.moonPhase(utc(2026, 11, 24, 14, 53));
  assert.ok(full.illum > 0.99, `fullmåne bør være nesten helt opplyst, fikk ${full.illum}`);
  near(full.elong, 180, 2, 'elongasjon ved fullmåne');
  const neu = api.moonPhase(utc(2026, 11, 9, 7, 2));
  assert.ok(neu.illum < 0.01, `nymåne bør være nesten ikke opplyst, fikk ${neu.illum}`);
  const waxing = api.moonPhase(utc(2026, 11, 16));
  assert.equal(waxing.waxing, true);
  const waning = api.moonPhase(utc(2026, 12, 1));
  assert.equal(waning.waxing, false);
  near(api.moonPhase(utc(2026, 11, 16)).age, 7, 1.5, 'alder ved omtrent første kvarter');
});

test('phaseName gir riktig navn ved kantene', () => {
  const c = { 0: 'Nymåne', 5.9: 'Nymåne', 6: 'Voksende månesigd', 45: 'Voksende månesigd', 90: 'Første kvarter',
    135: 'Voksende måne', 180: 'Fullmåne', 225: 'Avtakende måne', 270: 'Siste kvarter', 315: 'Avtakende månesigd', 354: 'Nymåne', 359.9: 'Nymåne' };
  for (const [e, name] of Object.entries(c)) assert.equal(api.phaseName(+e), name, `elongasjon ${e}`);
});

test('Refraksjon: ca. 0,5° ved horisonten, ubetydelig høyt oppe, og ingen korreksjon langt under', () => {
  const r0 = api.refract(0) - 0;
  assert.ok(r0 > 0.4 && r0 < 0.7, `refraksjon ved 0°: ${r0}`);
  near(api.refract(60) - 60, 0, 0.02, 'refraksjon ved 60°');
  assert.equal(api.refract(-5), -5);
});

test('Soloppgang og solnedgang, Oslo 21. juni 2026 (ca. 03:54 og 22:43 lokal tid)', () => {
  const t0 = api.localMidnight(2026, 6, 21, 'Europe/Oslo'), t1 = api.localMidnight(2026, 6, 22, 'Europe/Oslo');
  const s = api.dayEvents(t0, t1, 59.913, 10.752, false);
  assert.equal(s.rises.length, 1); assert.equal(s.sets.length, 1);
  near(s.rises[0], t0 + (3 * 60 + 54) * MIN, 3 * MIN, 'soloppgang');
  near(s.sets[0], t0 + (22 * 60 + 43) * MIN, 3 * MIN, 'solnedgang');
  near(s.above, 18 * 3600000 + 49 * MIN, 5 * MIN, 'daglengde');
});

test('Daglengde ved jevndøgn er litt over 12 timer, og kortere enn 7 timer ved vintersolverv i Kristiansand', () => {
  const tz = 'Europe/Oslo', lat = 58.146, lon = 7.996;
  const at = (y, m, d) => { const a = api.localMidnight(y, m, d, tz), b = api.localMidnight(y, m, d + 1, tz); return api.dayEvents(a, b, lat, lon, false); };
  near(at(2026, 9, 23).above, 12 * 3600000 + 8 * MIN, 8 * MIN, 'daglengde ved høstjevndøgn');
  assert.ok(at(2026, 12, 21).above < 7 * 3600000);
  assert.ok(at(2026, 6, 21).above > 17 * 3600000);
});

test('Midnattssol i Tromsø 21. juni og mørketid 21. desember', () => {
  const tz = 'Europe/Oslo', lat = 69.649, lon = 18.955;
  const ev = (y, m, d) => api.dayEvents(api.localMidnight(y, m, d, tz), api.localMidnight(y, m, d + 1, tz), lat, lon, false);
  const sommer = ev(2026, 6, 21);
  assert.equal(sommer.alwaysUp, true);
  assert.equal(sommer.rises.length + sommer.sets.length, 0);
  const vinter = ev(2026, 12, 21);
  assert.equal(vinter.above, 0);
  assert.equal(vinter.rises.length + vinter.sets.length, 0);
  assert.equal(vinter.alwaysUp, false);
});

test('Sørlig halvkule: sola står høyt i desember i Sydney', () => {
  const t = utc(2026, 12, 21, 2, 0); // ca. middag lokal tid
  const h = api.sunH(t, -33.869, 151.209);
  assert.ok(h.alt > 70, `høyde: ${h.alt}`);
});

test('Meridianpassasje av sola er maks høyde: 90 − bredde + deklinasjon', () => {
  const t0 = api.localMidnight(2026, 9, 23, 'Europe/Oslo'), t1 = api.localMidnight(2026, 9, 24, 'Europe/Oslo');
  const s = api.dayEvents(t0, t1, 59.913, 10.752, false);
  assert.equal(s.transits.length, 1);
  near(s.transits[0].alt, 90 - 59.913, 1, 'maks høyde ved jevndøgn');
});

test('Månen: i løpet av et døgn er det høyst én oppgang og én nedgang, og tiden over horisont er under 24 timer', () => {
  const t0 = api.localMidnight(2026, 10, 26, 'Europe/Oslo'), t1 = api.localMidnight(2026, 10, 27, 'Europe/Oslo');
  const m = api.dayEvents(t0, t1, 58.146, 7.996, true);
  assert.ok(m.rises.length <= 1 && m.sets.length <= 1);
  assert.ok(m.above >= 0 && m.above <= t1 - t0);
});

test('Horisontale koordinater: retning er mellom 0 og 360', () => {
  for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
    const r = api.sunH(utc(2026, 10, 26, h), 58.146, 7.996);
    assert.ok(r.az >= 0 && r.az < 360, `azimut ${r.az}`);
    assert.ok(r.alt >= -90 && r.alt <= 90, `høyde ${r.alt}`);
  }
});
