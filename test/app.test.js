'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const NOON = Date.UTC(2026, 9, 26, 12, 0, 0); // mandag 26. oktober 2026, 13:00 i Oslo

test('Oppstart: klokke, dato og sted vises, og sol- og månepanelene fylles', () => {
  const { env, api } = load({ now: NOON });
  assert.equal(env.el('clock').textContent, '13:00:00');
  assert.equal(env.el('datestr').textContent, 'Mandag 26. oktober 2026');
  assert.match(env.el('tzline').textContent, /Lokal tid for Kristiansand · UTC\+1/);
  assert.match(env.el('coord').innerHTML, /Kristiansand/);
  assert.match(env.el('sRows').innerHTML, /Soloppgang/);
  assert.match(env.el('sRows').innerHTML, /Neste vintersolverv/);
  assert.match(env.el('sRows').innerHTML, /Neste vårjevndøgn/);
  assert.match(env.el('mRows').innerHTML, /Neste fullmåne/);
  assert.match(env.el('daylen').textContent, /^\d{1,2} t \d{2} min$/);
  assert.match(env.el('daydiff').textContent, /^−\d+ min fra dagen før$/, 'dagene blir kortere i slutten av oktober');
  assert.equal(api.sel, null);
  assert.equal(env.el('whenrow').hidden, true, '«Viser valgt dato» skal ikke vises når dagens dato er valgt');
});

test('Klokken går: tick oppdaterer klokkeslettet hvert sekund', () => {
  const { env } = load({ now: NOON });
  env.advance(1000);
  assert.equal(env.el('clock').textContent, '13:00:01');
  env.advance(59000);
  assert.equal(env.el('clock').textContent, '13:01:00');
});

test('Høyde og retning nå oppdateres og får verdier med enhet', () => {
  const { env } = load({ now: NOON });
  assert.match(env.el('sAlt').textContent, /^−?\d+,\d°$/);
  assert.match(env.el('sAz').textContent, /^\d+,\d°$/);
  assert.match(env.el('sAltN').textContent, /over horisont|under horisont/);
  assert.match(env.el('sAzN').textContent, /^(N|NNØ|NØ|ØNØ|Ø|ØSØ|SØ|SSØ|S|SSV|SV|VSV|V|VNV|NV|NNV)$/);
  assert.match(env.el('phName').textContent, /måne|Nymåne|kvarter/i);
  assert.match(env.el('phSub').textContent, /^\d+ % opplyst · \d+,\d døgn gammel$/);
});

test('Midnatt: neste døgn beregnes automatisk når datoen skifter', () => {
  const { env, api } = load({ now: Date.UTC(2026, 9, 26, 22, 59, 58) }); // 23:59:58 lokal tid
  assert.equal(api.day.d, 26);
  env.advance(3000);
  assert.equal(api.day.d, 27);
  assert.equal(env.el('datestr').textContent, 'Tirsdag 27. oktober 2026');
});

test('Pilknapper: neste og forrige dag, og tilbake til i dag', () => {
  const { env, api } = load({ now: NOON });
  env.el('nextday').click();
  assert.deepEqual({ ...api.sel }, { y: 2026, m: 10, d: 27 });
  assert.equal(env.el('datestr').textContent, 'Tirsdag 27. oktober 2026');
  assert.equal(env.el('whenrow').hidden, false, '«Viser valgt dato» vises');
  env.el('prevday').click();
  assert.equal(api.sel, null, 'tilbake til i dag nullstiller valgt dato');
  assert.equal(env.el('whenrow').hidden, true);
  env.el('prevday').click();
  assert.deepEqual({ ...api.sel }, { y: 2026, m: 10, d: 25 });
  env.el('reset').click();
  assert.equal(api.sel, null);
  assert.equal(env.el('datestr').textContent, 'Mandag 26. oktober 2026');
});

