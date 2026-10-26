'use strict';
/* Utgivelsesregler: versjonen skal være lik overalt, og endringsloggen skal starte med gjeldende versjon. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const short = pkg.version.split('.').slice(0, 2).join('.'); // appen viser «v1.7»

test('Versjon i overskriften er lik package.json', () => {
  const m = /<span class="ver">v([\d.]+)<\/span>/.exec(html);
  assert.ok(m, 'fant ikke versjonsmerket i overskriften');
  assert.equal(m[1], short);
});

test('Endringsloggen i info-vinduet starter med gjeldende versjon', () => {
  const m = /<div class="vlog">\s*<b>v([\d.]+)<\/b>/.exec(html);
  assert.ok(m, 'fant ikke endringsloggen');
  assert.equal(m[1], short);
});

test('README har endringslogg med gjeldende versjon øverst', () => {
  const m = /## Versjoner\s+- \*\*v([\d.]+)\*\*/.exec(readme);
  assert.ok(m, 'README mangler «## Versjoner» med versjonsliste');
  assert.equal(m[1], short);
});

test('Versjonsnummeret øker aldri bakover i endringsloggen', () => {
  const list = [...html.matchAll(/<b>v(\d+)\.(\d+)<\/b><span>/g)].map(m => [+m[1], +m[2]]);
  assert.ok(list.length >= 7);
  for (let i = 1; i < list.length; i++) {
    const [a, b] = list[i - 1], [c, d] = list[i];
    assert.ok(a > c || (a === c && b > d), `rekkefølgen er feil mellom v${a}.${b} og v${c}.${d}`);
  }
});