test('Valgt dato beholder klokkeslettet fra nå, og aldri utenfor det valgte døgnet', () => {
  const { env, api } = load({ now: NOON });
  api.pickDate(2026, 12, 24);
  assert.equal(env.el('datestr').textContent, 'Torsdag 24. desember 2026');
  assert.equal(env.el('clock').textContent, '13:00:00');
  assert.ok(api.shownMs() >= api.day.t0 && api.shownMs() < api.day.t1);
  // 25 timer lang dag: tidspunkt 24:30 etter midnatt finnes ikke på en 24 t-dag, men skal klemmes inn
  const late = load({ now: Date.UTC(2026, 9, 25, 22, 59, 0) }); // 23:59 lokal tid
  late.api.pickDate(2026, 10, 25);
  assert.ok(late.api.shownMs() < late.api.day.t1);
});

test('Datoskifte i år med sommertid: døgnet 25. oktober er 25 timer', () => {
  const { api } = load({ now: NOON });
  api.pickDate(2026, 10, 25);
  assert.equal((api.day.t1 - api.day.t0) / 3600000, 25);
  api.pickDate(2026, 3, 29);
  assert.equal((api.day.t1 - api.day.t0) / 3600000, 23);
});

test('Skuddår: 29. februar 2028 kan velges, og årsslideren får 366 dager', () => {
  const { env, api } = load({ now: NOON });
  api.pickDate(2028, 2, 29);
  assert.deepEqual([api.day.y, api.day.m, api.day.d], [2028, 2, 29]);
  assert.equal(env.el('yslider').max, 366);
  assert.equal(env.el('ybDoy').textContent, '60/366');
  api.pickDate(2027, 2, 28);
  assert.equal(env.el('yslider').max, 365);
  assert.equal(env.el('ybDoy').textContent, '59/365');
});

test('Årsslider: dag i året vises og slideren settes til riktig verdi', () => {
  const { env } = load({ now: NOON });
  assert.equal(env.el('ybYear').textContent, 2026);
  assert.equal(env.el('ybDoy').textContent, '299/365');
  assert.equal(env.el('yslider').value, 299);
  assert.equal(env.el('yslider').getAttribute('aria-valuetext'), '26. oktober 2026');
});

test('Kalender: åpner med riktig måned, markerer i dag, og bytter måned og år', () => {
  const { env, api } = load({ now: NOON });
  env.el('timebtn').click();
  assert.equal(env.el('cal').hidden, false);
  assert.equal(env.el('timebtn').getAttribute('aria-expanded'), 'true');
  assert.equal(env.el('calttl').textContent, 'oktober 2026');
  const grid = env.el('grid').innerHTML;
  assert.match(grid, /data-d="2026-10-26"/);
  assert.match(grid, /class="[^"]*today[^"]*sel[^"]*" data-d="2026-10-26"|class="[^"]*sel[^"]*today[^"]*" data-d="2026-10-26"/);
  assert.match(grid, /<div class="wk">44<\/div>/, 'ukenummer for uka med 26. oktober');
  env.el('nm').click();
  assert.equal(env.el('calttl').textContent, 'november 2026');
  env.el('ny').click();
  assert.equal(env.el('calttl').textContent, 'november 2027');
  env.el('py').click(); env.el('py').click();
  assert.equal(env.el('calttl').textContent, 'november 2025');
  // desember → januar går over årsskiftet
  api.openCal(); api.stepMonth(2); api.stepMonth(1);
  assert.equal(env.el('calttl').textContent, 'januar 2027');
  env.el('calclose').click();
  assert.equal(env.el('cal').hidden, true);
});

test('Kalender: kalenderrutenettet har hele uker og starter på mandag', () => {
  const { env, api } = load({ now: NOON });
  for (const [y, m] of [[2026, 2], [2026, 10], [2027, 5], [2028, 2]]) {
    api.openCal(); api.pickDate; // åpne, så bytt visning direkte
    api.calView = { y, m }; api.renderCal();
    const days = [...env.el('grid').innerHTML.matchAll(/data-d="(\d+)-(\d+)-(\d+)"/g)];
    assert.equal(days.length % 7, 0, `${y}-${m}: ${days.length} dager er ikke hele uker`);
    const first = new Date(Date.UTC(+days[0][1], +days[0][2] - 1, +days[0][3]));
    assert.equal(first.getUTCDay(), 1, `${y}-${m}: første rute er ikke en mandag`);
    assert.ok(days.some(d => +d[1] === y && +d[2] === m && +d[3] === 1), 'måneden må inneholde dag 1');
    assert.ok(days.some(d => +d[1] === y && +d[2] === m && +d[3] >= 28), 'måneden må inneholde siste dager');
  }
});

test('Sted: bytte by oppdaterer visning, lagres, og tidssone følger byen', () => {
  const { env, api } = load({ now: NOON });
  env.el('city').value = 'Tokyo';
  api.submitCity();
  assert.equal(api.loc.name, 'Tokyo');
  assert.equal(env.el('clock').textContent, '21:00:00');
  assert.match(env.el('tzline').textContent, /UTC\+9/);
  assert.equal(JSON.parse(env.storage.get('solmane.loc')).name, 'Tokyo');
  assert.equal(env.el('city').value, 'Tokyo');
});

test('Sted: koordinater som tekst gir egendefinert punkt med nærmeste bys tidssone', () => {
  const { env, api } = load({ now: NOON });
  env.el('city').value = '62.47, 6.15';
  api.submitCity();
  assert.equal(api.loc.name, 'Egendefinert punkt');
  assert.equal(api.loc.lat, 62.47);
  assert.match(env.el('coord').innerHTML, /62,470° N, 6,150° Ø/);
});

test('Sted: ukjent by gir feilmelding og beholder gjeldende sted', () => {
  const { env, api } = load({ now: NOON });
  env.el('city').value = 'Xyzxyz';
  api.submitCity();
  assert.equal(env.el('err').hidden, false);
  assert.match(env.el('err').textContent, /Fant ikke «Xyzxyz»/);
  assert.equal(api.loc.name, 'Kristiansand');
});

test('Sted på sørlig halvkule: sommer/vinter-navn byttes om', () => {
  const { env, api } = load({ now: NOON });
  env.el('city').value = 'Sydney';
  api.submitCity();
  assert.match(env.el('sRows').innerHTML, /Neste sommersolverv/, 'desember er sommersolverv i sør');
  assert.match(env.el('sRows').innerHTML, /Neste høstjevndøgn|Neste vårjevndøgn/);
});

test('Polar natt og midnattssol vises med tydelig tekst', () => {
  const sommer = load({ now: Date.UTC(2026, 5, 21, 10, 0, 0) });
  sommer.env.el('city').value = 'Tromsø'; sommer.api.submitCity();
  assert.match(sommer.env.el('sRows').innerHTML, /midnattssol/);
  assert.equal(sommer.env.el('daylen').textContent, '24 t 00 min');
  assert.equal(sommer.env.el('daydiff').textContent, 'Midnattssol');
  const vinter = load({ now: Date.UTC(2026, 11, 21, 10, 0, 0) });
  vinter.env.el('city').value = 'Tromsø'; vinter.api.submitCity();
  assert.match(vinter.env.el('sRows').innerHTML, /mørketid/);
  assert.equal(vinter.env.el('daylen').textContent, '0 t 00 min');
  assert.match(vinter.env.el('daydiff').textContent, /Mørketid/);
});

test('Døgnkurven tegnes med både sol og måne, og tegnes uten feil for alle byer', () => {
  const { env, api } = load({ now: NOON });
  assert.match(env.el('chart').innerHTML, /Daglengde/);
  assert.match(env.el('chart').innerHTML, /horisont/);
  for (const c of ['Longyearbyen', 'Singapore', 'Anchorage', 'Auckland', 'Reykjavík', 'Nuuk']) {
    env.el('city').value = c;
    assert.doesNotThrow(() => api.submitCity(), c);
    assert.equal(api.loc.name, c);
    assert.ok(env.el('chart').innerHTML.length > 500, `${c}: tom kurve`);
    assert.ok(!/NaN|undefined|Infinity/.test(env.el('chart').innerHTML), `${c}: ugyldige tall i kurven`);
    assert.ok(!/NaN|undefined|Infinity/.test(env.el('sRows').innerHTML + env.el('mRows').innerHTML), `${c}: ugyldige tall i panelene`);
  }
});

test('Ingen NaN i noen av panelene gjennom et helt år (første i hver måned)', () => {
  const { env, api } = load({ now: NOON });
  for (let m = 1; m <= 12; m++) {
    api.pickDate(2026, m, 1);
    const html = env.el('sRows').innerHTML + env.el('mRows').innerHTML + env.el('chart').innerHTML + env.el('dialSvg').innerHTML + env.el('phaseSvg').innerHTML;
    assert.ok(!/NaN|undefined|Infinity/.test(html), `måned ${m}: ugyldige tall`);
  }
});

test('Månefase-ikonet speiles på sørlig halvkule', () => {
  const nord = load({ now: Date.UTC(2026, 10, 16, 12) });
  const sor = load({ now: Date.UTC(2026, 10, 16, 12) });
  sor.env.el('city').value = 'Sydney'; sor.api.submitCity();
  assert.match(nord.env.el('phaseSvg').innerHTML, /scale\(1,1\)/);
  assert.match(sor.env.el('phaseSvg').innerHTML, /scale\(-1,1\)/);
});

test('GPS-knappen er skjult der posisjon ikke finnes', () => {
  const { env } = load({ now: NOON });
  assert.equal(env.el('gps').hidden, true);
});

test('GPS-knappen vises der nettleseren har posisjon, og skjules når rammen blokkerer den', async () => {
  const geo = { getCurrentPosition() {} };
  const permissions = state => ({ query: async () => ({ state }) });
  const ok = load({ now: NOON, navigator: { onLine: true, geolocation: geo, permissions: permissions('prompt') } });
  await new Promise(r => setImmediate(r));
  assert.equal(ok.env.el('gps').hidden, false);
  const blocked = load({ now: NOON, framed: true, navigator: { onLine: true, geolocation: geo, permissions: permissions('denied') } });
  await new Promise(r => setImmediate(r));
  assert.equal(blocked.env.el('gps').hidden, true, 'inne i en ramme med blokkert posisjon skal knappen ikke vises');
});

test('GPS: posisjon gir «Min posisjon» med nærmeste by, og feilkoder gir riktig melding', () => {
  let cb;
  const geo = { getCurrentPosition: (ok, err) => { cb = { ok, err }; } };
  const r = load({ now: NOON, navigator: { onLine: true, geolocation: geo, permissions: { query: async () => ({ state: 'prompt' }) } } });
  r.env.el('gps').click();
  cb.ok({ coords: { latitude: 58.2, longitude: 8.05, accuracy: 25 } });
  assert.equal(r.api.loc.name, 'Min posisjon');
  assert.match(r.api.loc.region, /Kristiansand/);
  assert.equal(r.api.loc.gps, true);
  assert.match(r.env.el('coord').innerHTML, /GPS ±25 m/);
  r.env.el('gps').click();
  cb.err({ code: 1 });
  assert.match(r.env.el('err').textContent, /Posisjon er ikke tillatt/);
  r.env.el('gps').click();
  cb.err({ code: 3 });
  assert.match(r.env.el('err').textContent, /ikke posisjonen i tide/);
  r.env.el('gps').click();
  cb.err({ code: 2 });
  assert.match(r.env.el('err').textContent, /ikke tilgjengelig akkurat nå/);
});
